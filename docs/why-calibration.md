# Why calibration? (Why not just use tokens?)

This is the first objection anyone raises about SubBench, so it is worth answering
plainly.

## The objection

> A model's cost is just tokens, and every effort level is just more tokens at a known
> price per token. External benchmarks already publish token cost and API-dollar cost per
> model. A subscription is just some bucket of tokens. So the whole thing is arithmetic —
> imported cost × bucket size. Why run any tasks against a real subscription at all? And
> does it even matter *which* tasks we run?

Half of this is correct, and SubBench already does the correct half. The other half
assumes away exactly the thing that is unknown.

## What is already arithmetic (we agree, and we import it)

SubBench does **not** re-run tasks to discover their cost. Per-model, per-task token and
API-dollar cost is imported from a published benchmark (DeepSWE), where every model runs
on the same harness so the numbers are comparable. See
[methodology.md](methodology.md) → *Task Cost Sources*.

So the objection is right that:

- token/dollar cost per model is a lookup, not a measurement;
- "more effort" is, on the API side, just more tokens at a known unit price.

The entire **API side** of the comparison is arithmetic on published numbers. No task is
run to produce it.

## What is *not* arithmetic — the three things a token model assumes away

Write the naive claim as an equation:

```text
subscription value = tokens_included × price_per_token
```

Three of those terms cannot be filled in from published data. Each is why a real run
against a real subscription is required.

### 1. A subscription is not denominated in tokens

A Claude Max / Cursor / Copilot plan does not grant "X tokens of model Y." It grants
access to an **opaque quota meter** — some mix of weekly/session limits, dynamic
throttling, and possibly per-message credits. There is no published `tokens_included`
number, and there may be no fixed one at all.

The open question this raises: does the provider's meter price a **cached** token the
same way the API does? If yes, drain is linear in API-equivalent cost and a single
conversion factor per plan is enough — and the reductionist model becomes basically
correct. If the meter weights cache reads differently, or charges per message, then the
effective capacity depends on the **shape** of the workload, and there is no
workload-independent "tokens per subscription" to import. This is an empirical question.
Calibration runs answer it by comparing drain-per-API-dollar on a cache-heavy vs a
cache-light task. See [open-questions.md](open-questions.md).

### 2. The subscription ships a harness, not a raw model

The plan is a product: system prompt, agent scaffolding, caching policy, retries. The
same task costs different tokens through Cursor's harness than through the raw API, on
the identical model. The imported cost was measured on a *different* harness
(mini-swe-agent). Tokens-per-task is a property of `(model × harness × task)`, not of the
model alone. SubBench records this as the harness-mismatch disclaimer rather than
pretending it away.

### 3. Success is not free, and tokens spent failing have zero value

The unit of value is successful developer work, not tokens burned:

```text
api cost per success = avg cost per task / pass@1
```

A run that fails still drains the meter and produces nothing. Token accounting alone
cannot get you value-per-dollar; you need the success rate too.

## Does it matter which tasks we run? Mostly no — with one exception

This is the sharpest version of the objection, and it is *almost* right.

Calibration tasks are **not** there to measure task cost (that is imported). They exist
only to measure the **conversion factor** between "one API-dollar of work" and "how much
this subscription's meter drains." For that, the *content* of the task is irrelevant.

The one thing that does matter is the **cost distribution**. Drain is heavy-tailed. A
sample of five cheap tasks yields a conversion factor that is wrong for real usage, which
contains occasional expensive tasks. So:

- task **content / identity** — irrelevant;
- task **cost spread** (and cache-ratio spread) — the only thing that matters.

Pick tasks to span the published cost distribution, not to be representative of any
particular kind of coding.

## Bottom line

| Claim | Verdict |
| --- | --- |
| Import token/dollar cost per model; don't re-run | Correct — this is the design |
| Effort is just more tokens at a known unit price | Correct, on the API side |
| A subscription is a fixed token bucket → pure arithmetic | Wrong — the meter is opaque and possibly non-linear in cache/message shape |
| Task choice is irrelevant | Right in content; wrong in cost-distribution coverage |

The irreducible measurement is: **how fast does a real subscription's meter drain per
API-equivalent-dollar, and is that factor stable across workload shapes?** If someone
shows it is stable, the reductionist model becomes correct and calibration collapses to
one conversion factor per plan. Until then, it cannot be assumed. The tracked version of
this and related unknowns lives in [open-questions.md](open-questions.md).
