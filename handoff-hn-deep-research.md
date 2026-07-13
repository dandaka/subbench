# Handoff: deep research — prior art on measuring AI coding-agent token overhead & subscription quotas

You are working in `~/projects/subbench` — a project benchmarking how much successful
developer work AI coding subscriptions (Claude Max, OpenAI/Codex, Z.ai, …) buy per
window-dollar. Use the `/deep-research` skill (deep mode) for this task.

## Context — read first

- `docs/goal.md`, `docs/methodology.md`, `docs/open-questions.md` — what SubBench
  measures and what's still open (the pivot question: does the quota meter discount
  cache reads like the API?)
- `docs/research.md` — prior art already known. Do NOT re-research what's already
  there; extend it.
- `docs/cache-weighting-experiment.md` §4 — the newly approved technique: a
  pass-through logging proxy on `ANTHROPIC_BASE_URL` capturing exact per-request
  token mixes (input / cache write / cache read / output) to pair with rounded quota
  drain.

We just adopted this proxy-capture technique from Systima's study
(systima.ai/blog/claude-code-vs-opencode-token-overhead, HN discussion:
news.ycombinator.com/item?id=48883275). Before building further, find everything
else that exists on this topic so we build on prior work instead of reinventing it.

## Research questions (in priority order)

1. **API-boundary metering of coding agents.** Who else has put a logging/metering
   proxy between an agent harness and a model endpoint? Tools, write-ups, repos
   (proxies, gateways, `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` interceptors,
   mitmproxy-based approaches, LiteLLM/observability gateways used for measurement).
   What capture formats, pitfalls (SSE parsing, streaming usage blocks, auth
   handling), and analysis methods did they use?
2. **Harness token-overhead measurements.** Other quantitative comparisons of agent
   harness overhead (Claude Code vs OpenCode vs Codex CLI vs Cursor vs Aider …):
   system-prompt/tool-schema baselines, cache-write behavior, mid-session cache
   invalidation, subagent multipliers. Anything corroborating or contradicting
   Systima's numbers.
3. **Subscription quota reverse engineering.** Work on inferring hidden subscription
   limits/meters: Claude Max/Pro weekly limits, OpenAI/Codex credits, Z.ai quotas.
   How meters weight cached vs uncached tokens (our pivot question — any direct
   evidence at all is gold). Known: she-llac/claude-limits, claude-counter,
   ClaudeBar — look for what we're missing.
4. **Prompt-cache economics.** Analyses of Anthropic/OpenAI prompt-cache billing
   behavior in practice (TTL re-priming costs, cache-write premiums, invalidation
   patterns), especially as they affect agent workloads.
5. **Subscription-vs-API value comparisons.** Anyone computing break-even or
   value-multiple numbers for AI coding subscriptions against API pricing.

## Where to look

- **Hacker News, exhaustively** — this is the explicit focus. Use the Algolia API
  (`hn.algolia.com/api/v1/search?query=…`, and `/items/<id>` for full threads);
  the html site rate-limits (429). Search combinations like: "Claude Code tokens",
  "token overhead", "Claude Max limits", "prompt caching cost", "agent harness",
  "OpenCode", "claude-counter", "subscription limits", "ANTHROPIC_BASE_URL", "LLM
  proxy usage". Mine the comment threads, not just stories — HN comments often name
  tools and studies no article does. Start from the anchor thread
  (id 48883275) and follow every tool/study named in its comments (e.g. Meridian —
  github.com/rynfar/meridian).
- Blogs/write-ups those threads link to; GitHub repos (search: anthropic proxy
  usage capture, claude limits, token accounting); lobste.rs and r/ClaudeAI //
  r/LocalLLaMA where HN trails lead there.

## Routing rules (mandatory in this repo)

Use `ctx_fetch_and_index(url, source)` + `ctx_search(queries)` for all web content —
WebFetch and curl are blocked. Use descriptive source labels. For the Algolia API,
`ctx_execute(language: "javascript", code: "const r = await fetch(...)")` also works.

## Deliverables

1. **`docs/research.md` updated** — new findings merged into the existing structure
   (new subsections where warranted), each with: what it is, what it found or
   provides, source URL, and a one-line "relevance to SubBench". Dead ends worth
   noting get one line so future sessions don't re-chase them.
2. **A short synthesis section or note** answering: what should SubBench adopt,
   what did others already solve (don't rebuild), what contradicts our current
   methodology, and did anyone already answer the cache-weighting pivot question?
   If anything found invalidates or improves a methodology/protocol rule, list the
   suggested doc change — do not apply methodology changes yourself; flag them for
   operator decision.
3. **`docs/log.md` entry** — date, scope of the sweep (queries run, threads read),
   and pointers to what was added.

## Quality bar

- Exhaustive on HN: stop only after 2 consecutive rounds of new query angles
  surface nothing new (loop-until-dry), not after a fixed count.
- Primary sources over summaries: follow HN links to the actual repo/post and
  verify claims there before recording them.
- Every recorded claim carries its source URL and date. Distinguish measured
  evidence from anecdote — quota-limit complaints are anecdote; captured token
  data is evidence.
- Keep raw fetched content in the sandbox (ctx tools); only distilled findings go
  into the docs.
