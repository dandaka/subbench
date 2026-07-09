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

## 3. Import economics

Transcribe the adopted benchmark snapshot into a JSON bundle. Preserve its neutral
harness, effort level, model version, sample size, pass@1, and average cost per attempted
task. Keep a dated source URL. Do not silently combine effort levels.

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

For Claude cells, prefer grade `exact` by reading utilization floats from the
`message_limit` objects in Claude.ai SSE response bodies; cross-check them against
displayed percentages during the first runs of each cell before relying on them. This
Claude.ai technique does not by itself provide pre/post snapshots for Claude Code runs;
validate the selected collection path on the measured product surface.

## 6. Validate and publish

Run validation before analysis. Run the cross-source sanity check: compare the adopted
benchmark's pass@1 and cost-per-task against independent sources (Aider, MorphLLM,
Ivern AI) for the same models, and flag wild divergence in the report's caveats.
Publish the JSON or CSV data, generated report,
measurement grade, sample sizes, median and p90 drain, confidence intervals, conditions,
and the harness-mismatch disclaimer. Results expire at the end of their stated window.
