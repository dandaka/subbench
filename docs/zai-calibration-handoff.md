# Z.ai GLM-5.2 calibration handoff

## Goal

Run the selected DeepSWE calibration tasks through Claude Code backed by the Z.ai
GLM Coding Lite subscription, with Claude's `opus` alias pinned to `glm-5.2`.
Capture the Z.ai weekly quota immediately before and after each task, grade the
result with DeepSWE's verifier, and store valid runs in `zai-lite.db`.

## Current status

- The live quota collector works against
  `https://api.z.ai/api/monitor/usage/quota/limit`.
- The supplied account is detected as the `lite` plan.
- Live Claude Code smoke testing confirmed that `opus` resolves to `glm-5.2`;
  Claude's response metadata reported `glm-5.2`.
- Current weekly usage was 30% at handoff.
- No calibration run has been recorded (`zai-lite.db` contains zero runs).
- All 12 project tests pass.
- Failed harness setup attempts were deliberately not recorded.

## Implemented changes

- `packages/cli/src/zai-usage.ts`
  - Uses `ZAI_AUTH_TOKEN`, with `ANTHROPIC_AUTH_TOKEN` as a fallback.
  - Reads the account plan from the quota response.
- `scripts/run-zai-deepswe-calibration.ts`
  - Creates/loads the separate `zai-lite.db`.
  - Selects an unmeasured DeepSWE task.
  - Guards against starting above 70% five-hour usage.
  - Pins the model to `glm-5.2`.
  - Captures and persists pre/post weekly snapshots.
  - Records only runs with valid agent and verifier results.
- `scripts/pier_zai_subscription.py`
  - Pier Claude Code adapter used for the Docker harness.
- `examples/zai-lite-deepswe-v1.1.json`
  - Study metadata for GLM Coding Lite and GLM-5.2.
- `package.json`
  - Adds `bun run calibrate:zai`.

## Quota and promotion treatment

ZCode's official changelog says the 150% quota benefit applies inside the ZCode
desktop app compared with API calls. The Claude Code calibration therefore uses:

- `quota_capacity: 100`
- `promotion: 0`
- `product_surface: claude-code`

A future ZCode-native study should be a separate cell with:

- `quota_capacity: 150`
- `promotion: 1`
- `product_surface: zcode-desktop`

Do not combine those surfaces in one measurement.

## Why the first machine failed

The local Mac's Docker environment used basic x86 emulation. Claude Code 2.1.x is
a Bun standalone executable that crashed in the amd64 DeepSWE image because AVX
was unavailable. Large expanded task images also exhausted its 40 GB Docker
filesystem. Codex did not have the AVX requirement, which is why the earlier
OpenAI calibration worked there.

The target MacBook (`dandaka-mbp16`) is suitable:

- Apple Silicon with Docker Desktop's Rosetta mode enabled
- about 200 GB free on the host
- Docker virtual disk approximately 58 GB
- Bun installed
- Claude Code 2.1.205 installed
- Pier 0.3.0 installed through `pipx`

Ensure Docker has enough free internal space before running. At handoff it had
only about 6.9 GB available due to existing images and cache. Prefer clearing
known disposable build cache or increasing Docker's disk allocation; do not
delete unrelated volumes.

## Continue on the target Mac

The temporary `~/projects/subbench` created during remote setup was a copied
snapshot followed by `git init`, not a proper clone. Preserve its `.env`, replace
the directory with a real clone, and restore the credential:

```bash
cp ~/projects/subbench/.env ~/.subbench-zai.env
rm -rf ~/projects/subbench
git clone git@github.com:dandaka/subbench.git ~/projects/subbench
cp ~/.subbench-zai.env ~/projects/subbench/.env
chmod 600 ~/projects/subbench/.env
cd ~/projects/subbench
bun install --frozen-lockfile
```

The changes described in this handoff are published on branch `dev`; pull or
clone that branch on the target Mac.

Verify the environment:

```bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
docker system df
bun run check
bun run subbench usage zai --window weekly --format json
```

Start with the task that previously fit better than the ytt image:

```bash
bun run calibrate:zai --task go-git-worktree-merge-conflicts
```

The runner will clone DeepSWE into `.subbench/deep-swe` if needed. A valid run
ends with output similar to:

```text
Recorded run 1: pass|fail, weekly usage 30% -> N%
```

Confirm persistence:

```bash
sqlite3 zai-lite.db \
  'select id,task_id,pre_usage,post_usage,usage_delta,success from runs;'
```

Do not treat a Pier setup exception, missing `agent_result`, missing
`verifier_result`, or a quota reset during the task as a calibration result.

## Remaining work

1. Wait for the five-hour/session quota to reset before starting another task.
2. Complete at least four more valid runs, stopping whenever a quota guard or
   Docker-capacity check fails.
3. Run validation and analysis only after the minimum five valid runs.

## Calibration run log

### 2026-07-09 — `go-git-worktree-merge-conflicts`

- Machine/branch: `dandaka-mbp16`, `dev`
- Model/product: GLM-5.2 through Claude Code on GLM Coding Lite
- Runtime: 57 minutes
- Validity: valid agent result, valid verifier result, no quota reset
- Result: fail (`15/17` fail-to-pass, `2/2` pass-to-pass)
- Weekly quota: `30% -> 46%` (`16` percentage-point delta)
- Five-hour/session quota after the run: `79%`
- Database: recorded as run `1` in `zai-lite.db`
- Result artifact:
  `.subbench/jobs/zai-lite-go-git-worktree-merge-conflicts-1783602698008/result.json`

The failing case was `TestMergeDirectoryFileConflict`. The implementation
detected the file/directory clash but attempted to write conflict-marker content
at a path that was still a directory. The filesystem returned
`cannot open directory: /conflict`, so the method returned before writing
`.git/MERGE_HEAD` and before returning `ErrMergeConflicts`.

This is a valid calibration observation even though the task failed: subscription
consumption and verifier quality were both measured successfully. It is not
enough by itself to estimate typical quota cost or success rate.

## Upcoming run plan

Before every run:

1. Confirm `session` usage is below the runner's `70%` start guard.
2. Confirm weekly usage and reset time; do not cross a reset during a task.
3. Confirm Docker has adequate free internal space.
4. Run exactly one task and wait for its verifier result.
5. Confirm the database row, quota delta, artifact, and absence of setup errors.

Recommended next tasks, in order:

1. `aiomonitor-task-snapshots-diff` — Python, p25 difficulty/cost slot.
2. `cliffy-config-file-parsing` — TypeScript, p50 slot.
3. `katex-multicolumn-array-spans` — JavaScript, p50 slot.
4. `boa-hierarchical-evaluation-cancellation` — Rust, p50 slot.

These four runs produce a five-run minimum together with the completed Go task
and broaden language coverage. Run no more than one task per five-hour quota
window if the previous task leaves session usage above `70%`. Defer
`ytt-jsonpath-query-api` until Docker has more headroom because its expanded
image previously exhausted the smaller Docker allocation. If weekly headroom is
insufficient, pause until the weekly reset rather than substituting an invalid
or truncated run.
