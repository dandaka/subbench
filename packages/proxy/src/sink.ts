// Lossless capture sink: persists one JSONL line per capture AND appends the capture to a
// SHA-256 hash-chained audit log, under backpressure, without ever dropping a record.
//
// This is the key addition over claude-meter, whose async tee silently drops on
// backpressure (research.md → API-Boundary Metering Proxies). We guarantee losslessness by
// serializing every write onto a single append queue: a new write chains onto the tail of
// the previous one, so appends never interleave and every awaited write is durable before
// close() resolves.

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type AuditEntry, appendToChain } from "./audit.ts";
import type { CaptureRecord } from "./capture.ts";

export class CaptureSink {
  private readonly capturesPath: string;
  private readonly auditPath: string;
  private ready: Promise<void>;
  // The tail of the serialized append queue. Every write awaits it, then becomes the new
  // tail — so N concurrent write() calls execute strictly one after another.
  private queue: Promise<void> = Promise.resolve();
  private chain: AuditEntry[] = [];

  constructor(dir: string) {
    this.capturesPath = join(dir, "captures.jsonl");
    this.auditPath = join(dir, "audit.jsonl");
    this.ready = mkdir(dir, { recursive: true }).then(() => undefined);
  }

  // Persist one capture. Resolves only once both the JSONL line and its audit entry are
  // durably appended. Safe to call without awaiting between calls (writes serialize).
  write(record: CaptureRecord): Promise<void> {
    const task = this.queue.then(async () => {
      await this.ready;
      this.chain = await appendToChain(this.chain, record);
      const entry = this.chain.at(-1)!;
      await Promise.all([
        appendLine(this.capturesPath, JSON.stringify(record)),
        appendLine(this.auditPath, JSON.stringify(entry)),
      ]);
    });
    // Keep the queue alive even if one write rejects, so a single failure cannot wedge the
    // chain; the returned promise still surfaces the error to the caller.
    this.queue = task.catch(() => undefined);
    return task;
  }

  // Drain the queue so all in-flight writes are flushed before the process exits.
  async close(): Promise<void> {
    await this.queue;
  }
}

// Append a single line (with trailing newline) to a file, creating it if absent. Each call
// is awaited inside the serialized queue, so lines never interleave.
async function appendLine(path: string, line: string): Promise<void> {
  await appendFile(path, `${line}\n`);
}
