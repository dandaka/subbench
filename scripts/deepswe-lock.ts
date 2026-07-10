import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DeepSweLock {
  schema_version: 1;
  benchmark: "DeepSWE";
  sources: Array<{
    url: string;
    retrieved_at: string;
    archive_path: string;
    sha256: string;
  }>;
  deepswe_commit: string;
  verifier_version: string;
  task_images: Record<string, { name: string; digest: string }>;
  runner: { pier_version: string; client_versions: Record<string, string> };
  selection: {
    script_commit: string;
    args: string[];
    order_seed: string;
    abort_rule: string;
    output_path: string;
    output_sha256: string;
  };
  tasks: Array<{
    id: string;
    base_commit: string;
    weight: number;
    expected_repetitions: number;
  }>;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isHash(value: unknown, length = 64): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^[a-f0-9]{${length}}$`, "i").test(value)
  );
}

/** Reject incomplete/mutable provenance before a runner touches a subscription. */
export function validateLock(lock: DeepSweLock): void {
  if (lock.schema_version !== 1 || lock.benchmark !== "DeepSWE")
    throw new Error("unsupported DeepSWE lock");
  if (!isHash(lock.deepswe_commit, 40))
    throw new Error("lock has no exact DeepSWE commit");
  if (
    !lock.sources.length ||
    lock.sources.some(
      (source) =>
        !source.url ||
        !source.retrieved_at ||
        !source.archive_path ||
        !isHash(source.sha256),
    )
  ) {
    throw new Error(
      "lock has missing source URL, retrieval timestamp, or SHA-256",
    );
  }
  if (!lock.verifier_version) throw new Error("lock has no verifier version");
  if (
    !lock.runner?.pier_version ||
    !Object.keys(lock.runner.client_versions ?? {}).length
  )
    throw new Error("lock has incomplete runner versions");
  if (
    !lock.selection?.script_commit ||
    !isHash(lock.selection.script_commit, 40) ||
    !lock.selection.args?.length ||
    !lock.selection.order_seed ||
    !lock.selection.abort_rule ||
    !lock.selection.output_path ||
    !isHash(lock.selection.output_sha256)
  ) {
    throw new Error(
      "lock has incomplete selection arguments, order seed, abort rule, or output hash",
    );
  }
  const ids = new Set<string>();
  for (const task of lock.tasks) {
    if (
      !task.id ||
      ids.has(task.id) ||
      !isHash(task.base_commit, 40) ||
      !(task.weight > 0) ||
      !Number.isInteger(task.expected_repetitions) ||
      task.expected_repetitions < 1
    ) {
      throw new Error("lock has duplicate or invalid task provenance");
    }
    ids.add(task.id);
  }
  if (!lock.tasks.length) throw new Error("lock contains no tasks");
  if (
    Object.keys(lock.task_images ?? {}).length !== lock.tasks.length ||
    lock.tasks.some((task) => {
      const image = lock.task_images[task.id];
      return !image?.name || !/^sha256:[a-f0-9]{64}$/i.test(image.digest);
    })
  )
    throw new Error("lock has incomplete immutable task image digests");
}

export function readAndVerifyLock(root: string, path: string): DeepSweLock {
  const absolute = resolve(root, path);
  if (!existsSync(absolute))
    throw new Error(`immutable DeepSWE lock is missing: ${absolute}`);
  const lock = JSON.parse(readFileSync(absolute, "utf8")) as DeepSweLock;
  validateLock(lock);
  const selection = resolve(root, lock.selection.output_path);
  if (!existsSync(selection))
    throw new Error(`locked selection output is missing: ${selection}`);
  if (sha256File(selection) !== lock.selection.output_sha256)
    throw new Error(
      "locked selection output hash mismatch; regenerate or replace the lock",
    );
  return lock;
}
