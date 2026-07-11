# Project log

This log records durable changes and decisions that affect future work. It is not a
measurement run log and does not establish publication evidence.

## 2026-07-11 — Fix prepare() aborting on a pre-existing shallow DeepSWE clone

- Bug: all three calibration runners cloned DeepSWE only when `.subbench/deep-swe`
  was missing, then ran `git checkout --detach <lock.deepswe_commit>`. A pre-existing
  shallow clone lacking the pinned commit made checkout fail with "unable to read
  tree", aborting every run in `prepare()` before any subscription call.
- Fix: factored the shared prepare logic into [prepare-deepswe.ts](../scripts/prepare-deepswe.ts).
  Before the detached checkout it now probes `git cat-file -t <commit>` and, when the
  pinned commit is absent, runs `git fetch --depth=1 origin <commit>` to deepen/retrieve
  it. The three runners (`run-deepswe-calibration.ts`, `run-zai-deepswe-calibration.ts`,
  `run-claude-deepswe-calibration.ts`) now delegate to it.
- Coverage: added [prepare-deepswe.test.ts](../scripts/prepare-deepswe.test.ts) —
  fetch-on-missing, skip-fetch-when-present, and abort-on-fetch-failure. No measurement
  protocol or economics change.

## 2026-07-10 — Add rationale and open-questions docs

- Added [why-calibration.md](why-calibration.md): the "why not just use imported token
  costs?" answer — imported economics cover the API side, but the subscription meter is
  opaque, harness-dependent, and success-weighted, so a real drain measurement is
  irreducible; task content is irrelevant but cost-distribution coverage is not.
- Added [open-questions.md](open-questions.md): durable home for open questions. Records
  the operating stance — value-first / black-box; understanding a provider's internal
  subscription structure (token vs dollar vs credit vs dynamic) is an explicit V1
  non-goal, kept as a curiosity with a clear trigger (only model structure if the
  black-box conversion factor proves unstable across workload shapes).
- Indexed both in the docs list (AGENTS.md, symlinked as CLAUDE.md). No methodology or
  formula change; the terse V1 open-questions subset in methodology.md is unchanged and
  now cross-referenced.

## 2026-07-10 — DeepSWE pre-collection freeze (reconstructed from `cf8b578` on `main`)

- Froze the Tier A DeepSWE v1.1 selection, provenance lock, task order, verifier/image
  metadata, and per-provider pre-collection study bundles under `data/`.
- Added deterministic selection, lock generation/verification, frozen-study generation,
  redaction/freshness checks, and CI coverage.
- Added provider collectors and calibration runners for OpenAI Plus, Claude Max, and Z.ai;
  runs require paired usage evidence and an isolation attestation before they can be
  publishable.
- Kept all current examples and historical/pre-collection artifacts explicitly
  non-publishable. No subscription-value comparison has been measured.

## 2026-07-10 — Repository documentation cleanup

- Reduced the live documentation set to the goal, methodology, measurement protocol,
  frozen task set, Claude runbook, research context, and this log.
- Removed superseded plans, handoffs, reviews, and raw research inventories; their
  applicable decisions are reflected in the retained operational documents and frozen
  artifacts.
