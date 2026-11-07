import type {
  AggregationKey,
  ChartSeries,
  RankingRecord,
  TableData,
  VisualizationQuery,
  VisualizationResult,
} from '../../types'
import { describe, mean, numbers, quantile, std } from '../../lib/stats'
import { PARAMS } from './constants'
import { RECORDS } from './rankings'

/**
 * Local stand-in for POST /api/visualization/query.
 * It only understands a fixed whitelist of fields and aggregations — it never evaluates
 * free-form SQL or code, and neither will the real endpoint.
 */

export const VIZ_DATASETS = [{ value: 'rankings', label: 'Ranking records (demo)' }]

export const VIZ_DIMENSIONS = [
  { value: 'year', label: 'Year' },
  { value: 'category', label: 'Category' },
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'institution', label: 'Institution' },
  { value: 'rankType', label: 'Rank type' },
]

export const VIZ_MEASURES = [
  { value: 'score', label: 'Overall Score' },
  { value: 'rank', label: 'Rank (exact only)' },
  ...PARAMS.map((p) => ({ value: p.key as string, label: p.label })),
  { value: 'count', label: 'Record count' },
]

export const VIZ_AGGREGATIONS: { value: AggregationKey; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'std', label: 'Standard deviation' },
]

const dimKeys = VIZ_DIMENSIONS.map((d) => d.value)
const isDimension = (k: string) => dimKeys.includes(k)
const label = (k: string) =>
  [...VIZ_DIMENSIONS, ...VIZ_MEASURES].find((f) => f.value === k)?.label ?? k

function dimValue(r: RankingRecord, k: string): string | number {
  switch (k) {
    case 'year':
      return r.year
    case 'category':
      return r.category
    case 'state':
      return r.state
    case 'city':
      return r.city
    case 'institution':
      return r.institution
    default:
      return r.rankType
  }
}

function measureValue(r: RankingRecord, k: string): number | null {
  if (k === 'rank') return r.rankType === 'exact' ? r.rank : null
  if (k === 'score') return r.score
  if (k === 'count') return 1
  return r.params[k as keyof RankingRecord['params']] ?? null
}

function aggregate(values: number[], agg: AggregationKey): number | null {
  if (agg === 'count') return values.length
  if (!values.length) return null
  switch (agg) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'mean':
      return mean(values)
    case 'median':
      return quantile([...values].sort((a, b) => a - b), 0.5)
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return values.length > 1 ? std(values) : null
  }
}

const r2 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)
const naturalSort = (a: string | number, b: string | number) =>
  String(a).localeCompare(String(b), undefined, { numeric: true })

export function runVisualizationQuery(q: VisualizationQuery): VisualizationResult {
  const rows = RECORDS.filter(
    (r) =>
      (!q.filters.years.length || q.filters.years.includes(r.year)) &&
      (!q.filters.categories.length || q.filters.categories.includes(r.category)) &&
      (!q.filters.states.length || q.filters.states.includes(r.state)),
  )
  const limit = Math.max(1, q.limit)
  const groupBy = q.groupBy && isDimension(q.groupBy) ? q.groupBy : null
  const aggName = VIZ_AGGREGATIONS.find((a) => a.value === q.aggregation)?.label ?? q.aggregation
  const notes: string[] = []

  /* ---------------- Scatter ---------------- */
  if (q.chartType === 'scatter') {
    const xk = isDimension(q.x) || q.x === 'count' ? 'score' : q.x
    const yk = isDimension(q.y) || q.y === 'count' ? 'RPC' : q.y
    if (xk !== q.x || yk !== q.y) notes.push('Scatter needs two numeric fields; defaults were used where needed.')
    const pts = rows
      .map((r) => ({ r, x: measureValue(r, xk), y: measureValue(r, yk) }))
      .filter((p): p is { r: RankingRecord; x: number; y: number } => p.x !== null && p.y !== null)
    const used = pts.slice(0, Math.max(limit, 50) * 10)
    const groups = new Map<string, typeof used>()
    used.forEach((p) => {
      const g = groupBy ? String(dimValue(p.r, groupBy)) : 'Records'
      groups.set(g, [...(groups.get(g) ?? []), p])
    })
    const series: ChartSeries[] = [...groups.entries()].map(([name, ps]) => ({
      name,
      x: ps.map((p) => p.x),
      y: ps.map((p) => p.y),
      text: ps.map((p) => `${p.r.institution} (${p.r.year})`),
    }))
    return {
      spec: {
        type: 'scatter',
        title: `${label(yk)} vs ${label(xk)}`,
        xTitle: label(xk),
        yTitle: label(yk),
        series,
        reverseY: yk === 'rank',
      },
      table: {
        columns: [
          { key: 'institution', header: 'Institution' },
          { key: 'year', header: 'Year', align: 'right' },
          { key: 'x', header: label(xk), align: 'right' },
          { key: 'y', header: label(yk), align: 'right' },
        ],
        rows: used.slice(0, 200).map((p) => ({
          institution: p.r.institution,
          year: p.r.year,
          x: r2(p.x),
          y: r2(p.y),
        })),
      },
      meta: { rowsUsed: used.length, missingExcluded: rows.length - pts.length, note: notes.join(' ') || undefined },
    }
  }

  /* ---------------- Histogram ---------------- */
  if (q.chartType === 'histogram') {
    const xk = isDimension(q.x) || q.x === 'count' ? 'score' : q.x
    if (xk !== q.x) notes.push('Histogram needs a numeric field; Overall Score was used.')
    const groups = new Map<string, number[]>()
    let missing = 0
    rows.forEach((r) => {
      const v = measureValue(r, xk)
      if (v === null) {
        missing++
        return
      }
      const g = groupBy ? String(dimValue(r, groupBy)) : 'All records'
      groups.set(g, [...(groups.get(g) ?? []), v])
    })
    const series = [...groups.entries()].slice(0, 8).map(([name, x]) => ({ name, x }))
    const all = numbers([...groups.values()].flat())
    const s = describe(all)
    return {
      spec: { type: 'histogram', title: `Distribution of ${label(xk)}`, xTitle: label(xk), yTitle: 'Records', series },
      table: {
        columns: [
          { key: 'stat', header: 'Statistic' },
          { key: 'value', header: 'Value', align: 'right' },
        ],
        rows: [
          { stat: 'Records used', value: s.n },
          { stat: 'Missing excluded', value: missing },
          { stat: 'Mean', value: r2(s.mean) },
          { stat: 'Median', value: r2(s.median) },
          { stat: 'Std. dev.', value: r2(s.std) },
          { stat: 'Min', value: r2(s.min) },
          { stat: 'Max', value: r2(s.max) },
        ],
      },
      meta: { rowsUsed: s.n, missingExcluded: missing, note: notes.join(' ') || undefined },
    }
  }

  /* ---------------- Box ---------------- */
  if (q.chartType === 'box') {
    const yk = isDimension(q.y) || q.y === 'count' ? 'score' : q.y
    const xk = isDimension(q.x) ? q.x : 'category'
    if (yk !== q.y || xk !== q.x) notes.push('Box plots need a numeric Y and a categorical X; defaults were used where needed.')
    const groups = new Map<string, number[]>()
    let missing = 0
    rows.forEach((r) => {
      const v = measureValue(r, yk)
      if (v === null) {
        missing++
        return
      }
      const g = String(dimValue(r, xk))
      groups.set(g, [...(groups.get(g) ?? []), v])
    })
    const entries = [...groups.entries()].sort((a, b) => naturalSort(a[0], b[0])).slice(0, Math.max(limit, 1))
    return {
      spec: {
        type: 'box',
        title: `${label(yk)} by ${label(xk)}`,
        xTitle: label(xk),
        yTitle: label(yk),
        series: entries.map(([name, y]) => ({ name, y })),
        reverseY: yk === 'rank',
      },
      table: {
        columns: [
          { key: 'group', header: label(xk) },
          { key: 'n', header: 'n', align: 'right' },
          { key: 'q1', header: 'Q1', align: 'right' },
          { key: 'median', header: 'Median', align: 'right' },
          { key: 'q3', header: 'Q3', align: 'right' },
        ],
        rows: entries.map(([group, v]) => {
          const s = describe(v)
          return { group, n: s.n, q1: r2(s.q1), median: r2(s.median), q3: r2(s.q3) }
        }),
      },
      meta: { rowsUsed: entries.reduce((a, [, v]) => a + v.length, 0), missingExcluded: missing, note: notes.join(' ') || undefined },
    }
  }

  /* ---------------- Aggregated charts ---------------- */
  const xk = isDimension(q.x) ? q.x : 'category'
  if (xk !== q.x) notes.push('X must be a dimension for aggregated charts; Category was used.')
  const yk = q.y

  /* Heatmap */
  if (q.chartType === 'heatmap') {
    const gk = groupBy && groupBy !== xk ? groupBy : xk === 'category' ? 'year' : 'category'
    const cells = new Map<string, number[]>()
    const xs = new Set<string | number>()
    const ys = new Set<string | number>()
    let missing = 0
    rows.forEach((r) => {
      const v = measureValue(r, yk)
      if (v === null) {
        missing++
        return
      }
      const a = dimValue(r, xk)
      const b = dimValue(r, gk)
      xs.add(a)
      ys.add(b)
      const key = `${a}||${b}`
      cells.set(key, [...(cells.get(key) ?? []), v])
    })
    const xl = [...xs].sort(naturalSort).slice(0, Math.max(limit, 1))
    const yl = [...ys].sort(naturalSort).slice(0, 40)
    const z = yl.map((b) => xl.map((a) => r2(aggregate(cells.get(`${a}||${b}`) ?? [], q.aggregation))))
    return {
      spec: {
        type: 'heatmap',
        title: `${aggName} of ${label(yk)}: ${label(xk)} × ${label(gk)}`,
        xTitle: label(xk),
        yTitle: label(gk),
        series: [{ name: label(yk), x: xl, yLabels: yl.map(String), z }],
      },
      table: {
        columns: [{ key: 'row', header: label(gk) }, ...xl.map((a) => ({ key: String(a), header: String(a), align: 'right' as const }))],
        rows: yl.map((b, i) => ({
          row: String(b),
          ...Object.fromEntries(xl.map((a, j) => [String(a), z[i][j]])),
        })),
      },
      meta: { rowsUsed: rows.length - missing, missingExcluded: missing, note: notes.join(' ') || undefined },
    }
  }

  /* Bar / line / area / pie / donut */
  const buckets = new Map<string, Map<string | number, number[]>>()
  let missing = 0
  rows.forEach((r) => {
    const v = measureValue(r, yk)
    if (v === null) {
      missing++
      return
    }
    const g = groupBy && q.chartType !== 'pie' && q.chartType !== 'donut' ? String(dimValue(r, groupBy)) : label(yk)
    const xv = dimValue(r, xk)
    const m = buckets.get(g) ?? new Map<string | number, number[]>()
    m.set(xv, [...(m.get(xv) ?? []), v])
    buckets.set(g, m)
  })

  const totals = new Map<string | number, number>()
  buckets.forEach((m) =>
    m.forEach((vals, xv) => totals.set(xv, (totals.get(xv) ?? 0) + (aggregate(vals, q.aggregation) ?? 0))),
  )
  let xKeys = [...totals.keys()]
  if (q.sort === 'x_asc') xKeys.sort(naturalSort)
  else if (q.sort === 'x_desc') xKeys.sort((a, b) => naturalSort(b, a))
  else if (q.sort === 'y_asc') xKeys.sort((a, b) => (totals.get(a) ?? 0) - (totals.get(b) ?? 0))
  else xKeys.sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
  xKeys = xKeys.slice(0, limit)

  const series: ChartSeries[] = [...buckets.entries()].map(([name, m]) => {
    const y = xKeys.map((xv) => r2(aggregate(m.get(xv) ?? [], q.aggregation)))
    return q.chartType === 'pie' || q.chartType === 'donut'
      ? { name, labels: xKeys.map(String), values: y.map((v) => v ?? 0) }
      : { name, x: xKeys, y }
  })

  const unit = q.aggregation === 'count' ? 'Count' : `${aggName} of ${label(yk)}`
  return {
    spec: {
      type: q.chartType,
      title: `${unit} by ${label(xk)}${groupBy ? ` (grouped by ${label(groupBy)})` : ''}`,
      xTitle: label(xk),
      yTitle: unit,
      series,
      reverseY: yk === 'rank' && (q.chartType === 'line' || q.chartType === 'area'),
      stacked: false,
    },
    table: {
      columns: [{ key: 'x', header: label(xk) }, ...series.map((s) => ({ key: s.name, header: s.name, align: 'right' as const }))],
      rows: xKeys.map((xv, i) => ({
        x: String(xv),
        ...Object.fromEntries(
          series.map((s) => [s.name, (q.chartType === 'pie' || q.chartType === 'donut' ? s.values?.[i] : s.y?.[i]) ?? null]),
        ),
      })),
    },
    meta: { rowsUsed: rows.length - missing, missingExcluded: missing, note: notes.join(' ') || undefined },
  }
}

export const EMPTY_TABLE: TableData = { columns: [], rows: [] }
