# Running a Claude Max calibration test

Operator runbook for measuring per-task quota drain on the Anthropic Claude Max
subscription, using Claude Code inside Pier's Docker harness on DeepSWE tasks.

For the design and rationale, see
[superpowers/specs/2026-07-10-claude-subscription-calibration-design.md](superpowers/specs/2026-07-10-claude-subscription-calibration-design.md).
For the mandatory measurement rules, see [protocol.md](protocol.md).

## What one run does

1. Reads the Claude Max OAuth credential (macOS Keychain / `~/.claude`).
2. Reads the **pre** usage snapshot and checks the guards.
3. Runs one DeepSWE task through Claude Code in Docker (~50 minutes).
4. Reads the **post** usage snapshot (with retry/backoff).
5. Records the run and both snapshots in `claude-max.db`.

A run is only recorded if the agent and verifier both produced valid results,
the account did not change, and the weekly window did not reset mid-task. A
failing task is still a valid measurement — the target is quota economics, not
whether the model solved the task.

## Prerequisites (verify once per machine)

Run from the repo root (`~/projects/subbench`):

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun --version          # Bun installed
claude --version       # Claude Code installed (2.1.205 used at build time)
pier --version         # Pier 0.3.0
docker info            # Docker daemon running
df -h /                # host free space (keep well above task-image needs)
docker system df       # Docker internal disk headroom
```

The Max plan must be logged in through Claude Code's **OAuth** login (not a
`setup-token`; the runner rejects a credential with no refresh token, because an
inference-only token cannot sustain a ~50-minute task). Confirm the login and
the plan with the probe below.

## Step 1 — Confirm auth and plan (read-only, no quota cost)

```bash
bun run probe:claude
```

Expected: `subscriptionType: max`, HTTP 200, and parsed `session` / `weekly`
windows. If this fails, fix the login before going further — every run depends
on it.

## Step 2 — Operator isolation check (MANDATORY)

Per [protocol.md](protocol.md) §2, before every run the operator must verify and
record that **nothing else is consuming the Max subscription**:

- no other Claude Code sessions on this account,
- no background agents, cron/scheduled tasks, or `/loop` runs,
- no MCP servers/daemons driving Claude,
- no teammate sharing the seat.

The intended setup is an **off-hours run driven by a separate agent** (e.g.
Codex) so this benchmark is the sole consumer of the Max seat. Record the
confirmation (date, machine, that isolation was verified) in the run log. A run
without a recorded confirmation is invalid and must be discarded.

## Step 3 — Launch the run

Auto-pick the first unmeasured calibration task:

```bash
bun run calibrate:claude
```

Or pin a specific task:

```bash
bun run calibrate:claude --task fastapi-implicit-head-options
```

The task list is the DeepSWE calibration selection in
`data/deepswe-v1.1-calibration-tasks.json`.

### Guards that will stop a run (by design)

- **Plan guard** — aborts unless the plan resolves to `max`.
- **Session guard** — aborts if the five-hour window is at or above **70%**.
  Wait for it to reset (the probe prints the reset time).
- **No refresh token** — aborts if the credential is inference-only.

These are protections, not failures. If a guard fires, resolve the condition
and re-run.

### Running unattended overnight

Because a run takes ~50 minutes, launch it in the background and capture the
log:

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run calibrate:claude > .subbench/claude-run.log 2>&1 &
```

## Step 4 — Confirm the result

A recorded run prints:

```text
Recorded run N: pass|fail, weekly usage X% -> Y%
```

Inspect the database:

```bash
sqlite3 claude-max.db \
  'select id,task_id,pre_usage,post_usage,usage_delta,success from runs;'
```

The result artifact for a job is under
`.subbench/jobs/claude-max-<task>-<timestamp>/`.

## What is NOT a valid run

Do not treat any of these as a calibration result (the runner discards them and
records nothing):

- a Pier setup exception or failure before Claude Code executes,
- a missing `agent_result` or `verifier_result` (harness-layer failure),
- a quota reset during the task,
- an account change between the pre- and post-read,
- an exhausted post-read (endpoint rate-limited past the retry budget).

## After enough runs

Complete at least the minimum number of valid runs (five, matching the Z.ai
calibration) before running validation and analysis. Stop whenever a guard or a
Docker-capacity check fails, and pick up after the relevant quota resets.
