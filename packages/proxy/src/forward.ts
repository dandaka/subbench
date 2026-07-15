// Pass-through forwarding core. Given an incoming Request, forward it byte-identically to
// upstream and return the upstream Response unaltered, plus the capture observed in
// passing. This is the ONE place traffic is proxied; both the server (server.ts) and the
// verification command (verify.ts) call it, so "what the proxy does" is defined once.
//
// Hard invariant (methodology.md → Harness Isolation instrumentation exception): the
// proxy adds zero tokens and alters nothing. It never edits the request body, never
// injects headers that reach the model, and streams SSE bytes through verbatim while
// only *reading* a copy for usage.

import {
  type CaptureRecord,
  extractFromJson,
  newCapture,
  parseSseChunk,
  SseUsageAccumulator,
} from "./capture.ts";
import { extractRateLimits } from "./ratelimit.ts";

export const DEFAULT_UPSTREAM = "https://api.anthropic.com";

// The fetch used to reach upstream. Injectable so tests can stub the network without
// touching the global; production passes the real `fetch`.
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

// Hop-by-hop headers must not be forwarded per RFC 7230 §6.1. Anthropic's API is HTTP/2
// upstream via fetch; leaving these in can corrupt the connection. Stripping them does
// not alter the request the *model* sees (they are transport-level), so pass-through of
// the semantic payload is preserved.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function forwardableHeaders(headers: Headers): Headers {
  const out = new Headers();
  for (const [key, value] of headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  }
  return out;
}

function parseJsonOrRaw(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isEventStream(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes(
    "text/event-stream",
  );
}

export interface ForwardResult {
  response: Response;
  // Resolves once the response body has fully passed through the client. Usage for a
  // stream is only complete at end-of-stream, so callers that persist captures await it.
  capture: Promise<CaptureRecord>;
}

// Forward `request` to `upstream` (origin only, e.g. https://api.anthropic.com),
// preserving method, path, query, headers, and body exactly. `now` is injected so the
// capture timestamp is deterministic in tests.
export async function forward(
  request: Request,
  options: { upstream: string; now: () => Date; fetch?: FetchLike },
): Promise<ForwardResult> {
  const fetchImpl: FetchLike = options.fetch ?? fetch;
  const incoming = new URL(request.url);
  const target = new URL(options.upstream);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const timestamp = options.now().toISOString();
  const method = request.method;
  const path = incoming.pathname + incoming.search;

  // Read the request body as raw bytes so forwarding is byte-identical regardless of
  // content type; keep a parsed copy for the capture only.
  const requestBytes =
    method === "GET" || method === "HEAD"
      ? undefined
      : new Uint8Array(await request.arrayBuffer());
  const requestBody =
    requestBytes && requestBytes.byteLength > 0
      ? parseJsonOrRaw(new TextDecoder().decode(requestBytes))
      : null;

  const upstreamResponse = await fetchImpl(target, {
    method,
    headers: forwardableHeaders(request.headers),
    ...(requestBytes ? { body: requestBytes } : {}),
    redirect: "manual",
  });

  const responseHeaders = forwardableHeaders(upstreamResponse.headers);
  // Bun's fetch transparently decompresses upstream bodies. Forwarding the original
  // content-encoding after that transform makes downstream clients attempt a second
  // decompression and reject an otherwise untouched response.
  responseHeaders.delete("content-encoding");
  const status = upstreamResponse.status;
  // The unified quota reading is read off the response headers before we hand the body
  // back; it is independent of body streaming.
  const rate_limits = extractRateLimits(upstreamResponse.headers);

  if (upstreamResponse.body && isEventStream(upstreamResponse)) {
    const accumulator = new SseUsageAccumulator();
    let resolveCapture: (record: CaptureRecord) => void;
    const capture = new Promise<CaptureRecord>((resolve) => {
      resolveCapture = resolve;
    });

    // Tee: bytes flow to the client unchanged; a decoded copy feeds the accumulator.
    const decoder = new TextDecoder();
    let carry = "";
    const tee = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk); // byte-identical pass-through
        carry += decoder.decode(chunk, { stream: true });
        const { events, rest } = parseSseChunk(carry);
        carry = rest;
        for (const event of events) accumulator.event(event);
      },
      flush() {
        // Flush any trailing event that lacked a blank-line terminator. Appending one
        // boundary parses that remainder exactly once; events already consumed during
        // transform are gone from `carry`, so nothing is double-counted.
        decoder.decode();
        if (carry.trim().length > 0) {
          const { events } = parseSseChunk(`${carry}\n\n`);
          for (const event of events) accumulator.event(event);
        }
        resolveCapture(
          newCapture({
            timestamp,
            method,
            path,
            request_body: requestBody,
            response_status: status,
            streamed: true,
            served_model: accumulator.servedModel,
            usage: accumulator.usage,
            rate_limits,
          }),
        );
      },
    });

    return {
      response: new Response(upstreamResponse.body.pipeThrough(tee), {
        status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      }),
      capture,
    };
  }

  // Non-streaming: buffer the body, forward it unchanged, capture usage from JSON.
  const responseBytes = new Uint8Array(await upstreamResponse.arrayBuffer());
  const parsed =
    responseBytes.byteLength > 0
      ? parseJsonOrRaw(new TextDecoder().decode(responseBytes))
      : null;
  const { usage, served_model } = extractFromJson(parsed);

  const capture = Promise.resolve(
    newCapture({
      timestamp,
      method,
      path,
      request_body: requestBody,
      response_status: status,
      streamed: false,
      served_model,
      usage,
      rate_limits,
    }),
  );

  return {
    response: new Response(
      responseBytes.byteLength > 0 ? responseBytes : null,
      {
        status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      },
    ),
    capture,
  };
}
