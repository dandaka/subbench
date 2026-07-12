# Project log

This log records durable changes and decisions that affect future work. It is not a
measurement run log and does not establish publication evidence.

## 2026-07-12 — Cache-weighting experiment design (do not execute)

- Added [cache-weighting-experiment.md](cache-weighting-experiment.md): design-only
  spec for the pivot open question (does the quota meter discount cache reads like the
  API?). Estimator is the ratio of `drain_per_api_dollar` between a cache-heavy and a
  cache-light workload of equal API cost; band overlapping 1 ⇒ one conversion factor
  stands, band > 1 ⇒ workload-dependent factor and the trigger to model provider
  structure.
- Key flag, tying in items 1–2: **all three confirmed cells are grade `rounded`**, so
  the test is infeasible cheaply — the decision statistic is a ratio of two ~1–2-point
  drains (±50–100% each). It needs either an exact per-task drain surface (none exists
  for Claude Code/Codex/Z.ai today) or large repetition (~15–30 matched tasks per arm),
  which is a dedicated §2-isolated study, not a light probe. Z.ai cannot be included at
  all until its `economics_gap` is closed (no GLM-5.2 in DeepSWE v1.1 ⇒ no
  `api_equivalent_usd` denominator). Indexed in AGENTS.md.

## 2026-07-12 — Normalization decision: weekly (operator-confirmed)

- The first public score normalizes to the **weekly** quota window. Rationale: all
  three confirmed providers (Claude Max, OpenAI Plus/Codex, Z.ai) enforce a 7-day
  weekly window (log 2026-07-12); protocol §5 already treats the quota window as the
  canonical unit and prorates the monthly price into it (`window_price = price ×
  quota_window_days / billing_days = price × 7/30`). Weekly matches the meter providers
  actually enforce and keeps SVI (native tasks per window per window-dollar) directly
  comparable across providers. Monthly would require aggregating ~4.3 weekly windows
  under a reset convention no provider exposes and would reintroduce a window/billing
  mismatch.
- Recorded as resolved in methodology (V1 Open Questions) and open-questions.md. No
  formula change — the machinery was already window-based; this fixes the window as
  weekly for V1. Results expire at the end of their stated weekly window.

## 2026-07-12 — Resolve Claude exact-float scope (desk verification, no live run)

- Question: can the she-llac/claude-counter `message_limit` SSE float supply exact
  utilization, and can it bracket Claude Code runs (protocol §5 caveat)? Settled
  without consuming quota (operator declined the optional live probe as unnecessary):
  - **The float exists and is exact**, for the same weekly/session windows we measure
    — confirmed from the claude-counter source: it reads "exact, unrounded utilization
    fractions" from live SSE `message_limit` and "makes requests only to `claude.ai`".
  - **It is claude.ai-chat-only.** The persisted OAuth payload
    (`claude-max.db` raw_json) shows `five_hour.utilization`/`seven_day.utilization`
    are bare integers (31, 28); the payload's only non-integer float is
    `extra_usage.utilization` (1.647… = 70/4250 overage-credit spend), which is
    unrelated to the weekly window. So `api.anthropic.com/oauth/usage` — the endpoint
    Claude Code and our collector use — never carries the exact window float.
  - **Cannot bracket a Claude Code task.** Reading the float means sending a claude.ai
    chat message, which drains the same shared weekly quota. A pre/post pair inserts
    two extra quota-consuming messages around the task and measures the probe, not the
    task.
- Conclusion recorded in protocol §5 and methodology (Measurement Grade): grade
  `exact` is viable for the **capacity numerator** (one claude.ai read of the weekly
  float, on the claude.ai surface) but Claude Code **per-task drain stays `rounded`**
  and the §4 batch-delta machinery is still required. The two grades can differ within
  one cell and must each be recorded. No exact-collector prototype is warranted for the
  Claude Code drain path; a claude.ai capacity reader remains a possible future add for
  the numerator only.

- Audit findings (desk work, commit abc8a09 baseline):
  - **Batch-delta estimator**: the aggregate `nativeTasksPerWindow` in
    `analysis.ts` already telescopes correctly — its denominator sums contiguous
    per-run `usage_delta`, which equals the batch-level delta. But `conversionFactor
    = median(usage_delta/api_equivalent_usd)` and the per-run `drainCi` are exactly
    the per-task drain-vs-cost quantities §4 calls individually uninterpretable on
    rounded meters. Added a doc comment marking them descriptive-only; no math change.
  - **3× median abort rule**: not implemented, and worse, `aborted` was miswired in
    all three runners as `exitCode === 0 ? 0 : 1` — i.e. it recorded *task failure*,
    not a *runaway drain*. Per §4, a failed-but-normal task is `success=0,
    aborted=0`; `aborted` means the drain hit 3× the established median.
  - **Cache-spacing (1h) guard**: no check on same-task relaunches within the
    prompt-cache TTL.
- Implemented `packages/core/src/run-hygiene.ts` (pure, no IO — needs no run):
  `findCacheAdjacency` (same-`task_id` pairs closer than the 1h TTL floor),
  `findUnmarkedRunaways` / `isRunawayDrain` (3×-median abort, with the median taken
  over non-runaway runs so a runaway can't lift its own bar), and
  `batchMeanDrainPerTask` (the §4 batch estimator). Exported from `core/index.ts`.
  Added `packages/core/test/run-hygiene.test.ts` (13 tests).
- Rewired `aborted` in all three calibration runners to decide from the prior
  in-batch drains via `isRunawayDrain(priorDrains, drain)`, decoupling it from the
  exit code. `bun test` green (52 tests); `tsc --build` clean; all three runners
  bundle. No calibration run was launched; the abort path is exercised only by the
  pure unit tests until the operator's next isolated window.

## 2026-07-12 — Correct Codex and Z.ai precision labels to integer-percent

- Both collectors declared `precision: "decimal"` unverified. Inspecting the raw
  payloads persisted in the frozen studies settled it — both serve whole percents,
  same as Claude (grade `rounded`), not decimals:
  - Codex (`openai-plus.db`): `primary/secondary.usedPercent` is a whole integer in
    every snapshot (14/34/81 primary, 2/5/13 secondary).
  - Z.ai (`zai-coding-lite.db`): every limit record carries a whole-integer
    `percentage` (0/30/33/66/72/86/100). The `currentValue/limitValue` ratio in
    `percentage()` — the only fractional branch — never fires (no
    `limitValue`/`limit`/`total` key is ever present).
- Corrected `precision` to `integer-percent` in `packages/cli/src/codex-usage.ts`
  and `zai-usage.ts`, each with a comment citing the payload evidence, following the
  Claude precedent (commit abc8a09). Added a precision assertion to the existing
  Codex snapshot test and a new `packages/cli/test/zai-usage.test.ts` (asserts the
  label and that every emitted utilization is a whole integer). `bun test` green.
- Consequence: all three confirmed cells are grade `rounded`. The batch-level-delta
  estimator and per-task-uninterpretability rules (protocol §4) apply to Codex and
  Z.ai exactly as to Claude Max — no cell currently has finer than ±1-point
  per-snapshot resolution. Existing frozen snapshots keep their recorded `decimal`
  label; their raw payloads make the actual precision auditable.

## 2026-07-12 — Claude Max drain resolution: batch-level deltas are the estimator

- The Claude OAuth usage endpoint serves weekly/session utilization as whole percents
  (confirmed in all persisted raw payloads; floats appear only in unrelated fields such
  as `extra_usage`). The Claude collector's `precision` label was corrected from
  `decimal` to `integer-percent` (`packages/cli/src/claude-usage.ts`), with the test
  updated to match. Existing frozen snapshots keep their recorded `decimal` label;
  their raw payloads make the actual precision auditable.
- Observed Claude Max drains are 1–2 points per DeepSWE task (28→30, 30→31), not the
  5–6 points the methodology assumed, so a single rounded per-task delta is
  ±50–100% — individually uninterpretable. The two runs even show a spurious 6×
  quota-per-dollar inversion ($5.79 task drained 2 points, $17.34 task drained 1).
- Methodology (Measurement Grade) and protocol §4 now require: on rounded indicators,
  estimate mean drain per task from contiguous batch-level deltas (snapshots
  telescope, one ±1-point error per batch); per-task rounded deltas are descriptive
  only and support no per-task conclusions. At ~1.5 points/task, 5 contiguous tasks
  give roughly ±13% on mean drain — adequate for plan comparisons ≥1.5× apart.
- Quantization severity is plan-dependent (the percent meter measures the plan's
  quota, so the same task drains fewer points on a $100-200 tier than a $20 tier);
  batch length is the primary resolution knob (±1/N points on the mean), and harder
  tasks lift per-task drain above the rounding floor but must not skew the sample
  away from the benchmark's cost distribution without reweighting.
- Cache hygiene added to methodology (Measurement Conditions) and protocol §4:
  never launch an identical task twice within the provider's prompt-cache TTL
  (Anthropic: 5-min default refreshed on hit, 1-hour extended; 1 hour is the
  conservative spacing floor). A warm-cache repeat can drain less than a cold run
  if the quota meter discounts cache reads (the open cache-weighting question).
  Distinct tasks back-to-back remain fine and representative. This is an
  account-scheduling concern — the benchmark source does not handle it.

## 2026-07-12 — Claude Max calibration paused after laptop restart

- Two valid Claude Max calibration runs are persisted in
  `data/frozen-studies/deepswe-v1.1-2026-07-10/claude-max.db`, each with server-authoritative
  paired usage snapshots and an isolation attestation: `dasel-html-document-format` passed
  with weekly usage 28%→30%, and `kgateway-consistent-hash-policy` passed with weekly usage
  30%→31%.
- Collection stopped at 2/5 required valid runs when the laptop was restarted. No third
  calibration task was launched. Resume only after Docker Desktop is available and the
  Claude Code OAuth login has been refreshed; re-confirm operator isolation before the next
  run.
- The canonical SQLite database and a deterministic JSON export are now versioned for this
  frozen Claude study. Raw Docker/Pier jobs remain local-only because they contain complete
  task worktrees and agent trajectories, which are not necessary measurement evidence.
- The same preservation policy now covers the existing OpenAI Plus and Z.ai frozen-study
  databases and their JSON evidence exports, so every provider's collected calibration
  evidence is repository-backed.

## 2026-07-12 — Preserve Claude runner usage evidence during a run

- The Claude calibration runner now writes its read-only pre and post usage snapshots
  beside the Pier job as each is captured. This permits a reviewed recovery if the
  parent process is interrupted after a valid task, rather than repeating model work
  solely because in-memory collector evidence was lost.

## 2026-07-12 — Tolerate Claude reset timestamp rounding

- Claude can render the same quota-window reset with sub-second timestamp drift between
  paired captures. Snapshot validation now treats drift of up to one second as the same
  window, while continuing to reject material reset changes.

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
