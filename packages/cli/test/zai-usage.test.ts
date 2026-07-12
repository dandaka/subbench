import { describe, expect, test } from "bun:test";
import { zaiSnapshotFromResponse } from "../src/zai-usage.ts";

// Payload shape mirrors the persisted zai-coding-lite.db records: a `data.limits`
// array whose entries carry a whole-integer `percentage`, mapped by unit
// (3=session, 6=weekly) plus a TIME_LIMIT (mcp) record.
describe("Z.ai usage", () => {
  test("labels the source integer-percent and maps units to windows", () => {
    const snapshot = zaiSnapshotFromResponse(
      {
        code: 200,
        data: {
          level: "lite",
          limits: [
            {
              type: "TIME_LIMIT",
              unit: 5,
              percentage: 33,
              nextResetTime: 1784803272997,
            },
            { type: "TOKENS_LIMIT", unit: 3, percentage: 30 },
            {
              type: "TOKENS_LIMIT",
              unit: 6,
              percentage: 72,
              nextResetTime: 1784025672995,
            },
          ],
        },
        success: true,
      },
      {
        endpoint: "https://api.z.ai/api/monitor/usage/quota/limit",
        requestedAt: "2026-07-12T00:00:00.000Z",
        respondedAt: "2026-07-12T00:00:01.000Z",
      },
    );

    expect(snapshot.provider).toBe("zai");
    expect(snapshot.account.plan).toBe("lite");
    expect(snapshot.collector.authority).toBe("server");
    // The endpoint always supplies a whole-integer `percentage` per record
    // (grade "rounded"), confirmed across all persisted payloads. The
    // currentValue/limitValue ratio fallback never fires, so no float is emitted.
    expect(snapshot.collector.precision).toBe("integer-percent");
    expect(snapshot.windows.map((w) => [w.kind, w.usedPercent])).toEqual([
      ["mcp", 33],
      ["session", 30],
      ["weekly", 72],
    ]);
    // Every emitted utilization is a whole integer, matching the label.
    for (const w of snapshot.windows) {
      expect(Number.isInteger(w.usedPercent)).toBe(true);
    }
  });
});
