# AI Coding Subscription Limits: Raw Research

Last updated: 2026-07-09

---

## Findings by Provider

### 1. Anthropic Claude (Claude Code, Claude.ai)

**Plans**: Pro ($20/mo), Max 5x ($100/mo), Max 20x ($200/mo)

**Known limits**:
- 5-hour rolling window + weekly (7-day) cap on active compute. Both enforced simultaneously.
- Usage shared across Claude Code, Claude.ai chat, and Cowork.
- Anthropic does NOT publish exact token numbers. Capacity is described as relative multipliers (5x, 20x vs Pro).
- May 6, 2026: 5-hour limits doubled for Pro/Max/Team/Enterprise. Peak-hour reductions removed.
- May 13, 2026: Weekly limits raised 50% (promotion through July 13, 2026).
- June 15, 2026: Non-interactive usage (Agent SDK, `claude -p`, GitHub Actions) gets separate monthly credit: $20 Pro, $100 Max 5x, $200 Max 20x.

**How limits are measured/discovered**:
- HTTP headers `anthropic-ratelimit-unified-*` on every API response contain utilization (0.0-1.0), status (allowed/exceeded/rate_limited), across three windows: 5h, 7d, 7d_sonnet.
- she-llac reverse-engineered exact denominators from unrounded SSE doubles (e.g., 0.16327272727272726) via Stern-Brocot tree.
- Key finding: Max 20x has 20x session limits but only ~2x weekly capacity vs Max 5x. Max 5x overdelivers (6x session, 8x+ weekly vs Pro).
- Warnings only appear at 70% utilization; Claude Code suppresses warnings below that as "potentially stale."
- Anthropic shortened server-side prompt cache from 1 hour to 5 minutes (discovered through logs).

**Tools**:
- claude-counter (she-llac): Browser extension showing token count, cache timer, usage bars from SSE data
- SessionWatcher: macOS menu bar app tracking Claude/Codex/Copilot/Cursor/Gemini usage ($6.99-$59)
- Claude-Code-Usage-Monitor (Maciek-roboblog): Real-time monitor with predictions
- ccusage: Reads local logs, estimates spend from token counts
- usage-monitor-for-claude (Windows tray app)

**Confidence**: HIGH. Best-documented limits thanks to reverse engineering work.

---

### 2. OpenAI ChatGPT / Codex

**Plans**: Plus ($20/mo), Pro $100 ($100/mo), Pro $200 ($200/mo), Team, Enterprise

**Known limits (ChatGPT)**:
- Plus: 160 messages with GPT-5.5 per 3 hours, 3,000 Thinking messages weekly, 80 uploads per 3 hours.
- Pro $100: 5x Plus quota, 50 Deep Research sessions/month.
- Pro $200: 20x Plus usage quota for GPT-5.5 Thinking, ~250 Deep Research runs/month.
- Rolling windows, not daily resets.
- After limit: chats switch to mini model version.

**Known limits (Codex)**:
- April 2, 2026: Moved from per-message to token-based credit pricing.
- Usage shared with other agentic features (ChatGPT for Excel, Workspace Agents).
- Limits vary by task complexity (small scripts vs large codebases).
- Plus/Pro/Team/Enterprise all have different quotas; exact numbers not consistently published.
- Plus and Pro users can add credits to continue usage.

**How limits are measured**:
- Usage page / limit banner in ChatGPT.
- Rolling window mechanics visible through message counting.
- Community testing of message counts before throttling.

**Confidence**: MEDIUM. Message-level limits are documented; token-level Codex budgets are opaque.

---

### 3. Cursor

**Plans**: Hobby ($0), Pro ($20/mo), Pro+ ($60/mo), Ultra ($200/mo), Teams ($40/user/mo)

**Known limits**:
- Pro includes $20/mo of model usage credits (replaced old 500-fast-requests model in June 2025).
- Pro+ includes $70/mo, Ultra includes $400/mo.
- Credits burn at direct API rates. Per-model approximate requests for $20: Gemini ~550, GPT 4.1 ~650, Claude Sonnet 4 ~225.
- MAX mode (expanded context) charges proportionally more — significantly fewer requests.
- Auto mode: unlimited on Pro (uses cost-efficient model selection).
- Tab completions: effectively unlimited on all paid plans.
- Rate limits (concurrency/throughput) are separate from credit limits; cause slow queuing during peak, not errors.
- June 1, 2026: Team pricing adjusted for spend predictability.

**How limits are measured**:
- Dollar-equivalent credits tied to actual API token costs.
- Usage dashboard in Cursor settings.
- Community reports: One team of 5 spent $4,600 in 6 weeks. HN commenter reported $350/week in overages.
- Heavy MAX-mode or multi-agent use exhausts plans much faster than headline suggests.

**Confidence**: HIGH. Credit-based system is transparent but real costs surprise users.

---

### 4. GitHub Copilot

**Plans**: Free, Pro ($10/mo), Pro+ ($39/mo), Business ($19/user/mo), Enterprise ($39/user/mo)

**Known limits**:
- Free: 2,000 completions + 50 chat requests/month.
- Pro: Unlimited completions + $10/mo in AI Credits.
- Pro+: Unlimited completions + $39/mo in AI Credits.
- June 1, 2026: All plans moved to usage-based billing with monthly AI Credit allotments.
- Session limits and weekly (7-day) limits based on token consumption * model multiplier.
- Opus-tier models consume 3x premium request allocation (making "unlimited" effectively 1/3 as generous).

**How limits are measured**:
- AI Credits system: usage = token consumption (input + output + cached) * model rate.
- Usage dashboard in GitHub settings.
- Session and weekly limits enforced.

**Confidence**: MEDIUM-HIGH. Credit system documented; exact session/weekly caps less clear.

---

### 5. Windsurf (formerly Codeium, now Devin Desktop)

**Plans**: Free, Pro ($20/mo), Max ($200/mo)

**Known limits**:
- March 19, 2026: Retired credit-based system, replaced with daily + weekly quotas.
- Usage is rate-limited, not balance-limited.
- Tab completions (inline autocomplete) are unlimited on all plans.
- When daily quota hit: overages billed at API pricing, or wait for next daily refresh.
- Free plan: limited quota; locked out of premium models after exhaustion (zero-cost models remain).
- Has changed core metering model 3 times in ~16 months: flat seats -> dual credits -> prompt-credits-only -> daily/weekly quotas.

**How limits are measured**:
- Daily and weekly quota dashboards.
- Community reports of hitting daily caps when front-loading heavy work.

**Confidence**: MEDIUM. Frequent pricing model changes make historical data unreliable.

---

### 6. JetBrains AI

**Plans**: AI Pro, AI Ultimate ($30/mo individual)

**Known limits**:
- August 25, 2025: New quota model — 1 AI Credit = USD 1.00.
- AI Ultimate: $30/mo gives $35 in AI Credits ($5 bonus).
- Monthly reset (changed from weekly on April 16, 2025).
- ~80% of users reportedly don't hit limits.
- Top-up credits available for purchase.
- Usage priced at LLM rates, reflecting model mix.

**How limits are measured**:
- AI Credits dashboard in JetBrains IDE.
- Dollar-equivalent billing visible to users.

**Confidence**: MEDIUM. Straightforward credit system but less community investigation.

---

### 7. Zed AI

**Plans**: Token-based billing

**Known limits**:
- No arbitrary prompt cap.
- Included monthly credits; overages at API list price + 10%.
- Charged at end of month or per additional $10, whichever comes first.
- User-configurable spending cap.

**Confidence**: LOW. Limited community investigation.

---

### 8. Z.ai GLM Coding (separate from Zed)

**Plans**: Lite ($18/mo), Pro ($72/mo), Max ($160/mo)

**Known limits**:
- Lite: ~80 prompts/5h, ~400 prompts/week, 100 MCP calls/month
- Pro: ~400 prompts/5h, ~2,000 prompts/week, 1,000 MCP calls/month
- Max: ~1,600 prompts/5h, ~8,000 prompts/week, 4,000 MCP calls/month
- Hard stop at cap (no auto-upgrade or overage billing).

**Confidence**: LOW. Single source, limited verification.

---

## Industry Trends (2025-2026)

1. **Flat-rate era ending**: Every major provider moved away from "unlimited" toward usage-based billing in 2025-2026.
2. **Convergence on token-based credits**: Cursor, Copilot, JetBrains, and Codex all adopted dollar-equivalent credit systems.
3. **Rolling windows, not daily resets**: Claude (5h), ChatGPT (3h), Z.ai (5h) all use rolling windows.
4. **Shared quotas across surfaces**: Claude shares limits between Code/chat/Cowork; Codex shares with other agentic features.
5. **Model multipliers**: Premium/Opus models consume 3-20x credits vs base models, making "unlimited" plans vary wildly by model choice.
6. **Opacity as strategy**: Anthropic deliberately avoids publishing exact token limits; others publish credit amounts but not token equivalents.
7. **Dynamic throttling**: Peak-hour reductions (Claude), concurrency limits (Cursor), and adaptive rate limiting becoming standard.

---

## Contradictions & Surprises

1. **Claude Max 20x value**: Despite costing 2x Max 5x, the 20x plan only delivers ~2x weekly capacity (not 4x). The 5x plan significantly overdelivers vs its multiplier name.
2. **Cursor "unlimited" Auto mode**: Marketed as unlimited but uses cost-efficient model routing — the "unlimited" applies only to the cheapest model selection, not to user-chosen premium models.
3. **Copilot "unlimited completions"**: Pro/Pro+ offer unlimited completions, but chat/edits consume AI Credits, and Opus-tier models consume 3x, making the effective limit highly model-dependent.
4. **Windsurf metering instability**: Three different billing models in 16 months makes any capacity measurement a moving target.
5. **Cache changes as hidden limit reductions**: Anthropic shortened prompt cache from 1h to 5min without announcement, effectively increasing per-request cost and reducing capacity.
6. **Warnings at 70%**: Claude Code only warns at 70% utilization, then users hit the wall. This 30% "blind zone" makes proactive management difficult.
7. **Real-world cost explosions**: Cursor users report 20-70x cost increases vs legacy pricing mental models. One team: $4,600/6 weeks for 5 people.

---

## Reverse Engineering Methodology Catalog

### Technique 1: SSE Header Extraction (Claude)
- Intercept `anthropic-ratelimit-unified-*` headers from API responses
- Extract unrounded utilization floats
- Apply Stern-Brocot tree to recover exact denominators
- Source: she-llac.com/claude-limits

### Technique 2: Proxy Logging (Claude Code)
- Go proxy between Claude Code and api.anthropic.com
- Forward requests unchanged, log response headers and token counts
- Track utilization across 5h, 7d, 7d_sonnet windows
- Source: claudecodecamp.com reverse engineering article

### Technique 3: Credit Burn Rate Measurement (Cursor, Copilot)
- Send calibrated requests of known token size
- Measure credit deduction per request
- Calculate effective $/token rate and compare to API pricing
- Community-derived approach

### Technique 4: Message Counting (ChatGPT)
- Count messages until throttling/model downgrade occurs
- Note timestamp of first message and throttle event
- Calculate rolling window size and message budget
- Simple but effective for message-capped plans

### Technique 5: Usage Dashboard Scraping (Multiple)
- Programmatic access to usage dashboards
- Track utilization percentage over time
- Correlate with known request volumes
- Tools: QuotaMeter, SessionWatcher, DevQuota

---

## Monitoring & Measurement Tools

| Tool | Providers | Platform | Type | Price |
|------|-----------|----------|------|-------|
| claude-counter | Claude.ai | Browser ext | SSE-based usage bars | Free/OSS |
| SessionWatcher | Claude/Codex/Copilot/Cursor/Gemini | macOS menu bar | Multi-provider tracker | $6.99-$59 |
| QuotaMeter | Cursor/Claude/Codex/Copilot/Gemini/APIs | Browser ext + menu bar | Multi-provider dashboard | Unknown |
| DevQuota | Multiple | Chrome ext | Usage & quota monitor | Unknown |
| Claude-Code-Usage-Monitor | Claude Code | CLI tool | Real-time + predictions | Free/OSS |
| ccusage | Claude Code | CLI tool | Local log analysis | Free/OSS |
| usage-monitor-for-claude | Claude | Windows tray | Tray app | Free/OSS |
| Claude Usage Tracker | Claude | macOS menu bar | Swift/SwiftUI native | Free/OSS |
| LiteLLM | 100+ LLM providers | Proxy server | Budget enforcement | Free/OSS |
| Bifrost | Multiple | AI Gateway | Rate limiting + quotas | Free/OSS |
| Langfuse | Multiple | Observability platform | Cost tracking + tracing | Free/OSS |

---

## Source List

| # | URL | Title | Type | Quality (1-5) |
|---|-----|-------|------|---------------|
| 1 | https://she-llac.com/claude-limits | Suspiciously precise floats, or how I got Claude's real limits | Technical blog | 5 |
| 2 | https://github.com/she-llac/claude-counter | claude-counter browser extension | GitHub repo | 5 |
| 3 | https://www.claudecodecamp.com/p/i-tried-to-reverse-engineer-claude-code-s-usage-limits | I Tried to Reverse Engineer Claude Code's Usage Limits | Technical blog | 5 |
| 4 | https://sessionwatcher.com/ | SessionWatcher - Track AI Coding Usage on macOS | Product page | 4 |
| 5 | https://sessionwatcher.com/guides/claude-code-vs-cursor-rate-limits | Claude Code vs Cursor Rate Limits - Full Comparison | Guide | 4 |
| 6 | https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan | Use Claude Code with your Pro or Max plan | Official docs | 5 |
| 7 | https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work | How do usage and length limits work? | Official docs | 5 |
| 8 | https://www.morphllm.com/claude-code-usage-limits | Claude Code Usage Limits (2026): 5-Hour Caps Doubled | News/guide | 4 |
| 9 | https://ccforeveryone.com/guides/claude-code-limits-and-pricing | Claude Code Usage Limits and Pricing (June 2026) | Guide | 4 |
| 10 | https://cursor.com/help/models-and-usage/usage-limits | Usage and limits - Cursor Docs | Official docs | 5 |
| 11 | https://cursor.com/docs/models-and-pricing | Models & Pricing - Cursor Docs | Official docs | 5 |
| 12 | https://forum.cursor.com/t/cursor-pro-auto-mode-unlimited-usage-no-longer-feels-unlimited/148050 | Cursor Pro Auto Mode "Unlimited" no longer feels unlimited | Community forum | 3 |
| 13 | https://forum.cursor.com/t/now-we-have-much-stricter-usage-limits/152209 | Now we have much stricter usage limits | Community forum | 3 |
| 14 | https://apidog.com/blog/cursor-rate-limit/ | What Cursor's Pro Plan "Unlimited-with-Rate-Limits" Means | Blog | 3 |
| 15 | https://docs.github.com/en/copilot/concepts/usage-limits | Usage limits for GitHub Copilot | Official docs | 5 |
| 16 | https://docs.github.com/en/copilot/concepts/billing/individual-plans | About individual GitHub Copilot plans and benefits | Official docs | 5 |
| 17 | https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/ | GitHub Copilot is moving to usage-based billing | Official blog | 5 |
| 18 | https://docs.windsurf.com/plugins/accounts/usage | Plans and Usage - Devin Docs | Official docs | 4 |
| 19 | https://windsurf.com/pricing | Plans and Pricing - Windsurf/Devin | Official pricing | 5 |
| 20 | https://www.verdent.ai/guides/windsurf-pricing-2026 | Windsurf Pricing 2026: Plans, Quotas & What Changed | Guide | 3 |
| 21 | https://thesolai.github.io/blog/2026/03/29/windsurf-pricing-lockout/ | Windsurf's Pricing Lockout: When Free Becomes $15/Month | Blog | 3 |
| 22 | https://blog.jetbrains.com/ai/2025/09/faq-new-ai-quota/ | FAQ: New AI Quotas - JetBrains Blog | Official blog | 5 |
| 23 | https://blog.jetbrains.com/ai/2025/08/a-simpler-more-transparent-model-for-ai-quotas/ | A Simpler, More Transparent Model for AI Quotas | Official blog | 5 |
| 24 | https://zed.dev/blog/pricing-change-llm-usage-is-now-token-based | Zed's Pricing Has Changed: LLM Usage Is Now Token-Based | Official blog | 5 |
| 25 | https://zed.dev/pricing | Zed Pricing | Official pricing | 5 |
| 26 | https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers | About ChatGPT Pro tiers | Official docs | 5 |
| 27 | https://help.openai.com/en/articles/20001106-codex-rate-card | Codex rate card | Official docs | 5 |
| 28 | https://community.openai.com/t/codex-rate-limits-discussion-thread/1378553 | Codex Rate Limits Discussion Thread | Community forum | 3 |
| 29 | https://github.com/openai/codex/issues/5182 | API Rate Limits Make Codex Unusable | GitHub issue | 3 |
| 30 | https://medium.com/activated-thinker/the-flat-rate-ai-coding-subscription-era-is-ending | The Flat-Rate AI Coding Subscription Era Is Ending | Medium article | 4 |
| 31 | https://spectrumailab.com/blog/ai-coding-tools-pricing-compared-2026 | AI Coding Tools Pricing 2026 Comparison | Blog | 3 |
| 32 | https://medium.com/@jimeng_57761/when-cursor-silently-raised-their-price-by-over-20 | When Cursor silently raised their price by over 20x | Medium article | 3 |
| 33 | https://www.cloudzero.com/blog/cursor-ai-pricing/ | Cursor AI Pricing In 2026 | Blog | 3 |
| 34 | https://www.quotameter.app/ | QuotaMeter - Track all your AI costs in one place | Product page | 3 |
| 35 | https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor | Claude-Code-Usage-Monitor | GitHub repo | 4 |
| 36 | https://customgpt.ai/chatgpt-plus-limits-2026/ | ChatGPT Plus Limits 2026: Every Cap | Blog | 3 |
| 37 | https://chatgpt.com/pricing/ | ChatGPT Plans Pricing | Official pricing | 5 |
| 38 | https://docs.z.ai/legal-agreement/subscription-terms | Z.AI Subscriptions and Payment | Official docs | 4 |
