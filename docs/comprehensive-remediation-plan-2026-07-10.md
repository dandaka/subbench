# Comprehensive remediation plan — adversarial review follow-up

Status: **PROPOSED — two release tiers. Tier A permits an honest comparison only on the
fixed calibration set; Tier B is required for claims that generalize beyond that set.**

Date: 2026-07-10

This plan supersedes the conclusions and incomplete acceptance criteria in
[`remediation-plan-2026-07-10.md`](remediation-plan-2026-07-10.md). It does not erase that
document; it records the additional work required after reviewing the implemented changes
adversarially against [`goal.md`](goal.md), [`methodology.md`](methodology.md), and
[`protocol.md`](protocol.md).

## 1. Outcome and definition of done

SubBench has two legitimate publication targets.

**Tier A — fixed-set result:**

> On this frozen calibration set, under the recorded conditions, provider cells produced the
> reported successful-work yield per dollar. This result does not estimate performance on all
> DeepSWE tasks or developer work generally.

**Tier B — generalizable result:**

> For a preregistered task population, provider cells measured under comparable conditions
> produced the reported successful-work yield per dollar, with auditable quota evidence and
> uncertainty that covers sampling, task outcome, and meter error.

### 1.1 Tier A: required for any honest fixed-set number

1. The primary metric implements the documented cost-accounting rule and does not depend on
   incompatible API economics.
2. Boundary cases such as zero successes produce honest, non-degenerate uncertainty bounds.
3. Every publishable run has immutable task, environment, economics, snapshot, and per-run
   isolation provenance.
4. The frozen task set is explicitly the complete target population for the result. The report
   names every task and carries a prominent non-generalization warning.
5. The API comparison, if present, uses one internally consistent estimand and compatible model/effort
   economics.
6. Validation fails closed for known correctness and evidence bypasses, including zero
   snapshots falsely labeled
   as paired evidence.
7. At least two comparable provider cells pass Tier A validation without `--force`.
8. A generated report contains enough information for a third party to recompute every
   published number.

Tier A does **not** require probability sampling, population-level coverage claims, an external
reviewer, or a research-lab CI matrix. It does require the estimator, interval, evidence, and
provenance fixes because without them even the fixed-set number can be wrong.

### 1.2 Tier B: required for a generalizable provider comparison

Tier B adds:

1. A stated population beyond the fixed calibration set, with probability sampling or a
   defensible population model, inclusion probabilities/weights, and sample-size rationale.
2. Uncertainty validated for the intended population and design, including task sampling and
   repeated-run variability where claimed.
3. Clean-environment reproducibility and independent recomputation or review.
4. Broader CI/platform coverage and robustness checks appropriate to the scope of the claim.

Until Tier A passes, all project-facing language must say: **“SubBench is developing a
calibration framework; subscription value has not yet been measured.”** After Tier A passes,
the project may publish fixed-set results only with the Tier A wording above. It must not call
them a general provider ranking or generalize them to developer work.

## 2. Immediate containment

Complete these steps before collecting another paid calibration run.

- [ ] Mark every current example and result as template, synthetic, exploratory, or
  non-publishable. Do not present any current SVI or API multiple as empirical evidence.
- [ ] Copy `claude-max.db` and `zai-lite.db` to a dated, read-only raw-data archive before
  attempting migration. Record file hashes.
- [ ] Locate the `openai-plus.db` named in `openai-plus-calibration-status.md`, or update the
  status document to state that the database is missing and the two runs are not currently
  reproducible.
- [ ] Classify all existing subscription runs as non-publishable because isolation was not
  recorded per run. Retain them only for collector and pipeline debugging.
- [ ] Disable provider-ranking language in README/report output until the comparison release
  gate passes.
- [ ] Add a protocol version and methodology version to every future measurement.

Exit criterion: no tracked document, CLI output, or report can accidentally make a provider
comparison from current data.

## 3. Resolve the estimands before changing code

Create a methodology decision record completed and dated by the project maintainer. It must
include the chosen formulas, rejected alternatives, and checklist answers. The code must be
derived from it rather than the formula being inferred from existing implementation.

### 3.1 Primary native yield

Replace the current `median conversion factor × unweighted native success rate` estimator.
It violates the rule that failed attempts and retries consume quota, especially when
failures are more expensive than successes.

For the Tier A fixed set, use equal task weights (`w_i = 1`) unless a different weighting is
declared before collection. For a Tier B sample, use preregistered population weights. Define
the primary point estimate as a ratio of successful output to all consumed quota:

```text
native successful tasks per quota window =
  quota capacity × sum(w_i × success_i) / sum(w_i × quota_drain_i)

native SVI = native successful tasks per quota window / window_price
```

Requirements:

- Every attempt, failure, retry, limit interruption, and predeclared abort contributes drain.
- `median_drain` and `p90_drain` remain diagnostics; the median must not replace total drain
  in the cost-per-success estimator.
- Repeated attempts on the same task are clustered together for uncertainty estimation.
- Tier A uses the frozen task set as its full target population and is labeled “for this fixed
  calibration set.” It cannot be generalized to DeepSWE or developer work generally.
- Economics gaps do not prevent a native result because native yield uses observed quota
  drain directly, not API-equivalent dollars.

### 3.2 Benchmark-equivalent and API estimands

Keep benchmark-equivalent throughput separate from native SVI:

```text
benchmark-equivalent tasks per window =
  quota capacity / weighted subscription drain per benchmark attempt
  × compatible published pass@1
```

The API value multiple must use benchmark-equivalent subscription throughput on its
subscription side:

```text
benchmark-equivalent subscription tasks per dollar =
  benchmark-equivalent tasks per window / window_price

API tasks per dollar = published pass@1 / published average cost per attempt

API value multiple =
  benchmark-equivalent subscription tasks per dollar / API tasks per dollar
```

Do not divide native SVI by published API tasks per dollar. If a native-versus-API comparison
is desired, give it a different name and state that it mixes harnesses and success estimands.

For break-even:

- Report the API spend-equivalence threshold.
- Also report whether the subscription cell has demonstrated enough capacity to reach it.
- Label an unreachable threshold as such rather than presenting it as actionable break-even.

### 3.3 Window normalization

Retain quota-window normalization only after documenting its interpretation:

```text
window_price = plan price × quota_window_days / billing_days
```

The report must say this is a prorated rate, not an independently purchasable weekly price.
Rolling windows, overlapping limits, promotions, and session limits need separate fields.
Where short-window limits constrain achievable throughput, publish both paced theoretical
yield and observed burst/ergonomic yield; do not silently pace away a binding product limit.

Exit criterion: methodology, types, equations, CLI labels, and report labels name the same
estimands without contradiction.

## 4. Replace the uncertainty design

The ordinary nonparametric bootstrap is degenerate when every success indicator is zero.
Wilson bounds computed separately do not repair an SVI interval that remains `[0, 0]`.

### 4.1 Tier A uncertainty requirements

- [ ] Choose and document a boundary-safe interval for the ratio estimator. Candidate
  approaches are a documented Bayesian beta-binomial/drain model or a conservative
  success-bound-plus-drain-bound construction.
- [ ] Preserve the pairing/correlation between outcome and drain.
- [ ] Cluster by task when tasks have repeated attempts.
- [ ] Use the fixed-set weights in every resample or posterior calculation.
- [ ] Propagate snapshot rounding, capacity grade, and reset uncertainty from an explicit
  measurement-error model. Do not use unexplained fixed `2%`/`5%` multipliers.
- [ ] If coverage has not been established, label the output an “uncertainty/sensitivity
  interval for the fixed runs,” not a 95% confidence or credible interval.

Minimum regression assertions:

- Five failures: point estimate `0`, upper SVI bound `> 0`.
- Four cheap successes plus one failure at the allowed abort cap: the point estimate equals
  the documented total-drain ratio and is lower than the old median-based result.
- Changing failure drain while holding success count fixed changes native SVI.
- Identical data and seed produce identical intervals.
- Meter rounding and capacity-grade changes widen or move the interval as documented.

Tier A review mechanism: create
`docs/reviews/statistical-self-review-<date>.md` containing the equations, assumptions,
adversarial test output, known limitations, date, and reviewer identity. The reviewer may be
the project maintainer; an external reviewer is optional. Every checklist item must be
answered explicitly. This replaces the undefined “statistical review approves” gate.

### 4.2 Tier B uncertainty requirements

- [ ] Respect population strata, clusters, and inclusion weights.
- [ ] Run simulation-based coverage/calibration checks under all failures, all successes,
  expensive failures, heavy-tailed drain, rounded meters, aborted runaways, unequal weights,
  and the intended sampling design.
- [ ] Remove the arbitrary hard maximum of ten runs. Determine sample size from a target
  interval width and a budgeted sequential stopping rule fixed before the study.
- [ ] Record the coverage tolerance before running the final simulations.

Tier B exit criterion: the simulation report passes its recorded tolerance and is reviewed
either by a named external reviewer or through the same explicit self-review artifact. If no
external reviewer is available, the report must disclose that the review was not independent.

## 5. Redesign task sampling and execution

The current eight tasks were purposively selected using observed pass rates and costs. That
does not invalidate a result whose entire target population is explicitly these eight tasks;
it prevents generalization to the 113-task benchmark or to developer work.

### 5.1 Recommended V1 path: Tier A fixed set

1. Freeze the current task IDs, base commits, verifier, and task definitions as the complete
   target population for V1.
2. Use equal task weights by default and run the same manifest on every compared provider.
3. State prominently that selection used source pass/cost information and that the result is
   descriptive only for these tasks.
4. Define whether repeated attempts estimate product stochasticity or are merely retries. Do
   not treat repeated outcomes as new independent tasks.
5. Freeze an order-randomization scheme and abort rule before fresh collection.
6. Validate success only with the pinned benchmark verifier. Classify infrastructure failures
   separately by a fixed, auditable rule.
7. Balance provider order and dates where practical, and disclose any time/provider
   confounding rather than blocking Tier A indefinitely.
8. Run the cache-heavy/cache-light diagnostic before publishing an API-equivalent value
   multiple. Native fixed-set SVI does not depend on that diagnostic.

Tier A exit criterion: `docs/calibration-tasks.md` and the immutable manifest name the eight
tasks, equal weights, versions, order rule, abort rule, and the fixed-set/non-generalization
claim. No inclusion probabilities or population sampling model are required.

### 5.2 Tier B generalizable path

1. Name the broader target population: full DeepSWE or a separately defined developer
   workload.
2. Use reproducible probability or stratified sampling with known inclusion probabilities and
   stored weights. Do not select individual tasks because their outcomes make the aggregate
   look representative.
3. Define strata without leaking evaluated provider outcomes into selection. Candidate fixed
   attributes include language, repository size, prompt size, and preregistered source-cost
   bands.
4. Decide whether uncertainty covers task sampling, agent stochasticity, temporal quota
   behavior, or all three, and add repeated tasks/runs as needed.
5. Justify sample size for the desired claim and interval precision.

Tier B exit criterion: the generated task document additionally states the population,
random seed, strata, inclusion probabilities, weights, and sample-size rationale.

## 6. Make benchmark economics immutable and effort-compatible

### 6.1 Import rules

Update `scripts/select-deepswe-tasks.ts` and the data schema so each economics row is exactly:

```text
(benchmark snapshot, model, model version, reasoning effort/config, harness)
```

- Parse and require `reasoning_effort` and any configuration that changes economics.
- Filter before aggregating. Never aggregate all effort levels for one model.
- Store per-model, per-task cost for every selected task and benchmark-wide economics
  separately.
- Remove every cross-model fallback. A missing per-task/model/effort cost is an explicit
  economics gap and must stop benchmark-equivalent/API calculations.
- Bind measurements to economics by an unambiguous foreign key including benchmark snapshot,
  not by provider/model text alone.
- Re-verify the models and configurations present in the exact immutable DeepSWE artifact
  snapshot used for the study. Repository documents conflict: the selector intentionally
  restricts its `MODELS` set, while the task-selection notes and current public leaderboard
  have listed GLM-5.2. Do not infer source absence from the selector and do not infer snapshot
  presence from the current mutable page. If the locked artifact lacks compatible GLM-5.2
  trials, keep the Z.ai economics gap; if it contains them, import only the compatible
  effort/configuration.
- Map subscription effort settings to benchmark effort only with evidence. If `xhigh`, `max`,
  or provider-specific labels are not comparable, record a gap.

### 6.2 Provenance lock

Tier A requires a tracked lock manifest containing:

- source URLs and retrieval timestamps;
- SHA-256 for tasks, trials, selection output, and source metadata;
- exact DeepSWE git commit;
- task base commits and verifier versions;
- runner/Pier/client versions;
- container image names and immutable digests;
- selection-script commit and arguments.

Reject placeholders, missing input hashes, mutable default-branch checkouts, and unpinned
container tags for publishable cells. Runners must fetch/checkout the locked DeepSWE commit
and verify the expected task/economics inputs before executing.

Tier A exit criterion: the importer verifies every locked input and reproduces the same
numeric economics and task manifest in the supported local environment.

Tier B adds clean-environment, byte-identical regeneration of derived JSON/Markdown artifacts
and a recorded reproducibility run. Byte identity is not a blocker for Tier A when harmless
serializer/runtime differences leave the verified inputs and numeric results unchanged.

## 7. Schema v2 and safe migration

Implement a versioned schema migration before resuming collection.

### 7.1 Required schema changes

- Add `schema_version`, `protocol_version`, and `methodology_version`.
- Put effort/config and snapshot identity on `task_costs`; update uniqueness constraints.
- Add a task-selection manifest table and bind every run to one manifest entry.
- Move isolation attestation to each run:
  `isolation_confirmed_at`, `isolation_confirmed_by`, and checklist/protocol version.
- Keep measurement-level operator metadata only as a summary, not evidence for every run.
- Bind every run to exact benchmark source, task revision, measured provider/model/surface,
  environment record, and pre/post snapshots.
- Make result uniqueness depend on measurement and estimand version, even when economics is
  null. Repeated analysis must update rather than accumulate duplicate NULL-key result rows.
- Store structured invalidation reasons instead of only a boolean `publishable` flag.

### 7.2 Migration behavior

- Add `subbench migrate --dry-run` and `subbench migrate`.
- Every runner and analysis command checks schema version before work. It either performs an
  explicitly invoked migration or refuses with exact instructions; it must not fail later on
  a missing column.
- Migrate a copy first, preserve raw databases, and emit a migration audit log.
- Do not fabricate new provenance for old rows. New required fields remain absent and make
  those rows non-publishable.
- Add fixtures for every historical schema version present in the workspace.

Exit criterion: both current databases migrate without data loss, are clearly marked
non-publishable, and all current commands handle them predictably.

## 8. Close every validation and evidence bypass

Validation must operate on structured issues with stable codes. A publishable result passes
all checks below without `--force`.

### 8.1 Snapshot evidence

- Exactly two snapshots per paired run: one `pre`, one `post`. Counts of zero, one, three, or
  more fail.
- `evidence_kind='paired-snapshots'` is derived from snapshot rows, never trusted from input.
- The bundle loader imports snapshots and snapshot windows transactionally. A bundle cannot
  claim paired evidence without supplying them.
- Snapshot provider, account hash, plan, quota window, authority, and collector agree with the
  measurement and with each other.
- Capture timestamps bracket the task within a documented tolerance.
- Pre/post reset identity matches and reset timestamps are plausible. Missing reset identity
  cannot silently turn a decrease across reset into absolute drain.
- Cached/stale snapshots, unknown precision, disallowed authority, or missing account identity
  are rejected or explicitly downgraded according to protocol.
- Stored `pre_usage`, `post_usage`, and `usage_delta` are recomputed from normalized snapshots;
  imported scalar values cannot override the evidence.

### 8.2 Run validity and comparability

- Count only valid runs toward minimum sample size.
- Require the frozen Tier A or preregistered Tier B number of distinct task IDs and expected repetitions. Five copies
  of one easy task must not pass as five representative tasks.
- Require task IDs and benchmark source to belong to the bound selection manifest.
- Require run environment ID to equal the measurement environment and reject empty IDs.
- Validate model, product surface/version, promotion, peak-hours condition, and measurement
  window against each run.
- Require one isolation attestation timestamp before every run start. A single measurement-
  level string cannot satisfy five runs.
- Validate ISO timestamps semantically, not by lexical text comparison.
- Reject unresolved or ambiguous economics bindings. Include benchmark source in the lookup.
- Require compatible effort/config for every benchmark-equivalent/API result.

### 8.3 Publication prerequisites

- Require real 64-character artifact hashes, locked repo commit, and image digest.
- Require a completed cross-source sanity-check artifact for API claims, or a dated waiver
  written by the maintainer that explains why the API claim is omitted. Show it in the report.
- Require a declared quota window, usable capacity basis, measurement grade, and error model.
- Require at least two comparable publishable cells before generating comparison language.
- `--force` may generate diagnostics only. Forced rows are visibly watermarked and excluded
  from comparison tables and headline conclusions.

Exit criterion: adversarial fixtures for every bullet fail with the expected issue code; the
valid fixture includes real paired snapshot rows rather than a forged evidence label.

## 9. Repair runners and collectors

For each `scripts/run-*-calibration.ts` runner:

- Require the locked task manifest, source commit, image digest, client version, model, and
  effort/config before startup.
- Run the full protocol §2 checklist and persist its confirmation on the run being created,
  not by overwriting the measurement row.
- Capture and validate pre-snapshot before starting the task; capture post-snapshot immediately
  after; write the run and both snapshots in one transaction.
- Do not use `Math.abs(post - pre)` as a universal drain rule. Handle monotonic meters, resets,
  rolling windows, and provider-specific semantics explicitly.
- Fail without recording a calibration outcome when infrastructure prevents the model from
  receiving a valid task. Record a separate infrastructure-event row for auditability.
- Record task abort thresholds before execution and distinguish model failure, verifier
  failure, infrastructure failure, limit interruption, and operator abort.
- Remove cross-model or aggregate API-cost fallback paths.
- Ensure Claude is supported consistently by the shared CLI path or document and test its
  dedicated path.

Exit criterion: a local dry-run fixture proves atomic persistence, reset handling, per-run
attestation, and cleanup after every failure point.

## 10. Reporting and claims policy

Expand Markdown, JSON, and CSV outputs to include or reference:

- exact primary and secondary estimand names and formulas;
- provider, plan, price, billing period, quota window, product/model/client versions;
- protocol/methodology/schema versions;
- task population, manifest hash, strata, weights, distinct tasks, repeats, and attempts;
- successes, failures by class, retries, aborts, and limit interruptions;
- total drain used by the primary estimator plus median/p90 diagnostic drain;
- point estimates, boundary-safe intervals, meter-error assumptions, and sample sizes;
- benchmark source/model/effort/harness, pass@1, average cost, sample size, and artifact hashes;
- native-harness mismatch and API-transfer caveats;
- isolation evidence summary, environment ID, source commit, and image digest;
- measurement dates, promotions, peak-hours state, staleness date, and conditions;
- cross-source sanity-check result;
- invalidation reasons and explicit non-publishable watermark where applicable.

Comparison generation must refuse unless cells share the frozen Tier A or preregistered Tier B task manifest and are
compatible on target population, window interpretation, conditions, evidence grade, and
analysis version. The report should lead with break-even only when it is reachable and
comparable; otherwise lead with measured native yield and its uncertainty.

Tier A exit criterion: a checked-in recomputation command reproduces every displayed number
from exported, redacted data, and the report never hides a caveat required by methodology.
Tier B additionally records an independent clean-environment recomputation when available;
if unavailable, the lack of independent replication is disclosed.

## 11. Engineering quality gates

### 11.1 Tier A tests

Add:

- unit tests for both estimands and every boundary case;
- focused property/adversarial tests for monotonicity, finite outputs, valid interval ordering,
  and sensitivity to failure drain;
- integration tests with real paired snapshot fixture rows;
- validation-bypass tests for zero snapshots, duplicate tasks, ambiguous economics, stale
  snapshots, reset crossings, missing per-run isolation, and mismatched environments;
- migration tests for current `claude-max.db`/`zai-lite.db` schema shapes;
- reproducibility tests for locked selection and economics generation;
- idempotency tests for repeated analysis with null economics;
- report snapshot tests covering every mandatory disclosure.

### 11.2 Tier B tests

- simulation tests for interval calibration under the intended sampling design;
- broader property/fuzz tests for bundle and validation inputs;
- clean-environment reproducibility tests;
- a supported runtime/platform test matrix appropriate to the portability claim.

### 11.3 Tooling and CI

- Add a real lint script and formatter check.
- Make the Tier A `check` run typecheck, lint, format verification, unit/integration and
  focused property/adversarial tests,
  schema validation, and generated-file freshness checks.
- Run the Tier A check in CI on the project's pinned Bun/TypeScript environment.
- Add a broader supported-version/platform matrix for Tier B.
- Fail CI when tracked generated economics or calibration documentation differ from the locked
  generator output.
- Add a secrets/redaction test for stored raw snapshot JSON and exported bundles.

Tier A exit criterion: `npm run lint`, `bun run check`, and pinned-environment CI all pass; no
test fixture obtains publishable status through a label without underlying evidence. Tier B
also requires its simulation, fuzz, reproducibility, and platform-matrix jobs.

## 12. Recovery and new measurement sequence

1. Freeze and hash existing databases.
2. Implement schema v2 and migrate copies.
3. Mark all historical runs exploratory/non-publishable without inventing attestation.
4. Rebuild DeepSWE economics and task selection from an immutable, effort-filtered snapshot.
5. Run the cache-transfer diagnostic and decide whether API-equivalent scaling is supported.
6. Conduct one small non-publishable end-to-end pilot cell.
7. Perform an adversarial audit of the pilot database, validation output, and generated report.
8. Freeze the Tier A task manifest, ordering, statistical method, and abort rule. For Tier B,
   additionally preregister the population sampling and sample-size rule.
9. Collect comparable provider cells, confirming and recording isolation before every run.
10. Re-run validation and the checked-in recomputation command. Record an independent
    recomputation for Tier B when available.
11. Publish only if at least two cells pass the gates for the claimed tier; otherwise publish a methods/status
    report without a ranking.

No historical OpenAI, Claude, or Z.ai result becomes publishable merely because its database
can be migrated or its economics can be recalculated.

## 13. Recommended implementation order

| Phase | Tier | Work | Depends on | Release gate |
|---|---|---|---|---|
| 0 | A | Contain claims and archive data | none | no accidental current comparison |
| 1 | A | Decide estimands and boundary-safe uncertainty | phase 0 | dated maintainer decision/self-review records |
| 2 | A | Freeze fixed-set target and execution design | phase 1 | eight-task manifest and non-generalization claim |
| 3 | A | Schema v2 and migrations | phases 1–2 | historical DB migration tests |
| 4 | A | Immutable DeepSWE inputs and effort filtering | phases 2–3 | locked inputs reproduce numeric economics/manifest |
| 5 | A | Validation and bundle evidence | phase 3 | all Tier A adversarial fixtures rejected |
| 6 | A | Analysis/statistics implementation | phases 1–2 | boundary and estimator tests |
| 7 | A | Runner/collector repair | phases 3–5 | atomic dry-run pilot |
| 8 | A | Reporting and claims gates | phases 5–6 | checked-in recomputation command |
| 9 | A | Lint and pinned-environment CI | phases 3–8 | clean Tier A check |
| 10 | A | Non-publishable pilot and audit | phases 4–9 | dated pilot checklist completed by maintainer or named reviewer |
| 11 | A | Fresh fixed-set comparative collection | phase 10 | two or more Tier A cells |
| 12 | B | Population sampling and sample-size design | phase 11 | preregistered population, weights, and precision target |
| 13 | B | Coverage simulation and robustness matrix | phase 12 | recorded tolerances pass |
| 14 | B | Clean reproducibility/independent review | phases 12–13 | Tier B review artifact and disclosures |

## 14. Files expected to change

- `docs/goal.md`, `docs/methodology.md`, `docs/protocol.md` — resolve estimands,
  uncertainty, sampling, per-run isolation, limits, and publication gates.
- `docs/calibration-tasks.md`, `docs/task-selection-plan.md` — freeze the existing set as the
  Tier A population with an immutable manifest; add probability sampling only for Tier B.
- `packages/core/src/analysis.ts`, `stats.ts`, `types.ts` — ratio estimator, consistent API
  estimand, boundary-safe uncertainty, task clustering, and weights.
- `packages/core/src/schema.ts`, `database.ts`, `validation.ts` — schema v2, explicit
  migrations, immutable bindings, per-run attestations, snapshot enforcement, and issue codes.
- `packages/core/src/report.ts` — mandatory disclosure fields and comparison gate.
- `packages/cli/src/index.ts` and usage collectors — migration commands, transactional
  snapshots, reset semantics, and dry-run diagnostics.
- `scripts/select-deepswe-tasks.ts` — effort/config filtering, per-task/model economics, lock
  manifest, and deterministic selection.
- `scripts/run-*-calibration.ts` — locked checkouts/images, per-run isolation, atomic evidence,
  and no cross-model fallbacks.
- `examples/*.json` — schema-v2 fixtures with actual evidence for valid examples and explicit
  invalidation for templates.
- `packages/*/test` — adversarial, migration, property, simulation, and report tests.
- `package.json` and CI configuration — lint, format, freshness, and complete checks.

## 15. Publication checklists

### 15.1 Tier A fixed-set result

- [ ] Primary estimator equals total successful work divided by all quota consumed.
- [ ] Any published API multiple uses benchmark-equivalent subscription throughput, not native SVI.
- [ ] Zero-success interval has a positive upper bound.
- [ ] The fixed eight-task set, equal weights, order, and abort rule were frozen before fresh collection.
- [ ] The report says the result does not generalize beyond the fixed set.
- [ ] Every economics row is model-, version-, effort-, config-, and snapshot-specific.
- [ ] Every API/benchmark-equivalent calculation has exact per-task/model economics; otherwise it is omitted with a gap.
- [ ] Every run has two verified snapshots and a per-run isolation attestation.
- [ ] Repeated/duplicate tasks follow the frozen execution design.
- [ ] Repo commit, task commits, artifact hashes, and image digests are immutable.
- [ ] Existing databases were archived and not silently upgraded to publishable status.
- [ ] Markdown/JSON/CSV reports include all required evidence and caveats.
- [ ] A cross-source sanity check is attached for any API comparison.
- [ ] Lint, typecheck, Tier A tests, and generated freshness all pass.
- [ ] At least two comparable provider cells pass validation without `--force`.
- [ ] The checked-in recomputation command matches the published tables.
- [ ] The dated methodology, statistical self-review, and pilot checklists are complete; each names the maintainer or reviewer who performed it.

If a Tier A box is unchecked, publish a methods or status update only—not a subscription-value
comparison, even on the fixed set.

### 15.2 Additional Tier B generalizable result

- [ ] The broader target population and claim are explicit.
- [ ] Sampling probabilities/strata, weights, and sample-size rule were preregistered.
- [ ] Statistical simulations meet their recorded coverage/calibration tolerance.
- [ ] Repeated-run and temporal variability are covered to the extent claimed.
- [ ] Clean-environment regeneration and the Tier B CI/platform matrix pass.
- [ ] An independent reviewer or recomputation is recorded; if unavailable, the lack of independence is prominently disclosed and the claim scope is reduced.

If Tier A passes but a Tier B box is unchecked, publish only the fixed-set Tier A wording—not a
general provider ranking.
