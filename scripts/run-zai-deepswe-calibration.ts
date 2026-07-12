#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectWindow } from "../packages/cli/src/usage.ts";
import { readZaiUsageSnapshot } from "../packages/cli/src/zai-usage.ts";
import {
  insertRun,
  insertUsageSnapshots,
  isRunawayDrain,
  openDatabase,
} from "../packages/core/src/index.ts";
import {
  type DeepSweLock,
  readAndVerifyLock,
  readLockedSelection,
} from "./deepswe-lock.ts";
import { prepareDeepSwe } from "./prepare-deepswe.ts";

interface SelectedTask {
  id: string;
  base_commit_hash: string;
  model_costs?: Record<string, number>;
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
const database = resolve(
  root,
  "data/frozen-studies/deepswe-v1.1-2026-07-10/zai-coding-lite.db",
);
const model = "glm-5.2";
const claudeVersion = "2.1.187";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

// D4: refuse to run without an operator isolation attestation (see protocol.md §2).
function requireIsolationOperator(): string {
  const operator = option("--confirm-isolation");
  if (!operator || operator.startsWith("--")) {
    throw new Error(
      'refusing to run without --confirm-isolation "<operator>": confirm that nothing ' +
        "else is consuming the subscription, then re-run with your name.",
    );
  }
  return operator;
}

function stampIsolation(
  databasePath: string,
  operator: string,
  environmentId: string,
): void {
  const db = openDatabase(databasePath);
  try {
    db.run(
      `UPDATE subscription_measurements
       SET isolation_confirmed_at=?, isolation_confirmed_by=?, environment_id=?
       WHERE id=1`,
      [new Date().toISOString(), operator, environmentId],
    );
  } finally {
    db.close();
  }
}

async function run(
  command: string[],
  env?: Record<string, string>,
): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: root,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return child.exited;
}

async function prepare(lock: DeepSweLock): Promise<void> {
  await prepareDeepSwe(lock, { benchmark, database, run });
}

function nextTask(): SelectedTask {
  const requested = option("--task");
  const db = openDatabase(database);
  try {
    const completed = new Set(
      db
        .query<{ task_id: string }, []>("SELECT task_id FROM runs")
        .all()
        .map((row) => row.task_id),
    );
    const task = requested
      ? selection.tasks.find((candidate) => candidate.id === requested)
      : selection.tasks.find((candidate) => !completed.has(candidate.id));
    if (!task) {
      throw new Error(
        requested
          ? `task is not in the calibration selection: ${requested}`
          : "all selected calibration tasks have runs",
      );
    }
    if (completed.has(task.id))
      throw new Error(`task already has a recorded run: ${task.id}`);
    return task;
  } finally {
    db.close();
  }
}

function trialResult(jobDirectory: string): TrialResult | undefined {
  if (!existsSync(jobDirectory)) return undefined;
  for (const entry of readdirSync(jobDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = resolve(jobDirectory, entry.name, "result.json");
    if (existsSync(path))
      return JSON.parse(readFileSync(path, "utf8")) as TrialResult;
  }
}

function pierEnvironment(token: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  delete env.ANTHROPIC_API_KEY;
  env.ANTHROPIC_AUTH_TOKEN = token;
  env.ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic";
  env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  return env;
}

const isolationOperator = requireIsolationOperator();
const lock = readAndVerifyLock(
  root,
  option("--lock") ?? "data/deepswe-v1.1.lock.json",
);
const selection = readLockedSelection<Selection>(root, lock);
await prepare(lock);
const environmentId = `deepswe-v1.1-pier-0.3.0-docker-claude-code-${claudeVersion}`;
stampIsolation(database, isolationOperator, environmentId);
const token = process.env.ZAI_AUTH_TOKEN;
if (!token) throw new Error("ZAI_AUTH_TOKEN is missing from .env");
const task = nextTask();
const pre = await readZaiUsageSnapshot();
if (pre.account.plan !== "lite") {
  throw new Error(
    `expected Z.ai Lite plan, got ${pre.account.plan ?? "unknown"}`,
  );
}
const preWeekly = selectWindow(pre, "weekly");
const preSession = selectWindow(pre, "session");
if (preSession.usedPercent >= 70) {
  throw new Error(
    `five-hour usage is ${preSession.usedPercent}%; wait before the next task`,
  );
}

const jobName = `zai-lite-${task.id}-${Date.now()}`;
const jobDirectory = resolve(jobs, jobName);
const startedAt = new Date();
console.log(
  `Running ${task.id} with ${model}; weekly usage is ${preWeekly.usedPercent}%`,
);
const exitCode = await run(
  [
    "pier",
    "run",
    "--path",
    resolve(benchmark, "tasks", task.id),
    "--agent-import-path",
    "scripts.pier_zai_subscription:ZaiClaudeCode",
    "--model",
    model,
    "--agent-kwarg",
    `version=${claudeVersion}`,
    "--agent-kwarg",
    "reasoning_effort=xhigh",
    "--env",
    "docker",
    "--n-concurrent",
    "1",
    "--jobs-dir",
    jobs,
    "--job-name",
    jobName,
    "--yes",
  ],
  pierEnvironment(token),
);
const endedAt = new Date();
const result = trialResult(jobDirectory);
if (!result?.agent_execution?.started_at) {
  throw new Error(
    `Pier failed before Claude Code execution; no run was recorded. See ${jobDirectory}`,
  );
}
if (!result.agent_result || !result.verifier_result) {
  throw new Error(
    `Claude Code or the verifier failed at the harness layer; no run was recorded. ` +
      `See ${jobDirectory}`,
  );
}

const post = await readZaiUsageSnapshot();
const postWeekly = selectWindow(post, "weekly");
const success =
  exitCode === 0 &&
  result.exception_info == null &&
  result.verifier_result.rewards?.reward === 1;
const db = openDatabase(database);
try {
  // §4 abort rule: `aborted` marks a runaway (≥3× the established median drain),
  // NOT a task failure. Decide it from the prior in-batch drains, not the exit code.
  const drain = postWeekly.usedPercent - preWeekly.usedPercent;
  const priorDrains = db
    .query<{ drain: number }, [number]>(
      "SELECT usage_delta AS drain FROM runs WHERE measurement_id=? ORDER BY started_at",
    )
    .all(1)
    .map((row) => row.drain);
  const runId = insertRun(db, {
    measurement_id: 1,
    benchmark_source_id: 1,
    task_id: task.id,
    harness_environment_id: environmentId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    pre_usage: preWeekly.usedPercent,
    post_usage: postWeekly.usedPercent,
    api_equivalent_usd:
      task.model_costs?.['glm-5-2|max|"mini_swe_agent_glm_5_2_max"'] ??
      (() => {
        throw new Error(
          `economics gap: no locked per-task cost for ${task.id}`,
        );
      })(),
    success: success ? 1 : 0,
    retries: 0,
    limit_event: 0,
    aborted: isRunawayDrain(priorDrains, drain) ? 1 : 0,
    peak_hours: 0,
    promotion: 0,
    isolation_confirmed_at: new Date().toISOString(),
    isolation_confirmed_by: isolationOperator,
    isolation_checklist_version: "v1-2026-07-10",
    notes: `Pier job ${jobName}; opus mapped to ${model}; exit ${exitCode}`,
  });
  try {
    insertUsageSnapshots(db, runId, pre, post, "weekly");
  } catch (error) {
    db.run("DELETE FROM runs WHERE id=?", [runId]);
    throw error;
  }
  console.log(
    `Recorded run ${runId}: ${success ? "pass" : "fail"}, weekly usage ` +
      `${preWeekly.usedPercent}% -> ${postWeekly.usedPercent}%`,
  );
} finally {
  db.close();
}
process.exitCode = exitCode;
