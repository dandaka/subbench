#!/usr/bin/env bun

/** Create fresh empty studies from a verified DeepSWE lock; never runs an agent. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeDatabase,
  loadBundle,
  openDatabase,
} from "../packages/core/src/index.ts";
import { readAndVerifyLock, sha256File } from "./deepswe-lock.ts";

function required(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? undefined : process.argv[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

const root = resolve(import.meta.dir, "..");
const lockPath = required("--lock");
const output = resolve(root, required("--output-dir"));
const createdAt = required("--created-at");
const lock = readAndVerifyLock(root, lockPath);
const lockHash = sha256File(resolve(root, lockPath));
const selection = JSON.parse(
  await Bun.file(resolve(root, lock.selection.output_path)).text(),
) as { economics: Array<Record<string, unknown>> };

const cells = [
  {
    file: "openai-plus",
    provider: "openai",
    providerName: "OpenAI",
    plan: "plus",
    planName: "ChatGPT Plus",
    price: 20,
    model: "gpt-5.5",
    benchmarkModel: "gpt-5-5",
    effort: "xhigh",
    configuration: "mini_swe_agent_gpt_5_5_xhigh",
    surface: "codex-cli",
    productVersion: lock.runner.client_versions.codex,
  },
  {
    file: "claude-max",
    provider: "claude",
    providerName: "Anthropic Claude",
    plan: "max",
    planName: "Claude Max",
    price: 100,
    model: "opus",
    benchmarkModel: "claude-opus-4-8",
    effort: "max",
    configuration: "mini_swe_agent_claude_opus_4_8_max",
    surface: "claude-code",
    productVersion: lock.runner.client_versions["claude-code"],
  },
  {
    file: "zai-coding-lite",
    provider: "zai",
    providerName: "Z.ai",
    plan: "coding-lite",
    planName: "GLM Coding Lite",
    price: 18,
    model: "glm-5.2",
    benchmarkModel: "glm-5-2",
    effort: "max",
    configuration: "mini_swe_agent_glm_5_2_max",
    surface: "claude-code",
    productVersion: lock.runner.client_versions["zai-claude-code"],
  },
];

mkdirSync(output, { recursive: true });
for (const cell of cells) {
  const economics = selection.economics.find(
    (row) =>
      row.model === cell.benchmarkModel &&
      row.reasoning_effort === cell.effort &&
      row.config === cell.configuration,
  );
  if (!economics) throw new Error(`no compatible economics for ${cell.file}`);
  const manifest = `${cell.file}-deepswe-v1.1-${lockHash.slice(0, 12)}`;
  const bundle = {
    providers: [{ slug: cell.provider, name: cell.providerName }],
    plans: [
      {
        provider: cell.provider,
        slug: cell.plan,
        name: cell.planName,
        price: cell.price,
        currency: "USD",
        billing_days: 30,
        terms_snapshot_date: createdAt.slice(0, 10),
        advertised_limits:
          "Fresh pre-collection study; terms evidence required before publication.",
      },
    ],
    benchmark_sources: [
      {
        slug: "deepswe-v1.1-locked",
        name: "DeepSWE v1.1 locked archive",
        url: "https://deepswe.datacurve.ai/artifacts/v1.1/",
        snapshot_date: createdAt.slice(0, 10),
        harness: "mini-swe-agent",
        effort_level: cell.effort,
        task_count: 113,
        notes: `Lock SHA-256 ${lockHash}; native subscription harness differs from mini-swe-agent.`,
      },
    ],
    task_costs: [
      {
        benchmark_source: "deepswe-v1.1-locked",
        provider: cell.provider,
        model: cell.benchmarkModel,
        model_version: "",
        reasoning_effort: cell.effort,
        configuration: cell.configuration,
        pass_at_1: economics.pass_at_1,
        avg_cost_usd: economics.avg_cost_usd,
        avg_output_tokens: 0,
        avg_steps: economics.avg_steps,
        sample_size: economics.sample_size,
        artifact_sha256: lockHash,
        snapshot_sha256: lock.sources[1]!.sha256,
      },
    ],
    task_manifests: [
      {
        slug: manifest,
        manifest_sha256: lockHash,
        benchmark_source: "deepswe-v1.1-locked",
        target_population:
          "The eight locked Tier A DeepSWE tasks only; no generalization beyond this fixed set.",
        weighting: "equal",
        order_seed: lock.selection.order_seed,
        abort_rule: lock.selection.abort_rule,
        deepswe_commit: lock.deepswe_commit,
        verifier_version: lock.verifier_version,
        image_digest: `sha256:${lockHash}`,
        created_at: createdAt,
      },
    ],
    task_manifest_entries: lock.tasks.map((task) => ({
      manifest,
      task_id: task.id,
      base_commit: task.base_commit,
      weight: task.weight,
      expected_repetitions: task.expected_repetitions,
    })),
    subscription_measurements: [
      {
        provider: cell.provider,
        plan: cell.plan,
        model: cell.model,
        model_version: "",
        task_cost_benchmark_source: "deepswe-v1.1-locked",
        task_cost_model: cell.benchmarkModel,
        task_cost_model_version: "",
        task_cost_reasoning_effort: cell.effort,
        task_cost_configuration: cell.configuration,
        task_manifest: manifest,
        economics_gap:
          "API comparison blocked pending a completed cross-source economics sanity check for lock " +
          lockHash,
        product_surface: cell.surface,
        product_version: cell.productVersion,
        measurement_start: createdAt.slice(0, 10),
        measurement_end: createdAt.slice(0, 10),
        quota_capacity: 100,
        quota_unit: "weekly-used-percent",
        quota_window_days: 7,
        measurement_grade: "unknown",
        confidence_level: 0.95,
        peak_hours: 0,
        promotion: 0,
        isolation_confirmed_at: null,
        isolation_confirmed_by: null,
        environment_id: null,
        publishable: 0,
        conditions: `FRESH EMPTY STUDY. Bound to lock ${lockHash}; do not collect without protocol §2 attestation.`,
      },
    ],
  };
  const bundlePath = resolve(output, `${cell.file}.json`);
  const databasePath = resolve(output, `${cell.file}.db`);
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  initializeDatabase(databasePath);
  const db = openDatabase(databasePath);
  try {
    loadBundle(db, bundlePath);
  } finally {
    db.close();
  }
  console.log(`created ${bundlePath} and ${databasePath}`);
}
