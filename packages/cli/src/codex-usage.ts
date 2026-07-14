interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

interface RateLimitSnapshot {
  planType: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
}

export interface CodexUsage {
  plan: string | null;
  session: RateLimitWindow | null;
  weekly: RateLimitWindow | null;
}

interface RpcMessage {
  id?: number;
  result?: { rateLimits?: RateLimitSnapshot };
  error?: { message?: string };
}

import type { UsageSnapshot } from "./usage.ts";
import { validateSnapshot } from "./usage.ts";

export function usageFromResponse(message: RpcMessage): CodexUsage {
  if (message.error)
    throw new Error(message.error.message ?? "Codex app-server request failed");
  const limits = message.result?.rateLimits;
  if (!limits) throw new Error("Codex app-server returned no rate limits");
  // Classify windows by duration, not position: OpenAI consolidated to a
  // single primary window (10080 min = 7 days) with secondary null.
  const classify = (
    w: RateLimitWindow | null,
  ): "session" | "weekly" | null => {
    if (!w) return null;
    if (w.windowDurationMins != null && w.windowDurationMins >= 10080)
      return "weekly";
    return "session";
  };
  const primaryKind = classify(limits.primary);
  const secondaryKind = classify(limits.secondary);
  return {
    plan: limits.planType,
    session:
      primaryKind === "session"
        ? limits.primary
        : secondaryKind === "session"
          ? limits.secondary
          : null,
    weekly:
      primaryKind === "weekly"
        ? limits.primary
        : secondaryKind === "weekly"
          ? limits.secondary
          : null,
  };
}

export async function readCodexUsage(): Promise<CodexUsage> {
  const child = Bun.spawn(["codex", "app-server", "--stdio"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const writer = child.stdin;
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const send = (message: object) =>
    writer.write(`${JSON.stringify(message)}\n`);
  send({
    id: 1,
    method: "initialize",
    params: {
      clientInfo: { name: "subbench", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    },
  });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line) {
          const message = JSON.parse(line) as RpcMessage;
          if (message.id === 1) {
            send({ method: "initialized", params: {} });
            send({ id: 2, method: "account/rateLimits/read", params: null });
          } else if (message.id === 2) {
            return usageFromResponse(message);
          }
        }
        newline = buffered.indexOf("\n");
      }
    }
    const stderr = await new Response(child.stderr).text();
    throw new Error(
      `Codex app-server closed before replying${stderr ? `: ${stderr.trim()}` : ""}`,
    );
  } finally {
    child.kill();
    writer.end();
  }
}

export function codexSnapshotFromResponse(
  message: RpcMessage,
  requestedAt = new Date().toISOString(),
  respondedAt = new Date().toISOString(),
): UsageSnapshot {
  const usage = usageFromResponse(message);
  const toWindow = (
    kind: "session" | "weekly",
    window: RateLimitWindow | null,
  ) =>
    window && {
      kind,
      usedPercent: window.usedPercent,
      durationMinutes: window.windowDurationMins,
      resetsAt:
        window.resetsAt === null
          ? null
          : new Date(window.resetsAt * 1000).toISOString(),
    };
  return validateSnapshot({
    schemaVersion: 1,
    provider: "codex",
    account: { plan: usage.plan, idHash: null },
    capturedAt: respondedAt,
    collector: {
      name: "codex-app-server",
      version: "0.1.0",
      authority: "official-client",
      // The app-server rate-limit endpoint serves primary/secondary
      // usedPercent as whole integers (methodology grade "rounded");
      // confirmed across all persisted openai-plus.db payloads
      // (14/34/81 primary, 2/5/13 secondary — never fractional).
      precision: "integer-percent",
      cached: false,
    },
    source: {
      endpoint: "account/rateLimits/read",
      requestedAt,
      respondedAt,
    },
    windows: [
      toWindow("session", usage.session),
      toWindow("weekly", usage.weekly),
    ].filter((window) => window !== null),
    raw: message.result?.rateLimits ?? null,
  });
}

export async function readCodexUsageSnapshot(): Promise<UsageSnapshot> {
  const requestedAt = new Date().toISOString();
  const child = Bun.spawn(["codex", "app-server", "--stdio"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const writer = child.stdin;
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const send = (message: object) =>
    writer.write(`${JSON.stringify(message)}\n`);
  send({
    id: 1,
    method: "initialize",
    params: {
      clientInfo: { name: "subbench", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    },
  });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line) {
          const message = JSON.parse(line) as RpcMessage;
          if (message.id === 1) {
            send({ method: "initialized", params: {} });
            send({ id: 2, method: "account/rateLimits/read", params: null });
          } else if (message.id === 2) {
            return codexSnapshotFromResponse(
              message,
              requestedAt,
              new Date().toISOString(),
            );
          }
        }
        newline = buffered.indexOf("\n");
      }
    }
    throw new Error("Codex app-server closed before replying");
  } finally {
    child.kill();
    writer.end();
  }
}
