// Roll a batch of per-request captures up into a run/batch-level summary that joins to a
// run record by timestamp (cache-weighting-experiment.md §4 regresses batch drain deltas
// on these exact token-mix totals). Pure over an array of captures; the CLI reads a
// captures file and prints this JSON.

import type { CaptureRecord, TokenUsage } from "./capture.ts";
import type { RateLimitWindowKey } from "./ratelimit.ts";

// A "large cache-write event" is a mid-session full-prefix re-write — Systima observed
// 36,899–85,686-token events; these are a large harness-driven drain-variance source and
// worth surfacing individually. Threshold picked below the smallest observed event so any
// real prefix re-write is flagged while ordinary incremental cache writes are not.
export const LARGE_CACHE_WRITE_THRESHOLD = 30_000;

export interface UtilizationPoint {
  timestamp: string;
  utilization: number;
}

export interface CacheWriteEvent {
  timestamp: string;
  cache_creation_input_tokens: number;
}

export interface RunAggregate {
  request_count: number;
  // Null when there are no captures; otherwise the earliest/latest capture timestamp,
  // which bracket the batch for joining to a run record.
  started_at: string | null;
  ended_at: string | null;
  token_totals: TokenUsage;
  large_cache_write_events: CacheWriteEvent[];
  served_models: string[];
  utilization_series: Record<RateLimitWindowKey, UtilizationPoint[]>;
}

const WINDOWS: RateLimitWindowKey[] = ["5h", "7d"];

export function aggregate(captures: CaptureRecord[]): RunAggregate {
  const token_totals: TokenUsage = {
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
  };
  const large_cache_write_events: CacheWriteEvent[] = [];
  const servedModels = new Set<string>();
  const utilization_series: Record<RateLimitWindowKey, UtilizationPoint[]> = {
    "5h": [],
    "7d": [],
  };
  let started_at: string | null = null;
  let ended_at: string | null = null;

  for (const capture of captures) {
    token_totals.input_tokens += capture.usage.input_tokens;
    token_totals.cache_creation_input_tokens +=
      capture.usage.cache_creation_input_tokens;
    token_totals.cache_read_input_tokens +=
      capture.usage.cache_read_input_tokens;
    token_totals.output_tokens += capture.usage.output_tokens;

    if (
      capture.usage.cache_creation_input_tokens >= LARGE_CACHE_WRITE_THRESHOLD
    ) {
      large_cache_write_events.push({
        timestamp: capture.timestamp,
        cache_creation_input_tokens: capture.usage.cache_creation_input_tokens,
      });
    }

    if (capture.served_model !== null) servedModels.add(capture.served_model);

    for (const window of WINDOWS) {
      const reading = capture.rate_limits[window];
      if (reading && reading.utilization !== null) {
        utilization_series[window].push({
          timestamp: capture.timestamp,
          utilization: reading.utilization,
        });
      }
    }

    if (started_at === null || capture.timestamp < started_at) {
      started_at = capture.timestamp;
    }
    if (ended_at === null || capture.timestamp > ended_at) {
      ended_at = capture.timestamp;
    }
  }

  const byTimestamp = (a: UtilizationPoint, b: UtilizationPoint) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;
  for (const window of WINDOWS) utilization_series[window].sort(byTimestamp);
  large_cache_write_events.sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
  );

  return {
    request_count: captures.length,
    started_at,
    ended_at,
    token_totals,
    large_cache_write_events,
    served_models: [...servedModels],
    utilization_series,
  };
}

// Read a captures.jsonl file into records.
export function parseCapturesJsonl(text: string): CaptureRecord[] {
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CaptureRecord);
}

// CLI: `bun src/aggregate.ts <captures.jsonl>` prints the run rollup as JSON, joinable to
// a run record by started_at/ended_at.
if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: bun src/aggregate.ts <captures.jsonl>");
    process.exit(2);
  }
  const text = await Bun.file(path).text();
  const rollup = aggregate(parseCapturesJsonl(text));
  console.log(JSON.stringify(rollup, null, 2));
}
