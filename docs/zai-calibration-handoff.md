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

1. Clone/pull branch `dev` on the target Mac and restore `.env`.
2. Ensure adequate free Docker space.
3. Run one GLM-5.2 task and inspect its result and quota delta.
4. If valid, complete 5–10 sequential selected tasks.
5. Run validation and analysis only after the minimum five valid runs.
