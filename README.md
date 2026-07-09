# SubBench

SubBench is an experimental benchmark for measuring AI coding subscription value per developer dollar.

Most public comparisons answer one of two questions:

- Which model or agent solves more coding tasks?
- Which model or agent is cheaper through API pricing?

SubBench focuses on the missing third question:

> How much successful developer work does a flat-rate AI subscription actually buy?

The goal is to compare plans such as Claude, OpenAI, and Z.ai using measured task outcomes, observed subscription capacity, and published or reproduced cost-per-task data.

## Core Idea

```text
subscription value =
  observed subscription capacity
  / cost per successful benchmark task
```

For developer-facing comparisons:

```text
developer value per dollar =
  successful benchmark-equivalent tasks per billing period
  / subscription price
```

## Why This Exists

Developers often compare subscriptions using anecdotes:

- "Claude feels better."
- "Codex has more usage."
- "Z.ai is cheaper."
- "This plan hits limits too fast."

Those claims may be true for a given workflow, but they are usually not backed by reproducible data. SubBench aims to make those comparisons measurable.

## Project Status

V1 is implemented as a Bun workspace monorepo using TypeScript 7. It imports published task economics,
captures subscription calibration runs, validates the measurement protocol, calculates
confidence-aware value metrics, and exports publication-ready reports.

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
  -- your-test-command
```

A zero command exit status counts as success. Use the run flags to preserve retries,
limit events, promotions, peak hours, and drain-cap aborts.

For an automated usage indicator, replace both explicit usage values with
`--usage-command 'provider-usage --numeric'`; SubBench invokes it immediately before and
after the task. In an interactive terminal, `--post-usage` may be omitted and SubBench
will prompt after the run.

For the OpenAI Plus/DeepSWE study, regenerate the balanced eight-task selection and run
the next unmeasured task with:

```bash
bun run select:tasks
bun run subbench codex-usage --window weekly --format json
bun run calibrate:openai
```

The calibration runner uses the authenticated Codex CLI through Pier's isolated Docker
environment, reads the rolling weekly percentage through Codex's app-server protocol,
grades with DeepSWE's verifier, and records the result in `openai-plus.db`. Runs are
sequential, and the runner refuses to start at 70% or more five-hour usage so that the
short window does not bind during a measured task.

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
- [Relevant Research](docs/research.md)
- [ClaudeBar Provider-Usage Research and Implementation Plan](docs/claudebar-provider-research.md)
- [Methodology](docs/methodology.md)
- [Measurement Protocol](docs/protocol.md)
- [OpenAI Plus Calibration Status](docs/openai-plus-calibration-status.md)

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
