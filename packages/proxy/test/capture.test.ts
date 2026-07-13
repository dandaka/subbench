import { describe, expect, test } from "bun:test";
import {
  type CaptureRecord,
  extractFromJson,
  mergeUsage,
  newCapture,
  parseSseChunk,
  SseUsageAccumulator,
  type TokenUsage,
} from "../src/capture.ts";
import { PROXY_VERSION } from "../src/version.ts";

const ZERO: TokenUsage = {
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
};

describe("mergeUsage", () => {
  test("fills missing counters with zero", () => {
    expect(mergeUsage({ ...ZERO }, { input_tokens: 10 })).toEqual({
      ...ZERO,
      input_tokens: 10,
    });
  });

  test("keeps base values when a patch omits a counter", () => {
    const base: TokenUsage = {
      input_tokens: 100,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 5,
      output_tokens: 3,
    };
    // A message_delta reports only output_tokens; input/cache must survive.
    expect(mergeUsage(base, { output_tokens: 42 })).toEqual({
      ...base,
      output_tokens: 42,
    });
  });

  test("ignores non-object patches", () => {
    expect(mergeUsage({ ...ZERO }, null)).toEqual(ZERO);
    expect(mergeUsage({ ...ZERO }, "nope")).toEqual(ZERO);
  });
});

describe("extractFromJson", () => {
  test("reads full usage block and served model", () => {
    const body = {
      model: "claude-opus-4-8",
      usage: {
        input_tokens: 1200,
        cache_creation_input_tokens: 300,
        cache_read_input_tokens: 8000,
        output_tokens: 450,
      },
    };
    expect(extractFromJson(body)).toEqual({
      served_model: "claude-opus-4-8",
      usage: body.usage,
    });
  });

  test("returns null model and zero usage for a bodyless response", () => {
    expect(extractFromJson(undefined)).toEqual({
      served_model: null,
      usage: ZERO,
    });
  });
});

describe("SseUsageAccumulator", () => {
  test("accumulates input/cache from message_start and output from message_delta", () => {
    const acc = new SseUsageAccumulator();
    acc.event({
      type: "message_start",
      message: {
        model: "claude-fable-5",
        usage: {
          input_tokens: 500,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 6000,
          output_tokens: 1,
        },
      },
    });
    acc.event({ type: "content_block_delta", delta: { text: "hi" } });
    acc.event({ type: "message_delta", usage: { output_tokens: 88 } });

    expect(acc.servedModel).toBe("claude-fable-5");
    expect(acc.usage).toEqual({
      input_tokens: 500,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 6000,
      output_tokens: 88,
    });
  });

  test("records the served model even when it differs from the pinned request model", () => {
    const acc = new SseUsageAccumulator();
    acc.event({
      type: "message_start",
      message: { model: "claude-opus-4-8", usage: { input_tokens: 10 } },
    });
    expect(acc.servedModel).toBe("claude-opus-4-8");
  });
});

describe("parseSseChunk", () => {
  test("parses complete events and carries the incomplete tail", () => {
    const chunk =
      'event: message_start\ndata: {"type":"message_start","message":{"model":"m","usage":{"input_tokens":7}}}\n\n' +
      'data: {"type":"message_delta","usage":{"output_tokens';
    const { events, rest } = parseSseChunk(chunk);
    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe("message_start");
    expect(rest).toContain("message_delta");
  });

  test("streaming two chunks across a split boundary yields both events", () => {
    const acc = new SseUsageAccumulator();
    let carry = "";
    const feed = (chunk: string) => {
      const { events, rest } = parseSseChunk(carry + chunk);
      for (const e of events) acc.event(e);
      carry = rest;
    };
    feed(
      'data: {"type":"message_start","message":{"model":"m","usage":{"input_tokens":7,"cache_read_input_tokens":9}}}\n\n' +
        'data: {"type":"message_del',
    );
    feed('ta","usage":{"output_tokens":5}}\n\n');
    expect(acc.usage.input_tokens).toBe(7);
    expect(acc.usage.cache_read_input_tokens).toBe(9);
    expect(acc.usage.output_tokens).toBe(5);
  });

  test("ignores [DONE] and blank data lines", () => {
    const { events } = parseSseChunk("data: [DONE]\n\ndata:\n\n");
    expect(events).toHaveLength(0);
  });
});

describe("newCapture", () => {
  test("stamps the proxy version", () => {
    const record: CaptureRecord = newCapture({
      timestamp: "2026-07-13T00:00:00.000Z",
      method: "POST",
      path: "/v1/messages",
      request_body: { model: "m" },
      response_status: 200,
      streamed: false,
      served_model: "m",
      usage: ZERO,
      rate_limits: { "5h": null, "7d": null },
    });
    expect(record.proxy_version).toBe(PROXY_VERSION);
    expect(record.timestamp).toBe("2026-07-13T00:00:00.000Z");
  });
});
