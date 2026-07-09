export type DatabaseRow = Record<string, string | number | null>;

export interface CalibrationRun extends DatabaseRow {
  usage_delta: number;
  api_equivalent_usd: number;
  success: number;
  limit_event: number;
  promotion: number;
  started_at: string;
  ended_at: string;
}

export interface AnalysisInput {
  runs: CalibrationRun[];
  quotaCapacity: number;
  /** Length of the quota window in days (weekly = 7, monthly = 30). */
  quotaWindowDays: number;
  planPrice: number;
  /** Length of the plan's billing period in days (price covers this span). */
  billingDays: number;
  averageCostUsd: number;
  /**
   * Published neutral-harness pass@1 for the bound economics record, or null when
   * no compatible published economics exist (e.g. no model match on the benchmark).
   * When null the primary native metric is still computed; the benchmark-equivalent
   * secondary metric and the API comparison are omitted.
   */
  publishedPassAt1: number | null;
  /**
   * Reason the study carries no compatible published economics. Present only when
   * publishedPassAt1 is null; surfaced verbatim in the report.
   */
  economicsGap?: string | undefined;
  /** Capacity measurement grade; widens the sensitivity band when not `exact`. */
  measurementGrade?: string | undefined;
  confidence?: number | undefined;
}

export interface Result {
  runCount: number;
  successCount: number;
  /** Native success proportion successCount/runCount with Wilson interval. */
  nativeSuccessRate: number;
  successCiLow: number;
  successCiHigh: number;
  conversionFactor: number;
  medianDrain: number;
  p90Drain: number;
  drainCiLow: number;
  drainCiHigh: number;
  /** Price of the plan prorated into one quota window. */
  windowPrice: number;
  /** PRIMARY estimand: native successful tasks per quota window. */
  nativeTasksPerWindow: number;
  nativeTasksCiLow: number;
  nativeTasksCiHigh: number;
  /**
   * SECONDARY estimand: benchmark-equivalent throughput per window using published
   * pass@1. Null when no compatible published economics exist. Reported only as the
   * API-comparison anchor.
   */
  benchmarkEquivalentTasksPerWindow: number | null;
  /** PRIMARY value index: native tasks per window per window-dollar. */
  subscriptionValueIndex: number;
  subscriptionValueIndexCiLow: number;
  subscriptionValueIndexCiHigh: number;
  /** Null when no compatible published economics exist. */
  apiCostPerSuccess: number | null;
  apiTasksPerDollar: number | null;
  apiValueMultiple: number | null;
  breakEvenTasks: number | null;
  economicsGap: string | null;
  limitInterruptionRate: number;
  medianTaskSeconds: number;
}

export interface ReportRecord extends Record<string, string | number | boolean | null> {
  provider: string;
  plan: string;
  model: string;
  surface: string;
  grade: string;
  promotion: boolean;
  publishable: boolean;
  n: number;
  success_rate: number;
  success_ci: string;
  median_drain: number;
  p90_drain: number;
  window_days: number;
  window_price: number;
  native_tasks_per_window: number;
  native_tasks_ci: string;
  benchmark_equivalent_tasks_per_window: number | null;
  svi: number;
  svi_ci: string;
  api_value_multiple: number | null;
  break_even_tasks: number | null;
  economics_gap: string | null;
  window: string;
}
