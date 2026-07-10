#!/usr/bin/env bun

import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  analyze,
  initializeDatabase,
  insertRun,
  insertUsageSnapshots,
  loadBundle,
  migrate,
  openDatabase,
  renderCsv,
  renderJson,
  renderMarkdown,
  validateDatabase,
} from "@subbench/core";
import { readClaudeUsageSnapshot } from "./claude-usage.ts";
import { readCodexUsage, readCodexUsageSnapshot } from "./codex-usage.ts";
import {
  renderUsage,
  selectWindow,
  type UsageProvider,
  type UsageSnapshot,
  type UsageWindowKind,
} from "./usage.ts";
import { readZaiUsageSnapshot } from "./zai-usage.ts";

function fail(message: string, code = 2): never {
  console.error(message);
  process.exit(code);
}

function option(
  args: string[],
  name: string,
  required = false,
): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    if (required) fail(`${name} is required`);
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function flag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}

function numeric(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (value === undefined || !Number.isFinite(parsed))
    fail(`${name} must be numeric`);
  return parsed;
}

async function readUsage(command: string): Promise<number> {
  const process = Bun.spawn(["/bin/sh", "-lc", command], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(process.stdout).text();
  const status = await process.exited;
  if (status !== 0) fail(`usage command exited with status ${status}`);
  return numeric(output.trim(), "usage command output");
}

function collectUsage(provider: UsageProvider): Promise<UsageSnapshot> {
  if (provider === "codex") return readCodexUsageSnapshot();
  if (provider === "claude") return readClaudeUsageSnapshot();
  return readZaiUsageSnapshot();
}

function usage(): never {
  fail(
    "usage: subbench [--db path] <init|migrate|load|validate|analyze|run|usage|codex-usage> [options]",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const databasePath = option(args, "--db") ?? "subbench.db";
  const command = args.shift();
  if (!command) usage();

  if (command === "usage") {
    const provider = args.shift() as UsageProvider | undefined;
    if (!provider || !["codex", "zai", "claude"].includes(provider)) {
      fail("usage provider must be codex, zai, or claude");
    }
    const window = (option(args, "--window") ?? "weekly") as UsageWindowKind;
    const format = option(args, "--format") ?? "numeric";
    if (!["session", "weekly", "monthly", "mcp", "unknown"].includes(window)) {
      fail("--window must be session, weekly, monthly, mcp, or unknown");
    }
    if (!["numeric", "json"].includes(format))
      fail("--format must be numeric or json");
    if (args.length > 0) fail(`unknown options: ${args.join(" ")}`);
    const snapshot = await collectUsage(provider);
    console.log(renderUsage(snapshot, window, format as "numeric" | "json"));
    return;
  }
  if (command === "codex-usage") {
    const window = option(args, "--window") ?? "weekly";
    const format = option(args, "--format") ?? "numeric";
    if (!["session", "weekly"].includes(window))
      fail("--window must be session or weekly");
    if (!["numeric", "json"].includes(format))
      fail("--format must be numeric or json");
    if (args.length > 0) fail(`unknown options: ${args.join(" ")}`);
    const usage = await readCodexUsage();
    const selected = window === "session" ? usage.session : usage.weekly;
    if (!selected) fail(`Codex did not report a ${window} usage window`);
    if (format === "numeric") console.log(selected.usedPercent);
    else
      console.log(
        JSON.stringify({ plan: usage.plan, window, ...selected }, null, 2),
      );
    return;
  }
  if (command === "init") {
    initializeDatabase(databasePath);
    console.log(`initialized ${databasePath}`);
    return;
  }
  if (!existsSync(databasePath)) {
    fail(
      `database does not exist: ${databasePath}; run \`subbench --db ${databasePath} init\``,
    );
  }
  const db = openDatabase(databasePath);
  try {
    if (command === "load") {
      const path = args.shift() ?? fail("load requires a JSON bundle path");
      console.log(JSON.stringify(loadBundle(db, path)));
      return;
    }
    if (command === "migrate") {
      const dryRun = flag(args, "--dry-run");
      if (args.length > 0) fail(`unknown options: ${args.join(" ")}`);
      if (dryRun) {
        console.log(
          "migration required: schema v2; rerun without --dry-run to apply (migrate a copy first)",
        );
      } else {
        migrate(db);
        console.log(
          "migrated to schema v2; historical rows remain non-publishable until new evidence is collected",
        );
      }
      return;
    }
    if (command === "validate") {
      const issues = validateDatabase(db);
      if (issues.length > 0) fail(issues.join("\n"), 1);
      console.log("valid");
      return;
    }
    if (command === "analyze") {
      const format = option(args, "--format") ?? "markdown";
      const output = option(args, "--output");
      const force = flag(args, "--force");
      if (args.length > 0) fail(`unknown options: ${args.join(" ")}`);
      const renderers = {
        json: renderJson,
        csv: renderCsv,
        markdown: renderMarkdown,
      } as const;
      if (!(format in renderers))
        fail("--format must be json, csv, or markdown");
      let report: ReturnType<typeof analyze>;
      try {
        report = analyze(db, force);
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error), 1);
      }
      for (const caveat of report.caveats) console.error(`caveat: ${caveat}`);
      const content = renderers[format as keyof typeof renderers](
        report.records,
      );
      if (output) writeFileSync(output, content);
      else process.stdout.write(content);
      return;
    }
    if (command === "run") {
      const separator = args.indexOf("--");
      const taskCommand = separator >= 0 ? args.splice(separator + 1) : [];
      if (separator >= 0) args.splice(separator, 1);
      if (taskCommand.length === 0) fail("a task command is required after --");

      const measurementId = numeric(
        option(args, "--measurement-id", true),
        "--measurement-id",
      );
      const benchmarkSourceId = numeric(
        option(args, "--benchmark-source-id", true),
        "--benchmark-source-id",
      );
      const taskId = option(args, "--task-id", true)!;
      const environment = option(args, "--environment", true)!;
      const apiCost = numeric(option(args, "--api-cost", true), "--api-cost");
      const usageCommand = option(args, "--usage-command");
      const usageProvider = option(args, "--usage-provider") as
        | UsageProvider
        | undefined;
      const usageWindow = (option(args, "--usage-window") ??
        "weekly") as UsageWindowKind;
      const explicitPre = option(args, "--pre-usage");
      const explicitPost = option(args, "--post-usage");
      if (
        usageProvider &&
        !["codex", "zai", "claude"].includes(usageProvider)
      ) {
        fail("--usage-provider must be codex, zai, or claude");
      }
      if (usageProvider && usageCommand)
        fail("--usage-provider cannot be combined with --usage-command");
      if (
        usageProvider &&
        (explicitPre !== undefined || explicitPost !== undefined)
      ) {
        fail("--usage-provider cannot be combined with explicit usage values");
      }
      if (
        usageCommand &&
        (explicitPre !== undefined || explicitPost !== undefined)
      ) {
        fail("--usage-command cannot be combined with explicit usage values");
      }
      if (!usageProvider && !usageCommand && explicitPre === undefined) {
        fail("--pre-usage, --usage-command, or --usage-provider is required");
      }
      const retries = numeric(option(args, "--retries") ?? "0", "--retries");
      const limitEvent = flag(args, "--limit-event");
      const aborted = flag(args, "--aborted");
      const peakHours = flag(args, "--peak-hours");
      const promotion = flag(args, "--promotion");
      const notes = option(args, "--notes") ?? "";
      const isolationBy = option(args, "--confirm-isolation", true)!;
      if (args.length > 0) fail(`unknown options: ${args.join(" ")}`);

      const preSnapshot = usageProvider
        ? await collectUsage(usageProvider)
        : undefined;
      const preUsage = preSnapshot
        ? selectWindow(preSnapshot, usageWindow).usedPercent
        : usageCommand
          ? await readUsage(usageCommand)
          : numeric(explicitPre, "--pre-usage");
      const startedAt = new Date();
      const task = Bun.spawn(taskCommand, {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = await task.exited;
      const endedAt = new Date();
      let postUsage: number;
      const postSnapshot = usageProvider
        ? await collectUsage(usageProvider)
        : undefined;
      if (postSnapshot) {
        postUsage = selectWindow(postSnapshot, usageWindow).usedPercent;
      } else if (usageCommand) {
        postUsage = await readUsage(usageCommand);
      } else if (explicitPost !== undefined) {
        postUsage = numeric(explicitPost, "--post-usage");
      } else if (process.stdin.isTTY) {
        const prompt = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        postUsage = numeric(
          await prompt.question("Post-run usage indicator: "),
          "post-run usage",
        );
        prompt.close();
      } else {
        fail(
          "--post-usage is required in non-interactive mode without --usage-command",
        );
      }
      const runId = insertRun(db, {
        measurement_id: measurementId,
        benchmark_source_id: benchmarkSourceId,
        task_id: taskId,
        harness_environment_id: environment,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        pre_usage: preUsage,
        post_usage: postUsage,
        api_equivalent_usd: apiCost,
        success: exitCode === 0 && !aborted ? 1 : 0,
        retries,
        limit_event: limitEvent ? 1 : 0,
        aborted: aborted ? 1 : 0,
        peak_hours: peakHours ? 1 : 0,
        promotion: promotion ? 1 : 0,
        // Manual numeric input is non-publishable evidence; provider snapshots upgrade
        // the run to 'paired-snapshots' via insertUsageSnapshots below.
        evidence_kind:
          preSnapshot && postSnapshot ? "paired-snapshots" : "manual",
        notes,
        isolation_confirmed_at: new Date().toISOString(),
        isolation_confirmed_by: isolationBy,
        isolation_checklist_version: "v1-2026-07-10",
      });
      if (preSnapshot && postSnapshot) {
        try {
          insertUsageSnapshots(
            db,
            runId,
            preSnapshot,
            postSnapshot,
            usageWindow,
          );
        } catch (error) {
          db.run("DELETE FROM runs WHERE id=?", [runId]);
          throw error;
        }
      }
      console.log(`recorded run ${runId} (exit ${exitCode})`);
      process.exitCode = exitCode;
      return;
    }
    usage();
  } finally {
    db.close();
  }
}

await main();
