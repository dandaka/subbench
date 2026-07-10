import { bootstrapCi, bootstrapJoint, median, percentile, wilsonInterval } from "./stats.ts";
import type { AnalysisInput, Result } from "./types.ts";

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
  const weights = runs.map((run) => run.task_weight ?? 1);
  if (weights.some((weight) => !(weight > 0) || !Number.isFinite(weight))) {
    throw new Error("task weights must be finite and positive");
  }
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

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const weightedSuccesses = successes.reduce((sum, success, index) =>
    sum + success * weights[index]!, 0);
  const totalWeightedDrain = runs.reduce((sum, run, index) =>
    sum + run.usage_delta * weights[index]!, 0);
  if (!(totalWeightedDrain > 0)) throw new Error("total weighted drain must be positive");

  // Tasks the window buys per benchmark-equivalent dollar of drain (secondary only).
  const tasksPerWindowAt = (factor: number) => quotaCapacity / (averageCostUsd * factor);

  // Primary native fixed-set estimator: every failure, retry, and abort remains in the
  // denominator.  Median drain is deliberately only a diagnostic.
  const nativeTasksPerWindow = quotaCapacity * weightedSuccesses / totalWeightedDrain;

  // D5: joint bootstrap over runs — resample (drain factor, success) pairs together so
  // both uncertainties compound. The statistic is native tasks per window per resample.
  const clusters = new Map<string, number[]>();
  runs.forEach((run, index) => {
    const key = run.task_id ?? String(index);
    clusters.set(key, [...(clusters.get(key) ?? []), index]);
  });
  const clusterValues = [...clusters.values()];
  const jointStatistic = (indices: number[]): number => {
    const sampledRuns = indices.flatMap((index) => clusterValues[index]!);
    const numerator = sampledRuns.reduce((sum, index) => sum + successes[index]! * weights[index]!, 0);
    const denominator = sampledRuns.reduce((sum, index) => sum + runs[index]!.usage_delta * weights[index]!, 0);
    return denominator > 0 ? quotaCapacity * numerator / denominator : 0;
  };
  let [nativeTasksCiLow, nativeTasksCiHigh] = bootstrapJoint(
    clusterValues.length, jointStatistic, confidence,
  );
  // Percentile bootstrap is degenerate at the all-failure boundary.  A conservative
  // Wilson-success / observed-drain envelope supplies a positive upper sensitivity bound
  // without pretending that it is a calibrated population confidence interval.
  const observedDrainPerWeight = totalWeightedDrain / totalWeight;
  const boundaryUpper = quotaCapacity * successCiHigh / observedDrainPerWeight;
  nativeTasksCiLow = Math.min(nativeTasksCiLow, quotaCapacity * successCiLow / observedDrainPerWeight);
  nativeTasksCiHigh = Math.max(nativeTasksCiHigh, boundaryUpper);

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
  const benchmarkEquivalentTasksPerDollar = benchmarkEquivalentTasksPerWindow === null
    ? null
    : benchmarkEquivalentTasksPerWindow / windowPrice;
  const apiValueMultiple = apiTasksPerDollar === null || benchmarkEquivalentTasksPerDollar === null
    ? null
    : benchmarkEquivalentTasksPerDollar / apiTasksPerDollar;
  const breakEvenTasks = apiCostPerSuccess === null ? null : windowPrice / apiCostPerSuccess;

  return {
    runCount: runs.length,
    successCount,
    nativeSuccessRate,
    successCiLow,
    successCiHigh,
    conversionFactor,
    totalWeightedDrain,
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
