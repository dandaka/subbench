#!/usr/bin/env bun

/** Deterministic DeepSWE importer. Economics are never shared across model/config cells. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface Task {
  id: string;
  language: string;
  repository: string;
  repository_url: string;
  base_commit_hash: string;
}
export interface Trial {
  task_name: string;
  model: string;
  model_version?: string;
  included_in_score: boolean;
  passed: boolean;
  cost_usd: number;
  n_agent_steps: number;
  agent_duration_seconds: number;
  reasoning_effort?: string;
  config?: Record<string, unknown> | string;
}
type Artifact<T> = { rows: T[] } | T[];
export interface ModelConfig {
  model: string;
  reasoning_effort: string;
  /** DeepSWE currently records its agent configuration as a string. */
  config: Record<string, unknown> | string;
}
interface Stats extends Task {
  pass_rate: number;
  avg_cost_usd: number;
  avg_steps: number;
  avg_minutes: number;
  trial_count: number;
  model_costs: Record<string, number>;
}
interface Slot {
  name: string;
  language: string;
  costQuantile: number;
  difficulty: "easy" | "mid" | "hard";
}

const slots: Slot[] = [
  { name: "go@p10", language: "go", costQuantile: 0.1, difficulty: "easy" },
  { name: "go@p75", language: "go", costQuantile: 0.75, difficulty: "mid" },
  {
    name: "python@p25",
    language: "python",
    costQuantile: 0.25,
    difficulty: "easy",
  },
  {
    name: "python@p90",
    language: "python",
    costQuantile: 0.9,
    difficulty: "mid",
  },
  {
    name: "ts@p50",
    language: "typescript",
    costQuantile: 0.5,
    difficulty: "mid",
  },
  {
    name: "ts@p97",
    language: "typescript",
    costQuantile: 0.97,
    difficulty: "hard",
  },
  {
    name: "js@p50",
    language: "javascript",
    costQuantile: 0.5,
    difficulty: "hard",
  },
  { name: "rust@p50", language: "rust", costQuantile: 0.5, difficulty: "mid" },
];
const targets = { easy: 0.85, mid: 0.5, hard: 0.15 };
const canonical = (value: unknown) => {
  if (!value || typeof value !== "object") return JSON.stringify(value ?? {});
  return JSON.stringify(value, Object.keys(value as object).sort());
};
const key = (spec: ModelConfig) =>
  `${spec.model}|${spec.reasoning_effort}|${canonical(spec.config)}`;
const trialKey = (trial: Trial) =>
  `${trial.model}|${trial.reasoning_effort ?? ""}|${canonical(trial.config)}`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const quantile = (xs: number[], p: number) => {
  const s = xs.toSorted((a, b) => a - b);
  const x = (s.length - 1) * p;
  return (
    s[Math.floor(x)]! +
    (s[Math.ceil(x)]! - s[Math.floor(x)]!) * (x - Math.floor(x))
  );
};
function hash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function importEconomics(
  tasks: Task[],
  trials: Trial[],
  configs: ModelConfig[],
  selectionConfig: ModelConfig,
) {
  if (!configs.some((config) => key(config) === key(selectionConfig)))
    throw new Error("selection configuration must be imported");
  const allowed = new Set(configs.map(key));
  const filtered = trials.filter(
    (trial) => trial.included_in_score && allowed.has(trialKey(trial)),
  );
  for (const config of configs)
    if (!filtered.some((trial) => trialKey(trial) === key(config)))
      throw new Error(`economics gap: no scored trials for ${key(config)}`);
  const economics = configs
    .map((config) => {
      const rows = filtered.filter((trial) => trialKey(trial) === key(config));
      return {
        model: config.model,
        model_version: [
          ...new Set(rows.map((r) => r.model_version ?? "")),
        ].join(","),
        reasoning_effort: config.reasoning_effort,
        config: config.config,
        pass_at_1: mean(rows.map((r) => +r.passed)),
        avg_cost_usd: mean(rows.map((r) => r.cost_usd)),
        avg_steps: mean(rows.map((r) => r.n_agent_steps)),
        sample_size: rows.length,
      };
    })
    .toSorted((a, b) => key(a).localeCompare(key(b)));
  const byTask = new Map(tasks.map((task) => [task.id, task]));
  const selectionRows = filtered.filter(
    (trial) => trialKey(trial) === key(selectionConfig),
  );
  const stats = [...new Set(selectionRows.map((r) => r.task_name))]
    .map((id) => {
      const task = byTask.get(id);
      if (!task) throw new Error(`missing task metadata: ${id}`);
      // A lock can only reproduce a full git object ID. Exclude malformed upstream
      // entries rather than silently treating an abbreviation as immutable provenance.
      if (!/^[a-f0-9]{40}$/i.test(task.base_commit_hash)) return undefined;
      const rows = selectionRows.filter((trial) => trial.task_name === id);
      const modelCosts: Record<string, number> = {};
      for (const config of configs) {
        const costs = filtered.filter(
          (r) => r.task_name === id && trialKey(r) === key(config),
        );
        if (costs.length)
          modelCosts[key(config)] = mean(costs.map((r) => r.cost_usd));
      }
      return {
        ...task,
        pass_rate: mean(rows.map((r) => +r.passed)),
        avg_cost_usd: mean(rows.map((r) => r.cost_usd)),
        avg_steps: mean(rows.map((r) => r.n_agent_steps)),
        avg_minutes: mean(rows.map((r) => r.agent_duration_seconds)) / 60,
        trial_count: rows.length,
        model_costs: modelCosts,
      };
    })
    .filter((task): task is Stats => task !== undefined)
    .toSorted((a, b) => a.id.localeCompare(b.id));
  return { economics, stats };
}
export function choose(stats: Stats[]) {
  const selected: Array<
    Stats & {
      slot: string;
      cost_quantile: number;
      difficulty_target: string;
      target_cost_usd: number;
    }
  > = [];
  const repos = new Set<string>();
  for (const slot of slots) {
    const language = stats.filter((task) => task.language === slot.language);
    const cost = quantile(
      language.map((t) => t.avg_cost_usd),
      slot.costQuantile,
    );
    const task = language
      .filter(
        (t) =>
          Math.abs(t.avg_cost_usd - cost) / cost <= 0.2 &&
          !repos.has(t.repository),
      )
      .toSorted(
        (a, b) =>
          Math.abs(a.pass_rate - targets[slot.difficulty]) -
            Math.abs(b.pass_rate - targets[slot.difficulty]) ||
          Math.abs(a.avg_cost_usd - cost) - Math.abs(b.avg_cost_usd - cost) ||
          a.id.localeCompare(b.id),
      )[0];
    if (!task) throw new Error(`no candidate for ${slot.name}`);
    repos.add(task.repository);
    selected.push({
      ...task,
      slot: slot.name,
      cost_quantile: slot.costQuantile,
      difficulty_target: slot.difficulty,
      target_cost_usd: cost,
    });
  }
  return selected;
}
async function content(
  location: string,
): Promise<{ text: string; source: string }> {
  if (/^https:\/\//.test(location)) {
    const r = await fetch(location);
    if (!r.ok) throw new Error(`${location}: HTTP ${r.status}`);
    return { text: await r.text(), source: location };
  }
  return { text: readFileSync(location, "utf8"), source: location };
}
function option(name: string, fallback?: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
}
if (import.meta.main) {
  const tasksArg = option(
    "--tasks",
    "https://deepswe.datacurve.ai/artifacts/v1.1/tasks.json",
  )!;
  const trialsArg = option(
    "--trials",
    "https://deepswe.datacurve.ai/artifacts/v1.1/trials.json",
  )!;
  const configs = JSON.parse(option("--configs") ?? "[]") as ModelConfig[];
  const selected = JSON.parse(
    option("--selection-config") ?? "null",
  ) as ModelConfig | null;
  const retrievedAt = option("--retrieved-at");
  if (!retrievedAt || !configs.length || !selected)
    throw new Error(
      "--retrieved-at, --configs, and --selection-config are required immutable inputs",
    );
  const [taskInput, trialInput] = await Promise.all([
    content(tasksArg),
    content(trialsArg),
  ]);
  const tasks = ((JSON.parse(taskInput.text) as Artifact<Task>).rows ??
    JSON.parse(taskInput.text)) as Task[];
  const trials = ((JSON.parse(trialInput.text) as Artifact<Trial>).rows ??
    JSON.parse(trialInput.text)) as Trial[];
  const { economics, stats } = importEconomics(
    tasks,
    trials,
    configs,
    selected,
  );
  const selectedTasks = choose(stats);
  const output = resolve(
    option("--output", "data/deepswe-v1.1-calibration-tasks.json")!,
  );
  const payload = {
    schema_version: 2,
    benchmark: "DeepSWE",
    sources: [
      {
        url: taskInput.source,
        retrieved_at: retrievedAt,
        sha256: hash(taskInput.text),
      },
      {
        url: trialInput.source,
        retrieved_at: retrievedAt,
        sha256: hash(trialInput.text),
      },
    ],
    selection_config: selected,
    economics,
    tasks: selectedTasks,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `selected ${selectedTasks.length} tasks; ${hash(JSON.stringify(payload))}`,
  );
}
