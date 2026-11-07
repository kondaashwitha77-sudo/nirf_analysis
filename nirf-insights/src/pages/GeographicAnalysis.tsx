import type { Data } from 'plotly.js-dist-min'
import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { PlotChart } from '../components/charts/PlotChart'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, SelectFilter, YearRangeSelector } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { useGlobalFilters } from '../context/GlobalFilters'
import { LATEST_YEAR, STATES, YEARS } from '../data/mock/constants'
import { STATE_OPTIONS } from '../data/mock/rankings'
import { categoryOptions, selectRecords, topRecords, yearOptions, yearsBetween } from '../data/selectors'
import { fmt } from '../lib/format'
import { median } from '../lib/mockMath'

const TOP_N = [10, 25, 50, 100, 1000].map((n) => ({ value: String(n), label: n === 1000 ? 'All listed' : `Top ${n}` }))

interface StateRow {
  state: string
  count: number
  share: number
  medianScore: number
  best: number | null
}

export default function GeographicAnalysis() {
  const { category, setCategory, year, setYear } = useGlobalFilters()
  const [topN, setTopN] = useState(50)
  const [state, setState] = useState('')
  const [range, setRange] = useState<[number, number]>([YEARS[0], LATEST_YEAR])

  const pool = useMemo(() => topRecords(category, year, topN), [category, year, topN])

  const rows = useMemo<StateRow[]>(() => {
    const m = new Map<string, typeof pool>()
    pool.forEach((r) => m.set(r.state, [...(m.get(r.state) ?? []), r]))
    return [...m.entries()]
      .map(([s, rs]) => {
        const exact = rs.filter((r) => r.rankType === 'exact' && r.rank !== null).map((r) => r.rank as number)
        return {
          state: s,
          count: rs.length,
          share: pool.length ? (rs.length / pool.length) * 100 : 0,
          medianScore: median(rs.map((r) => r.score).filter((v): v is number => v !== null)),
          best: exact.length ? Math.min(...exact) : null,
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [pool])

  const mapData = useMemo<Data[]>(() => {
    const info = new Map(STATES.map((s) => [s.name, s]))
    const pts = rows.filter((r) => info.has(r.state))
    return [
      {
        type: 'scattergeo',
        mode: 'markers',
        lat: pts.map((p) => info.get(p.state)!.lat),
        lon: pts.map((p) => info.get(p.state)!.lon),
        text: pts.map((p) => p.state),
        customdata: pts.map((p) => [p.count, p.share.toFixed(1)]),
        hovertemplate: '<b>%{text}</b><br>Institutions: %{customdata[0]}<br>Share: %{customdata[1]}%<extra></extra>',
        marker: {
          size: pts.map((p) => 10 + Math.sqrt(p.count) * 6),
          color: pts.map((p) => p.count),
          colorscale: 'Blues',
          showscale: true,
          colorbar: { title: { text: 'Institutions' }, thickness: 12, len: 0.7 },
          line: { color: pts.map((p) => (p.state === state ? '#F59E0B' : '#1E3A8A')), width: pts.map((p) => (p.state === state ? 3 : 1)) },
          opacity: 0.85,
          sizemode: 'diameter',
        },
      } as Data,
    ]
  }, [rows, state])

  const tableRows = state ? rows.filter((r) => r.state === state) : rows
  const years = yearsBetween(range[0], range[1])
  const leaders = rows.slice(0, 5).map((r) => r.state)
  const trend = leaders.map((s) => ({
    name: s,
    x: years,
    y: years.map((y) => topRecords(category, y, topN).filter((r) => r.state === s).length),
  }))

  const newcomers = useMemo(() => {
    const first = new Map<string, { name: string; state: string; city: string; year: number }>()
    selectRecords({ category }).forEach((r) => {
      const cur = first.get(r.institutionId)
      if (!cur || r.year < cur.year) first.set(r.institutionId, { name: r.institution, state: r.state, city: r.city, year: r.year })
    })
    return [...first.values()]
      .filter((f) => f.year > YEARS[0] && f.year >= range[0] && f.year <= range[1] && (!state || f.state === state))
      .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
  }, [category, range, state])

  const top10 = rows.slice(0, 10)

  return (
    <>
      <PageHeader title="Geographic Analysis" description="How listed institutions are spread across states. Counts use the selected category, year, and top-N cut-off." />

      <FilterBar onReset={() => { setTopN(50); setState(''); setYear(LATEST_YEAR); setRange([YEARS[0], LATEST_YEAR]) }}>
        <SelectFilter label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOptions} />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <SelectFilter label="Top-N" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={TOP_N} />
        <SelectFilter label="State" value={state} onChange={setState} options={STATE_OPTIONS.map((s) => ({ value: s, label: s }))} placeholder="All states" />
        <YearRangeSelector start={range[0]} end={range[1]} onChange={(s, e) => setRange([s, e])} />
      </FilterBar>

      <ChartCard
        title={`Institutions by state — ${category}, ${year}`}
        subtitle={`${topN >= 1000 ? 'All listed institutions' : `Top ${topN}`}; bubble size and colour show the count`}
        footer="Demo map: bubbles sit at approximate state centroids. A boundary choropleth needs state GeoJSON, which the backend can serve later."
      >
        <PlotChart
          title={`Institutions by state, ${category} ${year}`}
          data={mapData}
          height={460}
          empty={rows.length === 0}
          layout={{
            margin: { l: 0, r: 0, t: 0, b: 0 },
            geo: {
              scope: 'asia',
              projection: { type: 'mercator' },
              lonaxis: { range: [67, 98] },
              lataxis: { range: [6, 37.5] },
              showland: true,
              landcolor: '#F1F5F9',
              showcountries: true,
              countrycolor: '#CBD5E1',
              coastlinecolor: '#94A3B8',
              showocean: true,
              oceancolor: '#F8FAFC',
              bgcolor: 'rgba(0,0,0,0)',
            },
          }}
        />
      </ChartCard>

      <SectionCard title="State table" subtitle={state ? `Filtered to ${state}` : 'All states in the selection'}>
        <DataTable<StateRow>
          dense
          pageSize={10}
          initialSort={{ key: 'count', dir: 'desc' }}
          rows={tableRows}
          rowKey={(r) => r.state}
          columns={[
            { key: 'state', header: 'State', sortable: true, sortValue: (r) => r.state, render: (r) => r.state },
            { key: 'count', header: 'Institutions', align: 'right', sortable: true, sortValue: (r) => r.count, render: (r) => r.count },
            { key: 'share', header: 'Share (%)', align: 'right', sortable: true, sortValue: (r) => r.share, render: (r) => fmt(r.share, 1) },
            { key: 'median', header: 'Median score', align: 'right', sortable: true, sortValue: (r) => r.medianScore, render: (r) => fmt(r.medianScore) },
            { key: 'best', header: 'Best exact rank', align: 'right', sortable: true, sortValue: (r) => r.best, render: (r) => (r.best ?? <span className="text-xs italic text-slate-400">No exact rank</span>) },
          ]}
        />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="State comparison" subtitle="Ten best-represented states">
          <SpecChart height={320} spec={{ type: 'bar', title: `Institutions per state, ${category} ${year}`, xTitle: 'State', yTitle: 'Institutions', series: [{ name: 'Institutions', x: top10.map((r) => r.state), y: top10.map((r) => r.count) }] }} />
        </ChartCard>
        <ChartCard title="Yearly geographic trend" subtitle="Five leading states in the selected year">
          <SpecChart height={320} spec={{ type: 'line', title: `Institutions per state over time, ${category}`, xTitle: 'Year', yTitle: 'Institutions', yFromZero: true, series: trend }} />
        </ChartCard>
      </div>

      <SectionCard title="Newly appearing institutions" subtitle={`First appearance in ${category} between ${range[0]} and ${range[1]} (after ${YEARS[0]})`}>
        <DataTable
          dense
          pageSize={8}
          rows={newcomers}
          rowKey={(r) => r.name}
          emptyMessage="No newly appearing institutions in this range."
          columns={[
            { key: 'name', header: 'Institution', render: (r) => r.name },
            { key: 'city', header: 'City', render: (r) => r.city },
            { key: 'state', header: 'State', render: (r) => r.state },
            { key: 'year', header: 'First seen', align: 'right', render: (r) => r.year },
          ]}
        />
        <p className="mt-2 text-xs text-muted">An institution may be missing from earlier years because of source gaps, not only because it is new.</p>
      </SectionCard>
    </>
  )
}
