# Goal

Subbench exists to measure the real developer value of AI coding subscriptions.

The project's central question is:

> Which subscription gives more successful developer work per dollar, under a defined benchmark workload and measurement window?

The intended output is not a universal provider ranking. A defensible Subbench result should be scoped:

```text
For this task mix, on these subscription plans, during this measurement window,
plan A delivered more successful benchmark-equivalent coding work per dollar than plan B.
```

## Problem

AI coding subscriptions are hard to compare because they combine several opaque factors:

- model quality
- agent harness quality
- context handling
- prompt caching
- hidden or dynamic quota systems
- weekly/session limits
- product-specific throttling
- subscription price

Most public comparisons collapse these into subjective impressions. Subbench separates them into measurable components.

## What Subbench Measures

Subbench should measure:

- successful task completion
- cost per successful task
- observed subscription capacity
- quota drain per benchmark-equivalent task
- throttling or limit events
- task yield per billing period
- task yield per subscription dollar
- confidence level of each quota estimate

## Primary Metric

The primary metric is the Subscription Value Index.

```text
SVI =
  estimated successful benchmark-equivalent tasks per billing period
  / subscription price
```

Higher is better.

## Secondary Metrics

- success rate
- API-equivalent value multiple
- observed usable capacity per week or month
- average task cost
- median task time
- failure rate
- retry burden
- limit interruption rate
- confidence level

## Interpretation

Subbench should help answer practical decisions:

- Which plan should a developer keep?
- Which plan is best for high-volume routine coding?
- Which plan is best for harder tasks despite lower volume?
- Which plans are good only when used for specific task types?
- When does API usage beat subscription usage?
