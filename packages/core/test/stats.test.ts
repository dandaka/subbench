import { describe, expect, test } from "bun:test";
import { bootstrapCi, percentile, wilsonInterval } from "../src/index.ts";

describe("statistics", () => {
  test("percentiles interpolate", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.9)).toBeCloseTo(3.7);
  });

  test("bootstrap intervals are deterministic and ordered", () => {
    const first = bootstrapCi([1, 2, 3, 10], 0.95, 500);
    const second = bootstrapCi([1, 2, 3, 10], 0.95, 500);
    expect(first).toEqual(second);
    expect(first[0]).toBeLessThanOrEqual(2.5);
    expect(first[1]).toBeGreaterThanOrEqual(2.5);
  });

  test("Wilson interval contains the observed proportion", () => {
    const [low, high] = wilsonInterval(6, 10);
    expect(low).toBeLessThan(0.6);
    expect(high).toBeGreaterThan(0.6);
  });
});
