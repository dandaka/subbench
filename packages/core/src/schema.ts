export const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  slug TEXT NOT NULL, name TEXT NOT NULL,
  price REAL NOT NULL CHECK(price > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_days INTEGER NOT NULL CHECK(billing_days > 0),
  terms_snapshot_date TEXT NOT NULL, advertised_limits TEXT,
  UNIQUE(provider_id, slug)
);
CREATE TABLE IF NOT EXISTS benchmark_sources (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  url TEXT NOT NULL, snapshot_date TEXT NOT NULL, harness TEXT NOT NULL,
  effort_level TEXT NOT NULL, task_count INTEGER CHECK(task_count > 0), notes TEXT
);
CREATE TABLE IF NOT EXISTS task_costs (
  id INTEGER PRIMARY KEY,
  benchmark_source_id INTEGER NOT NULL REFERENCES benchmark_sources(id),
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  model TEXT NOT NULL, model_version TEXT NOT NULL DEFAULT '',
  pass_at_1 REAL NOT NULL CHECK(pass_at_1 > 0 AND pass_at_1 <= 1),
  avg_cost_usd REAL NOT NULL CHECK(avg_cost_usd > 0),
  avg_output_tokens REAL CHECK(avg_output_tokens >= 0),
  avg_steps REAL CHECK(avg_steps >= 0),
  sample_size INTEGER NOT NULL CHECK(sample_size > 0),
  artifact_sha256 TEXT,
  UNIQUE(benchmark_source_id, provider_id, model, model_version)
);
CREATE TABLE IF NOT EXISTS subscription_measurements (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  -- D3: explicit foreign key binding this measurement to exactly one economics record.
  -- NULL is permitted only together with a non-null economics_gap (no compatible
  -- published economics; the study ships with svi computed but no API comparison).
  task_cost_ref INTEGER REFERENCES task_costs(id),
  economics_gap TEXT,
  model TEXT NOT NULL, model_version TEXT NOT NULL DEFAULT '',
  product_surface TEXT NOT NULL, product_version TEXT NOT NULL,
  measurement_start TEXT NOT NULL, measurement_end TEXT NOT NULL,
  quota_capacity REAL NOT NULL CHECK(quota_capacity > 0), quota_unit TEXT NOT NULL,
  -- D1: length of the quota window in days; capacity and drain are measured against it.
  quota_window_days INTEGER NOT NULL CHECK(quota_window_days > 0),
  measurement_grade TEXT NOT NULL
    CHECK(measurement_grade IN ('exact','rounded','inferred','unknown')),
  confidence_level REAL NOT NULL DEFAULT 0.95
    CHECK(confidence_level > 0 AND confidence_level < 1),
  peak_hours INTEGER NOT NULL DEFAULT 0 CHECK(peak_hours IN (0,1)),
  promotion INTEGER NOT NULL DEFAULT 0 CHECK(promotion IN (0,1)),
  -- D4: isolation attestation as data.
  isolation_confirmed_at TEXT, isolation_confirmed_by TEXT, environment_id TEXT,
  publishable INTEGER NOT NULL DEFAULT 1 CHECK(publishable IN (0,1)),
  conditions TEXT,
  UNIQUE(plan_id, model, model_version, product_surface, product_version,
         measurement_start, promotion),
  CHECK(task_cost_ref IS NOT NULL OR economics_gap IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES subscription_measurements(id),
  benchmark_source_id INTEGER NOT NULL REFERENCES benchmark_sources(id),
  task_id TEXT NOT NULL, harness_environment_id TEXT NOT NULL,
  started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
  pre_usage REAL NOT NULL, post_usage REAL NOT NULL,
  usage_delta REAL NOT NULL CHECK(usage_delta >= 0),
  api_equivalent_usd REAL NOT NULL CHECK(api_equivalent_usd > 0),
  success INTEGER NOT NULL CHECK(success IN (0,1)),
  retries INTEGER NOT NULL DEFAULT 0 CHECK(retries >= 0),
  limit_event INTEGER NOT NULL DEFAULT 0 CHECK(limit_event IN (0,1)),
  aborted INTEGER NOT NULL DEFAULT 0 CHECK(aborted IN (0,1)),
  peak_hours INTEGER NOT NULL DEFAULT 0 CHECK(peak_hours IN (0,1)),
  promotion INTEGER NOT NULL DEFAULT 0 CHECK(promotion IN (0,1)),
  -- D4: how the drain was evidenced. 'manual' (hand-entered numbers) is non-publishable.
  evidence_kind TEXT NOT NULL DEFAULT 'manual'
    CHECK(evidence_kind IN ('paired-snapshots','manual')),
  notes TEXT, CHECK(ended_at >= started_at)
);
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK(position IN ('pre','post')),
  provider TEXT NOT NULL, account_id_hash TEXT, plan TEXT,
  captured_at TEXT NOT NULL, collector_name TEXT NOT NULL,
  collector_version TEXT NOT NULL, authority TEXT NOT NULL,
  precision TEXT NOT NULL, cached INTEGER NOT NULL CHECK(cached IN (0,1)),
  endpoint TEXT NOT NULL, raw_json TEXT NOT NULL, normalized_json TEXT NOT NULL,
  UNIQUE(run_id, position)
);
CREATE TABLE IF NOT EXISTS usage_snapshot_windows (
  id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES usage_snapshots(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, used_percent REAL NOT NULL
    CHECK(used_percent >= 0 AND used_percent <= 100),
  resets_at TEXT, duration_minutes REAL, provider_type TEXT, provider_unit INTEGER
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES subscription_measurements(id),
  task_cost_id INTEGER REFERENCES task_costs(id),
  computed_at TEXT NOT NULL, run_count INTEGER NOT NULL, success_count INTEGER NOT NULL,
  native_success_rate REAL NOT NULL,
  success_ci_low REAL NOT NULL, success_ci_high REAL NOT NULL,
  conversion_factor REAL NOT NULL, median_drain REAL NOT NULL, p90_drain REAL NOT NULL,
  drain_ci_low REAL NOT NULL, drain_ci_high REAL NOT NULL,
  window_price REAL NOT NULL,
  native_tasks_per_window REAL NOT NULL,
  native_tasks_ci_low REAL NOT NULL, native_tasks_ci_high REAL NOT NULL,
  benchmark_equivalent_tasks_per_window REAL,
  subscription_value_index REAL NOT NULL,
  svi_ci_low REAL NOT NULL, svi_ci_high REAL NOT NULL,
  api_cost_per_success REAL, api_tasks_per_dollar REAL, api_value_multiple REAL,
  break_even_tasks REAL, economics_gap TEXT,
  publishable INTEGER NOT NULL DEFAULT 1 CHECK(publishable IN (0,1)),
  limit_interruption_rate REAL NOT NULL, median_task_seconds REAL NOT NULL,
  UNIQUE(measurement_id, task_cost_id)
);
CREATE INDEX IF NOT EXISTS runs_measurement_idx ON runs(measurement_id);
CREATE INDEX IF NOT EXISTS usage_snapshots_run_idx ON usage_snapshots(run_id);
CREATE INDEX IF NOT EXISTS task_costs_model_idx ON task_costs(provider_id, model);
`;

// Columns added after the v1 schema shipped. Applied idempotently to existing databases:
// SQLite ADD COLUMN is a no-op-safe forward migration (we swallow "duplicate column").
const migrations: Array<{ table: string; column: string; definition: string }> = [
  { table: "task_costs", column: "artifact_sha256", definition: "TEXT" },
  { table: "subscription_measurements", column: "task_cost_ref", definition: "INTEGER REFERENCES task_costs(id)" },
  { table: "subscription_measurements", column: "economics_gap", definition: "TEXT" },
  { table: "subscription_measurements", column: "quota_window_days", definition: "INTEGER" },
  { table: "subscription_measurements", column: "isolation_confirmed_at", definition: "TEXT" },
  { table: "subscription_measurements", column: "isolation_confirmed_by", definition: "TEXT" },
  { table: "subscription_measurements", column: "environment_id", definition: "TEXT" },
  { table: "subscription_measurements", column: "publishable", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "runs", column: "evidence_kind", definition: "TEXT NOT NULL DEFAULT 'manual'" },
];

interface Migratable {
  query(sql: string): { all(): Array<{ name: string }> };
  run(sql: string): unknown;
}

// Bring an existing database up to the current column set. New tables/indexes are created
// by re-running `schema` (all statements are IF NOT EXISTS); new columns on pre-existing
// tables are added here because SQLite cannot express them declaratively.
export function migrate(db: Migratable): void {
  db.run(schema);
  for (const { table, column, definition } of migrations) {
    const columns = db.query(`PRAGMA table_info(${table})`).all();
    if (columns.some((row) => row.name === column)) continue;
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
