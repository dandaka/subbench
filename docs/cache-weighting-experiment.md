# Cache-weighting experiment design (DESIGN ONLY — do not execute)

Status: design, 2026-07-12. This document specifies the experiment that answers the
**pivot open question** (methodology → V1 Open Questions; open-questions.md → *Cache
pricing / factor stability*). It does not authorize a run. Any execution is a
calibration run and requires protocol §2 isolation attestation.

## 1. Question

Does each provider's subscription quota meter discount cache reads the way its **API**
does? Anthropic's API bills cache reads at ~0.1× the input-token price. If the quota
meter does the same, subscription drain is linear in API-equivalent cost and a single
conversion factor suffices for every workload. If instead the meter counts raw tokens or
per-message credits (no cache discount), then drain-per-API-dollar depends on the
workload's cache-hit ratio, and the conversion factor is workload-specific — which would
force SubBench to model provider structure (the one trigger for abandoning the black-box
stance, per open-questions.md).

Answering it needs two workloads with **the same API-equivalent cost but very different
cache-hit ratios**, run on the same plan, comparing observed drain.

## 2. Estimator

For a workload `w` define:

```text
drain_per_api_dollar(w) = observed_quota_drain(w) / api_equivalent_usd(w)
```

- **Cache discounted like the API (null hypothesis H0):** `drain_per_api_dollar` is
  approximately equal for a cache-heavy and a cache-light workload of equal API cost,
  because `api_equivalent_usd` already prices the discount in. Ratio ≈ 1.
- **No cache discount on the meter (H1):** the cache-heavy workload drains *more* quota
  per API dollar (its cheap cache reads cost full price on the meter), so
  `ratio = drain_per_api_dollar(heavy) / drain_per_api_dollar(light) > 1`, with the size
  set by the cache-ratio gap.

The decision statistic is that ratio, with an uncertainty band.

## 3. Task-pair design (per plan)

Two workloads matched on `api_equivalent_usd`, maximally separated on cache ratio. Use
the frozen Tier A tasks and their locked per-model costs where possible so
`api_equivalent_usd` stays auditable ([calibration-tasks.md](calibration-tasks.md)).

- **Cache-light workload:** a single cold task run once — no prior identical prompt in the
  cache TTL window, so nearly all input tokens are cold reads. Any mid-cost Tier A task
  qualifies when spaced ≥ 1h from any same-task predecessor (protocol §4 cache hygiene).
  Candidate: `koota-deferred-mutation-buffer` (ts@p50, $7.39) or
  `kgateway-consistent-hash-policy` (go@p75, $6.76).
- **Cache-heavy workload:** drive the *same* prompt prefix so most input tokens are warm
  reads. Two ways to construct it, in order of cleanliness:
  1. **Long single session on one task** — a task whose agent loop re-sends a large,
     stable context every step (high steps, high minutes) maximizes within-run warm-cache
     reads. Candidate: `effect-sse-httpapi-streaming` (ts@p97, 137.5 steps, $16.06) or
     `mashumaro-flattened-dataclass-fields` (python@p90, 107.8 steps). Within-run caching
     is intrinsic and representative (methodology → Measurement Conditions); this is the
     preferred construction because it needs no TTL-violating repeat.
  2. **Deliberate warm repeat (fallback, ToS-sensitive):** run one task, then re-run the
     *identical* task **inside** the cache TTL so the second run reads a warm cache. This
     violates the §4 cache-hygiene rule on purpose and only for this experiment; it must
     be quarantined (own measurement_id, never mixed into a baseline calibration), and it
     risks a warm-cache repeat draining *less*, which is exactly the signal — but it is
     the messier construction. Prefer construction (1).

Match on API cost by choosing the cache-light and cache-heavy tasks (or repeat count) so
their `api_equivalent_usd` totals land within ~10% of each other; reweight in analysis if
they cannot be matched exactly.

## 4. Required snapshot precision — and why this is currently INFEASIBLE

**Blocking constraint.** As of 2026-07-12 all three confirmed cells are grade `rounded`
(integer-percent meters): Claude Max, OpenAI Plus/Codex, and Z.ai all serve whole-percent
utilization (see log 2026-07-12 precision corrections; Claude Code cannot read the exact
SSE float — log 2026-07-12 exact-float scope). The decision statistic is a **ratio of two
drains**. On a rounded meter each drain carries ±1 point; a Claude-Max-class task drains
only 1–2 points, so a single heavy-vs-light comparison has ±50–100% error per side —
the ratio is uninterpretable.

The experiment is therefore infeasible at useful resolution **without one of**:

- **Exact floats** (grade `exact`). Not available on any Claude Code / Codex / Z.ai drain
  surface today (Claude's exact float is claude.ai-chat-only and cannot bracket a Claude
  Code run — protocol §5). If a provider exposes an exact per-task drain float in future,
  the pair can be a handful of runs.
- **Large repetition** to beat down rounding by batch telescoping. Mean drain per task
  from an N-task contiguous batch has error ≈ ±1/N points (protocol §4). To resolve a,
  say, 30% difference in `drain_per_api_dollar` between the two workloads on a plan where
  each task drains ~1.5 points, each arm needs enough contiguous tasks that ±1/N is small
  against the ~0.45-point expected gap — on the order of **15–30 matched tasks per arm**
  (30–60 total), spaced per §4. That is a large, expensive dedicated run and consumes
  meaningful weekly quota; it is not a light probe.

Record this infeasibility explicitly: **on integer meters the cache-weighting test cannot
be run cheaply.** Until an exact-drain surface appears, either (a) defer the test and keep
the black-box single-factor assumption as a stated caveat, or (b) budget the large-
repetition version as a standalone study under full §2 isolation.

## 5. Run count and pacing (if executed under large-repetition)

- Per plan: two arms (cache-heavy, cache-light), each a contiguous batch of ~15–30
  matched-cost tasks; compute mean drain per task per arm from the **batch-level delta**
  (§4), not per-task deltas.
- Space identical tasks ≥ 1h (§4 cache hygiene) except where the fallback warm-repeat
  construction §3(2) deliberately does the opposite in a quarantined measurement.
- Keep peak-hours and promotion flags constant across arms; never mix Z.ai 150%-promo
  runs with baseline. Z.ai still carries `economics_gap` (no GLM-5.2 in DeepSWE v1.1), so
  its `api_equivalent_usd` denominator is unavailable — **the ratio cannot be computed for
  Z.ai** until a compatible economics source exists; run the experiment on Claude and
  Codex first.

## 6. Analysis

1. For each arm, mean drain per task = batch delta / N (§4).
2. `drain_per_api_dollar(arm) = mean_drain_per_task(arm) / mean_api_equivalent_usd(arm)`.
3. Ratio `= heavy / light`; bootstrap over the task-clustered per-arm runs for a
   sensitivity band (reuse the joint-bootstrap style already in `analysis.ts`).
4. Decision: band overlapping 1 ⇒ consistent with API-like cache discount (H0), one
   conversion factor stands. Band clearly > 1 ⇒ meter does not discount cache like the
   API (H1), and the factor is workload-dependent — escalate to modeling provider
   structure (the open-questions.md trigger).
5. Report grade, N per arm, the cache-ratio estimate per arm (from within-run token
   accounting where the harness exposes it), and the ±1/N rounding floor alongside the
   band.

## 7. Cross-references

- Pivot question: [open-questions.md](open-questions.md) → *Cache pricing / factor
  stability*; [methodology.md](methodology.md) → V1 Open Questions.
- Precision status: [log.md](log.md) 2026-07-12 (Codex/Z.ai precision; Claude exact-float
  scope). Cache hygiene rule: [protocol.md](protocol.md) §4.
