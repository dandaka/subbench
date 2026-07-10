# Tier A methodology decision record

Date: 2026-07-10  
Maintainer/reviewer: project maintainer (self-review)

## Decision

The frozen eight-task manifest is the complete Tier A target population. Tasks have equal
weight (`w_i = 1`). The primary estimand is:

```text
native successful tasks per quota window =
quota capacity × sum(w_i × success_i) / sum(w_i × quota_drain_i)
```

Failures, retries, limit interruptions, and predeclared aborts remain in the denominator.
Median and p90 drain are diagnostics only. The point estimate is descriptive for this fixed
set and does not generalize to DeepSWE or developer work generally.

The secondary benchmark-equivalent estimand is `capacity / weighted subscription drain per
benchmark attempt × compatible published pass@1`. The API multiple uses that secondary
estimand, not native SVI. Missing compatible model/version/effort/config economics is an
explicit gap and omits the API comparison.

## Uncertainty decision

Runs are resampled by task cluster with a deterministic seed, preserving the outcome/drain
pair. At the all-failure boundary, a Wilson success-rate envelope supplies a positive upper
sensitivity bound because a percentile bootstrap alone degenerates at zero. This is labeled
an uncertainty/sensitivity interval for fixed runs, not a calibrated confidence interval.
No fixed capacity-grade percentage multiplier is used; a publishable meter-error model is
still required per cell.

## Rejected alternatives

- Median conversion factor × unweighted success rate: rejects failure drain.
- Native SVI divided by API tasks/dollar: mixes native and neutral-harness estimands.
- Ordinary bootstrap only: gives `[0,0]` with zero successes.

## Collection checklist

- [x] Equal fixed-set weights selected.
- [x] Every attempt contributes drain.
- [x] Per-run isolation and paired-snapshot evidence required by code.
- [x] Freeze immutable DeepSWE/source/container lock before fresh collection
  (`data/deepswe-v1.1.lock.json`, 2026-07-10).
- [x] Declare task order (`subbench-tier-a-2026-07-10`) and abort schedule (after three
  normal tasks, three times median drain). A publishable reset/meter-error model remains
  required per cell.
