# Operator runbook: the pass-through capture proxy

The rig lives in `packages/proxy/` (`@subbench/proxy`). It is a local, zero-envelope
pass-through proxy that Claude Code points at via `ANTHROPIC_BASE_URL`. It forwards every
request unmodified to `api.anthropic.com`, streams the response back byte-for-byte, and
tees a **lossless** capture (JSONL + a SHA-256 hash-chained audit log) of the token mix,
served model, and the `anthropic-ratelimit-unified-5h/-7d` quota headers.

Read before use: [cache-weighting-rig-task.md](cache-weighting-rig-task.md) (build spec,
Part A/B), [methodology.md](methodology.md) → Harness Isolation (the instrumentation
exception that permits this proxy) and ToS Position (pass-through only; **no** gateway or
subscription-auth bridging), and [protocol.md](protocol.md) §1/§2/§4.

**Hard boundaries.** Pass-through only. Raw captures embed Anthropic system prompts — they
are private and gitignored (`.subbench/`, `**/proxy-captures/`, `*.capture.json`); only
aggregates may publish. Running a measured batch through the proxy is still a calibration
run: it needs the protocol §2 isolation attestation and the §1 subscription-meter check.

## 1. Start the proxy

```bash
PROXY_PORT=8788 \
PROXY_CAPTURES_DIR=./.subbench/proxy-captures \
bun packages/proxy/src/server.ts
```

It prints the listen URL and the line to copy. Leave it running in its own terminal.
`PROXY_UPSTREAM` overrides the upstream origin (default `https://api.anthropic.com`);
only change it for tests.

## 2. Point Claude Code at it

In the (isolated) Claude Code environment for the run:

```bash
ANTHROPIC_BASE_URL=http://127.0.0.1:8788
```

The proxy alters nothing the model sees; it only reads a copy of the traffic in passing.

## 3. Verify the envelope BEFORE the run counts (A5)

With the proxy running, prove it is a true zero-envelope pass-through and persist the
evidence. This costs one trivial one-line request (negligible quota):

```bash
PROXY_URL=http://127.0.0.1:8788 \
PROXY_CAPTURES_DIR=./.subbench/proxy-captures \
ENVELOPE_EVIDENCE_PATH=./.subbench/proxy-captures/envelope-verification.json \
bun packages/proxy/src/verify.ts
```

A PASS requires `byte_identical=true` **and** `GATEWAY_ENVELOPE_TOKENS=0` (exit 0). Record
the evidence file's `proxy_version` + result in the run's `logging proxy present
(version; pass-through verified)` field (methodology → Data Schema). A FAIL (exit 1)
invalidates any run made through this proxy — do not proceed.

## 4. Run the batch

Run the protocol §4 batch as usual, with `ANTHROPIC_BASE_URL` pointed at the proxy. Every
request is captured to `captures.jsonl` and chained into `audit.jsonl` losslessly (writes
are serialized; nothing is dropped under load).

## 5. After the batch: verify the chain and aggregate

Verify the audit chain end to end (A5) and roll the captures up to a run-joinable summary:

```bash
bun packages/proxy/src/audit.ts     ./.subbench/proxy-captures/audit.jsonl
bun packages/proxy/src/aggregate.ts ./.subbench/proxy-captures/captures.jsonl \
  > ./.subbench/proxy-captures/aggregate.json
```

`audit.ts` exits non-zero and names the first broken record if the chain fails.
`aggregate.ts` emits: `request_count`, `started_at`/`ended_at` (bracket for joining to the
run record by timestamp), `token_totals` (the four token classes), `large_cache_write_events`
(mid-session full-prefix re-writes — a large drain-variance source), `served_models`
(catches silent tier substitution, protocol §1), and per-window `utilization_series`.

Join `aggregate.json` to the run record by the `started_at`/`ended_at` bracket. Publish the
aggregate only; keep `captures.jsonl` private.

## What is NOT a valid capture run

- envelope check absent or failing (`GATEWAY_ENVELOPE_TOKENS ≠ 0`, or not byte-identical),
- a broken audit chain,
- no protocol §2 isolation attestation, or an unverified meter (protocol §1),
- captures mixed into a baseline calibration rather than quarantined under their own
  `measurement_id`.
