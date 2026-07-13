# Handoff: implement the pass-through logging proxy (token-mix capture)

You are working in `~/projects/subbench` — a project that benchmarks how much real
developer work AI coding subscriptions buy per dollar. Before writing any code, read:

- `docs/protocol.md` — measurement protocol (§2 isolation check, §4 calibration)
- `docs/methodology.md` — sections: Harness Isolation (instrumentation exception),
  ToS Position (proxy-only extension, 2026-07-13), Data Schema (run fields)
- `docs/cache-weighting-experiment.md` §4 — the proxy-capture regression route this
  proxy exists to serve
- `docs/research.md` — "Systima" entry describing the MIT reference implementation
  (`rig/proxy.mjs` at github.com/systima-ai/agentic-coding-tools-comparison)
- `docs/log.md` — 2026-07-13 entries recording what was approved

## Goal

Build a local **pass-through logging proxy** that Claude Code talks to via
`ANTHROPIC_BASE_URL`, so every calibration run captures the exact per-request token
mix (cold input / cache write / cache read / output) alongside the rounded quota
drain we already record. This is the approved route to the cache-weighting pivot
question.

## Authorized scope — hard boundaries

- **Pass-through only.** Forward requests to `https://api.anthropic.com` byte-identical
  (method, path, headers incl. auth, body). Return responses unmodified, including
  SSE streams. The proxy must add zero tokens and alter nothing.
- **Do NOT implement** any gateway/bridge that rewrites requests or repurposes
  subscription auth for non-native clients (Meridian-style). Explicitly not approved.
- **Raw captures are private.** They embed Anthropic system prompts. The captures
  directory must be gitignored from the first commit. Only aggregates may ever be
  published.

## Requirements

1. **Proxy server** (TypeScript, run with `bun`): listens locally, forwards to
   upstream, streams responses through untouched.
2. **Per-request capture**, one JSON file per request: timestamp, request path,
   full request payload, response status, the API `usage` block
   (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`,
   `output_tokens`), and the **served model** from the response. For SSE responses,
   parse `message_start` / `message_delta` events for usage and model while passing
   bytes through unaltered.
3. **Pass-through verification command**: sends a bare one-line request through the
   proxy and directly, and asserts the forwarded payload is byte-identical and the
   envelope constant is 0. Protocol requires running this before first measured use;
   make it a one-command check and have it write its evidence to a file.
4. **Aggregation script**: rolls captures up per run/batch — token-mix totals,
   request count, cache-write events over a threshold (mid-session prefix re-writes),
   distinct served models. Output JSON suitable for joining against run records.
5. **Run-record integration**: the schema now includes `served model`,
   `logging proxy present (version; pass-through verified)`, `subagent fan-out
   observed`, and `pause events`. Wire whatever run-recording tooling exists
   (`subbench run` — find it in the repo) to accept/store these; if the harness
   doesn't exist in code yet, deliver the proxy standalone and document the join key
   (run timestamps).
6. **Version stamping**: the proxy reports its own version; every capture embeds it
   (protocol requires pinning it per run).

## How to work

- Follow the repo's engineering conventions and the superpowers skills
  (brainstorming before design if scope is unclear, red/green TDD, verification
  before completion). Tests with `bun test`; TypeScript throughout; `bun` as the
  only package manager.
- The Systima `rig/proxy.mjs` (~200 lines, same repo as above) is a working
  reference for capture shape and SSE handling — adapt ideas, write our own code.
- **Do not run any measured calibration through the proxy** as part of this task.
  Building and verifying the proxy is code work; any measured run is a separate
  protocol §2-attested event. Verification requests (item 3) use trivial one-line
  prompts and should note their (tiny) quota cost.
- When done: record the change in `docs/log.md` (date, summary, artifacts) and add a
  short operator how-to (start proxy, point Claude Code at it, verify, aggregate) —
  either a new `docs/` runbook or a section in
  `docs/running-claude-max-calibration.md`.

## Acceptance criteria

- Claude Code works normally through the proxy (a manual smoke session behaves
  identically to a direct one).
- Every request produces a capture with a complete usage block and served model,
  including streaming responses.
- Verification command proves byte-identical forwarding and zero envelope, and
  persists that evidence.
- Captures dir is gitignored; nothing sensitive is committed.
- Aggregation produces per-batch token mixes ready for the drain regression in
  `docs/cache-weighting-experiment.md` §4.
- Tests pass; `docs/log.md` updated; operator runbook section written.
