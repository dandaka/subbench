# ClaudeBar Provider-Usage Research and Implementation Plan

Last updated: 2026-07-09

## Purpose

SubBench needs repeatable usage snapshots immediately before and after a calibration
task. This note evaluates whether ClaudeBar's multi-provider quota collectors can inform
that collection layer and defines a plan for adding equivalent capabilities to SubBench.

Research was performed against:

- repository: https://github.com/tddworks/ClaudeBar
- inspected commit: `9e02498d2bec2af30f44fa6e44e9c4cd01840dd5`
- release represented by that commit: `v0.4.70`
- commit date: 2026-07-02

ClaudeBar is a native macOS application written in Swift. SubBench is a TypeScript CLI
intended to run in reproducible benchmark environments, so the goal is not to embed or
depend on the application. The useful part is its provider-probe design and the evidence
it provides about available quota interfaces.

## Executive Finding

ClaudeBar is a strong reference implementation for a SubBench usage-collection layer.
It normalizes heterogeneous provider data into the same core concepts SubBench needs:

- provider and account
- quota window
- percentage used or remaining
- reset time
- capture time
- optional plan, credit, and cost data

The provider probes are not equal in evidentiary quality. Codex, Claude, and Z.ai can
return server-reported quota snapshots. OpenCode Go is reconstructed from local records.
CLI-screen parsing is a compatibility fallback and should not be SubBench's primary
measurement path.

SubBench should independently implement a small, auditable subset of this behavior,
retain the raw response behind every normalized snapshot, and record source provenance
and precision. It should not port the menu-bar UI or copy large portions of Swift code.

## ClaudeBar Architecture

ClaudeBar separates collection into three useful layers:

1. A provider-specific probe obtains data from an API, local CLI, or local database.
2. A parser converts it into one or more normalized quota records.
3. A snapshot attaches provider, account, tier, and capture-time metadata.

Its normalized `UsageQuota` stores percentage remaining, quota type, reset time, and
provider. `UsageSnapshot` groups quotas captured at the same time. This is a good
conceptual fit for SubBench, but SubBench also needs fields that a monitoring UI does
not:

- the original, immutable response
- source type and endpoint or command
- whether the value is server-reported, displayed, or reconstructed
- numeric precision or quantization
- collector and provider-client versions
- request and response timestamps
- freshness and cache status
- account identifier suitable for detecting accidental account changes

## Provider Findings

### OpenAI Codex

ClaudeBar's preferred path starts `codex app-server`, initializes its JSON-RPC
connection, and calls:

```text
account/rateLimits/read
```

The response contains a plan type plus primary and secondary windows with percentage
used and reset information. ClaudeBar falls back to scraping `/status` from an
interactive terminal if RPC fails.

SubBench already uses the preferred app-server call in
`packages/cli/src/codex-usage.ts`. This independently confirms the current approach.
The terminal fallback is not desirable for research because it is rounded, sensitive to
presentation changes, and harder to audit.

Assessment:

- authority: server-backed through the authenticated Codex client
- expected precision: numeric percentage returned by app-server
- authentication: existing Codex login
- implementation status: already present
- action: retain, strengthen metadata and raw-snapshot persistence

ClaudeBar also implements a direct request to:

```text
GET https://chatgpt.com/backend-api/wham/usage
```

using credentials from `~/.codex/auth.json`. It prefers
`x-codex-primary-used-percent` and `x-codex-secondary-used-percent` response headers,
then falls back to the response body's rate-limit windows. This path is useful as a
cross-check, but app-server should remain the default because it keeps authentication
and token refresh inside the official client.

### Anthropic Claude

ClaudeBar supports two materially different collection paths.

The preferred API probe reads Claude Code OAuth credentials from
`~/.claude/.credentials.json` or the macOS Keychain and calls:

```text
GET https://api.anthropic.com/api/oauth/usage
```

The response can include:

- `five_hour`
- `seven_day`
- `seven_day_sonnet`
- `seven_day_opus`
- newer model-scoped limits
- extra-usage credit consumption

Each quota carries utilization and reset data. This is server-reported account usage and
is a better automation interface than scraping the interactive `/usage` display.

The endpoint is aggressively rate-limited. ClaudeBar caches successful snapshots for
15 minutes and handles `429` responses with `Retry-After`; its source notes observed
one-hour throttle windows. That behavior is reasonable for a menu-bar monitor but cannot
be copied into a pre/post calibration workflow because a cached post-task snapshot would
hide the task's drain.

ClaudeBar's fallback launches Claude Code with `/usage` and parses its terminal output.
This produces displayed integer percentages and reset text. It is useful for manual
validation but is too coarse to classify as exact measurement.

Claude Counter supplies a third technique on Claude.ai: it intercepts an SSE
`message_limit` event whose payload contains unrounded window utilization. This is an
SSE data object, not an `anthropic-ratelimit-unified-*` HTTP header. It is precise for
Claude.ai generations but is not automatically available around a Claude Code task.

Assessment:

- authority: server-reported OAuth usage endpoint
- expected precision: numeric utilization; actual granularity must be measured
- authentication: existing full-scope Claude Code login
- principal risk: endpoint throttling prevents reliable immediate post-task reads
- action: build an experimental collector and validate cadence and precision before
  assigning an `exact` grade

### Z.ai GLM Coding Plan

ClaudeBar detects a Z.ai-compatible Claude Code configuration, reads the configured
authentication token, and calls:

```text
GET https://api.z.ai/api/monitor/usage/quota/limit
```

It also supports the corresponding `open.bigmodel.cn` and `dev.bigmodel.cn` hosts.
Observed quota records are distinguished by `type` and `unit`:

| Type | Unit | Interpretation |
|---|---:|---|
| `TOKENS_LIMIT` | 3 | rolling five-hour quota |
| `TOKENS_LIMIT` | 6 | rolling seven-day quota |
| `TOKENS_LIMIT` | 7 | monthly quota, when present |
| `TIME_LIMIT` | varies | MCP/tool quota |

The response supplies percentage used and the next reset time. ClaudeBar converts this
to percentage remaining. Earlier response forms may omit `unit`, in which case it can
identify only a generic token/session quota.

Assessment:

- authority: direct server quota endpoint
- expected precision: response percentage; actual granularity must be measured
- authentication: existing Z.ai key in Claude configuration or named environment variable
- principal risk: undocumented unit semantics may change
- action: highest-priority new collector after the shared snapshot model

### OpenCode Go

ClaudeBar queries OpenCode's local SQLite data through `opencode db`. It sums assistant
message cost for the `opencode-go` provider and compares it with hard-coded caps:

- five hours: $12
- weekly: $30
- monthly: $60

The five-hour reset is derived from the oldest message in the rolling window, the weekly
window is modeled as Monday-to-Monday UTC, and the monthly window is anchored to the
first observed OpenCode Go message.

This is useful operationally, but it is not a server quota snapshot. Missing local
history, changed caps, clock behavior, or use from another machine can make the result
diverge from enforcement.

Assessment:

- authority: local reconstruction
- expected precision: exact for the available local cost rows, not necessarily for the
  account quota
- authentication: none beyond the local OpenCode installation
- principal risk: reconstructed limits can be confidently wrong
- action: support only with an explicit `local-reconstruction` source grade and
  server-side validation

### Cursor and GitHub Copilot

These providers are outside the initial SubBench target set but demonstrate that the
shared collector model can expand.

ClaudeBar calls Cursor's `https://cursor.com/api/usage-summary` with local session
credentials and maps plan and on-demand consumption into monthly quota records.

For GitHub Copilot, it calls:

```text
GET https://api.github.com/copilot_internal/user
```

with a classic personal access token and reads the premium-interactions entitlement and
remaining balance. This requires additional user-managed credentials and relies on an
endpoint explicitly named `internal`, so it should not be prioritized for V1.

## Data Quality Model

The current `exact`, `rounded`, `inferred`, and `unknown` grades compress several
different questions. A collector can return many decimal places while still representing
cached or reconstructed data. SubBench should store separate dimensions:

### Authority

- `server`: returned by the provider's quota service
- `official-client`: returned through an authenticated provider client
- `display`: parsed from a human-facing interface
- `local-reconstruction`: computed from local logs or databases

### Precision

- `exact`: demonstrated to preserve the provider's accounting increment
- `decimal`: numeric utilization, but denominator or granularity not established
- `integer-percent`: displayed or returned whole percentage
- `unknown`

### Freshness

- response capture time
- provider-reported update time, if present
- reset time
- cached flag and cache age

An overall publication grade can still be derived, but the raw dimensions must remain
available for auditing.

## Licensing and Reuse

The inspected ClaudeBar README labels the project MIT. The inspected commit does not
contain a `LICENSE` file in its repository tree. Until the repository supplies
unambiguous license text or the maintainers clarify the discrepancy, SubBench should:

- treat ClaudeBar as behavioral and architectural research
- independently implement requests and parsers from observed interfaces
- avoid copying substantial source text
- cite the project and inspected commit

The provider interfaces themselves should also be treated as unstable and potentially
subject to provider terms. SubBench should avoid token refresh behavior where the
official CLI can safely make the same request, never log credentials, and redact raw
snapshots before publication.

## Implementation Plan

### Phase 1: Shared usage snapshot contract

Replace the Codex-only output shape with a provider-neutral contract while preserving
the existing `codex-usage` command.

Proposed shape:

```json
{
  "schemaVersion": 1,
  "provider": "codex",
  "account": { "plan": "plus", "idHash": "..." },
  "capturedAt": "2026-07-09T12:00:00.000Z",
  "collector": {
    "name": "codex-app-server",
    "version": "0.1.0",
    "authority": "official-client",
    "precision": "decimal",
    "cached": false
  },
  "windows": [
    {
      "kind": "session",
      "usedPercent": 42,
      "resetsAt": "2026-07-09T15:00:00.000Z"
    },
    {
      "kind": "weekly",
      "usedPercent": 23,
      "resetsAt": "2026-07-14T08:00:00.000Z"
    }
  ]
}
```

Deliverables:

- shared TypeScript types and validation
- normalized error categories
- JSON and numeric output adapters
- tests using captured, redacted fixtures
- backward-compatible `subbench codex-usage`

Acceptance criteria:

- existing Codex tests continue to pass
- the same snapshot can select session or weekly numeric output
- malformed, stale, or missing windows fail explicitly

### Phase 2: Persist auditable pre/post snapshots

The current runner stores only `pre_usage` and `post_usage`. Add immutable snapshot
records and link them to each run.

Deliverables:

- database migration for raw/redacted snapshot JSON and normalized windows
- capture timestamps, collector version, authority, precision, and freshness
- account-ID hashing to detect account changes without publishing identity
- a drain calculation that verifies matching provider, account, and quota window

Acceptance criteria:

- a run cannot silently compare different accounts or different reset windows
- the original normalized values used for every drain calculation are inspectable
- credentials and bearer tokens are rejected or redacted before persistence

### Phase 3: Z.ai collector

Implement the Z.ai quota endpoint first because it is direct, small, and central to the
project's initial provider comparison.

Deliverables:

- config discovery without printing secrets
- configurable Z.ai host with an allowlist
- parsing for units 3, 6, and 7 plus MCP limits
- fixtures for legacy responses without units and flexible reset timestamps
- `subbench usage zai --window weekly --format json|numeric`

Acceptance criteria:

- unexpected units are retained as unknown rather than silently discarded
- session and weekly quotas cannot collapse into one record
- live output is cross-checked manually against the Z.ai dashboard

### Phase 4: Experimental Claude collector

Implement the OAuth usage request as an explicitly experimental collector.

Deliverables:

- credential discovery compatible with Claude Code
- no credential values in logs, errors, database rows, or reports
- HTTP `429` and `Retry-After` handling
- five-hour, seven-day, scoped-model, and extra-usage parsing
- optional `/usage` display fallback marked `integer-percent`
- a cadence experiment measuring attainable pre/post read frequency

Acceptance criteria:

- live values agree with Claude's displayed usage after rounding
- at least three controlled tasks establish whether the endpoint changes at sufficient
  granularity for task-level drain
- the collector is not graded `exact` until accounting increments are independently
  validated
- a rate-limited post-read marks the run incomplete rather than substituting stale data

If immediate post-task reads prove unreliable, use one of these alternatives:

1. capture Claude Code's own server usage metadata during the task;
2. run grouped tasks between quota reads and estimate group-level drain;
3. use rounded `/usage` measurements with a declared quantization error;
4. perform depletion experiments for capacity while keeping task economics separate.

### Phase 5: OpenCode Go validation

Implement local reconstruction only after confirming current plan caps and window
semantics from a server-visible source.

Deliverables:

- local database reader
- configurable, dated cap definitions rather than permanent constants
- explicit `local-reconstruction` authority
- comparison against the account dashboard over multiple windows

Acceptance criteria:

- local and server values agree within a declared tolerance
- multi-machine and missing-history limitations appear in generated reports

### Phase 6: Provider-neutral CLI and reporting

Converge commands on:

```text
subbench usage <provider> --window <kind> --format json|numeric
```

Keep provider-specific aliases temporarily for compatibility. Extend reports with
collector authority, precision, version, capture failures, and stale-read counts.

Acceptance criteria:

- calibration scripts can switch providers without changing output parsing
- reports distinguish server measurements from local reconstructions
- a provider interface change produces a visible validation failure, not a plausible
  zero-drain result

## Validation Strategy

Every provider collector should pass four levels of validation:

1. Parser fixtures: redacted real response shapes, including missing and new fields.
2. Contract tests: normalized windows and metadata obey the shared schema.
3. Live smoke tests: values agree with the provider's own display after expected rounding.
4. Calibration checks: pre/post snapshots change monotonically within one quota window,
   use the same account, and do not cross a reset.

Store the provider-client version, collector version, endpoint family, and observation
date with live fixtures. Provider APIs are nonstationary; a parser that passed last month
is not evidence that today's measurement is valid.

## Immediate Next Work

The smallest high-value slice is:

1. introduce the shared snapshot contract;
2. adapt the existing Codex reader without changing its behavior;
3. persist pre/post snapshot provenance;
4. implement Z.ai;
5. prototype Claude and run a cadence/precision experiment.

This sequence improves the evidence behind the existing OpenAI calibration before adding
new providers, then adds the easiest server-reported comparison target, and finally
addresses Claude's harder rate-limiting problem with explicit validation.
