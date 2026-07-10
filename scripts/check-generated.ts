#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";

const tracked = [
  "data/deepswe-v1.1-2026-07-10/selection.json",
  "docs/calibration-tasks.md",
];
for (const path of tracked)
  if (!existsSync(path) || readFileSync(path, "utf8").trim().length === 0)
    throw new Error(`generated artifact is missing or empty: ${path}`);
const selection = JSON.parse(readFileSync(tracked[0]!, "utf8")) as {
  tasks?: Array<{ id?: string }>;
};
if (!Array.isArray(selection.tasks) || selection.tasks.length !== 8)
  throw new Error("selection output is stale: expected eight frozen tasks");
const markdown = readFileSync(tracked[1]!, "utf8");
for (const task of selection.tasks) {
  if (!task.id || !markdown.includes(`\`${task.id}\``))
    throw new Error(
      `calibration task document is stale: missing ${task.id ?? "task id"}`,
    );
}
console.log("generated artifacts are present and structurally fresh");
