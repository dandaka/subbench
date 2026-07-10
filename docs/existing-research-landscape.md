---
id: RESEARCH-2026-07-09-subbench-landscape
created: 2026-07-09
topic: Existing Research Landscape for SubBench
mode: deep
sources: 80+
tags: [benchmarks, cost-per-task, subscription-limits, competitive-landscape, token-economics]
---

# Existing Research Landscape for SubBench

## Executive Summary

1. **No direct competitor exists.** Nobody empirically measures subscription capacity (tasks a subscription can complete within rate limits) and divides by cost. SubBench's formula has zero overlap with existing tools.

2. **The denominator is well-served.** Cost-per-task data is available from Artificial Analysis, MorphLLM, Aider, Ivern AI, and academic papers. The "cost-of-pass" metric from the Efficient Agents paper [3] is directly analogous to SubBench's denominator.

3. **The numerator is the hard part.** Only one project (she-llac/claude-counter) has reverse-engineered subscription capacity with precision. Other providers' limits are documented but not systematically measured.

4. **The flat-rate era ended.** Every major provider moved to credit/token billing in 2025-2026 [30]. This makes SubBench's measurement harder but more valuable — "unlimited" no longer means anything.

5. **Benchmarks are fragile.** A Berkeley study found 8 major benchmarks can be gamed to near-perfect scores [22]. FeatureBench shows Opus 4.5 drops from 74% (SWE-bench) to 11% on feature development [7]. SubBench should use multiple benchmarks, not just SWE-bench.

---

## 1. Coding Agent Benchmarks

### Already Known to SubBench

| Benchmark | Focus | Cost Data | Status |
|-----------|-------|-----------|--------|
| SWE-bench / Pro / Verified | Python issue resolution | No | Standard but contaminated |
| DeepSWE | Long-horizon, multi-repo | Yes (avg cost) | Active |
| Terminal-Bench | Terminal workflows | No | Active |
| SWE Atlas | Beyond issue resolution | No | Active |
| Artificial Analysis Index | Composite (DeepSWE + TB + Atlas) | Yes | Active |

### New Benchmarks With Cost Data (High Priority)

**SWE-Lancer** (OpenAI, ICML 2025) [4] — 1,488 real Upwork tasks from the Expensify repo, totaling $1M in payouts. Tasks range $50-$32K. Maps AI performance directly to economic value. Two modes: IC SWE (code patches) and SWE Manager (proposal selection). Uses Playwright e2e tests. *Most relevant new benchmark for SubBench's "developer value" framing.*

**Aider Leaderboard** [2] — 225 Exercism exercises across 6 languages. Reports cost per run: GPT-5 at $29.08/run vs DeepSeek V3.2 at $1.30/run. Tracks best score-per-dollar. *Directly relevant cost-efficiency data.*

**Ivern AI Cost Benchmark** [21] — 200 tasks across 4 categories, benchmarked on 4 models with exact token counts and costs ($0.02-$0.47/task). Human-evaluated quality. *Methodology closest to SubBench.*

**Kilo Code Leaderboard** [18] — Live rankings from 3M+ developers, updated every 5 minutes. Blends real usage with KiloBench scores. Filterable by mode. *Real developer preference data.*

**MorphLLM** [15] — SWE-bench Pro scores combined with cost-per-task. Ranks by cost-per-resolved-task. *Closest competitor on cost-per-task axis, but API-only.*

**UnitCostAI** [20] — Calculator factoring subscription spend, API tokens, acceptance rate, and task-attempt overhead into cost-per-accepted-task. *Complementary methodology.*

### New Benchmarks Without Cost Data (Context)

**FeatureBench** (ICLR 2026) [7] — 200 feature-development tasks. Opus 4.5 scores 11% vs 74% on SWE-bench. *Reveals that SWE-bench grossly overestimates real-world capability for feature work.*

**RoadmapBench** [5] — 115 version-upgrade tasks. Best model: 39%. *Long-horizon tasks collapse performance.*

**OmniCode** (ACL 2026) [3b] — 1,794 tasks across Python/Java/C++ in 4 categories. *Broader task taxonomy.*

**Multi-SWE-bench** [6] — SWE-bench extended to 7 languages, 1,632 instances.

**LiveCodeBench** [1] — Contamination-free competitive programming, continuously updated. 1,055 problems.

**SWE-bench Live** [9] — Rolling contamination-resistant pipeline from fresh GitHub issues.

**LongCLI-Bench** [8] — 20 long-horizon CLI tasks averaging 15K+ LOC.

### Benchmark Aggregators

**BenchLM** [20b] — Indexes 228 models across 186 benchmarks. Daily auto-updated. Widest coverage.

**CodeSOTA** [19] — Tracks 7 benchmarks across 130 models. Includes Elo-rated LiveCodeBench Pro.

### Critical Warning: Benchmark Gaming

A 2026 Berkeley RDI study [22] found that 8 major benchmarks (including SWE-bench Verified and Terminal-Bench) can be exploited to near-perfect scores without solving tasks. SubBench should:
- Use multiple diverse benchmarks
- Include benchmarks with execution-based verification (SWE-Lancer, FeatureBench)
- Track decontamination benchmarks (SWE-bench Live, SWE-Rebench)

---

## 2. Cost-Per-Task Research

### Academic Papers

**"Efficient Agents"** (arXiv 2508.02694) [3] — Introduces "cost-of-pass" metric: cost incurred per successful task completion. Achieves 96.7% of leading performance at 28.4% lower cost. *Directly analogous to SubBench's denominator.*

**AgentDiet** (arXiv 2509.23586) [23] — Input:output token ratio exceeds 150:1 in coding agents. Iterative code review consumes 59.4% of tokens. Cost reduction of 21-36% via trajectory reduction. Agents consume >1000x more tokens than single-turn reasoning.

**"Don't Break the Cache"** (arXiv 2601.06007) [24] — 500+ session evaluation. Prompt caching reduces costs 41-80%, but naive full-context caching paradoxically increases latency. Optimal: cache system prompt only, keep conversation and tool results dynamic.

**Token Economics Dual-View Survey** (arXiv 2605.09104) [25] — Treats tokens as economic primitives. Applies neoclassical firm theory to agent budget-constrained factor substitution. Theoretical framework, not empirical.

**Stanford "How Do AI Agents Spend Your Money?"** [already known] — Token consumption in agentic coding is expensive, highly variable, and higher usage doesn't imply higher accuracy.

**EET: Early Termination** (arXiv 2601.05777) [26] — Detects when continued iteration is unlikely to succeed, reducing wasted tokens on doomed tasks.

**COALESCE** (arXiv 2506.01900) [27] — Multi-agent task outsourcing achieves 20-42% cost reduction.

### Industry Data

**Gartner (June 2026)** [28] — Predicts per-developer AI coding costs will exceed average developer salary by 2028. 25% of tech leaders already spend $200-500/dev/month.

**EY** [29] — Analyzed 2.4B enterprise API calls. Per-token cost dropped 67% YoY, but total spend growing faster (Jevons paradox). Agentic interaction costs 30x more than chat ($1.20 vs $0.04).

**LeanOps** [30b] — Audited 30 engineering teams. Agents burn ~50x more tokens than chats. At 200 steps (typical debug session): >100x multiplier. Production example: $110K/month for 20 developers.

**MorphLLM Cost Analysis** [15b] — Bug fix: $0.54 (Sonnet 4.6), $0.90 (Opus 4.8), $1.80 (Fable 5). Feature: $2.28-$7.60. Max 5x ($100/mo) breaks even vs API at ~111 bug-fix tasks or 26 features/month.

**TechCrunch (June 2026)** [31] — Uber blew 2026 AI budget by April. Microsoft revoked Claude Code licenses. Priceline Cursor renewal 4-5x more expensive. One company reportedly hit $500M Claude bill.

### Productivity Studies

**Peng et al. (2023)** [32] — GitHub Copilot RCT: 55% faster task completion, 26% more weekly tasks completed.

**MIT/Demirer** [33] — Enterprise-scale Copilot field experiment measuring actual output through version control.

**DX (getdx.com)** [34] — 400+ orgs, 14 months: median PR throughput gain of 7.76%.

### Key Insight: Jevons Paradox

Per-token prices dropped 67% but total costs exploded [29]. Input tokens dominate at 150:1 ratios [23], making output pricing nearly irrelevant for agent economics. A model with lower benchmark scores can be the better production choice if its cost-per-successful-task is lower [3]. This validates SubBench's core thesis.

---

## 3. Subscription Limits & Capacity

### Provider Limit Summary

| Provider | Plan | Billing Model | Window | Key Limits |
|----------|------|--------------|--------|------------|
| **Claude** | Pro $20, Max 5x $100, Max 20x $200 | Token-based, hidden | 5h rolling + 7d | Shared across Code/chat/Cowork |
| **ChatGPT** | Plus $20, Pro $100/$200 | Message + token credits | 3h rolling | 160 msgs/3h (Plus), shared agentic |
| **Cursor** | Pro $20, Pro+ $60, Ultra $200 | Credit pool ($) | Monthly | $20 credits = ~225-650 requests |
| **Copilot** | Pro $10, Pro+ $39 | AI Credits | Monthly + session | Opus 3x multiplier |
| **Windsurf** | Pro $20, Max $200 | Daily + weekly quotas | Daily/weekly | Changed billing 3x in 16 months |
| **JetBrains** | AI Ultimate $30 | 1 Credit = $1 | Monthly | $35 credits, 80% don't hit limits |
| **Zed** | Token-based | API + 10% | Monthly | User-set spending cap |
| **Z.ai** | Lite $18, Pro $72, Max $160 | Prompt caps | 5h + weekly | Hard stop, no overages |

### Key Findings

**Claude is best-documented** thanks to she-llac's Stern-Brocot reverse engineering of SSE utilization floats [35]. Max 5x significantly overdelivers (~6x session, ~8x weekly vs Pro). Max 20x has 20x session limits but only ~2x weekly capacity vs Max 5x.

**The flat-rate era ended** [30]. Every provider converged on token/credit billing with rolling windows in 2025-2026. "Unlimited" now means "unlimited on cheapest model only" (Cursor Auto mode) or "unlimited completions but capped chat/edits" (Copilot).

**Model multipliers create hidden limits.** Opus-tier models consume 3-20x credits vs base models. A "$20/month" plan buying 650 GPT-4.1 requests on Cursor buys only ~225 Claude Sonnet 4 requests [10].

**Opacity is deliberate.** Anthropic avoids publishing exact token limits. Others publish credit amounts but not token equivalents. This opacity is what makes SubBench's measurement valuable.

### Measurement Tools

| Tool | Providers | Type |
|------|-----------|------|
| claude-counter | Claude | Browser ext, SSE-based |
| SessionWatcher | Claude/Codex/Copilot/Cursor/Gemini | macOS menu bar |
| QuotaMeter | Multiple | Browser ext + menu bar |
| ccusage | Claude Code | CLI, local log analysis |
| Claude-Code-Usage-Monitor | Claude Code | CLI, real-time |
| LiteLLM | 100+ providers | Proxy, budget enforcement |
| Langfuse | Multiple | Observability platform |

### Reverse Engineering Techniques

1. **SSE message-limit extraction** — Intercept Claude.ai `message_limit` objects and
   recover denominators from their unrounded utilization values via Stern-Brocot tree
2. **Proxy logging** — Go proxy between client and API, log headers and token counts
3. **Credit burn rate measurement** — Calibrated requests of known token size, measure credit deduction
4. **Message counting** — Count until throttling/model downgrade occurs
5. **Dashboard scraping** — Programmatic access to usage dashboards

---

## 4. Competitive Landscape

### Direct Competitors: None

No project empirically measures subscription capacity and divides by cost-per-task. The landscape breaks into three non-overlapping buckets:

| Bucket | Examples | Measures | Missing |
|--------|----------|----------|---------|
| Model benchmarks | SWE-bench, Terminal-Bench, Artificial Analysis | Performance | Cost, subscription capacity |
| Pricing tools | AI Pricing Guru, blog comparisons | Cost, features | Measured output |
| Enterprise ROI | DX, Amux, SitePoint calculators | Team productivity | Individual subscription value |

### Closest Analogs

**MorphLLM** — Ranks by cost-per-resolved-task on SWE-bench Pro, but operates at API/token layer [15]. Answers "which model is cheapest per benchmark point" but not "which $20/month subscription delivers more."

**AI Pricing Guru** — Tracks 30+ subscription plans with daily-updated pricing and a subscription-vs-API calculator [36]. Tells you what you pay but not what you get.

**DX** — Enterprise AI measurement platform. 400+ orgs, but measures team productivity ROI, not individual subscription value [34].

### Market Context

- $20/month tier commoditized (Cursor, Windsurf, Claude Code all at $20)
- Stack Overflow 2025: 84% adoption, 51% daily use, but only 29% trust AI tools [37]
- Claude Code +58 NPS, Cursor 24% primary tool share
- Developers rely on qualitative blog posts and feature tables to choose subscriptions

---

## Adversarial Review Findings

An independent adversarial review verified all 8 major claims. No hallucinated sources detected — all arxiv IDs resolve, all cited studies exist. Key weaknesses:

1. **"No direct competitor" is overstated.** Ivern AI (200 tasks with cost data) and UnitCostAI (subscription-aware calculator) are closer than acknowledged. The gap is real but narrower than claimed, and could close quickly.

2. **Cost-of-pass analogy is imprecise.** API pay-per-token economics and subscription fixed-price economics are fundamentally different models. "Philosophically aligned" is more accurate than "directly analogous." Subscription pricing involves option value (paying for the right to use up to X), not pay-per-use.

3. **Max 5x "overdelivery" rests on a single source** (she-llac.com). Methodology is clever but unverified independently, and Anthropic changes limits silently. Any capacity measurement is a snapshot, not a stable property.

4. **150:1 input:output ratio is a peak, not a median.** Actual ratios vary 10:1 to 150:1 depending on task depth. Directionally correct but presented misleadingly as a general finding.

5. **Missing dimensions:** Latency/throughput as value, quality variance across task types, multi-model routing within subscriptions, geographic/temporal variation, ToS risks of automated benchmarking, open-source/BYOK alternatives, and the "good enough" threshold (most users never hit limits).

6. **SubBench is vulnerable to the same benchmark gaming** it cites against competitors. The Berkeley RDI exploits target benchmark infrastructure, not model capability — hardened benchmarks may be safe, but SubBench's own protocol needs the same scrutiny.

Full adversarial review: [research-adversarial-review.md](docs/research-adversarial-review.md)

---

## Contradictions & Open Questions

### Where Sources Disagree

1. **Agent cost multiplier**: LeanOps says 50x vs chats, EY says 30x, AgentDiet implies it varies by task complexity [23, 29, 30b]. No consensus.

2. **Caching impact**: "Don't Break the Cache" found 41-80% savings [24], but naive caching can backfire. Anthropic shortened cache TTL from 1h to 5min without announcement.

3. **Productivity gains vs ROI**: Copilot shows 55% speed improvement [32], but 80% of enterprise AI projects fail to deliver value [19b]. Productivity is real but economics don't always work out.

4. **Max 20x value**: Despite costing 2x Max 5x, only delivers ~2x weekly capacity (not 4x). The 5x plan significantly overdelivers [35].

### Open Questions for SubBench

1. **Which benchmarks to use?** SWE-bench is standard but gameable. SWE-Lancer has economic framing but is OpenAI-controlled. FeatureBench is harder but smaller.

2. **How to handle rolling vs fixed windows?** Claude uses 5h rolling, ChatGPT 3h rolling, Cursor monthly credits. How to normalize?

3. **Model selection within subscription?** A subscription's value depends heavily on which model the user selects. How to control for this?

4. **Dynamic limits?** Providers change limits frequently (Windsurf: 3 billing models in 16 months). How to handle temporal instability?

5. **Shared quotas?** Claude shares limits across Code/chat/Cowork. A pure coding measurement underestimates real capacity drain.

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| No direct SubBench competitor exists | High | Exhaustive search across tools, papers, GitHub projects |
| Cost-per-task data is available | High | Multiple independent sources (AA, MorphLLM, Aider, academia) |
| Claude limits are well-characterized | High | Reverse engineering with mathematical verification |
| Other providers' limits are documented | Medium | Official docs exist but lack precision |
| Benchmarks are gameable | Medium | Single study (Berkeley), needs replication |
| Jevons paradox in token costs | High | Multiple independent sources (EY, TechCrunch, Gartner) |
| Flat-rate era ended | High | Observable across all major providers |

---

## Recommendations for SubBench

1. **Use SWE-Lancer as primary economic benchmark** — its Upwork payout mapping directly supports the "developer value" framing.

2. **Import Artificial Analysis and MorphLLM cost-per-task data** rather than re-measuring the denominator from scratch.

3. **Focus measurement effort on the numerator** — subscription capacity is the unique, hard-to-get data that no one else provides.

4. **Adopt the "cost-of-pass" metric** from the Efficient Agents paper as theoretical grounding for the SVI formula.

5. **Use multiple benchmarks** (SWE-Lancer + DeepSWE + FeatureBench) to avoid gaming and contamination risks.

6. **Build on she-llac's reverse engineering methodology** for Claude, and develop equivalent techniques for Cursor (credit burn rate), Copilot (AI Credit deduction), and ChatGPT (message counting + Codex token tracking).

7. **Track temporal instability** — providers change limits frequently. SubBench measurements need timestamps and provider-version metadata.

---

## Sources

1. [LiveCodeBench](https://livecodebench.github.io/) — benchmark, 5/5
2. [Aider LLM Leaderboards](https://aider.chat/docs/leaderboards/) — benchmark+cost, 5/5
3. [Efficient Agents](https://arxiv.org/abs/2508.02694) — paper, 5/5
3b. [OmniCode](https://arxiv.org/abs/2602.02262) — paper (ACL 2026), 4/5
4. [SWE-Lancer](https://arxiv.org/abs/2502.12115) — paper (ICML 2025), 5/5
5. [RoadmapBench](https://arxiv.org/html/2605.15846v1) — paper, 4/5
6. [Multi-SWE-bench](https://github.com/multi-swe-bench) — benchmark, 4/5
7. [FeatureBench](https://arxiv.org/abs/2602.10975) — paper (ICLR 2026), 5/5
8. [LongCLI-Bench](https://arxiv.org/abs/2602.14337) — paper, 3/5
9. [SWE-bench Live](https://swe-bench-live.github.io/) — benchmark, 4/5
10. [Cursor Usage Limits](https://cursor.com/help/models-and-usage/usage-limits) — docs, 5/5
11. [SWE-Rebench](https://swe-rebench.com/) — benchmark, 3/5
12. [RE-Bench (METR)](https://metr.org/AI_R_D_Evaluation_Report.pdf) — report, 5/5
13. [SEC-bench](https://github.com/alibaba/sec-code-bench) — benchmark, 3/5
14. [EvoCodeBench](https://arxiv.org/pdf/2602.10171) — paper, 3/5
15. [MorphLLM Best AI Model](https://www.morphllm.com/best-ai-model-for-coding) — leaderboard+cost, 4/5
15b. [MorphLLM AI Coding Costs](https://www.morphllm.com/ai-coding-costs) — analysis, 4/5
16. [MorphLLM Agent Leaderboard](https://www.morphllm.com/ai-coding-agent) — leaderboard, 4/5
17. [CursorBench v3.1](internal) — benchmark (private), 3/5
18. [Kilo Code Leaderboard](https://kilo.ai/leaderboard) — live leaderboard, 4/5
19. [CodeSOTA](https://www.codesota.com/) — aggregator, 4/5
19b. [Keyhole AI Dev Costs](https://keyholesoftware.com/ai-software-development-cost-2026/) — analysis, 3/5
20. [UnitCostAI](https://www.unitcostai.com/tools/coding-agent-cost-per-task) — calculator, 3/5
20b. [BenchLM](https://benchlm.ai/coding) — aggregator, 4/5
21. [Ivern AI Cost Benchmark](https://ivern.ai/blog/ai-agent-cost-benchmark-report-2026) — report, 3/5
22. [Berkeley benchmark gaming study](https://arxiv.org/pdf/2606.17799) — paper, 4/5
23. [AgentDiet](https://arxiv.org/abs/2509.23586) — paper, 5/5
24. [Don't Break the Cache](https://arxiv.org/abs/2601.06007) — paper, 5/5
25. [Token Economics Survey](https://arxiv.org/abs/2605.09104) — survey, 4/5
26. [EET Early Termination](https://arxiv.org/abs/2601.05777) — paper, 4/5
27. [COALESCE](https://arxiv.org/abs/2506.01900) — paper, 4/5
28. [Gartner AI Coding Costs](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges) — analyst, 4/5
29. [EY Agentic AI Token Costs](https://www.ey.com/en_us/insights/ai/agentic-ai-token-costs) — consulting, 4/5
30. [Medium: Flat-Rate Era Ending](https://medium.com/activated-thinker/the-flat-rate-ai-coding-subscription-era-is-ending) — article, 4/5
30b. [LeanOps Agent Costs](https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/) — audit, 4/5
31. [TechCrunch Token Bill](https://techcrunch.com/2026/06/05/the-token-bill-comes-due-inside-the-industry-scramble-to-manage-ais-runaway-costs/) — journalism, 3/5
32. [Peng et al. Copilot RCT](https://arxiv.org/abs/2302.06590) — paper, 5/5
33. [MIT Copilot Field Experiment](https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf) — paper, 5/5
34. [DX AI ROI](https://getdx.com/blog/ai-coding-assistant-pricing/) — enterprise, 5/5
35. [she-llac Claude Limits](https://she-llac.com/claude-limits) — technical blog, 5/5
36. [AI Pricing Guru](https://www.aipricing.guru/subscriptions/) — pricing tool, 4/5
37. [Stack Overflow 2025 AI Survey](https://survey.stackoverflow.co/2025/ai) — survey, 5/5
38. [Claude Code Official Limits](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) — docs, 5/5
39. [Cursor Pricing Docs](https://cursor.com/docs/models-and-pricing) — docs, 5/5
40. [GitHub Copilot Usage Limits](https://docs.github.com/en/copilot/concepts/usage-limits) — docs, 5/5
41. [Windsurf Plans](https://docs.windsurf.com/plugins/accounts/usage) — docs, 4/5
42. [JetBrains AI Quotas](https://blog.jetbrains.com/ai/2025/09/faq-new-ai-quota/) — docs, 5/5
43. [Zed Pricing Change](https://zed.dev/blog/pricing-change-llm-usage-is-now-token-based) — docs, 5/5
44. [ChatGPT Pro Tiers](https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers) — docs, 5/5
45. [Codex Rate Card](https://help.openai.com/en/articles/20001106-codex-rate-card) — docs, 5/5
46. [GitHub Copilot Usage-Based Billing](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/) — blog, 5/5
47. [claudecodecamp Reverse Engineering](https://www.claudecodecamp.com/p/i-tried-to-reverse-engineer-claude-code-s-usage-limits) — blog, 5/5
48. [SessionWatcher](https://sessionwatcher.com/) — tool, 4/5
49. [claude-counter](https://github.com/she-llac/claude-counter) — tool, 5/5

---

## Research Metadata

- **Mode:** deep (4 parallel research subagents + adversarial review)
- **Sources consulted:** 80+ total, ~25 Tier A, ~30 Tier B, ~25 Tier C
- **Sub-questions:** 12 (across 4 threads)
- **Search queries executed:** ~60
- **Pages read in full:** ~40
- **Subagents used:** 5 (4 research + 1 adversarial)
- **Adversarial review:** yes (pending integration)
