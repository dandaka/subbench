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
  UNIQUE(benchmark_source_id, provider_id, model, model_version)
);
CREATE TABLE IF NOT EXISTS subscription_measurements (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  model TEXT NOT NULL, model_version TEXT NOT NULL DEFAULT '',
  product_surface TEXT NOT NULL, product_version TEXT NOT NULL,
  measurement_start TEXT NOT NULL, measurement_end TEXT NOT NULL,
  quota_capacity REAL NOT NULL CHECK(quota_capacity > 0), quota_unit TEXT NOT NULL,
  measurement_grade TEXT NOT NULL
    CHECK(measurement_grade IN ('exact','rounded','inferred','unknown')),
  confidence_level REAL NOT NULL DEFAULT 0.95
    CHECK(confidence_level > 0 AND confidence_level < 1),
  peak_hours INTEGER NOT NULL DEFAULT 0 CHECK(peak_hours IN (0,1)),
  promotion INTEGER NOT NULL DEFAULT 0 CHECK(promotion IN (0,1)),
  conditions TEXT,
  UNIQUE(plan_id, model, model_version, product_surface, product_version,
         measurement_start, promotion)
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
  notes TEXT, CHECK(ended_at >= started_at)
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES subscription_measurements(id),
  task_cost_id INTEGER NOT NULL REFERENCES task_costs(id),
  computed_at TEXT NOT NULL, run_count INTEGER NOT NULL, success_count INTEGER NOT NULL,
  success_ci_low REAL NOT NULL, success_ci_high REAL NOT NULL,
  conversion_factor REAL NOT NULL, median_drain REAL NOT NULL, p90_drain REAL NOT NULL,
  drain_ci_low REAL NOT NULL, drain_ci_high REAL NOT NULL,
  successful_tasks_per_period REAL NOT NULL,
  successful_tasks_ci_low REAL NOT NULL, successful_tasks_ci_high REAL NOT NULL,
  subscription_value_index REAL NOT NULL, api_cost_per_success REAL NOT NULL,
  api_tasks_per_dollar REAL NOT NULL, api_value_multiple REAL NOT NULL,
  break_even_tasks REAL NOT NULL, limit_interruption_rate REAL NOT NULL,
  median_task_seconds REAL NOT NULL,
  UNIQUE(measurement_id, task_cost_id)
);
CREATE INDEX IF NOT EXISTS runs_measurement_idx ON runs(measurement_id);
CREATE INDEX IF NOT EXISTS task_costs_model_idx ON task_costs(provider_id, model);
`;
