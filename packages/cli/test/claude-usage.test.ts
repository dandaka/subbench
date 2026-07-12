import { describe, expect, test } from "bun:test";
import {
  claudeSnapshotFromResponse,
  parseRetryAfterSeconds,
} from "../src/claude-usage.ts";
import { UsageError } from "../src/usage.ts";

describe("Claude usage snapshot", () => {
  test("maps five_hour to session and seven_day to weekly", () => {
    const snapshot = claudeSnapshotFromResponse(
      {
        five_hour: { utilization: 79, resets_at: "2026-07-10T04:00:00.000Z" },
        seven_day: { utilization: 66, resets_at: "2026-07-14T10:41:12.000Z" },
      },
      {
        subscriptionType: "max",
        idHash: "abcd1234",
        requestedAt: "2026-07-10T00:00:00.000Z",
        respondedAt: "2026-07-10T00:00:01.000Z",
      },
    );

    expect(snapshot.provider).toBe("claude");
    expect(snapshot.account).toEqual({ plan: "max", idHash: "abcd1234" });
    expect(snapshot.collector.authority).toBe("server");
    expect(snapshot.collector.precision).toBe("integer-percent");
    expect(snapshot.windows).toEqual([
      {
        kind: "session",
        usedPercent: 79,
        resetsAt: "2026-07-10T04:00:00.000Z",
      },
      { kind: "weekly", usedPercent: 66, resetsAt: "2026-07-14T10:41:12.000Z" },
    ]);
  });

  test("keeps decimal utilization precise", () => {
    const snapshot = claudeSnapshotFromResponse({
      five_hour: { utilization: 12.5, resets_at: "2026-07-10T04:00:00.000Z" },
      seven_day: { utilization: 3.25, resets_at: "2026-07-14T10:41:12.000Z" },
    });
    expect(snapshot.windows[0]!.usedPercent).toBe(12.5);
    expect(snapshot.windows[1]!.usedPercent).toBe(3.25);
  });

  test("tolerates a missing reset timestamp", () => {
    const snapshot = claudeSnapshotFromResponse({
      five_hour: { utilization: 10 },
      seven_day: { utilization: 20, resets_at: "2026-07-14T10:41:12.000Z" },
    });
    expect(snapshot.windows[0]).toEqual({
      kind: "session",
      usedPercent: 10,
      resetsAt: null,
    });
  });

  test("ignores model-scoped and extra-usage fields (kept only in raw)", () => {
    const payload = {
      five_hour: { utilization: 10, resets_at: "2026-07-10T04:00:00.000Z" },
      seven_day: { utilization: 20, resets_at: "2026-07-14T10:41:12.000Z" },
      seven_day_opus: {
        utilization: 40,
        resets_at: "2026-07-14T10:41:12.000Z",
      },
      extra_usage: { is_enabled: true, used_credits: 5 },
    };
    const snapshot = claudeSnapshotFromResponse(payload);
    expect(snapshot.windows.map((w) => w.kind)).toEqual(["session", "weekly"]);
    expect(snapshot.raw).toBe(payload);
  });

  test("rejects an invalid reset timestamp", () => {
    expect(() =>
      claudeSnapshotFromResponse({
        five_hour: { utilization: 10, resets_at: "not-a-date" },
        seven_day: { utilization: 20 },
      }),
    ).toThrow(UsageError);
  });

  test("rejects a payload with no recognizable windows", () => {
    expect(() => claudeSnapshotFromResponse({ limits: [] })).toThrow(
      UsageError,
    );
  });
});

describe("parseRetryAfterSeconds", () => {
  test("parses positive integer seconds", () => {
    expect(parseRetryAfterSeconds("120")).toBe(120);
  });

  test("rejects a literal 0 (observed 429-with-0 loop)", () => {
    expect(parseRetryAfterSeconds("0")).toBeNull();
  });

  test("returns null for missing or empty values", () => {
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds("  ")).toBeNull();
  });

  test("parses a future HTTP-date into remaining seconds", () => {
    const now = Date.parse("2026-07-10T00:00:00.000Z");
    const result = parseRetryAfterSeconds("Fri, 10 Jul 2026 00:05:00 GMT", now);
    expect(result).toBeCloseTo(300, 0);
  });

  test("returns null for a past HTTP-date", () => {
    const now = Date.parse("2026-07-10T01:00:00.000Z");
    expect(
      parseRetryAfterSeconds("Fri, 10 Jul 2026 00:00:00 GMT", now),
    ).toBeNull();
  });
});
