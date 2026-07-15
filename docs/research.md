# Relevant Research

Subbench builds on existing work in coding-agent benchmarking, model cost analysis, and subscription-limit reverse engineering.

## Coding-Agent Benchmarks

### Artificial Analysis Coding Agent Index

Artificial Analysis measures coding-agent performance across benchmark suites and reports:

- pass@1
- token usage
- cache usage
- API cost per task
- wall-clock time
- harness comparisons

This is the closest existing source to the denominator Subbench needs: cost per successful coding task.

Source: https://artificialanalysis.ai/agents/coding-agents

### DeepSWE

DeepSWE is a long-horizon coding benchmark with original tasks across many repositories and languages. It reports:

- pass@1
- average cost
- output tokens
- agent steps

It is useful because it avoids some contamination problems in older coding benchmarks and includes cost data.

Source: https://deepswe.datacurve.ai/

### SWE-bench and SWE-bench Pro

SWE-bench established the standard pattern of testing whether agents can resolve real repository issues. SWE-bench Pro attempts to address contamination, task diversity, oversimplification, and unreliable test environments.

SWE-bench Verified is still useful historically, but it is not ideal as the only benchmark for frontier coding agents.

Sources:

- https://www.swebench.com/
- https://labs.scale.com/leaderboard/swe_bench_pro_public
- https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/

### Terminal-Bench

Terminal-Bench evaluates agents on terminal-based tasks, including software engineering, system administration, data processing, model training, and security workflows.

It is useful for measuring agentic workflows that are not only patch generation.

Source: https://www.tbench.ai/

### SWE Atlas

SWE Atlas evaluates professional software engineering tasks beyond issue resolution, including codebase Q&A, test writing, and refactoring.

Source: https://github.com/scaleapi/SWE-Atlas

## Cost-Per-Task Research

### Artificial Analysis Cost Per Task

Artificial Analysis argues that cost per task is more informative than price per million tokens because models differ in token efficiency, reasoning behavior, caching, and output length.

Their cost metric uses observed token consumption and provider pricing rather than assuming every model consumes the same number of tokens.

Source: https://artificialanalysis.ai/methodology

### Price Per 1M Tokens Is Meaningless

Jan Ilowski's article summarizes why per-token pricing is a weak comparison metric. A model with cheaper tokens can be more expensive per successful task if it needs more tokens, more reasoning, or more attempts.

Source: https://janilowski.pl/en/blog/2026/price-per-m-tokens/

### Playcode: Tokenizer Divergence — "The Real Prices of Frontier Models" (July 2026)

Playcode counted 16 real fixtures (prose, HTML, JS/Python/TypeScript/Rust, JSON tool
schemas, Chinese text, a live agent system prompt) byte-for-byte under each vendor's
*real* tokenizer — Anthropic's `count_tokens` endpoint, OpenAI's documented `o200k_base`
(verified against live `usage` counts on GPT-5.1/5.5/5.6, ratio 1.0000), and Google/xAI
count endpoints — then verified the headline claim against real paid invoices. Findings:

- Identical content, very different bills: the same 2,888-char TypeScript file is
  **681 tokens on GPT-5.x** and **1,178 on Claude's new tokenizer** (1.73×), with
  Grok 4.5 (718) and Gemini 3 Flash (788) near the o200k ruler.
- **Anthropic's new tokenizer (Opus 4.8, Sonnet 5, Fable 5) emits ~30–31% more tokens
  than its previous one (Opus 4.6, Sonnet 4.6) for identical content at the same list
  price** — a silent price increase, confirmed on invoices: Opus 4.6 billed 2,541 input
  tokens where Opus 4.8 billed 3,191 for the same content, each matching its
  `count_tokens` prediction to the exact token. Fable 5 billed the same 3,191 (same
  tokenizer as Opus 4.8, no hidden surcharge).
- Blended over a realistic English coding request, Claude new-tokenizer models run
  ~1.50× effective price versus sticker (e.g. Opus 4.8: $5/$25 list → $7.50/$37.50
  effective on the o200k ruler). Sonnet 5's intro price ($2/$10 until Aug 31, 2026)
  roughly cancels the inflation; from Sep 1 the sticker returns to $3/$15 and the +32%
  token inflation stays.
- Asymmetric measurement risk: OpenAI's `o200k` is frozen and publicly documented;
  Anthropic's tokenizer is undocumented and changes between model generations. (HN
  48896800 discussion adds: OpenAI's last tokenizer update made it *more* efficient.)

Implications for Subbench:

- External validation of the core thesis: compare in dollars per task, never $/Mtok
  ([why-calibration.md](why-calibration.md)); the article's own recommendation is
  "measure in dollars per task — the provider's `usage` field is the ground truth."
- **Tokenizer generation is part of model identity** (protocol §1): if the subscription
  meter is token-denominated, the same task drains ~30% more across the old→new
  tokenizer boundary before any capability difference. Note the Systima-observed
  Fable 5 ↔ Opus 4.8 substitution stays *within* the new generation; a 4.6 ↔ 4.8 mix
  would not.
- Sharpens the critique (see *API-Boundary Metering Proxies*, tiktoken counter-example)
  of any tool estimating Claude tokens with an OpenAI tokenizer: the error is up to
  1.73× on code, not a rounding artifact.
- Anthropic's `count_tokens` endpoint matched billed counts token-exactly — usable as a
  free integrity cross-check for proxy captures (rig task A5).

Sources: https://playcode.io/blog/real-price-of-frontier-models ·
https://news.ycombinator.com/item?id=48896800 (86 points, 2026-07-13)

### PointFive Coding Task Index

PointFive proposes a simple fixed-task cost comparison using a standard coding task of 200K input tokens and 30K output tokens. This is useful for communication, but weaker than measuring actual benchmark task runs.

Source: https://www.pointfive.co/blog/the-pointfive-coding-task-index

## Agent Token Consumption Research

The Stanford Digital Economy Lab paper "How Do AI Agents Spend Your Money?" studies token consumption in agentic coding tasks. It finds that agentic tasks are expensive, input tokens dominate cost, token use is highly variable, and higher token usage does not necessarily imply higher accuracy.

Source: https://digitaleconomy.stanford.edu/publication/how-do-ai-agents-spend-your-money-analyzing-and-predicting-token-consumption-in-agentic-coding-tasks/

### Systima: Claude Code vs OpenCode Token Overhead (July 2026)

Systima spliced a logging proxy between each harness and the model endpoint
(`ANTHROPIC_BASE_URL`), capturing exact request payloads and API usage blocks
(input, cache write, cache read, output tokens). Findings directly relevant to
Subbench:

- Harness baseline is large and model-conditional: Claude Code's fixed overhead was
  ~33k tokens on Sonnet 4.5 but materially smaller on Fable 5 (system prompt 27,787
  chars vs 10,526; the floor ratio vs OpenCode fell from 4.7x to 3.3x). Harness
  overhead is a per-(model, harness-version) quantity, not a harness constant.
- Claude Code produced reproducible mid-session cache re-writes of its full ~43k
  prefix (36,899-85,686 tokens per event across runs), and emits three request
  classes per session (warmup probe, main conversation, subagent calls), each with
  its own cache entry. Cache writes bill at 1.25x; if the quota meter weights cache
  writes like the API does, these events are a large harness-driven variance source
  in per-run drain.
- Cache writes are re-paid whenever a pause exceeds the 5-minute TTL — operator
  pacing mid-run changes drain.
- Subagent fan-out was the largest multiplier measured: 513k metered input tokens vs
  121k for the same task done directly (4.2x for two subagents).
- Under Fable 5, responses were served alternately as `claude-fable-5` and
  `claude-opus-4-8` — the served model can differ from the pinned model.
- Their rig also demonstrates that a Claude Max subscription can be driven through a
  metering gateway (Meridian), i.e. exact per-request token mixes for subscription
  traffic are observable at the API boundary.

The rig itself (MIT-relevant details from the repo, examined 2026-07-13):

- `rig/proxy.mjs` — ~200-line capturing HTTP proxy; forwards to `UPSTREAM_URL`, writes
  one JSON capture per request (exact payload + returned usage block: input,
  cache-write, cache-read, output tokens).
- `rig/run-lane.sh` isolates each lane with fresh config dirs; `rig/analyse.mjs`
  aggregates captures, with `GATEWAY_ENVELOPE_TOKENS` to subtract a measured gateway
  envelope (calibrated by sending a bare one-line request through the same chain first).
- Captures carry a `servedModel` field — how they caught silent model substitution.
- `rig/ingest-audit.mjs` replays captures into a SHA-256 hash-chained, verifiable audit
  log (their 273-record July 2026 chain verifies end to end) — a pattern worth copying
  for Subbench measurement evidence.
- `qbench/` seeds a per-lane nonce-instantiated ten-assert test suite, hashed before and
  after each lane to prove the harness didn't modify its own exam; `results/results.json`
  publishes all 58 lanes / 273 requests. Raw captures stay private (they embed full
  system prompts); the rig regenerates equivalent captures for any setup.

Relevance to Subbench: a candidate route to the cache-weighting pivot question
(regressing rounded batch drain deltas on exact proxy-captured token mixes) — see
cache-weighting-experiment.md §4 for the design sketch and its isolation/ToS caveats.

Sources:

- https://systima.ai/blog/claude-code-vs-opencode-token-overhead
- https://github.com/systima-ai/agentic-coding-tools-comparison

Caveat on Systima's numbers (HN deep-research sweep, 2026-07-13): the study is
self-admittedly AI-written and its traffic ran through the authors' own Meridian gateway
(~6.2k-token envelope they had to calibrate out), so treat the exact figures as
directional. Independent checks (below) corroborate the *direction and mechanism* but
soften the headline 33k number.

### API-Boundary Metering Proxies (prior art for the capture technique)

A community of logging/metering proxies already exists for putting a recorder between an
agent harness and the model endpoint. Only a few actually read the provider **usage block**
(input / cache-write / cache-read / output) rather than estimating tokens or merely routing.
Surveyed 2026-07-13 (HN + GitHub source inspection).

- **claude-meter** (github.com/abhishekray07/claude-meter; HN item 47536655) — the closest
  and arguably strongest prior art to Subbench's whole thesis, and a **more complete
  capture than Systima's rig**. A local pass-through Go proxy + Python analysis layer,
  self-described as a "local research proxy for understanding how Claude Code usage maps to
  Anthropic's hidden quota system." Source-verified: `normalize_sniffer_log.py` reads the
  real response usage block (all four token fields), and `_normalize_ratelimit()` parses the
  `anthropic-ratelimit-unified-5h/7d` headers for per-window `status` + `utilization`
  (0..1) — i.e. it captures the hidden quota signal *and* the token mix together.
  `internal/normalize/sse.go` reassembles streaming usage across `message_start` /
  `message_delta`; `analyze_normalized_log.py` already has a `usage_value(...,
  cache_read_weight=...)` knob tested at 0.10/0.30/0.50 — a direct prototype of Subbench's
  cache-weighting question. Pure local pass-through (uses the user's own Claude Code auth,
  no subscription bridging), so it fits Subbench's approved instrumentation posture.
  Relevance: read in full before building further; its unified-ratelimit-header capture is
  the piece Systima's rig lacks and is exactly what pairs a token mix to a quota-window
  drain. **This is the single most important find of the sweep.**
  Evaluation verdict (2026-07-13, source read in full): **BORROW, not adopt/fork.** The
  repo has **no license** (all rights reserved by default — cannot legally vendor or
  redistribute), but its design is exactly right and cheap to reimplement: a true
  zero-envelope stdlib-Go pass-through tee (`GATEWAY_ENVELOPE_TOKENS=0` satisfied),
  capturing all four token classes from both JSON and SSE (`message_start`→`message_delta`
  reassembly), per-window utilization floats + reset timestamps, and a Python
  `usage_value(cache_read_weight=...)` knob that already prototypes §4's regression. It
  **confirms** the cache-weighting-experiment.md §4 caveat that a rounded meter is coarse
  (its own estimates span ~10× bands) rather than refuting it. To build on it Subbench must
  add: a permissively-licensed reimplementation, hash-chained audit log (Systima-style),
  lossless non-dropping capture, Codex/Z.ai normalizers (it is Anthropic-only), the
  constrained drain-regression solver, and the protocol §2 isolation gate.
- **OngoingAI Gateway** (github.com/ongoingai/gateway) — open-source Go gateway on
  `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL`; "tokens, latency, cost always captured;
  request/response bodies opt-in." Cleanest productized always-on-token / bodies-private
  posture if a more built-out base than a ~200-line proxy is wanted; confirm it splits the
  four cache/input/output fields in source before adopting.
- **Tokentap / Sherlock** (github.com/jmuncor/tokentap; HN 46799898, 218pt) — the highest-
  profile "MitM proxy to see what your LLM tools are sending," but a **cautionary
  counter-example**: it *estimates* tokens with `tiktoken.cl100k_base` (OpenAI's tokenizer,
  wrong for Claude) on the request it constructs, not the response usage block, and has no
  cache fields. Good prompt-archival UX, unreliable numbers — do not use its counts as
  measurement.
- **PrismCat** (github.com/paopaoandlingyia/PrismCat; HN 48279360) — transparent proxy using
  subdomain routing (`openai.localhost`) so request paths are unmodified; captures full
  request/response including SSE. A clean transparency pattern, but a traffic inspector, not
  a token meter (you'd add usage parsing).
- **Meridian** (github.com/rynfar/meridian) — the tool Systima used. Confirmed a
  subscription **bridge**: it exposes a Claude Max sub as a standard Anthropic/OpenAI HTTP
  endpoint via the Claude Code SDK `query()` (not OAuth interception). ToS-gray and the
  *opposite* of clean pass-through logging — Subbench's ToS Position explicitly does not
  authorize this variant. Reference for what not to do.
- **codex-responses-api-proxy** (github.com/openai/codex, `codex-rs/responses-api-proxy`;
  surveyed 2026-07-14) — OpenAI's own strict pass-through proxy for Codex, and the
  confirmed interposition mechanism for a Codex-side capture rig: Codex accepts a custom
  `model_providers` entry in `~/.codex/config.toml` (`base_url` + `wire_api='responses'`,
  selectable per-run via profile or `-c` flags) — the exact analogue of our
  `ANTHROPIC_BASE_URL` hook, no TLS MITM needed. `--dump-dir` writes each request/response
  as a pair of JSON files; design details worth stealing for `packages/proxy`: strips any
  incoming `Authorization` and injects its own (key read from stdin, `mlock`'d), overrides
  `Host`, 403s everything except the one expected endpoint, writes a `server-info.json`
  (port/pid) for scripted startup. **Caveat:** as shipped it forwards only to
  `api.openai.com/v1/responses` with an API key — Codex on a ChatGPT subscription uses
  ChatGPT OAuth against the ChatGPT backend, so subscription-side capture (Subbench's
  target) reuses the mechanism, not the binary: retarget the forward URL and pass the OAuth
  auth through instead of injecting a key.
- Heavier observability gateways that also capture at the boundary — **LiteLLM**,
  **Bifrost** (maximhq/bifrost), **Braintrust proxy**, **Helicone**, **TensorZero**,
  **Dev Proxy v0.28** (Microsoft; OpenAI-only, no Anthropic cache split) — all viable
  backends but their OpenAI-schema normalization risks collapsing Anthropic's 4-way token
  split; overkill for a focused capture rig.

Sources:

- https://github.com/abhishekray07/claude-meter (HN https://news.ycombinator.com/item?id=47536655)
- https://github.com/ongoingai/gateway
- https://github.com/jmuncor/tokentap (HN https://news.ycombinator.com/item?id=46799898)
- https://github.com/paopaoandlingyia/PrismCat
- https://github.com/openai/codex/blob/main/codex-rs/responses-api-proxy/README.md
- https://github.com/rynfar/meridian

Dead ends (recorded so future sweeps don't re-chase): cost-reduction/compression proxies
(TokenShield, Tamp, Frugon), PII/security firewalls on the base URL, key-rotation proxies,
and token-pooling/arbitrage services (ClawPool) — none is a clean measurement layer and
their savings/value numbers are self-reported marketing, not measured evidence.

## Harness Token-Overhead — Independent Corroboration

Third-party measurements that test Systima's claims (surveyed 2026-07-13). Distinguish
measured token counts from complaint-level anecdote.

- **Leaked Claude Code system prompts** (github.com/asgeirtj/system_prompts_leaks) —
  versioned artifacts (`claude-code-2.1.172-*`, same minor line as Systima's 2.1.207).
  Measured sizes: full payload with tool schemas ≈ 90–94k chars (~22–24k tok) for
  opus-4.8 / fable-5; system-prompt-only leak ≈ 64k chars (~16k tok), plus a separate ~84KB
  deferred-tools file. OpenCode ≈ 15.6k chars (~3.9k tok), Codex gpt-5.5 ≈ 4.9k tok. The
  CC:OpenCode prompt-only ratio is ≈ **4.1x**, close to Systima's 4.7x floor — the
  **multiplier direction and magnitude are independently corroborated**. Note: the fable-5
  file is *larger* than opus-4.8 here, so Systima's "Fable = much smaller system prompt"
  is version/measurement-specific, not a stable property.
- **The 33k figure is version- and measurement-dependent, not fabricated.** HN commenters
  (`mh-`, `mft_` on item 48883275) pasted live `/context` from fresh Opus 4.8 sessions:
  system prompt ~3.9–4.5k, system tools ~7.9–13.9k (~15–23k total shown). Claude Code now
  uses **progressive tool disclosure** (tools loaded on demand), which shrank the
  resident-tool line versus older builds. Systima's 33k = an older pinned build with full
  tool schemas resident + their own ~6.2k gateway envelope, metered as raw wire bytes vs
  `/context`'s narrower categorized view. Comparable current fixed floor ≈ **15–24k tok**.
  The mechanism and ~4–5x ratio survive; the exact 33k is high-end and stale-leaning.
- **Cache-read dominance corroborated by two independent session-log tools.**
  `tokenscope` (github.com/wartzar-bee/tokenscope) on one real session: cache reads = 66%
  of spend, cache writes 18%, output only 16% ("whole context re-sent every turn").
  `CodeBurn` (github.com/AgentSeal/codeburn) on an aggregate: cache-read 3.38B vs raw input
  23.9M tokens (141x), 99.3% cache-hit. Both confirm re-sent context — not output — is the
  dominant cost, validating Subbench's focus on metered input and the cache re-write
  mechanism Systima described.
- **Pi minimal-overhead confirmed** (github.com/earendil-works/pi): its
  `harness/system-prompt.ts` is ~1.2k chars (a skills formatter, not a preamble) — a useful
  low-overhead anchor. Caveat (HN `GodelNumbering`): raw prompt size ≠ efficiency; buggy
  tools cause extra round-trips, so a minimal prompt is not automatically cheapest.
- **dirac benchmark** (github.com/dirac-run/dirac) — 7 open harnesses × 8 real refactor
  tasks, same model: ~4x $/task spread ($0.18–$0.73), reproducible on public repos.
  Corroborates that *harness, not model,* drives cost, but excludes Claude Code/Codex
  (proprietary harnesses), has a known cache-read pricing bug in its cost table, and
  publishes only $/task, not token traces. Author discloses building Dirac.
- Anecdote (directional only, no token counts): quesma "the true cost of saying hi" (trivial
  prompts triggering 30+ tool calls); widespread HN complaints that Claude Code "does too
  much" since ~Feb 2026; **subagent fan-out** repeatedly cited as the largest multiplier
  (one user: a task spawned 7 subagents and blew the budget before any finished),
  corroborating Systima's 4.2x subagent number in direction.

Sources:

- https://github.com/asgeirtj/system_prompts_leaks
- https://github.com/wartzar-bee/tokenscope
- https://github.com/AgentSeal/codeburn
- https://github.com/earendil-works/pi
- https://github.com/dirac-run/dirac
- https://quesma.com/blog/the-true-cost-of-saying-hi-to-an-ai-agent

## Subscription-Limit Research

### Claude Limits Reverse Engineering

The Claude limits article demonstrates a method for inferring hidden subscription capacity from precise usage floats. It reconstructs internal plan credit limits and maps usage to token-equivalent/API-equivalent value.

This is the closest existing work to the numerator Subbench needs: observed subscription capacity.

Source: https://she-llac.com/claude-limits

Related tool: https://github.com/she-llac/claude-counter

### Multi-Provider Usage Collection

ClaudeBar is an open-source macOS quota monitor with separate collectors for Claude,
Codex, Z.ai, OpenCode Go, Cursor, Copilot, Gemini, and other coding tools. Its provider
layer demonstrates several practical quota interfaces, including Codex app-server RPC,
Claude's OAuth usage endpoint, and Z.ai's quota endpoint.

Subbench distinguishes server-reported quota data from CLI display parsing and local
reconstruction, then retains snapshots as measurement evidence under the protocol.

Sources:

- https://github.com/tddworks/ClaudeBar

### Meter-Recovery Tooling and Endpoints (2026-07-13 sweep)

A crowd of independent tools converges on the same fact: the subscription utilization %
is **served verbatim by the provider's usage endpoint**, and cannot be reliably
reconstructed from local token logs. This is load-bearing for Subbench — it means drain
must be *measured from the meter*, not derived from token accounting.

- **The canonical Claude source is the OAuth `/usage` endpoint**
  (`/organizations/{org}/usage`), read by claumon (github.com/fabioconcina/claumon),
  cc-hdrm (github.com/rajish/cc-hdrm), CreditWatcher (github.com/aalksii/creditwatcher),
  and 20+ menu-bar widgets (hamed-elfayome/Claude-Usage-Tracker ★3018, and others). It
  returns an authoritative `limits` array of `{ kind, percent, resets_at, scope }` —
  confirming Max exposes **separate buckets**: a 5-hour session, a global weekly, and
  **per-model weekly** limits (Sonnet/Opus/Fable). Only the percent is authoritative; every
  tool that back-converts % to tokens uses guessed caps.
- **claumon** adds statistical forecasting: it reads the live OAuth gauges ("measured, not
  estimated from logs") and forecasts utilization-at-reset with an 80% credible interval via
  an empirical-Bayes (Gamma-process) model refit daily on the user's own history. It models
  the % *trajectory* but does not decompose the meter's token weighting.
- **she-llac/claude-counter** (already known) is the highest-precision readout: the
  claude.ai chat SSE `message_limit` object gives exact unrounded utilization floats, versus
  the rounded `/usage` page — consistent with protocol §5's exact-float scope note.
- **Codex** exposes its subscription meter as windowed **`usedPercent`** (not tokens) via a
  JSON-RPC `account/rateLimits/read` to the Codex app-server (ClaudeBar / CreditWatcher).
  **Z.ai** uses `GET api.z.ai/api/monitor/usage/quota/limit` with a Bearer key. These give
  reproducible, direct meter reads per provider.
- **cc-rate-widget** (github.com/hulryung/cc-rate-widget) states the negative result plainly:
  even with cache-aware pricing that matches ccusage on cost, "Anthropic's official quota %
  can't be derived from local logs, so the widget never fakes one" — the meter applies its
  own undisclosed weighting.
- Community mechanics (anecdote, but decision-relevant for run scheduling): the **weekly
  window is usage-anchored, not a fixed calendar 7 days** — the reset drifts forward on idle
  days (HN 45696713); Anthropic frames Pro limits as "40–80 hours of Sonnet" — a
  model-weighted, wall-clock-ish framing rather than a raw token count (HN 44713757); and
  **headless `claude -p` may fall to API/credit billing** rather than the subscription meter
  (HN 48129753) — a trap any automated run must guard against.

Sources:

- https://github.com/fabioconcina/claumon
- https://github.com/rajish/cc-hdrm
- https://github.com/aalksii/creditwatcher
- https://github.com/hulryung/cc-rate-widget

### The Cache-Weighting Pivot — What the Sweep Found (and Did Not)

The pivot question (does the subscription **quota meter** discount cache reads the way the
API does?) drove this sweep. Verdict after adversarial source verification: **nobody has
answered it with measured evidence.** The one source publishing explicit per-token meter
weights is a single hobbyist extension whose author labels the numbers guesses.

- **lugia19/Claude-Usage-Extension** is the only tool publishing numeric weights:
  `CACHING_MULTIPLIER: 0 // Seems to be free.`, `EXTRA_USAGE_CACHING_MULTIPLIER: 0.1`,
  `OUTPUT_TOKEN_MULTIPLIER: 4`, `MODEL_WEIGHTS: {Fable:10, Opus:5, Sonnet:3, Haiku:1}`.
  Read as: in-plan, cache reads counted ~0× (more generous than the API's 0.1×); output ~4×
  input; model-weighted; flipping to the API-style 0.1× cache discount only in paid overage.
- **Critical correction (source verified 2026-07-13):** these weights do **not** decode the
  meter. The extension displays the official `/usage` percent verbatim (`percentage:
  obj.utilization`); the weights feed a *separate, self-authored* "tokens-remaining"
  estimator over caps the author explicitly calls `// I have no idea. This is very napkin
  math.` and `// mostly just vibes`. The Pro and Max-20x cap objects are empty
  (price-ratio extrapolated). So the weights are one person's **model of why the meter
  moves**, not a measurement of it.
- **The "cache writes drain heavily" half is unsupported.** The code has no cache-write
  multiplier at all; first-pass tokens are ordinary 1× input. And bcherny's
  claude-code#45381 (sometimes cited for this) is about telemetry disabling the 1-hour
  cache TTL — it says nothing about writes-vs-reads counting against quota. No independent
  tool reproduces a cache-read=0 meter weight; the 20+ other trackers all treat the server %
  as opaque.
- **Best obtainable resolution:** on subscriptions, cache reads are ~free *in dollars* (the
  provider absorbs the cost under the flat fee), while cache *writes* still consume quota;
  and subscriber vs API cache TTL defaults now **diverge** (bcherny: 1-hour rolled out by
  default for subscribers, API stays 5-minute — claude-code#45381). This confirms
  **subscription meter ≠ API dollar cost**, which is directionally the "no" case for the
  pivot — but the exact meter weighting remains unmeasured.

Net: treat lugia19's weights as a **single-source hypothesis to test**, not evidence. The
route to a real answer is claude-meter-style capture (usage block + unified-ratelimit
utilization headers) paired with contiguous batch drain — exactly the design in
[cache-weighting-experiment.md](cache-weighting-experiment.md) §4.

Sources:

- https://github.com/lugia19/Claude-Usage-Extension
- https://github.com/anthropics/claude-code/issues/45381

## Prompt-Cache Economics in Practice

How Anthropic/OpenAI prompt-cache *billing* behaves under agent workloads (2026-07-13
sweep). Bears on the drain-variance rules in methodology (Measurement Conditions) and on
the API side of the subscription-vs-API comparison.

- **Multipliers (baseline, confirmed):** 5-minute cache write = 1.25× input; **1-hour write
  = 2× input**; read = 0.1×. A cache pays off only when reads-per-write exceed the write
  premium (firetiger, citing Anthropic docs).
- **The resume-after-TTL repricing tax is large and quantified.** weidongzhou's Part 2
  analyzes a real 31-hour Claude Code session costing $172.58, of which ~66% ($115) was
  cache reads. On a 53.6k-token prefix, the first message after cache expiry costs ~12× a
  warm message *and ~25% more than never caching at all* (you pay the 1.25× write for a
  cache you never read). This is the concrete cost behind protocol §4's "never pause
  mid-run longer than the TTL" rule.
- **Agent workloads waste cache badly by default** (firetiger, running "a few hundred LLM
  agents"): an agent pointed at its own bill cut prompt-cache waste ~77% — correct TTL is a
  property of the workload and can't be intuited up front; a 1-hour write on a subagent that
  fires one query is pure waste. Corroborates that subagent fan-out inflates cache-write
  drain.
- **Claude Code has documented cache-busting bugs** relevant to reproducibility: (a)
  disabling telemetry silently forced 5-minute TTL instead of 1-hour for Max subscribers
  (claude-code#45381, fixed in 2.1.108); (b) the prompt's middle cache block includes
  git-status, so **every commit busts it** and re-pays a ~6k cache-write on the next query
  (workaround `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`). Both change drain independently of
  the task — instrumentation Subbench runs should pin these flags.
- **kern-ai**: a >100k-token agent prompt with a 5-tool turn re-sends the full prompt 6× =
  600k input tokens for one message; byte-identical prefixes are required ("one token
  difference invalidates the entire cache"), busted by sliding-window drift, summary churn,
  or moving breakpoints — the same mechanisms behind Claude Code's mid-session re-writes.

Sources:

- https://blog.firetiger.com/agentically-optimizing-llm-prompt-cache-ttls-for-fun-and-profit/
- https://weidongzhou.wordpress.com/2026/06/06/deep-dive-into-llm-token-cost-blog-series-part-2-how-prompt-caching-actually-works/
- https://kern-ai.com/blog/prompt-caching

## Subscription-vs-API Value Comparisons

Prior attempts at the exact break-even / value-multiple arithmetic Subbench produces
(2026-07-13 sweep).

- **ccusage** (github.com/ryoppippi/ccusage) and **CC-Ledger** already implement Subbench's
  API-side arithmetic: read local Claude Code session usage blocks
  (input/output/cache-write/cache-read) and multiply by LiteLLM's public per-token API
  pricing to produce a *hypothetical API-equivalent USD cost* for subscription usage.
  **Important caveat for Subbench:** this prices cache reads at the API's 0.1×, so the
  ccusage dollar figure is an **API-equivalent upper bound**, not the subscriber's true
  quota drain (the meter's cache weighting is unknown; reads may be ~free on-meter). Use
  ccusage numbers as the API comparison anchor, never as the subscription drain itself.
- **Value multiples people report** (anecdote, API-price-anchored, ccusage-measured):
  ~31× on a $200 Codex sub ($6.2k API-equivalent in 30 days); a fully-maxed top tier ≈
  "$15k in tokens"; per-question trivial tasks ~$0.50 (Opus) to ~$1 (Fable) on metered API.
  Multiples of 10–75× are commonly claimed and depend entirely on how hard the sub is
  maxed — which is exactly why Subbench leads with break-even, not the multiple.
- Market context: OpenAI's $100 tier explicitly targets developers hitting Codex/Claude
  limits; token-per-task keeps rising ("models became chatty"); tiers and economics move
  frequently — reinforcing the nonstationarity caveat and periodic re-baselining.

Sources:

- https://github.com/ryoppippi/ccusage
- https://thenewstack.io/openais-new-100-tier-targets-developers-hitting-codex-and-claude-code-limits/

## Gap

Existing work can answer:

- Which coding agent solves more tasks?
- Which model is cheaper per API task?
- Which harness uses fewer tokens?
- How expensive are agentic coding tasks?
- What are Claude's hidden quota mechanics?

Existing work does not yet answer:

- How many successful benchmark-equivalent tasks does each subscription plan actually buy?
- How do Claude, OpenAI, and Z.ai subscriptions compare under the same task economics?
- What is the API-equivalent value multiple of each subscription?
- How confident are the quota estimates?
- **Does the subscription quota meter weight cache/output/model tokens like the API?** The
  2026-07-13 sweep found only one hobbyist's uncalibrated guess (lugia19) and confirmed the
  meter % is opaque server output — so this is still open, and it is the pivot.

Subbench targets that gap.

## Synthesis for Subbench (2026-07-13 HN deep-research sweep)

What to adopt, what others already solved, what contradicts current methodology, and
whether the pivot is answered. The sweep read the anchor HN thread (item 48883275, 339
comments) and ~18 query angles across HN Algolia, plus GitHub source for every recorded
tool and an adversarial re-verification of the pivot claim.

**Adopt / don't rebuild:**

- **claude-meter** (abhishekray07) is the reference rig to build on, not reinvent. It
  already does what Subbench's proxy plan needs *and more* than Systima's rig: reads the
  response usage block (4 token fields), parses the `anthropic-ratelimit-unified-5h/7d`
  utilization headers, reassembles SSE usage, stores normalized JSONL, and has a
  cache-read-weight knob. Reading it before writing our own capture code is the highest-
  leverage next step. Keep it pure pass-through (its default), consistent with the approved
  ToS Position.
- **The meter is read, not derived.** Every serious quota tool reads a server endpoint
  (Claude OAuth `/usage` `limits` array; Codex `account/rateLimits/read` `usedPercent`;
  Z.ai `monitor/usage/quota/limit`; claude.ai SSE `message_limit` float for exact Claude
  capacity). Subbench should read these directly and treat local token logs as the *API
  side* only. cc-rate-widget's negative result (official % not reconstructable from local
  logs) confirms this is not a shortcut we can take.
- **ccusage's method = our API side, already built.** It is the exact local-usage ×
  LiteLLM-pricing arithmetic — reuse it as the API-equivalent anchor, but label it an upper
  bound (it prices cache reads at API 0.1×, not the subscriber's on-meter reality).

**Contradicts / improves current methodology (flag for operator — not applied here):**

- **Systima's 33k floor is stale-leaning.** Independent leaked-prompt sizes + live
  `/context` show progressive tool disclosure dropped the comparable current fixed floor to
  ~15–24k tok, though the ~4–5x CC:OpenCode ratio and the cache-re-write mechanism survive.
  *Suggested doc change:* methodology's Harness Mismatch Disclaimer cites "~33k-token
  baseline on Sonnet 4.5"; consider annotating it as a version-specific high-end figure
  (progressive disclosure ⇒ ~15–24k on current builds) so the per-(model, harness-version)
  point isn't over-anchored to 33k.
- **Two Claude Code cache-busting behaviors should be pinned in the harness:** telemetry
  flags coupling to cache TTL (claude-code#45381) and git-status busting the middle cache
  block every commit (`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`). *Suggested doc change:* add
  these to protocol §4 / Harness Isolation as flags to fix per run, since both change drain
  independently of the task.
- **`claude -p` headless may bill at API/credit rates, bypassing the subscription meter.**
  *Suggested doc change:* protocol should require verifying which meter a run actually
  drains (a benchmark run that silently hits API pricing is invalid). Relates to the Data
  Schema's served-model field.
- **The weekly window is usage-anchored (drifts on idle days), not a fixed calendar 7
  days.** Consistent with the weekly-normalization decision but worth an explicit protocol
  note for run scheduling and reset timing.

**Did anyone answer the cache-weighting pivot?** No — not with measured evidence. The
adversarial pass refuted the strong reading of lugia19's constants: they are a self-
described "vibes / napkin math" *estimator*, the meter % is served verbatim by Anthropic,
and the "cache-writes-drain-heavily" claim has no basis in the cited code. What *is*
established: subscription cache reads are ~free in dollars while writes still consume
quota, and subscriber vs API cache TTL defaults diverge — i.e. subscription meter ≠ API
dollar cost (directionally the "no" case). The cache-weighting-experiment.md §4
proxy-regression route remains the way to get a real answer; this sweep found the better
tool (claude-meter) to run it, not the answer itself.

Full working notes (per-tool detail, EVIDENCE/ANECDOTE tags, dead ends, and the pivot
verification) are archived from the sweep; only distilled findings are recorded above.

## Z.ai / GLM Economics Sources (2026-07-13 sweep)

Deep-research sweep for a GLM-5.2 neutral-harness economics record (pass@1 + cost/task).
Full report + ranked recommendation memo:
[research-zai-economics.md](research-zai-economics.md). Headline: the
"no record exists" premise was **stale** — DeepSWE v1.1 upstream now publishes GLM-5.2.

**Candidates found**

- **DeepSWE v1.1 (adopted primary) — QUALIFIES.** Live leaderboard
  (deepswe.datacurve.ai, "updated July 9 2026") lists `glm-5.2[max]`: Pass@1 44%±2%,
  avg cost $3.92, out tok 78k, 129 steps, on mini-swe-agent like every other model.
  Verified by direct fetch (×2). This is the exact neutral-harness economics record the
  project believed did not exist. The local freeze
  `data/deepswe-v1.1-calibration-tasks.json` (2026-07-10, 4 models) predates the GLM-5.2
  addition — a re-pull closes the gap. Caveat: `[max]` is the **only** GLM-5.2 tier on the
  board; $3.92 is an API reference price, not a Z.ai window-dollar (Harness Mismatch
  Disclaimer applies).
- **Artificial Analysis — QUALIFIES (broad, not coding-only).** GLM-5.2 on the Intelligence
  Index with per-task cost + pass metrics on a uniform harness; useful for the required
  cross-source sanity check.
- **SWE-bench Pro (Scale public set) — near-miss.** GLM-5.2 at 62.1% Pass@1, neutral
  scaffolding, but the board has no per-task-cost column (cost derivable from published
  output tokens × Z.ai pricing if ever needed).
- **Terminal-Bench 2.1 — near-miss.** GLM-5.2 covered, but "best-reported-harness" numbers
  are not uniform and no per-task cost column.
- **Aider polyglot / FrontierCode 1.1 / Zhipu official / Chinese boards (C-Eval, SuperCLUE)
  — no.** GLM-5.2 not listed (Aider/FrontierCode) or vendor-self-report, not a third-party
  neutral harness with per-task cost.

**Neutral harnesses (the user's pi.dev / opencode question) — real, but moot for this gap**

- **pi.dev** (`earendil-works/pi`, MIT, 70,382★) — genuine model-agnostic harness;
  provider source registers `glm-5.2` first-class; model-neutral system prompt; ships no
  benchmark/leaderboard. Valid neutral harness; unnecessary since the record exists.
- **OpenCode** (`anomalyco/opencode`, MIT, 185,367★) — model-agnostic, first-class Z.AI
  provider, headless `run --format json --auto`, native cost via `stats`/`export`; lower,
  cache-stable prompt overhead than Claude Code (Systima). **Disqualified for Subbench**:
  (a) Anthropic legal action (Mar 2026, PR #18186) removed its Claude Pro/Max
  subscription-auth plugin — the exact subscription-drive capability Subbench measures;
  (b) it re-pays its prompt baseline per turn, so its per-task cost is **not comparable** to
  the mini-swe-agent board, defeating "neutral."

**Self-generation (Path 3) — cheap but mostly moot.** Task set is open: `datacurve-ai/deep-swe`
(Apache-2.0, 113 Harbor tasks + verifiers) run via `datacurve-ai/pier` (Apache-2.0) on
mini-swe-agent (MIT, litellm → Z.ai OpenAI-compatible endpoint). GLM-5.2 API pricing
$1.40/$4.40/$0.26 per M in/out/cached (Z.ai first-party, 2026-06-16). Rough cost ~$30–80,
<1hr parallel on Modal — but **extrapolated, not measured**, and redundant now that DeepSWE
publishes the row. Revive only for a non-`[max]` effort tier.

**Recommendation (feeds plan.md R.2):** re-pull DeepSWE v1.1 and ingest the `glm-5.2[max]`
row (`[max]`-labeled, $3.92 as API reference price); clear Z.ai `economics_gap`. No harness
build, no self-generation. Dead ends (one line each): Aider/FrontierCode no GLM-5.2;
OpenCode legally clouded + cost-incomparable; SWE-bench Pro / Terminal-Bench lack a per-task
cost column; Chinese boards are vendor self-reports.
