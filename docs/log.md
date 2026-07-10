# Project log

This log records durable changes and decisions that affect future work. It is not a
measurement run log and does not establish publication evidence.

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
