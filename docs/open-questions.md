# Open questions

Unknowns that affect how SubBench measures and reports value. This is the durable,
narrative home for open questions; [methodology.md](methodology.md) lists the terse V1
subset inline where they bear on the formula. Update both together when one changes.

## Operating stance: black box first, curiosity second

SubBench's stance is **value-first and black-box**. We measure what a user actually
experiences — successful developer work per window-dollar — without requiring any theory
of how a provider's meter works internally. A user comparing two offers does not need to
know whether a plan is metered in tokens, dollars, or credits; they need to know which
one buys more successful work for their money.

So understanding a provider's internal subscription structure is an **explicit non-goal
for V1**. It is not a prerequisite for the comparison, and we will not block or gate a
measurement on it.

We remain genuinely **curious** about it, for two reasons: (1) if the structure turns out
to be simple and stable, the whole measurement collapses to a single conversion factor
per plan (see [why-calibration.md](why-calibration.md)); and (2) knowing the mechanism
makes the published numbers more trustworthy and more robust to silent provider changes.
Curiosity, not commitment — nothing below is a V1 deliverable unless it also appears in
methodology.md.

## The structure question (why it is hard, and why we can dodge it)

Providers can denominate a subscription however they like, and the choice is theirs to
change:

- by **tokens** (input/output, possibly with cache reads priced differently);
- by **API-dollar value** (a spend-equivalent budget);
- by **per-message or per-request credits** independent of token count;
- **dynamically** — throttling that tightens under load, or weekly/session caps layered
  on top of any of the above;
- **differently across providers**, and differently across plans from the same provider.

There is no reason to expect a single shared model across vendors, and no reason to
expect a given vendor's model to stay fixed (see *Nonstationarity* in
[methodology.md](methodology.md)).

The black-box stance lets us sidestep all of this for the comparison itself: we observe
drain per API-equivalent-dollar directly, whatever the underlying denomination. The
structure only becomes something we *must* model if the observed conversion factor turns
out to be **unstable across workload shapes** — which is itself one of the open questions
below.

## V1 open questions (bear directly on the formula)

These are mirrored tersely in methodology.md → *V1 Open Questions*.

- **Cost-distribution coverage.** Which calibration tasks best represent the published
  benchmark's cost distribution? Drain is heavy-tailed; a 5–10 task sample must not be
  all-cheap, or the conversion factor is wrong for real usage.
- **Usage-delta reliability.** Which provider surfaces expose reliable usage deltas
  (exact vs rounded)? A meter that only reports rounded numbers bounds the precision of
  every downstream figure.
- **Cache pricing / factor stability.** Does each provider's quota meter price cache reads
  the same way its API does? If yes, drain is linear in API-equivalent cost and one
  conversion factor suffices. If the meter weights cache tokens differently (raw token
  counts, per-message credits), the factor depends on the workload's cache ratio.
  Test: compare drain-per-API-dollar between one cache-heavy and one cache-light task per
  plan. **This is the pivot question** — a "yes" makes the reductionist token model
  correct; a "no" is the only thing that forces us to model structure at all.
- **Economics source coverage.** Does FrontierCode publish per-task cost/token data
  anywhere (API, dataset release)? Determines whether a second, code-quality-graded
  economics source is available.
- **Normalization window.** ~~Should the first public score use weekly or monthly
  normalization?~~ **Resolved 2026-07-12: weekly.** All three confirmed providers run a
  7-day weekly quota window (Claude Max, OpenAI Plus/Codex, Z.ai); the window is the
  canonical unit and price is prorated into it (`window_price = price × 7/30`). Weekly
  is the meter providers enforce and keeps SVI cross-comparable; monthly would invent a
  reset convention none of them exposes. See methodology → V1 Open Questions and
  log 2026-07-12.

## Curiosity questions (structure discovery — non-goal for V1)

Investigate only if the pivot question above comes back "no," i.e. the black-box factor
proves unstable. Named here so the curiosity is on the record with a clear trigger.

- **Denomination.** For a given plan, is the meter closest to token-based, dollar-based,
  or credit-based? Can it be inferred from drain behavior across deliberately varied
  workloads without any provider disclosure?
- **Dynamic behavior.** Does effective capacity change with time of day, load, or account
  age? Weekly/session caps vs a single pooled budget?
- **Cross-provider mapping.** Is there any common unit into which different providers'
  meters can be honestly translated for a like-for-like comparison, or is per-plan
  observed drain the only defensible common ground?
- **Change detection.** How would we notice a provider silently re-denominating or
  tightening a meter? (Relates to the V2 community usage-report database in
  methodology.md → *V2 Directions*.)

## How this connects to the report

- The black-box measurement (SVI: native tasks per window per window-dollar) is always
  produced and never depends on answering any structure question.
- The API comparison and break-even numbers depend only on the imported economics; when
  no compatible published economics exist, they are omitted and the measurement records
  an `economics_gap`.
- Nothing in the "curiosity questions" list is required to publish a V1 score. If we ever
  do answer them, they either simplify the model (single factor) or harden it against
  silent provider changes — never a blocker.
