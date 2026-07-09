# Remediation plan — response to adversarial review 2026-07-10

Status: IMPLEMENTED (2026-07-10). Addresses [adversarial-project-review-2026-07-10.md](adversarial-project-review-2026-07-10.md).
All five P0 findings were independently verified against the code and confirmed real.

**Implementation note (D3 divergence):** the plan assumed GLM-5.2 economics are present in
the DeepSWE v1.1 source. They are not — the benchmark models are claude-fable-5,
claude-sonnet-5, claude-opus-4-8, and gpt-5-5 only. Per D3's own fallback, the Z.ai study
therefore ships with `economics_gap` and no economics record (native SVI computed, no API
comparison), rather than a fabricated GLM-5.2 row. The regenerated example bundles are
non-publishable templates (`publishable: 0`, placeholder attestation/artifact SHA) pending
a real `select:tasks` run and operator isolation attestation.

## Verification of the review's P0 claims

1. **Weekly/monthly unit mix — CONFIRMED.** `analysis.ts:26` divides `quotaCapacity`
   (100 weekly-used-percent) by drain and `analysis.ts:29` divides by the 30-day
   `planPrice`. `billing_days` and `quota_unit` are never read anywhere in analysis.
2. **Published pass@1 substitutes for native success — CONFIRMED.**
   `successfulTasksPerPeriod = quotaCapacity / expectedDrain * publishedPassAt1`.
   `successCount` feeds only the report field and Wilson CI; five native failures still
   produce a positive SVI.
3. **Cross-model economics — CONFIRMED.** `claude-max-deepswe-v1.1.json` and
   `zai-lite-deepswe-v1.1.json` carry the *identical* `pass_at_1` (0.52323…) and
   `avg_cost_usd` (9.0665…) — the four-model aggregate from
   `select-deepswe-tasks.ts` (MODELS set of 4; only `gpt-5-5` gets model-specific
   columns) — labeled once as `claude-opus-4-8` and once as `glm-5.2`.
4. **Silent Claude join miss — CONFIRMED.** `database.ts` joins
   `task_costs.model = subscription_measurements.model` by exact string; the Claude
   bundle stores `claude-opus-4-8` vs `opus`, so `analyzeDatabase` returns no cell and
   `if (runs.length === 0) continue` hides it.
5. **No isolation attestation, analysis ignores validation — CONFIRMED.**
   `grep -r isolation|attestation packages/core/src` → zero hits. `validate` and
   `analyze` are independent CLI commands.

## Design decisions (methodology changes)

### D1. Canonical period = the quota window; price is prorated into it

Pick the **quota window** (weekly for OpenAI/Claude, monthly for Z.ai) as the unit of
measurement and prorate price into it, never the reverse — capacity is what we
measure, price is exact and safe to scale linearly.

- `window_price = plan.price * quota_window_days / plan.billing_days`
- `SVI = successful_tasks_per_window / window_price`

SVI becomes unit-free across providers with different windows. Reports state the
window explicitly ("tasks per 7-day quota window"). Rolling limits without a
justifiable window fail validation (reject, per the review).

Protocol change: §5 gains "Record `quota_window_days` alongside capacity; a study
whose quota window cannot be stated is not publishable."

### D2. Two explicitly named estimands; native success is primary

The review is right that one number can't serve both claims. Define both, named
honestly:

- **SVI (primary, native):** `capacity/window ÷ median_drain × native_success_rate ÷
  window_price`, where `native_success_rate = successCount/runCount` with its Wilson
  interval propagated. Five failures → SVI point estimate 0 with a wide upper bound.
  Honest, and it is what goal.md promises ("successful developer work").
- **Benchmark-equivalent throughput (secondary):** the current published-pass@1
  formula, renamed `benchmark_equivalent_tasks_per_window`, reported only as the
  API-comparison anchor (it must use published pass@1, because
  `apiCostPerSuccess` does too — that comparison is internally consistent).

Methodology change: cost-per-successful-task rule (§ drain accounting) applies to the
primary metric; document that n=5–10 gives wide native CIs and that this is a feature,
not a bug — widen the run count if the interval is too wide to publish.

### D3. Per-model economics, bound by foreign key

- `select-deepswe-tasks.ts` emits per-model rows (pass_rate, avg_cost, steps,
  duration, trial_count) for **every** model in MODELS, plus GLM-5.2 (present in the
  source per the task-selection doc). No aggregate row is emitted at all.
- Bundle schema: each `task_costs` entry is one `(benchmark_model, effort)` pair.
- Each `subscription_measurement` gains a required `task_cost_ref` (explicit FK to the
  economics record). The string-equality join in `analyzeDatabase` is deleted.
- Z.ai study binds to GLM-5.2 economics or ships without an SVI (a
  `svi: null, reason: "no compatible published economics"` result is a valid output).

This fixes P0-3 and P0-4 with one mechanism: "every measurement resolves to exactly
one economics record" becomes a validation error, and an integration test loads the
Claude bundle and asserts a non-empty analysis result.

### D4. Isolation attestation as data, fail-closed pipeline

- Schema: `subscription_measurements` gains `isolation_confirmed_at` (ISO timestamp),
  `isolation_confirmed_by` (operator string), `environment_id`; `runs` gain
  `evidence_kind` (`paired-snapshots` | `manual`) and snapshot refs.
- Runners refuse to start without `--confirm-isolation "<operator>"` (records the
  timestamp) and persist pre/post provider snapshots (OpenAI runner upgraded to match
  Claude/Z.ai).
- `validateDatabase` rejects: missing attestation, missing/unpaired snapshots (unless
  the measurement is flagged `publishable: false`), grade `unknown` capacity on a
  publishable study, unresolved `task_cost_ref`, and <5 valid runs.
- `analyze` calls `validateDatabase` first and refuses on any publishability issue
  (`--force` computes but stamps every result row `publishable: false`).
- Manual `subbench run` numeric input stays, but writes `evidence_kind: "manual"` →
  non-publishable by default.

### D5. Uncertainty: joint bootstrap (P1-1)

Replace the drain-only bootstrap: resample runs with replacement; for each resample
compute (median drain factor × success indicator mean) jointly, then form the
tasks-per-window interval from that joint distribution. Add fixed sensitivity terms
for meter rounding (±0.5 pp per snapshot for grade `rounded`) and capacity grade.
Label the output "bootstrap interval over calibration runs" — not a blanket "95% CI".

## Code changes (file-level work list)

- `packages/core/src/types.ts` — add `quotaWindowDays`, `billingDays`,
  `windowPrice`, estimand fields; rename `successfulTasksPerPeriod` →
  `nativeTasksPerWindow` + `benchmarkEquivalentTasksPerWindow`.
- `packages/core/src/analysis.ts` — implement D1/D2/D5; throw if
  `quotaWindowDays`/`billingDays` missing.
- `packages/core/src/schema.ts` — D3 FK + D4 attestation/evidence/publishable
  columns; migration for existing DBs.
- `packages/core/src/database.ts` — FK join; `analyzeDatabase` runs validation and
  fails closed; delete silent `continue` (log skipped cells into report caveats).
- `packages/core/src/validation.ts` (or `database.ts` validate) — new checks from D4.
- `packages/cli/src/index.ts` — `--confirm-isolation`, `--force`, non-publishable
  marking for manual input.
- `scripts/select-deepswe-tasks.ts` — per-model economics incl. GLM-5.2; write
  artifact SHA-256 of downloaded tasks/trials into the selection output (P2 fix).
- `scripts/run-*-calibration.ts` — attestation flag, per-model cost lookup, OpenAI
  snapshot persistence.
- Examples — regenerate all three bundles with per-model economics, matching model
  keys, window fields, and attestation placeholders.
- Tests — regression per P0: (1) weekly/monthly normalization; (2) all-failure runs →
  SVI 0; (3) bundle with aggregate economics fails validation; (4) Claude bundle
  integration test produces a result; (5) missing attestation fails validation and
  blocks analyze.

## What stays out of scope for V1 (declared, not fixed)

- Cache-behavior transfer probe (P1-3): add one synthetic cache-heavy probe task per
  cell as a *diagnostic* reported in caveats; full treatment is V2.
- Cross-source sanity check (P1-4): implement as a required manual checklist artifact
  referenced by the report, not automated scraping.

## Is the goal achievable?

Yes, in the scoped form goal.md already states. Nothing in the review breaks the
core mechanism (paired usage snapshots → drain per benchmark-equivalent dollar →
tasks per window). The two real scientific risks that remain after these fixes are
(a) the drain∝API-cost transfer assumption under caching, and (b) wide native-success
intervals at n=5–10. Both are handled by honest labeling and interval reporting, not
by more code.
