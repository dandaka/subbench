# V1 Measurement Protocol

## 1. Freeze the cell

A cell is `(provider, plan, model, product surface)`. Record the model and product
versions, plan terms snapshot, measurement dates, peak-hours state, and promotions.
Measure the default and one flagship model per plan. Never combine promotion and baseline
runs.

The pinned model is not guaranteed to be the served model: providers substitute snapshots
or route across tiers sharing infrastructure (Systima observed Fable 5 requests answered
alternately by `claude-fable-5` and `claude-opus-4-8`, July 2026). Where the product
surface exposes the served model (response metadata, transcript, or verbose/debug
output), record it per run; where it does not, record `served model: unobservable` once
per cell so the gap is explicit rather than silent.

**The tokenizer generation is part of the model identity.** Anthropic's new tokenizer
(Opus 4.8, Sonnet 5, Fable 5) emits ~30% more tokens than the previous one (Opus 4.6,
Sonnet 4.6) for identical content at the same list price (Playcode, July 2026 —
research.md → *Tokenizer Divergence*). If the meter is token-denominated, the same task
drains ~30% more across that boundary before any capability difference. Record the
tokenizer generation alongside the served model, and never compare drain or reuse
calibration factors across tokenizer generations without renormalizing. Note that the
Fable 5 ↔ Opus 4.8 substitution observed by Systima stays within one generation; a
4.6 ↔ 4.8 substitution would not, and would put the two runs on different denominators.

**Verify the run drains the subscription meter, not API/credit billing.** Some invocation
modes silently bill at raw API or per-credit rates instead of the flat-rate subscription
quota — e.g. Claude Code headless `claude -p` / the Agent SDK credit path can fall under
API-plan billing rather than the Max weekly meter (HN 48129753, 2026). A run that drains a
credit balance or API spend rather than the subscription window measures the wrong meter
and is invalid. Before the first measured task in a cell, confirm the subscription meter
actually moves: read the subscription usage indicator (§5) before and after a throwaway
warmup task and verify the subscription window drained (not a credit/dollar overage
balance). Record `meter_verified: subscription` per cell; if the mode bills API/credits
instead, the cell is measured on the wrong denominator and must be reconfigured (use the
interactive subscription surface) before any run counts.

## 2. Prepare isolation

Build the repository `Dockerfile`, or use a fresh OS account when the subscription client
cannot run in a container. Install only the pinned provider client. Do not add MCP servers,
plugins, hooks, rules, custom instructions, or unrelated environment variables. Record a
stable environment identifier.

**Mandatory operator check — confirm before every run.** Subscription usage is billed per
account, not per machine, so any other call against the same subscription during the
measurement window contaminates the result. Before starting a run, the operator must
manually verify and explicitly confirm that nothing else is consuming the subscription:

- No other Claude Code sessions (other terminals, IDE extensions, desktop or web app).
- No background agents, cron jobs, scheduled tasks, or `/loop` runs on the same account.
- No MCP servers, daemons, or automations (watchers, bots) that call the model.
- No teammates sharing the same seat making concurrent calls, from any machine.

The operator records this confirmation (checkbox or signed line in the run log) before the
first measured task. A run without a recorded confirmation is invalid and must be discarded.

For Claude Code on the local measurement machine, run the documented local-session
inventory before this attestation. It may gracefully terminate local CLI sessions only
with an explicit operator flag; it is not an account-wide guarantee and does not replace
checking browser sessions, other machines, automation, API callers, or shared-seat users.
The Claude calibration runbook's every-run launch checklist specifically requires quitting
the Claude Code desktop app, cmux, and Dayflow; logging out on other machines; and then
re-running the local inventory until it reports no Claude CLI sessions.

## 3. Import economics

Transcribe the adopted benchmark snapshot into a JSON bundle. Preserve its neutral
harness, effort level, model version, sample size, pass@1, and average cost per attempted
task. Keep a dated source URL. Do not silently combine effort levels.

Economics are **per model**: each `task_costs` entry is one `(benchmark_model, effort)`
pair with that model's own pass@1 and cost. Never label a cross-model aggregate as a
single model. Each measurement binds to exactly one economics record by `task_cost_model`
(an explicit foreign key). If the benchmark does not cover the measured model, the
measurement carries an `economics_gap` string instead and ships with no API-cost
comparison — a valid, honestly-labeled result, not a substitution.

## 4. Calibrate drain

Use 5–10 representative tasks per cell. Immediately before and after each task, capture
the product's weekly or monthly usage indicator. Pace work so short session limits do not
bind. Record interruptions if they do.

When the indicator is grade `rounded` (integer percent), run tasks in contiguous batches
and compute mean drain per task from the batch-level delta (first pre-run snapshot to
last post-run snapshot): paired snapshots telescope, so the batch delta carries a single
±1-point quantization error regardless of batch size. Individual per-task deltas of 1–2
points are dominated by rounding — record them, but do not interpret them individually
or draw per-task conclusions (such as drain versus API-cost proportionality) from them.
A gap between tasks (interruption, other usage) ends the batch; start a new one at the
next task. A served-model substitution that crosses tokenizer generations (§1) also ends
the batch — its drain sits on a different token denominator.

Per-task percent drain shrinks as plan quota grows, so size batches to the plan: on
large-quota tiers (Claude Max-class), plan longer contiguous batches — error on mean
drain per task falls as ±1/N points with batch length N. Harder tasks also lift per-task
drain above the rounding floor, but keep the sample representative of the benchmark's
cost distribution; do not skew toward expensive tasks solely for resolution unless the
estimate is explicitly reweighted.

Cache hygiene: never launch an identical task twice within the provider's prompt-cache
TTL — a warm-cache repeat can drain less quota than a cold run and corrupt the estimate
(Anthropic: 5-minute default TTL refreshed on each hit, 1-hour extended TTL; treat
1 hour as the conservative floor and assume the same for providers with undocumented
caching). Replicates of the same task must be spaced by at least the TTL; distinct
tasks back-to-back are fine — they share only the harness system-prompt prefix, which
matches real continuous usage. The benchmark source does not handle this; it is an
account-scheduling concern, auditable from recorded run timestamps.

Pause hygiene: do not pause mid-run for longer than the provider's cache TTL. When a
pause exceeds the TTL, the harness re-writes its full prompt-cache prefix at premium
write rates on the next request (Anthropic bills cache writes at 1.25×; Systima measured
mid-session re-writes of 37–86k tokens on Claude Code — see research.md), so an operator
pause changes observed drain independently of the task. If a pause > TTL occurs anyway,
record it as a pause event on the run; a pause also ends the contiguous batch, same as
any other gap.

Cache-busting harness flags (Claude Code): two documented behaviors re-write the prompt
cache independently of the task and add drain noise, so pin them to a fixed, recorded
state across all runs in a cell (research.md → Prompt-Cache Economics in Practice):

- **Telemetry ↔ cache-TTL coupling.** Disabling telemetry
  (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` / `DISABLE_TELEMETRY=1`) silently forced the
  5-minute TTL instead of the 1-hour TTL for Max subscribers (claude-code#45381, fixed in
  2.1.108). A shorter TTL re-primes the cache more often, inflating cache-write drain. Pin
  the telemetry flags and the resulting TTL, and record both; do not toggle telemetry
  mid-cell.
- **git-status cache invalidation.** Claude Code's prompt embeds git-status in a middle
  cache block, so **every commit busts that block** and re-pays a ~6k-token cache write on
  the next request. During a calibration batch, either keep the working tree quiescent (no
  commits mid-batch) or set `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`; record which.

Record the pinned flag state as run/cell fields so the cache regime is auditable and
identical across compared cells.

Record whether the harness spawned subagents during the run (visible in the transcript
or UI). Subagent fan-out is the largest single drain multiplier measured to date (~4.2×
metered input for a two-subagent fan-out, Systima July 2026): one fan-out task can
dominate a batch delta, so the flag is needed to explain outlier batches and to keep the
calibration sample representative.

The account must be dedicated to measurement, or verified idle on every other product
surface for the whole window — providers share quota across surfaces (Claude across
Code/chat/Cowork), and concurrent usage silently inflates observed drain. Concurrent
non-measurement usage invalidates the window.

Run the task through `subbench run`; a zero exit status records success. The
`api-equivalent-usd` input is the cost of the same task under the adopted benchmark
economics. Failed attempts, retries, limit events, and aborts remain in the data.

After three normal tasks establish an expected median, abort a runaway at three times that
median drain and mark it aborted. Do not discard it.

## 5. Establish capacity

Enter total weekly or monthly capacity in the same quota unit used by run deltas. Exact
floats are grade `exact`; displayed rounded percentages are `rounded`; depletion-derived
capacity is `inferred`; insufficient evidence is `unknown`. Record statistical confidence
separately.

Record `quota_window_days` alongside capacity — the length of the quota window in days
(weekly = 7, monthly = 30). The window is the canonical unit of measurement: capacity is
measured against it and the plan price is prorated into it
(`window_price = price × quota_window_days / billing_days`). SVI is native successful
tasks per window per window-dollar, so results from different providers with different
windows remain comparable. **A study whose quota window cannot be stated is not
publishable** — a rolling limit with no justifiable window is rejected in validation.

For Claude cells, prefer grade `exact` for **capacity** by reading the unrounded
weekly/session utilization floats from the `message_limit` objects in Claude.ai SSE
chat responses (she-llac/claude-counter). Cross-check them against displayed
percentages before relying on them.

Scope, established 2026-07-12 from persisted evidence and the claude-counter source
(not a live run): the exact float is emitted **only on the claude.ai chat completion
SSE stream**. The `api.anthropic.com/oauth/usage` endpoint that Claude Code and our
collector read carries integer `utilization` only — its sole non-integer field,
`extra_usage.utilization`, is paid overage-credit spend, unrelated to the weekly
window. Consequences:

- **Capacity (§5 numerator):** viable at grade `exact` — one claude.ai chat message
  yields the exact remaining-weekly float. Do this on the claude.ai surface, not
  Claude Code.
- **Per-task drain (§4 calibration on Claude Code):** the float **cannot** bracket a
  Claude Code task. Reading it requires sending a claude.ai chat message, which drains
  the same shared weekly quota; a pre/post pair would insert two extra quota-consuming
  messages around the task and measure the probe, not the task. Claude Code per-task
  drain therefore stays grade `rounded`, and the §4 batch-delta machinery is still
  required. Grade `exact` does **not** moot quantization for the drain side.

## 6. Validate and publish

Analysis runs validation first and **fails closed**: a measurement still flagged
`publishable = 1` that carries any publishability issue — missing isolation attestation,
manual (non-snapshot) runs, `unknown`-grade capacity, no quota window, fewer than five
valid runs, or an unresolved economics binding — aborts the analysis. `analyze --force`
computes anyway but stamps every affected result row `publishable = 0`. Manual
`subbench run` input records `evidence_kind = manual` and is non-publishable by default.

The isolation attestation from §2 is recorded as data on the measurement
(`isolation_confirmed_at`, `isolation_confirmed_by`); the calibration runners refuse to
start without `--confirm-isolation "<operator>"`.

Run the cross-source sanity check: compare the adopted benchmark's pass@1 and
cost-per-task against independent sources (Aider, MorphLLM, Ivern AI) for the same models,
and flag wild divergence in the report's caveats. Publish the JSON or CSV data, generated
report, measurement grade, sample sizes, median and p90 drain, the bootstrap interval over
calibration runs, conditions, and the harness-mismatch disclaimer. The report names two
estimands: the **primary native** metric (native successful tasks per window, from the
native success rate) and the **secondary benchmark-equivalent** throughput (published
pass@1, the API-comparison anchor). Results expire at the end of their stated window.
