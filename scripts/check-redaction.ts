#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { Glob } from "bun";

const allowed = new Set(["scripts/check-redaction.ts"]);
const secret =
  /(?:sk-[A-Za-z0-9_-]{16,}|AIza[\w-]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/;
for (const path of new Glob(
  "{packages,scripts,examples,data,docs}/**/*",
).scanSync(".")) {
  // Locally archived benchmark source is deliberately untracked (and may contain
  // upstream fixture strings that resemble credentials); scan only project artifacts.
  if (/^data\/deepswe-v1\.1-\d{4}-\d{2}-\d{2}\/(artifacts|source)\//.test(path))
    continue;
  if (allowed.has(path)) continue;
  try {
    if (secret.test(readFileSync(path, "utf8")))
      throw new Error(`possible credential in tracked artifact: ${path}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("possible credential")
    )
      throw error;
  }
}
console.log("redaction scan passed");
