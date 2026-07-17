#!/usr/bin/env bun

/**
 * Inventories local Claude CLI sessions before a subscription measurement. The
 * terminating mode is deliberately opt-in: it cannot prove account-wide
 * isolation, and must never run as part of a calibration runner.
 */

interface ProcessRow {
  pid: number;
  command: string;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function localClaudeProcesses(): ProcessRow[] {
  const listing = Bun.spawnSync({
    cmd: ["ps", "-ax", "-o", "pid=,command="],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (listing.exitCode !== 0)
    throw new Error(`ps failed: ${new TextDecoder().decode(listing.stderr)}`);

  return new TextDecoder()
    .decode(listing.stdout)
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      if (!match) return [];
      const [, rawPid, command] = match;
      // Match an invoked Claude executable, including ~/.local/bin/claude and
      // the standard bare `claude` spelling, but not a textual mention in a
      // shell command or log viewer.
      if (!/(?:^|\s)(?:\S*\/)?claude(?:\s|$)/.test(command)) return [];
      return [{ pid: Number(rawPid), command }];
    });
}

const stop = process.argv.includes("--stop-local-claude");
const operator = option("--confirm-stop-local-claude");
if (stop && (!operator || operator.startsWith("--"))) {
  throw new Error(
    'refusing to stop sessions without --confirm-stop-local-claude "<operator>"',
  );
}

const before = localClaudeProcesses();
if (!stop) {
  console.log(`Local Claude CLI sessions: ${before.length}`);
  for (const process of before) console.log(`${process.pid}\t${process.command}`);
  console.log(
    "This is a local inventory only. It cannot detect claude.ai, other machines, teammates, or API callers.",
  );
  process.exitCode = before.length === 0 ? 0 : 2;
} else {
  for (const process of before) {
    process.kill(process.pid, "SIGTERM");
    console.log(`Sent SIGTERM to ${process.pid} (${operator}).`);
  }
  // Give graceful shutdown handlers a short, bounded chance to run; never
  // escalate to SIGKILL because that may discard an operator's active work.
  await Bun.sleep(2_000);
  const remaining = localClaudeProcesses();
  console.log(`Local Claude CLI sessions remaining: ${remaining.length}`);
  for (const process of remaining)
    console.log(`${process.pid}\t${process.command}`);
  if (remaining.length > 0)
    console.log("Do not measure until the remaining sessions are closed manually.");
  process.exitCode = remaining.length === 0 ? 0 : 2;
}
