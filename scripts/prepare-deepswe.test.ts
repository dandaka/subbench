import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DeepSweLock } from "./deepswe-lock.ts";
import { prepareDeepSwe } from "./prepare-deepswe.ts";

const COMMIT = "6db64a40f3318d8659238ff34a8cc4b491c49205";

function lock(): DeepSweLock {
  return { deepswe_commit: COMMIT } as DeepSweLock;
}

/** Builds a fake `run` that records commands and returns per-command exit codes. */
function fakeRun(exit: (command: string[]) => number) {
  const commands: string[][] = [];
  const run = async (command: string[]): Promise<number> => {
    commands.push(command);
    return exit(command);
  };
  return { run, commands };
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "prepare-deepswe-"));
  const benchmark = join(dir, "deep-swe");
  const database = join(dir, "study.db");
  mkdirSync(benchmark);
  writeFileSync(database, "");
  return { dir, benchmark, database };
}

describe("prepareDeepSwe", () => {
  test("fetches the pinned commit when a shallow clone lacks it, then checks out", async () => {
    const { dir, benchmark, database } = sandbox();
    try {
      // Existing (shallow) checkout that does not contain the pinned commit.
      const { run, commands } = fakeRun((command) =>
        command.includes("cat-file") ? 1 : 0,
      );
      await prepareDeepSwe(lock(), { benchmark, database, run });

      const verbs = commands.map((command) => command[3] ?? command[1]);
      expect(verbs).toEqual(["cat-file", "fetch", "checkout"]);
      const fetch = commands.find((command) => command.includes("fetch"));
      expect(fetch).toEqual([
        "git",
        "-C",
        benchmark,
        "fetch",
        "--depth=1",
        "origin",
        COMMIT,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("skips fetch when the pinned commit is already present", async () => {
    const { dir, benchmark, database } = sandbox();
    try {
      const { run, commands } = fakeRun(() => 0);
      await prepareDeepSwe(lock(), { benchmark, database, run });
      expect(commands.some((command) => command.includes("fetch"))).toBe(false);
      expect(commands.some((command) => command.includes("checkout"))).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("aborts when the pinned commit cannot be fetched", async () => {
    const { dir, benchmark, database } = sandbox();
    try {
      const { run } = fakeRun((command) =>
        command.includes("cat-file") || command.includes("fetch") ? 1 : 0,
      );
      await expect(
        prepareDeepSwe(lock(), { benchmark, database, run }),
      ).rejects.toThrow(`failed to fetch locked DeepSWE commit ${COMMIT}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
