// The proxy reports its own version; every capture and every run record embeds it.
// Protocol (methodology.md → Harness Isolation instrumentation exception) requires the
// proxy version be pinned and recorded per run, so this is the single source of truth.
// Bump on any change to forwarding, capture shape, or SSE parsing.
export const PROXY_VERSION = "subbench-proxy/0.2.0";
