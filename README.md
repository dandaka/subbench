# Subbench

Subbench is developing a calibration framework; subscription value has not yet been measured.

Most public comparisons answer one of two questions:

- Which model or agent solves more coding tasks?
- Which model or agent is cheaper through API pricing?

Subbench focuses on the missing third question:

> How much successful developer work does a flat-rate AI subscription actually buy?

The goal is to support a future fixed-set comparison using measured task outcomes, observed subscription capacity, and compatible benchmark economics. It does not currently support a provider ranking.

## Core Idea

```text
subscription value =
  observed subscription capacity
  × successful tasks / all observed quota drain
```

For developer-facing comparisons:

```text
developer value per dollar =
  successful benchmark-equivalent tasks per billing period
  / subscription price
```

## How the Comparison Works

1. Define a measurement cell: `(provider, plan, model, product surface)`. V1
   measures each plan's default model and one flagship model separately.
2. Run the same balanced set of eight DeepSWE calibration tasks in a clean,
   pinned environment. The tasks cover five languages and include easy, typical,
   and high-cost work.
3. Before and after every task, capture the subscription usage indicator. Record
   success or failure, retries, throttles, elapsed time, and aborts; failed
   attempts remain in the data because they consume quota.
4. Measure usable quota capacity in its native weekly or monthly window and
   prorate the subscription price to that same window.
5. Calculate the primary result directly from observed drain: capacity × successful
   tasks / all observed quota drain. This produces native tasks per quota window and
   the Subscription Value Index (tasks per window-dollar).
6. Separately, use published pass@1 to calculate benchmark-equivalent throughput,
   API cost per success, and the subscription/API break-even point.

Every run requires a recorded account-isolation confirmation: no other sessions,
agents, automations, or teammates may consume the same subscription during the
measurement window. See the [measurement protocol](docs/protocol.md) for the
full requirements.

### Test Volume and Result Quality

Each cell needs at least **5 valid task runs** to be publishable. The target is
**8 runs per cell**—one per selected calibration task—and it can increase to
**10** when the bootstrap interval is too wide. A plan with a default and a
flagship model therefore needs about **16 task attempts**, plus capacity
observations.

Until Tier A validation passes for at least two comparable cells, reports are methods or
diagnostic outputs only. A later Tier A result applies only to its frozen calibration set;
it is not a universal provider ranking. Reports show the sample size, median and
p90 drain, measurement grade, and bootstrap interval; with only 5–10 runs, wide
intervals are expected, particularly when the usage meter is rounded or quota drain
is heavy-tailed.

## Why This Exists

Developers often compare subscriptions using anecdotes:

- "Claude feels better."
- "Codex has more usage."
- "Z.ai is cheaper."
- "This plan hits limits too fast."

Those claims may be true for a given workflow, but they are usually not backed by reproducible data. Subbench aims to make those comparisons measurable.

## Project Status

The calibration pipeline and frozen DeepSWE v1.1 study inputs are in place. No
subscription comparison has been measured or published: the examples and frozen
pre-collection bundles are non-publishable until the protocol's evidence and collection
requirements are met.

## Quick Start

Requires Bun 1.3.14.

```bash
bun install

bun run subbench --db demo.db init
bun run subbench --db demo.db load examples/synthetic.json
bun run subbench --db demo.db validate
bun run subbench --db demo.db analyze --format markdown
```

The example is explicitly synthetic; it tests the pipeline and is not a claim about any
provider. Real studies should copy its bundle structure and follow the
[measurement protocol](docs/protocol.md).

Capture a calibration task after creating and loading its measurement metadata:

```bash
bun run subbench --db study.db run \
  --measurement-id 1 --benchmark-source-id 1 \
  --task-id task-001 --environment clean-image-sha256 \
  --pre-usage 12 --post-usage 18 --api-cost 1.42 \
  --confirm-isolation "operator name" \
  -- your-test-command
```

A zero command exit status counts as success. Use the run flags to preserve retries,
limit events, promotions, peak hours, and drain-cap aborts.

For an automated usage indicator, replace both explicit usage values with
`--usage-command 'provider-usage --numeric'`; Subbench invokes it immediately before and
after the task. In an interactive terminal, `--post-usage` may be omitted and Subbench
will prompt after the run.

For a real DeepSWE study, first inspect and verify the already frozen input lock:

```bash
bun run verify:deepswe-lock
```

Only then follow the [measurement protocol](docs/protocol.md), including its mandatory
per-run isolation attestation, before using a provider-specific calibration runner.

## Monorepo

- `packages/core` — SQLite schema, ingestion, validation, statistics, analysis, reports
- `packages/cli` — `subbench` command and calibration process runner

Run `bun run check` to type-check every workspace with TypeScript 7 and execute all tests.

## V1 Outputs

- normalized SQLite source data and computed results
- median and p90 quota drain plus bootstrap confidence intervals
- successful tasks per billing period and Subscription Value Index
- API cost per success, value multiple, and break-even utilization
- measurement grade, sample size, success rate, timing, and limit interruption rate
- JSON, CSV, and Markdown reports with the harness-mismatch and staleness caveats

## Docs

- [Goal](docs/goal.md)
- [Methodology](docs/methodology.md)
- [Measurement Protocol](docs/protocol.md)
- [Frozen calibration tasks](docs/calibration-tasks.md)
- [Claude Max runbook](docs/running-claude-max-calibration.md)
- [Research context](docs/research.md)
- [Project log](docs/log.md)

## Initial Scope

Target providers:

- Anthropic (Claude)
- OpenAI (Codex)
- Z.AI
- OpenCode Go

Target workload:

- coding-agent tasks
- bug fixes
- repo Q&A
- test writing
- refactoring
- terminal-based engineering tasks

## Non-Goals

- Ranking models by general intelligence.
- Claiming one provider is universally best.
- Treating advertised subscription limits as ground truth.
- Treating price per million tokens as a sufficient cost metric.

## License

MIT.
