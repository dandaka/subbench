# Competitor & Landscape Research — SubBench

Research date: 2026-07-09

## Findings

### 1. Morph LLM — Cost-Per-Task Leaderboards
**URL:** https://www.morphllm.com/best-ai-model-for-coding  
**URL:** https://www.morphllm.com/best-ai-coding-agents-2026  
**URL:** https://www.morphllm.com/ai-coding-costs  

**What it does:** Ranks AI models and agents by SWE-bench Pro score AND cost per task. Calculates cost-per-resolved-task by dividing attempt cost by solve rate. Also provides real monthly spend estimates from token math ($20 to $1,000+).

**How it measures value:** Cost-per-point on SWE-bench Pro (e.g., Claude Haiku 4.5 ~$0.13/point, Opus 4.6 ~$0.48/point). Terminal-Bench leaderboard for agents (Codex+GPT-5.5 at 83.4%, Claude Code+Fable 5 at 83.1%).

**Difference from SubBench:** Morph measures API-level cost efficiency, not subscription-level value. It answers "which model gives best benchmark score per API dollar" — not "which $20/month subscription gives more real developer work." SubBench's subscription capacity measurement is absent here. Morph also does not measure what you actually GET within a subscription's rate limits.

**Relevance:** HIGH — closest competitor on the cost-per-task axis, but operates at API/model layer, not subscription layer.  
**Confidence:** 5/5

---

### 2. Artificial Analysis — Coding Agent Index
**URL:** https://artificialanalysis.ai/agents/coding-agents

**What it does:** Composite leaderboard built from DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA. Tests reading codebases, implementation, bug fixes, and terminal workflows.

**How it measures value:** Performance score only. Codex-GPT-5.4 leads at 71.1% index score. No cost or subscription value dimension.

**Difference from SubBench:** Pure performance benchmark — no cost, no subscription analysis, no value-per-dollar.

**Relevance:** MEDIUM — good performance data SubBench could reference, but no overlap on the value proposition.  
**Confidence:** 5/5

---

### 3. AI Pricing Guru
**URL:** https://www.aipricing.guru/subscriptions/  
**URL:** https://www.aipricing.guru/calculators/subscription-vs-api/

**What it does:** Tracks 30+ AI subscription plans across 7 providers with daily-updated pricing. Offers a "Subscription vs API Cost Calculator" comparing flat-rate subscriptions against pay-as-you-go API costs.

**How it measures value:** Pure pricing comparison — features, models included, usage limits. The subscription-vs-API calculator estimates break-even points. Does NOT measure what you can accomplish within a subscription.

**Difference from SubBench:** Tracks price and features exhaustively, but never measures output quality or capacity. It tells you what you pay but not what you get in terms of successful work.

**Relevance:** HIGH — complementary data source, but SubBench's "observed capacity per dollar" metric is completely absent.  
**Confidence:** 5/5

---

### 4. DX (getdx.com) — AI ROI Framework
**URL:** https://getdx.com/blog/ai-coding-assistant-pricing/  
**URL:** https://getdx.com/blog/ai-roi-calculator/

**What it does:** Enterprise-focused AI measurement platform. Tracks utilization, impact, and cost across AI tool deployments. Found median PR throughput gain of 7.76% across 400+ orgs over 14 months. Provides ROI calculator.

**How it measures value:** Organizational ROI: time saved, PR throughput, cycle time reduction. Enterprise-grade measurement framework with 5 dimensions: adoption, AI code share, complexity-adjusted velocity, code quality, ROI.

**Difference from SubBench:** DX measures organizational productivity ROI for teams (enterprise buyers). SubBench measures individual subscription value for developers (consumer buyers). DX asks "is our AI investment paying off?" — SubBench asks "which subscription should I buy?"

**Relevance:** MEDIUM — different audience and methodology, but validates the importance of cost-effectiveness measurement.  
**Confidence:** 5/5

---

### 5. Comparison Blog Posts (Multiple Sources)
**URLs:**
- https://lushbinary.com/blog/ai-coding-agents-comparison-cursor-windsurf-claude-copilot-kiro-2026/
- https://kanerika.com/blogs/github-copilot-vs-claude-code-vs-cursor-vs-windsurf/
- https://www.shareuhack.com/en/posts/cursor-vs-claude-code-vs-windsurf-2026
- https://dev.to/paulthedev/i-built-the-same-app-5-ways-cursor-vs-claude-code-vs-windsurf-vs-replit-agent-vs-github-copilot-50m2
- https://www.developersdigest.tech/blog/ai-coding-tools-pricing-2026
- https://cursor-alternatives.com/blog/ai-coding-tools-pricing/
- https://prommer.net/en/tech/guides/claude-code-vs-cursor-vs-windsurf/

**What they do:** Subjective comparison articles covering features, pricing tiers, and author opinions on which tool suits which workflow. Some include benchmark scores. The DEV.to post builds the same app 5 ways.

**How they measure value:** Qualitative — "best for terminal users," "best for IDE users," "best free tier." Some include pricing tables but none compute a value-per-dollar metric. The "built the same app 5 ways" approach is closest to practical value measurement but remains anecdotal.

**Difference from SubBench:** Entirely qualitative or feature-comparison-based. No systematic, reproducible measurement of subscription capacity or cost-effectiveness. No formulas, no benchmarks against subscription limits.

**Relevance:** LOW-MEDIUM — validates market demand for comparisons but shows the gap SubBench fills.  
**Confidence:** 4/5

---

### 6. GitHub Projects

#### a) ai-agent-benchmark (murataslan1)
**URL:** https://github.com/murataslan1/ai-agent-benchmark

**What it does:** Compares 80+ AI coding agents with SWE-Bench scores and pricing from 140+ sources.

**How it measures value:** Aggregates existing benchmark scores and pricing. Curated reference, not original measurement.

**Difference from SubBench:** Static reference document, not a measurement tool. No subscription capacity testing.

**Relevance:** LOW — reference only.  
**Confidence:** 3/5

#### b) ai-coding-deals (codertesla)
**URL:** https://github.com/codertesla/ai-coding-deals

**What it does:** Money-saving guide to AI coding tools: free tiers, discounts, referral credits, open-source alternatives.

**Difference from SubBench:** Deal aggregation, not value measurement.

**Relevance:** LOW  
**Confidence:** 4/5

#### c) AI-Coding-Landscape (joylarkin)
**URL:** https://github.com/joylarkin/AI-Coding-Landscape

**What it does:** Comprehensive landscape map of AI coding models, agents, CLIs, IDEs, builders, and benchmarks.

**Difference from SubBench:** Taxonomy/landscape map, not a measurement tool.

**Relevance:** LOW  
**Confidence:** 3/5

#### d) llm-coding-benchmark (akitaonrails)
**URL:** https://github.com/akitaonrails/llm-coding-benchmark

**What it does:** Benchmarks autonomous coding runs against a fixed Rails app brief. Compares local and cloud models.

**Difference from SubBench:** Tests model coding ability, not subscription value.

**Relevance:** LOW-MEDIUM  
**Confidence:** 3/5

---

### 7. Stack Overflow Developer Survey Data (2025-2026)
**URL:** https://survey.stackoverflow.co/2025/ai  
**URL:** https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/

**What it does:** Tracks AI tool adoption (84%), daily usage (51%), satisfaction (Claude Code +58 NPS), and trust (only 29% trust AI, down from 40%).

**How it measures value:** NPS scores, tool preference shares (Claude Code 28%, Cursor 24% as primary tools). Not cost-related.

**Difference from SubBench:** Measures sentiment and adoption, not cost-effectiveness.

**Relevance:** MEDIUM — provides market context and validates demand, but no overlap on methodology.  
**Confidence:** 5/5

---

### 8. Enterprise ROI Tools (SitePoint, Amux, Exceeds.ai)
**URLs:**
- https://www.sitepoint.com/ai-coding-tools-cost-analysis-roi-calculator-2026/
- https://amux.io/guides/measuring-ai-coding-agent-roi/
- https://blog.exceeds.ai/ai-coding-tool-performance-benchmarks/

**What they do:** ROI calculators and frameworks for engineering leaders evaluating AI tool investments. Focus on team-level metrics: PR throughput, cycle time, rework rate.

**How they measure value:** Hours saved x developer cost = ROI. Healthy ROI range: 2.5-3.5x average, 4-6x top quartile.

**Difference from SubBench:** Enterprise team productivity focus. SubBench targets individual developers comparing subscriptions.

**Relevance:** LOW-MEDIUM  
**Confidence:** 4/5

---

### 9. Token Calculator & Cost Estimation Tools
**URLs:**
- https://tokencalculator.ai/
- https://www.finout.io/blog/claude-code-pricing-2026

**What they do:** Estimate token spend for various models, help compare API costs.

**Difference from SubBench:** Token-level cost estimation, not subscription value measurement.

**Relevance:** LOW  
**Confidence:** 4/5

---

## Key Insight

**Nobody measures subscription capacity empirically.** The entire landscape falls into three buckets:

1. **Model benchmarks** (SWE-bench, Terminal-Bench, Artificial Analysis) — measure what a model CAN do but ignore subscription economics
2. **Pricing comparisons** (AI Pricing Guru, blog posts) — track what subscriptions COST but never measure what you GET
3. **Enterprise ROI tools** (DX, Amux) — measure team productivity gains but target organizations, not individual subscription buyers

SubBench's unique angle: **empirically measuring how many benchmark tasks a subscription can complete within its rate limits, then dividing by cost.** This "observed subscription capacity / cost per successful task" formula has no direct competitor. Morph's cost-per-task on API pricing is the closest analog, but it operates at the API layer — it doesn't test what a $20/month Pro subscription actually delivers in practice.

The gap is clear and significant. Developers spend $20-200/month on AI coding subscriptions but have no empirical data on which subscription delivers the most successful work per dollar. They rely on vibes, blog posts, and feature tables.

---

## Source List

| URL | Title | Type | Quality |
|-----|-------|------|---------|
| https://www.morphllm.com/best-ai-model-for-coding | Best AI Model for Coding — Cost per Task | Leaderboard | 5 |
| https://www.morphllm.com/best-ai-coding-agents-2026 | Best AI Coding Agents 2026 Leaderboard | Leaderboard | 5 |
| https://www.morphllm.com/ai-coding-costs | AI Coding Costs 2026: Real Monthly Spend | Analysis | 5 |
| https://artificialanalysis.ai/agents/coding-agents | AI Coding Agent Benchmarks & Leaderboard | Benchmark | 5 |
| https://www.aipricing.guru/subscriptions/ | AI Subscription Pricing Compared | Pricing tool | 4 |
| https://www.aipricing.guru/calculators/subscription-vs-api/ | Subscription vs API Cost Calculator | Calculator | 4 |
| https://getdx.com/blog/ai-coding-assistant-pricing/ | AI Coding Assistant Pricing & ROI Guide | Enterprise guide | 5 |
| https://getdx.com/blog/ai-roi-calculator/ | AI Coding Tools ROI Calculator | Enterprise tool | 4 |
| https://survey.stackoverflow.co/2025/ai | Stack Overflow 2025 Developer Survey — AI | Survey data | 5 |
| https://lushbinary.com/blog/ai-coding-agents-comparison-cursor-windsurf-claude-copilot-kiro-2026/ | AI Coding Agents 2026 Comparison | Blog post | 3 |
| https://kanerika.com/blogs/github-copilot-vs-claude-code-vs-cursor-vs-windsurf/ | GitHub Copilot vs Claude Code vs Cursor vs Windsurf | Blog post | 3 |
| https://www.shareuhack.com/en/posts/cursor-vs-claude-code-vs-windsurf-2026 | Cursor vs Claude Code vs Windsurf 2026 | Blog post | 4 |
| https://dev.to/paulthedev/i-built-the-same-app-5-ways-cursor-vs-claude-code-vs-windsurf-vs-replit-agent-vs-github-copilot-50m2 | I Built the Same App 5 Ways | Blog post | 4 |
| https://www.developersdigest.tech/blog/ai-coding-tools-pricing-2026 | AI Coding Tools Pricing 2026 | Pricing comparison | 3 |
| https://cursor-alternatives.com/blog/ai-coding-tools-pricing/ | AI Coding Tools Pricing Comparison 2026 | Pricing comparison | 3 |
| https://prommer.net/en/tech/guides/claude-code-vs-cursor-vs-windsurf/ | Claude Code vs Cursor vs Windsurf: CTO's Verdict | Blog post | 4 |
| https://github.com/murataslan1/ai-agent-benchmark | AI Agent Benchmark (80+ agents) | GitHub repo | 3 |
| https://github.com/codertesla/ai-coding-deals | AI Coding Deals | GitHub repo | 2 |
| https://github.com/joylarkin/AI-Coding-Landscape | AI Coding Landscape | GitHub repo | 2 |
| https://github.com/akitaonrails/llm-coding-benchmark | LLM Coding Benchmark | GitHub repo | 3 |
| https://www.sitepoint.com/ai-coding-tools-cost-analysis-roi-calculator-2026/ | AI Coding Tools ROI Calculator | Enterprise tool | 3 |
| https://amux.io/guides/measuring-ai-coding-agent-roi/ | Measuring AI Coding Agent ROI | Enterprise guide | 3 |
| https://blog.exceeds.ai/ai-coding-tool-performance-benchmarks/ | AI Coding Performance Benchmarks | Analysis | 3 |
| https://aizolo.com/blog/ai-subscription-price-comparison-table/ | AI Subscription Price Comparison Table 2026 | Pricing | 3 |
| https://openclawlaunch.com/guides/ai-coding-plans-compared | AI Coding Plans Compared | Guide | 3 |
| https://tokencalculator.ai/ | AI Token Calculator | Calculator | 3 |
| https://www.finout.io/blog/claude-code-pricing-2026 | Claude Code Pricing 2026 | Pricing guide | 3 |
