// Run-hygiene checks that enforce protocol §4 on already-recorded calibration
// runs. All functions here are pure (no IO): they operate on the run rows and
// their timestamps, both of which are persisted, so every finding is auditable
// after the fact and none of these checks requires launching a new run.

import { median } from "./stats.ts";
import type { CalibrationRun } from "./types.ts";

/** Anthropic's conservative extended prompt-cache TTL; the §4 spacing floor. */
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** §4 runaway threshold: abort a task at 3× the established median drain. */
export const RUNAWAY_MULTIPLE = 3;

export interface HygieneIssue {
  code: "cache-adjacency" | "unmarked-runaway";
  message: string;
  /** Indices into the input run array that the issue concerns. */
  runIndexes: number[];
}

/**
 * §4 cache hygiene: an identical task (same `task_id`) launched twice within the
 * provider's prompt-cache TTL can hit a warm cache and drain less quota than a
 * cold run, corrupting the estimate. Distinct tasks back-to-back are fine — they
 * share only the harness prefix. Flags any same-task pair whose start times are
 * closer together than `ttlMs`. Runs without a `task_id` are treated as distinct.
 */
export function findCacheAdjacency(
  runs: readonly CalibrationRun[],
  ttlMs: number = CACHE_TTL_MS,
): HygieneIssue[] {
  const byTask = new Map<string, number[]>();
  runs.forEach((run, index) => {
    if (run.task_id == null) return;
    byTask.set(run.task_id, [...(byTask.get(run.task_id) ?? []), index]);
  });

  const issues: HygieneIssue[] = [];
  for (const [taskId, indexes] of byTask) {
    if (indexes.length < 2) continue;
    const ordered = [...indexes].sort(
      (a, b) =>
        Date.parse(runs[a]!.started_at) - Date.parse(runs[b]!.started_at),
    );
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const curr = ordered[i]!;
      const gapMs =
        Date.parse(runs[curr]!.started_at) - Date.parse(runs[prev]!.started_at);
      if (gapMs < ttlMs) {
        issues.push({
          code: "cache-adjacency",
          runIndexes: [prev, curr],
          message:
            `task "${taskId}" was relaunched ${Math.round(gapMs / 60000)} min ` +
            `after a prior run (< ${Math.round(ttlMs / 60000)} min cache TTL); ` +
            `a warm-cache repeat can under-drain and corrupt the estimate`,
        });
      }
    }
  }
  return issues;
}

/**
 * §4 abort rule audit: after enough normal tasks establish a median drain, a run
 * draining ≥ 3× that median is a runaway and must be marked `aborted` (it stays
 * in the data, but is flagged). This reports runs whose drain exceeds the cap yet
 * carry `aborted = 0` — a data-integrity gap, not a re-measurement.
 *
 * The median is taken over the non-runaway runs so one runaway cannot inflate the
 * threshold and hide itself. Requires at least `minBaseline` runs at or under the
 * cap before it will flag anything (§4: "after three normal tasks").
 */
export function findUnmarkedRunaways(
  runs: readonly CalibrationRun[],
  multiple: number = RUNAWAY_MULTIPLE,
  minBaseline = 3,
): HygieneIssue[] {
  const drains = runs.map((run) => run.usage_delta);
  if (drains.length < minBaseline + 1) return [];

  // Provisional threshold from the full set, then recompute the median over runs
  // at or under it so runaways don't lift their own bar.
  const provisional = median(drains) * multiple;
  const baseline = drains.filter((d) => d <= provisional);
  if (baseline.length < minBaseline) return [];
  const cap = median(baseline) * multiple;

  const issues: HygieneIssue[] = [];
  runs.forEach((run, index) => {
    if (run.usage_delta > cap && Number(run.aborted ?? 0) === 0) {
      issues.push({
        code: "unmarked-runaway",
        runIndexes: [index],
        message:
          `run drained ${run.usage_delta} (> ${multiple}× median ${cap / multiple}); ` +
          `it should be marked aborted per protocol §4`,
      });
    }
  });
  return issues;
}

/**
 * Live abort decision for a runner: given the drains of the prior runs in the
 * current contiguous batch and a candidate drain, decide whether the candidate is
 * a runaway. Returns false until `minBaseline` prior runs establish a median.
 */
export function isRunawayDrain(
  priorDrains: readonly number[],
  candidateDrain: number,
  multiple: number = RUNAWAY_MULTIPLE,
  minBaseline = 3,
): boolean {
  if (priorDrains.length < minBaseline) return false;
  return candidateDrain > median(priorDrains) * multiple;
}

/**
 * Batch-level mean drain per task (§4 estimator). Over a contiguous batch, paired
 * per-run deltas telescope, so the sum of deltas equals the batch delta (first
 * pre-usage to last post-usage) and carries a single ±1-point quantization error
 * regardless of batch length. Returns mean drain per task = batch delta / N.
 *
 * This is the resolution-correct summary for rounded meters; individual per-run
 * deltas remain descriptive only and support no per-task conclusions.
 */
export function batchMeanDrainPerTask(runs: readonly CalibrationRun[]): number {
  if (runs.length === 0) throw new Error("batch requires at least one run");
  const batchDelta = runs.reduce((sum, run) => sum + run.usage_delta, 0);
  return batchDelta / runs.length;
}

/** Convenience: all hygiene issues for a run set. */
export function auditRunHygiene(
  runs: readonly CalibrationRun[],
  options: { ttlMs?: number; multiple?: number; minBaseline?: number } = {},
): HygieneIssue[] {
  return [
    ...findCacheAdjacency(runs, options.ttlMs),
    ...findUnmarkedRunaways(runs, options.multiple, options.minBaseline),
  ];
}
