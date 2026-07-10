// Anthropic Claude subscription usage collector.
//
// Reimplements, in TypeScript from the observed wire protocol, the Anthropic
// OAuth usage approach used by ClaudeBar (github.com/tddworks/ClaudeBar, MIT).
// No source text is copied; endpoints, headers, and field names are facts.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { UsageSnapshot, UsageWindow } from "./usage.ts";
import { UsageError, validateSnapshot } from "./usage.ts";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const KEYCHAIN_SERVICE = "Claude Code-credentials";

// Required beta header; the endpoint returns 401 without it.
const ANTHROPIC_BETA = "oauth-2025-04-20";

type JsonObject = Record<string, unknown>;

export interface ClaudeCredential {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null; // milliseconds since epoch
  subscriptionType: string | null;
}

function parseCredentialBlob(raw: string): ClaudeCredential | null {
  let json: JsonObject;
  try {
    json = JSON.parse(raw) as JsonObject;
  } catch {
    return null;
  }
  const oauth = json.claudeAiOauth as JsonObject | undefined;
  if (!oauth) return null;
  const accessToken =
    typeof oauth.accessToken === "string" ? oauth.accessToken.trim() : "";
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken:
      typeof oauth.refreshToken === "string" ? oauth.refreshToken : null,
    expiresAt: typeof oauth.expiresAt === "number" ? oauth.expiresAt : null,
    subscriptionType:
      typeof oauth.subscriptionType === "string"
        ? oauth.subscriptionType
        : null,
  };
}

// Reads the Claude Code OAuth credential. Order matches ClaudeBar:
//   1. ~/.claude/.credentials.json
//   2. macOS Keychain service "Claude Code-credentials"
//   3. CLAUDE_CODE_OAUTH_TOKEN env (inference-only fallback)
export function readClaudeCredential(): ClaudeCredential {
  const file = join(homedir(), ".claude", ".credentials.json");
  try {
    const parsed = parseCredentialBlob(readFileSync(file, "utf8"));
    if (parsed) return parsed;
  } catch {
    // fall through to keychain
  }

  if (process.platform === "darwin") {
    try {
      const blob = execFileSync(
        "security",
        ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const parsed = parseCredentialBlob(blob.trim());
      if (parsed) return parsed;
    } catch {
      // fall through to env
    }
  }

  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim();
  if (envToken) {
    return {
      accessToken: envToken,
      refreshToken: null,
      expiresAt: null,
      subscriptionType: null,
    };
  }

  throw new UsageError(
    "authentication",
    "No Claude OAuth credential in ~/.claude/.credentials.json, Keychain, or CLAUDE_CODE_OAUTH_TOKEN",
  );
}

function utilizationWindow(
  record: JsonObject | undefined,
  kind: UsageWindow["kind"],
): UsageWindow | null {
  if (!record) return null;
  const utilization = record.utilization;
  if (typeof utilization !== "number" || !Number.isFinite(utilization))
    return null;
  const resetsAtRaw = record.resets_at;
  let resetsAt: string | null = null;
  if (typeof resetsAtRaw === "string" && resetsAtRaw !== "") {
    const parsed = Date.parse(resetsAtRaw);
    if (!Number.isFinite(parsed)) {
      throw new UsageError(
        "invalid-response",
        `Invalid Claude ${kind} reset timestamp`,
      );
    }
    resetsAt = new Date(parsed).toISOString();
  }
  return { kind, usedPercent: utilization, resetsAt };
}

// Pure parse: usage payload -> provider-neutral snapshot. No IO.
export function claudeSnapshotFromResponse(
  payload: JsonObject,
  metadata: {
    subscriptionType?: string | null;
    idHash?: string | null;
    requestedAt?: string;
    respondedAt?: string;
  } = {},
): UsageSnapshot {
  const respondedAt = metadata.respondedAt ?? new Date().toISOString();
  const windows: UsageWindow[] = [];

  const session = utilizationWindow(
    payload.five_hour as JsonObject | undefined,
    "session",
  );
  if (session) windows.push(session);
  const weekly = utilizationWindow(
    payload.seven_day as JsonObject | undefined,
    "weekly",
  );
  if (weekly) windows.push(weekly);

  return validateSnapshot({
    schemaVersion: 1,
    provider: "claude",
    account: {
      plan: metadata.subscriptionType ?? null,
      idHash: metadata.idHash ?? null,
    },
    capturedAt: respondedAt,
    collector: {
      name: "claude-oauth-usage",
      version: "0.1.0",
      authority: "server",
      precision: "decimal",
      cached: false,
    },
    source: {
      endpoint: USAGE_URL,
      requestedAt: metadata.requestedAt ?? respondedAt,
      respondedAt,
    },
    windows,
    raw: payload,
  });
}

// Parse an HTTP Retry-After value into seconds. Rejects a literal 0 (the
// endpoint has been observed returning `Retry-After: 0` while still 429ing);
// callers apply their own fallback. Returns null for missing/malformed/past.
export function parseRetryAfterSeconds(
  value: string | null,
  now = Date.now(),
): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) return seconds > 0 ? seconds : null;
  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) return null;
  const delta = (dateMs - now) / 1000;
  return delta > 0 ? delta : null;
}

export async function readClaudeUsageSnapshot(): Promise<UsageSnapshot> {
  const credential = readClaudeCredential();
  const requestedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "anthropic-beta": ANTHROPIC_BETA,
        "User-Agent": "subbench",
      },
    });
  } catch {
    throw new UsageError(
      "network",
      "Could not reach the Claude usage endpoint",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new UsageError(
      "authentication",
      "Claude rejected the OAuth credential",
    );
  }
  if (response.status === 429) {
    throw new UsageError(
      "rate-limited",
      "Claude usage endpoint is rate limited",
    );
  }
  if (!response.ok) {
    throw new UsageError(
      "network",
      `Claude usage endpoint returned HTTP ${response.status}`,
    );
  }
  const payload = (await response.json()) as JsonObject;
  const idHash = createHash("sha256")
    .update(credential.accessToken)
    .digest("hex")
    .slice(0, 16);
  return claudeSnapshotFromResponse(payload, {
    subscriptionType: credential.subscriptionType,
    idHash,
    requestedAt,
    respondedAt: new Date().toISOString(),
  });
}
