# OpenAI Plus DeepSWE calibration status

Last updated: 2026-07-10 (Europe/Lisbon)

## Current state

- Branch: `dev`
- Workflow commit: `f3f562e`
- Pier version: `0.3.0`
- Calibration database: **missing from this workspace**; the two documented runs are not
  currently reproducible from a local database.
- Historical runs: non-publishable because per-run isolation evidence was not recorded.
- Successful runs: 0
- Failed runs: 2
- Captured weekly quota drain: 11 percentage points
- Infrastructure-only attempts remain excluded from the calibration count.

If the original `openai-plus.db` is recovered, archive it read-only before migration and
migrate a copy. Do not infer fresh provenance or publishability from the status notes.

## Recorded runs

| run | task | outcome | weekly usage | drain | verifier |
|---:|---|---|---:|---:|---|
| 1 | `ytt-jsonpath-query-api` | failed | 10% → 15% | 5 points | failed |
| 2 | `go-git-worktree-merge-conflicts` | failed | 16% → 22% | 6 points | reward 0; F2P 15/17, P2P 2/2 |

Run 2 completed without an infrastructure error, retry, limit event, or abort. Its
Pier runtime was 23m33s. Immediately after the run, the usage indicators reported
42% for the five-hour window and 23% for the weekly window; these values are only
a timestamped observation and must be checked again before the next run.

Any recovered database will also fail Tier A validation without per-run isolation,
paired-snapshot, immutable-manifest, and current protocol evidence.

## Next session

Read `README.md`, `docs/protocol.md`, `docs/calibration-tasks.md`, and
`docs/task-selection-plan.md`, then check both live usage windows:

```bash
bun run subbench codex-usage --window session --format json
bun run subbench codex-usage --window weekly --format json
```

No paid calibration run should start until the Tier A lock manifest, abort/order rule,
and pilot audit are complete. Every fresh invocation must attest isolation:

```bash
bun run calibrate:openai --confirm-isolation "operator name"
```

Confirm that Pier graded the task and that a new row was recorded in
`openai-plus.db`. Preserve failures, quota deltas, verifier outcomes, retries,
limit events, and aborts. Do not count harness or infrastructure failures as
calibration runs. Do not start another task if the five-hour window is near its
limit.

Repeat only under the frozen protocol across the declared order. Then:

```bash
bun run subbench --db openai-plus.db validate
bun run subbench --db openai-plus.db analyze --format markdown
```

Save the final report under `docs/`, run `bun run check`, and commit the tracked
report and status changes.
