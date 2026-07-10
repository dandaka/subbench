#!/usr/bin/env bun

/** Download the public, immutable inputs before selection. No benchmark task is run. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function required(name: string): string {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? undefined : process.argv[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const output = resolve(required("--output-dir"));
const retrievedAt = required("--retrieved-at");
const inputs = [
  ["tasks.json", required("--tasks-url")],
  ["trials.json", required("--trials-url")],
] as const;
mkdirSync(output, { recursive: true });
const sources = [];
for (const [filename, url] of inputs) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const path = resolve(output, filename);
  writeFileSync(path, bytes);
  sources.push({ url, retrieved_at: retrievedAt, archive_path: path, sha256: sha256(bytes) });
}
writeFileSync(
  resolve(output, "sources.json"),
  `${JSON.stringify({ schema_version: 1, sources }, null, 2)}\n`,
);
console.log(JSON.stringify(sources));
