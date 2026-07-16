#!/usr/bin/env bun
// The listener: a local pass-through proxy that Claude Code points at via
// ANTHROPIC_BASE_URL. It forwards every request unmodified to the upstream Anthropic API,
// streams the response back byte-for-byte, and tees a lossless capture (JSONL + audit
// chain) via CaptureSink. Nothing here alters the request the model sees.
//
// Usage:
//   PROXY_PORT=8788 PROXY_CAPTURES_DIR=./.subbench/captures bun src/server.ts
// then, in the Claude Code environment:
//   ANTHROPIC_BASE_URL=http://127.0.0.1:8788

import { DEFAULT_UPSTREAM, forward } from "./forward.ts";
import { CaptureSink } from "./sink.ts";
import { PROXY_VERSION } from "./version.ts";

export interface ServerOptions {
  port: number;
  upstream: string;
  capturesDir: string;
  hostname?: string;
}

export function startServer(options: ServerOptions): {
  stop: () => Promise<void>;
  port: number;
  url: string;
} {
  const sink = new CaptureSink(options.capturesDir);

  const server = Bun.serve({
    port: options.port,
    hostname: options.hostname ?? "127.0.0.1",
    // No idle timeout cap: long agent streams must not be severed mid-response.
    idleTimeout: 0,
    async fetch(request) {
      const { response, capture } = await forward(request, {
        upstream: options.upstream,
        now: () => new Date(),
      });
      // Persist the capture once the body has fully passed through. Do NOT block the
      // client response on the write — but DO ensure the write is enqueued (losslessly)
      // before we forget the promise, so nothing is dropped.
      capture
        .then((record) => sink.write(record))
        .catch((err) => {
          console.error(`[${PROXY_VERSION}] capture write failed:`, err);
        });
      return response;
    },
  });

  const boundPort = server.port ?? options.port;
  return {
    port: boundPort,
    url: `http://${options.hostname ?? "127.0.0.1"}:${boundPort}`,
    async stop() {
      await server.stop(true);
      await sink.close();
    },
  };
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

if (import.meta.main) {
  const server = startServer({
    port: envInt("PROXY_PORT", 8788),
    upstream: process.env.PROXY_UPSTREAM ?? DEFAULT_UPSTREAM,
    capturesDir: process.env.PROXY_CAPTURES_DIR ?? "./.subbench/proxy-captures",
    ...(process.env.PROXY_HOSTNAME
      ? { hostname: process.env.PROXY_HOSTNAME }
      : {}),
  });
  console.error(
    `[${PROXY_VERSION}] pass-through proxy listening on ${server.url} → ${
      process.env.PROXY_UPSTREAM ?? DEFAULT_UPSTREAM
    }`,
  );
  console.error(`Point Claude Code at it:  ANTHROPIC_BASE_URL=${server.url}`);
}
