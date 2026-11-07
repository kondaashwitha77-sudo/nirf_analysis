import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, MetricSelector, MultiSelect, SelectFilter, YearRangeSelector } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { RankCell } from '../components/ui/RecordCells'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useGlobalFilters } from '../context/GlobalFilters'
import { LATEST_YEAR, YEARS } from '../data/mock/constants'
import { categoryOptions, selectRecords, topRecords, yearsBetween } from '../data/selectors'
import { fmt } from '../lib/format'
import type { RankingRecord } from '../types'

const TOP_N = [3, 5, 8, 10].map((n) => ({ value: String(n), label: `Top ${n}` }))
const METRICS = [
  { value: 'rank', label: 'Rank (lower is better)' },
  { value: 'score', label: 'Overall Score' },
]

export default function RankingTrends() {
  const { category, setCategory } = useGlobalFilters()
  const [ids, setIds] = useState<string[]>([])
  const [range, setRange] = useState<[number, number]>([YEARS[0], LATEST_YEAR])
  const [topN, setTopN] = useState(5)
  const [metric, setMetric] = useState('rank')

  const institutionOptions = useMemo(() => {
    const seen = new Map<string, string>()
    selectRecords({ category }).forEach((r) => seen.set(r.institutionId, r.institution))
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [category])

  // With nothing selected, fall back to the latest-year leaders in this category.
  const activeIds = useMemo(
    () => (ids.length ? ids : topRecords(category, LATEST_YEAR, topN).map((r) => r.institutionId)),
    [ids, category, topN],
  )

  const years = yearsBetween(range[0], range[1])
  const rows = useMemo(
    () => selectRecords({ category, yearRange: range, institutionIds: activeIds }),
    [category, range, activeIds],
  )

  const byInst = useMemo(() => {
    const m = new Map<string, { name: string; recs: Map<number, RankingRecord> }>()
    rows.forEach((r) => {
      const e = m.get(r.institutionId) ?? { name: r.institution, recs: new Map() }
      e.recs.set(r.year, r)
      m.set(r.institutionId, e)
    })
    return [...m.values()]
  }, [rows])

  const rankSeries = byInst.map((e) => ({ name: e.name, x: years, y: years.map((y) => { const r = e.recs.get(y); return r && r.rankType === 'exact' ? r.rank : null }) }))
  const scoreSeries = byInst.map((e) => ({ name: e.name, x: years, y: years.map((y) => e.recs.get(y)?.score ?? null) }))
  const notPlotted = rows.filter((r) => r.rankType !== 'exact').length

  const endYear = range[1]
  const compare = byInst
    .map((e) => ({ name: e.name, rec: e.recs.get(endYear) }))
    .map((c) => ({ name: c.name, v: c.rec ? (metric === 'rank' ? (c.rec.rankType === 'exact' ? c.rec.rank : null) : c.rec.score) : null }))
    .sort((a, b) => (a.v === null ? 1 : b.v === null ? -1 : metric === 'rank' ? a.v - b.v : b.v - a.v))

  return (
    <>
      <PageHeader title="Ranking Trends" description="Lower rank numbers mean better performance, so rank charts put rank 1 at the top. Rank bands are never plotted as exact ranks." />

      <FilterBar onReset={() => { setIds([]); setRange([YEARS[0], LATEST_YEAR]); setTopN(5); setMetric('rank') }}>
        <SelectFilter label="Category" value={category} onChange={(v) => { setCategory(v); setIds([]) }} options={categoryOptions} />
        <MultiSelect label="Institutions" options={institutionOptions} values={ids} onChange={setIds} max={10} placeholder={`Default: top ${topN} in ${LATEST_YEAR}`} className="sm:col-span-2" />
        <YearRangeSelector start={range[0]} end={range[1]} onChange={(s, e) => setRange([s, e])} />
        <SelectFilter label="Top-N (when none selected)" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={TOP_N} />
        <MetricSelector label="Comparison metric" value={metric} onChange={setMetric} options={METRICS} />
      </FilterBar>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Rank over time"
          subtitle="Exact ranks only; lower is better"
          footer={notPlotted > 0 ? `${notPlotted} record(s) with a rank band or no rank are not plotted. See the table.` : undefined}
        >
          <SpecChart height={340} spec={{ type: 'line', title: `Rank over time — ${category}`, xTitle: 'Year', yTitle: 'Rank (1 = best)', series: rankSeries, reverseY: true }} />
        </ChartCard>
        <ChartCard title="Score over time" subtitle="Overall score; gaps mean no published score">
          <SpecChart height={340} spec={{ type: 'line', title: `Overall score over time — ${category}`, xTitle: 'Year', yTitle: 'Overall score', series: scoreSeries }} />
        </ChartCard>
      </div>

      <ChartCard title={`Institution comparison — ${endYear}`} subtitle={metric === 'rank' ? 'Exact rank (shorter bar = better)' : 'Overall score'}>
        <SpecChart
          height={320}
          spec={{ type: 'bar', title: `${metric === 'rank' ? 'Rank' : 'Overall score'} by institution, ${endYear}`, xTitle: 'Institution', yTitle: metric === 'rank' ? 'Rank' : 'Overall score', series: [{ name: metric === 'rank' ? 'Rank' : 'Score', x: compare.map((c) => c.name), y: compare.map((c) => c.v) }] }}
        />
      </ChartCard>

      <SectionCard title="Data" subtitle="Each row shows how its rank is recorded: exact, band, or unavailable">
        <DataTable<RankingRecord>
          dense
          pageSize={12}
          initialSort={{ key: 'year', dir: 'desc' }}
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'year', header: 'Year', sortable: true, sortValue: (r) => r.year, render: (r) => r.year },
            { key: 'institution', header: 'Institution', sortable: true, sortValue: (r) => r.institution, render: (r) => r.institution },
            { key: 'rank', header: 'Rank', align: 'right', sortable: true, sortValue: (r) => (r.rankType === 'exact' ? r.rank : null), render: (r) => <RankCell record={r} /> },
            { key: 'type', header: 'Rank type', render: (r) => <StatusBadge variant={r.rankType} /> },
            { key: 'score', header: 'Score', align: 'right', sortable: true, sortValue: (r) => r.score, render: (r) => fmt(r.score) },
          ]}
        />
      </SectionCard>
    </>
  )
}
