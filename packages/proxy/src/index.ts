// Public surface of the pass-through capture rig. Import from "@subbench/proxy".
export {
  aggregate,
  type CacheWriteEvent,
  LARGE_CACHE_WRITE_THRESHOLD,
  type RunAggregate,
  type UtilizationPoint,
} from "./aggregate.ts";
export {
  type AuditEntry,
  appendToChain,
  GENESIS_PREV_HASH,
  linkHash,
  type VerifyResult,
  verifyChain,
} from "./audit.ts";
export {
  type CaptureRecord,
  extractFromJson,
  mergeUsage,
  newCapture,
  parseSseChunk,
  SseUsageAccumulator,
  type TokenUsage,
} from "./capture.ts";
export {
  DEFAULT_UPSTREAM,
  type FetchLike,
  type ForwardResult,
  forward,
} from "./forward.ts";
export {
  extractRateLimits,
  type RateLimits,
  type RateLimitWindow,
  type RateLimitWindowKey,
} from "./ratelimit.ts";
export { type ServerOptions, startServer } from "./server.ts";
export { CaptureSink } from "./sink.ts";
export {
  type EnvelopeCheckOptions,
  type EnvelopeEvidence,
  runEnvelopeCheck,
} from "./verify.ts";
export { PROXY_VERSION } from "./version.ts";
