import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyze,
  initializeDatabase,
  insertUsageSnapshots,
  loadBundle,
  openDatabase,
  validateDatabase,
} from "../src/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true });
});

function scratch(): string {
  const directory = mkdtempSync(join(tmpdir(), "subbench-int-"));
  directories.push(directory);
  return directory;
}

// A Claude-shaped bundle: the measurement's product model alias ("opus") differs from the
// economics model key ("claude-opus-4-8"). Binding is by explicit task_cost_model, not by
// string-equal model names — the P0-4 regression.
function claudeBundle(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const runs = Array.from({ length: 5 }, (_, index) => ({
    provider: "claude",
    plan: "max",
    model: "opus",
    product_surface: "claude-code",
    benchmark_source: "deepswe-v1.1",
    task_id: `task-${index}`,
    harness_environment_id: "env-1",
    started_at: `2026-07-1${index}T10:00:00Z`,
    ended_at: `2026-07-1${index}T10:40:00Z`,
    pre_usage: index * 8,
    post_usage: index * 8 + 8,
    api_equivalent_usd: 9,
    success: index === 2 ? 0 : 1,
    retries: 0,
    limit_event: 0,
    aborted: 0,
    peak_hours: 0,
    promotion: 0,
    evidence_kind: "paired-snapshots",
    notes: "",
    isolation_confirmed_at: `2026-07-1${index}T09:59:00Z`,
    isolation_confirmed_by: "operator",
    isolation_checklist_version: "v1-2026-07-10",
  }));
  return {
    providers: [{ slug: "claude", name: "Anthropic Claude" }],
    plans: [
      {
        provider: "claude",
        slug: "max",
        name: "Claude Max",
        price: 100,
        currency: "USD",
        billing_days: 30,
        terms_snapshot_date: "2026-07-10",
        advertised_limits: "",
      },
    ],
    benchmark_sources: [
      {
        slug: "deepswe-v1.1",
        name: "DeepSWE v1.1",
        url: "https://deepswe.datacurve.ai/",
        snapshot_date: "2026-07-01",
        harness: "mini-swe-agent",
        effort_level: "xhigh",
        task_count: 113,
        notes: "",
      },
    ],
    task_costs: [
      {
        benchmark_source: "deepswe-v1.1",
        provider: "claude",
        model: "claude-opus-4-8",
        model_version: "2026-07",
        reasoning_effort: "xhigh",
        configuration: {},
        pass_at_1: 0.52,
        avg_cost_usd: 9,
        avg_output_tokens: 0,
        avg_steps: 100,
        sample_size: 597,
      },
    ],
    task_manifests: [
      {
        slug: "fixture-fixed-set",
        manifest_sha256: "a".repeat(64),
        benchmark_source: "deepswe-v1.1",
        target_population: "fixture fixed set",
        weighting: "equal",
        order_seed: "fixture-seed",
        abort_rule: "three-times-median",
        deepswe_commit: "b".repeat(40),
        verifier_version: "fixture-1",
        image_digest: `sha256:${"c".repeat(64)}`,
        created_at: "2026-07-10T00:00:00Z",
      },
    ],
    task_manifest_entries: Array.from({ length: 5 }, (_, index) => ({
      manifest: "fixture-fixed-set",
      task_id: `task-${index}`,
      base_commit: "d".repeat(40),
      weight: 1,
      expected_repetitions: 1,
    })),
    subscription_measurements: [
      {
        provider: "claude",
        plan: "max",
        model: "opus",
        model_version: "2026-07",
        task_cost_model: "claude-opus-4-8",
        task_cost_model_version: "2026-07",
        task_manifest: "fixture-fixed-set",
        product_surface: "claude-code",
        product_version: "2.1.205",
        measurement_start: "2026-07-10",
        measurement_end: "2026-07-17",
        quota_capacity: 100,
        quota_unit: "weekly-used-percent",
        quota_window_days: 7,
        measurement_grade: "rounded",
        confidence_level: 0.95,
        peak_hours: 0,
        promotion: 0,
        isolation_confirmed_at: "2026-07-10T09:00:00Z",
        isolation_confirmed_by: "operator",
        environment_id: "env-1",
        publishable: 1,
        conditions: "",
        ...overrides,
      },
    ],
    runs,
  };
}

function loadFixture(bundle: unknown) {
  const directory = scratch();
  const bundlePath = join(directory, "bundle.json");
  writeFileSync(bundlePath, JSON.stringify(bundle));
  const database = join(directory, "study.db");
  initializeDatabase(database);
  const db = openDatabase(database);
  loadBundle(db, bundlePath);
  const rows = db
    .query<{ id: number; pre_usage: number; post_usage: number }, []>(
      "SELECT id,pre_usage,post_usage FROM runs",
    )
    .all();
  for (const row of rows) {
    const snapshot = (usedPercent: number) => ({
      provider: "claude",
      account: { plan: "max", idHash: "fixture-account" },
      capturedAt: "2026-07-10T10:00:00Z",
      collector: {
        name: "fixture",
        version: "1",
        authority: "provider",
        precision: "exact",
        cached: false,
      },
      source: { endpoint: "fixture" },
      windows: [
        { kind: "weekly", usedPercent, resetsAt: "2026-07-17T00:00:00Z" },
      ],
      raw: {},
    });
    insertUsageSnapshots(
      db,
      row.id,
      snapshot(row.pre_usage),
      snapshot(row.post_usage),
      "weekly",
    );
  }
  return db;
}

describe("integration regressions", () => {
  test("P0-4: a Claude measurement resolves economics across a model-name mismatch", () => {
    const db = loadFixture(claudeBundle());
    try {
      expect(validateDatabase(db)).toEqual([]);
      const { records } = analyze(db);
      // Previously the string-equal join dropped this cell; now it produces a result.
      expect(records).toHaveLength(1);
      const record = records[0]!;
      expect(record.provider).toBe("claude");
      expect(record.publishable).toBe(true);
      // native success rate 4/5, and a positive SVI.
      expect(record.success_rate).toBeCloseTo(0.8);
      expect(record.svi).toBeGreaterThan(0);
      // benchmark-equivalent anchor present because economics are bound.
      expect(record.benchmark_equivalent_tasks_per_window).not.toBeNull();
    } finally {
      db.close();
    }
  });

  test("P0-3: a measurement with neither economics binding nor gap fails validation", () => {
    // Drop the economics binding entirely: no task_cost_model, no economics_gap. The load
    // itself rejects it (exactly-one-of constraint), which is the fail-closed behavior.
    const bundle = claudeBundle();
    const measurement = (
      bundle.subscription_measurements as Record<string, unknown>[]
    )[0]!;
    delete measurement.task_cost_model;
    delete measurement.task_cost_model_version;
    expect(() => loadFixture(bundle)).toThrow(
      /task_cost_model or economics_gap/,
    );
  });

  test("P0-5: a missing per-run isolation attestation blocks a publishable analysis", () => {
    const db = loadFixture(claudeBundle());
    try {
      db.run(
        "UPDATE runs SET isolation_confirmed_at=NULL, isolation_confirmed_by=NULL WHERE id=1",
      );
      const issues = validateDatabase(db);
      expect(
        issues.some((issue) => issue.includes("isolation attestation")),
      ).toBe(true);
      // analyze fails closed without force...
      expect(() => analyze(db)).toThrow(/analysis blocked/);
      // ...but --force computes and stamps the row non-publishable.
      const { records } = analyze(db, true);
      expect(records).toHaveLength(1);
      expect(records[0]!.publishable).toBe(false);
    } finally {
      db.close();
    }
  });

  test("a Z.ai-style economics gap yields a native result with no API comparison", () => {
    const bundle = claudeBundle();
    const measurement = (
      bundle.subscription_measurements as Record<string, unknown>[]
    )[0]!;
    delete measurement.task_cost_model;
    delete measurement.task_cost_model_version;
    measurement.economics_gap = "no compatible published economics";
    (bundle.task_costs as unknown[]) = [];
    const db = loadFixture(bundle);
    try {
      const { records } = analyze(db);
      expect(records).toHaveLength(1);
      const record = records[0]!;
      expect(record.svi).toBeGreaterThan(0);
      expect(record.benchmark_equivalent_tasks_per_window).toBeNull();
      expect(record.api_value_multiple).toBeNull();
      expect(record.economics_gap).toContain("no compatible");
    } finally {
      db.close();
    }
  });

  test("paired snapshots reject reset, meter, and duplicate-task evidence", () => {
    const db = loadFixture(claudeBundle());
    try {
      db.run(
        "UPDATE usage_snapshot_windows SET resets_at='different' WHERE id=2",
      );
      db.run("UPDATE usage_snapshot_windows SET used_percent=99 WHERE id=1");
      db.run(
        "INSERT INTO runs SELECT NULL,measurement_id,benchmark_source_id,task_id,harness_environment_id,started_at,ended_at,pre_usage,post_usage,usage_delta,api_equivalent_usd,success,retries,limit_event,aborted,peak_hours,promotion,evidence_kind,isolation_confirmed_at,isolation_confirmed_by,isolation_checklist_version,notes FROM runs WHERE id=1",
      );
      const issues = validateDatabase(db).join("\n");
      expect(issues).toContain("mismatched account, reset, or meter");
      expect(issues).toContain("duplicate task attempts");
    } finally {
      db.close();
    }
  });
});
