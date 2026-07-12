import { describe, expect, test } from "bun:test";
import {
  auditRunHygiene,
  batchMeanDrainPerTask,
  findCacheAdjacency,
  findUnmarkedRunaways,
  isRunawayDrain,
} from "../src/run-hygiene.ts";
import type { CalibrationRun } from "../src/types.ts";

function run(overrides: Partial<CalibrationRun>): CalibrationRun {
  return {
    usage_delta: 2,
    api_equivalent_usd: 5,
    success: 1,
    limit_event: 0,
    promotion: 0,
    started_at: "2026-07-12T00:00:00.000Z",
    ended_at: "2026-07-12T00:20:00.000Z",
    aborted: 0,
    ...overrides,
  } as CalibrationRun;
}

describe("cache adjacency (§4 cache hygiene)", () => {
  test("flags a same-task relaunch inside the TTL", () => {
    const runs = [
      run({ task_id: "A", started_at: "2026-07-12T00:00:00.000Z" }),
      run({ task_id: "A", started_at: "2026-07-12T00:30:00.000Z" }),
    ];
    const issues = findCacheAdjacency(runs);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("cache-adjacency");
    expect(issues[0]!.runIndexes).toEqual([0, 1]);
  });

  test("allows a same-task relaunch beyond the TTL", () => {
    const runs = [
      run({ task_id: "A", started_at: "2026-07-12T00:00:00.000Z" }),
      run({ task_id: "A", started_at: "2026-07-12T01:30:00.000Z" }),
    ];
    expect(findCacheAdjacency(runs)).toHaveLength(0);
  });

  test("distinct tasks back-to-back are fine", () => {
    const runs = [
      run({ task_id: "A", started_at: "2026-07-12T00:00:00.000Z" }),
      run({ task_id: "B", started_at: "2026-07-12T00:05:00.000Z" }),
    ];
    expect(findCacheAdjacency(runs)).toHaveLength(0);
  });

  test("runs without a task_id are treated as distinct", () => {
    const runs = [
      run({ started_at: "2026-07-12T00:00:00.000Z" }),
      run({ started_at: "2026-07-12T00:01:00.000Z" }),
    ];
    expect(findCacheAdjacency(runs)).toHaveLength(0);
  });
});

describe("unmarked runaways (§4 abort rule)", () => {
  test("flags a >3x-median drain that is not marked aborted", () => {
    const runs = [
      run({ usage_delta: 2 }),
      run({ usage_delta: 2 }),
      run({ usage_delta: 3 }),
      run({ usage_delta: 20, aborted: 0 }),
    ];
    const issues = findUnmarkedRunaways(runs);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.runIndexes).toEqual([3]);
  });

  test("does not flag a runaway already marked aborted", () => {
    const runs = [
      run({ usage_delta: 2 }),
      run({ usage_delta: 2 }),
      run({ usage_delta: 3 }),
      run({ usage_delta: 20, aborted: 1 }),
    ];
    expect(findUnmarkedRunaways(runs)).toHaveLength(0);
  });

  test("a single runaway cannot inflate its own threshold", () => {
    // Median over the full set (2,2,3,20) is 2.5 → cap 7.5; the runaway (20)
    // must still be flagged, which requires excluding it from the baseline median.
    const runs = [
      run({ usage_delta: 2 }),
      run({ usage_delta: 2 }),
      run({ usage_delta: 3 }),
      run({ usage_delta: 20 }),
    ];
    expect(findUnmarkedRunaways(runs)).toHaveLength(1);
  });

  test("stays silent below the baseline count", () => {
    const runs = [run({ usage_delta: 2 }), run({ usage_delta: 40 })];
    expect(findUnmarkedRunaways(runs)).toHaveLength(0);
  });
});

describe("live runaway decision", () => {
  test("false until a baseline is established", () => {
    expect(isRunawayDrain([2, 2], 100)).toBe(false);
  });
  test("true when candidate exceeds 3x the prior median", () => {
    expect(isRunawayDrain([2, 2, 3], 10)).toBe(true);
    expect(isRunawayDrain([2, 2, 3], 5)).toBe(false);
  });
});

describe("batch-level mean drain (§4 estimator)", () => {
  test("telescopes contiguous deltas into a mean per task", () => {
    const runs = [
      run({ usage_delta: 2 }),
      run({ usage_delta: 1 }),
      run({ usage_delta: 3 }),
    ];
    expect(batchMeanDrainPerTask(runs)).toBeCloseTo(2, 10);
  });
  test("throws on an empty batch", () => {
    expect(() => batchMeanDrainPerTask([])).toThrow();
  });
});

describe("auditRunHygiene", () => {
  test("aggregates both check families", () => {
    const runs = [
      run({ task_id: "A", started_at: "2026-07-12T00:00:00.000Z", usage_delta: 2 }),
      run({ task_id: "A", started_at: "2026-07-12T00:10:00.000Z", usage_delta: 2 }),
      run({ task_id: "B", started_at: "2026-07-12T01:00:00.000Z", usage_delta: 3 }),
      run({ task_id: "C", started_at: "2026-07-12T02:00:00.000Z", usage_delta: 30 }),
    ];
    const codes = auditRunHygiene(runs).map((i) => i.code).sort();
    expect(codes).toEqual(["cache-adjacency", "unmarked-runaway"]);
  });
});
