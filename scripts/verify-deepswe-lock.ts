#!/usr/bin/env bun

/** Local, no-subscription proof that a lock still names the archived workload. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { $ } from "bun";
import { readAndVerifyLock, sha256File } from "./deepswe-lock.ts";

function required(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? undefined : process.argv[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

const root = resolve(import.meta.dir, "..");
const lockPath = required("--lock");
const checkout = resolve(root, required("--checkout"));
const verifyImages = process.argv.includes("--verify-images");
const lock = readAndVerifyLock(root, lockPath);
for (const source of lock.sources) {
  if (!source.archive_path || !existsSync(source.archive_path))
    throw new Error(`archived source is missing: ${source.archive_path ?? source.url}`);
  if (sha256File(source.archive_path) !== source.sha256)
    throw new Error(`archived source hash mismatch: ${source.archive_path}`);
}
const commit = (await $`git -C ${checkout} rev-parse HEAD`.text()).trim();
if (commit !== lock.deepswe_commit)
  throw new Error(`checkout mismatch: expected ${lock.deepswe_commit}, got ${commit}`);
for (const task of lock.tasks) {
  const path = resolve(checkout, "tasks", task.id, "task.toml");
  if (!existsSync(path)) throw new Error(`locked task entry is missing: ${task.id}`);
  const contents = readFileSync(path, "utf8");
  if (!contents.includes(task.base_commit))
    throw new Error(`locked task base commit is absent from task entry: ${task.id}`);
  const image = lock.task_images[task.id]!;
  if (!contents.includes(`docker_image = "${image.name}"`))
    throw new Error(`locked task image is absent from task entry: ${task.id}`);
  if (verifyImages) {
    const actual = (await $`docker buildx imagetools inspect --format {{.Manifest.Digest}} ${image.name}`.text()).trim();
    if (actual !== image.digest)
      throw new Error(`locked task image digest mismatch: ${task.id}`);
  }
}
console.log(`verified ${lock.tasks.length} locked tasks, sources, selection, and checkout`);
