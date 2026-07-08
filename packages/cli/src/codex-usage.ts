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

export function usageFromResponse(message: RpcMessage): CodexUsage {
  if (message.error) throw new Error(message.error.message ?? "Codex app-server request failed");
  const limits = message.result?.rateLimits;
  if (!limits) throw new Error("Codex app-server returned no rate limits");
  return {
    plan: limits.planType,
    session: limits.primary,
    weekly: limits.secondary,
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
  const send = (message: object) => writer.write(`${JSON.stringify(message)}\n`);
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
    throw new Error(`Codex app-server closed before replying${stderr ? `: ${stderr.trim()}` : ""}`);
  } finally {
    child.kill();
    writer.end();
  }
}
