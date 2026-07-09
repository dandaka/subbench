# AI Coding Task Economics: Research Inventory

Research compiled: 2026-07-09

---

## Findings

### 1. Gartner: AI Coding Costs Will Surpass Developer Salary by 2028

- **URL**: https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges
- **Author/Org**: Gartner (press release, June 24 2026)
- **Key findings**:
  - By 2028, per-developer AI coding costs will exceed the average developer salary
  - Nearly 25% of tech leaders already spend $200-$500/developer/month on AI coding tokens
  - ~6% report spending >$2,000/developer/month
  - Vendors lack transparency in token consumption billing
  - Developers optimize for speed, not cost -- governance must come from leadership
  - Recommends: use-case-driven model selection, context engineering mandates, token usage reviews in dev cycles
- **Data quality**: Industry analyst prediction (Gartner), based on client data. Not peer-reviewed but highly influential. Quality: 4/5
- **Relevance**: Directly validates SubBench's thesis that cost-per-task measurement matters

### 2. AgentDiet: Reducing Cost of LLM Agents with Trajectory Reduction

- **URL**: https://arxiv.org/abs/2509.23586
- **Author/Org**: Academic (arXiv, Sept 2025)
- **Key findings**:
  - Agent trajectories contain "useless, redundant, and expired information"
  - AgentDiet reduces input tokens by 39.9%-59.7% and total cost by 21.1%-35.9%
  - Cost per task drops from $0.535 to $0.422 (example config), $1.277 to $0.933 (another)
  - Iterative code review consumes 59.4% of tokens in coding tasks
  - Agentic coding consumes >1000x more tokens than single-turn reasoning
  - Input tokens dominate at ratios exceeding 150:1 (input:output)
- **Data quality**: Peer-reviewed academic paper with empirical results. Quality: 5/5
- **Relevance**: Critical -- provides measured cost-per-task data and explains WHY agent costs are high

### 3. Efficient Agents: Building Effective Agents While Reducing Cost

- **URL**: https://arxiv.org/abs/2508.02694
- **Author/Org**: Academic (arXiv, Aug 2025)
- **Key findings**:
  - First systematic study of efficiency-effectiveness trade-off in agent systems
  - Introduces "cost-of-pass" metric: cost incurred per successful task completion
  - Their framework achieves 96.7% of leading framework performance at 28.4% lower cost
  - Evaluated on GAIA benchmark across LLM backbone selection, framework designs, test-time scaling
  - Key question: "How much complexity do agentic tasks inherently require?"
- **Data quality**: Peer-reviewed with empirical benchmarks. Quality: 5/5
- **Relevance**: The "cost-of-pass" metric is directly analogous to SubBench's "successful work per dollar"

### 4. Token Economics for LLM Agents: A Dual-View Study

- **URL**: https://arxiv.org/abs/2605.09104
- **Author/Org**: Academic (arXiv, May 2026)
- **Key findings**:
  - First comprehensive survey treating tokens as economic primitives (production factors, exchange mediums, units of account)
  - Four-dimensional taxonomy: Micro (single agent budget optimization), Meso (multi-agent collaboration friction), Macro (ecosystem congestion/pricing), Security (adversarial costs)
  - Applies neoclassical firm theory to agent budget-constrained factor substitution
  - Uses transaction cost and principal-agent theories for multi-agent collaboration
- **Data quality**: Survey/framework paper, not empirical. Quality: 4/5
- **Relevance**: Provides theoretical economic framework for understanding agent cost structures

### 5. Don't Break the Cache: Prompt Caching for Agentic Tasks

- **URL**: https://arxiv.org/abs/2601.06007
- **Author/Org**: Lumer, Nizar, Jangiti, Frank, Gulati, Phadate, Subbiah (arXiv, Jan 2026)
- **Key findings**:
  - Evaluated 3 caching strategies across OpenAI, Anthropic, Google over 500+ agent sessions
  - Prompt caching reduced API costs by 41-80% and TTFT by 13-31%
  - Naively caching everything (including tool results) paradoxically INCREASED latency in some conditions
  - Best strategy: cache only system prompt (instructions, tool definitions, persona); keep conversation history and tool results dynamic
  - Anthropic caching: up to 90% cost reduction, 85% latency reduction for long prompts
  - OpenAI automatic caching: ~50% cost reduction
- **Data quality**: Empirical evaluation, 500+ sessions, multi-provider. Quality: 5/5
- **Relevance**: Essential for understanding how caching affects real cost-per-task measurements

### 6. LeanOps: AI Agents Burn 50x More Tokens Than Chats

- **URL**: https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/
- **Author/Org**: LeanOps (2026), audited 30 engineering teams March-May 2026
- **Key findings**:
  - Agents burn ~50x more tokens than single-turn chatbots on equivalent tasks
  - At 50 steps: multiplier exceeds 30x. At 200 steps (typical debug session): exceeds 100x
  - Quadratic cost growth from re-sending entire conversation history each tool call
  - By step 20 with file reads, each call can exceed 50K input tokens
  - At Claude Sonnet 4.6 $3/M input: one late-loop step costs $0.15, one full task costs $5+
  - 50 tasks/dev/day x 20 devs x 22 days = $110,000/month
  - Documented case: agent left running over weekend = $4,200 bill
- **Data quality**: Industry audit, 30 teams, measured production data. Quality: 4/5
- **Relevance**: Real-world cost data from production engineering teams

### 7. MorphLLM: AI Coding Costs Analysis

- **URL**: https://www.morphllm.com/ai-coding-costs
- **Author/Org**: MorphLLM (2026)
- **Key findings**:
  - Bug fix task: $0.54 (Sonnet 4.6), $0.90 (Opus 4.8), $1.80 (Fable 5)
  - Feature task (100 calls, 2M input, 40K output): $2.28, $3.80, $7.60
  - Anthropic published average: $13/dev/active day, $150-250/dev/month
  - Max 5x ($100) breaks even vs Opus 4.8 API at ~111 bug-fix tasks or 26 features/month
  - Microsoft Experiences+Devices hit ~$2,000/engineer/month on Claude Code
  - Heavy automation: $500-2,000/engineer/month
- **Data quality**: Industry analysis with token math, cross-referenced with vendor data. Quality: 4/5
- **Relevance**: Direct cost-per-task comparisons across models -- closest to SubBench methodology

### 8. EY: Agentic AI Enterprise Token Costs

- **URL**: https://www.ey.com/en_us/insights/ai/agentic-ai-token-costs
- **Author/Org**: EY (2026)
- **Key findings**:
  - Simple linear workflow (2023): $0.04/interaction
  - Orchestrated agentic system (2026): $1.20/interaction -- 30x increase
  - Blended cost of AI dropped 67% YoY ($18.40 to $6.07 per M tokens, Q1 2025 to Q1 2026)
  - BUT total spend growing faster than any budget model accounted for (Jevons paradox)
  - Token costs are only part of TCO: infrastructure, governance, change management, risk also matter
  - "Optimizing tokens without understanding TCO is like managing a factory by watching the electricity bill"
- **Data quality**: Big 4 consulting analysis, 2.4B enterprise API calls analyzed. Quality: 4/5
- **Relevance**: Enterprise-scale perspective on why per-token cost alone is insufficient

### 9. TechCrunch: The Token Bill Comes Due

- **URL**: https://techcrunch.com/2026/06/05/the-token-bill-comes-due-inside-the-industry-scramble-to-manage-ais-runaway-costs/
- **Author/Org**: TechCrunch (June 2026)
- **Key findings**:
  - Uber blew through entire 2026 AI coding budget by April
  - Microsoft revoked developers' Claude Code licenses after costs surged
  - Priceline Cursor renewal came back 4-5x more expensive
  - Companies 3x over entire 2026 token budget by April
  - One company reportedly hit a $500M Claude bill after forgetting usage limits
  - Nov 2025 model releases (Opus 4.5, GPT-5.1, Gemini 3 Pro) multiplied consumption
  - Industry pivot from "tokenmaxxing" to "we need guardrails"
- **Data quality**: Journalism with named sources. Anecdotal but credible. Quality: 3/5
- **Relevance**: Real-world evidence of cost crisis that SubBench aims to address

### 10. GitHub Copilot Productivity: Peng et al. (2023) + Follow-ups

- **URL**: https://arxiv.org/abs/2302.06590
- **Author/Org**: Peng, Kalliamvakou, Cihon, Demirer (GitHub/Microsoft, 2023)
- **Key findings**:
  - Developers complete tasks 55% faster with Copilot
  - 26.08% increase in weekly completed tasks
  - Teams reduce PR time from 9.6 days to 2.4 days (4x improvement)
  - 4.7M paid subscribers by Jan 2026 (up ~75% YoY)
  - Most enterprises report positive ROI within 3-6 months
- **Data quality**: Randomized controlled trial, peer-reviewed. Quality: 5/5
- **Relevance**: Baseline productivity data for calculating ROI per dollar spent

### 11. MIT/Demirer: Effects of Generative AI on High-Skilled Work

- **URL**: https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf
- **Author/Org**: Demirer et al. (MIT, 2024-2025)
- **Key findings**:
  - Enterprise-scale randomized trial of GitHub Copilot
  - AI can boost output: 40% for writing (Noy & Zhang 2023), 56% for coding, 14% for customer service
  - Measures actual developer output through version control (not self-report)
  - Less experienced developers benefit more from AI tools
- **Data quality**: Academic field experiment, peer-reviewed. Quality: 5/5
- **Relevance**: Gold-standard productivity measurement methodology

### 12. COALESCE: Economic Dynamics of Task Outsourcing Among LLM Agents

- **URL**: https://arxiv.org/abs/2506.01900
- **Author/Org**: Academic (arXiv, June 2025)
- **Key findings**:
  - Framework for autonomous LLM agents to dynamically outsource subtasks to specialized agents
  - 41.8% cost reduction potential in theoretical simulations
  - 20.3% cost reduction in real LLM task experiments
  - Applies economic outsourcing theory to multi-agent systems
- **Data quality**: Academic with simulations + real experiments. Quality: 4/5
- **Relevance**: Shows multi-agent architectures can significantly reduce per-task costs

### 13. GoodFirms: 91% of Software Companies Use AI to Cut Development Costs

- **URL**: https://finance.yahoo.com/news/goodfirms-survey-91-software-companies-133000343.html
- **Author/Org**: GoodFirms (March 2026), 100+ global software companies surveyed
- **Key findings**:
  - 90.6% of dev teams have adopted AI tools for coding, testing, documentation, project planning
  - 61% expect AI to reduce project budgets by 10-25%
  - 95.3% cite project complexity as top cost driver (not AI tool cost)
- **Data quality**: Industry survey, 100+ companies. Quality: 3/5
- **Relevance**: Developer-side perspective on perceived AI cost savings

### 14. Artificial Analysis: Coding Agent Benchmark with Cost Tracking

- **URL**: https://artificialanalysis.ai/agents/coding-agents
- **Author/Org**: Artificial Analysis (ongoing, 2025-2026)
- **Key findings**:
  - Tracks "cost-per-successful-task" = cost per task / success rate
  - Includes standard input pricing, cached-input pricing, cache-write charges, output pricing
  - "Cost of pass" metric: Claude Haiku 4.5 ~$0.13/point, GPT-5.4 $0.25, Gemini 3.1 Pro $0.26, Opus 4.6 $0.48
  - Distinguishes pay-per-token API cost from consumer plan pricing
  - Infrastructure, engineering, supervision costs excluded
- **Data quality**: Systematic benchmark, regularly updated. Quality: 4/5
- **Relevance**: Already known to SubBench but contains new "cost of pass" metric details

### 15. MorphLLM: Best AI Model for Coding (SWE-bench Pro + Cost)

- **URL**: https://www.morphllm.com/best-ai-model-for-coding
- **Author/Org**: MorphLLM (June 2026)
- **Key findings**:
  - 12 models ranked by SWE-bench Pro score AND cost per task
  - Cursor Composer 2.5: scored 62 on Coding Agent Index, cheapest agent above 60 at $0.07/task (standard), $0.44 (fast)
  - A model passing 70% at $2/task is a different production choice from one passing 65% at $0.40/task
  - SWE-bench Pro leader: Opus 4.8 at 69.2% (active)
- **Data quality**: Aggregated benchmark data with cost analysis. Quality: 4/5
- **Relevance**: Direct cost-per-task ranking across models and agents

### 16. Agent-Omit: Adaptive Context Omission for Efficient LLM Agents

- **URL**: https://arxiv.org/abs/2602.04284
- **Author/Org**: Academic (arXiv, Feb 2026)
- **Key findings**:
  - Adaptive context omission to reduce agent costs
  - Complements AgentDiet approach with different reduction strategy
- **Data quality**: Academic paper. Quality: 4/5
- **Relevance**: Alternative approach to reducing per-task token consumption

### 17. EET: Experience-Driven Early Termination for Cost-Efficient Software Engineering Agents

- **URL**: https://arxiv.org/abs/2601.05777
- **Author/Org**: Academic (arXiv, Jan 2026)
- **Key findings**:
  - Early termination strategy for coding agents that detects when continued iteration is unlikely to succeed
  - Reduces wasted tokens on tasks that would fail anyway
- **Data quality**: Academic paper. Quality: 4/5
- **Relevance**: Addresses the "wasted spend on failed tasks" dimension of cost-per-task

### 18. Budget-Aware Tool-Use Enables Effective Agent Scaling

- **URL**: https://arxiv.org/abs/2511.17006
- **Author/Org**: Academic (arXiv, Nov 2025)
- **Key findings**:
  - Budget-aware tool use for scaling agents under cost constraints
  - Agents can be trained to make cost-aware decisions about when to use expensive tools
- **Data quality**: Academic paper. Quality: 4/5
- **Relevance**: Shows agents can be designed with built-in cost awareness

### 19. Keyhole Software: AI Software Development Costs 2026

- **URL**: https://keyholesoftware.com/ai-software-development-cost-2026/
- **Author/Org**: Keyhole Software (2026)
- **Key findings**:
  - AI tool cost $200-600/month per engineer on average (enterprise)
  - 80%+ of AI projects fail to deliver intended business value
  - 60% of AI projects exceed cost estimates by 30-50%
  - Cost overruns at production scale average 380% over pilot budgets
  - 47% of IT leaders said AI projects were profitable in 2024
- **Data quality**: Industry analysis aggregating multiple surveys. Quality: 3/5
- **Relevance**: Enterprise ROI data showing gap between cost and value

---

## Contradictions & Surprises

1. **Jevons Paradox in action**: Per-token costs dropped 67% YoY (EY data), but total spend is growing faster than any budget model predicted. Cheaper tokens = more usage = higher total cost. This directly challenges the narrative that "AI is getting cheaper."

2. **Caching is not straightforward**: "Don't Break the Cache" found that naive full-context caching can INCREASE latency despite reducing cost. The optimal strategy (cache system prompt only) contradicts the intuition to cache everything.

3. **Productivity gains vs cost reality**: GitHub Copilot studies show 55% speed improvement, but enterprise data shows 80%+ of AI projects fail to deliver value. The productivity is real but the economics don't always work out.

4. **Agentic vs chat cost multiplier varies wildly**: LeanOps says 50x, EY says 30x, AgentDiet paper implies the multiplier depends heavily on task complexity and loop depth. No consensus on the actual multiplier.

5. **Subscription vs API pricing disconnect**: $20/month subscriptions vs $200-2,000/month actual API costs for the same tools (Claude Code). The subscription model hides true costs, making benchmarking harder.

6. **Input tokens dominate**: AgentDiet found input:output ratios exceeding 150:1. This means output token pricing (which gets the most attention) is nearly irrelevant for agent economics. Input pricing and caching are what matter.

7. **Cost-of-pass vs raw pass rate**: A model with lower benchmark scores can be the better production choice if its cost-per-successful-task is lower. This aligns perfectly with SubBench's methodology but contradicts how most people evaluate models (raw score only).

8. **The $500M bill**: TechCrunch reported a company hitting $500M in Claude charges from forgetting usage limits. Even if exaggerated, it shows the unbounded nature of consumption-based pricing is a systemic risk.

---

## Source List

| # | URL | Title | Type | Quality |
|---|-----|-------|------|---------|
| 1 | https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges | Gartner: AI Coding Costs Will Surpass Developer Salary by 2028 | Industry analyst | 4/5 |
| 2 | https://arxiv.org/abs/2509.23586 | AgentDiet: Reducing Cost of LLM Agents with Trajectory Reduction | Academic paper | 5/5 |
| 3 | https://arxiv.org/abs/2508.02694 | Efficient Agents: Building Effective Agents While Reducing Cost | Academic paper | 5/5 |
| 4 | https://arxiv.org/abs/2605.09104 | Token Economics for LLM Agents: A Dual-View Study | Academic survey | 4/5 |
| 5 | https://arxiv.org/abs/2601.06007 | Don't Break the Cache: Prompt Caching for Agentic Tasks | Academic paper | 5/5 |
| 6 | https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/ | LeanOps: AI Agents Burn 50x More Tokens Than Chats | Industry audit | 4/5 |
| 7 | https://www.morphllm.com/ai-coding-costs | MorphLLM: AI Coding Costs (2026) | Industry analysis | 4/5 |
| 8 | https://www.ey.com/en_us/insights/ai/agentic-ai-token-costs | EY: Agentic AI Enterprise Token Costs | Consulting analysis | 4/5 |
| 9 | https://techcrunch.com/2026/06/05/the-token-bill-comes-due-inside-the-industry-scramble-to-manage-ais-runaway-costs/ | TechCrunch: The Token Bill Comes Due | Journalism | 3/5 |
| 10 | https://arxiv.org/abs/2302.06590 | GitHub Copilot Productivity: Peng et al. | Academic (RCT) | 5/5 |
| 11 | https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf | MIT: Effects of GenAI on High-Skilled Work | Academic field experiment | 5/5 |
| 12 | https://arxiv.org/abs/2506.01900 | COALESCE: Task Outsourcing Among LLM Agents | Academic paper | 4/5 |
| 13 | https://finance.yahoo.com/news/goodfirms-survey-91-software-companies-133000343.html | GoodFirms: 91% Use AI to Cut Dev Costs | Industry survey | 3/5 |
| 14 | https://artificialanalysis.ai/agents/coding-agents | Artificial Analysis: Coding Agent Benchmark | Benchmark | 4/5 |
| 15 | https://www.morphllm.com/best-ai-model-for-coding | MorphLLM: Best AI Model for Coding (Ranked) | Industry analysis | 4/5 |
| 16 | https://arxiv.org/abs/2602.04284 | Agent-Omit: Adaptive Context Omission | Academic paper | 4/5 |
| 17 | https://arxiv.org/abs/2601.05777 | EET: Early Termination for SE Agents | Academic paper | 4/5 |
| 18 | https://arxiv.org/abs/2511.17006 | Budget-Aware Tool-Use for Agent Scaling | Academic paper | 4/5 |
| 19 | https://keyholesoftware.com/ai-software-development-cost-2026/ | Keyhole: AI Software Dev Costs 2026 | Industry analysis | 3/5 |
