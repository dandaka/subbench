import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { calculate } from "./analysis.ts";
import { schema } from "./schema.ts";
import type { CalibrationRun, ReportRecord, Result } from "./types.ts";

type JsonValue = string | number | boolean | null;
type JsonRow = Record<string, JsonValue>;
type Bundle = Record<string, JsonRow[] | undefined>;

function text(row: JsonRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function number(row: JsonRow, key: string, fallback?: number): number {
  const value = row[key] ?? fallback;
  if (typeof value !== "number") throw new Error(`${key} must be a number`);
  return value;
}

function nullable(row: JsonRow, key: string): string | number | null {
  const value = row[key];
  if (value === undefined || typeof value === "boolean") return null;
  return value;
}

function identifier(db: Database, query: string, values: (string | number)[]): number {
  const row = db.query<{ id: number }, (string | number)[]>(query).get(...values);
  if (!row) throw new Error(`referenced row does not exist: ${values.join("/")}`);
  return row.id;
}

export function openDatabase(path: string, create = false): Database {
  const db = create ? new Database(path, { create: true }) : new Database(path);
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

export function initializeDatabase(path: string): void {
  const db = openDatabase(path, true);
  try {
    db.exec(schema);
  } finally {
    db.close();
  }
}

export function insertRun(db: Database, row: JsonRow): number {
  let measurementId = row.measurement_id;
  if (typeof measurementId !== "number") {
    const providerId = identifier(
      db,
      "SELECT id FROM providers WHERE slug=?",
      [text(row, "provider")],
    );
    const planId = identifier(
      db,
      "SELECT id FROM plans WHERE provider_id=? AND slug=?",
      [providerId, text(row, "plan")],
    );
    measurementId = identifier(
      db,
      `SELECT id FROM subscription_measurements
       WHERE plan_id=? AND model=? AND product_surface=? AND promotion=?`,
      [planId, text(row, "model"), text(row, "product_surface"), number(row, "promotion", 0)],
    );
  }
  let benchmarkSourceId = row.benchmark_source_id;
  if (typeof benchmarkSourceId !== "number") {
    benchmarkSourceId = identifier(
      db,
      "SELECT id FROM benchmark_sources WHERE slug=?",
      [text(row, "benchmark_source")],
    );
  }
  const preUsage = number(row, "pre_usage");
  const postUsage = number(row, "post_usage");
  db.run(
    `INSERT INTO runs(
      measurement_id,benchmark_source_id,task_id,harness_environment_id,started_at,
      ended_at,pre_usage,post_usage,usage_delta,api_equivalent_usd,success,retries,
      limit_event,aborted,peak_hours,promotion,notes
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      measurementId, benchmarkSourceId, text(row, "task_id"),
      text(row, "harness_environment_id"), text(row, "started_at"), text(row, "ended_at"),
      preUsage, postUsage, Math.abs(postUsage - preUsage), number(row, "api_equivalent_usd"),
      number(row, "success"), number(row, "retries", 0), number(row, "limit_event", 0),
      number(row, "aborted", 0), number(row, "peak_hours", 0),
      number(row, "promotion", 0), nullable(row, "notes"),
    ],
  );
  return Number(db.query<{ id: number }, []>("SELECT last_insert_rowid() id").get()!.id);
}

interface PersistedUsageSnapshot {
  provider: string;
  account: { plan: string | null; idHash: string | null };
  capturedAt: string;
  collector: {
    name: string; version: string; authority: string; precision: string; cached: boolean;
  };
  source: { endpoint: string };
  windows: Array<{
    kind: string; usedPercent: number; resetsAt: string | null;
    durationMinutes?: number | null; providerType?: string; providerUnit?: number | null;
  }>;
  raw: unknown;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /token|secret|authorization|credential|api.?key/i.test(key) ? "[REDACTED]" : redact(item),
  ]));
}

export function insertUsageSnapshots(
  db: Database,
  runId: number,
  pre: PersistedUsageSnapshot,
  post: PersistedUsageSnapshot,
  windowKind: string,
): void {
  if (pre.provider !== post.provider) throw new Error("usage snapshots use different providers");
  if (pre.account.idHash && post.account.idHash && pre.account.idHash !== post.account.idHash) {
    throw new Error("usage snapshots use different accounts");
  }
  const preWindow = pre.windows.find((window) => window.kind === windowKind);
  const postWindow = post.windows.find((window) => window.kind === windowKind);
  if (!preWindow || !postWindow) throw new Error(`usage snapshots lack ${windowKind} window`);
  if (preWindow.resetsAt !== postWindow.resetsAt) {
    throw new Error(`usage snapshots cross a ${windowKind} reset`);
  }
  const transaction = db.transaction(() => {
    for (const [position, snapshot] of [["pre", pre], ["post", post]] as const) {
      db.run(
        `INSERT INTO usage_snapshots(
          run_id,position,provider,account_id_hash,plan,captured_at,collector_name,
          collector_version,authority,precision,cached,endpoint,raw_json,normalized_json
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          runId, position, snapshot.provider, snapshot.account.idHash, snapshot.account.plan,
          snapshot.capturedAt, snapshot.collector.name, snapshot.collector.version,
          snapshot.collector.authority, snapshot.collector.precision,
          snapshot.collector.cached ? 1 : 0, snapshot.source.endpoint,
          JSON.stringify(redact(snapshot.raw)),
          JSON.stringify({ ...snapshot, raw: redact(snapshot.raw) }),
        ],
      );
      const snapshotId = Number(
        db.query<{ id: number }, []>("SELECT last_insert_rowid() id").get()!.id,
      );
      for (const window of snapshot.windows) {
        db.run(
          `INSERT INTO usage_snapshot_windows(
            snapshot_id,kind,used_percent,resets_at,duration_minutes,provider_type,provider_unit
          ) VALUES(?,?,?,?,?,?,?)`,
          [
            snapshotId, window.kind, window.usedPercent, window.resetsAt,
            window.durationMinutes ?? null, window.providerType ?? null,
            window.providerUnit ?? null,
          ],
        );
      }
    }
  });
  transaction();
}

export function loadBundle(db: Database, path: string): Record<string, number> {
  const payload = JSON.parse(readFileSync(path, "utf8")) as Bundle;
  const transaction = db.transaction(() => {
    for (const row of payload.providers ?? []) {
      db.run("INSERT OR REPLACE INTO providers(slug,name) VALUES(?,?)", [
        text(row, "slug"), text(row, "name"),
      ]);
    }
    for (const row of payload.plans ?? []) {
      const providerId = identifier(
        db, "SELECT id FROM providers WHERE slug=?", [text(row, "provider")],
      );
      db.run(
        `INSERT OR REPLACE INTO plans(
          provider_id,slug,name,price,currency,billing_days,terms_snapshot_date,
          advertised_limits
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          providerId, text(row, "slug"), text(row, "name"), number(row, "price"),
          text(row, "currency"), number(row, "billing_days"),
          text(row, "terms_snapshot_date"), nullable(row, "advertised_limits"),
        ],
      );
    }
    for (const row of payload.benchmark_sources ?? []) {
      db.run(
        `INSERT OR REPLACE INTO benchmark_sources(
          slug,name,url,snapshot_date,harness,effort_level,task_count,notes
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          text(row, "slug"), text(row, "name"), text(row, "url"),
          text(row, "snapshot_date"), text(row, "harness"), text(row, "effort_level"),
          number(row, "task_count"), nullable(row, "notes"),
        ],
      );
    }
    for (const row of payload.task_costs ?? []) {
      const sourceId = identifier(
        db, "SELECT id FROM benchmark_sources WHERE slug=?",
        [text(row, "benchmark_source")],
      );
      const providerId = identifier(
        db, "SELECT id FROM providers WHERE slug=?", [text(row, "provider")],
      );
      db.run(
        `INSERT OR REPLACE INTO task_costs(
          benchmark_source_id,provider_id,model,model_version,pass_at_1,avg_cost_usd,
          avg_output_tokens,avg_steps,sample_size
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        [
          sourceId, providerId, text(row, "model"), text(row, "model_version"),
          number(row, "pass_at_1"), number(row, "avg_cost_usd"),
          number(row, "avg_output_tokens"), number(row, "avg_steps"),
          number(row, "sample_size"),
        ],
      );
    }
    for (const row of payload.subscription_measurements ?? []) {
      const providerId = identifier(
        db, "SELECT id FROM providers WHERE slug=?", [text(row, "provider")],
      );
      const planId = identifier(
        db, "SELECT id FROM plans WHERE provider_id=? AND slug=?",
        [providerId, text(row, "plan")],
      );
      db.run(
        `INSERT OR REPLACE INTO subscription_measurements(
          plan_id,model,model_version,product_surface,product_version,measurement_start,
          measurement_end,quota_capacity,quota_unit,measurement_grade,confidence_level,
          peak_hours,promotion,conditions
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          planId, text(row, "model"), text(row, "model_version"),
          text(row, "product_surface"), text(row, "product_version"),
          text(row, "measurement_start"), text(row, "measurement_end"),
          number(row, "quota_capacity"), text(row, "quota_unit"),
          text(row, "measurement_grade"), number(row, "confidence_level", 0.95),
          number(row, "peak_hours", 0), number(row, "promotion", 0),
          nullable(row, "conditions"),
        ],
      );
    }
    for (const row of payload.runs ?? []) insertRun(db, row);
  });
  transaction();
  return Object.fromEntries(
    [
      "providers", "plans", "benchmark_sources", "task_costs",
      "subscription_measurements", "runs",
    ].map((key) => [key, payload[key]?.length ?? 0]),
  );
}

interface Cell {
  id: number;
  price: number;
  plan: string;
  provider: string;
  task_cost_id: number;
  avg_cost_usd: number;
  pass_at_1: number;
  quota_capacity: number;
  confidence_level: number;
  model: string;
  product_surface: string;
  measurement_grade: string;
  promotion: number;
  measurement_start: string;
  measurement_end: string;
}

function resultParams(cell: Cell, result: Result): (string | number)[] {
  return [
    cell.id, cell.task_cost_id, new Date().toISOString(), result.runCount,
    result.successCount, result.successCiLow, result.successCiHigh,
    result.conversionFactor, result.medianDrain, result.p90Drain, result.drainCiLow,
    result.drainCiHigh, result.successfulTasksPerPeriod, result.successfulTasksCiLow,
    result.successfulTasksCiHigh, result.subscriptionValueIndex,
    result.apiCostPerSuccess, result.apiTasksPerDollar, result.apiValueMultiple,
    result.breakEvenTasks, result.limitInterruptionRate, result.medianTaskSeconds,
  ];
}

export function analyzeDatabase(db: Database): ReportRecord[] {
  const cells = db.query<Cell, []>(
    `SELECT sm.*, p.price, p.slug plan, pr.slug provider, tc.id task_cost_id,
      tc.avg_cost_usd, tc.pass_at_1
     FROM subscription_measurements sm
     JOIN plans p ON p.id=sm.plan_id
     JOIN providers pr ON pr.id=p.provider_id
     JOIN task_costs tc ON tc.provider_id=pr.id AND tc.model=sm.model
     ORDER BY pr.slug,p.slug,sm.model,sm.promotion`,
  ).all();
  const records: ReportRecord[] = [];
  const transaction = db.transaction(() => {
    for (const cell of cells) {
      const runs = db.query<CalibrationRun, [number, number]>(
        "SELECT * FROM runs WHERE measurement_id=? AND promotion=?",
      ).all(cell.id, cell.promotion);
      if (runs.length === 0) continue;
      const result = calculate({
        runs,
        quotaCapacity: cell.quota_capacity,
        planPrice: cell.price,
        averageCostUsd: cell.avg_cost_usd,
        publishedPassAt1: cell.pass_at_1,
        confidence: cell.confidence_level,
      });
      db.run(
        `INSERT OR REPLACE INTO results(
          measurement_id,task_cost_id,computed_at,run_count,success_count,
          success_ci_low,success_ci_high,conversion_factor,median_drain,p90_drain,
          drain_ci_low,drain_ci_high,successful_tasks_per_period,
          successful_tasks_ci_low,successful_tasks_ci_high,subscription_value_index,
          api_cost_per_success,api_tasks_per_dollar,api_value_multiple,break_even_tasks,
          limit_interruption_rate,median_task_seconds
        ) VALUES(${Array.from({ length: 22 }, () => "?").join(",")})`,
        resultParams(cell, result),
      );
      records.push({
        provider: cell.provider,
        plan: cell.plan,
        model: cell.model,
        surface: cell.product_surface,
        grade: cell.measurement_grade,
        promotion: Boolean(cell.promotion),
        n: result.runCount,
        success_rate: round(result.successCount / result.runCount, 3),
        success_ci: `${result.successCiLow.toFixed(3)}-${result.successCiHigh.toFixed(3)}`,
        median_drain: round(result.medianDrain, 4),
        p90_drain: round(result.p90Drain, 4),
        tasks_per_period: round(result.successfulTasksPerPeriod, 2),
        tasks_ci:
          `${result.successfulTasksCiLow.toFixed(2)}-${result.successfulTasksCiHigh.toFixed(2)}`,
        svi: round(result.subscriptionValueIndex, 3),
        api_value_multiple: round(result.apiValueMultiple, 2),
        break_even_tasks: round(result.breakEvenTasks, 2),
        window: `${cell.measurement_start}/${cell.measurement_end}`,
      });
    }
  });
  transaction();
  return records;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function validateDatabase(db: Database): string[] {
  const issues: string[] = [];
  const integrity = db.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get();
  if (integrity?.integrity_check !== "ok") {
    issues.push(`database integrity: ${integrity?.integrity_check ?? "unknown"}`);
  }
  const samples = db.query<{ id: number; n: number }, []>(
    `SELECT sm.id, COUNT(r.id) n FROM subscription_measurements sm
     LEFT JOIN runs r ON r.measurement_id=sm.id AND r.promotion=sm.promotion
     GROUP BY sm.id HAVING n < 5 OR n > 10`,
  ).all();
  issues.push(...samples.map((row) =>
    `measurement ${row.id} has ${row.n} calibration runs; v1 requires 5-10`
  ));
  const mixed = db.query<{ measurement_id: number }, []>(
    `SELECT measurement_id FROM runs GROUP BY measurement_id
     HAVING MIN(promotion) != MAX(promotion)`,
  ).all();
  issues.push(...mixed.map((row) =>
    `measurement ${row.measurement_id} mixes baseline and promotion runs`
  ));
  const environments = db.query<{ measurement_id: number }, []>(
    `SELECT measurement_id FROM runs GROUP BY measurement_id
     HAVING COUNT(DISTINCT harness_environment_id) > 1`,
  ).all();
  issues.push(...environments.map((row) =>
    `measurement ${row.measurement_id} mixes harness environments`
  ));
  return issues;
}
