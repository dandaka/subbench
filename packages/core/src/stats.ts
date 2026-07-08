export function percentile(values: readonly number[], probability: number): number {
  if (values.length === 0) throw new Error("at least one value is required");
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = ordered[lower];
  const high = ordered[upper];
  if (low === undefined || high === undefined) throw new Error("invalid percentile");
  return low + (high - low) * (position - lower);
}

export function median(values: readonly number[]): number {
  return percentile(values, 0.5);
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function bootstrapCi(
  values: readonly number[],
  confidence = 0.95,
  samples = 5_000,
  seed = 0,
): [number, number] {
  if (values.length === 0) throw new Error("at least one value is required");
  if (values.length === 1) return [values[0]!, values[0]!];
  const rng = random(seed);
  const estimates: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const draw: number[] = [];
    for (let index = 0; index < values.length; index += 1) {
      draw.push(values[Math.floor(rng() * values.length)]!);
    }
    estimates.push(median(draw));
  }
  const alpha = (1 - confidence) / 2;
  return [percentile(estimates, alpha), percentile(estimates, 1 - alpha)];
}

// Acklam's rational approximation of the inverse normal CDF.
function normalQuantile(probability: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
    138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416];
  const low = 0.02425;
  let q: number;
  if (probability < low) {
    q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (probability > 1 - low) return -normalQuantile(1 - probability);
  q = probability - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q
    / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export function wilsonInterval(
  successes: number,
  total: number,
  confidence = 0.95,
): [number, number] {
  if (total <= 0) throw new Error("total must be positive");
  const z = normalQuantile(0.5 + confidence / 2);
  const proportion = successes / total;
  const denominator = 1 + z * z / total;
  const center = (proportion + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt(
    proportion * (1 - proportion) / total + z * z / (4 * total * total),
  ) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
