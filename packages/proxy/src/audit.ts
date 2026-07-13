// SHA-256 hash-chained audit log over capture records, so the measurement evidence chain
// is verifiable end to end. Pattern adapted (not copied) from Systima's MIT-licensed
// `rig/ingest-audit.mjs` (github.com/systima-ai/agentic-coding-tools-comparison), whose
// 273-record July 2026 chain verifies end to end. Our reimplementation is under this
// package's permissive license.
//
// Each entry binds the previous entry's hash to a canonical serialization of the record:
//   hash = SHA-256( prev_hash || canonical_json(record) )
// so any edit to a record body OR any re-link of the chain is detectable. Pure and
// I/O-free — the server persists entries; verification recomputes from the stored chain.

// A fixed, well-known genesis so an empty chain's first link is not attacker-chosen.
export const GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export interface AuditEntry {
  seq: number;
  prev_hash: string;
  hash: string;
  record: unknown;
}

// Deterministic JSON: object keys sorted recursively so semantically identical records
// hash identically regardless of key insertion order. Arrays keep their order (meaningful).
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Compute the hash a given entry must carry for `record` linked after `prevHash`.
export async function linkHash(
  prevHash: string,
  record: unknown,
): Promise<string> {
  return sha256Hex(prevHash + canonicalize(record));
}

// Append one record to the chain, returning a new array (does not mutate the input).
export async function appendToChain(
  chain: AuditEntry[],
  record: unknown,
): Promise<AuditEntry[]> {
  const last = chain.at(-1);
  const prev_hash = last ? last.hash : GENESIS_PREV_HASH;
  const seq = last ? last.seq + 1 : 0;
  const hash = await linkHash(prev_hash, record);
  return [...chain, { seq, prev_hash, hash, record }];
}

export interface VerifyResult {
  valid: boolean;
  length: number;
  // First zero-based index at which the chain fails to verify, when invalid.
  brokenAt?: number;
}

// Walk the chain and recompute every link. Fails on a broken prev-hash link OR a record
// whose stored hash no longer matches its (canonicalized) body.
export async function verifyChain(chain: AuditEntry[]): Promise<VerifyResult> {
  let expectedPrev = GENESIS_PREV_HASH;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    if (entry.prev_hash !== expectedPrev) {
      return { valid: false, length: chain.length, brokenAt: i };
    }
    const recomputed = await linkHash(entry.prev_hash, entry.record);
    if (recomputed !== entry.hash) {
      return { valid: false, length: chain.length, brokenAt: i };
    }
    expectedPrev = entry.hash;
  }
  return { valid: true, length: chain.length };
}

// CLI: `bun src/audit.ts <audit.jsonl>` verifies a stored chain end to end (A5 acceptance).
// Exits non-zero if the chain is broken, naming the first bad link.
if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: bun src/audit.ts <audit.jsonl>");
    process.exit(2);
  }
  const text = (await Bun.file(path).text()).trim();
  const chain: AuditEntry[] = text
    ? text.split("\n").map((line) => JSON.parse(line) as AuditEntry)
    : [];
  const result = await verifyChain(chain);
  if (result.valid) {
    console.error(
      `audit chain OK: ${result.length} records verified end to end`,
    );
  } else {
    console.error(
      `audit chain BROKEN at record ${result.brokenAt} of ${result.length}`,
    );
    process.exit(1);
  }
}
