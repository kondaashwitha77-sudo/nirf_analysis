import { AlertTriangle, Download, Play, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { TableDataView } from '../components/ui/DataTable'
import { ChartTypeSelector, MultiSelect, SelectFilter } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { CATEGORIES, YEARS } from '../data/mock/constants'
import { STATE_OPTIONS } from '../data/mock/rankings'
import { VIZ_AGGREGATIONS, VIZ_DATASETS, VIZ_DIMENSIONS, VIZ_MEASURES, WHY_CHART, adviseQuery, defaultSort, sortOptions } from '../data/mock/vizEngine'
import { downloadCsv } from '../lib/format'
import { queryVisualization } from '../services'
import type { AggregationKey, ChartSpec, VisualizationQuery, VisualizationResult } from '../types'

const latestYear = () => YEARS[YEARS.length - 1]

const INITIAL: VisualizationQuery = {
  dataset: 'rankings',
  x: 'category',
  y: 'score',
  aggregation: 'median',
  groupBy: null,
  filters: { years: [latestYear()], categories: [], states: [] },
  chartType: 'bar',
  sort: 'value_desc',
  limit: 15,
  binWidth: null,
}

/** Keeps an order the user picked while it still applies; otherwise uses the default for these fields. */
const withSort = (next: VisualizationQuery, chosen: boolean): VisualizationQuery =>
  chosen && sortOptions(next).some((o) => o.value === next.sort) ? next : { ...next, sort: defaultSort(next) }

const preset = (changes: Partial<VisualizationQuery>, years: number[] = [latestYear()]): VisualizationQuery => ({
  ...INITIAL,
  ...changes,
  filters: { years, categories: [], states: [] },
})

const QUICK_CHARTS: { label: string; query: () => VisualizationQuery }[] = [
  { label: 'Median score by category (bar)', query: () => preset({}) },
  { label: 'Score trend by year (line)', query: () => preset({ x: 'year', chartType: 'line' }, []) },
  { label: 'How TLR varies by category (box)', query: () => preset({ y: 'TLR', chartType: 'box' }) },
  { label: 'TLR vs RPC (scatter)', query: () => preset({ x: 'TLR', y: 'RPC', chartType: 'scatter' }) },
  { label: 'Institutions per state, latest year (bar of counts)', query: () => preset({ x: 'state', y: 'count', aggregation: 'count' }) },
  { label: 'Category by year heatmap of record counts', query: () => preset({ y: 'count', aggregation: 'count', groupBy: 'year', chartType: 'heatmap' }, []) },
]

const BIN_WIDTHS = [{ value: '', label: 'Auto' }, ...[1, 2, 5, 10, 20].map((n) => ({ value: String(n), label: String(n) }))]

const TYPE_NAME: Record<string, string> = { bar: 'Bar', dot: 'Dot plot', line: 'Line', area: 'Area', scatter: 'Scatter', box: 'Box', histogram: 'Histogram', ecdf: 'ECDF', heatmap: 'Heatmap', pie: 'Pie', donut: 'Donut' }

/** Tall enough that every row or bar stays readable. */
function chartHeight(spec: ChartSpec): number {
  if (spec.type === 'heatmap') return Math.max(380, 130 + (spec.series[0]?.yLabels?.length ?? 0) * 32)
  if (spec.horizontal) return Math.max(360, 90 + (spec.series[0]?.x?.length ?? 0) * Math.max(30, spec.series.length * 16))
  return 440
}

export default function VisualizationStudio() {
  const [q, setQ] = useState<VisualizationQuery>(INITIAL)
  const [sortChosen, setSortChosen] = useState(false)
  const [result, setResult] = useState<VisualizationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (query: VisualizationQuery) => {
    setLoading(true)
    setError(null)
    try {
      setResult(await queryVisualization(query))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The chart could not be built.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run(INITIAL)
  }, [run])

  const apply = (query: VisualizationQuery) => {
    setQ(query)
    void run(query)
  }
  const applyFresh = (query: VisualizationQuery) => {
    setSortChosen(false)
    apply(withSort(query, false))
  }
  const set = <K extends keyof VisualizationQuery>(k: K, v: VisualizationQuery[K]) => {
    // A new X starts from its own default, so a value order picked earlier never reorders years.
    const keepChosen = sortChosen && k !== 'x'
    if (k === 'x') setSortChosen(false)
    setQ((p) => withSort({ ...p, [k]: v }, keepChosen))
  }
  const pickSort = (sort: VisualizationQuery['sort']) => {
    setSortChosen(true)
    apply({ ...q, sort })
  }
  const orders = useMemo(() => sortOptions(q), [q])
  const xOptions = useMemo(() => [...VIZ_DIMENSIONS, ...VIZ_MEASURES.filter((m) => m.value !== 'count')], [])
  const type = q.chartType
  const usesAgg = !['scatter', 'histogram', 'box', 'ecdf'].includes(type)
  const advice = useMemo(() => adviseQuery(q), [q])
  const rec = advice.recommended

  const downloadTable = () => {
    if (!result) return
    downloadCsv(
      `${result.spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      result.table.columns.map((c) => ({ key: c.key, header: c.header })),
      result.table.rows,
    )
  }

  return (
    <>
      <PageHeader title="Visualization Studio" description="Build a chart by choosing fields, an aggregation and filters. It recommends a chart for your fields and warns you about choices that could mislead." />

      <SectionCard title="Quick charts" subtitle="One click sets every field">
        <div className="flex flex-wrap gap-2">
          {QUICK_CHARTS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-medium text-ink transition hover:border-accent hover:bg-teal-50 hover:text-deep"
              onClick={() => applyFresh(c.query())}
            >
              {c.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Chart builder" bodyClassName="space-y-3">
          <SelectFilter label="Dataset" value={q.dataset} onChange={(v) => set('dataset', v)} options={VIZ_DATASETS} />

          <div className="rounded-md bg-teal-50 px-2.5 py-2 text-xs text-deep">
            <p className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span><span className="font-semibold">Recommended: {TYPE_NAME[rec.type]}</span> — {rec.reason}</span>
            </p>
            {rec.type !== type && (
              <button type="button" className="mt-1.5 font-semibold underline hover:text-navy" onClick={() => apply(withSort({ ...q, chartType: rec.type }, sortChosen))}>
                Use it
              </button>
            )}
          </div>

          <ChartTypeSelector value={type} onChange={(t) => set('chartType', t)} recommended={rec.type} />

          {advice.warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              <span>{w}</span>
            </p>
          ))}

          <SelectFilter label="X-axis" value={q.x} onChange={(v) => set('x', v)} options={xOptions} />
          <SelectFilter label="Y-axis" value={q.y} onChange={(v) => set('y', v)} options={VIZ_MEASURES} />
          <SelectFilter label="Aggregation" value={q.aggregation} onChange={(v) => set('aggregation', v as AggregationKey)} options={VIZ_AGGREGATIONS} />
          {!usesAgg && <p className="-mt-1 text-xs text-muted">Aggregation does not apply to this chart type.</p>}
          <SelectFilter label="Group by" value={q.groupBy ?? ''} onChange={(v) => set('groupBy', v || null)} options={VIZ_DIMENSIONS} placeholder="None" />
          {type === 'histogram' && (
            <>
              <SelectFilter label="Bin width" value={q.binWidth ? String(q.binWidth) : ''} onChange={(v) => set('binWidth', v ? Number(v) : null)} options={BIN_WIDTHS} />
              {q.groupBy && <p className="-mt-1 text-xs text-muted">To compare groups, an ECDF is often clearer than overlaid bars.</p>}
            </>
          )}

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold text-ink">Filters</p>
            <div className="space-y-3">
              <MultiSelect label="Years" options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} values={q.filters.years.map(String)} onChange={(v) => set('filters', { ...q.filters, years: v.map(Number) })} placeholder="All years" />
              <MultiSelect label="Categories" options={CATEGORIES.map((c) => ({ value: c, label: c }))} values={q.filters.categories} onChange={(v) => set('filters', { ...q.filters, categories: v })} placeholder="All categories" />
              <MultiSelect label="States" options={STATE_OPTIONS.map((s) => ({ value: s, label: s }))} values={q.filters.states} onChange={(v) => set('filters', { ...q.filters, states: v })} placeholder="All states" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            {orders.length ? (
              <SelectFilter label="Sort" value={q.sort} onChange={(v) => pickSort(v as VisualizationQuery['sort'])} options={orders} />
            ) : (
              <p className="self-end pb-2 text-xs text-muted">Order does not apply to this chart type.</p>
            )}
            <div>
              <label htmlFor="viz-limit" className="field-label">Limit</label>
              <input id="viz-limit" type="number" min={1} max={500} className="field-control" value={q.limit} onChange={(e) => set('limit', Math.min(500, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          </div>

          <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void run(q)}>
            <Play className="h-4 w-4" /> Generate chart
          </button>
          <button type="button" className="w-full text-xs font-medium text-accent hover:text-deep" onClick={() => applyFresh(INITIAL)}>
            Reset
          </button>
        </SectionCard>

        <div className="min-w-0 space-y-5">
          {loading && !result ? (
            <SectionCard><LoadingState label="Building chart…" /></SectionCard>
          ) : error ? (
            <SectionCard><ErrorState message={error} onRetry={() => void run(q)} /></SectionCard>
          ) : result?.meta.emptyReason ? (
            <SectionCard><EmptyState title="Nothing to chart" message={`${result.meta.emptyReason} Try widening the filters or choosing another field.`} /></SectionCard>
          ) : (
            result && (
              <>
                <ChartCard
                  title={result.spec.title}
                  subtitle={`${result.meta.rowsUsed.toLocaleString('en-IN')} records used · ${result.meta.missingExcluded.toLocaleString('en-IN')} excluded for missing values`}
                  footer={result.meta.note}
                  why={WHY_CHART[result.spec.type]}
                >
                  <SpecChart spec={result.spec} height={chartHeight(result.spec)} loading={loading} />
                </ChartCard>
                <SectionCard
                  title="Result table"
                  actions={<button type="button" className="btn-secondary" onClick={downloadTable}><Download className="h-4 w-4" /> Download CSV</button>}
                >
                  <TableDataView data={result.table} pageSize={10} />
                </SectionCard>
              </>
            )
          )}
        </div>
      </div>
    </>
  )
}
