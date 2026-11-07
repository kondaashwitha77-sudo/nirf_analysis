/** Pure statistics helpers. Missing values (null/undefined/NaN) are dropped, never treated as 0. */

export const numbers = (values: (number | null | undefined)[]): number[] =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN)

export const variance = (v: number[]) => {
  if (v.length < 2) return NaN
  const m = mean(v)
  return v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)
}

export const std = (v: number[]) => Math.sqrt(variance(v))

export function quantile(sortedAsc: number[], q: number): number {
  if (!sortedAsc.length) return NaN
  const pos = (sortedAsc.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo)
}

export interface Summary {
  n: number
  missing: number
  mean: number
  median: number
  std: number
  variance: number
  min: number
  max: number
  q1: number
  q3: number
  iqr: number
  p5: number
  p10: number
  p90: number
  p95: number
}

export function describe(raw: (number | null | undefined)[]): Summary {
  const v = numbers(raw).sort((a, b) => a - b)
  const q1 = quantile(v, 0.25)
  const q3 = quantile(v, 0.75)
  return {
    n: v.length,
    missing: raw.length - v.length,
    mean: mean(v),
    median: quantile(v, 0.5),
    std: std(v),
    variance: variance(v),
    min: v.length ? v[0] : NaN,
    max: v.length ? v[v.length - 1] : NaN,
    q1,
    q3,
    iqr: q3 - q1,
    p5: quantile(v, 0.05),
    p10: quantile(v, 0.1),
    p90: quantile(v, 0.9),
    p95: quantile(v, 0.95),
  }
}

/** Pearson correlation over pairs where both values exist. */
export function pearson(a: (number | null)[], b: (number | null)[]): { r: number; n: number } {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (typeof x === 'number' && typeof y === 'number') {
      xs.push(x)
      ys.push(y)
    }
  }
  if (xs.length < 3) return { r: NaN, n: xs.length }
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  const denom = Math.sqrt(dx * dy)
  return { r: denom === 0 ? NaN : num / denom, n: xs.length }
}

export type OutlierMethod = 'iqr' | 'zscore' | 'percentile'

export interface OutlierPoint<T> {
  item: T
  value: number
  direction: 'high' | 'low'
  threshold: number
}

export interface OutlierResult<T> {
  outliers: OutlierPoint<T>[]
  lower: number
  upper: number
  tested: number
  skippedMissing: number
}

export const Z_THRESHOLD = 2.5

/** Missing values are skipped, never flagged. */
export function detectOutliers<T>(
  items: T[],
  getValue: (t: T) => number | null,
  method: OutlierMethod,
): OutlierResult<T> {
  const valued = items
    .map((item) => ({ item, value: getValue(item) }))
    .filter((x): x is { item: T; value: number } => typeof x.value === 'number' && Number.isFinite(x.value))
  const values = valued.map((x) => x.value).sort((a, b) => a - b)

  let lower = NaN
  let upper = NaN
  if (method === 'iqr') {
    const q1 = quantile(values, 0.25)
    const q3 = quantile(values, 0.75)
    lower = q1 - 1.5 * (q3 - q1)
    upper = q3 + 1.5 * (q3 - q1)
  } else if (method === 'zscore') {
    const m = mean(values)
    const s = std(values)
    lower = m - Z_THRESHOLD * s
    upper = m + Z_THRESHOLD * s
  } else {
    lower = quantile(values, 0.05)
    upper = quantile(values, 0.95)
  }

  const outliers: OutlierPoint<T>[] = []
  for (const { item, value } of valued) {
    if (value > upper) outliers.push({ item, value, direction: 'high', threshold: upper })
    else if (value < lower) outliers.push({ item, value, direction: 'low', threshold: lower })
  }
  outliers.sort((a, b) => Math.abs(b.value - b.threshold) - Math.abs(a.value - a.threshold))
  return { outliers, lower, upper, tested: valued.length, skippedMissing: items.length - valued.length }
}


/** Sample skewness and excess kurtosis (population moments). NaN when fewer than 3 values or no spread. */
export function shape(raw: (number | null | undefined)[]): { skew: number; kurt: number } {
  const v = numbers(raw)
  const n = v.length
  if (n < 3) return { skew: NaN, kurt: NaN }
  const m = v.reduce((a, b) => a + b, 0) / n
  const m2 = v.reduce((a, b) => a + (b - m) ** 2, 0) / n
  if (m2 === 0) return { skew: NaN, kurt: NaN }
  const m3 = v.reduce((a, b) => a + (b - m) ** 3, 0) / n
  const m4 = v.reduce((a, b) => a + (b - m) ** 4, 0) / n
  return { skew: m3 / m2 ** 1.5, kurt: m4 / m2 ** 2 - 3 }
}
