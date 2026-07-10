# Statistical self-review — Tier A implementation

Date: 2026-07-10  
Reviewer: project maintainer (not independent)

Reviewed implementation: `packages/core/src/analysis.ts` and its regression tests.

- [x] Point estimate is capacity × weighted successes / weighted total drain.
- [x] Failures and expensive failures affect the primary estimate.
- [x] All-failure point estimate is zero and upper SVI sensitivity bound is positive.
- [x] Resampling is deterministic and task-clustered when `task_id` is present.
- [x] Published API multiple uses benchmark-equivalent, not native, throughput.
- [x] Existing interval is explicitly a fixed-run sensitivity interval, not population coverage.
- [ ] Meter rounding/capacity/reset error model is not yet specified; no cell may claim Tier A
  publication until it is recorded and tested.
- [ ] Coverage simulation, population sampling, and independent review are Tier B work.

Known limitation: the Wilson envelope is deliberately conservative at the zero-success
boundary and is not a validated posterior or frequentist ratio interval.
