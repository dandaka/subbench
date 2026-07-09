#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TASKS_URL = "https://deepswe.datacurve.ai/artifacts/v1.1/tasks.json";
const TRIALS_URL = "https://deepswe.datacurve.ai/artifacts/v1.1/trials.json";
const MODELS = new Set([
  "claude-fable-5",
  "claude-sonnet-5",
  "claude-opus-4-8",
  "gpt-5-5",
]);

interface Task {
  id: string;
  language: string;
  repository: string;
  repository_url: string;
  base_commit_hash: string;
}

interface Trial {
  task_name: string;
  model: string;
  included_in_score: boolean;
  passed: boolean;
  cost_usd: number;
  n_agent_steps: number;
  agent_duration_seconds: number;
}

interface Artifact<T> {
  rows: T[];
}

interface Stats extends Task {
  pass_rate: number;
  avg_cost_usd: number;
  avg_steps: number;
  avg_minutes: number;
  trial_count: number;
  gpt_5_5_pass_rate: number;
  gpt_5_5_avg_cost_usd: number;
  // Per-model average cost for THIS task, so a runner uses its bound model's economics as
  // the run's api_equivalent_usd rather than a cross-model aggregate.
  model_costs: Record<string, number>;
}

// D3: per-model benchmark-wide economics. Each model in MODELS gets its own pass@1 and
// average cost — never a cross-model aggregate labeled as one model. This is what a
// study bundle binds to as its published economics record.
interface ModelEconomics {
  model: string;
  pass_at_1: number;
  avg_cost_usd: number;
  avg_output_tokens: number;
  avg_steps: number;
  sample_size: number;
}

function perModelEconomics(trials: Trial[]): ModelEconomics[] {
  return [...MODELS].map((model) => {
    const rows = trials.filter((trial) => trial.included_in_score && trial.model === model);
    if (rows.length === 0) throw new Error(`no scored trials for model ${model}`);
    return {
      model,
      pass_at_1: mean(rows.map((row) => Number(row.passed))),
      avg_cost_usd: mean(rows.map((row) => row.cost_usd)),
      avg_output_tokens: 0,
      avg_steps: mean(rows.map((row) => row.n_agent_steps)),
      sample_size: rows.length,
    };
  }).toSorted((a: ModelEconomics, b: ModelEconomics) => a.model.localeCompare(b.model));
}

interface Slot {
  name: string;
  language: string;
  costQuantile: number;
  difficulty: "easy" | "mid" | "hard";
}

interface Selection extends Stats {
  slot: string;
  cost_quantile: number;
  difficulty_target: string;
  target_cost_usd: number;
}

const slots: Slot[] = [
  { name: "go@p10", language: "go", costQuantile: 0.10, difficulty: "easy" },
  { name: "go@p75", language: "go", costQuantile: 0.75, difficulty: "mid" },
  { name: "python@p25", language: "python", costQuantile: 0.25, difficulty: "easy" },
  { name: "python@p90", language: "python", costQuantile: 0.90, difficulty: "mid" },
  { name: "ts@p50", language: "typescript", costQuantile: 0.50, difficulty: "mid" },
  { name: "ts@p97", language: "typescript", costQuantile: 0.97, difficulty: "hard" },
  { name: "js@p50", language: "javascript", costQuantile: 0.50, difficulty: "hard" },
  { name: "rust@p50", language: "rust", costQuantile: 0.50, difficulty: "mid" },
];

const passTargets = { easy: 0.85, mid: 0.50, hard: 0.15 };

function quantile(values: number[], probability: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * fraction;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function artifact<T>(url: string): Promise<{ rows: T[]; sha256: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.text();
  const sha256 = createHash("sha256").update(body).digest("hex");
  return { rows: (JSON.parse(body) as Artifact<T>).rows, sha256 };
}

function aggregate(tasks: Task[], trials: Trial[]): Stats[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const groups = new Map<string, Trial[]>();
  for (const trial of trials) {
    if (!trial.included_in_score || !MODELS.has(trial.model)) continue;
    const group = groups.get(trial.task_name) ?? [];
    group.push(trial);
    groups.set(trial.task_name, group);
  }
  return [...groups].map(([id, rows]) => {
    const task = taskById.get(id);
    if (!task) throw new Error(`missing task metadata: ${id}`);
    const gpt = rows.filter((row) => row.model === "gpt-5-5");
    if (gpt.length === 0) throw new Error(`missing gpt-5-5 trials: ${id}`);
    const modelCosts: Record<string, number> = {};
    for (const candidate of MODELS) {
      const modelRows = rows.filter((row) => row.model === candidate);
      if (modelRows.length > 0) modelCosts[candidate] = mean(modelRows.map((row) => row.cost_usd));
    }
    return {
      ...task,
      pass_rate: mean(rows.map((row) => Number(row.passed))),
      avg_cost_usd: mean(rows.map((row) => row.cost_usd)),
      avg_steps: mean(rows.map((row) => row.n_agent_steps)),
      avg_minutes: mean(rows.map((row) => row.agent_duration_seconds)) / 60,
      trial_count: rows.length,
      gpt_5_5_pass_rate: mean(gpt.map((row) => Number(row.passed))),
      gpt_5_5_avg_cost_usd: mean(gpt.map((row) => row.cost_usd)),
      model_costs: modelCosts,
    };
  }).toSorted((a, b) => a.id.localeCompare(b.id));
}

function choose(stats: Stats[]): Selection[] {
  const selected: Selection[] = [];
  const repositories = new Set<string>();
  for (const slot of slots) {
    const language = stats.filter((task) => task.language === slot.language);
    const targetCost = quantile(language.map((task) => task.avg_cost_usd), slot.costQuantile);
    const candidates = language
      .filter((task) => Math.abs(task.avg_cost_usd - targetCost) / targetCost <= 0.20)
      .filter((task) => !repositories.has(task.repository))
      .toSorted((a, b) => {
        const passDifference =
          Math.abs(a.pass_rate - passTargets[slot.difficulty])
          - Math.abs(b.pass_rate - passTargets[slot.difficulty]);
        if (passDifference !== 0) return passDifference;
        const costDifference =
          Math.abs(a.avg_cost_usd - targetCost) - Math.abs(b.avg_cost_usd - targetCost);
        return costDifference || a.id.localeCompare(b.id);
      });
    const task = candidates[0];
    if (!task) throw new Error(`no candidate for ${slot.name}`);
    repositories.add(task.repository);
    selected.push({
      ...task,
      slot: slot.name,
      cost_quantile: slot.costQuantile,
      difficulty_target: slot.difficulty,
      target_cost_usd: targetCost,
    });
  }
  return selected;
}

function markdown(selected: Selection[], all: Stats[]): string {
  const sampleCost = mean(selected.map((task) => task.avg_cost_usd));
  const samplePass = mean(selected.map((task) => task.pass_rate));
  const fullCost = mean(all.map((task) => task.avg_cost_usd));
  const fullPass = mean(all.map((task) => task.pass_rate));
  const lines = selected.map((task) =>
    `| ${task.slot} | \`${task.id}\` | ${task.language} | ${task.repository} | `
    + `${task.pass_rate.toFixed(2)} | $${task.avg_cost_usd.toFixed(2)} | `
    + `${task.avg_steps.toFixed(1)} | ${task.avg_minutes.toFixed(1)} |`
  );
  return `# DeepSWE v1.1 calibration tasks

Generated by \`bun run select:tasks\` from the public DeepSWE v1.1 artifacts updated
2026-07-01. The per-slot statistics below aggregate scored trials for claude-fable-5,
claude-sonnet-5, claude-opus-4-8, and gpt-5-5 for task selection only. The published
JSON also carries **per-model** economics (\`economics\`) — one pass@1 and average cost
per model, never a cross-model aggregate labeled as one model. GLM-5.2 (Z.ai) is not in
this model set, so no Z.ai economics can be published from this source.

| slot | task ID | language | repository | pass | avg cost | steps | minutes |
|---|---|---|---|---:|---:|---:|---:|
${lines.join("\n")}

## Acceptance checks

- Sample mean cost: $${sampleCost.toFixed(2)}; full-set mean: $${fullCost.toFixed(2)}
  (${((sampleCost / fullCost - 1) * 100).toFixed(1)}%).
- Sample mean pass rate: ${samplePass.toFixed(2)}; full-set mean: ${fullPass.toFixed(2)}
  (${(samplePass - fullPass).toFixed(2)} difference).
- Tasks at or above the full-set p90 cost ($${quantile(all.map((task) => task.avg_cost_usd), 0.9).toFixed(2)}):
  ${selected.filter((task) =>
    task.avg_cost_usd >= quantile(all.map((row) => row.avg_cost_usd), 0.9)
  ).length}.
- Unique repositories: ${new Set(selected.map((task) => task.repository)).size}/8.

These are mini-swe-agent statistics. Subscription runs use Codex's native harness, so
the harness-mismatch disclaimer in [methodology.md](methodology.md) applies.

DeepSWE asks that benchmark instructions and solutions not be included in training
corpora. This repository records identifiers and aggregate statistics only; task
content remains in the upstream benchmark repository.
`;
}

const outputJson = resolve(process.argv[2] ?? "data/deepswe-v1.1-calibration-tasks.json");
const outputMarkdown = resolve(process.argv[3] ?? "docs/calibration-tasks.md");
const [tasksArtifact, trialsArtifact] = await Promise.all([
  artifact<Task>(TASKS_URL),
  artifact<Trial>(TRIALS_URL),
]);
const tasks = tasksArtifact.rows;
const trials = trialsArtifact.rows;
const stats = aggregate(tasks, trials);
const selected = choose(stats);
const economics = perModelEconomics(trials);
for (const output of [outputJson, outputMarkdown]) mkdirSync(dirname(output), { recursive: true });
writeFileSync(outputJson, `${JSON.stringify({
  benchmark: "DeepSWE",
  version: "v1.1",
  snapshot_date: "2026-07-01",
  source: { tasks: TASKS_URL, trials: TRIALS_URL },
  // P2: pin the exact downloaded artifacts so a bundle can record which economics it used.
  artifact_sha256: { tasks: tasksArtifact.sha256, trials: trialsArtifact.sha256 },
  aggregate_models: [...MODELS],
  // D3: per-model economics. No cross-model aggregate row is emitted. Note that GLM-5.2
  // (Z.ai) is NOT in the DeepSWE v1.1 model set, so no Z.ai economics can be published
  // from this source; a Z.ai study must ship with a named economics gap.
  economics,
  tasks: selected,
}, null, 2)}\n`);
writeFileSync(outputMarkdown, markdown(selected, stats));
console.log(`selected ${selected.length} tasks`);
console.log(selected.map((task) => `${task.slot}: ${task.id}`).join("\n"));
