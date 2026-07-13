// Parse Anthropic's unified quota headers off a response. This is the piece Systima's rig
// lacked and the crux for pairing a captured token mix to a quota-window drain
// (cache-weighting-experiment.md §4): the meter is *read* from these headers, never derived.
//
// Anthropic exposes the unified windows as suffixed response headers per window:
//   anthropic-ratelimit-unified-<window>-status       (e.g. allowed / allowed_warning / rejected)
//   anthropic-ratelimit-unified-<window>-utilization   (float 0..1)
//   anthropic-ratelimit-unified-<window>-reset         (reset timestamp; unix seconds or ISO)
// Windows: 5h (rolling session) and 7d (weekly). We record both, plus null when a window
// is absent, so a capture is unambiguous about "no signal" vs "signal was 0".

export type RateLimitWindowKey = "5h" | "7d";

export interface RateLimitWindow {
  // Raw status string as sent; kept verbatim rather than enumerated so an unseen status
  // value is preserved rather than dropped.
  status: string | null;
  // Utilization as a float in 0..1; null when the header is absent or unparseable.
  utilization: number | null;
  // Reset timestamp exactly as sent (unix seconds or ISO); kept as a string to avoid
  // guessing the unit at capture time.
  reset: string | null;
}

export type RateLimits = Record<RateLimitWindowKey, RateLimitWindow | null>;

const WINDOWS: RateLimitWindowKey[] = ["5h", "7d"];

function parseFloatOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractWindow(
  headers: Headers,
  window: RateLimitWindowKey,
): RateLimitWindow | null {
  const prefix = `anthropic-ratelimit-unified-${window}-`;
  const status = headers.get(`${prefix}status`);
  const utilizationRaw = headers.get(`${prefix}utilization`);
  const reset = headers.get(`${prefix}reset`);

  // A window exists if any of its sub-headers was sent. Absence of all three means the
  // window was not reported (null), which callers must distinguish from utilization 0.
  if (status === null && utilizationRaw === null && reset === null) {
    return null;
  }

  return {
    status,
    utilization: parseFloatOrNull(utilizationRaw),
    reset,
  };
}

export function extractRateLimits(headers: Headers): RateLimits {
  const out = {} as RateLimits;
  for (const window of WINDOWS) {
    out[window] = extractWindow(headers, window);
  }
  return out;
}
