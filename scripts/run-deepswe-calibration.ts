#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeDatabase,
  insertRun,
  loadBundle,
  openDatabase,
} from "../packages/core/src/index.ts";
import { readCodexUsage } from "../packages/cli/src/codex-usage.ts";

interface SelectedTask {
  id: string;
  gpt_5_5_avg_cost_usd: number;
}

interface Selection {
  tasks: SelectedTask[];
}

interface TrialResult {
  verifier_result?: { rewards?: { reward?: number } };
  exception_info?: unknown;
  agent_execution?: { started_at?: string; finished_at?: string } | null;
  agent_result?: object | null;
}

const root = resolve(import.meta.dir, "..");
const state = resolve(root, ".subbench");
const benchmark = resolve(state, "deep-swe");
const jobs = resolve(state, "jobs");
const database = resolve(root, "openai-plus.db");
const bundle = resolve(root, "examples/openai-plus-deepswe-v1.1.json");
const selectionPath = resolve(root, "data/deepswe-v1.1-calibration-tasks.json");
const selection = JSON.parse(readFileSync(selectionPath, "utf8")) as Selection;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function run(command: string[], quiet = false): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: root,
    stdin: "inherit",
    stdout: quiet ? "pipe" : "inherit",
    stderr: quiet ? "pipe" : "inherit",
  });
  return child.exited;
}

async function prepare(): Promise<void> {
  if (!existsSync(benchmark)) {
    const status = await run([
      "git", "clone", "--depth", "1",
      "https://github.com/datacurve-ai/deep-swe.git", benchmark,
    ]);
    if (status !== 0) throw new Error("failed to clone DeepSWE");
  }
  if (!existsSync(database)) {
    initializeDatabase(database);
    const db = openDatabase(database);
    try {
      loadBundle(db, bundle);
    } finally {
      db.close();
    }
  }
}

function nextTask(): SelectedTask {
  const requested = option("--task");
  const db = openDatabase(database);
  try {
    const completed = new Set(
      db.query<{ task_id: string }, []>("SELECT task_id FROM runs").all()
        .map((row) => row.task_id),
    );
    const task = requested
      ? selection.tasks.find((candidate) => candidate.id === requested)
      : selection.tasks.find((candidate) => !completed.has(candidate.id));
    if (!task) {
      throw new Error(requested
        ? `task is not in the calibration selection: ${requested}`
        : "all selected calibration tasks have runs");
    }
    if (completed.has(task.id)) throw new Error(`task already has a recorded run: ${task.id}`);
    return task;
  } finally {
    db.close();
  }
}

function trialResult(jobDirectory: string): TrialResult | undefined {
  for (const entry of readdirSync(jobDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = resolve(jobDirectory, entry.name, "result.json");
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as TrialResult;
  }
}

await prepare();
const task = nextTask();
const pre = await readCodexUsage();
if (!pre.weekly) throw new Error("Codex did not report a weekly usage window");
if (pre.plan !== "plus") throw new Error(`expected Plus plan, got ${pre.plan ?? "unknown"}`);
if (!pre.session) throw new Error("Codex did not report a five-hour usage window");
if (pre.session.usedPercent >= 70) {
  const reset = pre.session.resetsAt
    ? new Date(pre.session.resetsAt * 1000).toISOString()
    : "the reported reset";
  throw new Error(
    `five-hour usage is ${pre.session.usedPercent}%; wait until ${reset} before the next task`,
  );
}

const jobName = `openai-plus-${task.id}-${Date.now()}`;
const jobDirectory = resolve(jobs, jobName);
const startedAt = new Date();
console.log(`Running ${task.id}; weekly usage is ${pre.weekly.usedPercent}%`);
const exitCode = await run([
  "pier", "run",
  "--path", resolve(benchmark, "tasks", task.id),
  "--agent-import-path", "scripts.pier_codex_subscription:CodexSubscription",
  "--model", "openai/gpt-5.5",
  "--agent-kwarg", "version=0.141.0",
  "--agent-kwarg", "reasoning_effort=xhigh",
  "--agent-env", "CODEX_FORCE_AUTH_JSON=true",
  "--env", "docker",
  "--n-concurrent", "1",
  "--jobs-dir", jobs,
  "--job-name", jobName,
  "--yes",
]);
const endedAt = new Date();
const result = trialResult(jobDirectory);
if (!result?.agent_execution?.started_at) {
  throw new Error(
    `Pier failed before Codex execution; no calibration run was recorded. See ${jobDirectory}`,
  );
}
if (!result.agent_result || !result.verifier_result) {
  throw new Error(
    `Codex or the verifier failed at the harness layer; no calibration run was recorded. `
    + `See ${jobDirectory}`,
  );
}
const post = await readCodexUsage();
if (!post.weekly) throw new Error("Codex did not report a weekly usage window after the run");
if (pre.weekly.resetsAt !== post.weekly.resetsAt) {
  throw new Error("weekly quota reset during the run; refusing to record an invalid delta");
}
const success = exitCode === 0
  && result?.exception_info == null
  && result?.verifier_result?.rewards?.reward === 1;
const db = openDatabase(database);
try {
  const runId = insertRun(db, {
    measurement_id: 1,
    benchmark_source_id: 1,
    task_id: task.id,
    harness_environment_id: "deepswe-v1.1-pier-0.3.0-docker-codex-0.141.0",
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    pre_usage: pre.weekly.usedPercent,
    post_usage: post.weekly.usedPercent,
    api_equivalent_usd: task.gpt_5_5_avg_cost_usd,
    success: success ? 1 : 0,
    retries: 0,
    limit_event: 0,
    aborted: exitCode === 0 ? 0 : 1,
    peak_hours: 0,
    promotion: 0,
    notes: `Pier job ${jobName}; exit ${exitCode}`,
  });
  console.log(
    `Recorded run ${runId}: ${success ? "pass" : "fail"}, weekly usage `
    + `${pre.weekly.usedPercent}% -> ${post.weekly.usedPercent}%`,
  );
} finally {
  db.close();
}
process.exitCode = exitCode;
