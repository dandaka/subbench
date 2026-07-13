import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyChain } from "../src/audit.ts";
import type { CaptureRecord } from "../src/capture.ts";
import { CaptureSink } from "../src/sink.ts";

function capture(id: number): CaptureRecord {
  return {
    proxy_version: "subbench-proxy/test",
    timestamp: `2026-07-13T12:00:0${id}.000Z`,
    method: "POST",
    path: "/v1/messages",
    request_body: { id },
    response_status: 200,
    streamed: false,
    served_model: "claude-opus-4-8",
    usage: {
      input_tokens: id,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: id,
    },
    rate_limits: { "5h": null, "7d": null },
  };
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "subbench-sink-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("CaptureSink", () => {
  test("writes one JSONL line per capture", async () => {
    await withTmp(async (dir) => {
      const sink = new CaptureSink(dir);
      await sink.write(capture(1));
      await sink.write(capture(2));
      await sink.close();

      const text = await readFile(join(dir, "captures.jsonl"), "utf8");
      const lines = text.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).usage.input_tokens).toBe(1);
      expect(JSON.parse(lines[1]!).usage.input_tokens).toBe(2);
    });
  });

  test("never drops a record under concurrent backpressure (lossless)", async () => {
    await withTmp(async (dir) => {
      const sink = new CaptureSink(dir);
      // Fire 50 writes without awaiting between them; the sink must serialize and persist
      // every one — this is the property claude-meter's async tee lacks.
      const writes = Array.from({ length: 50 }, (_, i) =>
        sink.write(capture(i)),
      );
      await Promise.all(writes);
      await sink.close();

      const text = await readFile(join(dir, "captures.jsonl"), "utf8");
      expect(text.trim().split("\n")).toHaveLength(50);
    });
  });

  test("maintains a verifiable audit chain alongside the captures", async () => {
    await withTmp(async (dir) => {
      const sink = new CaptureSink(dir);
      for (let i = 1; i <= 5; i++) await sink.write(capture(i));
      await sink.close();

      const auditText = await readFile(join(dir, "audit.jsonl"), "utf8");
      const chain = auditText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(chain).toHaveLength(5);
      expect(await verifyChain(chain)).toEqual({ valid: true, length: 5 });
    });
  });
});
