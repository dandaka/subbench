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

Early proof of concept.

V1 should not try to invent a new coding benchmark. It should reuse existing benchmark economics where possible and focus on the missing layer: subscription capacity and yield.

## Docs

- [Goal](docs/goal.md)
- [Relevant Research](docs/research.md)
- [Methodology](docs/methodology.md)

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

TBD.
