#!/usr/bin/env bun

// Create a deterministic, reviewable copy of every table in a calibration SQLite
// database. The SQLite file remains the canonical relational artifact; this export
// makes all measurement evidence diffable and recoverable from Git.

import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const root = resolve(import.meta.dir, "..");
const databasePath = resolve(
  root,
  option("--db") ?? "data/frozen-studies/deepswe-v1.1-2026-07-10/claude-max.db",
);
const outputPath = resolve(
  root,
  option("--output") ??
    "data/frozen-studies/deepswe-v1.1-2026-07-10/claude-max.evidence.json",
);
if (
  process.argv.some(
    (argument) =>
      argument.startsWith("--") && !["--db", "--output"].includes(argument),
  )
)
  throw new Error(
    "usage: bun run scripts/export-calibration-evidence.ts [--db path] [--output path]",
  );

const database = new Database(databasePath, { readonly: true });
try {
  const tables = database
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  const payload: Record<string, unknown> = {
    schema_version: 1,
    source_database: databasePath.slice(root.length + 1),
    tables: {},
  };
  const exported = payload.tables as Record<string, unknown[]>;
  for (const { name } of tables) {
    const columns = database
      .query<{ name: string; pk: number }, []>(`PRAGMA table_info("${name}")`)
      .all();
    const order =
      columns
        .filter((column) => column.pk > 0)
        .map((column) => `"${column.name}"`)
        .join(", ") || "rowid";
    exported[name] = database
      .query(`SELECT * FROM "${name}" ORDER BY ${order}`)
      .all() as unknown[];
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`exported ${tables.length} tables to ${outputPath}`);
} finally {
  database.close();
}
