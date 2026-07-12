# Project log

This log records durable changes and decisions that affect future work. It is not a
measurement run log and does not establish publication evidence.

## 2026-07-12 — ClaudeBar is not a Z.ai usage reference here

- ClaudeBar's Z.ai probe is indirect: it reads a z.ai endpoint from `~/.claude/settings.json`
  (the Claude-Code `ANTHROPIC_BASE_URL`→z.ai override). This machine has no such entry, so
  the probe fails on every tick (`Zai probe failed: No z.ai endpoint found in Claude config`,
  latest 2026-07-12T00:41Z in `~/Library/Logs/ClaudeBar/ClaudeBar.log`). Do not treat
  ClaudeBar as a working Z.ai cross-check reference.
- Authoritative Z.ai path is our own `packages/cli/src/zai-usage.ts`: direct
  `GET https://api.z.ai/api/monitor/usage/quota/limit` with `Authorization: Bearer
  $ZAI_AUTH_TOKEN`, parsing windows by `unit` (3=session, 6=weekly, 7=monthly) plus MCP.
- §5 cross-check done against the live Z.ai UI screenshot instead of ClaudeBar: displayed
  Weekly 14% (Jul 14) / 5-hour 100% / MCP 67% (Jul 23) map one-to-one onto the recorded
  unit=6 / unit=3 / mcp windows and agree, confirming the collector and the 7-day weekly gate.

## 2026-07-12 — Confirm Codex and Z.ai quota windows

- Codex (openai-plus): recorded `resets_at` for the weekly window is capture+7 days
  (captured 2026-07-11, resets 2026-07-18), confirming a fixed 7-day weekly window.
  Also carries a 5-hour rolling session window (the 70% guard). `quota_window_days = 7`;
  window_price ≈ $20 × 7/30 ≈ $4.67.
- Z.ai (zai-coding-lite, "GLM Coding Lite"): monthly billing plan (renews Jul 23) with a
  7-day weekly usage window (snapshot + UI both show reset 2026-07-14), a 5-hour session
  cap, and a separate MCP cap (resets ~Jul 23). Earlier "window may be unstateable"
  concern was wrong — the ~3-day gap was time-remaining in a rolling weekly window, not a
  window length. `quota_window_days = 7`; window_price ≈ $17 × 7/30 ≈ $3.97.
- Z.ai plan shows a "150% Quota" promotion — record per protocol §1 and never mix promo
  and baseline runs.
- Reference: the Claude usage collector (`packages/cli/src/claude-usage.ts`) mirrors
  ClaudeBar's OAuth approach (GET `api.anthropic.com/api/oauth/usage`, beta header
  `oauth-2025-04-20`). This is the Claude-cell reference only; Codex and Z.ai use their
  own collectors. Z.ai still carries an `economics_gap` (no GLM-5.2 in DeepSWE v1.1), so
  its SVI stays null; the window itself is valid.

## 2026-07-11 — Add zero-subscription calibration preflight

- Added `bun run preflight:calibration --provider claude|openai|zai`. It performs
  the selected provider's read-only usage probe and validates the frozen DeepSWE
  Docker/Pier/agent/verifier lifecycle with Pier's built-in `nop` agent, without
  injecting provider credentials or calling a model.
- Documented the required Claude preflight after any harness, runner, Docker, or
  credential-path change. Preflight artifacts are explicitly non-measurement data.

## 2026-07-11 — Fix prepare() aborting on a pre-existing shallow DeepSWE clone

- Bug: all three calibration runners cloned DeepSWE only when `.subbench/deep-swe`
  was missing, then ran `git checkout --detach <lock.deepswe_commit>`. A pre-existing
  shallow clone lacking the pinned commit made checkout fail with "unable to read
  tree", aborting every run in `prepare()` before any subscription call.
- Fix: factored the shared prepare logic into [prepare-deepswe.ts](../scripts/prepare-deepswe.ts).
  Before the detached checkout it now probes `git cat-file -t <commit>` and, when the
  pinned commit is absent, runs `git fetch --depth=1 origin <commit>` to deepen/retrieve
  it. The three runners (`run-deepswe-calibration.ts`, `run-zai-deepswe-calibration.ts`,
  `run-claude-deepswe-calibration.ts`) now delegate to it.
- Coverage: added [prepare-deepswe.test.ts](../scripts/prepare-deepswe.test.ts) —
  fetch-on-missing, skip-fetch-when-present, and abort-on-fetch-failure. No measurement
  protocol or economics change.

## 2026-07-10 — Add rationale and open-questions docs

- Added [why-calibration.md](why-calibration.md): the "why not just use imported token
  costs?" answer — imported economics cover the API side, but the subscription meter is
  opaque, harness-dependent, and success-weighted, so a real drain measurement is
  irreducible; task content is irrelevant but cost-distribution coverage is not.
- Added [open-questions.md](open-questions.md): durable home for open questions. Records
  the operating stance — value-first / black-box; understanding a provider's internal
  subscription structure (token vs dollar vs credit vs dynamic) is an explicit V1
  non-goal, kept as a curiosity with a clear trigger (only model structure if the
  black-box conversion factor proves unstable across workload shapes).
- Indexed both in the docs list (AGENTS.md, symlinked as CLAUDE.md). No methodology or
  formula change; the terse V1 open-questions subset in methodology.md is unchanged and
  now cross-referenced.

## 2026-07-10 — DeepSWE pre-collection freeze (reconstructed from `cf8b578` on `main`)

- Froze the Tier A DeepSWE v1.1 selection, provenance lock, task order, verifier/image
  metadata, and per-provider pre-collection study bundles under `data/`.
- Added deterministic selection, lock generation/verification, frozen-study generation,
  redaction/freshness checks, and CI coverage.
- Added provider collectors and calibration runners for OpenAI Plus, Claude Max, and Z.ai;
  runs require paired usage evidence and an isolation attestation before they can be
  publishable.
- Kept all current examples and historical/pre-collection artifacts explicitly
  non-publishable. No subscription-value comparison has been measured.

## 2026-07-10 — Repository documentation cleanup

- Reduced the live documentation set to the goal, methodology, measurement protocol,
  frozen task set, Claude runbook, research context, and this log.
- Removed superseded plans, handoffs, reviews, and raw research inventories; their
  applicable decisions are reflected in the retained operational documents and frozen
  artifacts.
