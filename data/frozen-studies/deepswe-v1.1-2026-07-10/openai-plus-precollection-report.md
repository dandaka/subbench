# SubBench calibration report

> **Non-generalization warning:** this is a fixed calibration-set report, not a provider ranking and not an estimate of developer work generally. Primary metric: native successful tasks per quota window (SVI = native tasks per window-dollar), using all observed attempt drain. Benchmark-equivalent/API fields, where shown, are separate neutral-harness anchors; native harness outcomes may differ.

| provider | plan | model | grade | publishable | n | success_rate | success_ci | native_tasks_per_window | svi | svi_ci | api_value_multiple | break_even_tasks | task_manifest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Baseline and promotion measurements are reported separately. Rows marked `publishable = false` failed a publishability check and must not be published as results. Results are time-bound to the measurement window and should be treated as stale afterward.

API multiples require an explicit compatible economics binding. Cross-cell comparison also requires the same immutable task manifest, quota window, and promotion state; rows that fail that gate are not a ranking.
