# Methodology

SubBench combines two measurements:

1. Task economics: how much capacity a successful benchmark task consumes.
2. Subscription capacity: how much usable capacity a subscription provides.

The benchmark value comes from joining those two sides.

## Formula

```text
estimated successful tasks per billing period =
  observed subscription capacity
  / cost per successful benchmark task
```

```text
Subscription Value Index =
  estimated successful tasks per billing period
  / subscription price
```

## V1 Strategy

V1 does not re-run task evaluations. Task economics (pass rate, cost per task) come from
a published benchmark source; SubBench's original measurement is subscription capacity
plus a small calibration layer that converts published API cost into subscription-quota
units.

1. Adopt one published benchmark as the task-economics source (see Task Cost Sources).
   It supplies pass@1, avg cost per task, and output tokens per model.
2. Build a drain-tracking harness: for each (provider, plan, model, product surface),
   run a small calibration workload (~5-10 tasks) through the subscription product,
   recording usage indicators before and after each task. This yields a conversion
   factor: subscription-quota drain per API-equivalent dollar.
3. Measure total usable capacity per billing period via the same usage indicators
   (and depletion experiments where indicators are too coarse).
4. Estimated tasks per billing period = capacity ÷ (published cost per task ×
   conversion factor) × pass@1, with failed-attempt drain accounted per the Cost
   Accounting Rule.
5. Publish measurement grade and statistical confidence for every estimate.

### Harness Mismatch Disclaimer

Published task economics are measured under the benchmark's own isolated harness
(e.g. DeepSWE runs all models on mini-swe-agent), not under each subscription product's
native harness (Claude Code, Codex CLI, etc.). Native harnesses differ in system prompts,
tools, and caching, so both cost-per-task and success rate will deviate from published
numbers.

V1 accepts this deliberately: a single neutral harness is more isolated and more
comparable across models than four different product harnesses. Every V1 result carries
this disclaimer. Running the full task set natively through each subscription product
is marked as a future improvement (see V2 Directions).

## Measurement Unit

The unit of comparison is the tuple:

```text
(provider, plan, model, product surface)
```

The same nominal model behaves differently across plans: quota accounting units, caching,
harness overhead, and throttling all differ. Plan-level numbers without a model are not
comparable.

V1 scope: for each plan, measure the default model plus one flagship model.
The full model matrix is deferred to V2.

## Limit Scope

SubBench tracks weekly and monthly limits only. Short-window limits (e.g. 5-hour session
windows) are out of scope: they shape burst ergonomics, not billing-period yield. Runs
should be paced so session limits never bind; if a session limit interrupts a run anyway,
record it as a limit event and note it in caveats.

## Measurement Conditions

Quota behavior depends on conditions that providers vary openly. Every run must record:

- peak hours: true/false (provider-local definition where published)
- active promotions or bonuses (e.g. Z.AI grants +50% limits when using the desktop app)
- product surface used (CLI, desktop app, IDE extension, web)
- plan terms snapshot date and model version

Results measured under a bonus or promotion are reported separately, never averaged into
baseline capacity.

## Harness Isolation

Applies to calibration and capacity runs (task economics come pre-isolated from the
published benchmark source).

The user's installed tools and configuration contaminate measurements: MCP servers, custom
instructions, hooks, and shell environment all change token consumption and agent behavior.

All runs use a clean, reproducible environment:

- fresh OS user or container per provider (Docker image preferred)
- default product configuration: no MCP servers, no custom instructions or rules files,
  no plugins, no hooks
- pinned CLI/app version, recorded per run
- identical repo checkout and task prompt across providers
- a published setup script so anyone can reproduce the harness from zero

Any deviation from the clean environment invalidates the run.

## Provider Measurement

For each provider and plan:

- record subscription price
- record billing period
- record available product surfaces
- record model or agent used
- record usage before task
- run controlled task or task-equivalent workload
- record usage after task
- record whether limits or throttles appeared
- estimate remaining capacity
- repeat across multiple sessions and days

## Measurement Grade and Statistical Confidence

These are two separate dimensions and must never be conflated.

Measurement grade — quality of the quota data source:

- Exact: precise quota deltas are available.
- Rounded: only rounded usage percentages are available.
- Inferred: quota is inferred from depletion experiments.
- Unknown: insufficient data.

Statistical confidence — reliability of the estimate itself:

- report n (runs per task, tasks per cell) for every number
- report confidence intervals for success rate and drain (bootstrap where distribution
  is unknown)
- quota drain is heavy-tailed: one runaway session can consume 10x the median.
  Report median and p90 drain, never mean alone, and define a per-task abort rule
  (e.g. stop at 3x median expected drain, count as failure).

Never mix grades or hide n.

## Cost Accounting Rule

Cost per successful task includes the quota drain of failed attempts and retries:

```text
drain per successful task =
  total drain across all attempts (successes + failures + retries)
  / number of successful tasks
```

## Subscription vs Usage-Based (API) Comparison

A second goal of the benchmark: for the same model, compare buying a flat-rate
subscription against paying for API tokens directly. The API side requires no new
measurement — it is arithmetic on the published task-economics data.

### API side

```text
API cost per successful task =
  published avg cost per task / pass@1
  (failed attempts and retries included, per the Cost Accounting Rule)

API tasks per dollar = 1 / API cost per successful task
```

### Comparison metrics

```text
API-equivalent value multiple =
  subscription tasks per dollar / API tasks per dollar
```

Read as: "at full quota utilization, this plan delivers N× the successful work of the
same spend on API tokens."

```text
break-even utilization (tasks per billing period) =
  subscription price / API cost per successful task
```

Break-even is the more decision-relevant number: the value multiple assumes the quota
is fully drained, which real users rarely do. Below break-even tasks per period,
pay-as-you-go is cheaper; above it, the subscription wins. Report both, but lead with
break-even.

### Scope and caveats

- The comparison is same-model only: it is meaningful per (provider, model).
  Cross-provider multiples inherit all existing disclaimers.
- The Harness Mismatch Disclaimer applies to the API side too: published API costs
  come from the benchmark's neutral harness, while a real API user would run the
  provider's native agent (Claude Code, Codex CLI), whose caching and scaffolding
  change cost materially.
- Use the same published effort level on both sides (per Task Cost Sources).
- Real-world API cost is sensitive to prompt-cache hit ratio and batch discounts,
  which can shift cost several-fold depending on workload. V1 notes this as a caveat
  and uses published costs as-is.

## Nonstationarity

Providers change limits, models, and plan terms frequently. Every result carries:

- plan terms snapshot (price, advertised limits, date)
- model version and product version
- measurement window dates
- an explicit staleness warning after the window ends

The pipeline should be cheap to re-run so results can be refreshed periodically rather
than treated as permanent.

## ToS Position

Depletion experiments and scripted product usage may conflict with provider terms of
service. SubBench accepts this risk: measurements are ordinary product usage at realistic
volumes, performed on paid accounts, published in aggregate. No internal APIs are reverse
engineered beyond reading usage indicators the product already displays.

## Task Cost Sources

SubBench does not invent or re-run tasks. Task economics come from a published benchmark
that reports per-model cost data.

Primary candidate — DeepSWE (deepswe.datacurve.ai):

- 113 contamination-free tasks written from scratch across 91 repos, 5 languages
- publishes pass@1 with confidence intervals, avg cost per task, output tokens, and
  agent steps per model
- all models run on mini-swe-agent, so cross-model numbers are directly comparable
- covers current flagship models (Fable 5, GPT-5.5, Sonnet 5, Opus 4.8, GLM-5.2, ...)

Secondary candidate — FrontierCode 1.1 (cognition.com/blog/frontier-code-1.1):

- 150 tasks from real open-source PRs; grades code quality, not just correctness
- allows fair internet use with an unfair-use verifier
- caveat: published as leaderboard scores; per-task cost/token data availability
  needs verification before it can serve as an economics source

When pulling published numbers, use the effort level closest to each subscription
product's default configuration.

Other published cost data (Artificial Analysis, SWE-bench Pro, SWE Atlas) is used only
to sanity-check that adopted costs are plausible.

## Success Definition

A task is successful only when it passes the benchmark's own success rule.

Examples:

- tests pass
- verifier passes
- benchmark judge assigns positive score
- patch resolves issue without regression
- expected file output is accepted

For developer-specific experiments, an accepted task should also record whether a human would keep the output without major rewrite.

## Metrics

Primary:

- Subscription Value Index

Secondary:

- successful tasks per dollar
- estimated successful tasks per month
- API-equivalent subscription value
- API-equivalent value multiple
- break-even utilization (tasks per billing period)
- observed quota per week
- quota drain per task
- success rate
- median task time
- retry count
- limit interruption rate
- confidence level

## Data Schema

Minimum tables:

- providers
- plans
- benchmark_sources
- task_costs
- subscription_measurements
- runs
- results

Minimum run fields:

- provider
- plan
- model
- model version
- product surface
- product version
- harness environment id
- benchmark source
- task id
- start time
- end time
- peak hours flag
- promotion/bonus flag
- pre-run usage
- post-run usage
- usage delta
- success
- retries
- limit event
- aborted (hit drain cap)
- notes

## V1 Report Shape

Each result should include:

- plan name and price
- model and model version
- product surface (with any surface bonus noted)
- measurement window and conditions (peak hours, promotions)
- benchmark task source
- median and p90 drain per successful task
- measured successful tasks per billing period (with CI and n)
- tasks per dollar
- measurement grade
- caveats and staleness date

## Claims Policy

SubBench should make scoped claims only.

Good:

```text
On this task mix, during this measurement window, Plan A produced more benchmark-equivalent successful coding tasks per dollar than Plan B.
```

Bad:

```text
Plan A is the best AI subscription.
```

## V1 Open Questions

- Which calibration tasks best represent the published benchmark's cost distribution
  (drain is heavy-tailed; a 5-10 task sample must not be all-cheap)?
- Which provider surfaces expose reliable usage deltas (exact vs rounded)?
- Does each provider's quota meter price cache reads the same way its API does?
  If yes, drain is linear in API-equivalent cost and one conversion factor suffices.
  If the meter weights cache tokens differently (raw token counts, per-message credits),
  the factor depends on the workload's cache ratio. Test: compare drain-per-API-dollar
  between one cache-heavy task and one cache-light task per plan.
- Does FrontierCode publish per-task cost/token data anywhere (API, dataset release)?
- Should the first public score use weekly or monthly normalization?

## V2 Directions

- Community usage-report database: users submit observed quota drain and limit events
  from their own accounts, with measurement grade "reported". Enables continuous
  updates and detection of silent limit changes. Requires validation rules and
  outlier filtering before reported data influences any published score.
- Native-harness task economics: run the full task set through each subscription
  product's own harness, removing the harness-mismatch disclaimer and capturing
  product-level differences (system prompts, caching, agent scaffolding).
- Full model matrix per plan.
- Per-task-class SVI breakdown instead of a single index.
