# Plan — sequenced steps to the first published score (living document)

Status: living plan, created 2026-07-13. **Update rule:** whenever a step completes,
changes scope, or gets blocked, update this file in the same change set (and log
durable decisions in [log.md](log.md) as usual). This doc answers "what's next and
what's it waiting on"; the design details live in the linked docs.

Legend: `[ ]` todo · `[x]` done · **WHO**: agent (any session) or operator (Vlad only).

## Where we are (2026-07-15)

Foundations are done: methodology, protocol (incl. 2026-07-13 hardening: meter
verification §1, cache-busting flags §4, pause hygiene, served-model recording),
calibration task set frozen, weekly normalization decided, DeepSWE adopted as the
economics source, HN prior-art sweep recorded in [research.md](research.md), ToS
decision made (pass-through proxy approved, gateway rejected), and the capture-rig
task specced ([cache-weighting-rig-task.md](cache-weighting-rig-task.md)).

**Phase 1 (capture rig, Part A) is now built, tested green, and merged** (2026-07-13,
`packages/proxy/`). The one open A5 item — live session reconciliation vs
`/context`/ccusage — needs a real Claude Code session and is folded into the first
Phase 3 burn-in.

**Codex calibration complete** (8/8, Phase 5.1a). Z.ai calibration 3/8 — quota has
reset, 5 tasks ready to run. **Claude Max calibration (Phase 3) is the critical-path
blocker** — zero runs done; Phases 2–4 all depend on operator scheduling a measurement
window with the capture proxy.

**Operator action needed:**
1. Z.ai — run remaining 5 calibration tasks (quota available now)
2. Codex — establish weekly capacity (5.1b)
3. Claude Max — schedule measurement window (Phase 2 gates → Phase 3 runs)

## Phase 1 — Build the capture rig (Part A) — WHO: agent — DONE (built + merged 2026-07-13, commits 1b07269 / merge 21152cf)

- [x] 1.1 Reconcile the `packages/proxy/` skeleton with the spec
      (`handoff-proxy-capture.md` at repo root is the fresh-session prompt).
- [x] 1.2 Build: pass-through forwarder (zero envelope, lossless tee), per-request
      capture (usage block, served model, `anthropic-ratelimit-unified-5h/7d`
      headers), SSE reassembly, hash-chained audit log, zero-envelope verification
      command, batch aggregation. Built in `packages/proxy/src/`
      (`server.ts`, `forward.ts`, `capture.ts`, `ratelimit.ts`, `sink.ts`,
      `audit.ts`, `verify.ts`, `aggregate.ts`).
- [~] 1.3 A5 acceptance: `bun test` green (37 proxy tests / 89 repo-wide) ✅;
      audit chain verify command ✅; envelope verify command (`subbench-proxy-verify`,
      asserts `gateway_envelope_tokens === 0`) ✅; captures gitignored
      (`proxy-captures/`, `*.capture.json`) ✅. **Operator-pending:** the *live*
      reconciliation of a real captured session against `/context`/ccusage requires an
      actual Claude Code session — fold it into the first Phase 3 burn-in.
- [x] 1.4 Commit rig + root tsconfig change; operator runbook
      ([running-proxy-capture.md](running-proxy-capture.md)); log entry (log.md, 2026-07-13).

## Phase 2 — Pre-run gates — WHO: mixed — BLOCKED BY: Phase 1

- [ ] 2.1 Meter verification (protocol §1): warmup task proves runs drain the
      subscription window, not API/credits; record `meter_verified`. — agent+operator
- [ ] 2.2 Pin cache-busting flags (protocol §4): telemetry/TTL state,
      git-instructions flag or quiescent tree; record state. — agent
- [ ] 2.3 Isolation attestation (protocol §2): confirm nothing else uses the
      account; recorded via `--confirm-isolation`. — **operator only**, repeated
      before every measured run.

## Phase 3 — Claude Max calibration behind the proxy (burn-in) — BLOCKED BY: Phase 2

- [ ] 3.1 Run/refresh the frozen Claude Max calibration batches
      ([running-claude-max-calibration.md](running-claude-max-calibration.md)) with
      the proxy capturing. Every batch doubles as cache-weighting evidence.
- [ ] 3.2 Capacity reading at grade `exact` (claude.ai SSE float, protocol §5).
- [ ] 3.3 Record runs with the new fields (served model + tokenizer generation,
      proxy present, pauses, fan-out, flag state); compute batch-level drain.
      Batches never span tokenizer generations (protocol §1/§4, 2026-07-13).
- [ ] 3.4 Optional rig integrity check: reconcile a captured request against
      Anthropic `count_tokens` (rig task A5; run outside the measurement window).

## Phase 4 — Exploratory cache-weighting regression (Part B) — BLOCKED BY: Phase 3 data

- [ ] 4.1 Regress batch drain deltas on captured token mixes
      ([cache-weighting-experiment.md](cache-weighting-experiment.md) §4/§6).
- [ ] 4.2 Report as **directional only** (rounded-meter caveat); quarantined
      `measurement_id`; aggregates-only publishable; log the outcome either way.

## Phase 5 — Second provider cell — BLOCKED BY: nothing hard (parallel to 3–4)

- [x] 5.1a Codex (OpenAI) calibration batches: **all 8/8 tasks complete** (2026-07-14).
      Drains: 3, 8, 5, 4, 4, 16, 5, 5% (median 5%, mean 6.25%). Pass: 3/8 (37.5%).
      Meter verified (subscription drain confirmed across runs). Isolation attested.
- [ ] 5.1b Codex capacity establishment (§5 — total weekly capacity in the same quota
      unit as the drain deltas; without it the cell has no SVI numerator).
- [~] 5.2 Z.ai: `economics_gap` **closed** (R.3, 2026-07-13). GLM-5.2[max] economics
      now in the local freeze (Pass@1 44%, $3.92, 129 steps). **Calibration: 3/8 tasks
      done** (2026-07-14); weekly quota reset (was exhausted 2026-07-14, resets weekly).
      5 tasks remain — ready to run now.

**Same-window constraint (goal.md).** The goal's claim is comparative — "plan A
delivered more than plan B *during this measurement window*" — and results expire at
the end of their weekly window. To publish the comparison (not just per-plan numbers),
the Claude Max (Phase 3) and Codex (Phase 5.1) measurements must land **in the same
weekly window**. Schedule them as one coordinated measurement week; if they can't be
co-scheduled, the first publication is per-plan only and the comparison waits for a
shared window.

**Model matrix (V1 scope).** Methodology requires the default model **plus one
flagship** per plan — two cells per plan. The first coordinated week may cover one
model per plan and publish honestly scoped to it; the second model per plan is a
follow-up week, not a blocker for the first publication. Record which scope each
report carries.

## Phase 6 — Analyze and publish first weekly SVI — BLOCKED BY: Phases 3 + 5.1

- [ ] 6.1 Import/refresh the DeepSWE economics bundle (protocol §3).
- [ ] 6.2 Validation (fail-closed), cross-source sanity check (protocol §6).
- [x] 6.3 Publication surface — **decided 2026-07-13: publish in this repo** (report +
      data committed, versioned, auditable). A website is explicitly **out of scope
      for now** — deferred until quality results exist (see Deferred, below).
- [ ] 6.4 Publish the first weekly SVI report with grades, n, CIs, caveats,
      staleness date — comparative if the same-window constraint was met, per-plan
      otherwise.

## Research track — close the Z.ai economics gap — BLOCKED BY: nothing (parallel)

Goal: make Z.ai comparable — SVI needs an economics source (pass@1 + cost per task for
GLM-5.2 on a neutral harness). **R.1 found this already exists**: DeepSWE v1.1 (our
adopted source) now publishes `glm-5.2[max]` (44% / $3.92 / 78k tok). The gap is a stale
local snapshot, not a missing record.

- [x] R.1 Deep-research sweep (2026-07-13) — done. Result: the premise was stale. DeepSWE
      v1.1 upstream now lists `glm-5.2[max]`; the local freeze
      (`data/deepswe-v1.1-calibration-tasks.json`, 4 models) predates it. pi.dev and
      OpenCode are valid neutral harnesses but moot for this gap (OpenCode also legally
      clouded by Anthropic + cost-incomparable). Report + ranked memo:
      [handoff-zai-economics-research.md](../handoff-zai-economics-research.md).
- [x] R.2 Operator decision: re-pull chosen (2026-07-13).
- [x] R.3 Re-pull executed (2026-07-13): regenerated `data/deepswe-v1.1-calibration-tasks.json`
      from the archived 2026-07-10 upstream artifacts (tasks.json + trials.json) with the
      3-model config set (claude-opus-4-8[max], glm-5-2[max], gpt-5-5[xhigh]).
      GLM-5.2[max] now present: Pass@1 44%, avg cost $3.92, 129 steps, sample_size 450.
      Schema upgraded to version 2 (matching `select-deepswe-tasks.ts` output).
      Phase 5.2 Z.ai economics gap is closed; SVI/API comparison unblocked.

## Deferred (explicitly out of scope for now)

- **Website** — designed only after quality results are published in-repo
  (operator decision 2026-07-13).
- Second model per plan (V1 flagship cell), community usage reports, native-harness
  economics, full model matrix — see methodology V2 Directions.

## Standing rules (apply to every phase)

- Every measured run: §2 attestation first, no exceptions — even exploratory ones.
- Raw proxy captures never leave the machine; aggregates only.
- Results expire at the end of their stated weekly window; the pipeline must stay
  cheap to re-run.
