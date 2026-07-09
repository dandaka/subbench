# Adversarial project review — 2026-07-10

## Verdict

**No: SubBench does not yet achieve its stated goal.** It is a promising, tested calibration harness and data model, but it cannot currently produce a defensible answer to the goal question: which subscription delivers more *successful* benchmark-equivalent coding work **per dollar and per billing period**.

This is a release-readiness finding, not a claim that the idea is impossible. Do not publish, rank plans, or describe V1 as measuring subscription value until the P0 findings below are fixed and the prescribed measurements are complete.

## What was examined

- Goal, methodology, mandatory protocol, provider runners, examples, and tests.
- Recorded calibration-status documents.
- `bun run check`: **23 passing tests**, 0 failures. This demonstrates basic software behavior, not validity of the measurement or metric.

No subscription run was started or altered during this review.

## Status against the stated goal

| Goal requirement | Status | Evidence |
|---|---|---|
| Compare plans using a defined workload and window | Not achieved | No publishable multi-plan result exists. OpenAI has 2/8 valid runs, both failures; Z.ai has no recorded run in its handoff; Claude is only at runner/setup stage. |
| Successful developer work | Not achieved | The analysis substitutes published neutral-harness pass@1 for observed native subscription success. |
| Per billing period | Not achieved | Analysis uses a weekly `100`-point quota directly while supplied plans have `billing_days: 30`; it never normalizes one to the other. |
| Per dollar | Not defensible | It divides the un-normalized weekly estimate by a monthly price. |
| Reproducible, protocol-valid measurement | Not achieved | The mandatory account-isolation confirmation is neither captured as structured data nor enforced by validation. |
| Confidence-aware conclusions | Not achieved | Task-yield intervals omit native success, capacity, published-economics, selection, and rounding uncertainty. |

The project correctly avoids claiming a real provider ranking today. The README's “publication-ready reports” should mean pipeline plumbing, not that the benchmark goal is achieved.

## P0 — release-blocking findings

### 1. The SVI mixes a weekly numerator with a monthly denominator

The goal defines SVI as successful tasks *per billing period* divided by subscription price. Supplied studies encode `quota_unit: weekly-used-percent`, `quota_capacity: 100`, and 30 billing days. Analysis passes that `100` directly into the calculation and never reads `billing_days` or `quota_unit`.

Consequently `tasks_per_period` is actually an estimate for one weekly quota window, while `svi` divides it by the 30-day price. This is a unit error, not a caveat. It makes the principal metric and API value multiple non-comparable to the stated goal.

Required correction: make the capacity window explicit and normalize capacity to the same declared period as price (or report weekly price and weekly SVI). Reject a study when that conversion is unknown or cannot be justified for rolling limits.

Evidence: [goal](/Users/dandaka/projects/subbench/docs/goal.md:48), [methodology](/Users/dandaka/projects/subbench/docs/methodology.md:37), [OpenAI example](/Users/dandaka/projects/subbench/examples/openai-plus-deepswe-v1.1.json:15), and [analysis](/Users/dandaka/projects/subbench/packages/core/src/analysis.ts:26).

### 2. The calculation can claim successful work when every measured native task failed

The protocol requires cost per successful task to be total drain across all attempts divided by observed successes. The calculator instead derives a median quota-drain-per-published-API-dollar and then multiplies by **published** pass@1. Its observed `successCount` is computed only for a separate report field; it does not affect SVI, tasks per period, or their intervals.

Therefore five valid native failures can still yield a positive SVI, so long as the published benchmark model had non-zero pass@1. This contradicts both “successful developer work” and the cost-accounting rule. The existing unit test includes a failure while expecting the unchanged published-pass result.

Required correction: decide and document one estimand. For a native-product claim, estimate native success jointly with native drain (including failures, retries, and abortions), and propagate both in yield intervals. If V1 instead estimates published-harness-equivalent work, rename the metric and do not present native success as evidence of it.

Evidence: [goal](/Users/dandaka/projects/subbench/docs/goal.md:35), [cost rule](/Users/dandaka/projects/subbench/docs/methodology.md:164), [calculation](/Users/dandaka/projects/subbench/packages/core/src/analysis.ts:13), and [test](/Users/dandaka/projects/subbench/packages/core/test/analysis.test.ts:16).

### 3. Provider/model economics are not consistently valid

The task-selection script aggregates four models, then supplies model-specific costs only for GPT-5.5. The Claude and Z.ai runners record the four-model aggregate as each run's API-equivalent cost. Worse, the Z.ai example labels the exact Claude Opus pass-rate, cost, step count, and sample size as `glm-5.2`, despite the selection document identifying GLM as a distinct model present in the source.

This can systematically alter the conversion factor and final SVI. A provider comparison must use the same model's published economics, or explicitly say no compatible economics exist and withhold its SVI.

Required correction: persist per-model, per-task source economics for every measured model and bind each run to it. Derive Z.ai figures from GLM trials at a compatible effort level, or exclude Z.ai. A provider-neutral task selection does not justify cross-model task costs.

Evidence: [selection aggregation](/Users/dandaka/projects/subbench/scripts/select-deepswe-tasks.ts:8), [GPT-only per-task cost](/Users/dandaka/projects/subbench/scripts/select-deepswe-tasks.ts:105), [Claude runner](/Users/dandaka/projects/subbench/scripts/run-claude-deepswe-calibration.ts:231), [Z.ai runner](/Users/dandaka/projects/subbench/scripts/run-zai-deepswe-calibration.ts:186), and [Z.ai example](/Users/dandaka/projects/subbench/examples/zai-lite-deepswe-v1.1.json:36).

### 4. A completed Claude study would silently disappear from analysis

Analysis joins task economics and subscription measurements on identical model strings. The Claude example stores `claude-opus-4-8` as the benchmark model but `opus` as the subscription measurement model. The join returns no cell, so analysis returns no Claude result even after valid calibration runs.

Required correction: add an explicit model mapping or a foreign key from each measurement to its adopted economics record. Make “every measurement resolves to exactly one economics record” a validation error and add an integration test using the Claude bundle.

Evidence: [Claude bundle](/Users/dandaka/projects/subbench/examples/claude-max-deepswe-v1.1.json:36) and [analysis join](/Users/dandaka/projects/subbench/packages/core/src/database.ts:300).

### 5. Validation permits protocol-invalid data and analysis ignores validation

The protocol calls an unrecorded account-isolation confirmation invalid. The schema has no isolation field, runners do not require an attestation, and validation only checks database integrity, 5–10 rows, promotion mixing, and harness-ID mixing. Additionally, `analyze` can run without first passing `validate`; it analyzes any non-empty cell.

The generic CLI also accepts manually supplied usage numbers, so it can create unverifiable results without paired provider snapshots. That can support manual collection, but such records must be marked non-publishable rather than accepted as a normal study.

Required correction: add a per-run, timestamped operator-isolation attestation and measurement-account/environment provenance; require it at capture and validation. Require paired snapshots or a documented manual-evidence artifact for publishable runs. Make analysis fail closed on all publishability checks.

Evidence: [mandatory protocol](/Users/dandaka/projects/subbench/docs/protocol.md:17), [schema](/Users/dandaka/projects/subbench/packages/core/src/schema.ts:51), [validation](/Users/dandaka/projects/subbench/packages/core/src/database.ts:365), and [manual-input CLI](/Users/dandaka/projects/subbench/packages/cli/src/index.ts:176).

## P1 — material validity gaps

1. **Uncertainty is materially understated.** The task-yield interval bootstraps only the median drain factor. It excludes uncertainty in observed capacity, native success, published pass/cost estimates, rounded-meter error, task-selection error, and billing-window normalization. A “95% CI” would be misleading. Use a joint bootstrap or sensitivity interval and report each source.

2. **Capacity is asserted rather than established.** `quota_capacity: 100` treats a displayed percentage scale as usable full-window capacity. Validation accepts grade `unknown`, has no capacity evidence, and does not ensure the selected quota window is limiting.

3. **The calibration sample does not prove the transfer assumption.** Eight tasks can estimate drain only if quota drain is proportional to published API-equivalent cost. The methodology identifies cache behavior as an open question; the selection document says DeepSWE cannot test it. No synthetic cache probe is implemented.

4. **The required cross-source sanity check and publication evidence are absent.** The protocol requires an Aider/MorphLLM/Ivern comparison before publication. No source-data artifact, check, or report field enforces it.

5. **Report labels overstate their content.** The report calls an un-normalized estimate `tasks_per_period` and omits conditions, measurement window, p90 drain, staleness date, benchmark source, and confidence provenance from the Markdown table despite the stated report shape.

## P2 — reproducibility and governance concerns

- `docs/task-selection-plan.md` still says “PLAN — not yet implemented” although the script and generated selection are present; it also retains an obsolete draft.
- The selection script downloads mutable URLs and the runner shallow-clones the benchmark default branch. A date is recorded, but no artifact hash/commit binds the workload to a study.
- Calibration databases are ignored. That protects account data, but a publishable result needs a redacted immutable source-data export or audit bundle.
- The OpenAI runner records only numeric pre/post values, unlike Claude/Z.ai runners that persist provider snapshots, weakening account/window auditability.

## Evidence on current empirical readiness

- OpenAI: 2 of 8 valid recorded calibration runs, 0 successes, and `validate` fails because V1 requires at least 5.
- Z.ai: its handoff says no calibration run is recorded; reconcile that with the separately ignored local database before any claim.
- Claude: runner and collector exist, but no completed study/report is present, and the model-key mismatch blocks analysis.

Thus even a correct implementation would still lack data for a comparison.

Evidence: [OpenAI status](/Users/dandaka/projects/subbench/docs/openai-plus-calibration-status.md:10) and [Z.ai handoff](/Users/dandaka/projects/subbench/docs/zai-calibration-handoff.md:12).

## Minimum release gate

1. Repair the P0 unit, estimand, model-economics, model-mapping, and fail-closed validation defects; add regression and integration tests that would have caught each one.
2. Define a single report period and convert all capacity, price, and API comparisons into that unit.
3. Capture and validate the mandatory isolation attestation and auditable pre/post evidence for every run.
4. Freeze benchmark artifact hashes, task definitions, model versions, effort, and runner images for each cell.
5. Complete at least 5–10 valid runs **per cell**, across defined conditions; retain failures, retries, interruptions, and aborts.
6. Establish capacity with evidence for the true limiting quota window and propagate important uncertainty into the result interval.
7. Run and publish the required independent economics sanity check plus a redacted source-data/audit bundle.
8. Only then make the narrowly scoped comparison promised by the goal.

Until then, the defensible public statement is: **“SubBench is building a calibration and reporting pipeline; it has not yet measured comparative subscription value.”**

