import type {
  AggregationKey,
  ChartSeries,
  ChartSpec,
  ChartType,
  OrderKey,
  ParamKey,
  RankingRecord,
  TableData,
  VisualizationQuery,
  VisualizationResult,
} from '../../types'
import { chartHasData } from '../../lib/chartData'
import { hasStandardOrder, orderIndices } from '../../lib/order'
import { describe, mean, pearson, quantile, std } from '../../lib/stats'
import { PARAMS, PARAM_KEYS, ZONE_BY_STATE } from './constants'
import { RECORDS } from './rankings'

/** Runs a whitelisted query on the loaded records. It never evaluates free-form SQL or code. */

export const VIZ_DATASETS = [{ value: 'rankings', label: 'Ranking records' }]

export const VIZ_DIMENSIONS = [
  { value: 'year', label: 'Year' },
  { value: 'category', label: 'Category' },
  { value: 'parameter', label: 'Parameter' },
  { value: 'zone', label: 'Zone' },
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

/** Only these dimensions have a natural order, so only these may be joined by a line. */
export const ORDERED_DIMENSIONS = ['year']

const MAX_GROUPS = 7
const MAX_BOXES = 12
const MAX_HIST_GROUPS = 3
const MAX_DRAWN_POINTS = 2000
const LONG_LABEL = 12
const PIE_NAMED_SLICES = 5
const TEAL = '#0E7C86'

export const WHY_CHART: Record<ChartType, string> = {
  bar: 'Bars compare values by length from a common baseline, the most accurate way for categories (Cleveland-McGill).',
  dot: 'A dot plot shows each value as a position on a shared scale, which is read more accurately than length or angle (Cleveland-McGill).',
  line: 'A line joins ordered points, so the eye follows change over time.',
  area: 'A stacked area shows how parts add up to a total over time; it only suits counts and sums.',
  scatter: 'A scatter plot shows how two numeric fields move together, one point per record.',
  box: 'A box plot shows the median and the middle half of each group, so spreads can be compared side by side.',
  histogram: 'A histogram shows the shape of a distribution; the bin width changes what you see, so try more than one.',
  ecdf: 'An ECDF shows the share of values at or below each point with no binning, which makes groups easy to compare.',
  heatmap: 'A heatmap crosses two categories with a single-hue scale, so patterns stand out by shade.',
  pie: 'A pie shows shares of a whole, but angle is hard to compare; bars are easier to read.',
  donut: 'A donut shows shares of a whole, but angle is hard to compare; bars are easier to read.',
}

const dimKeys = VIZ_DIMENSIONS.map((d) => d.value)
const isDimension = (k: string) => dimKeys.includes(k)
const isNumeric = (k: string) => !isDimension(k) && k !== 'count'
/** The measure used when Parameter is on an axis: each record's score for that parameter. */
const PARAM_VALUE = 'paramValue'
const label = (k: string) => (k === PARAM_VALUE ? 'Parameter score' : [...VIZ_DIMENSIONS, ...VIZ_MEASURES].find((f) => f.value === k)?.label ?? k)

const needsAggregation = (t: ChartType) => !['scatter', 'histogram', 'box', 'ecdf'].includes(t)
const isPie = (t: ChartType) => t === 'pie' || t === 'donut'
const isFlat = (t: ChartType) => t === 'scatter' || t === 'histogram' || t === 'ecdf'
const manyCategories = (x: string) => x === 'state' || x === 'city' || x === 'institution' || x === 'category'

/** A line or area over a non-year field is drawn as bars (see resolveType). */
const drawnType = (q: VisualizationQuery): ChartType => ((q.chartType === 'line' || q.chartType === 'area') && q.x !== 'year' ? 'bar' : q.chartType)
const xDimension = (q: VisualizationQuery) => (isDimension(q.x) ? q.x : 'category')

/** Parameter is not a column on a record, so these charts need one row per parameter. */
function usesParameter(q: VisualizationQuery): boolean {
  const t = drawnType(q)
  if (isFlat(t)) return false
  return q.x === 'parameter' || (q.groupBy === 'parameter' && t !== 'dot' && !isPie(t))
}

function parameterQuery(q: VisualizationQuery): VisualizationQuery {
  return { ...q, y: PARAM_VALUE, aggregation: q.y === 'count' || isPie(drawnType(q)) ? 'count' : q.aggregation }
}

/* -------------------------------- Order ------------------------------- */
const ORDER_OPTION: Record<OrderKey, string> = {
  value_desc: 'Value, high to low',
  value_asc: 'Value, low to high',
  fixed: 'NIRF standard order',
  alpha: 'A to Z',
  time: 'Time order',
}

const ORDER_PHRASE: Record<OrderKey, string> = {
  value_desc: 'value, high to low',
  value_asc: 'value, low to high',
  fixed: 'NIRF standard order',
  alpha: 'A to Z',
  time: 'time',
}

/** The orders that make sense for these fields and this chart. Empty means order does not apply. */
export function sortOptions(q: VisualizationQuery): { value: OrderKey; label: string }[] {
  const t = drawnType(q)
  const dim = xDimension(q)
  let keys: OrderKey[]
  if (t === 'line' || t === 'area') keys = ['time']
  else if (t === 'bar' || t === 'dot' || t === 'heatmap' || t === 'box') {
    keys = ['value_desc', 'value_asc', ...(hasStandardOrder(dim) ? (['fixed'] as const) : []), 'alpha', ...(dim === 'year' ? (['time'] as const) : [])]
  } else keys = []
  return keys.map((value) => ({ value, label: ORDER_OPTION[value] }))
}

/** Years run in time order; anything else runs from the best value, which for rank is the lowest. */
export function defaultSort(q: VisualizationQuery): OrderKey {
  const t = drawnType(q)
  if (t === 'line' || t === 'area' || xDimension(q) === 'year') return 'time'
  const used = usesParameter(q) ? parameterQuery(q) : q
  const agg: AggregationKey = t === 'box' ? 'median' : used.y === 'count' ? 'count' : used.aggregation
  return lowerIsBetter(used.y, agg) ? 'value_asc' : 'value_desc'
}

const effectiveSort = (q: VisualizationQuery): OrderKey => (sortOptions(q).some((o) => o.value === q.sort) ? q.sort : defaultSort(q))

/* ---------------------------- Chart advice ---------------------------- */
export function recommendChart(x: string, y: string, groupBy: string | null): { type: ChartType; reason: string } {
  const g = groupBy && groupBy !== x ? groupBy : null
  if (isNumeric(x)) {
    if (isNumeric(y) && y !== x) return { type: 'scatter', reason: `two numeric fields, so each record is a point showing how ${label(x)} and ${label(y)} move together.` }
    if (g) return { type: 'ecdf', reason: `one numeric field compared across ${label(g)}, and an ECDF needs no bins.` }
    return { type: 'histogram', reason: `one numeric field, so a histogram shows the shape of ${label(x)}.` }
  }
  if (x === 'year') {
    return { type: 'line', reason: g ? `Year is ordered, so one line per ${label(g)} shows change over time.` : 'Year is ordered, so a line shows change over time.' }
  }
  if (g) return { type: 'heatmap', reason: `two categories with a measure, so a grid shows ${label(x)} against ${label(g)}.` }
  if (y === 'count') return { type: 'bar', reason: `counts per ${label(x)}: bars compare them more accurately than the angles of a pie.` }
  return { type: 'bar', reason: `${label(x)} has no order, so sorted bars from zero compare values best${manyCategories(x) ? '; they run horizontally when labels are long' : ''}. For the spread within each group, try Box.` }
}

/** Why a chart type is a poor fit for the chosen fields; it stays selectable. */
export function chartWarning(type: ChartType, q: VisualizationQuery): string | null {
  const xName = label(q.x)
  const agg = q.y === 'count' ? 'count' : q.aggregation
  switch (type) {
    case 'line':
    case 'area':
      if (q.x !== 'year') return `A line joins points in order; ${xName} has no order, so use bars.`
      if (type === 'area' && agg !== 'count' && agg !== 'sum') return 'A stacked area adds groups up to a total, which only works for counts and sums, so this will be drawn as a line.'
      return null
    case 'bar':
    case 'dot':
      return isNumeric(q.x) ? `${xName} is a number, not a category; use a scatter plot or histogram instead.` : null
    case 'scatter':
      return isNumeric(q.x) && isNumeric(q.y) ? null : 'A scatter plot needs two numeric fields; pick a measure for both X and Y.'
    case 'histogram':
    case 'ecdf':
      return isNumeric(q.x) || isNumeric(q.y) ? null : 'This chart shows one numeric field; pick a measure for X or Y.'
    case 'box':
      if (isNumeric(q.x)) return 'A box plot groups a measure by a category; pick a category for X.'
      return q.y === 'count' ? 'A box plot needs a numeric measure for Y, not a count.' : null
    case 'heatmap':
      return isNumeric(q.x) ? `${xName} is a number; a heatmap needs a category on each axis.` : null
    case 'pie':
    case 'donut':
      return 'Angle is hard to compare; bars are easier to read.'
    default:
      return null
  }
}

export function adviseQuery(chosen: VisualizationQuery): { recommended: { type: ChartType; reason: string }; warnings: string[] } {
  const recommended = recommendChart(chosen.x, chosen.y, chosen.groupBy)
  // With Parameter on an axis the chart measures parameter scores, so warn about those.
  const q = usesParameter(chosen) ? parameterQuery(chosen) : chosen
  const warnings: string[] = []
  const fit = chartWarning(q.chartType, q)
  if (fit) warnings.push(fit)
  if (needsAggregation(q.chartType) && !isPie(q.chartType) && q.y !== 'count') {
    if (q.aggregation === 'sum' && isNumeric(q.y)) warnings.push(`A sum of ${label(q.y)} is not meaningful: adding up ${q.y === 'rank' ? 'ranks' : 'scores'} depends on how many records there are. Prefer the median.`)
    if (q.aggregation === 'mean' && q.y === 'rank') warnings.push('Rank is ordinal: it has an order but no equal spacing, so prefer the median.')
  }
  if (isPie(q.chartType) && q.aggregation !== 'count' && q.y !== 'count') warnings.push('A pie shows shares of a whole, so it will use the record count.')
  if ((q.chartType === 'line' || q.chartType === 'area') && q.x === 'year' && q.filters.years.length === 1) warnings.push('Only one year is selected, so there is no trend to draw. Clear the Years filter.')
  return { recommended, warnings }
}

/** The hard rules: charts that would mislead are switched, and the switch is explained. */
function resolveType(q: VisualizationQuery, notes: string[]): ChartType {
  const agg = q.y === 'count' ? 'count' : q.aggregation
  if ((q.chartType === 'line' || q.chartType === 'area') && q.x !== 'year') {
    notes.push(`Switched to bars: a line joins points in order, and ${label(q.x)} has no order.`)
    return 'bar'
  }
  if (q.chartType === 'area' && agg !== 'count' && agg !== 'sum') {
    notes.push('Switched to a line: a stacked area only works for counts and sums.')
    return 'line'
  }
  return q.chartType
}

/* ------------------------------- Helpers ------------------------------ */
type Row = RankingRecord & { parameter?: ParamKey }
type Key = string | number

function dimValue(r: Row, k: string): Key {
  switch (k) {
    case 'year':
      return r.year
    case 'category':
      return r.category
    case 'parameter':
      return r.parameter ?? ''
    case 'zone':
      return r.zone || ZONE_BY_STATE[r.state] || 'Unknown'
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

function measureValue(r: Row, k: string): number | null {
  if (k === PARAM_VALUE) return r.parameter ? r.params[r.parameter] ?? null : null
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
const medianOf = (v: number[]) => quantile([...v].sort((a, b) => a - b), 0.5)
const aggName = (a: AggregationKey) => VIZ_AGGREGATIONS.find((x) => x.value === a)?.label ?? a

/** For rank a lower value is better, so "the best" comes first when capping and ordering. */
const lowerIsBetter = (yk: string, agg: AggregationKey) => yk === 'rank' && agg !== 'count' && agg !== 'sum' && agg !== 'std'

type Point = { r: Row; v: number }

function valuedRows(rows: Row[], k: string): Point[] {
  return rows.flatMap((r) => {
    const v = measureValue(r, k)
    return v === null ? [] : [{ r, v }]
  })
}

function groupValues(points: Point[], key: (p: Point) => string | number): Map<string | number, number[]> {
  const m = new Map<string | number, number[]>()
  points.forEach((p) => {
    const k = key(p)
    const cur = m.get(k)
    if (cur) cur.push(p.v)
    else m.set(k, [p.v])
  })
  return m
}

function sortKeys(dim: string, keys: Key[], sort: OrderKey, valueOf: (k: Key) => number | null): Key[] {
  return orderIndices(dim, keys.map(String), sort === 'time' ? 'fixed' : sort, keys.map(valueOf)).map((i) => keys[i])
}

/** What a limit keeps: the best values, or the latest years. The chosen order never changes this set. */
function capKeys(dim: string, keys: Key[], valueOf: (k: Key) => number | null, lower: boolean, limit: number): Key[] {
  if (dim === 'year') return sortKeys(dim, keys, 'time', valueOf).slice(-limit)
  return sortKeys(dim, keys, lower ? 'value_asc' : 'value_desc', valueOf).slice(0, limit)
}

const capNote = (dim: string, shown: number, total: number, by = 'value') =>
  dim === 'year' ? `Showing the latest ${shown} of ${total} years` : `Showing the top ${shown} of ${total} ${label(dim)} values by ${by}`

/** Series never follow the chosen x order, so each keeps its colour when the order changes. */
const seriesOrder = (dim: string, keys: Key[]) => (dim === 'year' || hasStandardOrder(dim) ? sortKeys(dim, keys, 'fixed', () => null) : keys)

function emptyResult(reason: string, rowsUsed = 0, missing = 0): VisualizationResult {
  return {
    spec: { type: 'bar', title: 'No data', series: [] },
    table: { columns: [], rows: [] },
    meta: { rowsUsed, missingExcluded: missing, emptyReason: reason },
  }
}

const hasData = (spec: ChartSpec) => (spec.type === 'ecdf' ? spec.series.some((s) => (s.x?.length ?? 0) > 0) : chartHasData(spec))

function finish(spec: ChartSpec, table: TableData, rowsUsed: number, missing: number, notes: string[], measure: string): VisualizationResult {
  if (!hasData(spec)) return emptyResult(`${label(measure)} has no published values for these filters.`, rowsUsed, missing)
  return { spec, table, meta: { rowsUsed, missingExcluded: missing, note: notes.join(' ') || undefined } }
}

/* ------------------------------- Scatter ------------------------------ */
function runScatter(rows: RankingRecord[], q: VisualizationQuery, groupBy: string | null, notes: string[]): VisualizationResult {
  const xk = isNumeric(q.x) ? q.x : 'score'
  const yk = isNumeric(q.y) ? q.y : 'RPC'
  if (xk !== q.x || yk !== q.y) notes.push('A scatter plot needs two numeric fields, so defaults were used where needed.')
  const pts = rows
    .map((r) => ({ r, x: measureValue(r, xk), y: measureValue(r, yk) }))
    .filter((p): p is { r: RankingRecord; x: number; y: number } => p.x !== null && p.y !== null)

  // Correlation uses every point; only the drawing is thinned, evenly, so no year is favoured.
  const step = Math.max(1, Math.ceil(pts.length / MAX_DRAWN_POINTS))
  const drawn = pts.filter((_, i) => i % step === 0)
  if (step > 1) notes.push(`Drawing ${drawn.length.toLocaleString('en-IN')} of ${pts.length.toLocaleString('en-IN')} points, evenly sampled.`)
  notes.push('Axes follow the data range and do not start at zero.')

  const counts = new Map<string, number>()
  if (groupBy) drawn.forEach((p) => counts.set(String(dimValue(p.r, groupBy)), (counts.get(String(dimValue(p.r, groupBy))) ?? 0) + 1))
  const kept = groupBy ? [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_GROUPS).map(([k]) => k) : []
  if (groupBy && counts.size > MAX_GROUPS) notes.push(`Showing the ${MAX_GROUPS} largest groups of ${label(groupBy)}; the rest are shown as Other.`)
  const groupOf = (p: { r: RankingRecord }) => {
    if (!groupBy) return 'Records'
    const g = String(dimValue(p.r, groupBy))
    return kept.includes(g) ? g : 'Other'
  }
  const groups = new Map<string, typeof drawn>()
  drawn.forEach((p) => groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]))
  const series: ChartSeries[] = [...groups.entries()].map(([name, ps]) => ({
    name,
    x: ps.map((p) => p.x),
    y: ps.map((p) => p.y),
    text: ps.map((p) => `${p.r.institution} (${p.r.year})`),
  }))
  const { r, n } = pearson(pts.map((p) => p.x), pts.map((p) => p.y))
  const stat = !groupBy && Number.isFinite(r) ? ` (r = ${r.toFixed(2)}, n = ${n.toLocaleString('en-IN')})` : ''
  return finish(
    { type: 'scatter', title: `${label(yk)} vs ${label(xk)}${stat}`, xTitle: label(xk), yTitle: label(yk), series, reverseY: yk === 'rank' },
    {
      columns: [
        { key: 'institution', header: 'Institution' },
        { key: 'year', header: 'Year', align: 'right' },
        { key: 'x', header: label(xk), align: 'right' },
        { key: 'y', header: label(yk), align: 'right' },
      ],
      rows: pts.slice(0, 200).map((p) => ({ institution: p.r.institution, year: p.r.year, x: r2(p.x), y: r2(p.y) })),
    },
    pts.length,
    rows.length - pts.length,
    notes,
    yk,
  )
}

/* ------------------------- Histogram and ECDF ------------------------- */
function runDistribution(rows: RankingRecord[], q: VisualizationQuery, type: 'histogram' | 'ecdf', groupBy: string | null, notes: string[]): VisualizationResult {
  const xk = isNumeric(q.x) ? q.x : isNumeric(q.y) ? q.y : 'score'
  if (xk !== q.x) notes.push(`This chart shows one numeric field, so ${label(xk)} was used.`)
  const pts = valuedRows(rows, xk)
  const cap = type === 'histogram' ? MAX_HIST_GROUPS : MAX_GROUPS
  const groups = groupValues(pts, (p) => (groupBy ? dimValue(p.r, groupBy) : 'All records'))
  const order = [...groups.keys()].sort((a, b) => (groups.get(b) as number[]).length - (groups.get(a) as number[]).length)
  const kept = order.slice(0, cap)
  if (order.length > cap) notes.push(`Showing the ${cap} largest of ${order.length} groups of ${label(groupBy as string)}.`)
  const series: ChartSeries[] = kept.map((k) => ({ name: String(k), x: groups.get(k) as number[] }))
  const all = pts.map((p) => p.v)
  const s = describe(all)
  const spec: ChartSpec = type === 'histogram'
    ? {
        type,
        title: `Distribution of ${label(xk)}`,
        xTitle: label(xk),
        yTitle: 'Records',
        series,
        binSize: q.binWidth ?? undefined,
        reverseY: false,
        ...(series.length === 1 && s.n ? { refLines: [{ x: r2(s.mean) as number, label: `Mean ${r2(s.mean)}`, color: '#B35806' }, { x: r2(s.median) as number, label: `Median ${r2(s.median)}`, color: '#0B3B3C' }] } : {}),
      }
    : { type, title: `ECDF of ${label(xk)}${groupBy ? ` by ${label(groupBy)}` : ''}`, xTitle: label(xk), yTitle: 'Cumulative share', series }
  if (type === 'histogram' && series.length > 1) notes.push('Mean and median per group are in the table below.')
  return finish(
    spec,
    {
      columns: [
        { key: 'group', header: groupBy ? label(groupBy) : 'Group' },
        { key: 'n', header: 'Records', align: 'right' },
        { key: 'mean', header: 'Mean', align: 'right' },
        { key: 'median', header: 'Median', align: 'right' },
        { key: 'std', header: 'Std. dev.', align: 'right' },
        { key: 'min', header: 'Min', align: 'right' },
        { key: 'max', header: 'Max', align: 'right' },
      ],
      rows: kept.map((k) => {
        const d = describe(groups.get(k) as number[])
        return { group: String(k), n: d.n, mean: r2(d.mean), median: r2(d.median), std: r2(d.std), min: r2(d.min), max: r2(d.max) }
      }),
    },
    s.n,
    rows.length - s.n,
    notes,
    xk,
  )
}

/* --------------------------------- Box -------------------------------- */
function runBox(rows: RankingRecord[], q: VisualizationQuery, groupBy: string | null, notes: string[]): VisualizationResult {
  const yk = isNumeric(q.y) ? q.y : 'score'
  const xk = isDimension(q.x) ? q.x : 'category'
  if (yk !== q.y || xk !== q.x) notes.push('A box plot needs a numeric Y and a category for X, so defaults were used where needed.')
  const pts = valuedRows(rows, yk)
  const byX = groupValues(pts, (p) => dimValue(p.r, xk))
  const rank = yk === 'rank'
  const medianFor = (k: Key) => medianOf(byX.get(k) as number[])
  const sort = effectiveSort(q)
  const kept = sortKeys(xk, capKeys(xk, [...byX.keys()], medianFor, rank, MAX_BOXES), sort, medianFor)
  notes.unshift(`Ordered by: ${ORDER_PHRASE[sort].replace('value', 'median')}.`)
  if (byX.size > MAX_BOXES) notes.push(`${capNote(xk, MAX_BOXES, byX.size, 'median')}.`)
  if (rank) notes.push('Rank 1 is at the top.')
  const keptSet = new Set(kept)
  const inKept = pts.filter((p) => keptSet.has(dimValue(p.r, xk)))

  const g = groupBy && groupBy !== xk ? groupBy : null
  let series: ChartSeries[]
  if (g) {
    const byG = groupValues(inKept, (p) => dimValue(p.r, g))
    const gOrder = [...byG.keys()].sort((a, b) => (byG.get(b) as number[]).length - (byG.get(a) as number[]).length)
    const gKept = seriesOrder(g, gOrder.slice(0, MAX_GROUPS))
    if (gOrder.length > MAX_GROUPS) notes.push(`Showing the ${MAX_GROUPS} largest groups of ${label(g)}.`)
    series = gKept.map((name) => {
      const ps = inKept.filter((p) => dimValue(p.r, g) === name)
      return { name: String(name), x: ps.map((p) => String(dimValue(p.r, xk))), y: ps.map((p) => p.v) }
    })
  } else {
    series = kept.map((k) => ({ name: String(k), y: byX.get(k) as number[] }))
  }
  const largest = Math.max(0, ...kept.map((k) => (byX.get(k) as number[]).length))
  const showPoints = largest <= 300
  const top = rank && inKept.length ? Math.max(...inKept.map((p) => p.v)) : 0
  return finish(
    {
      type: 'box',
      title: `${label(yk)} by ${label(xk)}${g ? `, grouped by ${label(g)}` : ''}`,
      xTitle: label(xk),
      yTitle: label(yk),
      series,
      showPoints,
      xCategoryOrder: kept.map(String),
      reverseY: rank,
      ...(rank ? { yRange: [top * 1.03, 0.5] as [number, number] } : {}),
    },
    {
      columns: [
        { key: 'group', header: label(xk) },
        { key: 'n', header: 'n', align: 'right' },
        { key: 'q1', header: 'Q1', align: 'right' },
        { key: 'median', header: 'Median', align: 'right' },
        { key: 'q3', header: 'Q3', align: 'right' },
      ],
      rows: kept.map((k) => {
        const d = describe(byX.get(k) as number[])
        return { group: String(k), n: d.n, q1: r2(d.q1), median: r2(d.median), q3: r2(d.q3) }
      }),
    },
    inKept.length,
    rows.length - pts.length,
    notes,
    yk,
  )
}

/* ------------------------------- Heatmap ------------------------------ */
function runHeatmap(rows: RankingRecord[], q: VisualizationQuery, groupBy: string | null, notes: string[]): VisualizationResult {
  const chosenX = isDimension(q.x) ? q.x : 'category'
  if (chosenX !== q.x) notes.push('A heatmap needs a category on each axis, so Category was used for X.')
  const chosenG = groupBy && groupBy !== chosenX ? groupBy : chosenX === 'category' ? 'year' : 'category'
  // Time runs across, so Year always takes the columns.
  const swap = chosenG === 'year'
  const xk = swap ? chosenG : chosenX
  const gk = swap ? chosenX : chosenG
  const yk = q.y
  const agg = yk === 'count' ? 'count' : q.aggregation
  const lower = lowerIsBetter(yk, agg)
  const pts = valuedRows(rows, yk)
  const cap = Math.max(1, q.limit)

  const sort = effectiveSort(q)
  const isValueOrder = sort === 'value_desc' || sort === 'value_asc'
  // Year keeps time unless X is Year and a value order was picked; an axis the order cannot apply to uses value.
  const axisSort = (k: string): OrderKey => {
    if (k === 'year') return chosenX === 'year' && isValueOrder ? sort : 'time'
    if (sort === 'time' || (sort === 'fixed' && !hasStandardOrder(k))) return lower ? 'value_asc' : 'value_desc'
    return sort
  }
  const axis = (k: string) => {
    const groups = groupValues(pts, (p) => dimValue(p.r, k))
    const valueOf = (key: Key) => aggregate(groups.get(key) as number[], agg)
    return { keys: sortKeys(k, capKeys(k, [...groups.keys()], valueOf, lower, cap), axisSort(k), valueOf), total: groups.size }
  }
  const xAxis = axis(xk)
  const yAxis = axis(gk)
  const xSort = axisSort(xk)
  const ySort = axisSort(gk)
  notes.unshift(`Ordered by: ${xSort === ySort ? ORDER_PHRASE[xSort] : `${ORDER_PHRASE[xSort]} (${label(xk)}); ${ORDER_PHRASE[ySort]} (${label(gk)})`}.`)
  if (xAxis.total > xAxis.keys.length) notes.push(`${capNote(xk, xAxis.keys.length, xAxis.total)}.`)
  if (yAxis.total > yAxis.keys.length) notes.push(`${capNote(gk, yAxis.keys.length, yAxis.total)}.`)
  if (lower) notes.push('Rank: lower is better, so the scale is reversed and darker means better.')

  const cells = new Map<string, number[]>()
  pts.forEach((p) => {
    const key = `${dimValue(p.r, xk)}||${dimValue(p.r, gk)}`
    const cur = cells.get(key)
    if (cur) cur.push(p.v)
    else cells.set(key, [p.v])
  })
  // A cell with no records is missing data, never zero, even for a count.
  const z = yAxis.keys.map((b) => xAxis.keys.map((a) => {
    const v = cells.get(`${a}||${b}`)
    return v ? r2(aggregate(v, agg)) : null
  }))
  const name = yk === 'count' ? 'Count of records' : `${aggName(agg)} of ${label(yk)}`
  return finish(
    {
      type: 'heatmap',
      title: `${name}: ${label(xk)} × ${label(gk)}`,
      xTitle: label(xk),
      yTitle: label(gk),
      series: [{ name, x: xAxis.keys.map(String), yLabels: yAxis.keys.map(String), z }],
      showValues: xAxis.keys.length <= 12,
      reverseScale: lower,
      readableGrid: true,
    },
    {
      columns: [{ key: 'row', header: label(gk) }, ...xAxis.keys.map((a) => ({ key: String(a), header: String(a), align: 'right' as const }))],
      rows: yAxis.keys.map((b, i) => ({ row: String(b), ...Object.fromEntries(xAxis.keys.map((a, j) => [String(a), z[i][j]])) })),
    },
    pts.length,
    rows.length - pts.length,
    notes,
    yk,
  )
}

/* ------------------- Bar, dot, line, area, pie, donut ------------------ */
function runAggregated(rows: RankingRecord[], q: VisualizationQuery, type: ChartType, groupBy: string | null, notes: string[]): VisualizationResult {
  const xk = isDimension(q.x) ? q.x : 'category'
  if (xk !== q.x) notes.push(`${label(q.x)} is a number, so Category was used for X.`)
  const pie = isPie(type)
  const yk = pie && q.y !== PARAM_VALUE ? 'count' : q.y
  const agg: AggregationKey = yk === 'count' ? 'count' : q.aggregation
  if (pie && q.y !== 'count' && q.aggregation !== 'count') notes.push('A pie shows shares of a whole, so the record count was used.')
  if (pie) notes.push('Angle is hard to compare; bars are easier to read.')

  const pts = valuedRows(rows, yk)
  const byX = groupValues(pts, (p) => dimValue(p.r, xk))
  const timeSeries = type === 'line' || type === 'area'
  const valueOf = (k: Key) => aggregate(byX.get(k) as number[], agg)
  const allKeys = [...byX.keys()]

  /* Pie: named slices plus Other */
  if (pie) {
    const sorted = sortKeys(xk, allKeys, 'value_desc', valueOf)
    const named = sorted.slice(0, sorted.length > PIE_NAMED_SLICES + 1 ? PIE_NAMED_SLICES : sorted.length)
    const rest = sorted.slice(named.length)
    const labels = named.map(String)
    const values = named.map((k) => valueOf(k) ?? 0)
    if (rest.length) {
      labels.push('Other')
      values.push(rest.reduce<number>((sum, k) => sum + (valueOf(k) ?? 0), 0))
      notes.push(`"Other" groups ${rest.length} smaller ${label(xk)} values.`)
    }
    return finish(
      { type, title: `Share of records by ${label(xk)}`, series: [{ name: 'Records', labels, values }] },
      { columns: [{ key: 'x', header: label(xk) }, { key: 'count', header: 'Records', align: 'right' }], rows: labels.map((l, i) => ({ x: l, count: values[i] })) },
      pts.length,
      rows.length - pts.length,
      notes,
      yk,
    )
  }

  const lower = lowerIsBetter(yk, agg)
  const sort: OrderKey = timeSeries ? 'time' : effectiveSort(q)
  const kept = timeSeries ? allKeys : capKeys(xk, allKeys, valueOf, lower, Math.max(1, q.limit))
  const keys = sortKeys(xk, kept, sort, valueOf)
  notes.unshift(`Ordered by: ${ORDER_PHRASE[sort]}.`)
  if (keys.length < allKeys.length) notes.push(`${capNote(xk, keys.length, allKeys.length)}.`)

  /* Series */
  const g = groupBy && groupBy !== xk && type !== 'dot' ? groupBy : null
  if (groupBy && type === 'dot') notes.push('A dot plot shows one value per category, so Group by was ignored.')
  const unit = agg === 'count' ? 'Record count' : `${aggName(agg)} of ${label(yk)}`
  let series: ChartSeries[]
  if (g) {
    const byG = groupValues(pts, (p) => dimValue(p.r, g))
    const groupKeys = [...byG.keys()]
    const shown = seriesOrder(g, capKeys(g, groupKeys, (k) => aggregate(byG.get(k) as number[], agg), lower, MAX_GROUPS))
    const rest = new Set(groupKeys.filter((k) => !shown.includes(k)))
    if (rest.size) notes.push(`${capNote(g, shown.length, groupKeys.length)}${type === 'line' ? '' : '; the rest are grouped into Other'}.`)
    const line = (keep: (p: Point) => boolean) => {
      const m = groupValues(pts.filter(keep), (p) => dimValue(p.r, xk))
      return keys.map((k) => {
        const v = m.get(k)
        return v ? r2(aggregate(v, agg)) : agg === 'count' ? 0 : null
      })
    }
    series = shown.map((name) => ({ name: String(name), x: keys.map(String), y: line((p) => dimValue(p.r, g) === name) }))
    if (rest.size && type !== 'line') series.push({ name: 'Other', x: keys.map(String), y: line((p) => rest.has(dimValue(p.r, g))) })
  } else {
    series = [{ name: unit, color: type === 'dot' ? TEAL : undefined, x: keys.map(String), y: keys.map((k) => r2(aggregate(byX.get(k) as number[], agg))) }]
  }

  const labels = keys.map(String)
  const horizontal = type === 'dot' || (type === 'bar' && xk !== 'year' && (labels.length > 8 || labels.some((l) => l.length > LONG_LABEL)))
  const showValues = type === 'bar' && labels.length * series.length <= 15
  if (showValues) series = series.map((s) => ({ ...s, text: (s.y ?? []).map((v) => (v === null ? '' : String(v))) }))
  const years = keys.map(Number)
  const flipped = timeSeries && lower
  if (flipped) notes.push('Rank 1 is at the top.')

  const spec: ChartSpec = {
    type,
    title: `${unit} by ${label(xk)}${g ? `, grouped by ${label(g)}` : ''}`,
    xTitle: label(xk),
    yTitle: unit,
    series: timeSeries ? series.map((s) => ({ ...s, x: years })) : series,
    horizontal,
    showValues,
    reverseY: flipped,
    rankAxis: flipped && type === 'line',
    yFromZero: timeSeries && agg === 'count',
    stacked: type === 'area' && !!g,
    ...(timeSeries ? { xTickValues: years } : {}),
  }
  return finish(
    spec,
    {
      columns: [{ key: 'x', header: label(xk) }, ...series.map((s) => ({ key: s.name, header: s.name, align: 'right' as const }))],
      rows: keys.map((k, i) => ({ x: String(k), ...Object.fromEntries(series.map((s) => [s.name, s.y?.[i] ?? null])) })),
    },
    pts.length,
    rows.length - pts.length,
    notes,
    yk,
  )
}

export function runVisualizationQuery(q: VisualizationQuery): VisualizationResult {
  const rows = RECORDS.filter(
    (r) =>
      (!q.filters.years.length || q.filters.years.includes(r.year)) &&
      (!q.filters.categories.length || q.filters.categories.includes(r.category)) &&
      (!q.filters.states.length || q.filters.states.includes(r.state)),
  )
  if (!rows.length) return emptyResult('No records match these filters.')

  const notes: string[] = []
  let groupBy = q.groupBy && isDimension(q.groupBy) ? q.groupBy : null
  const type = resolveType(q, notes)
  if (isFlat(type) && groupBy === 'parameter') {
    notes.push('Group by Parameter does not apply to this chart, so it was ignored.')
    groupBy = null
  }
  if (type === 'scatter') return runScatter(rows, q, groupBy, notes)
  if (type === 'histogram' || type === 'ecdf') return runDistribution(rows, q, type, groupBy, notes)

  const byParameter = usesParameter(q)
  if (byParameter && q.y !== 'count' && !isPie(type)) notes.push(`This chart measures the five parameter scores, so ${label(q.y)} is not used. Each record adds up to five values.`)
  const data: Row[] = byParameter ? rows.flatMap((r) => PARAM_KEYS.map((parameter) => ({ ...r, parameter }))) : rows
  const query = byParameter ? parameterQuery(q) : q
  if (type === 'box') return runBox(data, query, groupBy, notes)
  if (type === 'heatmap') return runHeatmap(data, query, groupBy, notes)
  return runAggregated(data, query, type, groupBy, notes)
}

export const EMPTY_TABLE: TableData = { columns: [], rows: [] }
