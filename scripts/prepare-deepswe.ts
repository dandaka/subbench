import { existsSync } from "node:fs";
import type { DeepSweLock } from "./deepswe-lock.ts";

/** Runs a command with inherited stdio, returning its exit code. */
export type RunCommand = (command: string[]) => Promise<number>;

export interface PrepareDeepSweOptions {
  /** Working tree for the pinned DeepSWE checkout. */
  benchmark: string;
  /** Frozen study database the runner reads after checkout. */
  database: string;
  run: RunCommand;
}

/**
 * Clone (if missing) and pin the DeepSWE working tree to the locked commit.
 *
 * A pre-existing checkout may be a shallow clone that lacks the pinned commit
 * (e.g. HEAD elsewhere, no history), so `checkout --detach` would fail with
 * "unable to read tree". Fetch the exact commit first when it is not present
 * locally, then check it out.
 */
export async function prepareDeepSwe(
  lock: DeepSweLock,
  { benchmark, database, run }: PrepareDeepSweOptions,
): Promise<void> {
  if (!existsSync(benchmark)) {
    const status = await run([
      "git",
      "clone",
      "--no-checkout",
      "https://github.com/datacurve-ai/deep-swe.git",
      benchmark,
    ]);
    if (status !== 0) throw new Error("failed to clone DeepSWE");
  }
  const present =
    (await run([
      "git",
      "-C",
      benchmark,
      "cat-file",
      "-t",
      lock.deepswe_commit,
    ])) === 0;
  if (!present) {
    const fetched = await run([
      "git",
      "-C",
      benchmark,
      "fetch",
      "--depth=1",
      "origin",
      lock.deepswe_commit,
    ]);
    if (fetched !== 0)
      throw new Error(
        `failed to fetch locked DeepSWE commit ${lock.deepswe_commit}`,
      );
  }
  const checkout = await run([
    "git",
    "-C",
    benchmark,
    "checkout",
    "--detach",
    lock.deepswe_commit,
  ]);
  if (checkout !== 0)
    throw new Error(
      `failed to checkout locked DeepSWE commit ${lock.deepswe_commit}`,
    );
  if (!existsSync(database))
    throw new Error(`fresh locked study is missing: ${database}`);
}
