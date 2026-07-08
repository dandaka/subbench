import { bootstrapCi, median, percentile, wilsonInterval } from "./stats.ts";
import type { AnalysisInput, Result } from "./types.ts";

export function calculate(input: AnalysisInput): Result {
  const {
    runs, quotaCapacity, planPrice, averageCostUsd, publishedPassAt1,
    confidence = 0.95,
  } = input;
  if (runs.length === 0) throw new Error("a result requires at least one calibration run");
  if (new Set(runs.map((run) => run.promotion)).size !== 1) {
    throw new Error("baseline and promotion runs must be analyzed separately");
  }
  const factors = runs.map((run) => run.usage_delta / run.api_equivalent_usd);
  const conversionFactor = median(factors);
  const expectedDrain = averageCostUsd * conversionFactor;
  const [drainCiLow, drainCiHigh] = bootstrapCi(
    factors.map((factor) => averageCostUsd * factor),
    confidence,
  );
  const successCount = runs.reduce((sum, run) => sum + run.success, 0);
  const [successCiLow, successCiHigh] = wilsonInterval(
    successCount,
    runs.length,
    confidence,
  );
  const successfulTasksPerPeriod = quotaCapacity / expectedDrain * publishedPassAt1;
  const apiCostPerSuccess = averageCostUsd / publishedPassAt1;
  const apiTasksPerDollar = 1 / apiCostPerSuccess;
  const subscriptionValueIndex = successfulTasksPerPeriod / planPrice;

  return {
    runCount: runs.length,
    successCount,
    successCiLow,
    successCiHigh,
    conversionFactor,
    medianDrain: median(runs.map((run) => run.usage_delta)),
    p90Drain: percentile(runs.map((run) => run.usage_delta), 0.9),
    drainCiLow,
    drainCiHigh,
    successfulTasksPerPeriod,
    successfulTasksCiLow: quotaCapacity / drainCiHigh * publishedPassAt1,
    successfulTasksCiHigh: quotaCapacity / drainCiLow * publishedPassAt1,
    subscriptionValueIndex,
    apiCostPerSuccess,
    apiTasksPerDollar,
    apiValueMultiple: subscriptionValueIndex / apiTasksPerDollar,
    breakEvenTasks: planPrice / apiCostPerSuccess,
    limitInterruptionRate:
      runs.reduce((sum, run) => sum + run.limit_event, 0) / runs.length,
    medianTaskSeconds: median(
      runs.map((run) => (Date.parse(run.ended_at) - Date.parse(run.started_at)) / 1_000),
    ),
  };
}
