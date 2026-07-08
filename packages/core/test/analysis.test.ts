import { describe, expect, test } from "bun:test";
import { calculate } from "../src/index.ts";
import type { CalibrationRun } from "../src/index.ts";

function run(delta: number, success = 1, promotion = 0): CalibrationRun {
  return {
    usage_delta: delta,
    api_equivalent_usd: 2,
    success,
    limit_event: 0,
    promotion,
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:10:00Z",
  };
}

describe("v1 analysis", () => {
  test("implements the documented formula", () => {
    const result = calculate({
      runs: [run(8), run(9), run(10, 0), run(9), run(8)],
      quotaCapacity: 100,
      planPrice: 20,
      averageCostUsd: 2,
      publishedPassAt1: 0.6,
    });
    expect(result.conversionFactor).toBe(4.5);
    expect(result.successfulTasksPerPeriod).toBeCloseTo(100 / 9 * 0.6);
    expect(result.subscriptionValueIndex).toBeCloseTo(1 / 3);
    expect(result.breakEvenTasks).toBeCloseTo(6);
  });

  test("supports promotions only as separate cells", () => {
    expect(calculate({
      runs: [run(1, 1, 1)],
      quotaCapacity: 100,
      planPrice: 20,
      averageCostUsd: 2,
      publishedPassAt1: 0.5,
    }).medianDrain).toBe(1);
    expect(() => calculate({
      runs: [run(8), run(1, 1, 1)],
      quotaCapacity: 100,
      planPrice: 20,
      averageCostUsd: 2,
      publishedPassAt1: 0.5,
    })).toThrow("separately");
  });
});
