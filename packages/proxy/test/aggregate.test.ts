import { describe, expect, test } from "bun:test";
import { aggregate, LARGE_CACHE_WRITE_THRESHOLD } from "../src/aggregate.ts";
import type { CaptureRecord } from "../src/capture.ts";

function capture(over: Partial<CaptureRecord> = {}): CaptureRecord {
  return {
    proxy_version: "subbench-proxy/test",
    timestamp: "2026-07-13T12:00:00.000Z",
    method: "POST",
    path: "/v1/messages",
    request_body: null,
    response_status: 200,
    streamed: true,
    served_model: "claude-opus-4-8",
    usage: {
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
    },
    rate_limits: { "5h": null, "7d": null },
    ...over,
  };
}

describe("aggregate", () => {
  test("sums the four token classes and counts requests", () => {
    const result = aggregate([
      capture({
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 1000,
          output_tokens: 40,
        },
      }),
      capture({
        usage: {
          input_tokens: 200,
          cache_creation_input_tokens: 20,
          cache_read_input_tokens: 2000,
          output_tokens: 60,
        },
      }),
    ]);
    expect(result.request_count).toBe(2);
    expect(result.token_totals).toEqual({
      input_tokens: 300,
      cache_creation_input_tokens: 30,
      cache_read_input_tokens: 3000,
      output_tokens: 100,
    });
  });

  test("brackets the run by first and last capture timestamp", () => {
    const result = aggregate([
      capture({ timestamp: "2026-07-13T12:05:00.000Z" }),
      capture({ timestamp: "2026-07-13T12:01:00.000Z" }),
      capture({ timestamp: "2026-07-13T12:09:00.000Z" }),
    ]);
    expect(result.started_at).toBe("2026-07-13T12:01:00.000Z");
    expect(result.ended_at).toBe("2026-07-13T12:09:00.000Z");
  });

  test("flags large cache-write events (mid-session prefix re-writes)", () => {
    const big = LARGE_CACHE_WRITE_THRESHOLD + 1;
    const result = aggregate([
      capture({
        timestamp: "2026-07-13T12:02:00.000Z",
        usage: {
          input_tokens: 0,
          cache_creation_input_tokens: big,
          cache_read_input_tokens: 0,
          output_tokens: 0,
        },
      }),
      capture({
        usage: {
          input_tokens: 0,
          cache_creation_input_tokens: 5,
          cache_read_input_tokens: 0,
          output_tokens: 0,
        },
      }),
    ]);
    expect(result.large_cache_write_events).toEqual([
      {
        timestamp: "2026-07-13T12:02:00.000Z",
        cache_creation_input_tokens: big,
      },
    ]);
  });

  test("lists distinct served models (catches silent tier substitution)", () => {
    const result = aggregate([
      capture({ served_model: "claude-fable-5" }),
      capture({ served_model: "claude-opus-4-8" }),
      capture({ served_model: "claude-fable-5" }),
      capture({ served_model: null }),
    ]);
    expect(result.served_models.sort()).toEqual([
      "claude-fable-5",
      "claude-opus-4-8",
    ]);
  });

  test("emits per-window utilization-float series in timestamp order", () => {
    const result = aggregate([
      capture({
        timestamp: "2026-07-13T12:03:00.000Z",
        rate_limits: {
          "5h": { status: "allowed", utilization: 0.5, reset: null },
          "7d": null,
        },
      }),
      capture({
        timestamp: "2026-07-13T12:01:00.000Z",
        rate_limits: {
          "5h": { status: "allowed", utilization: 0.4, reset: null },
          "7d": { status: "allowed", utilization: 0.9, reset: null },
        },
      }),
    ]);
    expect(result.utilization_series["5h"]).toEqual([
      { timestamp: "2026-07-13T12:01:00.000Z", utilization: 0.4 },
      { timestamp: "2026-07-13T12:03:00.000Z", utilization: 0.5 },
    ]);
    expect(result.utilization_series["7d"]).toEqual([
      { timestamp: "2026-07-13T12:01:00.000Z", utilization: 0.9 },
    ]);
  });

  test("returns an empty-but-valid rollup for no captures", () => {
    const result = aggregate([]);
    expect(result.request_count).toBe(0);
    expect(result.started_at).toBeNull();
    expect(result.token_totals.input_tokens).toBe(0);
    expect(result.served_models).toEqual([]);
  });
});
