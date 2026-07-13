// Per-request capture: the exact token mix and served model observed at the API
// boundary, alongside the forwarded request. Pure functions only — no I/O, no globals —
// so the SSE and JSON usage extraction is fully unit-testable. The server (server.ts)
// wires these to real sockets and disk.

import type { RateLimits } from "./ratelimit.ts";
import { PROXY_VERSION } from "./version.ts";

// The Anthropic `usage` block. Absent counters are recorded as 0 (the API omits a field
// when its value is 0 or when the surface — e.g. a token-count call — has no such notion).
export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

export interface CaptureRecord {
  proxy_version: string;
  // ISO 8601, request receipt time. This is the join key against run records
  // (run started_at/ended_at bracket a batch of captures).
  timestamp: string;
  method: string;
  // Path + query as received, e.g. "/v1/messages?beta=true".
  path: string;
  // Full request payload, parsed when JSON, else the raw string. Private: embeds system
  // prompts; captures dir is gitignored.
  request_body: unknown;
  response_status: number;
  streamed: boolean;
  // The model actually served (from the response), which can differ from the pinned
  // request model (protocol §1: served model ≠ pinned model). null if unobservable.
  served_model: string | null;
  usage: TokenUsage;
  // Per-window unified quota reading from the response headers — the crux for pairing a
  // token mix to a quota-window drain (Systima's rig lacked this). null window = not
  // reported on this response.
  rate_limits: RateLimits;
}

const ZERO_USAGE: TokenUsage = {
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function count(source: Record<string, unknown> | null, key: string): number {
  if (!source) return 0;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Normalize any partial usage object into a full TokenUsage, defaulting missing
// counters to 0. Merges onto a base so incremental SSE deltas accumulate correctly.
export function mergeUsage(base: TokenUsage, patch: unknown): TokenUsage {
  const source = asRecord(patch);
  if (!source) return base;
  return {
    // Input and cache counters are established at message_start and not repeated in
    // deltas; keep the base when a delta omits them.
    input_tokens: has(source, "input_tokens")
      ? count(source, "input_tokens")
      : base.input_tokens,
    cache_creation_input_tokens: has(source, "cache_creation_input_tokens")
      ? count(source, "cache_creation_input_tokens")
      : base.cache_creation_input_tokens,
    cache_read_input_tokens: has(source, "cache_read_input_tokens")
      ? count(source, "cache_read_input_tokens")
      : base.cache_read_input_tokens,
    // output_tokens is cumulative in message_delta; take the latest reported value.
    output_tokens: has(source, "output_tokens")
      ? count(source, "output_tokens")
      : base.output_tokens,
  };
}

function has(source: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(source, key) && typeof source[key] === "number";
}

// Extract usage + served model from a non-streaming JSON Messages response body.
export function extractFromJson(body: unknown): {
  usage: TokenUsage;
  served_model: string | null;
} {
  const root = asRecord(body);
  const model = root && typeof root.model === "string" ? root.model : null;
  const usage = mergeUsage({ ...ZERO_USAGE }, root?.usage);
  return { usage, served_model: model };
}

// Incrementally accumulates usage + served model from Anthropic SSE events. Feed each
// decoded `data:` JSON object via `event()`. Anthropic reports the input/cache counts on
// `message_start` (message.usage) and the running output count on `message_delta`
// (usage.output_tokens); the served model is on `message_start` (message.model).
export class SseUsageAccumulator {
  usage: TokenUsage = { ...ZERO_USAGE };
  servedModel: string | null = null;

  event(data: unknown): void {
    const root = asRecord(data);
    if (!root) return;
    const type = root.type;
    if (type === "message_start") {
      const message = asRecord(root.message);
      if (message) {
        if (typeof message.model === "string") this.servedModel = message.model;
        this.usage = mergeUsage(this.usage, message.usage);
      }
      return;
    }
    if (type === "message_delta") {
      this.usage = mergeUsage(this.usage, root.usage);
    }
  }
}

// Parse the `data:` payloads out of a (possibly partial) SSE text chunk. Returns the
// decoded JSON objects and the leftover tail that did not end in a blank-line boundary,
// so a caller streaming byte chunks can carry the remainder forward. Passing bytes
// through to the client is the server's job; this only *reads* a copy.
export function parseSseChunk(buffer: string): {
  events: unknown[];
  rest: string;
} {
  const events: unknown[] = [];
  // SSE events are separated by a blank line. Split on the last boundary; keep the tail.
  let working = buffer;
  const boundary = /\r?\n\r?\n/;
  let match = boundary.exec(working);
  while (match) {
    const block = working.slice(0, match.index);
    working = working.slice(match.index + match[0].length);
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        events.push(JSON.parse(payload));
      } catch {
        // A split mid-JSON should not happen once we only parse complete blocks, but be
        // defensive: skip unparseable payloads rather than throwing in the hot path.
      }
    }
    match = boundary.exec(working);
  }
  return { events, rest: working };
}

export function newCapture(fields: {
  timestamp: string;
  method: string;
  path: string;
  request_body: unknown;
  response_status: number;
  streamed: boolean;
  served_model: string | null;
  usage: TokenUsage;
  rate_limits: RateLimits;
}): CaptureRecord {
  return { proxy_version: PROXY_VERSION, ...fields };
}
