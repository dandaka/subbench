import { createHash } from "node:crypto";
import type { UsageSnapshot, UsageWindow, UsageWindowKind } from "./usage.ts";
import { UsageError, validateSnapshot } from "./usage.ts";

const HOSTS = new Set(["api.z.ai", "open.bigmodel.cn", "dev.bigmodel.cn"]);

type JsonObject = Record<string, unknown>;

function records(payload: JsonObject): JsonObject[] {
  const candidates = [
    payload.data,
    (payload.data as JsonObject | undefined)?.limits,
    (payload.data as JsonObject | undefined)?.list,
    payload.limits,
  ];
  for (const value of candidates) if (Array.isArray(value)) return value as JsonObject[];
  throw new UsageError("invalid-response", "Z.ai response contained no quota records");
}

function kind(type: unknown, unit: unknown): UsageWindowKind {
  if (type === "TIME_LIMIT") return "mcp";
  if (type !== "TOKENS_LIMIT") return "unknown";
  if (unit === 3) return "session";
  if (unit === 6) return "weekly";
  if (unit === 7) return "monthly";
  return "unknown";
}

function timestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) throw new UsageError("invalid-response", "Invalid Z.ai reset timestamp");
  return new Date(parsed).toISOString();
}

function percentage(row: JsonObject): number {
  for (const key of ["usedPercent", "usagePercent", "percentage", "percent"]) {
    if (typeof row[key] === "number") return row[key] as number;
  }
  const current = row.currentValue ?? row.current ?? row.used;
  const limit = row.limitValue ?? row.limit ?? row.total;
  if (typeof current === "number" && typeof limit === "number" && limit > 0) {
    return current / limit * 100;
  }
  throw new UsageError("invalid-response", "Z.ai quota record contained no utilization");
}

export function zaiSnapshotFromResponse(
  payload: JsonObject,
  metadata: { requestedAt?: string; respondedAt?: string; endpoint?: string; idHash?: string | null } = {},
): UsageSnapshot {
  const respondedAt = metadata.respondedAt ?? new Date().toISOString();
  const windows: UsageWindow[] = records(payload).map((row) => {
    const unit = typeof row.unit === "number" ? row.unit : null;
    return {
      kind: kind(row.type, unit),
      usedPercent: percentage(row),
      resetsAt: timestamp(row.nextResetTime ?? row.resetTime ?? row.resetsAt),
      providerType: typeof row.type === "string" ? row.type : "unknown",
      providerUnit: unit,
    };
  });
  return validateSnapshot({
    schemaVersion: 1,
    provider: "zai",
    account: { plan: null, idHash: metadata.idHash ?? null },
    capturedAt: respondedAt,
    collector: {
      name: "zai-quota-api", version: "0.1.0", authority: "server",
      precision: "decimal", cached: false,
    },
    source: {
      endpoint: metadata.endpoint ?? "https://api.z.ai/api/monitor/usage/quota/limit",
      requestedAt: metadata.requestedAt ?? respondedAt,
      respondedAt,
    },
    windows,
    raw: payload,
  });
}

export async function readZaiUsageSnapshot(): Promise<UsageSnapshot> {
  const token = process.env.ZAI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) throw new UsageError("authentication", "Set ZAI_API_KEY or ANTHROPIC_AUTH_TOKEN");
  const configured = process.env.ZAI_BASE_URL ?? process.env.ANTHROPIC_BASE_URL ?? "https://api.z.ai";
  const base = new URL(configured);
  if (!HOSTS.has(base.hostname) || base.protocol !== "https:") {
    throw new UsageError("authentication", `Z.ai host is not allowed: ${base.hostname}`);
  }
  const endpoint = new URL("/api/monitor/usage/quota/limit", base).toString();
  const requestedAt = new Date().toISOString();
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new UsageError("network", "Could not reach the Z.ai quota endpoint");
  }
  if (response.status === 401 || response.status === 403) {
    throw new UsageError("authentication", "Z.ai rejected the configured credential");
  }
  if (response.status === 429) throw new UsageError("rate-limited", "Z.ai quota endpoint is rate limited");
  if (!response.ok) throw new UsageError("network", `Z.ai quota endpoint returned HTTP ${response.status}`);
  const payload = await response.json() as JsonObject;
  const idHash = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return zaiSnapshotFromResponse(payload, {
    endpoint, requestedAt, respondedAt: new Date().toISOString(), idHash,
  });
}
