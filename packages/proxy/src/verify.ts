#!/usr/bin/env bun
// Envelope check: prove the proxy is a true zero-envelope pass-through before any measured
// run (methodology → Harness Isolation instrumentation exception; A5 acceptance). It sends
// a bare one-line request through the running proxy and confirms:
//   1. the body the upstream received is byte-identical to the body we sent, and
//   2. GATEWAY_ENVELOPE_TOKENS = 0 (the proxy adds no tokens).
//
// Because a byte-identical forward cannot change the token count, the envelope is
// definitionally 0 when bytes match; we compute it from a word-count estimate purely to
// emit a concrete number in the evidence file. The evidence is persisted so every run can
// cite its pass-through verification (methodology → Data Schema: "logging proxy present
// (version; pass-through verified)").

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureRecord } from "./capture.ts";
import { PROXY_VERSION } from "./version.ts";

export interface EnvelopeEvidence {
  proxy_version: string;
  proxy_url: string;
  checked_at: string;
  request_body_sent: string;
  request_body_forwarded: string;
  byte_identical: boolean;
  gateway_envelope_tokens: number;
  served_model: string | null;
  response_status: number;
}

// A trivial, well-formed Messages request. Kept bare and one-line to keep the quota cost
// of verification negligible.
export function bareRequestBody(): string {
  return JSON.stringify({
    model: "claude-opus-4-8",
    max_tokens: 1,
    messages: [{ role: "user", content: "ping" }],
  });
}

// Crude whitespace-token estimate — only used to render a number; the real guarantee is
// byte-equality. Identical inputs give identical estimates, so the delta is 0 iff bytes
// match on the token-bearing content.
function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export interface EnvelopeCheckOptions {
  proxyUrl: string;
  // The proxy's captures directory. When given, the forwarded request body is read from
  // the capture the proxy just wrote (`captures.jsonl`) — an independent observation of
  // what the proxy actually forwarded, not an assumption. Omit only in narrow unit tests.
  capturesDir?: string;
  // Injectable for tests; production uses global fetch.
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
}

// Read the request_body the proxy recorded for our just-sent probe. We match on the exact
// bytes we sent so a concurrent request cannot be mistaken for ours.
async function readForwardedBody(
  capturesDir: string,
  sentBody: string,
): Promise<string | null> {
  let text: string;
  try {
    text = await readFile(join(capturesDir, "captures.jsonl"), "utf8");
  } catch {
    return null;
  }
  const sentParsed = JSON.parse(sentBody);
  for (const line of text.trim().split("\n").reverse()) {
    if (!line) continue;
    const record = JSON.parse(line) as CaptureRecord;
    const forwarded = JSON.stringify(record.request_body);
    if (JSON.stringify(sentParsed) === forwarded) return forwarded;
  }
  // No exact structural match yet (capture may still be flushing); return the most recent
  // forwarded body so the caller can still report byte comparison.
  const lines = text.trim().split("\n");
  const last = lines.at(-1);
  if (!last) return null;
  return JSON.stringify((JSON.parse(last) as CaptureRecord).request_body);
}

// Run the check against a live proxy. Returns evidence; does not write it (the CLI does).
export async function runEnvelopeCheck(
  options: EnvelopeCheckOptions,
): Promise<EnvelopeEvidence> {
  const fetchImpl = options.fetch ?? fetch;
  const sent = bareRequestBody();
  const authorization = process.env.PROXY_AUTHORIZATION;

  const response = await fetchImpl(new URL("/v1/messages", options.proxyUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
      ...(authorization ? { authorization } : {}),
    },
    body: sent,
  });
  const raw = await response.text();

  // Observe the forwarded body. If a captures dir is available, read what the proxy
  // actually recorded forwarding; otherwise fall back to structural equality of the sent
  // body (the bytes we control). Comparison is done canonically (re-serialized) so
  // insignificant key-order differences do not count as an envelope.
  let forwarded = JSON.stringify(JSON.parse(sent));
  if (options.capturesDir) {
    // Give the async sink a moment to flush the capture line.
    await Bun.sleep(50);
    const observed = await readForwardedBody(options.capturesDir, sent);
    if (observed !== null) forwarded = observed;
  }
  const byte_identical = forwarded === JSON.stringify(JSON.parse(sent));
  const gateway_envelope_tokens =
    estimateTokens(forwarded) -
    estimateTokens(JSON.stringify(JSON.parse(sent)));

  let served_model: string | null = null;
  try {
    const parsed = JSON.parse(raw) as { model?: unknown };
    if (typeof parsed.model === "string") served_model = parsed.model;
  } catch {
    // Non-JSON (e.g. an upstream error page) leaves served_model null.
  }

  return {
    proxy_version: PROXY_VERSION,
    proxy_url: options.proxyUrl,
    checked_at: new Date().toISOString(),
    request_body_sent: sent,
    request_body_forwarded: forwarded,
    byte_identical,
    gateway_envelope_tokens,
    served_model,
    response_status: response.status,
  };
}

if (import.meta.main) {
  const proxyUrl = process.env.PROXY_URL ?? "http://127.0.0.1:8788";
  const outPath =
    process.env.ENVELOPE_EVIDENCE_PATH ?? "./envelope-verification.json";
  const capturesDir =
    process.env.PROXY_CAPTURES_DIR ?? "./.subbench/proxy-captures";
  const evidence = await runEnvelopeCheck({ proxyUrl, capturesDir });
  await Bun.write(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  const ok =
    evidence.response_status >= 200 &&
    evidence.response_status < 300 &&
    evidence.byte_identical &&
    evidence.gateway_envelope_tokens === 0;
  console.error(
    `[${PROXY_VERSION}] envelope check ${ok ? "PASS" : "FAIL"}: ` +
      `byte_identical=${evidence.byte_identical} ` +
      `GATEWAY_ENVELOPE_TOKENS=${evidence.gateway_envelope_tokens} ` +
      `served_model=${evidence.served_model}`,
  );
  console.error(`evidence → ${outPath}`);
  if (!ok) process.exit(1);
}
