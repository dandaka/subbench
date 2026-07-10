export type UsageProvider = "codex" | "zai" | "claude";
export type UsageAuthority =
  | "server"
  | "official-client"
  | "display"
  | "local-reconstruction";
export type UsagePrecision =
  | "exact"
  | "decimal"
  | "integer-percent"
  | "unknown";
export type UsageWindowKind =
  | "session"
  | "weekly"
  | "monthly"
  | "mcp"
  | "unknown";

export interface UsageWindow {
  kind: UsageWindowKind;
  usedPercent: number;
  resetsAt: string | null;
  durationMinutes?: number | null;
  providerType?: string;
  providerUnit?: number | null;
}

export interface UsageSnapshot {
  schemaVersion: 1;
  provider: UsageProvider;
  account: { plan: string | null; idHash: string | null };
  capturedAt: string;
  collector: {
    name: string;
    version: string;
    authority: UsageAuthority;
    precision: UsagePrecision;
    cached: boolean;
  };
  source: { endpoint: string; requestedAt: string; respondedAt: string };
  windows: UsageWindow[];
  raw: unknown;
}

export class UsageError extends Error {
  constructor(
    public readonly category:
      | "authentication"
      | "rate-limited"
      | "invalid-response"
      | "missing-window"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "UsageError";
  }
}

export function validateSnapshot(snapshot: UsageSnapshot): UsageSnapshot {
  if (
    snapshot.schemaVersion !== 1 ||
    !snapshot.provider ||
    !snapshot.capturedAt
  ) {
    throw new UsageError(
      "invalid-response",
      "Malformed usage snapshot metadata",
    );
  }
  if (!Number.isFinite(Date.parse(snapshot.capturedAt))) {
    throw new UsageError(
      "invalid-response",
      "Malformed usage capture timestamp",
    );
  }
  if (snapshot.windows.length === 0) {
    throw new UsageError(
      "missing-window",
      `${snapshot.provider} reported no usage windows`,
    );
  }
  for (const window of snapshot.windows) {
    if (
      !Number.isFinite(window.usedPercent) ||
      window.usedPercent < 0 ||
      window.usedPercent > 100
    ) {
      throw new UsageError(
        "invalid-response",
        `Invalid ${window.kind} used percentage`,
      );
    }
    if (
      window.resetsAt !== null &&
      !Number.isFinite(Date.parse(window.resetsAt))
    ) {
      throw new UsageError(
        "invalid-response",
        `Invalid ${window.kind} reset timestamp`,
      );
    }
  }
  return snapshot;
}

export function selectWindow(
  snapshot: UsageSnapshot,
  kind: UsageWindowKind,
): UsageWindow {
  const window = snapshot.windows.find((candidate) => candidate.kind === kind);
  if (!window)
    throw new UsageError(
      "missing-window",
      `${snapshot.provider} did not report a ${kind} usage window`,
    );
  return window;
}

export function renderUsage(
  snapshot: UsageSnapshot,
  kind: UsageWindowKind,
  format: "json" | "numeric",
): string {
  const window = selectWindow(snapshot, kind);
  return format === "numeric"
    ? String(window.usedPercent)
    : JSON.stringify(snapshot, null, 2);
}
