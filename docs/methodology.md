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

V1 should avoid running a full benchmark suite from scratch.

Instead:

1. Reuse published benchmark cost-per-task data where available.
2. Run small calibration tasks only where needed.
3. Experimentally measure subscription quota drain and limit behavior.
4. Publish confidence levels for every estimate.

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

## Quota Confidence Levels

Each capacity estimate should be labeled:

- Exact: precise quota deltas are available.
- Rounded: only rounded usage percentages are available.
- Inferred: quota is inferred from depletion experiments.
- Unknown: insufficient data.

Never mix confidence levels without showing them.

## Task Cost Sources

Preferred order:

1. Published benchmark task-level cost and success data.
2. Published benchmark aggregate cost per successful task.
3. Small reproduced benchmark subset.
4. Synthetic fixed-task estimate.

The first V1 should prefer Artificial Analysis, DeepSWE, SWE-bench Pro, Terminal-Bench, or SWE Atlas data over inventing a custom task set.

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
- product surface
- benchmark source
- task id
- start time
- end time
- pre-run usage
- post-run usage
- usage delta
- success
- retries
- limit event
- notes

## V1 Report Shape

Each result should include:

- plan name
- price
- measurement window
- benchmark task source
- cost per successful benchmark task
- observed capacity estimate
- estimated successful tasks per billing period
- tasks per dollar
- confidence level
- caveats

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

- Which published benchmark has the cleanest accessible task-cost data?
- Which provider surfaces expose reliable usage deltas?
- Can OpenAI and Z.ai subscription capacity be inferred without violating terms or relying on fragile internals?
- How much calibration is needed to map API benchmark cost to subscription product behavior?
- Should the first public score use weekly or monthly normalization?
