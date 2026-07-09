# V1 Measurement Protocol

## 1. Freeze the cell

A cell is `(provider, plan, model, product surface)`. Record the model and product
versions, plan terms snapshot, measurement dates, peak-hours state, and promotions.
Measure the default and one flagship model per plan. Never combine promotion and baseline
runs.

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

For Claude cells, prefer grade `exact` by reading utilization floats from the
`message_limit` objects in Claude.ai SSE response bodies; cross-check them against
displayed percentages during the first runs of each cell before relying on them. This
Claude.ai technique does not by itself provide pre/post snapshots for Claude Code runs;
validate the selected collection path on the measured product surface.

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
