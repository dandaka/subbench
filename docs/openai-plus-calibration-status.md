# OpenAI Plus DeepSWE calibration status

Last updated: 2026-07-09 (Europe/Lisbon)

## Current state

- Branch: `dev`
- Workflow commit: `f3f562e`
- Pier version: `0.3.0`
- Calibration database: ignored `openai-plus.db`
- Valid recorded runs: 2 of 8
- Successful runs: 0
- Failed runs: 2
- Captured weekly quota drain: 11 percentage points
- Infrastructure-only attempts remain excluded from the calibration count.

Do not delete, recreate, replace, or commit `openai-plus.db`. It contains the
authoritative run history.

## Recorded runs

| run | task | outcome | weekly usage | drain | verifier |
|---:|---|---|---:|---:|---|
| 1 | `ytt-jsonpath-query-api` | failed | 10% → 15% | 5 points | failed |
| 2 | `go-git-worktree-merge-conflicts` | failed | 16% → 22% | 6 points | reward 0; F2P 15/17, P2P 2/2 |

Run 2 completed without an infrastructure error, retry, limit event, or abort. Its
Pier runtime was 23m33s. Immediately after the run, the usage indicators reported
42% for the five-hour window and 23% for the weekly window; these values are only
a timestamped observation and must be checked again before the next run.

The database currently fails `validate` only because two calibration runs are below
the protocol minimum of five.

## Next session

Read `README.md`, `docs/protocol.md`, `docs/calibration-tasks.md`, and
`docs/task-selection-plan.md`, then check both live usage windows:

```bash
bun run subbench codex-usage --window session --format json
bun run subbench codex-usage --window weekly --format json
```

When five-hour usage is below 70%, run exactly one next unmeasured task:

```bash
bun run calibrate:openai
```

Confirm that Pier graded the task and that a new row was recorded in
`openai-plus.db`. Preserve failures, quota deltas, verifier outcomes, retries,
limit events, and aborts. Do not count harness or infrastructure failures as
calibration runs. Do not start another task if the five-hour window is near its
limit.

Repeat across five-hour resets until all eight selected tasks are recorded. Then:

```bash
bun run subbench --db openai-plus.db validate
bun run subbench --db openai-plus.db analyze --format markdown
```

Save the final report under `docs/`, run `bun run check`, and commit the tracked
report and status changes.
