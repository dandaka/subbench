# Running a Codex (OpenAI) calibration test

Operator runbook for measuring per-task quota drain on the OpenAI Plus
subscription, using Codex CLI inside Pier's Docker harness on DeepSWE tasks.

For the mandatory measurement rules, see [protocol.md](protocol.md); the frozen task
set and provenance are in [calibration-tasks.md](calibration-tasks.md) and
`data/deepswe-v1.1.lock.json`.

## What one run does

1. Reads the Codex rate-limit snapshot via `codex app-server --stdio` RPC
   (`account/rateLimits/read`).
2. Records the **pre** usage snapshot (`usedPercent` for primary/secondary windows).
3. Runs one DeepSWE task through Codex in Docker (~50 minutes).
4. Reads the **post** usage snapshot (with retry/backoff).
5. Records the run and both snapshots in `openai-plus.db`.

The meter reports `usedPercent` as whole integers (methodology grade `rounded`,
precision `integer-percent`). A run is only recorded if the agent and verifier
both produced valid results, the account did not change, and the weekly window
did not reset mid-task. A failing task is still a valid measurement — the target
is quota economics, not whether the model solved the task.

## Prerequisites (verify once per machine)

Run from the repo root (`~/projects/subbench`):

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun --version          # Bun installed
codex --version        # Codex CLI installed
pier --version         # Pier 0.3.0
docker info            # Docker daemon running
df -h /                # host free space
docker system df       # Docker internal disk headroom
```

The OpenAI Plus plan must be logged in through Codex CLI. Confirm with the
probe below.

## Step 1 — Confirm auth and plan (read-only, no quota cost)

```bash
bun run scripts/run-deepswe-calibration.ts --dry-run
```

Or probe the rate-limit endpoint directly:

```bash
bun run packages/cli/src/codex-usage.ts
```

Expected: `planType` populated (e.g. `plus`), HTTP-equivalent success, and
parsed `primary` (session) and `secondary` (weekly) windows with `usedPercent`,
`windowDurationMins`, and `resetsAt`. If this fails, fix the Codex login before
going further — every run depends on it.

## Step 2 — Meter verification (first cell only)

Per [protocol.md](protocol.md) §1, verify the run drains the **subscription
meter**, not API credits or pay-per-use billing.

1. Read the pre-warmup snapshot (`usedPercent` on the secondary/weekly window).
2. Run a short throwaway task through Codex (not a calibration task).
3. Read the post-warmup snapshot.
4. Confirm `usedPercent` on the weekly window increased — this proves the
   subscription meter moved, not an API-credit balance.

Record `meter_verified: subscription` for the cell. If the meter did not move
but API credits were consumed, the invocation mode is wrong — reconfigure before
any measured run.

## Step 3 — Operator isolation check (MANDATORY)

Per [protocol.md](protocol.md) §2, before every run the operator must verify and
record that **nothing else is consuming the OpenAI Plus subscription**:

- no other Codex CLI sessions on this account,
- no ChatGPT web/app sessions actively generating,
- no background agents, cron/scheduled tasks, or automated runs,
- no API calls against the same account draining the subscription meter,
- no teammate sharing the seat.

The intended setup is an **off-hours run driven by a separate agent** (e.g.
Claude Code) so this benchmark is the sole consumer of the Plus seat. Record the
confirmation (date, machine, that isolation was verified) in the run log. A run
without a recorded confirmation is invalid and must be discarded.

## Step 3.5 — Zero-subscription harness preflight (required after harness changes)

Before spending subscription quota after a Docker, Pier, runner, or
credential-path change, run the shared preflight:

```bash
bun run preflight:calibration --provider openai
```

It performs a read-only Codex usage probe, then runs the frozen task through the
real Docker environment and verifier using Pier's built-in `nop` agent. It never
injects Codex credentials or calls a model, and its result is explicitly not a
calibration measurement.

## Step 4 — Establish capacity

Record total weekly capacity in the same quota unit used by run deltas. The Codex
rate-limit endpoint reports `usedPercent` (0–100) against the weekly window, so
capacity is 100% of the weekly window.

Record:
- `capacity: 100` (percent)
- `capacity_grade: rounded` (integer-percent meter)
- `quota_window_days: 7` (weekly — confirm from `windowDurationMins` in the
  snapshot; 7 days = 10080 minutes)

If `windowDurationMins` reports a value other than 10080, adjust
`quota_window_days` accordingly and note the discrepancy.

## Step 5 — Launch the run

Auto-pick the first unmeasured calibration task:

```bash
bun run calibrate:openai
```

Or pin a specific task:

```bash
bun run calibrate:openai --task dasel-html-document-format
```

The task list is the DeepSWE calibration selection in
`data/deepswe-v1.1-calibration-tasks.json`.

### Pier agent

The harness uses `scripts/pier_codex_subscription.py` (`CodexSubscription`),
which extends Pier's built-in Codex agent with:
- network allowlist addition: `chatgpt.com` (for subscription rate-limit reads),
- install-step shim: strips `--enable unified_exec` from Codex invocations
  (compatibility wrapper).

### Guards that will stop a run (by design)

- **Plan guard** — aborts unless the plan resolves to an active subscription.
- **Session guard** — aborts if the primary window is at or above the threshold.
  Wait for it to reset (the probe prints the reset time).

These are protections, not failures. If a guard fires, resolve the condition
and re-run.

### Running unattended overnight

Because a run takes ~50 minutes, launch it in the background and capture the
log:

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run calibrate:openai > .subbench/codex-run.log 2>&1 &
```

## Step 6 — Confirm the result

A recorded run prints:

```text
Recorded run N: pass|fail, weekly usage X% -> Y%
```

Inspect the database:

```bash
sqlite3 openai-plus.db \
  'select id,task_id,pre_usage,post_usage,usage_delta,success from runs;'
```

The result artifact for a job is under
`.subbench/jobs/openai-plus-<task>-<timestamp>/`.

## What is NOT a valid run

Do not treat any of these as a calibration result (the runner discards them and
records nothing):

- a Pier setup exception or failure before Codex executes,
- a missing `agent_result` or `verifier_result` (harness-layer failure),
- a quota reset during the task,
- an account change between the pre- and post-read,
- an exhausted post-read (endpoint rate-limited past the retry budget).

## Batch discipline (integer-percent meter)

Because the meter is grade `rounded` (integer percent), per [protocol.md](protocol.md)
§4, run tasks in contiguous batches and compute mean drain per task from the
batch-level delta. Individual per-task deltas of 1–2 points are dominated by
rounding — record them but do not interpret them individually. A gap between
tasks (interruption, other usage) ends the batch; start a new one at the next
task.

No proxy capture is needed for Codex — that infrastructure is
Anthropic-specific. The rate-limit endpoint is the sole usage data source.

## After enough runs

Complete at least five valid runs before running validation and analysis. Stop
whenever a guard or a Docker-capacity check fails, and pick up after the
relevant quota resets.
