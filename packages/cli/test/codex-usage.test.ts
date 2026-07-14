import { describe, expect, test } from "bun:test";
import {
  codexSnapshotFromResponse,
  usageFromResponse,
} from "../src/codex-usage.ts";

describe("Codex usage", () => {
  test("extracts session and weekly rate-limit windows", () => {
    expect(
      usageFromResponse({
        id: 2,
        result: {
          rateLimits: {
            planType: "plus",
            primary: { usedPercent: 15, windowDurationMins: 300, resetsAt: 10 },
            secondary: {
              usedPercent: 2,
              windowDurationMins: 10080,
              resetsAt: 20,
            },
          },
        },
      }),
    ).toEqual({
      plan: "plus",
      session: { usedPercent: 15, windowDurationMins: 300, resetsAt: 10 },
      weekly: { usedPercent: 2, windowDurationMins: 10080, resetsAt: 20 },
    });
  });

  test("classifies single primary window as weekly when duration is 10080 min", () => {
    expect(
      usageFromResponse({
        id: 2,
        result: {
          rateLimits: {
            planType: "plus",
            primary: {
              usedPercent: 0,
              windowDurationMins: 10080,
              resetsAt: 1784590263,
            },
            secondary: null,
          },
        },
      }),
    ).toEqual({
      plan: "plus",
      session: null,
      weekly: {
        usedPercent: 0,
        windowDurationMins: 10080,
        resetsAt: 1784590263,
      },
    });
  });

  test("normalizes an auditable provider-neutral snapshot", () => {
    const snapshot = codexSnapshotFromResponse(
      {
        result: {
          rateLimits: {
            planType: "plus",
            primary: {
              usedPercent: 15.5,
              windowDurationMins: 300,
              resetsAt: 10,
            },
            secondary: {
              usedPercent: 2,
              windowDurationMins: 10080,
              resetsAt: 20,
            },
          },
        },
      },
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:01.000Z",
    );
    expect(snapshot.provider).toBe("codex");
    expect(snapshot.collector.authority).toBe("official-client");
    // The live endpoint serves whole-integer usedPercent (grade "rounded"),
    // confirmed across all persisted openai-plus.db payloads. The 15.5 above
    // only exercises pass-through; the collector labels the source honestly.
    expect(snapshot.collector.precision).toBe("integer-percent");
    expect(snapshot.windows[0]).toMatchObject({
      kind: "session",
      usedPercent: 15.5,
      resetsAt: "1970-01-01T00:00:10.000Z",
    });
  });
});
