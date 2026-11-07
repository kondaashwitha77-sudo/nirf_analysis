import { Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { TableDataView } from '../components/ui/DataTable'
import { ChartTypeSelector, MultiSelect, SelectFilter } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { ErrorState, LoadingState } from '../components/ui/States'
import { CATEGORIES, YEARS } from '../data/mock/constants'
import { STATE_OPTIONS } from '../data/mock/rankings'
import { VIZ_AGGREGATIONS, VIZ_DATASETS, VIZ_DIMENSIONS, VIZ_MEASURES } from '../data/mock/vizEngine'
import { queryVisualization } from '../services'
import type { AggregationKey, VisualizationQuery, VisualizationResult } from '../types'

const INITIAL: VisualizationQuery = {
  dataset: 'rankings',
  x: 'category',
  y: 'score',
  aggregation: 'mean',
  groupBy: null,
  filters: { years: [2025], categories: [], states: [] },
  chartType: 'bar',
  sort: 'y_desc',
  limit: 15,
}

const SORTS = [
  { value: 'y_desc', label: 'Value, high to low' },
  { value: 'y_asc', label: 'Value, low to high' },
  { value: 'x_asc', label: 'X, A to Z / ascending' },
  { value: 'x_desc', label: 'X, Z to A / descending' },
]

export default function VisualizationStudio() {
  const [q, setQ] = useState<VisualizationQuery>(INITIAL)
  const [result, setResult] = useState<VisualizationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (query: VisualizationQuery) => {
    setLoading(true)
    setError(null)
    try {
      setResult(await queryVisualization(query))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The query failed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run(INITIAL)
  }, [run])

  const set = <K extends keyof VisualizationQuery>(k: K, v: VisualizationQuery[K]) => setQ((p) => ({ ...p, [k]: v }))
  const xOptions = useMemo(() => [...VIZ_DIMENSIONS, ...VIZ_MEASURES.filter((m) => m.value !== 'count')], [])
  const type = q.chartType
  const usesAgg = !['scatter', 'histogram', 'box'].includes(type)
  const hint: Record<string, string> = {
    scatter: 'Scatter plots two numeric fields: pick numeric X and Y.',
    histogram: 'Histograms use X as the numeric field; Y and aggregation are ignored.',
    box: 'Box plots group Y (numeric) by X (a dimension).',
    heatmap: 'Heatmaps cross X with Group by (default: category or year).',
    pie: 'Pie and donut charts use one series; Group by is ignored.',
    donut: 'Pie and donut charts use one series; Group by is ignored.',
  }

  return (
    <>
      <PageHeader title="Visualization Studio" description="Build a chart by choosing fields, an aggregation, and filters. The studio sends a structured query, never SQL or code." />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Query builder" bodyClassName="space-y-3">
          <SelectFilter label="Dataset" value={q.dataset} onChange={(v) => set('dataset', v)} options={VIZ_DATASETS} />
          <ChartTypeSelector value={type} onChange={(t) => set('chartType', t)} />
          {hint[type] && <p className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-deep">{hint[type]}</p>}
          <SelectFilter label="X-axis" value={q.x} onChange={(v) => set('x', v)} options={xOptions} />
          <SelectFilter label="Y-axis" value={q.y} onChange={(v) => set('y', v)} options={VIZ_MEASURES} />
          <SelectFilter label="Aggregation" value={q.aggregation} onChange={(v) => set('aggregation', v as AggregationKey)} options={VIZ_AGGREGATIONS} />
          {!usesAgg && <p className="-mt-1 text-xs text-muted">Aggregation does not apply to this chart type.</p>}
          <SelectFilter label="Group by" value={q.groupBy ?? ''} onChange={(v) => set('groupBy', v || null)} options={VIZ_DIMENSIONS} placeholder="None" />

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold text-ink">Filters</p>
            <div className="space-y-3">
              <MultiSelect label="Years" options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} values={q.filters.years.map(String)} onChange={(v) => set('filters', { ...q.filters, years: v.map(Number) })} placeholder="All years" />
              <MultiSelect label="Categories" options={CATEGORIES.map((c) => ({ value: c, label: c }))} values={q.filters.categories} onChange={(v) => set('filters', { ...q.filters, categories: v })} placeholder="All categories" />
              <MultiSelect label="States" options={STATE_OPTIONS.map((s) => ({ value: s, label: s }))} values={q.filters.states} onChange={(v) => set('filters', { ...q.filters, states: v })} placeholder="All states" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            <SelectFilter label="Sort" value={q.sort} onChange={(v) => set('sort', v as VisualizationQuery['sort'])} options={SORTS} />
            <div>
              <label htmlFor="viz-limit" className="field-label">Limit</label>
              <input id="viz-limit" type="number" min={1} max={500} className="field-control" value={q.limit} onChange={(e) => set('limit', Math.min(500, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          </div>

          <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void run(q)}>
            <Play className="h-4 w-4" /> Generate chart
          </button>
          <button type="button" className="w-full text-xs font-medium text-accent hover:text-deep" onClick={() => { setQ(INITIAL); void run(INITIAL) }}>
            Reset
          </button>

          <details className="rounded-md border border-line bg-slate-50 p-2 text-xs">
            <summary className="cursor-pointer font-medium text-ink">Request preview (POST /api/visualization/query)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-muted">{JSON.stringify(q, null, 2)}</pre>
          </details>
        </SectionCard>

        <div className="min-w-0 space-y-5">
          {loading && !result ? (
            <SectionCard><LoadingState label="Building chart…" /></SectionCard>
          ) : error ? (
            <SectionCard><ErrorState message={error} onRetry={() => void run(q)} /></SectionCard>
          ) : (
            result && (
              <>
                <ChartCard
                  title={result.spec.title}
                  subtitle={`${result.meta.rowsUsed.toLocaleString('en-IN')} records used · ${result.meta.missingExcluded.toLocaleString('en-IN')} excluded for missing values`}
                  footer={result.meta.note}
                >
                  <SpecChart spec={result.spec} height={440} loading={loading} />
                </ChartCard>
                <SectionCard title="Result table">
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
