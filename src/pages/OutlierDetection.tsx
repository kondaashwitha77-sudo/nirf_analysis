import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, MetricSelector, SelectFilter } from '../components/ui/filters'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useGlobalFilters } from '../context/GlobalFilters'
import { categoryOptions, metricLabel, metricValue, selectRecords, yearOptions } from '../data/selectors'
import { fmt } from '../lib/format'
import { Z_THRESHOLD, detectOutliers } from '../lib/stats'
import type { OutlierMethod } from '../lib/stats'
import type { RankingRecord } from '../types'

const METHODS: { value: OutlierMethod; label: string; rule: string }[] = [
  { value: 'iqr', label: 'IQR (1.5 × IQR)', rule: 'Outside Q1 − 1.5·IQR or Q3 + 1.5·IQR' },
  { value: 'zscore', label: `Z-score (|z| > ${Z_THRESHOLD})`, rule: `More than ${Z_THRESHOLD} standard deviations from the mean` },
  { value: 'percentile', label: 'Percentile (P5–P95)', rule: 'Below the 5th or above the 95th percentile' },
]

export default function OutlierDetection() {
  const { category, setCategory, year, setYear } = useGlobalFilters()
  const [metric, setMetric] = useState('score')
  const [method, setMethod] = useState<OutlierMethod>('iqr')
  const label = metricLabel(metric)

  const recs = useMemo(() => selectRecords({ category, year }), [category, year])
  const res = useMemo(() => detectOutliers(recs, (r) => metricValue(r, metric), method), [recs, metric, method])
  const flagged = new Set(res.outliers.map((o) => o.item.id))

  // Scatter: position in overall-score order vs the metric value; thresholds drawn as lines.
  const ordered = useMemo(() => [...recs].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [recs])
  const valued = ordered
    .map((r, i) => ({ r, x: i + 1, y: metricValue(r, metric) }))
    .filter((p): p is { r: RankingRecord; x: number; y: number } => p.y !== null)
  const normal = valued.filter((p) => !flagged.has(p.r.id)).map((p) => ({ x: p.x, y: p.y, text: p.r.institution }))
  const out = valued.filter((p) => flagged.has(p.r.id)).map((p) => ({ x: p.x, y: p.y, text: p.r.institution }))
  const values = recs.map((r) => metricValue(r, metric)).filter((v): v is number => v !== null)
  const rule = METHODS.find((m) => m.value === method)!.rule

  return (
    <>
      <PageHeader title="Outlier Detection" description="Flag unusually high or low values. Institutions with no value for the metric are skipped, never flagged." />

      <FilterBar onReset={() => { setMetric('score'); setMethod('iqr') }}>
        <SelectFilter label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOptions} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <MetricSelector value={metric} onChange={setMetric} />
        <SelectFilter label="Detection method" value={method} onChange={(v) => setMethod(v as OutlierMethod)} options={METHODS} />
      </FilterBar>

      <KpiGrid cols={5}>
        <KpiCard label="Values tested" value={res.tested} />
        <KpiCard label="Skipped (missing)" value={res.skippedMissing} tone={res.skippedMissing ? 'warn' : 'default'} hint="Not treated as outliers" />
        <KpiCard label="Outliers found" value={res.outliers.length} tone={res.outliers.length ? 'bad' : 'default'} />
        <KpiCard label="Lower threshold" value={fmt(res.lower)} />
        <KpiCard label="Upper threshold" value={fmt(res.upper)} />
      </KpiGrid>

      {res.tested === 0 ? (
        <SectionCard><p className="py-6 text-center text-sm text-muted">No published {label} values for {category} in {year}.</p></SectionCard>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Box plot" subtitle={rule}>
              <SpecChart height={360} spec={{ type: 'box', title: `${label} — ${category}, ${year}`, yTitle: label, series: [{ name: category, y: values }] }} />
            </ChartCard>
            <ChartCard title="Scatter plot" subtitle="Dashed lines mark the thresholds; red points are flagged">
              <SpecChart
                height={360}
                spec={{ type: 'scatter', title: `${label} by position in overall-score order`, xTitle: 'Position (ordered by overall score)', yTitle: label, series: [
                  { name: 'Within range', x: normal.map((p) => p.x), y: normal.map((p) => p.y), text: normal.map((p) => p.text) },
                  { name: 'Outlier', x: out.map((p) => p.x), y: out.map((p) => p.y), text: out.map((p) => p.text) },
                ] }}
                layout={{
                  colorway: ['#0E7C86', '#DC2626'],
                  shapes: [res.lower, res.upper].map((y) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: y, y1: y, line: { color: '#64748B', width: 1.5, dash: 'dash' } })),
                }}
              />
            </ChartCard>
          </div>

          <SectionCard title="Detected outliers" subtitle={`${res.outliers.length} of ${res.tested} tested`}>
            <DataTable
              dense
              pageSize={10}
              rows={res.outliers}
              rowKey={(o) => o.item.id}
              emptyMessage="No outliers under this method. Try a different method or metric."
              columns={[
                { key: 'inst', header: 'Institution', render: (o) => o.item.institution },
                { key: 'state', header: 'State', render: (o) => o.item.state },
                { key: 'metric', header: 'Metric', render: () => label },
                { key: 'value', header: 'Value', align: 'right', sortable: true, sortValue: (o) => o.value, render: (o) => <span className="font-semibold">{fmt(o.value)}</span> },
                { key: 'threshold', header: 'Threshold', align: 'right', sortable: true, sortValue: (o) => o.threshold, render: (o) => fmt(o.threshold) },
                { key: 'method', header: 'Method', render: () => method.toUpperCase() },
                { key: 'dir', header: 'Direction', render: (o) => <StatusBadge variant={o.direction === 'high' ? 'info' : 'warn'}>{o.direction === 'high' ? 'High' : 'Low'}</StatusBadge> },
              ]}
            />
          </SectionCard>
        </>
      )}
    </>
  )
}
