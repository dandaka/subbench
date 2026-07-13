# Project log

This log records durable changes and decisions that affect future work. It is not a
measurement run log and does not establish publication evidence.

## 2026-07-13 — Reconciled the living plan with the merged Phase 1 build

- The capture rig (Part A) had been built, tested green, and merged (`1b07269` /
  merge `21152cf`) but `docs/plan.md` still showed all Phase 1 boxes as `[ ]`. Verified
  the build against A5: `bun test` green (37 proxy tests), `subbench-proxy-verify`
  asserts `gateway_envelope_tokens === 0`, audit-chain verify command present, captures
  gitignored. Marked 1.1/1.2/1.4 done; 1.3 marked partial — the one open A5 item is the
  **live** session reconciliation vs `/context`/ccusage, which needs a real Claude Code
  session and is folded into the first Phase 3 burn-in.
- Recorded the critical-path reality in the plan's "Where we are": all remaining phases
  need **live measured runs behind operator-only gates** (isolation attestation §2, a live
  subscription); 2.2 (pin cache-busting flags) rides on a live run; R.2 is an operator
  decision. **No agent-only build work is unblocked** until a measurement window is
  scheduled. Artifacts: [plan.md](plan.md).

## 2026-07-13 — Z.ai economics gap sweep (R.1): the premise was stale, gap is closeable by ingestion

- Deep-research sweep (deep mode, 5 subagents) triggered by the question "does a neutral
  harness exist (pi.dev / opencode)?" **Key finding: the operative premise — "no published
  GLM-5.2 economics record exists" — is false at the source.** DeepSWE v1.1
  (deepswe.datacurve.ai, updated 2026-07-09), SubBench's own adopted source, now publishes
  `glm-5.2[max]`: Pass@1 44%±2%, avg cost $3.92, out tok 78k, 129 steps, on mini-swe-agent.
  Verified by direct fetch (×2, incl. adversarial re-fetch).
- Root cause of the stale belief: the **local freeze**
  `data/deepswe-v1.1-calibration-tasks.json` (2026-07-10) holds only 4 models and predates
  the upstream GLM-5.2 addition. A re-pull closes the gap — a **data-refresh, not a
  methodology change**; SubBench stays import-only (Path 3 not triggered).
- pi.dev (`earendil-works/pi`, MIT) and OpenCode (`anomalyco/opencode`, MIT) confirmed as
  real neutral, model-agnostic, GLM-5.2-capable harnesses — but **moot** for this gap.
  OpenCode additionally disqualified: Anthropic legal action (Mar 2026, PR #18186) stripped
  its subscription-auth plugin, and its per-turn prompt re-payment makes its costs
  non-comparable to the mini-swe-agent board.
- Affected artifacts: report + ranked memo in
  [handoff-zai-economics-research.md](../handoff-zai-economics-research.md); new subsection
  *Z.ai / GLM Economics Sources* in [research.md](research.md); R.1 ticked and R.2
  recommendation noted in [plan.md](plan.md); auto-memory `zai-no-published-economics.md`
  corrected (upstream now publishes; its warning against fabricating a row from the 4-model
  aggregate still holds). **No methodology/protocol edits applied** — R.2 is an operator
  decision.

## 2026-07-13 — Built the pass-through capture rig (Part A of the cache-weighting task)

- Completed **Part A** of [cache-weighting-rig-task.md](cache-weighting-rig-task.md): the
  `@subbench/proxy` pass-through capture rig now builds to acceptance (A1–A5). Part B (the
  measured run) is **not** executed — it needs operator-only gates (protocol §2 isolation
  attestation, §1 meter verification).
- Reconciled with the uncommitted skeleton rather than forking. **Kept:** `capture.ts`
  (usage/SSE/JSON extraction + `mergeUsage`/`SseUsageAccumulator`/`parseSseChunk`),
  `forward.ts` pass-through core, `version.ts`, `package.json`/`tsconfig.json`, the root
  `tsconfig` reference, and the capture gitignore rules from commit 8933737 (verified they
  cover the default `.subbench/proxy-captures/` path). **Extended:** `capture.ts` gained a
  `rate_limits` field; `forward.ts` gained injectable `fetch`, ratelimit-header plumbing, a
  fixed SSE end-of-stream flush (no double-count), and lost dead `extractUsage`. **Added:**
  `ratelimit.ts` (the `anthropic-ratelimit-unified-5h/-7d` status+utilization+reset parse —
  the crux Systima's rig lacked), `audit.ts` (SHA-256 hash-chained log + `verifyChain`,
  pattern adapted from Systima's MIT `ingest-audit.mjs`, not copied), `sink.ts` (lossless
  serialized-append JSONL + audit sink — the property claude-meter's async tee lacks),
  `aggregate.ts` (run-joinable rollup), `server.ts` (Bun listener), `verify.ts` (envelope
  check), `index.ts` barrel, and CLIs for verify/aggregate/audit.
- No code copied from claude-meter (unlicensed) — patterns reimplemented. Package declared
  MIT (repo LICENSE), satisfying A4's permissive-license requirement. Bumped proxy version
  `0.1.0 → 0.2.0` (forwarding, capture shape, and SSE parsing all changed).
- **A5 acceptance verified:** `bun test` green (37 proxy tests / 89 repo-wide); an E2E
  smoke run proved byte-identical forwarding with `GATEWAY_ENVELOPE_TOKENS=0`, a 4-record
  audit chain verifying end to end, and aggregation emitting token totals, large
  cache-write events, distinct served models, and utilization series. Verification cost:
  trivial one-line requests against a **fake** upstream only — zero real subscription quota
  consumed.
- Operator runbook: [running-proxy-capture.md](running-proxy-capture.md) (start → point
  Claude Code → verify envelope → run → verify chain + aggregate).

## 2026-07-13 — Publication surface decided; website deferred; Z.ai economics research planned

- Operator decisions: (1) **publish in the repo** — the first weekly SVI report and its
  data ship as versioned, auditable artifacts in this repository (plan.md 6.3 resolved);
  (2) a **website is out of scope for now**, deferred until quality results exist
  in-repo.
- Added a **Research track** to [plan.md](plan.md) (R.1–R.3): close the Z.ai
  `economics_gap` so Z.ai becomes SVI-comparable. R.1 is a deep-research sweep
  (handoff: `handoff-zai-economics-research.md`, repo root) evaluating four paths —
  find a published GLM-5.2 economics source; adapt a near-miss source (high bar);
  generate economics ourselves by running DeepSWE tasks on mini-swe-agent against the
  GLM-5.2 API (would need a scoped methodology change); or wait for source coverage.
  Output is a decision-ready memo in research.md; path choice is an operator decision
  (R.2). The standing constraint holds: Z.ai SVI stays null-with-a-reason until a
  compatible source exists — never a fabricated economics row.

## 2026-07-13 — Added living plan (docs/plan.md); refreshed proxy build handoff

- Added [plan.md](plan.md): a sequenced, living checklist from the current state to the
  first published weekly SVI — Phase 1 build the capture rig (unblocked, agent work) →
  Phase 2 pre-run gates (meter verification, cache-flag pinning, operator §2 attestation)
  → Phase 3 Claude Max calibration behind the proxy (burn-in; batches double as
  cache-weighting evidence) → Phase 4 exploratory drain-vs-token-mix regression
  (directional only) → Phase 5 Codex cell (Z.ai parked on `economics_gap`) → Phase 6
  validate and publish. Each phase carries WHO (agent/operator) and BLOCKED BY. Update
  rule: keep plan.md current in the same change set as any status change. Indexed in
  AGENTS.md.
- Rewrote `handoff-proxy-capture.md` (repo root) as the fresh-session build prompt for
  Part A only: reconcile-don't-fork the `packages/proxy/` skeleton, claude-meter
  requirements included (ratelimit-header capture, lossless tee, audit chain, no code
  copying — unlicensed), A5 acceptance checks, Part B explicitly out of scope.

## 2026-07-13 — Task spec for the capture rig + exploratory pivot run

- Added [cache-weighting-rig-task.md](cache-weighting-rig-task.md): the build/run companion
  to [cache-weighting-experiment.md](cache-weighting-experiment.md) §4. Operator-approved to
  execute the pivot experiment as an **exploratory** study (build the rig + run design),
  with the coarse rounded-meter limitation treated as an accepted caveat — results are
  directional, never a settled H0/H1 verdict, and are **not** fed into any published SVI.
- The task reaffirms two constraints that "not used for calibration" does NOT waive:
  a protocol §2 isolation attestation is still required (concurrent account usage corrupts
  the drain deltas the experiment regresses on), and meter verification (protocol §1) plus
  the pinned cache-busting flags (protocol §4) apply.
- Rig (Part A) is to reimplement — not vendor — the claude-meter capture pattern
  (unlicensed) in `packages/proxy/`: zero-envelope pass-through, four-token usage-block
  capture, served-model, `anthropic-ratelimit-unified-*` utilization floats, SSE
  reassembly, plus additions it lacks (lossless capture, SHA-256 hash-chained audit log,
  permissive license). Indexed in AGENTS.md. No rig code committed in this change set
  (docs-only); an untracked `packages/proxy/` skeleton exists and is left for the build task
  to reconcile.

## 2026-07-13 — Applied sweep hardening edits; claude-meter evaluated (BORROW)

- Operator-approved three methodology/protocol hardening edits from the HN sweep:
  1. **[methodology.md](methodology.md)** Harness Mismatch Disclaimer — annotated the
     ~33k-token Claude Code floor as version-specific/high-end; progressive tool disclosure
     puts the comparable current floor at ~15–24k tok. The ~4–5× CC:OpenCode ratio and
     cache-re-write mechanism still stand; the exact floor does not.
  2. **[protocol.md](protocol.md) §1** — added a meter-verification requirement: confirm a
     run drains the subscription window, not API/credit billing (headless `claude -p` /
     Agent SDK credit path can fall to API-plan billing — HN 48129753); record
     `meter_verified: subscription` per cell; a cell on the wrong denominator is invalid.
  3. **[protocol.md](protocol.md) §4** — pin two Claude Code cache-busting behaviors per
     cell: telemetry↔cache-TTL coupling (claude-code#45381) and git-status busting the
     middle cache block on every commit (`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` or keep
     the tree quiescent mid-batch). Both re-write the cache independently of the task.
- Added matching Data Schema run/cell fields to [methodology.md](methodology.md):
  `meter verified` and `cache-busting flag state`.
- Evaluated **claude-meter** (abhishekray07) as the capture rig for the cache-weighting
  experiment. Verdict **BORROW**, not adopt/fork: the repo has **no license** (all rights
  reserved — cannot vendor), but its design is exactly right and cheap to reimplement — a
  true zero-envelope stdlib-Go pass-through tee that captures all four token classes from
  JSON and SSE, plus per-window `anthropic-ratelimit-unified-*` utilization floats + reset
  timestamps, and a Python `usage_value(cache_read_weight=...)` knob that already prototypes
  the §4 regression. It **confirms** cache-weighting-experiment.md §4's "coarse/rounded
  meter" caveat (its own estimates span ~10× bands) rather than refuting it. SubBench must
  add: a permissively-licensed reimplementation, hash-chained audit log, lossless (non-
  dropping) capture, Codex/Z.ai normalizers, the constrained drain-regression solver, and
  the §2 isolation gate. Recorded in research.md; no §4 design change required.

## 2026-07-13 — HN deep-research sweep: prior art on API-boundary metering, harness overhead, quota RE, cache economics

- Ran the deep-research handoff ([handoff-hn-deep-research.md](../handoff-hn-deep-research.md)):
  exhaustive Hacker News sweep (anchor thread item 48883275 read in full; ~18 Algolia query
  angles; loop-until-dry) plus GitHub source inspection of every recorded tool and an
  adversarial re-verification of the pivot claim. Raw content stayed in the sandbox; only
  distilled findings entered [research.md](research.md).
- Added four new subsections to [research.md](research.md): **API-Boundary Metering
  Proxies**, **Harness Token-Overhead — Independent Corroboration**, **Meter-Recovery
  Tooling and Endpoints** + **The Cache-Weighting Pivot**, **Prompt-Cache Economics in
  Practice**, and **Subscription-vs-API Value Comparisons**; plus a **Synthesis for
  SubBench** section.
- Top find: **claude-meter** (abhishekray07) — a local pass-through research proxy that
  captures the response usage block AND the `anthropic-ratelimit-unified-5h/7d` utilization
  headers AND reassembles SSE usage, with a cache-read-weight knob. Captures *more* than
  Systima's rig and fits the approved ToS posture; flagged as the rig to build on for the
  cache-weighting experiment.
- Pivot result (cache-weighting): **not answered with measured evidence.** Adversarial
  verification refuted the strong reading of lugia19/Claude-Usage-Extension's constants —
  they are a self-labeled "vibes/napkin-math" estimator, the meter % is served verbatim by
  Anthropic's `/usage`, and the "cache-writes-drain-heavily" claim has no basis in the code
  (bcherny #45381 is about telemetry/TTL, misattributed). Established directionally:
  subscription cache reads are ~free in dollars while writes consume quota, and
  subscriber vs API cache TTL now diverge — subscription meter ≠ API dollar cost.
- Corroboration: Systima's ~33k floor is version-specific (progressive tool disclosure ⇒
  ~15–24k tok on current builds); the ~4–5x CC:OpenCode ratio and cache-re-write mechanism
  survive independent checks (leaked prompts, tokenscope, CodeBurn, dirac).
- Flagged four **suggested methodology/protocol changes for operator decision** (not
  applied): annotate the 33k figure as version-specific; pin Claude Code cache-busting
  flags (telemetry TTL coupling, `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`) in the harness;
  require verifying which meter a run drains (`claude -p` may hit API billing); note the
  usage-anchored weekly window. See the Synthesis section of research.md. No methodology,
  protocol, or economics file was modified in this change set.

## 2026-07-13 — Indexed Systima harness-overhead study in research.md

- Added the Systima "Claude Code vs OpenCode token overhead" study (July 2026) to
  [research.md](research.md). Key evidence: Claude Code's baseline is
  model-conditional (~33k tokens on Sonnet, smaller on Fable); reproducible
  mid-session cache re-writes of the full ~43k prefix (37-86k tokens/event); cache
  writes re-paid after any pause > the 5-min TTL; subagent fan-out is a 4.2x input
  multiplier; served model under Fable alternated between `claude-fable-5` and
  `claude-opus-4-8`; and their open-source proxy rig shows exact per-request token
  mixes are observable for Claude Max subscription traffic via a gateway.

## 2026-07-13 — ToS decision: boundary-level proxy capture approved, proxy-only

- Operator decision: SubBench may capture its own traffic at the API boundary with a
  **pass-through logging proxy** (option B of the C-level review). The gateway variant
  (Meridian-style bridging of subscription auth into non-native clients) is **not**
  approved.
- [methodology.md](methodology.md): ToS Position extended (measurement accounts only,
  pure pass-through, raw captures private, technique disclosed); Harness Isolation gains
  a matching instrumentation exception (pinned proxy version, pass-through verified via
  bare calibration request, presence recorded per run); run schema gains a
  `logging proxy present` field.
- [cache-weighting-experiment.md](cache-weighting-experiment.md) §4 route restated as
  **approved in proxy-only form** (envelope constant = 0 for a verified pass-through);
  execution still requires protocol §2 isolation attestation. Mirrors updated in
  [open-questions.md](open-questions.md) and methodology V1 Open Questions.

## 2026-07-13 — Applied Systima-derived methodology updates (operator-approved)

Examined the open-source rig (github.com/systima-ai/agentic-coding-tools-comparison;
details recorded in [research.md](research.md)) and applied the identified updates:

- [protocol.md](protocol.md) §4: new **pause hygiene** rule — no mid-run pauses beyond
  the cache TTL (an over-TTL pause re-primes the full prefix at 1.25× write rates);
  over-TTL pauses are recorded as pause events and end the contiguous batch. §4 also
  now requires recording **subagent fan-out** per run (~4.2× input multiplier measured).
- [protocol.md](protocol.md) §1: **served-model recording** — pinned model ≠ served
  model (Fable 5 requests answered alternately by `claude-fable-5` / `claude-opus-4-8`);
  record served model per run where observable, else `unobservable` per cell.
- [methodology.md](methodology.md): Measurement Conditions notes mid-session cache
  re-writes as task-independent drain noise (reinforcing batch deltas); Harness Mismatch
  Disclaimer states harness overhead is **model-conditional**, so calibration factors
  are per (model, harness version); run schema gains `served model`,
  `subagent fan-out observed`, and `pause events` fields.
- [cache-weighting-experiment.md](cache-weighting-experiment.md) §4: added a third
  feasibility route — **proxy-captured exact token mixes regressed against batch-level
  drain deltas** (Systima rig; Meridian gateway bridges Claude Max). Marked
  design-approved for consideration, **not authorized**: gateway is a Harness Isolation
  deviation (envelope must be measured and documented) and extends the ToS Position,
  which must be resolved by operator decision before any run. Mirrored in
  [open-questions.md](open-questions.md) and methodology V1 Open Questions.

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
