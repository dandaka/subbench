import { describe, expect, test } from "bun:test";
import { renderUsage } from "../src/usage.ts";
import { zaiSnapshotFromResponse } from "../src/zai-usage.ts";

describe("shared usage snapshots", () => {
  test("selects numeric output", () => {
    const snapshot = zaiSnapshotFromResponse({
      data: [
        {
          type: "TOKENS_LIMIT",
          unit: 3,
          usedPercent: 12.25,
          resetTime: 2_000_000_000,
        },
        {
          type: "TOKENS_LIMIT",
          unit: 6,
          usedPercent: 5,
          resetTime: "2030-01-01T00:00:00Z",
        },
      ],
    });
    expect(renderUsage(snapshot, "weekly", "numeric")).toBe("5");
    expect(snapshot.windows.map((window) => window.kind)).toEqual([
      "session",
      "weekly",
    ]);
  });

  test("retains legacy and unexpected units as unknown", () => {
    const snapshot = zaiSnapshotFromResponse({
      data: [{ type: "TOKENS_LIMIT", used: 1, limit: 4 }],
    });
    expect(snapshot.windows[0]).toMatchObject({
      kind: "unknown",
      usedPercent: 25,
      providerUnit: null,
    });
  });

  test("rejects malformed percentages", () => {
    expect(() =>
      zaiSnapshotFromResponse({
        data: [{ type: "TOKENS_LIMIT", unit: 3, usedPercent: 101 }],
      }),
    ).toThrow();
  });
});
