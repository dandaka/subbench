import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DeepSweLock,
  readAndVerifyLock,
  sha256File,
  validateLock,
} from "./deepswe-lock.ts";

function lock(): DeepSweLock {
  return {
    schema_version: 1,
    benchmark: "DeepSWE",
    sources: [
      {
        url: "https://example.invalid/tasks",
        retrieved_at: "2026-07-10T00:00:00Z",
        archive_path: "tasks.json",
        sha256: "a".repeat(64),
      },
    ],
    deepswe_commit: "b".repeat(40),
    verifier_version: "v1",
    task_images: {
      one: { name: "image", digest: `sha256:${"c".repeat(64)}` },
    },
    runner: { pier_version: "1", client_versions: { client: "1" } },
    selection: {
      script_commit: "d".repeat(40),
      args: ["--configs", "[]"],
      order_seed: "seed",
      abort_rule: "3x median",
      output_path: "selection.json",
      output_sha256: "",
    },
    tasks: [
      {
        id: "one",
        base_commit: "e".repeat(40),
        weight: 1,
        expected_repetitions: 1,
      },
    ],
  };
}
describe("DeepSWE lock", () => {
  test("rejects tampered selection output and duplicate task provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "subbench-lock-"));
    try {
      writeFileSync(join(dir, "selection.json"), "locked\n");
      const value = lock();
      value.selection.output_sha256 = sha256File(join(dir, "selection.json"));
      writeFileSync(join(dir, "lock.json"), JSON.stringify(value));
      expect(readAndVerifyLock(dir, "lock.json").tasks).toHaveLength(1);
      writeFileSync(join(dir, "selection.json"), "tampered\n");
      expect(() => readAndVerifyLock(dir, "lock.json")).toThrow(
        /hash mismatch/,
      );
      value.tasks.push({ ...value.tasks[0]! });
      expect(() => validateLock(value)).toThrow(/duplicate/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
