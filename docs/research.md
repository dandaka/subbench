# Relevant Research

SubBench builds on existing work in coding-agent benchmarking, model cost analysis, and subscription-limit reverse engineering.

## Coding-Agent Benchmarks

### Artificial Analysis Coding Agent Index

Artificial Analysis measures coding-agent performance across benchmark suites and reports:

- pass@1
- token usage
- cache usage
- API cost per task
- wall-clock time
- harness comparisons

This is the closest existing source to the denominator SubBench needs: cost per successful coding task.

Source: https://artificialanalysis.ai/agents/coding-agents

### DeepSWE

DeepSWE is a long-horizon coding benchmark with original tasks across many repositories and languages. It reports:

- pass@1
- average cost
- output tokens
- agent steps

It is useful because it avoids some contamination problems in older coding benchmarks and includes cost data.

Source: https://deepswe.datacurve.ai/

### SWE-bench and SWE-bench Pro

SWE-bench established the standard pattern of testing whether agents can resolve real repository issues. SWE-bench Pro attempts to address contamination, task diversity, oversimplification, and unreliable test environments.

SWE-bench Verified is still useful historically, but it is not ideal as the only benchmark for frontier coding agents.

Sources:

- https://www.swebench.com/
- https://labs.scale.com/leaderboard/swe_bench_pro_public
- https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/

### Terminal-Bench

Terminal-Bench evaluates agents on terminal-based tasks, including software engineering, system administration, data processing, model training, and security workflows.

It is useful for measuring agentic workflows that are not only patch generation.

Source: https://www.tbench.ai/

### SWE Atlas

SWE Atlas evaluates professional software engineering tasks beyond issue resolution, including codebase Q&A, test writing, and refactoring.

Source: https://github.com/scaleapi/SWE-Atlas

## Cost-Per-Task Research

### Artificial Analysis Cost Per Task

Artificial Analysis argues that cost per task is more informative than price per million tokens because models differ in token efficiency, reasoning behavior, caching, and output length.

Their cost metric uses observed token consumption and provider pricing rather than assuming every model consumes the same number of tokens.

Source: https://artificialanalysis.ai/methodology

### Price Per 1M Tokens Is Meaningless

Jan Ilowski's article summarizes why per-token pricing is a weak comparison metric. A model with cheaper tokens can be more expensive per successful task if it needs more tokens, more reasoning, or more attempts.

Source: https://janilowski.pl/en/blog/2026/price-per-m-tokens/

### PointFive Coding Task Index

PointFive proposes a simple fixed-task cost comparison using a standard coding task of 200K input tokens and 30K output tokens. This is useful for communication, but weaker than measuring actual benchmark task runs.

Source: https://www.pointfive.co/blog/the-pointfive-coding-task-index

## Agent Token Consumption Research

The Stanford Digital Economy Lab paper "How Do AI Agents Spend Your Money?" studies token consumption in agentic coding tasks. It finds that agentic tasks are expensive, input tokens dominate cost, token use is highly variable, and higher token usage does not necessarily imply higher accuracy.

Source: https://digitaleconomy.stanford.edu/publication/how-do-ai-agents-spend-your-money-analyzing-and-predicting-token-consumption-in-agentic-coding-tasks/

## Subscription-Limit Research

### Claude Limits Reverse Engineering

The Claude limits article demonstrates a method for inferring hidden subscription capacity from precise usage floats. It reconstructs internal plan credit limits and maps usage to token-equivalent/API-equivalent value.

This is the closest existing work to the numerator SubBench needs: observed subscription capacity.

Source: https://she-llac.com/claude-limits

Related tool: https://github.com/she-llac/claude-counter

### Multi-Provider Usage Collection

ClaudeBar is an open-source macOS quota monitor with separate collectors for Claude,
Codex, Z.ai, OpenCode Go, Cursor, Copilot, Gemini, and other coding tools. Its provider
layer demonstrates several practical quota interfaces, including Codex app-server RPC,
Claude's OAuth usage endpoint, and Z.ai's quota endpoint.

SubBench's study distinguishes server-reported quota data from CLI display parsing and
local reconstruction, then turns those findings into a provider-neutral implementation
plan.

Sources:

- https://github.com/tddworks/ClaudeBar
- [ClaudeBar provider research and implementation plan](claudebar-provider-research.md)

## Gap

Existing work can answer:

- Which coding agent solves more tasks?
- Which model is cheaper per API task?
- Which harness uses fewer tokens?
- How expensive are agentic coding tasks?
- What are Claude's hidden quota mechanics?

Existing work does not yet answer:

- How many successful benchmark-equivalent tasks does each subscription plan actually buy?
- How do Claude, OpenAI, and Z.ai subscriptions compare under the same task economics?
- What is the API-equivalent value multiple of each subscription?
- How confident are the quota estimates?

SubBench targets that gap.
