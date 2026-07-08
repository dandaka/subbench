# DeepSWE Calibration Task Selection — Implementation Plan

Status: PLAN — not yet implemented. This document tells the implementing agent exactly
how to select and persist the 5–10-task calibration subset required by V1 Strategy
step 2 (see `docs/methodology.md`). The selection is needed because drain calibration
runs a small workload through each subscription product, and the sample must match
DeepSWE's heavy-tailed cost distribution (V1 Open Questions).

## Verified facts (checked 2026-07-08)

DeepSWE publishes full per-trial data as public JSON artifacts — no scraping needed:

- `https://deepswe.datacurve.ai/artifacts/v1.1/tasks.json` (~58 KB, 113 tasks)
  Fields per task: `id`, `language`, `repository`, `repository_url`,
  `base_commit_hash`, `problem_title`, `display_description`, `prompt_characters`.
- `https://deepswe.datacurve.ai/artifacts/v1.1/trials.json` (~20 MB, 11,752 trials)
  Fields per trial: `task_name`, `model`, `provider`, `reasoning_effort`, `config`,
  `passed`, `included_in_score`, `cost_usd`, `n_input_tokens`, `n_cache_tokens`,
  `n_output_tokens`, `peak_context_tokens`, `n_agent_steps`,
  `agent_duration_seconds`, `harness` (always `mini-swe-agent`).
- Per-task detail: `https://deepswe.datacurve.ai/artifacts/v1.1/tasks/<taskId>.json`
- Task definitions (Harbor format, Docker env, verifier): `https://github.com/datacurve-ai/deep-swe` under `tasks/`

Models present in trials: claude-fable-5, claude-sonnet-5, claude-opus-4-8,
claude-sonnet-4-6, gpt-5-5, gpt-5-4, gemini-3-1-pro-preview, gemini-3-5-flash,
glm-5-2, kimi-k2-7-code.

Key stats computed over the four subscription-relevant flagships
(claude-fable-5, claude-sonnet-5, claude-opus-4-8, gpt-5-5), trials with
`included_in_score: true` only:

- Task count: 113. Languages: 35 TS, 34 Go, 34 Python, 5 JS, 5 Rust.
- Avg cost per task: min $2.83, p25 $5.19, p50 $6.97, p75 $9.77, p90 $13.12, max $29.97 — heavy right tail confirmed.
- Mean pass rate across tasks: 0.54.
- Cache ratio (`n_cache_tokens / n_input_tokens`) is ~0.97–0.99 for **every** task
  under mini-swe-agent, so the cache-heavy vs cache-light probe from V1 Open
  Questions **cannot be answered by task choice within DeepSWE**. Handle it as a
  separate synthetic probe (one long-context repeated-turn task vs one single-shot
  task), outside this subset.

## Selection procedure

Target: 8 tasks. Stratify jointly on language, cost quantile, and pass rate.

1. Download both artifacts. Aggregate trials per task over the four flagship models
   listed above (filter `included_in_score: true`): pass rate, avg `cost_usd`,
   avg steps, avg duration.
2. Language quotas (proportional): 2 Go, 2 Python, 2 TypeScript, 1 JavaScript, 1 Rust.
3. Cost slots within each language (quantiles of that language's cost distribution):
   Go p10 + p75; Python p25 + p90; TS p50 + p97 (tail — mandatory, drain is
   heavy-tailed); JS p50; Rust p50.
4. Pass-rate balancing (a pure nearest-cost pick was tried and skewed the sample to
   0.28 mean pass vs 0.54 full-set — fix required): within each cost slot, consider
   candidates within ±20% of the slot's target cost, and pick the one whose pass
   rate is nearest the slot's pass-rate target. Assign targets so the sample mix is
   ~2 easy (≥0.8), ~4 mid (0.3–0.7), ~2 hard (≤0.3).
5. Acceptance checks (all must hold, else adjust picks within slots):
   - sample mean avg-cost within ±20% of full-set mean ($7.99)
   - sample mean pass rate within ±0.10 of full-set mean (0.54)
   - at least one task with avg cost ≥ p90 ($13+)
   - no repository appears twice
6. Persist the result to `docs/calibration-tasks.md` (or a JSON under `packages/`
   if the harness consumes it) with, per task: task id, language, repository,
   base commit, cost slot, and the computed flagship-aggregate stats (pass rate,
   avg cost, avg steps, avg minutes). Record the artifact snapshot date
   (data updated 2026-07-01, v1.1) and the model set used for aggregation.
7. Commit the raw `task_stats.json` aggregate (or the script that regenerates it)
   so the selection is reproducible when DeepSWE updates.

## Draft selection (from the unbalanced first pass — slots are right, step 4 will swap some IDs)

| slot | task id | pass | avg $ |
|---|---|---|---|
| go@p10 | participle-grammar-conflict-analysis | 0.21 | 3.42 |
| go@p75 | helm-array-merge-strategies | 0.21 | 9.40 |
| python@p25 | vulture-persistent-analysis-cache | 0.23 | 5.04 |
| python@p90 | gql-incremental-graphql-delivery | 0.04 | 10.53 |
| ts@p50 | koota-deferred-mutation-buffer | 0.12 | 8.35 |
| ts@p97 | effect-sse-httpapi-streaming | 0.16 | 16.55 |
| js@p50 | yjs-map-conflict-detection | 0.76 | 7.83 |
| rust@p50 | boa-hierarchical-evaluation-cancellation | 0.47 | 13.62 |

This table fails acceptance check on pass rate (0.28 vs 0.54) — the implementing
agent must rerun with step-4 balancing and replace roughly half the IDs with
easier same-slot alternatives before persisting.

## Caveats to carry into the output doc

- All stats are mini-swe-agent numbers (Harness Mismatch Disclaimer in methodology applies).
- DeepSWE page warns benchmark data must never appear in training corpora — do not
  vendor task instructions/solutions into this repo; reference IDs and the GitHub repo only.
