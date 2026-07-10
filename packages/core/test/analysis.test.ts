import { describe, expect, test } from "bun:test";
import type { CalibrationRun } from "../src/index.ts";
import { calculate } from "../src/index.ts";

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

const base = {
  quotaCapacity: 100,
  quotaWindowDays: 7,
  planPrice: 20,
  billingDays: 30,
  averageCostUsd: 2,
  publishedPassAt1: 0.6,
};

describe("v1 analysis", () => {
  test("implements the window-normalized native formula", () => {
    const result = calculate({
      ...base,
      runs: [run(8), run(9), run(10, 0), run(9), run(8)],
    });
    // conversion factor = median(delta/api) = median([4,4.5,5,4.5,4]) = 4.5
    expect(result.conversionFactor).toBe(4.5);
    // window price = 20 * 7 / 30
    expect(result.windowPrice).toBeCloseTo((20 * 7) / 30);
    // native success rate = 4/5
    expect(result.nativeSuccessRate).toBeCloseTo(0.8);
    // primary uses all drain, including the failure: 100 * 4 / (8+9+10+9+8)
    expect(result.nativeTasksPerWindow).toBeCloseTo((100 * 4) / 44);
    // SVI = nativeTasksPerWindow / windowPrice
    expect(result.subscriptionValueIndex).toBeCloseTo(
      (100 * 4) / 44 / ((20 * 7) / 30),
    );
    // secondary metric still uses published pass@1
    expect(result.benchmarkEquivalentTasksPerWindow).toBeCloseTo(
      (100 / 9) * 0.6,
    );
  });

  test("expensive failures lower the total-drain primary estimate", () => {
    const cheapFailure = calculate({
      ...base,
      runs: [run(8), run(8), run(8), run(8), run(1, 0)],
    });
    const expensiveFailure = calculate({
      ...base,
      runs: [run(8), run(8), run(8), run(8), run(24, 0)],
    });
    expect(expensiveFailure.nativeTasksPerWindow).toBeLessThan(
      cheapFailure.nativeTasksPerWindow,
    );
    expect(expensiveFailure.totalWeightedDrain).toBe(56);
  });

  test("all-failure runs yield a native SVI of 0", () => {
    const result = calculate({
      ...base,
      runs: [run(8, 0), run(9, 0), run(10, 0), run(9, 0), run(8, 0)],
    });
    expect(result.successCount).toBe(0);
    expect(result.nativeSuccessRate).toBe(0);
    expect(result.nativeTasksPerWindow).toBe(0);
    expect(result.subscriptionValueIndex).toBe(0);
    // upper Wilson bound stays positive so the interval is honestly wide
    expect(result.successCiHigh).toBeGreaterThan(0);
    expect(result.subscriptionValueIndexCiHigh).toBeGreaterThan(0);
    // benchmark-equivalent secondary is unaffected by native failures
    expect(result.benchmarkEquivalentTasksPerWindow).toBeGreaterThan(0);
  });

  test("requires a named quota window", () => {
    expect(() =>
      calculate({ ...base, quotaWindowDays: 0, runs: [run(8)] }),
    ).toThrow("quotaWindowDays");
  });

  test("omits API comparison when no compatible published economics", () => {
    const result = calculate({
      ...base,
      publishedPassAt1: null,
      economicsGap: "no compatible published economics",
      runs: [run(8), run(9), run(8)],
    });
    expect(result.benchmarkEquivalentTasksPerWindow).toBeNull();
    expect(result.apiValueMultiple).toBeNull();
    expect(result.breakEvenTasks).toBeNull();
    expect(result.economicsGap).toBe("no compatible published economics");
    // the native metric is still produced
    expect(result.subscriptionValueIndex).toBeGreaterThan(0);
  });

  test("supports promotions only as separate cells", () => {
    expect(calculate({ ...base, runs: [run(1, 1, 1)] }).medianDrain).toBe(1);
    expect(() => calculate({ ...base, runs: [run(8), run(1, 1, 1)] })).toThrow(
      "separately",
    );
  });
});
