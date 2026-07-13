---
id: RESEARCH-2026-07-13-zai-glm52-neutral-harness
created: 2026-07-13
topic: Neutral harnesses (pi.dev, opencode) vs. the "no GLM-5.2 economics record exists" claim
mode: deep
tags: [subbench, zai, glm-5.2, deepswe, neutral-harness, opencode, pi.dev, economics-gap]
---

# Z.ai / GLM-5.2 economics: does a neutral harness exist, and do we even need one?

> This file was the handoff prompt for the research task. It is now the **research
> report**. The original brief is preserved at the bottom under
> *Appendix: original handoff brief*.

## Executive Summary

1. **The premise collapsed: a published GLM-5.2 neutral-harness economics record now
   exists.** The live DeepSWE v1.1 leaderboard — SubBench's own adopted source — lists
   `glm-5.2[max]` at **Pass@1 44%±2%, avg cost $3.92/task, 78k output tokens, 129 steps**,
   all models run on **mini-swe-agent** for consistency, "113 tasks · updated July 9,
   2026" [1]. Verified by fetching the page directly. The Z.ai economics gap can be
   **closed by ingestion**, not by building or running any harness.

2. **The user is right that neutral harnesses exist — but that hunt is now moot for
   closing this gap.** Both **pi.dev** [2][3] and **OpenCode** [4][5] are real, MIT,
   model-agnostic harnesses with first-class Z.ai/GLM-5.2 support. The claim "no neutral
   harness exists" was wrong as a statement about *tooling*. But the handoff's operative
   claim was narrower — "no published *record* exists for GLM-5.2" — and that is what is
   now false at the source.

3. **Why the project believed otherwise: a stale local snapshot.** The frozen local
   bundle `data/deepswe-v1.1-calibration-tasks.json` (dated 2026-07-10) aggregates only
   four models — claude-fable-5, claude-sonnet-5, claude-opus-4-8, gpt-5-5 — and never
   contained GLM-5.2 [local repo]. The **upstream** leaderboard has since added it. The
   memory note `zai-no-published-economics.md` was correct about the snapshot and is now
   stale about upstream.

4. **OpenCode is disqualified for SubBench specifically — twice over.** (a) Anthropic
   took legal action against OpenCode (Mar 2026); the resulting PR removed its Claude
   Pro/Max **subscription-auth plugin** — the exact "drive an agent off a $20/mo
   subscription" capability SubBench's premise depends on [6][7]. (b) OpenCode re-pays its
   system-prompt baseline every turn (no tool-call batching), so its per-task cost profile
   is **not comparable** to mini-swe-agent's — it fails the cross-harness comparability
   that "neutral" is supposed to guarantee [8].

5. **One real caveat on the DeepSWE row: it is `[max]` effort, and $3.92 is an
   API-priced figure.** GLM-5.2 appears on the board **only at the `[max]` tier**. The
   pass@1 / tokens / steps are directly usable; the **$3.92 is a benchmark API reference
   price, not a Z.ai subscription window-dollar cost** — converting between them is
   SubBench's own job and is governed by the existing Harness Mismatch Disclaimer.

## Key Findings

### Finding 1 — DeepSWE v1.1 now publishes GLM-5.2 (the gap is closeable by ingestion)

Fetched `deepswe.datacurve.ai` directly (2026-07-13). The leaderboard, "updated July 9,
2026," carries a GLM-5.2 row on the identical mini-swe-agent scaffold used for every other
model [1]:

- Model: `glm-5.2[max]` (ZAI icon)
- Pass@1: **44%±2%**
- Avg cost: **$3.92**
- Output tokens: **78k**
- Steps: **129**

This satisfies every requirement of a SubBench economics source (methodology.md → *Task
Cost Sources*): neutral/uniform harness across models, published, per-model pass@1 **and**
per-task cost + output tokens. It is the same source SubBench already adopted for the other
four models — no new source-trust decision is required.

The adversarial pass confirmed the row by independent re-fetch and flagged the correct
caveats (below), not a refutation [8].

### Finding 2 — Why SubBench believed "none exists": stale local snapshot vs. live upstream

The local frozen snapshot contains only four models and no GLM-5.2:

```
data/deepswe-v1.1-calibration-tasks.json  → claude-fable-5, claude-sonnet-5,
                                             claude-opus-4-8, gpt-5-5   (no glm-5.2)
```

(verified by grepping the local file). The memory note `zai-no-published-economics.md`
(written 3 days before this research) accurately described *that snapshot* and the P0-3
mislabeling bug it warned against. It is **not** wrong about the danger of fabricating a
row from the 4-model aggregate — that remains true. It **is** now stale about upstream:
DeepSWE added GLM-5.2 after the snapshot was frozen. The fix is to **re-pull the upstream
leaderboard**, not to change the source or fabricate anything.

### Finding 3 — pi.dev is a genuine neutral harness (verified), but not needed here

`github.com/earendil-works/pi` — **MIT, 70,382★, created 2025-08-09, pushed 2026-07-13**
[GitHub API, verified twice]. "AI agent toolkit: unified LLM API, agent loop, TUI, coding
agent CLI" by Mario Zechner (earendil-works). It is model-agnostic (15+ providers), and
its provider files register **`glm-5.2` as a first-class model** (`zai.models.ts`,
`id: "glm-5.2"`, openai-completions transport) — not merely a "zai" thinking-format string
[2][3]. Its default system prompt has **no model/provider branching** — genuinely neutral
scaffold. It ships **no** benchmark/leaderboard and favors "real-world OSS sessions" over
"toy benchmarks" per its README. Verdict: a valid neutral harness, but since the record
already exists, **it is unnecessary for closing the Z.ai gap.**

### Finding 4 — OpenCode: real, "more favorable" on overhead, but disqualified for SubBench

`github.com/anomalyco/opencode` — **MIT, 185,367★, created 2025-04-30, pushed 2026-07-13**
[GitHub API]. The `sst/opencode` → `anomalyco/opencode` rename is real; the original
`opencode-ai/opencode` (Charlie Holtz) is archived. Model-agnostic (75+ providers via
Vercel AI SDK + Models.dev), **first-class Z.AI provider** incl. a "Z.AI Coding Plan"
option, headless `opencode run --format json --auto`, and native per-session cost via
`opencode stats` / `export` [4][5]. The user's "more favorable" intuition is corroborated
on one axis: the Systima study measured OpenCode ~7k-token baseline vs Claude Code ~33k,
with a **byte-identical, cache-stable** request prefix [8][research.md].

**But it is disqualified for SubBench on two independent grounds:**

- **Legal cloud, directly on-point.** "Anthropic takes legal action against OpenCode"
  (HN, Mar 2026); PR #18186 removed the **Claude Pro/Max subscription-auth plugin** —
  precisely the "run a coding agent off a subscription" capability SubBench measures
  [6][7]. Building SubBench's subscription-side tooling on OpenCode courts the same
  conflict.
- **Not cross-harness comparable.** OpenCode re-pays its system-prompt baseline every
  turn (no tool-call batching), structurally inflating per-task tokens vs. mini-swe-agent.
  A cost produced by OpenCode is **not** comparable to the DeepSWE board — defeating the
  purpose of "neutral" [8]. (This is the same per-turn cache-rewrite dynamic SubBench
  already documents for Claude Code.)

### Finding 5 — Self-generation (Path 3) is now mostly moot but cheap if ever needed

The task set is genuinely open: `datacurve-ai/deep-swe` (**Apache-2.0, 1,105★**) ships 113
tasks in Harbor format with per-task Dockerfile + behavior-based verifier; leaderboard runs
used `datacurve-ai/pier` (**Apache-2.0, 109★**), a Harbor fork driving mini-swe-agent on
Modal [GitHub API][9]. `mini-swe-agent` (**MIT, 5,758★**) is litellm-based, so GLM-5.2's
OpenAI-compatible Z.ai endpoint works directly [10]. GLM-5.2 API pricing (Z.ai first-party,
launched 2026-06-16): **$1.40/M input, $4.40/M output, $0.26/M cached** [11].

Rough self-generation cost, **extrapolated (not measured)** tokens/task: ~$0.28/task →
**~$31 for 113 tasks** first-party (~$21 via OpenRouter); budget **$30–80**, wall-clock
**<1hr parallel on Modal** or ~15–19hr serial. Treat the dollar figure as a guess, not a
costed estimate — tokens/task is unmeasured. **This path is only worth reviving if SubBench
needs a GLM-5.2 effort tier other than `[max]`**, which the board does not publish.

## Contradictions & Open Questions

- **Memory vs. upstream.** `zai-no-published-economics.md` says GLM-5.2 has no published
  economics; the live board says otherwise. Resolution: the memory described the *frozen
  local snapshot* (true then, stale now), not upstream. The memory should be updated, not
  deleted wholesale — its warning against fabricating a row from the 4-model aggregate is
  still valid.
- **Effort-tier mismatch.** DeepSWE publishes GLM-5.2 at `[max]` only. Whether `[max]`
  reflects a typical Z.ai coding-plan user's effort is unresolved and is a labeling
  decision for the operator, not a measurement fact. Ingest as `[max]`-labeled.
- **API price vs. window-dollar.** $3.92 is DeepSWE's API-priced cost. SubBench's SVI is a
  window-dollar quantity; the conversion is the project's existing job under the Harness
  Mismatch Disclaimer. Do not equate the two.
- **Could not verify:** whether the leaderboard's `glm-5.2` is byte-identical to the model
  Z.ai serves on the coding plan (variant/version drift), and whether the row is stable vs.
  provisional. Low risk — it's on the adopted primary source — but worth a re-pull at
  publish time (the cross-source sanity check in methodology.md already requires this).

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| DeepSWE v1.1 publishes glm-5.2[max] 44% / $3.92 / 78k | **High** | Fetched page directly, twice (initial + adversarial) [1][8] |
| Local snapshot lacks GLM-5.2 (explains the stale belief) | **High** | Grepped local file; 4 models only |
| pi.dev is MIT, model-agnostic, GLM-5.2 first-class | **High** | GitHub API + provider source files [2][3] |
| OpenCode is MIT, 185k★, first-class Z.ai, headless | **High** | GitHub API + docs [4][5] |
| OpenCode disqualified (legal + non-comparable cost) | **High** | HN + PR #18186 + Systima overhead [6][7][8] |
| Self-gen ~$30–80 | **Medium** | tokens/task extrapolated, not measured [11] |
| glm-5.2[max] == Z.ai coding-plan model exactly | **Medium** | Not source-verified; low risk |

## Recommendation memo (decision-ready — feeds plan.md R.2)

**Ranked paths to a GLM-5.2 economics record, by (defensibility, cost, time):**

| Rank | Path | Defensibility | Cost | Time | Verdict |
|------|------|---------------|------|------|---------|
| **1** | **Ingest DeepSWE v1.1 glm-5.2[max] row** | Highest — same adopted source, same mini-swe-agent scaffold as the other 4 models | ~$0 | minutes | **RECOMMENDED** |
| 2 | Self-generate on mini-swe-agent (Pier/Modal) | High — replicates official methodology exactly | $30–80 (est.) | <1hr–19hr | Fallback only if a non-`[max]` tier is needed |
| 3 | Run on pi.dev or OpenCode | Low — not cross-comparable to the DeepSWE board; OpenCode also legally clouded | build effort | days | **Reject for this gap** |
| 4 | Wait / petition upstream | n/a — already delivered | $0 | done | Moot |

**Recommended path: #1 — ingest the existing DeepSWE glm-5.2[max] row.** The neutral-harness
tooling hunt (pi.dev / OpenCode / self-generation) that motivated this research is **moot**:
the record SubBench needs already exists on the source it already trusts.

**Exact methodology/protocol changes this requires (do NOT apply — operator decision, R.2):**

1. **Re-pull the DeepSWE v1.1 snapshot** to include GLM-5.2. The current local freeze
   (`data/deepswe-v1.1-calibration-tasks.json`, 4 models) predates the GLM-5.2 addition.
   This is a **data-refresh**, not a methodology change — SubBench stays import-only; Path 3
   (run-once) is **not** triggered.
2. **Populate Z.ai's SVI** from the GLM-5.2 row (pass@1 44%, out tok 78k), labeled
   **`effort: [max]`**, with `$3.92` recorded as the **API reference price**, not a
   subscription window-dollar. Clear the `economics_gap` flag for Z.ai.
3. **Correct the memory note** `zai-no-published-economics.md`: it is stale re: upstream.
   Keep its warning against fabricating a row from the 4-model aggregate; add that upstream
   now publishes a real GLM-5.2 row and the fix is a re-pull. (Handled in this change set.)
4. **At publish time**, run the existing cross-source sanity check (methodology.md) on the
   GLM-5.2 pass@1/cost against an independent board (Artificial Analysis covers GLM-5.2;
   SWE-bench Pro Scale set lists it at 62.1% but without a per-task-cost column).
5. **Do NOT adopt OpenCode or pi.dev** as a SubBench harness for this gap. If a future V2
   ever needs native-harness economics, note OpenCode's Anthropic legal exposure and its
   non-comparable per-turn cost profile as disqualifiers to record then.

**One-liner for plan.md R.2:** *Close the Z.ai economics gap by re-pulling DeepSWE v1.1
(now includes glm-5.2[max]: 44% / $3.92 / 78k) and ingesting the row as `[max]`-labeled
with $3.92 as an API reference price — no harness build, no self-generation needed;
pi.dev/OpenCode are valid neutral harnesses but moot here (OpenCode also legally clouded +
cost-incomparable).*

## Sources

1. [DeepSWE v1.1 leaderboard](https://deepswe.datacurve.ai) — glm-5.2[max] row, updated 2026-07-09 (fetched 2026-07-13) — leaderboard, Tier A (adopted primary source)
2. [earendil-works/pi (GitHub API)](https://api.github.com/repos/earendil-works/pi) — MIT, 70,382★, 2026-07-13 — repo, Tier A
3. [pi zai.models.ts](https://raw.githubusercontent.com/earendil-works/pi/main/packages/ai/src/providers/zai.models.ts) — registers glm-5.2 — source, Tier A
4. [anomalyco/opencode (GitHub API)](https://api.github.com/repos/anomalyco/opencode) — MIT, 185,367★, 2026-07-13 — repo, Tier A
5. [OpenCode docs — providers & CLI](https://opencode.ai/docs/providers) — Z.AI provider, `run --format json --auto`, `stats`/`export` — docs, Tier A
6. [HN: Anthropic takes legal action against OpenCode](https://news.ycombinator.com/item?id=47444748) — 2026-03 — forum/news, Tier B
7. [opencode PR #18186](https://github.com/anomalyco/opencode/pull/18186) — removes Claude Pro/Max subscription-auth plugin, 2026-03 — repo, Tier B
8. [Systima: Claude Code vs OpenCode token overhead](https://systima.ai/blog/claude-code-vs-opencode-token-overhead) — ~7k vs ~33k baseline, cache-stable prefix, 2026-07-12 — blog w/ data, Tier B
9. [datacurve-ai/deep-swe (GitHub API)](https://api.github.com/repos/datacurve-ai/deep-swe) — Apache-2.0, 1,105★, 113 tasks — repo, Tier A
   · [datacurve-ai/pier](https://api.github.com/repos/datacurve-ai/pier) — Apache-2.0, 109★ — repo, Tier A
10. [SWE-agent/mini-swe-agent (GitHub API)](https://api.github.com/repos/SWE-agent/mini-swe-agent) — MIT, 5,758★, litellm-based — repo, Tier A
11. GLM-5.2 API pricing $1.40/$4.40/$0.26 per M in/out/cached (Z.ai first-party, launched 2026-06-16) — techtimes / avenchat / apidog, Jul 2026 — Tier B

## Research Metadata

- **Mode:** deep
- **Sources consulted:** ~25 (Tier A: DeepSWE, pi, opencode, deep-swe, pier, mini-swe-agent, AA; Tier B: Systima, HN, PR, pricing; Tier C: community writeups)
- **Sub-questions:** 4 research threads + 1 adversarial + source-independence check
- **Subagents used:** 5 (4 parallel research + 1 contrarian)
- **Pages/APIs fetched in full:** DeepSWE leaderboard (×2), GitHub API on 5 repos (×2), pi provider source
- **Adversarial review:** yes — caught 4 factual/framing errors; refuted OpenCode as an option; confirmed the cross-cutting "ingest, don't build" conclusion
- **Key reversal:** the research question's premise ("no GLM-5.2 record exists") was falsified at the source; the deliverable pivoted from "which harness" to "the gap is already closeable by ingestion"

---

## Appendix: original handoff brief

The original task brief (Z.ai economics gap; four candidate paths; where to look; routing
rules; deliverables; quality bar) has been superseded by the findings above. Its core
research question — *"What is the cheapest defensible path to an economics record for
GLM-5.2?"* — is answered: **ingest the DeepSWE v1.1 glm-5.2[max] row that now exists.**
Paths 2–4 (near-miss adaptation, self-generation, wait/petition) are moot or fallback-only.
