#!/usr/bin/env bun

// Non-measurement calibration preflight. It validates the frozen DeepSWE
// checkout, Docker/Pier lifecycle, and verifier with Pier's built-in nop agent.
// It never injects provider credentials or invokes a model.

import { resolve } from "node:path";
import { readClaudeUsageSnapshot } from "../packages/cli/src/claude-usage.ts";
import { readCodexUsageSnapshot } from "../packages/cli/src/codex-usage.ts";
import { selectWindow, trySelectWindow } from "../packages/cli/src/usage.ts";
import { readZaiUsageSnapshot } from "../packages/cli/src/zai-usage.ts";
import { readAndVerifyLock, readLockedSelection } from "./deepswe-lock.ts";
import { prepareDeepSwe } from "./prepare-deepswe.ts";

type Provider = "claude" | "openai" | "zai";

interface Selection {
  tasks: Array<{ id: string }>;
}

const root = resolve(import.meta.dir, "..");
const state = resolve(root, ".subbench");
const benchmark = resolve(state, "deep-swe");
const jobs = resolve(state, "jobs");

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function run(command: string[]): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return child.exited;
}

async function probe(provider: Provider): Promise<void> {
  const snapshot =
    provider === "claude"
      ? await readClaudeUsageSnapshot()
      : provider === "openai"
        ? await readCodexUsageSnapshot()
        : await readZaiUsageSnapshot();
  const weekly = selectWindow(snapshot, "weekly");
  const session = trySelectWindow(snapshot, "session");
  const sessionStr = session
    ? `session ${session.usedPercent}%, `
    : "";
  console.log(
    `Read-only ${provider} usage probe: ${sessionStr}weekly ${weekly.usedPercent}%.`,
  );
}

const provider = option("--provider") as Provider | undefined;
if (!provider || !["claude", "openai", "zai"].includes(provider)) {
  throw new Error(
    "usage: bun run preflight:calibration --provider claude|openai|zai",
  );
}

const lock = readAndVerifyLock(
  root,
  option("--lock") ?? "data/deepswe-v1.1.lock.json",
);
const selection = readLockedSelection<Selection>(root, lock);
const taskId = option("--task") ?? selection.tasks[0]?.id;
if (!taskId) throw new Error("locked selection is empty");
if (!selection.tasks.some((task) => task.id === taskId))
  throw new Error(`task is not in the locked selection: ${taskId}`);

await probe(provider);
await prepareDeepSwe(lock, {
  benchmark,
  database: resolve(
    root,
    "data/frozen-studies/deepswe-v1.1-2026-07-10",
    provider === "claude"
      ? "claude-max.db"
      : provider === "openai"
        ? "openai-plus.db"
        : "zai-coding-lite.db",
  ),
  run,
});

const jobName = `preflight-${provider}-${taskId}-${Date.now()}`;
console.log(
  `Preflight ${provider}: running ${taskId} with Pier's nop agent. ` +
    "No provider credentials or model calls are used; this is not calibration data.",
);
const exitCode = await run([
  "pier",
  "run",
  "--path",
  resolve(benchmark, "tasks", taskId),
  "--agent",
  "nop",
  "--env",
  "docker",
  "--n-concurrent",
  "1",
  "--jobs-dir",
  jobs,
  "--job-name",
  jobName,
  "--yes",
]);
if (exitCode !== 0)
  throw new Error(
    `preflight failed (exit ${exitCode}); see ${resolve(jobs, jobName)}`,
  );
console.log(`Preflight passed: ${resolve(jobs, jobName)}`);
