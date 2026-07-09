import { bootstrapCi, bootstrapJoint, median, percentile, wilsonInterval } from "./stats.ts";
import type { AnalysisInput, Result } from "./types.ts";

// Capacity-grade sensitivity multipliers applied to the joint bootstrap band. A rounded
// or inferred capacity carries meter/derivation error beyond sampling noise; we widen the
// reported interval rather than pretend the point estimate is exact. `exact` adds nothing.
const GRADE_SENSITIVITY: Record<string, number> = {
  exact: 0,
  rounded: 0.02,
  inferred: 0.05,
  unknown: 0.1,
};

export function calculate(input: AnalysisInput): Result {
  const {
    runs, quotaCapacity, quotaWindowDays, planPrice, billingDays, averageCostUsd,
    publishedPassAt1, economicsGap, measurementGrade = "exact", confidence = 0.95,
  } = input;
  if (runs.length === 0) throw new Error("a result requires at least one calibration run");
  if (new Set(runs.map((run) => run.promotion)).size !== 1) {
    throw new Error("baseline and promotion runs must be analyzed separately");
  }
  if (!(quotaWindowDays > 0)) {
    throw new Error("quotaWindowDays is required and must be positive (name the quota window)");
  }
  if (!(billingDays > 0)) throw new Error("billingDays is required and must be positive");

  const factors = runs.map((run) => run.usage_delta / run.api_equivalent_usd);
  const successes = runs.map((run) => run.success);
  const conversionFactor = median(factors);
  const [drainCiLow, drainCiHigh] = bootstrapCi(
    factors.map((factor) => averageCostUsd * factor),
    confidence,
  );

  const successCount = successes.reduce((sum, value) => sum + value, 0);
  const nativeSuccessRate = successCount / runs.length;
  const [successCiLow, successCiHigh] = wilsonInterval(successCount, runs.length, confidence);

  // D1: prorate the plan price into one quota window. Capacity is what we measure; price
  // is exact and safe to scale linearly.
  const windowPrice = planPrice * quotaWindowDays / billingDays;

  // Tasks the window buys per benchmark-equivalent dollar of drain.
  const tasksPerWindowAt = (factor: number) => quotaCapacity / (averageCostUsd * factor);

  // D2 (primary): native successful tasks per window from the native success rate.
  const nativeTasksPerWindow = tasksPerWindowAt(conversionFactor) * nativeSuccessRate;

  // D5: joint bootstrap over runs — resample (drain factor, success) pairs together so
  // both uncertainties compound. The statistic is native tasks per window per resample.
  const jointStatistic = (indices: number[]): number => {
    const resampledFactor = median(indices.map((index) => factors[index]!));
    const resampledSuccess =
      indices.reduce((sum, index) => sum + successes[index]!, 0) / indices.length;
    return tasksPerWindowAt(resampledFactor) * resampledSuccess;
  };
  let [nativeTasksCiLow, nativeTasksCiHigh] = bootstrapJoint(
    runs.length, jointStatistic, confidence,
  );
  // Fold in the capacity-grade sensitivity as a fixed multiplicative widening.
  const sensitivity = GRADE_SENSITIVITY[measurementGrade] ?? GRADE_SENSITIVITY.unknown!;
  nativeTasksCiLow *= 1 - sensitivity;
  nativeTasksCiHigh *= 1 + sensitivity;

  const subscriptionValueIndex = nativeTasksPerWindow / windowPrice;
  const subscriptionValueIndexCiLow = nativeTasksCiLow / windowPrice;
  const subscriptionValueIndexCiHigh = nativeTasksCiHigh / windowPrice;

  // D2 (secondary) + API comparison: only when compatible published economics exist.
  const hasEconomics = publishedPassAt1 !== null && publishedPassAt1 > 0;
  const benchmarkEquivalentTasksPerWindow = hasEconomics
    ? tasksPerWindowAt(conversionFactor) * publishedPassAt1
    : null;
  const apiCostPerSuccess = hasEconomics ? averageCostUsd / publishedPassAt1 : null;
  const apiTasksPerDollar = apiCostPerSuccess === null ? null : 1 / apiCostPerSuccess;
  const apiValueMultiple = apiTasksPerDollar === null
    ? null
    : subscriptionValueIndex / apiTasksPerDollar;
  const breakEvenTasks = apiCostPerSuccess === null ? null : windowPrice / apiCostPerSuccess;

  return {
    runCount: runs.length,
    successCount,
    nativeSuccessRate,
    successCiLow,
    successCiHigh,
    conversionFactor,
    medianDrain: median(runs.map((run) => run.usage_delta)),
    p90Drain: percentile(runs.map((run) => run.usage_delta), 0.9),
    drainCiLow,
    drainCiHigh,
    windowPrice,
    nativeTasksPerWindow,
    nativeTasksCiLow,
    nativeTasksCiHigh,
    benchmarkEquivalentTasksPerWindow,
    subscriptionValueIndex,
    subscriptionValueIndexCiLow,
    subscriptionValueIndexCiHigh,
    apiCostPerSuccess,
    apiTasksPerDollar,
    apiValueMultiple,
    breakEvenTasks,
    economicsGap: hasEconomics ? null : (economicsGap ?? "no compatible published economics"),
    limitInterruptionRate:
      runs.reduce((sum, run) => sum + run.limit_event, 0) / runs.length,
    medianTaskSeconds: median(
      runs.map((run) => (Date.parse(run.ended_at) - Date.parse(run.started_at)) / 1_000),
    ),
  };
}
