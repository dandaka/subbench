import { describe, expect, test } from "bun:test";
import { extractRateLimits } from "../src/ratelimit.ts";

// The unified quota signal is the crux the Systima rig lacked: per-window status +
// utilization float + reset. Anthropic exposes it as suffixed response headers,
// e.g. `anthropic-ratelimit-unified-5h-status` / `-utilization` / `-reset`.
describe("extractRateLimits", () => {
  test("parses the 5h and 7d unified windows", () => {
    const headers = new Headers({
      "anthropic-ratelimit-unified-5h-status": "allowed",
      "anthropic-ratelimit-unified-5h-utilization": "0.4213",
      "anthropic-ratelimit-unified-5h-reset": "2026-07-13T18:00:00Z",
      "anthropic-ratelimit-unified-7d-status": "allowed_warning",
      "anthropic-ratelimit-unified-7d-utilization": "0.912",
      "anthropic-ratelimit-unified-7d-reset": "1752422400",
    });

    expect(extractRateLimits(headers)).toEqual({
      "5h": {
        status: "allowed",
        utilization: 0.4213,
        reset: "2026-07-13T18:00:00Z",
      },
      "7d": {
        status: "allowed_warning",
        utilization: 0.912,
        reset: "1752422400",
      },
    });
  });

  test("returns null windows when the headers are absent", () => {
    expect(extractRateLimits(new Headers())).toEqual({
      "5h": null,
      "7d": null,
    });
  });

  test("keeps a window whose utilization is unparseable as a null float, not a dropped window", () => {
    const headers = new Headers({
      "anthropic-ratelimit-unified-5h-status": "allowed",
      "anthropic-ratelimit-unified-5h-utilization": "n/a",
    });
    expect(extractRateLimits(headers)["5h"]).toEqual({
      status: "allowed",
      utilization: null,
      reset: null,
    });
  });

  test("emits a window when only utilization is present (status/reset absent)", () => {
    const headers = new Headers({
      "anthropic-ratelimit-unified-7d-utilization": "0.05",
    });
    expect(extractRateLimits(headers)["7d"]).toEqual({
      status: null,
      utilization: 0.05,
      reset: null,
    });
  });
});
