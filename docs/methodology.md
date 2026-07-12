# Methodology

SubBench combines two measurements:

1. Task economics: how much capacity a successful benchmark task consumes.
2. Subscription capacity: how much usable capacity a subscription provides.

The benchmark value comes from joining those two sides.

## Formula

The canonical unit is the **quota window** (weekly or monthly), not the billing period.
Capacity is measured against the window; the price is prorated into it.

```text
window_price = subscription price × quota_window_days / billing_days
```

Two estimands are reported, named honestly:

```text
# PRIMARY (native): what goal.md promises — successful developer work.
native tasks per window =
  observed capacity × sum(task weight × success)
  / sum(task weight × observed quota drain)

Subscription Value Index (SVI) =
  native tasks per window / window_price
```

```text
# SECONDARY (benchmark-equivalent): the API-comparison anchor only.
benchmark-equivalent tasks per window =
  observed capacity / (published avg cost per task × conversion factor)
  × published pass@1
```

The primary metric uses **all observed native drain** from the calibration runs (five
failures give an SVI point estimate of 0 with a positive upper sensitivity bound — honest,
not a bug). The
secondary metric uses published pass@1 because the API comparison
(`api cost per success = avg cost / pass@1`) must be internally consistent with it. When
no compatible published economics exist, the secondary metric and API comparison are
omitted and the measurement records an `economics_gap`; the primary native metric is still
produced.

## V1 Strategy

V1 does not re-run task evaluations. Task economics (pass rate, cost per task) come from
a published benchmark source; SubBench's original measurement is subscription capacity
plus a small calibration layer that converts published API cost into subscription-quota
units.

1. Adopt one published benchmark as the task-economics source (see Task Cost Sources).
   It supplies pass@1, avg cost per task, and output tokens per model.
2. Build a drain-tracking harness: for each (provider, plan, model, product surface),
   run the frozen workload through the subscription product, recording paired usage
   snapshots before and after each task.
3. Measure total usable capacity per billing period via the same usage indicators
   (and depletion experiments where indicators are too coarse).
4. Native tasks per window = capacity × weighted successful tasks ÷ weighted all-attempt
   quota drain, with failed-attempt drain accounted per the Cost Accounting Rule.
   The benchmark-equivalent secondary metric substitutes published pass@1 for the native
   rate and is reported only as the API-comparison anchor.
5. Publish measurement grade and uncertainty for every estimate. Resampling preserves
   task-clustered outcome/drain pairs; a Wilson envelope prevents an all-failure interval
   from degenerating to zero. Label it an "uncertainty/sensitivity interval for fixed runs",
   not a blanket 95% CI, until its coverage and meter-error model are established.

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

Prompt-cache state is a measurement condition. Providers cache prompt prefixes
server-side (Anthropic: 5-minute default TTL, refreshed on each hit, with an optional
1-hour extended TTL; API cache reads bill at ~0.1× input price). If the quota meter
discounts cache reads the way the API does — the unresolved cache-weighting question in
V1 Open Questions — then a run that hits a warm cache from a previous run of the *same*
task drains materially less quota than a cold run, corrupting the drain estimate.
Within-run caching is intrinsic to the harness and representative of real use; the
distortion is cross-run. The benchmark source cannot control this — cache state is a
property of the measurement account and run scheduling, so the protocol carries the
operational rule (§4): never launch an identical task twice within the provider's cache
TTL. Run timestamps (already required) make cache adjacency auditable.

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

## Account Isolation

Environment isolation is not enough: providers share quota across product surfaces
(Claude shares limits across Code, chat, and Cowork; ChatGPT shares agentic credits
across surfaces). Any usage on another surface during a measurement window silently
inflates observed drain.

The measurement account must be dedicated to SubBench, or verified idle on all other
surfaces for the entire measurement window. Any concurrent non-measurement usage on
the account invalidates the window.

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

- Exact: precise quota deltas are available. For Claude cells, exact utilization
  floats can be recovered from `message_limit` objects in Claude.ai SSE response
  bodies (she-llac/claude-counter methodology). This technique rests on a single
  unreplicated source: validate the SSE-derived values against displayed
  percentages during the first runs of each Claude cell before relying on them.
- Rounded: only rounded usage percentages are available. Rounding adds quantization
  error on the order of ±1 point per run, and per-run relative error scales inversely
  with drain size. Drain size is plan-dependent: the percent meter measures the plan's
  quota, so the same task drains proportionally fewer points on a large-quota plan.
  A 5-6 point drain (~±20%/run) is plausible on a $20 tier; on Claude Max ($100) the
  observed drain is 1-2 points per DeepSWE task, making a single-task delta ±50-100% —
  individually uninterpretable. Expect coarser per-task resolution the bigger the plan.
  Mitigations: (a) paired snapshots over contiguous runs telescope, so the batch-level
  delta (first pre-usage to last post-usage) is one ±1-point measurement regardless of
  batch size — error on mean drain per task falls as ±1/N points, making batch length
  the primary resolution knob; (b) costlier tasks drain more points per run and lift
  the signal above the rounding floor, but the calibration sample must still match the
  benchmark's cost distribution — until the cache-weighting question (see V1 Open
  Questions) is settled, drain cannot be assumed linear in API cost, so a
  hard-task-skewed sample biases mean drain unless explicitly reweighted. Estimate
  mean drain per task from batch-level deltas; treat per-task rounded deltas as
  descriptive only, and never draw per-task conclusions (e.g. drain vs API cost
  correlation) from them.
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

Cost per successful task includes the quota drain of failed attempts and retries. This
applies to the **primary native** metric: the native success rate that scales capacity is
`successCount / runCount` over all attempts, so failed and retried attempts consume the
window without producing a success.

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
break-even utilization (tasks per quota window) =
  window_price / API cost per successful task
```

The subscription side of the comparison uses SVI (native tasks per window per
window-dollar). The API side uses published pass@1, so the comparison is internally
consistent only against the benchmark-equivalent estimand; the report labels it as such.
When a measurement carries an `economics_gap` (no compatible published economics), the API
comparison and break-even are omitted entirely.

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

Rejected for V1 — SWE-Lancer: despite its attractive economic framing (real Upwork
payouts), it publishes no per-model, per-task cost artifacts of the kind the V1
economics import requires, is OpenAI-controlled, and is single-repo (Expensify).
It remains a V2 candidate for a "developer value" framing. Do not re-litigate this
choice without new evidence that per-trial cost data has been published.

Other published cost data (Artificial Analysis, SWE-bench Pro, SWE Atlas) is used only
to sanity-check that adopted costs are plausible.

Cross-source sanity check (required at publish time): benchmark pass rates are
gameable, and V1 trusts a single source. Before publishing, compare the adopted
source's pass@1 and cost-per-task against independent sources (Aider leaderboard,
MorphLLM, Ivern AI) for the same models, and flag any wild divergence in the
report's caveats. This is a plausibility check, not re-measurement.

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
