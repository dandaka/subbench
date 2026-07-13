import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../src/server.ts";
import { runEnvelopeCheck } from "../src/verify.ts";

// A fake upstream that records the exact bytes it received and returns a canned Messages
// response with unified ratelimit headers, so the whole rig (server → forward → capture →
// sink) is exercised end to end without touching the real API.
let upstream: ReturnType<typeof Bun.serve>;
let lastUpstreamBody = "";
let capturesDir = "";
let proxy: ReturnType<typeof startServer>;

beforeAll(async () => {
  upstream = Bun.serve({
    port: 0,
    async fetch(req) {
      lastUpstreamBody = await req.text();
      return new Response(
        JSON.stringify({
          model: "claude-opus-4-8",
          usage: {
            input_tokens: 7,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 3,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "anthropic-ratelimit-unified-5h-status": "allowed",
            "anthropic-ratelimit-unified-5h-utilization": "0.01",
          },
        },
      );
    },
  });
  capturesDir = await mkdtemp(join(tmpdir(), "subbench-verify-"));
  proxy = startServer({
    port: 0,
    upstream: `http://127.0.0.1:${upstream.port}`,
    capturesDir,
  });
});

afterAll(async () => {
  await proxy.stop();
  await upstream.stop(true);
  await rm(capturesDir, { recursive: true, force: true });
});

describe("runEnvelopeCheck", () => {
  test("proves byte-identical forwarding and GATEWAY_ENVELOPE_TOKENS = 0", async () => {
    const evidence = await runEnvelopeCheck({
      proxyUrl: proxy.url,
      capturesDir,
    });

    // The bytes the upstream received must equal the bytes the verifier sent.
    expect(lastUpstreamBody).toBe(evidence.request_body_sent);
    expect(evidence.byte_identical).toBe(true);
    expect(evidence.gateway_envelope_tokens).toBe(0);
    expect(evidence.served_model).toBe("claude-opus-4-8");
    expect(evidence.proxy_url).toBe(proxy.url);
  });

  test("the request is captured to the sink JSONL", async () => {
    await runEnvelopeCheck({ proxyUrl: proxy.url });
    await proxy.stop(); // flush the sink
    const text = await readFile(join(capturesDir, "captures.jsonl"), "utf8");
    const lines = text.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const last = JSON.parse(lines.at(-1)!);
    expect(last.served_model).toBe("claude-opus-4-8");
    expect(last.rate_limits["5h"].utilization).toBe(0.01);
  });
});
