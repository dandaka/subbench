import { describe, expect, test } from "bun:test";
import { forward } from "../src/forward.ts";

const now = () => new Date("2026-07-13T12:00:00.000Z");

// A fetch stub records what the proxy sent upstream and returns a canned response, so we
// can assert both byte-identical forwarding AND capture extraction without real network.
function stubFetch(response: Response, sink: { seen?: Request } = {}) {
  return (input: string | URL | Request, init?: RequestInit) => {
    sink.seen = new Request(
      typeof input === "string" || input instanceof URL
        ? input.toString()
        : input.url,
      init,
    );
    return Promise.resolve(response);
  };
}

function sse(lines: string): Response {
  return new Response(lines, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("forward — pass-through invariants", () => {
  test("forwards method, path, query and body unchanged to the upstream origin", async () => {
    const sink: { seen?: Request } = {};
    const upstreamResponse = new Response(
      JSON.stringify({ model: "claude-opus-4-8", usage: { input_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const req = new Request("http://localhost:9000/v1/messages?beta=true", {
      method: "POST",
      headers: { "x-api-key": "sk-test", "content-type": "application/json" },
      body: '{"model":"claude-opus-4-8","messages":[]}',
    });

    const { response, capture } = await forward(req, {
      upstream: "https://api.anthropic.com",
      now,
      fetch: stubFetch(upstreamResponse, sink),
    });

    expect(sink.seen!.url).toBe(
      "https://api.anthropic.com/v1/messages?beta=true",
    );
    expect(sink.seen!.method).toBe("POST");
    expect(await sink.seen!.text()).toBe(
      '{"model":"claude-opus-4-8","messages":[]}',
    );
    expect(sink.seen!.headers.get("x-api-key")).toBe("sk-test");

    // Response body is returned byte-identically.
    expect(await response.text()).toBe(
      JSON.stringify({ model: "claude-opus-4-8", usage: { input_tokens: 5 } }),
    );
    const record = await capture;
    expect(record.usage.input_tokens).toBe(5);
    expect(record.served_model).toBe("claude-opus-4-8");
    expect(record.streamed).toBe(false);
  });

  test("captures the unified ratelimit headers from the response", async () => {
    const upstreamResponse = new Response(
      JSON.stringify({ model: "claude-opus-4-8", usage: {} }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "anthropic-ratelimit-unified-5h-status": "allowed",
          "anthropic-ratelimit-unified-5h-utilization": "0.25",
          "anthropic-ratelimit-unified-5h-reset": "2026-07-13T17:00:00Z",
          "anthropic-ratelimit-unified-7d-utilization": "0.8",
        },
      },
    );
    const req = new Request("http://localhost:9000/v1/messages", {
      method: "POST",
      body: "{}",
    });

    const { capture } = await forward(req, {
      upstream: "https://api.anthropic.com",
      now,
      fetch: stubFetch(upstreamResponse),
    });
    const record = await capture;
    expect(record.rate_limits["5h"]).toEqual({
      status: "allowed",
      utilization: 0.25,
      reset: "2026-07-13T17:00:00Z",
    });
    expect(record.rate_limits["7d"]).toEqual({
      status: null,
      utilization: 0.8,
      reset: null,
    });
  });

  test("streams SSE bytes through verbatim and reassembles usage exactly once", async () => {
    // A final message_delta that is itself a complete block must not be double-counted by
    // the end-of-stream flush.
    const body =
      'data: {"type":"message_start","message":{"model":"claude-fable-5","usage":{"input_tokens":100,"cache_read_input_tokens":9000}}}\n\n' +
      'data: {"type":"message_delta","usage":{"output_tokens":40}}\n\n';
    const req = new Request("http://localhost:9000/v1/messages", {
      method: "POST",
      body: '{"stream":true}',
    });

    const { response, capture } = await forward(req, {
      upstream: "https://api.anthropic.com",
      now,
      fetch: stubFetch(sse(body)),
    });

    // Bytes out are identical to bytes in.
    expect(await response.text()).toBe(body);
    const record = await capture;
    expect(record.streamed).toBe(true);
    expect(record.served_model).toBe("claude-fable-5");
    expect(record.usage).toEqual({
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 9000,
      output_tokens: 40,
    });
  });

  test("does not add or drop response headers other than hop-by-hop", async () => {
    const upstreamResponse = new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "anthropic-organization-id": "org-xyz",
        "transfer-encoding": "chunked",
      },
    });
    const { response } = await forward(
      new Request("http://localhost:9000/v1/messages", {
        method: "POST",
        body: "{}",
      }),
      {
        upstream: "https://api.anthropic.com",
        now,
        fetch: stubFetch(upstreamResponse),
      },
    );
    expect(response.headers.get("anthropic-organization-id")).toBe("org-xyz");
    expect(response.headers.get("transfer-encoding")).toBeNull();
  });
});
