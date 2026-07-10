#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type DeepSweLock, sha256File, validateLock } from "./deepswe-lock.ts";

function required(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? undefined : process.argv[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}
const root = resolve(import.meta.dir, "..");
const selectionPath = required("--selection");
const selection = JSON.parse(
  Bun.file(resolve(root, selectionPath)).size
    ? await Bun.file(resolve(root, selectionPath)).text()
    : "{}",
) as {
  tasks?: Array<{ id: string; base_commit_hash: string }>;
};
const lock: DeepSweLock = {
  schema_version: 1,
  benchmark: "DeepSWE",
  sources: JSON.parse(required("--sources")) as DeepSweLock["sources"],
  deepswe_commit: required("--deepswe-commit"),
  verifier_version: required("--verifier-version"),
  task_images: JSON.parse(
    required("--task-images"),
  ) as DeepSweLock["task_images"],
  runner: {
    pier_version: required("--pier-version"),
    client_versions: JSON.parse(required("--client-versions")),
  },
  selection: {
    script_commit: required("--script-commit"),
    args: JSON.parse(required("--selection-args")),
    order_seed: required("--order-seed"),
    abort_rule: required("--abort-rule"),
    output_path: selectionPath,
    output_sha256: sha256File(resolve(root, selectionPath)),
  },
  tasks: (selection.tasks ?? []).map((task) => ({
    id: task.id,
    base_commit: task.base_commit_hash,
    weight: 1,
    expected_repetitions: 1,
  })),
};
validateLock(lock);
const output = resolve(root, required("--output"));
writeFileSync(output, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`wrote verified lock ${output}`);
