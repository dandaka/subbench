# Task: build the pass-through capture rig and run the cache-weighting experiment

Status: task spec, 2026-07-13. Operator-approved to execute as an **exploratory** study
(build rig + run design). This is the build/run companion to the design in
[cache-weighting-experiment.md](cache-weighting-experiment.md) §4; read that first — this
doc does not restate the estimator or task-pair theory, only what to build and how to run.

## Why this is runnable now

The pivot question — does the subscription quota meter discount cache reads like the API?
— stays open (the 2026-07-13 HN sweep found only one hobbyist's uncalibrated guess; see
[research.md](research.md) → *The Cache-Weighting Pivot*). The proxy-only capture route is
operator-approved (methodology → ToS Position and the Harness Isolation instrumentation
exception), and this experiment's output is **exploratory research data, not a subscription
calibration factor** — it will not be fed into any published SVI. That lowers the stakes of
being wrong, but it does **not** remove two constraints:

- **Isolation still required.** The run reads the live meter, so concurrent account usage
  corrupts the drain deltas the experiment regresses on — which defeats the experiment's own
  validity, not just calibration's. Execution requires a protocol §2 isolation attestation
  exactly as a calibration run does.
- **Coarse meter is an accepted caveat, not a solved problem.** All confirmed cells are
  grade `rounded` (integer-percent meters); claude-meter's own estimates span ~10× bands,
  empirically confirming §4's "infeasible at useful resolution on integer meters." We run it
  anyway as **exploratory / directional**: the exact token-mix side becomes clean, the drain
  side stays ±1 point. Results are reported as directional evidence, never as a settled
  H0/H1 verdict, until an exact-drain surface or a large-batch regression tightens them.

## Part A — build the capture rig

> A build handoff already exists (`handoff-proxy-capture.md`, repo root) and a
> `packages/proxy/` skeleton is in progress against it (`capture.ts`, `forward.ts`,
> `server.ts`). That handoff is the authoritative build spec; this Part A only adds the
> claude-meter-informed requirements the sweep surfaced (A4 additions, A5 acceptance
> checks). Reconcile the two before building — do not fork a second rig.

Reimplement (do **not** vendor) the capture pattern proven by **claude-meter**
(github.com/abhishekray07/claude-meter). That repo is **unlicensed** (all rights reserved),
so we cannot copy its code — but its design is the reference. See
[research.md](research.md) → *API-Boundary Metering Proxies* for the full evaluation
(verdict: BORROW).

Location: `packages/proxy/` (a scratch `packages/proxy/` already exists in the tree — fold
the rig there or supersede it; reconcile before committing rig code).

### A1. Pass-through proxy (zero envelope)

- A local HTTP forwarder on `ANTHROPIC_BASE_URL` that forwards every request **unmodified**
  to `api.anthropic.com` and streams the response back byte-for-byte. Clone request headers
  upstream; copy all response headers and status back; tee the body via a multi-writer so
  logging never blocks or alters the stream.
- **Zero added envelope** is mandatory (methodology → Harness Isolation): the proxy must
  modify nothing and add no tokens. Verify with a bare one-line calibration request — input
  bytes in must equal bytes forwarded, and `GATEWAY_ENVELOPE_TOKENS = 0`. Record the
  verification per run.
- Stdlib-only where practical (claude-meter's core is ~300 lines, zero deps). Prefer Bun +
  TypeScript per repo convention unless a Go forwarder is materially simpler; document the
  choice.

### A2. Capture format (per request)

Record one JSON/JSONL capture per request with:

- exact request payload (kept **private** — embeds provider system prompts; never published)
- the response **usage block**: `input_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, `output_tokens`
- **served model** from the response (protocol §1 — catches silent tier substitution)
- the `anthropic-ratelimit-unified-5h` / `-7d` response headers: per-window `status` +
  `utilization` **float** + reset timestamp (this is the piece Systima's rig lacked and the
  crux for pairing a token mix to a quota-window reading)
- request/response timestamps and a monotonic capture id

### A3. SSE reassembly

Handle streaming: split on `event:` / `data:` lines and accumulate the final usage across
`message_start` → `message_delta` events (non-streaming and tool-use blocks must also work).
Guard the known failure mode of subagent lanes not completing cleanly.

### A4. Additions over claude-meter (what it lacks)

- **Lossless capture** — claude-meter's async tee silently drops on backpressure; ours must
  not lose a request under load (block or buffer, never drop).
- **Hash-chained audit log** — replay captures into a SHA-256 hash-chained verifiable log
  (Systima's `ingest-audit.mjs` pattern) so the evidence chain is auditable end to end.
- **Permissive license** on our own reimplementation.
- (Deferred, not needed for the Anthropic pivot run: Codex/Z.ai normalizers — claude-meter
  is Anthropic-only; add when the experiment extends past Claude.)

### A5. Rig acceptance checks

- Bare-request envelope test passes (`GATEWAY_ENVELOPE_TOKENS = 0`).
- A known Claude Code session's captured usage totals reconcile against `/context` and
  ccusage token counts within rounding.
- Audit chain verifies end to end on a multi-record capture.
- Pass-through verified field recorded (methodology → Data Schema: `logging proxy present`).
- (Optional integrity cross-check) Anthropic's `count_tokens` endpoint returns the exact
  count billed — verified token-exact against paid invoices (Playcode, July 2026;
  research.md → *Tokenizer Divergence*). Replaying a captured request payload through
  `count_tokens` must reconcile with the capture's usage total
  (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`). Free and
  catches capture/SSE-reassembly bugs; it needs an API key and must run **outside** the
  measurement window so the probe cannot touch the subscription meter.

## Part B — run design (exploratory)

Follows [cache-weighting-experiment.md](cache-weighting-experiment.md) §3–§6; deltas here:

- **Provider order:** Claude first, then Codex. **Not Z.ai** — it carries `economics_gap`
  (local DeepSWE freeze lacks GLM-5.2), so `api_equivalent_usd` is unavailable and the ratio
  cannot be computed (§5). (Upstream DeepSWE v1.1 now publishes `glm-5.2[max]`; the gap
  closes on a re-pull — see R.1 / `handoff-zai-economics-research.md` — but treat Z.ai as
  gapped here until that lands.)
- **Regression route, not the two-arm test.** Run ordinary protocol §4 contiguous batches
  with the proxy in place, then regress batch-level drain deltas on the batches'
  exactly-measured token mixes (cold-input / cache-write / cache-read / output). Every
  calibration batch becomes evidence; far cheaper than 15–30 matched tasks per arm.
- **Cache-heavy vs cache-light separation** comes from task shape, not TTL-violating repeats
  — prefer the long-single-session construction (§3, construction 1). Keep §4 cache hygiene
  and the newly pinned cache-busting flags (protocol §4: telemetry/TTL, git-instructions)
  fixed and recorded across all batches, so the only varying cache signal is task-driven.
- **Meter verification** (protocol §1, new): confirm the run drains the subscription window,
  not API/credit billing, before any batch counts.
- **Analysis:** H0 (API-like weighting) predicts drain ∝ API-dollar value of the mix;
  deviations identify which component (cold input / cache write / cache read / output) the
  meter actually weights. Report the grade, N per batch, the cache-ratio estimate per batch,
  and the ±1/N rounding floor alongside any coefficient — and label the whole result
  **directional/exploratory** given the rounded meter.

## Preconditions before executing Part B

- [ ] Part A rig built and all A5 acceptance checks pass.
- [ ] Protocol §2 isolation attestation recorded (`--confirm-isolation "<operator>"`).
- [ ] Meter verified as subscription (protocol §1).
- [ ] Cache-busting flags pinned and recorded (protocol §4).
- [ ] Captures quarantined under their own `measurement_id`, never mixed into a baseline
      calibration; raw captures stay private, aggregates only may publish.

## Cross-references

- Design & estimator: [cache-weighting-experiment.md](cache-weighting-experiment.md) §4–§6.
- Prior art & claude-meter evaluation: [research.md](research.md) → *API-Boundary Metering
  Proxies*, *The Cache-Weighting Pivot*.
- ToS & isolation exception: [methodology.md](methodology.md) → ToS Position, Harness
  Isolation. Pivot open question: [open-questions.md](open-questions.md).
- Run rules: [protocol.md](protocol.md) §1 (meter verification), §2 (isolation), §4
  (cache hygiene + cache-busting flags).
