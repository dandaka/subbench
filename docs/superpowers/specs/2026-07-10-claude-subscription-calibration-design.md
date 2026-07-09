# Claude subscription calibration — design

Date: 2026-07-10
Status: approved, pre-implementation

## Goal

Add an Anthropic Claude subscription (Max plan) as a calibration provider,
alongside the existing Codex and Z.ai providers, so DeepSWE tasks can be run
through Claude Code against the subscription and the per-task quota drain
measured.

The measurement target is the same as for Z.ai: **subscription economics** —
how much of the plan's quota a real coding task consumes — not model
correctness. A failing task is still a valid observation as long as the agent
and verifier both produced valid results and no quota reset occurred mid-run.

## Approach: reuse ClaudeBar 1:1

The collector reproduces the protocol used by ClaudeBar
(`github.com/tddworks/ClaudeBar`, MIT), reimplemented in TypeScript from the
observed protocol (endpoints, headers, field names — facts, not copied source
text). ClaudeBar is attributed in a source comment.

Observed working behaviour in ClaudeBar de-risks the endpoint's documented
rate-limiting: 429s are real but handled with a cache + `Retry-After`, and in
practice the data updates without trouble.

## Components

All four mirror an existing Z.ai sibling.

### 1. UsageProvider gains `"claude"`

`packages/cli/src/usage.ts` — add `"claude"` to the `UsageProvider` union. The
existing `UsageSnapshot` / `UsageWindow` / `selectWindow` contract already fits.
Window mapping: `five_hour` → existing `session` kind, `seven_day` → existing
`weekly` kind. `index.ts` usage subcommand and `--usage-provider` accept
`claude`.

### 2. Collector: `packages/cli/src/claude-usage.ts`

Sibling of `zai-usage.ts`.

**Credential source** (in order):
1. `~/.claude/.credentials.json` → `claudeAiOauth.accessToken`
   (also `refreshToken`, `expiresAt` ms-epoch, `subscriptionType`)
2. macOS Keychain service `"Claude Code-credentials"` (same JSON shape)
3. `CLAUDE_CODE_OAUTH_TOKEN` env (inference-only fallback)

If `expiresAt` is within 5 minutes of now, refresh via
`POST https://platform.claude.com/v1/oauth/token` before the usage read.

**Request:**
```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <token>
Accept: application/json
Content-Type: application/json
anthropic-beta: oauth-2025-04-20      # required; without it → 401
User-Agent: ClaudeBar
```

**Response parsing** (`utilization` is percent-used, maps directly to
`usedPercent`):
- `five_hour.utilization` → session window, `resets_at`
- `seven_day.utilization` → weekly window, `resets_at`
- `seven_day_opus` / `seven_day_sonnet` / newer `limits[]` array →
  `unknown` kind, retained in `raw` (not gated on)
- `extra_usage` credits → retained in `raw`

**Metadata:** `authority: "server"`, `precision: "decimal"`, `cached: false`.
`account.plan` from `subscriptionType` (`claude_max`/`max` → the Max plan).
`account.idHash` = sha256 of the token, first 16 hex chars. Token is never
logged or persisted; only the hash.

**Rate limiting:** 401/403 → `UsageError("authentication")`. 429 → parse
`Retry-After` (reject a literal `0` per ClaudeBar's observed bug; fall back to a
5-minute default), surface as `UsageError("rate-limited")`. No snapshot cache —
post-reads must always be fresh so task drain is never hidden.

### 3. Probe: `scripts/probe-claude-usage.ts`

Confirmation step, run once before building the runner. Reads the real OAuth
token locally, issues one GET, prints parsed windows + `subscriptionType`.
Read-only, negligible quota impact. Confirms auth (the `anthropic-beta` header)
and response shape against the actual Max login.

### 4. Pier adapter: `scripts/pier_claude_subscription.py`

Sibling of `pier_zai_subscription.py`. Same Node-distribution `ClaudeCode`
install (needed for x86 Docker on Apple Silicon). Uses the native OAuth login;
no base-URL override.

### 5. Runner: `scripts/run-claude-deepswe-calibration.ts` + `calibrate:claude`

Sibling of `run-zai-deepswe-calibration.ts`.

- Separate DB `claude-max.db`, own study bundle
  `examples/claude-max-deepswe-v1.1.json`.
- Task selection: unmeasured-first, `--task` override.
- **Plan guard:** refuse unless `subscriptionType` resolves to the Max plan.
- **Session guard:** refuse launch if the session (`five_hour`) window ≥ 70%.
- **Pre-read** before the task.
- **Post-read with retry + backoff** (the one behavioural difference from the
  Z.ai runner): on 429/failed post-read, retry with backoff up to a bounded
  window (~15 min, comfortably inside a ~50-min task's slack). Record only once
  a fresh post-read succeeds. If retries are exhausted → throw, no DB row
  (invalid run, never a bad record).
- Harness validity gates identical to Z.ai: require `agent_execution.started_at`,
  `agent_result`, and `verifier_result`; otherwise no record.
- Persist immutable pre/post snapshots linked to the run.

## Data flow

```
pre-read → plan+session guards → pier run (Docker, ~50 min)
  → post-read (retry+backoff) → validity gates → record run + pre/post snapshots
```

## Out of scope (YAGNI)

- `/usage` terminal-scrape fallback (retry+backoff chosen instead of coarse
  recording).
- Model-scoped quota gating (`seven_day_opus` etc.) — kept in `raw` only.
- Monthly window unless the endpoint surfaces one.

## Testing

- Unit tests for the collector parser: fixture responses → snapshot, mirroring
  the existing Z.ai tests. Cover five_hour/seven_day mapping, missing-field
  handling, 429 → rate-limited, 401 → auth error, `Retry-After: 0` rejection.
- The probe is the integration confirmation of auth + shape.
- `bun run check` and all existing tests stay green.

## Build order

1. Collector + parser + unit tests.
2. Probe script → run it, read results (confirm auth + shape).
3. Pier adapter + runner + `calibrate:claude`.
4. Isolation-confirmed overnight run (separate Codex agent, off-hours).

## Isolation

Per protocol §2: the Max account must be isolated during the run. Plan: run
overnight when the user is not working, driving Claude Code from a separate
Codex agent so this benchmark is the only consumer of the Max subscription.
Confirmation recorded before each run.

## Attribution / licensing

ClaudeBar is MIT (`github.com/tddworks/ClaudeBar`). The collector is a
clean-room TypeScript reimplementation of the observed wire protocol, with
ClaudeBar credited in a comment. No Swift source text is copied.
