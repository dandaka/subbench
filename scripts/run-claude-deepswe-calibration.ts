#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readClaudeCredential,
  readClaudeUsageSnapshot,
} from "../packages/cli/src/claude-usage.ts";
import type { UsageSnapshot } from "../packages/cli/src/usage.ts";
import { selectWindow } from "../packages/cli/src/usage.ts";
import {
  insertRun,
  insertUsageSnapshots,
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
  avg_cost_usd: number;
  model_costs?: Record<string, number>;
}

// The API comparison must use the bound model's economics, never a cross-model fallback.
function apiEquivalentUsd(task: SelectedTask, model: string): number {
  const cost = task.model_costs?.[model];
  if (!(cost && cost > 0))
    throw new Error(`economics gap: no compatible per-task cost for ${model}`);
  return cost;
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
  "data/frozen-studies/deepswe-v1.1-2026-07-10/claude-max.db",
);
const model = "opus";
const claudeVersion = "2.1.205";

// Post-read retry: the Anthropic usage endpoint can 429. A ~50-minute task
// leaves ample slack, so retry with backoff before giving up. Exhausting the
// budget invalidates the run (no record) rather than storing a stale drain.
const postReadMaxAttempts = 6;
const postReadBackoffMs = 150_000; // 2.5 minutes between attempts (~15 min total)

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

// D4: the operator must attest isolation before any measured task. The attestation is
// recorded onto the measurement so the analysis pipeline can fail closed without it.
function requireIsolationOperator(): string {
  const operator = option("--confirm-isolation");
  if (!operator || operator.startsWith("--")) {
    throw new Error(
      'refusing to run without --confirm-isolation "<operator>": confirm that nothing ' +
        "else is consuming the subscription (other sessions, agents, cron, MCP daemons, " +
        "shared seats) per protocol.md §2, then re-run with your name.",
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

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
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

// Reads the post-task usage snapshot, retrying on rate-limit/transient errors.
// Throws if every attempt fails so the run is discarded rather than recorded
// against a stale or missing post-read.
async function readPostUsage(): Promise<UsageSnapshot> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= postReadMaxAttempts; attempt++) {
    try {
      return await readClaudeUsageSnapshot();
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        `Post-read attempt ${attempt}/${postReadMaxAttempts} failed: ${detail}`,
      );
      if (attempt < postReadMaxAttempts) await sleep(postReadBackoffMs);
    }
  }
  throw new Error(
    `Post-task usage read failed after ${postReadMaxAttempts} attempts; run discarded. ` +
      `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function pierEnvironment(token: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  // Use the subscription OAuth login, not a pay-per-token API key.
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_BASE_URL;
  env.CLAUDE_CODE_OAUTH_TOKEN = token;
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
const credential = readClaudeCredential();
if (!credential.refreshToken) {
  throw new Error(
    "Claude credential has no refresh token; an inference-only setup-token cannot " +
      "sustain a ~50-minute task. Log in with `claude` (OAuth) first.",
  );
}
const task = nextTask();
const pre = await readClaudeUsageSnapshot();
const plan = (pre.account.plan ?? "").toLowerCase();
if (plan !== "max" && plan !== "claude_max") {
  throw new Error(
    `expected Claude Max plan, got ${pre.account.plan ?? "unknown"}`,
  );
}
const preWeekly = selectWindow(pre, "weekly");
const preSession = selectWindow(pre, "session");
if (preSession.usedPercent >= 70) {
  throw new Error(
    `five-hour usage is ${preSession.usedPercent}%; wait before the next task`,
  );
}

const jobName = `claude-max-${task.id}-${Date.now()}`;
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
    "scripts.pier_claude_subscription:ClaudeMaxClaudeCode",
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
  pierEnvironment(credential.accessToken),
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

const post = await readPostUsage();
const postWeekly = selectWindow(post, "weekly");
if (post.account.idHash !== pre.account.idHash) {
  throw new Error("account changed between pre- and post-read; run discarded");
}
if (postWeekly.resetsAt !== preWeekly.resetsAt) {
  throw new Error("weekly quota window reset during the task; run discarded");
}
const success =
  exitCode === 0 &&
  result.exception_info == null &&
  result.verifier_result.rewards?.reward === 1;
const db = openDatabase(database);
try {
  const runId = insertRun(db, {
    measurement_id: 1,
    benchmark_source_id: 1,
    task_id: task.id,
    harness_environment_id: environmentId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    pre_usage: preWeekly.usedPercent,
    post_usage: postWeekly.usedPercent,
    api_equivalent_usd: apiEquivalentUsd(
      task,
      'claude-opus-4-8|max|"mini_swe_agent_claude_opus_4_8_max"',
    ),
    success: success ? 1 : 0,
    retries: 0,
    limit_event: 0,
    aborted: exitCode === 0 ? 0 : 1,
    peak_hours: 0,
    promotion: 0,
    isolation_confirmed_at: new Date().toISOString(),
    isolation_confirmed_by: isolationOperator,
    isolation_checklist_version: "v1-2026-07-10",
    notes: `Pier job ${jobName}; native ${model}; exit ${exitCode}`,
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
