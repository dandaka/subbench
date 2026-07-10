# DeepSWE v1.1 Tier A fixed calibration tasks

This is the complete, equal-weight Tier A target population. It is descriptive only for
these eight tasks, not all of DeepSWE or developer work generally. The immutable lock is
[`data/deepswe-v1.1.lock.json`](../data/deepswe-v1.1.lock.json), SHA-256
`d1b62712ca9e6ac790f857abcc6e4ea230d2ae0bddb9d9e87f74d881c9b287a4`.

Selection used the archived DeepSWE v1.1 artifacts retrieved 2026-07-10T08:52:36Z,
with GPT-5.5/xhigh and `mini_swe_agent_gpt_5_5_xhigh`; the selection output SHA-256 is
`31efcd3836890d51a741b4b88fd8aaa7ce70a007cf4ccdbc5f7c4db902511703`.

Order seed: `subbench-tier-a-2026-07-10`. After three normal tasks, abort a runaway at
three times median quota drain and retain the aborted attempt. Each task has one planned
attempt; all verifiers and images are pinned by the lock.

| slot | task ID | language | repository | pass | avg cost | steps | minutes |
|---|---|---|---|---:|---:|---:|---:|
| go@p10 | `dasel-html-document-format` | go | TomWright/dasel | 0.75 | $3.46 | 53.8 | 18.0 |
| go@p75 | `kgateway-consistent-hash-policy` | go | kgateway-dev/kgateway | 0.50 | $6.76 | 90.5 | 25.4 |
| python@p25 | `sqlite-utils-safe-import-checkpoints` | python | simonw/sqlite-utils | 0.75 | $4.64 | 62.5 | 18.8 |
| python@p90 | `mashumaro-flattened-dataclass-fields` | python | Fatal1ty/mashumaro | 0.75 | $9.01 | 107.8 | 34.3 |
| ts@p50 | `koota-deferred-mutation-buffer` | typescript | pmndrs/koota | 0.50 | $7.39 | 78.0 | 52.6 |
| ts@p97 | `effect-sse-httpapi-streaming` | typescript | Effect-TS/effect | 0.50 | $16.06 | 137.5 | 44.7 |
| js@p50 | `yjs-map-conflict-detection` | javascript | yjs/yjs | 0.75 | $5.24 | 61.3 | 20.8 |
| rust@p50 | `oxvg-structural-selector-preservation` | rust | noahbald/oxvg | 0.25 | $9.91 | 108.3 | 37.9 |

The statistics are neutral-harness mini-swe-agent values. Subscription runs use native
product harnesses, so the methodology's harness-mismatch disclaimer applies. Do not vendor
task instructions or solutions; the local upstream archive is intentionally untracked.
