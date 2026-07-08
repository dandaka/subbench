import { describe, expect, test } from "bun:test";
import { usageFromResponse } from "../src/codex-usage.ts";

describe("Codex usage", () => {
  test("extracts session and weekly rate-limit windows", () => {
    expect(usageFromResponse({
      id: 2,
      result: {
        rateLimits: {
          planType: "plus",
          primary: { usedPercent: 15, windowDurationMins: 300, resetsAt: 10 },
          secondary: { usedPercent: 2, windowDurationMins: 10080, resetsAt: 20 },
        },
      },
    })).toEqual({
      plan: "plus",
      session: { usedPercent: 15, windowDurationMins: 300, resetsAt: 10 },
      weekly: { usedPercent: 2, windowDurationMins: 10080, resetsAt: 20 },
    });
  });
});
