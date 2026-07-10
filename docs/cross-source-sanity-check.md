# Cross-source economics sanity check

Status: **completed gate assessment — all API multiples are blocked.**

## DeepSWE v1.1 lock `d1b62712ca9e6ac790f857abcc6e4ea230d2ae0bddb9d9e87f74d881c9b287a4`

Source artifacts were retrieved 2026-07-10T08:52:36Z. The locked rows are
mini-swe-agent: GPT-5.5/xhigh (pass@1 0.6704; $7.2262/attempt), Claude Opus
4.8/max (0.5897; $13.2226), and GLM-5.2/max (0.4378; $3.9199).

On 2026-07-10, the candidate independent sources were checked:

- [Aider's polyglot leaderboard](https://aider.chat/docs/leaderboards/) reports a
  different task set and harness; its published GPT-5 row is not GPT-5.5/xhigh and
  has no compatible Claude Opus 4.8/max or GLM-5.2/max row.
- [MorphLLM's SWE-bench Pro summary](https://www.morphllm.com/swe-bench-pro)
  explicitly says the three locked models lack standardized public-set entries; it
  therefore cannot supply a like-for-like pass or per-attempt cost comparison.
- No dated, attributable Ivern AI capture with all of the locked model,
  effort/configuration, harness, pass@1, and cost fields was available.

None is comparable to the locked DeepSWE rows. This is not evidence of agreement or
disagreement: it is a documented data-availability failure. Every fresh study carries an
explicit `economics_gap` that suppresses the secondary benchmark-equivalent metric and
API multiple until a compatible, archived cross-source capture is attached.

For each immutable DeepSWE economics lock that would produce an API multiple, record the
lock SHA-256, retrieval date, model/version/effort/configuration, harness, pass@1, and
cost-per-attempt here. Compare only like-for-like rows against dated source captures from
the Aider leaderboard, MorphLLM, and Ivern AI. State the source URL, capture hash, and
whether a divergence is explained by the task set, harness, effort/configuration, or price
assumptions. An unexplained material divergence blocks the API multiple and must be named
in the report caveats.

This is deliberately not populated from the current exploratory data: it has no locked
economics artifact and no publishable provider cell.
