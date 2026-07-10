#!/usr/bin/env bun
// Confirmation probe for the Claude subscription usage collector.
//
// Reads the local OAuth credential, issues one live GET to the Anthropic usage
// endpoint, and prints the parsed windows plus subscription type. Read-only;
// negligible quota impact. Run before building the calibration runner to
// confirm auth (the anthropic-beta header) and response shape against the real
// Max login.

import {
  readClaudeCredential,
  readClaudeUsageSnapshot,
} from "../packages/cli/src/claude-usage.ts";
import { UsageError } from "../packages/cli/src/usage.ts";

async function main(): Promise<void> {
  const credential = readClaudeCredential();
  console.log("Credential source resolved.");
  console.log(`  subscriptionType: ${credential.subscriptionType ?? "(none)"}`);
  console.log(`  has refreshToken: ${credential.refreshToken !== null}`);
  console.log(
    `  expiresAt: ${
      credential.expiresAt
        ? new Date(credential.expiresAt).toISOString()
        : "(none)"
    }`,
  );

  const snapshot = await readClaudeUsageSnapshot();
  console.log("\nUsage endpoint responded 200. Parsed snapshot:");
  console.log(`  account.plan:   ${snapshot.account.plan ?? "(null)"}`);
  console.log(`  account.idHash: ${snapshot.account.idHash ?? "(null)"}`);
  console.log(`  precision:      ${snapshot.collector.precision}`);
  console.log(`  capturedAt:     ${snapshot.capturedAt}`);
  console.log("  windows:");
  for (const window of snapshot.windows) {
    console.log(
      `    ${window.kind.padEnd(8)} ${window.usedPercent}%  resets ${window.resetsAt ?? "(none)"}`,
    );
  }

  const rawKeys = Object.keys(snapshot.raw as Record<string, unknown>);
  console.log(`\n  raw response keys: ${rawKeys.join(", ")}`);
}

main().catch((error) => {
  if (error instanceof UsageError) {
    console.error(`Probe failed (${error.category}): ${error.message}`);
  } else {
    console.error(
      `Probe failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  process.exitCode = 1;
});
