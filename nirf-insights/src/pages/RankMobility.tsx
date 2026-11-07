import type { Data } from 'plotly.js-dist-min'
import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { PlotChart } from '../components/charts/PlotChart'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable, TableDataView } from '../components/ui/DataTable'
import { FilterBar, MultiSelect, SelectFilter } from '../components/ui/filters'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { RankCell } from '../components/ui/RecordCells'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { BadgeVariant } from '../components/ui/StatusBadge'
import { useGlobalFilters } from '../context/GlobalFilters'
import { LATEST_YEAR, YEARS } from '../data/mock/constants'
import { categoryOptions, selectRecords, yearOptions } from '../data/selectors'
import type { RankingRecord, TableData } from '../types'

const TOP_N = [5, 10, 15, 20].map((n) => ({ value: String(n), label: `Top ${n}` }))
const BUCKETS = ['1–10', '11–25', '26–50', '51+', 'Band / no exact rank', 'Not listed']

function bucket(r?: RankingRecord): string {
  if (!r) return 'Not listed'
  if (r.rankType !== 'exact' || r.rank === null) return 'Band / no exact rank'
  if (r.rank <= 10) return BUCKETS[0]
  if (r.rank <= 25) return BUCKETS[1]
  if (r.rank <= 50) return BUCKETS[2]
  return BUCKETS[3]
}

type Movement = 'Improved' | 'Declined' | 'Stable' | 'New entrant' | 'Exit' | 'Band involved'
const MOVE_BADGE: Record<Movement, BadgeVariant> = {
  Improved: 'pass',
  Declined: 'fail',
  Stable: 'unavailable',
  'New entrant': 'info',
  Exit: 'warn',
  'Band involved': 'band',
}

interface Row {
  id: string
  name: string
  a?: RankingRecord
  b?: RankingRecord
  change: number | null
  movement: Movement
}

export default function RankMobility() {
  const { category, setCategory } = useGlobalFilters()
  const [start, setStart] = useState(YEARS[0])
  const [end, setEnd] = useState(LATEST_YEAR)
  const [topN, setTopN] = useState(10)
  const [ids, setIds] = useState<string[]>([])

  const rows = useMemo<Row[]>(() => {
    const a = new Map(selectRecords({ category, year: start }).map((r) => [r.institutionId, r]))
    const b = new Map(selectRecords({ category, year: end }).map((r) => [r.institutionId, r]))
    const all = new Set([...a.keys(), ...b.keys()])
    return [...all]
      .filter((id) => !ids.length || ids.includes(id))
      .map((id) => {
        const ra = a.get(id)
        const rb = b.get(id)
        const name = (rb ?? ra)!.institution
        let movement: Movement
        let change: number | null = null
        if (!ra) movement = 'New entrant'
        else if (!rb) movement = 'Exit'
        else if (ra.rankType !== 'exact' || rb.rankType !== 'exact') movement = 'Band involved'
        else {
          change = (ra.rank as number) - (rb.rank as number)
          movement = change > 0 ? 'Improved' : change < 0 ? 'Declined' : 'Stable'
        }
        return { id, name, a: ra, b: rb, change, movement }
      })
  }, [category, start, end, ids])

  const count = (m: Movement) => rows.filter((r) => r.movement === m).length
  const compared = rows.filter((r) => r.change !== null)

  const slope = [...compared].sort((x, y) => (x.b!.rank as number) - (y.b!.rank as number)).slice(0, topN)
  const movers = [...compared].filter((r) => r.change !== 0).sort((x, y) => Math.abs(y.change!) - Math.abs(x.change!)).slice(0, topN)

  const sankey = useMemo<Data>(() => {
    const counts = new Map<string, number>()
    rows.forEach((r) => {
      const k = `${bucket(r.a)}|${bucket(r.b)}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    })
    const source: number[] = []
    const target: number[] = []
    const value: number[] = []
    counts.forEach((v, k) => {
      const [from, to] = k.split('|')
      source.push(BUCKETS.indexOf(from))
      target.push(BUCKETS.length + BUCKETS.indexOf(to))
      value.push(v)
    })
    return {
      type: 'sankey',
      orientation: 'h',
      node: {
        pad: 18,
        thickness: 16,
        label: [...BUCKETS.map((b) => `${b} (${start})`), ...BUCKETS.map((b) => `${b} (${end})`)],
        color: [...BUCKETS, ...BUCKETS].map((b) => (b === 'Not listed' ? '#CBD5E1' : b.startsWith('Band') ? '#F59E0B' : '#2563EB')),
      },
      link: { source, target, value, color: 'rgba(37,99,235,0.25)' },
    } as Data
  }, [rows, start, end])

  const matrix = useMemo<TableData>(() => ({
    columns: [{ key: 'from', header: `${start} \\ ${end}` }, ...BUCKETS.map((b) => ({ key: b, header: b, align: 'right' as const }))],
    rows: BUCKETS.map((from) => ({
      from,
      ...Object.fromEntries(BUCKETS.map((to) => [to, rows.filter((r) => bucket(r.a) === from && bucket(r.b) === to).length])),
    })),
  }), [rows, start, end])

  return (
    <>
      <PageHeader title="Rank Mobility" description="Who moved up, who slipped, and who entered or left between two years. Only institutions with exact ranks in both years are scored as movers; rank bands are never treated as exact ranks." />

      <FilterBar onReset={() => { setStart(YEARS[0]); setEnd(LATEST_YEAR); setTopN(10); setIds([]) }}>
        <SelectFilter label="Start year" value={String(start)} onChange={(v) => { const s = Number(v); setStart(s); if (s >= end) setEnd(Math.min(LATEST_YEAR, s + 1)) }} options={yearOptions.slice(0, -1)} />
        <SelectFilter label="End year" value={String(end)} onChange={(v) => { const e = Number(v); setEnd(e); if (e <= start) setStart(Math.max(YEARS[0], e - 1)) }} options={yearOptions.slice(1)} />
        <SelectFilter label="Category" value={category} onChange={(v) => { setCategory(v); setIds([]) }} options={categoryOptions} />
        <SelectFilter label="Top-N (charts)" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={TOP_N} />
        <MultiSelect label="Institutions" options={rows.map((r) => ({ value: r.id, label: r.name })).sort((x, y) => x.label.localeCompare(y.label))} values={ids} onChange={setIds} max={12} placeholder="All institutions" className="sm:col-span-2" />
      </FilterBar>

      <KpiGrid cols={6}>
        <KpiCard label="Improved" value={count('Improved')} hint="Better exact rank" />
        <KpiCard label="Declined" value={count('Declined')} hint="Worse exact rank" />
        <KpiCard label="Stable" value={count('Stable')} hint="Same exact rank" />
        <KpiCard label="New entrants" value={count('New entrant')} hint={`Not listed in ${start}`} />
        <KpiCard label="Exits" value={count('Exit')} hint={`Not listed in ${end}`} />
        <KpiCard label="Band involved" value={count('Band involved')} tone={count('Band involved') ? 'warn' : 'default'} hint="Not scored as movement" />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Start vs end rank" subtitle={`${start} → ${end}; steeper downward line = bigger improvement`}>
          <SpecChart height={380} spec={{ type: 'line', title: `Rank slope ${start} → ${end} — ${category}`, xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, series: slope.map((r) => ({ name: r.name, x: [start, end], y: [r.a!.rank, r.b!.rank] })) }} emptyMessage="No institutions have exact ranks in both years." />
        </ChartCard>
        <ChartCard title="Improvement and decline" subtitle="Places gained (+) or lost (−)">
          <SpecChart height={380} spec={{ type: 'bar', stacked: true, title: `Rank change ${start} → ${end}`, xTitle: 'Institution', yTitle: 'Rank change (places)', series: [
            { name: 'Improved', color: '#10B981', x: movers.map((r) => r.name), y: movers.map((r) => (r.change! > 0 ? r.change : null)) },
            { name: 'Declined', color: '#EF4444', x: movers.map((r) => r.name), y: movers.map((r) => (r.change! < 0 ? r.change : null)) },
          ] }} emptyMessage="No rank changes to show." />
        </ChartCard>
      </div>

      <ChartCard title="Rank transitions" subtitle="Flow of institutions between rank groups" footer="“Band / no exact rank” collects institutions whose rank is a band or unavailable. “Not listed” means absent that year.">
        <PlotChart title="Rank transitions" data={[sankey]} height={420} empty={rows.length === 0} layout={{ margin: { l: 8, r: 8, t: 8, b: 8 } }} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Transition table" subtitle="Count of institutions by start group (rows) and end group (columns)">
          <TableDataView data={matrix} pageSize={10} />
        </SectionCard>
        <SectionCard title="Institution movement" subtitle="Rank is shown by type: exact, band, or unavailable">
          <DataTable<Row>
            dense
            pageSize={8}
            rows={rows}
            rowKey={(r) => r.id}
            initialSort={{ key: 'change', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'Institution', sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
              { key: 'a', header: String(start), align: 'right', render: (r) => (r.a ? <RankCell record={r.a} /> : <span className="text-xs italic text-slate-400">Not listed</span>) },
              { key: 'b', header: String(end), align: 'right', render: (r) => (r.b ? <RankCell record={r.b} /> : <span className="text-xs italic text-slate-400">Not listed</span>) },
              { key: 'change', header: 'Change', align: 'right', sortable: true, sortValue: (r) => r.change, render: (r) => (r.change === null ? '—' : r.change > 0 ? `+${r.change}` : r.change) },
              { key: 'movement', header: 'Movement', render: (r) => <StatusBadge variant={MOVE_BADGE[r.movement]}>{r.movement}</StatusBadge> },
            ]}
          />
        </SectionCard>
      </div>
    </>
  )
}
