import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { calculate } from "./analysis.ts";
import { migrate } from "./schema.ts";
import type { CalibrationRun, ReportRecord, Result } from "./types.ts";
import { collectIssues } from "./validation.ts";

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

function identifier(
  db: Database,
  query: string,
  values: (string | number)[],
): number {
  const row = db
    .query<{ id: number }, (string | number)[]>(query)
    .get(...values);
  if (!row)
    throw new Error(`referenced row does not exist: ${values.join("/")}`);
  return row.id;
}

function uniqueIdentifier(
  db: Database,
  query: string,
  values: (string | number)[],
  label: string,
): number {
  const rows = db
    .query<{ id: number }, (string | number)[]>(query)
    .all(...values);
  if (rows.length !== 1)
    throw new Error(
      `${label} must resolve to exactly one row; found ${rows.length}`,
    );
  return rows[0]!.id;
}

export function openDatabase(path: string, create = false): Database {
  const db = create ? new Database(path, { create: true }) : new Database(path);
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

export function initializeDatabase(path: string): void {
  const db = openDatabase(path, true);
  try {
    migrate(db);
  } finally {
    db.close();
  }
}

export function insertRun(db: Database, row: JsonRow): number {
  let measurementId = row.measurement_id;
  if (typeof measurementId !== "number") {
    const providerId = identifier(db, "SELECT id FROM providers WHERE slug=?", [
      text(row, "provider"),
    ]);
    const planId = identifier(
      db,
      "SELECT id FROM plans WHERE provider_id=? AND slug=?",
      [providerId, text(row, "plan")],
    );
    measurementId = identifier(
      db,
      `SELECT id FROM subscription_measurements
       WHERE plan_id=? AND model=? AND product_surface=? AND promotion=?`,
      [
        planId,
        text(row, "model"),
        text(row, "product_surface"),
        number(row, "promotion", 0),
      ],
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
  if (postUsage < preUsage) {
    throw new Error(
      "usage meter decreased; record reset/rolling-window evidence instead of absolute drain",
    );
  }
  const evidenceKind =
    typeof row.evidence_kind === "string" ? row.evidence_kind : "manual";
  if (evidenceKind !== "manual" && evidenceKind !== "paired-snapshots") {
    throw new Error(
      `evidence_kind must be 'manual' or 'paired-snapshots', got ${evidenceKind}`,
    );
  }
  db.run(
    `INSERT INTO runs(
      measurement_id,benchmark_source_id,task_id,harness_environment_id,started_at,
      ended_at,pre_usage,post_usage,usage_delta,api_equivalent_usd,success,retries,
      limit_event,aborted,peak_hours,promotion,evidence_kind,notes
      ,isolation_confirmed_at,isolation_confirmed_by,isolation_checklist_version
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      measurementId,
      benchmarkSourceId,
      text(row, "task_id"),
      text(row, "harness_environment_id"),
      text(row, "started_at"),
      text(row, "ended_at"),
      preUsage,
      postUsage,
      postUsage - preUsage,
      number(row, "api_equivalent_usd"),
      number(row, "success"),
      number(row, "retries", 0),
      number(row, "limit_event", 0),
      number(row, "aborted", 0),
      number(row, "peak_hours", 0),
      number(row, "promotion", 0),
      evidenceKind,
      nullable(row, "notes"),
      nullable(row, "isolation_confirmed_at"),
      nullable(row, "isolation_confirmed_by"),
      nullable(row, "isolation_checklist_version"),
    ],
  );
  return Number(
    db.query<{ id: number }, []>("SELECT last_insert_rowid() id").get()!.id,
  );
}

interface PersistedUsageSnapshot {
  provider: string;
  account: { plan: string | null; idHash: string | null };
  capturedAt: string;
  collector: {
    name: string;
    version: string;
    authority: string;
    precision: string;
    cached: boolean;
  };
  source: { endpoint: string };
  windows: Array<{
    kind: string;
    usedPercent: number;
    resetsAt: string | null;
    durationMinutes?: number | null;
    providerType?: string;
    providerUnit?: number | null;
  }>;
  raw: unknown;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /token|secret|authorization|credential|api.?key/i.test(key)
        ? "[REDACTED]"
        : redact(item),
    ]),
  );
}

export function insertUsageSnapshots(
  db: Database,
  runId: number,
  pre: PersistedUsageSnapshot,
  post: PersistedUsageSnapshot,
  windowKind: string,
): void {
  if (pre.provider !== post.provider)
    throw new Error("usage snapshots use different providers");
  if (
    pre.account.idHash &&
    post.account.idHash &&
    pre.account.idHash !== post.account.idHash
  ) {
    throw new Error("usage snapshots use different accounts");
  }
  const preWindow = pre.windows.find((window) => window.kind === windowKind);
  const postWindow = post.windows.find((window) => window.kind === windowKind);
  if (!preWindow || !postWindow)
    throw new Error(`usage snapshots lack ${windowKind} window`);
  if (preWindow.resetsAt !== postWindow.resetsAt) {
    throw new Error(`usage snapshots cross a ${windowKind} reset`);
  }
  const transaction = db.transaction(() => {
    for (const [position, snapshot] of [
      ["pre", pre],
      ["post", post],
    ] as const) {
      db.run(
        `INSERT INTO usage_snapshots(
          run_id,position,provider,account_id_hash,plan,captured_at,collector_name,
          collector_version,authority,precision,cached,endpoint,raw_json,normalized_json
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          runId,
          position,
          snapshot.provider,
          snapshot.account.idHash,
          snapshot.account.plan,
          snapshot.capturedAt,
          snapshot.collector.name,
          snapshot.collector.version,
          snapshot.collector.authority,
          snapshot.collector.precision,
          snapshot.collector.cached ? 1 : 0,
          snapshot.source.endpoint,
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
            snapshotId,
            window.kind,
            window.usedPercent,
            window.resetsAt,
            window.durationMinutes ?? null,
            window.providerType ?? null,
            window.providerUnit ?? null,
          ],
        );
      }
    }
    // Paired snapshots are the strong evidence tier; upgrade the run's evidence_kind.
    db.run("UPDATE runs SET evidence_kind='paired-snapshots' WHERE id=?", [
      runId,
    ]);
  });
  transaction();
}

export function loadBundle(db: Database, path: string): Record<string, number> {
  const payload = JSON.parse(readFileSync(path, "utf8")) as Bundle;
  const transaction = db.transaction(() => {
    for (const row of payload.providers ?? []) {
      db.run("INSERT OR REPLACE INTO providers(slug,name) VALUES(?,?)", [
        text(row, "slug"),
        text(row, "name"),
      ]);
    }
    for (const row of payload.plans ?? []) {
      const providerId = identifier(
        db,
        "SELECT id FROM providers WHERE slug=?",
        [text(row, "provider")],
      );
      db.run(
        `INSERT OR REPLACE INTO plans(
          provider_id,slug,name,price,currency,billing_days,terms_snapshot_date,
          advertised_limits
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          providerId,
          text(row, "slug"),
          text(row, "name"),
          number(row, "price"),
          text(row, "currency"),
          number(row, "billing_days"),
          text(row, "terms_snapshot_date"),
          nullable(row, "advertised_limits"),
        ],
      );
    }
    for (const row of payload.benchmark_sources ?? []) {
      db.run(
        `INSERT OR REPLACE INTO benchmark_sources(
          slug,name,url,snapshot_date,harness,effort_level,task_count,notes
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          text(row, "slug"),
          text(row, "name"),
          text(row, "url"),
          text(row, "snapshot_date"),
          text(row, "harness"),
          text(row, "effort_level"),
          number(row, "task_count"),
          nullable(row, "notes"),
        ],
      );
    }
    for (const row of payload.task_costs ?? []) {
      const sourceId = identifier(
        db,
        "SELECT id FROM benchmark_sources WHERE slug=?",
        [text(row, "benchmark_source")],
      );
      const providerId = identifier(
        db,
        "SELECT id FROM providers WHERE slug=?",
        [text(row, "provider")],
      );
      db.run(
        `INSERT OR REPLACE INTO task_costs(
          benchmark_source_id,provider_id,model,model_version,pass_at_1,avg_cost_usd,
          avg_output_tokens,avg_steps,sample_size,artifact_sha256,reasoning_effort,
          configuration_json,snapshot_sha256
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          sourceId,
          providerId,
          text(row, "model"),
          text(row, "model_version"),
          number(row, "pass_at_1"),
          number(row, "avg_cost_usd"),
          number(row, "avg_output_tokens"),
          number(row, "avg_steps"),
          number(row, "sample_size"),
          nullable(row, "artifact_sha256"),
          typeof row.reasoning_effort === "string" ? row.reasoning_effort : "",
          JSON.stringify(row.configuration ?? {}),
          nullable(row, "snapshot_sha256"),
        ],
      );
    }
    for (const row of payload.task_manifests ?? []) {
      const sourceId = identifier(
        db,
        "SELECT id FROM benchmark_sources WHERE slug=?",
        [text(row, "benchmark_source")],
      );
      db.run(
        `INSERT OR REPLACE INTO task_manifests(slug,manifest_sha256,benchmark_source_id,target_population,
          weighting,order_seed,abort_rule,deepswe_commit,verifier_version,image_digest,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          text(row, "slug"),
          text(row, "manifest_sha256"),
          sourceId,
          text(row, "target_population"),
          text(row, "weighting"),
          text(row, "order_seed"),
          text(row, "abort_rule"),
          text(row, "deepswe_commit"),
          text(row, "verifier_version"),
          text(row, "image_digest"),
          text(row, "created_at"),
        ],
      );
    }
    for (const row of payload.task_manifest_entries ?? []) {
      const manifestId = identifier(
        db,
        "SELECT id FROM task_manifests WHERE slug=?",
        [text(row, "manifest")],
      );
      db.run(
        `INSERT OR REPLACE INTO task_manifest_entries(manifest_id,task_id,base_commit,weight,expected_repetitions)
         VALUES(?,?,?,?,?)`,
        [
          manifestId,
          text(row, "task_id"),
          text(row, "base_commit"),
          number(row, "weight", 1),
          number(row, "expected_repetitions", 1),
        ],
      );
    }
    for (const row of payload.subscription_measurements ?? []) {
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
      // D3: bind the measurement to exactly one economics record by model, or record a
      // named economics gap. Exactly one of the two must be present.
      const economicsModel = row.task_cost_model;
      const economicsGap = nullable(row, "economics_gap");
      let taskCostRef: number | null = null;
      let taskManifestRef: number | null = null;
      if (typeof economicsModel === "string") {
        const sourceSlug =
          typeof row.task_cost_benchmark_source === "string"
            ? row.task_cost_benchmark_source
            : null;
        const sourceId =
          sourceSlug === null
            ? null
            : identifier(db, "SELECT id FROM benchmark_sources WHERE slug=?", [
                sourceSlug,
              ]);
        taskCostRef = uniqueIdentifier(
          db,
          sourceId === null
            ? "SELECT id FROM task_costs WHERE provider_id=? AND model=? AND model_version=?"
            : "SELECT id FROM task_costs WHERE benchmark_source_id=? AND provider_id=? AND model=? AND model_version=?",
          sourceId === null
            ? [providerId, economicsModel, text(row, "task_cost_model_version")]
            : [
                sourceId,
                providerId,
                economicsModel,
                text(row, "task_cost_model_version"),
              ],
          "task_cost economics binding",
        );
      }
      if (taskCostRef === null && economicsGap === null) {
        throw new Error(
          `subscription measurement for ${text(row, "model")} needs task_cost_model or economics_gap`,
        );
      }
      if (typeof row.task_manifest === "string") {
        taskManifestRef = identifier(
          db,
          "SELECT id FROM task_manifests WHERE slug=?",
          [row.task_manifest],
        );
      }
      db.run(
        `INSERT OR REPLACE INTO subscription_measurements(
          plan_id,task_cost_ref,task_manifest_ref,economics_gap,model,model_version,product_surface,
          product_version,measurement_start,measurement_end,quota_capacity,quota_unit,
          quota_window_days,measurement_grade,confidence_level,peak_hours,promotion,
          isolation_confirmed_at,isolation_confirmed_by,environment_id,publishable,conditions
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          planId,
          taskCostRef,
          taskManifestRef,
          economicsGap,
          text(row, "model"),
          text(row, "model_version"),
          text(row, "product_surface"),
          text(row, "product_version"),
          text(row, "measurement_start"),
          text(row, "measurement_end"),
          number(row, "quota_capacity"),
          text(row, "quota_unit"),
          number(row, "quota_window_days"),
          text(row, "measurement_grade"),
          number(row, "confidence_level", 0.95),
          number(row, "peak_hours", 0),
          number(row, "promotion", 0),
          nullable(row, "isolation_confirmed_at"),
          nullable(row, "isolation_confirmed_by"),
          nullable(row, "environment_id"),
          number(row, "publishable", 1),
          nullable(row, "conditions"),
        ],
      );
    }
    for (const row of payload.runs ?? []) insertRun(db, row);
    // Bundles may supply evidence as normalized, flat rows keyed by run_task_id.  Evidence
    // is imported in the same transaction as runs; a claimed paired label without exactly
    // one pre/post row will still fail validation rather than being trusted.
    for (const row of payload.usage_snapshots ?? []) {
      const runId = identifier(db, "SELECT id FROM runs WHERE task_id=?", [
        text(row, "run_task_id"),
      ]);
      db.run(
        `INSERT INTO usage_snapshots(run_id,position,provider,account_id_hash,plan,captured_at,
          collector_name,collector_version,authority,precision,cached,endpoint,raw_json,normalized_json)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          runId,
          text(row, "position"),
          text(row, "provider"),
          nullable(row, "account_id_hash"),
          nullable(row, "plan"),
          text(row, "captured_at"),
          text(row, "collector_name"),
          text(row, "collector_version"),
          text(row, "authority"),
          text(row, "precision"),
          number(row, "cached"),
          text(row, "endpoint"),
          text(row, "raw_json"),
          text(row, "normalized_json"),
        ],
      );
    }
    for (const row of payload.usage_snapshot_windows ?? []) {
      const snapshotId = identifier(
        db,
        `SELECT s.id FROM usage_snapshots s JOIN runs r ON r.id=s.run_id
         WHERE r.task_id=? AND s.position=?`,
        [text(row, "run_task_id"), text(row, "position")],
      );
      db.run(
        `INSERT INTO usage_snapshot_windows(snapshot_id,kind,used_percent,resets_at,duration_minutes,provider_type,provider_unit)
         VALUES(?,?,?,?,?,?,?)`,
        [
          snapshotId,
          text(row, "kind"),
          number(row, "used_percent"),
          nullable(row, "resets_at"),
          nullable(row, "duration_minutes"),
          nullable(row, "provider_type"),
          nullable(row, "provider_unit"),
        ],
      );
    }
  });
  transaction();
  return Object.fromEntries(
    [
      "providers",
      "plans",
      "benchmark_sources",
      "task_costs",
      "task_manifests",
      "task_manifest_entries",
      "subscription_measurements",
      "runs",
    ].map((key) => [key, payload[key]?.length ?? 0]),
  );
}

interface Cell {
  id: number;
  price: number;
  billing_days: number;
  plan: string;
  provider: string;
  task_cost_ref: number | null;
  economics_gap: string | null;
  task_cost_id: number | null;
  avg_cost_usd: number | null;
  pass_at_1: number | null;
  quota_capacity: number;
  quota_window_days: number;
  confidence_level: number;
  model: string;
  product_surface: string;
  measurement_grade: string;
  promotion: number;
  publishable: number;
  measurement_start: string;
  measurement_end: string;
  task_manifest: string | null;
  target_population: string | null;
  conditions: string | null;
}

function resultParams(
  cell: Cell,
  result: Result,
  publishable: boolean,
): (string | number | null)[] {
  return [
    cell.id,
    cell.task_cost_id,
    new Date().toISOString(),
    result.runCount,
    result.successCount,
    result.nativeSuccessRate,
    result.successCiLow,
    result.successCiHigh,
    result.conversionFactor,
    result.medianDrain,
    result.p90Drain,
    result.drainCiLow,
    result.drainCiHigh,
    result.windowPrice,
    result.nativeTasksPerWindow,
    result.nativeTasksCiLow,
    result.nativeTasksCiHigh,
    result.benchmarkEquivalentTasksPerWindow,
    result.subscriptionValueIndex,
    result.subscriptionValueIndexCiLow,
    result.subscriptionValueIndexCiHigh,
    result.apiCostPerSuccess,
    result.apiTasksPerDollar,
    result.apiValueMultiple,
    result.breakEvenTasks,
    result.economicsGap,
    publishable ? 1 : 0,
    result.limitInterruptionRate,
    result.medianTaskSeconds,
  ];
}

export interface AnalysisReport {
  records: ReportRecord[];
  /** Human-readable caveats: skipped cells and publishability downgrades. */
  caveats: string[];
}

// Analyze every measurement cell, failing closed on publishability. Validation runs first;
// any publishability issue on a measurement that still claims `publishable = 1` aborts the
// analysis unless `force` is set, in which case the affected result row is stamped
// `publishable = 0` and a caveat is recorded. Hard integrity issues always abort.
export function analyze(db: Database, force = false): AnalysisReport {
  const issues = collectIssues(db);
  const hardIssues = issues.filter((issue) => !issue.publishabilityOnly);
  if (hardIssues.length > 0) {
    throw new Error(
      `validation failed:\n${hardIssues.map((issue) => issue.message).join("\n")}`,
    );
  }
  // Measurements with an outstanding publishability issue that still claim publishable=1.
  const flagged = db
    .query<{ id: number; publishable: number }, []>(
      "SELECT id, publishable FROM subscription_measurements",
    )
    .all();
  const publishableFlag = new Map(
    flagged.map((row) => [row.id, row.publishable === 1]),
  );
  const blocked = new Map<number, string[]>();
  for (const issue of issues) {
    if (issue.measurementId === null) continue;
    if (!issue.publishabilityOnly) continue;
    if (!publishableFlag.get(issue.measurementId)) continue;
    const list = blocked.get(issue.measurementId) ?? [];
    list.push(issue.message);
    blocked.set(issue.measurementId, list);
  }
  if (blocked.size > 0 && !force) {
    const detail = [...blocked.values()].flat().join("\n");
    throw new Error(
      `analysis blocked: publishable measurements have unresolved issues (use --force to compute non-publishable):\n${detail}`,
    );
  }

  const cells = db
    .query<Cell, []>(
      `SELECT sm.*, p.price, p.billing_days, p.slug plan, pr.slug provider,
      tc.id task_cost_id, tc.avg_cost_usd, tc.pass_at_1,
      tm.slug task_manifest, tm.target_population
     FROM subscription_measurements sm
     JOIN plans p ON p.id=sm.plan_id
     JOIN providers pr ON pr.id=p.provider_id
     LEFT JOIN task_costs tc ON tc.id=sm.task_cost_ref
     LEFT JOIN task_manifests tm ON tm.id=sm.task_manifest_ref
     ORDER BY pr.slug,p.slug,sm.model,sm.promotion`,
    )
    .all();
  const records: ReportRecord[] = [];
  const caveats: string[] = [];
  const transaction = db.transaction(() => {
    for (const cell of cells) {
      const runs = db
        .query<CalibrationRun, [number, number]>(
          "SELECT * FROM runs WHERE measurement_id=? AND promotion=?",
        )
        .all(cell.id, cell.promotion);
      if (runs.length === 0) {
        caveats.push(
          `measurement ${cell.id} (${cell.provider}/${cell.model}) skipped: no runs`,
        );
        continue;
      }
      const publishable =
        (publishableFlag.get(cell.id) ?? false) && !blocked.has(cell.id);
      if (!publishable) {
        caveats.push(
          `measurement ${cell.id} (${cell.provider}/${cell.model}) marked non-publishable` +
            (blocked.has(cell.id)
              ? `: ${blocked.get(cell.id)!.join("; ")}`
              : ""),
        );
      }
      // The drain anchor is the economics avg_cost_usd when a published record is bound.
      // With an economics gap there is no benchmark-average cost, so anchor on the mean of
      // the runs' own api_equivalent_usd — the native metric stays computable, only the
      // published-pass@1 comparison drops out.
      const averageCostUsd =
        cell.avg_cost_usd ??
        runs.reduce((sum, run) => sum + run.api_equivalent_usd, 0) /
          runs.length;
      const result = calculate({
        runs,
        quotaCapacity: cell.quota_capacity,
        quotaWindowDays: cell.quota_window_days,
        planPrice: cell.price,
        billingDays: cell.billing_days,
        averageCostUsd,
        publishedPassAt1: cell.pass_at_1,
        economicsGap: cell.economics_gap ?? undefined,
        measurementGrade: cell.measurement_grade,
        confidence: cell.confidence_level,
      });
      // SQLite UNIQUE permits multiple NULLs. Remove the prior row explicitly so repeated
      // analyses of an economics-gap cell are idempotent as well.
      db.run(
        "DELETE FROM results WHERE measurement_id=? AND task_cost_id IS ?",
        [cell.id, cell.task_cost_id],
      );
      db.run(
        `INSERT INTO results(
          measurement_id,task_cost_id,computed_at,run_count,success_count,
          native_success_rate,success_ci_low,success_ci_high,conversion_factor,
          median_drain,p90_drain,drain_ci_low,drain_ci_high,window_price,
          native_tasks_per_window,native_tasks_ci_low,native_tasks_ci_high,
          benchmark_equivalent_tasks_per_window,subscription_value_index,
          svi_ci_low,svi_ci_high,api_cost_per_success,api_tasks_per_dollar,
          api_value_multiple,break_even_tasks,economics_gap,publishable,
          limit_interruption_rate,median_task_seconds
        ) VALUES(${Array.from({ length: 29 }, () => "?").join(",")})`,
        resultParams(cell, result, publishable),
      );
      records.push({
        provider: cell.provider,
        plan: cell.plan,
        model: cell.model,
        surface: cell.product_surface,
        grade: cell.measurement_grade,
        promotion: Boolean(cell.promotion),
        publishable,
        n: result.runCount,
        success_rate: round(result.nativeSuccessRate, 3),
        success_ci: `${result.successCiLow.toFixed(3)}-${result.successCiHigh.toFixed(3)}`,
        median_drain: round(result.medianDrain, 4),
        p90_drain: round(result.p90Drain, 4),
        window_days: cell.quota_window_days,
        window_price: round(result.windowPrice, 2),
        native_tasks_per_window: round(result.nativeTasksPerWindow, 2),
        native_tasks_ci: `${result.nativeTasksCiLow.toFixed(2)}-${result.nativeTasksCiHigh.toFixed(2)}`,
        benchmark_equivalent_tasks_per_window:
          result.benchmarkEquivalentTasksPerWindow === null
            ? null
            : round(result.benchmarkEquivalentTasksPerWindow, 2),
        svi: round(result.subscriptionValueIndex, 3),
        svi_ci: `${result.subscriptionValueIndexCiLow.toFixed(3)}-${result.subscriptionValueIndexCiHigh.toFixed(3)}`,
        api_value_multiple:
          result.apiValueMultiple === null
            ? null
            : round(result.apiValueMultiple, 2),
        break_even_tasks:
          result.breakEvenTasks === null
            ? null
            : round(result.breakEvenTasks, 2),
        economics_gap: result.economicsGap,
        task_manifest: cell.task_manifest,
        target_population: cell.target_population,
        estimand_version: "tier-a-native-total-drain-v1",
        protocol_version: "v1-2026-07-10",
        methodology_version: "tier-a-2026-07-10",
        comparison_compatible: !blocked.has(cell.id),
        conditions: cell.conditions,
        window: `${cell.measurement_start}/${cell.measurement_end}`,
      });
    }
  });
  transaction();
  return { records, caveats };
}

// Backward-compatible shape: return just the records. Fails closed (no force).
export function analyzeDatabase(db: Database): ReportRecord[] {
  return analyze(db).records;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export { validateDatabase } from "./validation.ts";
