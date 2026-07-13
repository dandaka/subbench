import { describe, expect, test } from "bun:test";
import {
  type AuditEntry,
  appendToChain,
  GENESIS_PREV_HASH,
  verifyChain,
} from "../src/audit.ts";

function rec(id: number): Record<string, unknown> {
  return { capture_id: id, usage: { input_tokens: id * 10 } };
}

describe("appendToChain", () => {
  test("genesis entry chains from the fixed genesis hash", async () => {
    const chain = await appendToChain([], rec(1));
    expect(chain).toHaveLength(1);
    expect(chain[0]!.seq).toBe(0);
    expect(chain[0]!.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(chain[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("each subsequent entry links to the previous entry's hash", async () => {
    let chain: AuditEntry[] = [];
    chain = await appendToChain(chain, rec(1));
    chain = await appendToChain(chain, rec(2));
    expect(chain[1]!.seq).toBe(1);
    expect(chain[1]!.prev_hash).toBe(chain[0]!.hash);
    expect(chain[1]!.hash).not.toBe(chain[0]!.hash);
  });

  test("the same record content produces a deterministic hash regardless of key order", async () => {
    const a = await appendToChain([], { b: 2, a: 1 });
    const b = await appendToChain([], { a: 1, b: 2 });
    expect(a[0]!.hash).toBe(b[0]!.hash);
  });
});

describe("verifyChain", () => {
  test("verifies an intact multi-record chain end to end", async () => {
    let chain: AuditEntry[] = [];
    for (let i = 1; i <= 5; i++) chain = await appendToChain(chain, rec(i));
    expect(await verifyChain(chain)).toEqual({ valid: true, length: 5 });
  });

  test("verifies the empty chain", async () => {
    expect(await verifyChain([])).toEqual({ valid: true, length: 0 });
  });

  test("detects a tampered record body", async () => {
    let chain: AuditEntry[] = [];
    for (let i = 1; i <= 3; i++) chain = await appendToChain(chain, rec(i));
    const tampered = structuredClone(chain);
    (tampered[1]!.record as { capture_id: number }).capture_id = 999;
    const result = await verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  test("detects a broken prev-hash link", async () => {
    let chain: AuditEntry[] = [];
    for (let i = 1; i <= 3; i++) chain = await appendToChain(chain, rec(i));
    const tampered = structuredClone(chain);
    tampered[2]!.prev_hash = "0".repeat(64);
    const result = await verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });
});
