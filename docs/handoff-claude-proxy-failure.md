# Handoff: Claude proxy measurement failure

Date: 2026-07-15

## Summary

Claude Max measurement did not fail inside the benchmark task. It was not started.
The run was blocked at the required pre-run proxy verification gate.

The current final blocker is:

- the proxy forwards the verification request byte-identically,
- the proxy adds zero measured envelope tokens,
- but the authenticated upstream response is not a usable 2xx response.

Under `docs/running-proxy-capture.md` and `docs/protocol.md`, this is a hard stop.
Any Claude measurement run made after a failing envelope check is invalid, so the
runner correctly did not start a measured batch.

## What happened

The attempted Claude path exposed four separate issues, in order.

1. The Claude calibration runner originally removed `ANTHROPIC_BASE_URL` from the
   Pier environment. That meant a configured local proxy would be bypassed by the
   actual measured run. This was fixed in `scripts/run-claude-deepswe-calibration.ts`:
   an explicitly supplied `ANTHROPIC_BASE_URL` is now preserved.

2. The first live proxy verification attempt failed with a client decompression error.
   Bun had already decompressed the upstream response body, while the proxy forwarded
   the stale upstream `content-encoding` header. Downstream clients then attempted a
   second decompression. This was fixed in `packages/proxy/src/forward.ts` by stripping
   `content-encoding` from forwarded response headers.

3. The next verification attempts proved byte-identical forwarding but returned
   upstream errors, first due to missing Anthropic request headers and then as non-2xx
   authenticated responses. The verifier was hardened in `packages/proxy/src/verify.ts`
   to send `anthropic-version: 2023-06-01`, `anthropic-beta: oauth-2025-04-20`, and an
   optional `PROXY_AUTHORIZATION` bearer token.

4. The verifier now fails closed unless all three conditions hold:
   authenticated 2xx upstream response, `byte_identical=true`, and
   `gateway_envelope_tokens=0`. The last observed probe still failed because the
   upstream response status was non-2xx (`401` on the final check; earlier probes also
   observed `429`). The evidence file was written to
   `.subbench/proxy-captures/envelope-verification.json`, which is private/local.

## Why the measurement is invalid right now

The proxy verification has to prove two things before a Claude run counts:

- instrumentation neutrality: the proxy did not add, drop, or mutate prompt-bearing
  request bytes;
- usable upstream path: Claude accepted the exact request through the proxy.

The current state only proves the first point. A non-2xx upstream response means the
probe did not establish that the same path can carry a valid Claude Code request. The
measurement therefore remains blocked before task execution.

## What is already fixed

- `scripts/run-claude-deepswe-calibration.ts` preserves an explicit
  `ANTHROPIC_BASE_URL`.
- `packages/proxy/src/forward.ts` strips stale transport `content-encoding` after Bun
  decompression.
- `packages/proxy/src/verify.ts` supports `PROXY_AUTHORIZATION`, sends the required
  Anthropic headers, records `response_status`, and requires 2xx for PASS.
- `docs/running-proxy-capture.md` documents the authenticated verification command and
  the 2xx PASS requirement.
- `packages/proxy/test/forward.test.ts` covers the response-header behavior.

Verification after the fixes:

- `bun test` passed, 90 tests.
- `bunx tsc --build` passed.
- `git diff --check` passed.

## Recommended next diagnostic

Do not run `calibrate:claude` until the envelope verification exits 0.

Next session should start from the proxy gate only:

```bash
PROXY_PORT=8788 \
PROXY_CAPTURES_DIR=./.subbench/proxy-captures \
bun packages/proxy/src/server.ts
```

Then, in another terminal with a current Claude Code OAuth access token:

```bash
PROXY_URL=http://127.0.0.1:8788 \
PROXY_CAPTURES_DIR=./.subbench/proxy-captures \
ENVELOPE_EVIDENCE_PATH=./.subbench/proxy-captures/envelope-verification.json \
PROXY_AUTHORIZATION="Bearer $CLAUDE_CODE_OAUTH_TOKEN" \
bun packages/proxy/src/verify.ts
```

If it returns `401`, focus on whether the verifier is using the same auth shape Claude
Code sends for subscription traffic. If it returns `429`, wait for the relevant Claude
window to reset or inspect the response headers privately; do not start a benchmark run
through the proxy.

Only after the verifier prints PASS should the Claude calibration runner be started
with `ANTHROPIC_BASE_URL=http://127.0.0.1:8788` and the required
`--confirm-isolation` attestation.
