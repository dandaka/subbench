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
  planPrice: number;
  averageCostUsd: number;
  publishedPassAt1: number;
  confidence?: number;
}

export interface Result {
  runCount: number;
  successCount: number;
  successCiLow: number;
  successCiHigh: number;
  conversionFactor: number;
  medianDrain: number;
  p90Drain: number;
  drainCiLow: number;
  drainCiHigh: number;
  successfulTasksPerPeriod: number;
  successfulTasksCiLow: number;
  successfulTasksCiHigh: number;
  subscriptionValueIndex: number;
  apiCostPerSuccess: number;
  apiTasksPerDollar: number;
  apiValueMultiple: number;
  breakEvenTasks: number;
  limitInterruptionRate: number;
  medianTaskSeconds: number;
}

export interface ReportRecord extends Record<string, string | number | boolean> {
  provider: string;
  plan: string;
  model: string;
  surface: string;
  grade: string;
  promotion: boolean;
  n: number;
  success_rate: number;
  success_ci: string;
  median_drain: number;
  p90_drain: number;
  tasks_per_period: number;
  tasks_ci: string;
  svi: number;
  api_value_multiple: number;
  break_even_tasks: number;
  window: string;
}
