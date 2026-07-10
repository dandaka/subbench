# Coding Agent Benchmarks & Leaderboards Research (July 2026)

Research date: 2026-07-09. Focus: benchmarks NOT already tracked by SubBench (SWE-bench, SWE-bench Pro, SWE-bench Verified, DeepSWE, Terminal-Bench, SWE Atlas, Artificial Analysis Coding Agent Index).

---

## Findings

### 1. LiveCodeBench
- **URL**: https://livecodebench.github.io/
- **What it measures**: Contamination-free competitive programming. Continuously harvests fresh problems from LeetCode, AtCoder, CodeForces. Tests code generation, self-repair, execution. v6 has 1,055 problems (May 2023 - Apr 2025).
- **Cost/token data**: No. Model-level only.
- **Differs from SWE-bench**: Competitive programming (algorithmic) vs. repo-level issue resolution. No agent scaffolding evaluated.
- **Last updated**: June 2026 (73 models evaluated).
- **Relevance to SubBench**: LOW. Model-level eval, not agent-level. But useful as a secondary signal for raw coding ability.
- **Confidence**: HIGH

### 2. Aider Leaderboard (Code Editing + Polyglot)
- **URL**: https://aider.chat/docs/leaderboards/
- **What it measures**: Two benchmarks: (a) code editing via Aider's diff format, (b) Polyglot - 225 Exercism exercises across C++, Go, Java, JS, Python, Rust. Two attempts per problem with test feedback.
- **Cost/token data**: YES. Reports cost per run (e.g., GPT-5 $29.08/run, DeepSeek V3.2 $1.30/run). Best score-per-dollar tracked.
- **Differs from SWE-bench**: Tests model ability to edit files and self-correct across languages, not repo-level issue resolution. Tool-specific (Aider harness).
- **Last updated**: July 2026 (22 models).
- **Relevance to SubBench**: HIGH. Has cost data, tests agentic editing, multi-language. Could inform cost-efficiency scoring.
- **Confidence**: HIGH

### 3. OmniCode
- **URL**: https://arxiv.org/abs/2602.02262
- **What it measures**: 1,794 tasks across Python, Java, C++ in 4 categories: bug fixing, test generation, code review fixing, style fixing. Manually validated tasks.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Much broader task categories (not just bug fixing). Multi-language. Tests code review response and test generation.
- **Last updated**: Accepted at ACL 2026 (Feb 2026 paper).
- **Relevance to SubBench**: MEDIUM. Broader task taxonomy is useful for understanding agent capabilities beyond bug-fixing.
- **Confidence**: HIGH

### 4. SWE-Lancer
- **URL**: https://arxiv.org/abs/2502.12115
- **What it measures**: 1,488 real Upwork freelance tasks from the Expensify repo, totaling $1M in real payouts. Tasks range from $50 bug fixes to $32K feature implementations. Full-stack (React Native, web, API, DB). Two task types: IC SWE (764 tasks, code patches) and SWE Manager (724 tasks, selecting best proposal).
- **Cost/token data**: YES, implicitly -- maps task completion to dollar value earned.
- **Differs from SWE-bench**: Maps to real economic value. Full-stack commercial app (not OSS Python). Includes non-coding "manager" decision tasks. Uses Playwright e2e tests.
- **Last updated**: ICML 2025 Oral. OpenAI benchmark.
- **Relevance to SubBench**: VERY HIGH. Directly maps AI performance to economic value. Perfect for "developer value" framing.
- **Confidence**: HIGH

### 5. RoadmapBench
- **URL**: https://arxiv.org/html/2605.15846v1
- **What it measures**: 115 real version-upgrade tasks across 17 repos and 5 languages. Tests long-horizon, multi-target software development. Best model (Opus 4.7) only resolves 39.1%.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Long-horizon (version upgrades vs. single issues). Multi-target. Much harder -- models that score 80%+ on SWE-bench Verified score <40% here.
- **Last updated**: May 2026.
- **Relevance to SubBench**: MEDIUM. Shows where agents really struggle. Good for calibrating expectations on complex tasks.
- **Confidence**: HIGH

### 6. Multi-SWE-bench
- **URL**: https://github.com/multi-swe-bench / https://arxiv.org/pdf/2504.02605
- **What it measures**: Multilingual SWE-bench covering 7 languages (Java, TypeScript, JavaScript, Go, Rust, C, C++). 1,632 instances curated by 68 expert annotators.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Extends beyond Python-only to 7 languages.
- **Last updated**: April 2025.
- **Relevance to SubBench**: MEDIUM. Useful for evaluating polyglot capabilities of subscriptions.
- **Confidence**: HIGH

### 7. FeatureBench
- **URL**: https://github.com/LiberCoders/FeatureBench / https://arxiv.org/abs/2602.10975
- **What it measures**: End-to-end feature development. 200 tasks from 24 repos. Test-driven: derives tasks by tracing from unit tests along dependency graphs. Claude 4.5 Opus scores only 11.0% (vs 74.4% on SWE-bench).
- **Cost/token data**: No.
- **Differs from SWE-bench**: Feature implementation vs. bug fixing. Much harder. Execution-based evaluation.
- **Last updated**: Feb 2026 (ICLR 2026).
- **Relevance to SubBench**: MEDIUM-HIGH. Feature development is closer to real developer work than bug fixing.
- **Confidence**: HIGH

### 8. LongCLI-Bench
- **URL**: https://arxiv.org/abs/2602.14337
- **What it measures**: 20 high-quality long-horizon CLI tasks. Averages 15,000+ LOC and 104 source files per task. Expert completion time >1000 minutes. Covers feature addition, bug fixing, refactoring.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Much longer horizon. CLI interaction focus. Very large codebases.
- **Last updated**: Feb 2026.
- **Relevance to SubBench**: LOW-MEDIUM. Very small task set (20). But interesting for long-horizon evaluation.
- **Confidence**: MEDIUM

### 9. SWE-bench Live
- **URL**: https://swe-bench-live.github.io/
- **What it measures**: Continuously updated pipeline that curates fresh, contamination-resistant tasks from real GitHub issues.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Live/rolling updates, contamination-resistant by design.
- **Last updated**: Ongoing.
- **Relevance to SubBench**: MEDIUM. Good for tracking progress over time without data contamination.
- **Confidence**: HIGH

### 10. SWE-Rebench
- **URL**: https://swe-rebench.com/
- **What it measures**: Continuously evolving, decontaminated benchmark for software engineering LLMs.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Focuses on decontamination and continuous evolution.
- **Last updated**: 2026 (tracked on BenchLM).
- **Relevance to SubBench**: MEDIUM. Decontamination angle is valuable.
- **Confidence**: MEDIUM

### 11. RE-Bench (METR)
- **URL**: https://metr.org/AI_R_D_Evaluation_Report.pdf
- **What it measures**: 7 open-ended ML research engineering tasks (e.g., fitting scaling laws, optimizing GPU kernels). Compares AI agents against 71 human expert attempts with 8-hour time budgets.
- **Cost/token data**: No direct cost data, but has time-budget comparisons.
- **Differs from SWE-bench**: R&D/research engineering vs. issue resolution. Open-ended tasks. Human expert baselines with time budgets.
- **Last updated**: Nov 2024 (initial), tracked through 2026.
- **Relevance to SubBench**: LOW. Focused on AI R&D automation, not general developer tasks. But interesting for frontier capability tracking.
- **Confidence**: HIGH

### 12. SEC-bench / SecCodeBench
- **URL**: https://github.com/alibaba/sec-code-bench
- **What it measures**: Security of LLM-generated code. 98 test cases across 5 languages (Java, C/C++, Python, Go, Node.js), covering 22 CWE types.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Security-focused. Tests whether agents produce vulnerable code.
- **Last updated**: 2025-2026.
- **Relevance to SubBench**: LOW-MEDIUM. Security is important but orthogonal to SubBench's value measurement.
- **Confidence**: MEDIUM

### 13. BigCodeBench
- **URL**: https://bigcode-bench.github.io/ (inferred)
- **What it measures**: Code generation with diverse function calls and complex instructions. 1,140 tasks testing realistic library integration.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Library-level function-call generation, not repo-level issue resolution. Multi-language.
- **Last updated**: 2025 (still cited in 2026 comparisons).
- **Relevance to SubBench**: LOW. Model-level eval, not agent-level.
- **Confidence**: MEDIUM

### 14. CursorBench (v3.1)
- **URL**: Internal to Cursor (no public leaderboard)
- **What it measures**: Real developer tasks including debugging and refactoring from authentic Cursor sessions. Tracks solution correctness, code quality, efficiency, interaction behavior.
- **Cost/token data**: Not public.
- **Differs from SWE-bench**: Uses real IDE sessions. Tests interaction patterns, not just patch correctness. Internal/proprietary.
- **Last updated**: 2026 (v3.1 tracked on BenchLM).
- **Relevance to SubBench**: HIGH conceptually (measures real developer workflows) but LOW practically (not public).
- **Confidence**: MEDIUM

### 15. EvoCodeBench
- **URL**: https://arxiv.org/pdf/2602.10171
- **What it measures**: Self-evolving LLM-driven coding systems. Evolving benchmark dynamically updated every ~6 months. Aligns with real-world repos. Domain-specific evaluations.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Evolving/anti-contamination by design. Domain-specific evaluation.
- **Last updated**: Feb 2026.
- **Relevance to SubBench**: LOW-MEDIUM. Anti-contamination approach is interesting.
- **Confidence**: MEDIUM

### 16. Commit-0
- **URL**: (academic, no dedicated site found)
- **What it measures**: Whether LLMs can reconstruct entire libraries from documentation and test suites, starting from the initial commit.
- **Cost/token data**: No.
- **Differs from SWE-bench**: Reconstruction from scratch vs. issue fixing. Tests understanding of design and architecture.
- **Last updated**: 2025.
- **Relevance to SubBench**: LOW. Very different task framing.
- **Confidence**: MEDIUM

### 17. WebGameBench
- **URL**: https://arxiv.org/pdf/2605.17637
- **What it measures**: Requirement-to-application evaluation for coding agents via browser-native games.
- **Cost/token data**: Unknown.
- **Differs from SWE-bench**: Full app generation from requirements, not issue fixing.
- **Last updated**: May 2026.
- **Relevance to SubBench**: LOW. Niche evaluation approach.
- **Confidence**: LOW

---

## Leaderboard Aggregators (not benchmarks themselves)

### 18. Kilo Code Leaderboard
- **URL**: https://kilo.ai/leaderboard
- **What it measures**: Live rankings based on real token usage by 3M+ developers. Updates every 5 minutes. Blends usage data with KiloBench (Terminal-Bench 2.0) scores. Filterable by mode: Code, Plan, Debug, Ask, Orchestrator.
- **Cost/token data**: YES -- based on real usage patterns.
- **Relevance to SubBench**: VERY HIGH. Real developer preference data + benchmark scores. Usage-weighted rankings.
- **Confidence**: HIGH

### 19. CodeSOTA
- **URL**: https://www.codesota.com/
- **What it measures**: Aggregator tracking 7 benchmarks across 130 models. Includes LiveCodeBench Pro (Elo-rated competitive programming from Codeforces/ICPC/IOI problems).
- **Cost/token data**: No.
- **Relevance to SubBench**: MEDIUM. Aggregation approach and LiveCodeBench Pro Elo system are interesting.
- **Confidence**: HIGH

### 20. BenchLM
- **URL**: https://benchlm.ai/coding
- **What it measures**: Aggregator indexing 228 models across 186 benchmarks. Daily auto-updated. Widest benchmark coverage of any platform.
- **Cost/token data**: Some pricing data alongside benchmarks.
- **Relevance to SubBench**: HIGH. Good data source for cross-benchmark comparisons.
- **Confidence**: HIGH

### 21. MorphLLM Leaderboard
- **URL**: https://www.morphllm.com/ai-coding-agent and https://www.morphllm.com/best-ai-model-for-coding
- **What it measures**: Ranks coding agents by Terminal-Bench score, price, and source (open/closed). Also ranks models by SWE-bench Pro score and cost per task.
- **Cost/token data**: YES. Reports per-million-token pricing alongside benchmark scores.
- **Relevance to SubBench**: HIGH. Combines benchmark performance with cost data. "Best AI Model for Coding" page ranks by SWE-bench Pro + cost per task.
- **Confidence**: HIGH

### 22. UnitCostAI
- **URL**: https://www.unitcostai.com/tools/coding-agent-cost-per-task
- **What it measures**: Calculator for cost per accepted coding-agent task. Factors in subscription spend, API tokens, acceptance rate, task-attempt overhead.
- **Cost/token data**: YES -- this is its entire purpose.
- **Relevance to SubBench**: HIGH. Complementary tool. Their methodology for cost-per-accepted-task is directly relevant.
- **Confidence**: MEDIUM

### 23. Ivern AI Agent Cost Benchmark
- **URL**: https://ivern.ai/blog/ai-agent-cost-benchmark-report-2026
- **What it measures**: 200 tasks benchmarked across Claude, GPT-4o, Gemini, Haiku. 50 tasks x 4 categories (research, writing, coding, analysis) x 4 runs each. Human-evaluated quality (3 evaluators, 4 dimensions).
- **Cost/token data**: YES. Exact token counts and cost per task ($0.02-$0.47 range).
- **Relevance to SubBench**: VERY HIGH. Methodology is closest to what SubBench is trying to do. Cost + quality + real tasks.
- **Confidence**: MEDIUM (blog post, not peer-reviewed)

---

## Contradictions & Surprises

1. **Benchmark gaming is real**: A 2026 Berkeley RDI study found that 8 major agent benchmarks (SWE-bench Verified, Terminal-Bench, WebArena, OSWorld, GAIA, FieldWorkArena) could be exploited to near-perfect scores without solving any tasks. This is a fundamental validity concern.

2. **Feature development is dramatically harder than bug fixing**: Claude 4.5 Opus scores 74.4% on SWE-bench but only 11.0% on FeatureBench. This suggests SWE-bench grossly overestimates real-world capability.

3. **Long-horizon tasks collapse performance**: RoadmapBench shows best models at ~39% vs 80%+ on SWE-bench Verified. The gap between benchmark and real-world is enormous for sustained work.

4. **Cost data is surprisingly scarce in academic benchmarks**: Almost none of the academic benchmarks (OmniCode, FeatureBench, RoadmapBench, etc.) report cost or token consumption. Only commercial/community leaderboards (Aider, Artificial Analysis, MorphLLM, Kilo) track cost.

5. **Real usage != benchmark ranking**: Kilo's usage-based leaderboard shows step-3.7-flash as most-used model, despite not leading any benchmark. Developers optimize for speed/cost, not just accuracy.

6. **CursorBench is private**: Despite being one of the most interesting benchmarks conceptually (real IDE sessions, interaction quality), it's internal to Cursor and not publicly accessible.

7. **The economic framing of SWE-Lancer is unique**: By mapping to real Upwork payouts ($50-$32K), it provides a concrete dollar-value-of-agent-capability metric that no other benchmark offers.

---

## Source List

| URL | Title | Type | Quality (1-5) |
|-----|-------|------|-------|
| https://livecodebench.github.io/ | LiveCodeBench | Benchmark | 5 |
| https://aider.chat/docs/leaderboards/ | Aider LLM Leaderboards | Benchmark+Leaderboard | 5 |
| https://arxiv.org/abs/2602.02262 | OmniCode | Paper | 4 |
| https://arxiv.org/abs/2502.12115 | SWE-Lancer | Paper (ICML 2025) | 5 |
| https://arxiv.org/html/2605.15846v1 | RoadmapBench | Paper | 4 |
| https://github.com/multi-swe-bench | Multi-SWE-bench | Benchmark | 4 |
| https://arxiv.org/abs/2602.10975 | FeatureBench | Paper (ICLR 2026) | 5 |
| https://arxiv.org/abs/2602.14337 | LongCLI-Bench | Paper | 3 |
| https://swe-bench-live.github.io/ | SWE-bench Live | Benchmark | 4 |
| https://swe-rebench.com/ | SWE-Rebench | Benchmark | 3 |
| https://metr.org/AI_R_D_Evaluation_Report.pdf | RE-Bench (METR) | Report | 5 |
| https://github.com/alibaba/sec-code-bench | SEC-bench | Benchmark | 3 |
| https://arxiv.org/pdf/2602.10171 | EvoCodeBench | Paper | 3 |
| https://arxiv.org/pdf/2605.17637 | WebGameBench | Paper | 2 |
| https://kilo.ai/leaderboard | Kilo Code Leaderboard | Live leaderboard | 4 |
| https://www.codesota.com/ | CodeSOTA | Aggregator | 4 |
| https://benchlm.ai/coding | BenchLM | Aggregator | 4 |
| https://www.morphllm.com/ai-coding-agent | MorphLLM Agent Leaderboard | Aggregator+Cost | 4 |
| https://www.morphllm.com/best-ai-model-for-coding | MorphLLM Model Rankings | Aggregator+Cost | 4 |
| https://www.unitcostai.com/tools/coding-agent-cost-per-task | UnitCostAI Calculator | Tool | 3 |
| https://ivern.ai/blog/ai-agent-cost-benchmark-report-2026 | Ivern AI Cost Benchmark | Blog/Report | 3 |
| https://artificialanalysis.ai/agents/coding-agents | Artificial Analysis | Leaderboard | 5 |
| https://arxiv.org/pdf/2606.17799 | "Coding Benchmarks Are Misaligned" position paper | Paper | 4 |
