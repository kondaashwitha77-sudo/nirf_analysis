import type { Data } from 'plotly.js-dist-min'
import { useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { PlotChart } from '../components/charts/PlotChart'
import { SpecChart, wrapLabel } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, MultiSelect, SelectFilter } from '../components/ui/filters'
import { InstitutionLink } from '../components/ui/InstitutionLink'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { RankCell } from '../components/ui/RecordCells'
import { SectionCard } from '../components/ui/SectionCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { BadgeVariant } from '../components/ui/StatusBadge'
import { useGlobalFilters } from '../context/GlobalFilters'
import { DECLINED_COLOR, IMPROVED_COLOR, LATEST_YEAR, YEARS } from '../data/mock/constants'
import { categoryOptions, selectRecords, yearOptions } from '../data/selectors'
import type { RankingRecord } from '../types'

const TOP_N = [5, 10, 15, 20].map((n) => ({ value: String(n), label: `Top ${n}` }))
const BUCKETS = ['1–10', '11–25', '26–50', '51+', 'Not listed']

function bucket(r?: RankingRecord): string {
  if (r?.rank == null) return 'Not listed'
  if (r.rank <= 10) return BUCKETS[0]
  if (r.rank <= 25) return BUCKETS[1]
  if (r.rank <= 50) return BUCKETS[2]
  return BUCKETS[3]
}

type Movement = 'Improved' | 'Declined' | 'Stable' | 'New entrant' | 'Exit'
const MOVE_BADGE: Record<Movement, BadgeVariant> = {
  Improved: 'pass',
  Declined: 'fail',
  Stable: 'unavailable',
  'New entrant': 'info',
  Exit: 'warn',
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
    // A record with no exact rank counts as not listed that year.
    const a = new Map(selectRecords({ category, year: start }).filter((r) => r.rank !== null).map((r) => [r.institutionId, r]))
    const b = new Map(selectRecords({ category, year: end }).filter((r) => r.rank !== null).map((r) => [r.institutionId, r]))
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
  const chartHeight = Math.max(380, 72 + topN * 40)

  const sankey = useMemo<Data>(() => {
    // Plotly only keeps fixed positions reliably when every node has a link, so empty groups get no node.
    const GAP = 0.05
    const nodes: { label: string; color: string; x: number; y: number }[] = []
    const index = new Map<string, number>()
    const addColumn = (side: 'a' | 'b', year: number, x: number) => {
      const used = BUCKETS.map((b) => ({ b, n: rows.filter((r) => bucket(r[side]) === b).length })).filter((c) => c.n > 0)
      const room = 1 - GAP * (used.length - 1)
      let top = 0
      used.forEach(({ b, n }) => {
        const h = (n / rows.length) * room
        index.set(`${side}|${b}`, nodes.length)
        nodes.push({ label: `${b} (${year})`, color: b === 'Not listed' ? '#CBD5E1' : '#0E7C86', x, y: top + h / 2 })
        top += h + GAP
      })
    }
    addColumn('a', start, 0.001)
    addColumn('b', end, 0.999)

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
      source.push(index.get(`a|${from}`) as number)
      target.push(index.get(`b|${to}`) as number)
      value.push(v)
    })
    return {
      type: 'sankey',
      orientation: 'h',
      arrangement: 'fixed',
      node: {
        pad: 20,
        thickness: 16,
        label: nodes.map((n) => n.label),
        color: nodes.map((n) => n.color),
        x: nodes.map((n) => n.x),
        y: nodes.map((n) => n.y),
      },
      link: { source, target, value, color: 'rgba(14,124,134,0.25)' },
    } as Data
  }, [rows, start, end])

  const matrix = useMemo(
    () => BUCKETS.map((from) => ({ from, cells: BUCKETS.map((to) => rows.filter((r) => bucket(r.a) === from && bucket(r.b) === to).length) })),
    [rows],
  )

  return (
    <>
      <PageHeader title="Rank Mobility" description="Who moved up, who slipped, and who entered or left the list between two years." />

      <FilterBar onReset={() => { setStart(YEARS[0]); setEnd(LATEST_YEAR); setTopN(10); setIds([]) }}>
        <SelectFilter label="Start year" value={String(start)} onChange={(v) => { const s = Number(v); setStart(s); if (s >= end) setEnd(Math.min(LATEST_YEAR, s + 1)) }} options={yearOptions.slice(0, -1)} />
        <SelectFilter label="End year" value={String(end)} onChange={(v) => { const e = Number(v); setEnd(e); if (e <= start) setStart(Math.max(YEARS[0], e - 1)) }} options={yearOptions.slice(1)} />
        <SelectFilter label="Category" value={category} onChange={(v) => { setCategory(v); setIds([]) }} options={categoryOptions} />
        <SelectFilter label="Top-N (charts)" value={String(topN)} onChange={(v) => setTopN(Number(v))} options={TOP_N} />
        <MultiSelect label="Institutions" options={rows.map((r) => ({ value: r.id, label: r.name })).sort((x, y) => x.label.localeCompare(y.label))} values={ids} onChange={setIds} max={12} placeholder="All institutions" className="sm:col-span-2" />
      </FilterBar>

      <KpiGrid cols={5}>
        <KpiCard label="Improved" value={count('Improved')} hint="Better exact rank" />
        <KpiCard label="Declined" value={count('Declined')} hint="Worse exact rank" />
        <KpiCard label="Stable" value={count('Stable')} hint="Same exact rank" />
        <KpiCard label="New entrants" value={count('New entrant')} hint={`Not listed in ${start}`} />
        <KpiCard label="Exits" value={count('Exit')} hint={`Not listed in ${end}`} />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Start vs end rank" subtitle={`${start} → ${end}; steeper downward line = bigger improvement`} why="A slope graph: two ordered points joined by a line show change at a glance.">
          <SpecChart height={chartHeight} spec={{ type: 'line', title: `Rank slope ${start} → ${end} — ${category}`, xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, xTickValues: [start, end], endLabels: true, series: slope.map((r) => ({ name: r.name, x: [start, end], y: [r.a!.rank, r.b!.rank] })) }} emptyMessage="No institutions have exact ranks in both years." />
        </ChartCard>
        <ChartCard title="Improvement and decline" subtitle="Places gained (+) or lost (−); blue = improved, orange = declined" why="Blue = improved, orange = declined: a pair that stays distinguishable for colour-blind readers (L6).">
          <SpecChart height={chartHeight} spec={{ type: 'bar', horizontal: true, sortDesc: true, showValues: true, title: `Rank change ${start} → ${end}`, xTitle: 'Institution', yTitle: 'Rank change (places)', series: [{
            name: 'Rank change',
            x: movers.map((r) => wrapLabel(r.name, 30)),
            y: movers.map((r) => r.change),
            colors: movers.map((r) => (r.change! > 0 ? IMPROVED_COLOR : DECLINED_COLOR)),
            text: movers.map((r) => (r.change! > 0 ? `+${r.change}` : String(r.change))),
          }] }} emptyMessage="No rank changes to show." />
        </ChartCard>
      </div>

      <ChartCard title="Rank transitions" subtitle="Flow of institutions between rank groups" footer="“Not listed” means absent that year.">
        <PlotChart title="Rank transitions" data={[sankey]} height={420} empty={rows.length === 0} layout={{ margin: { l: 8, r: 8, t: 8, b: 8 } }} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard className="min-w-0" title="Transition table" subtitle="Count of institutions by start group (rows) and end group (columns)">
          <div className="rounded-md border border-line">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="border-b border-line px-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">{start} \ {end}</th>
                  {BUCKETS.map((b) => (
                    <th key={b} scope="col" className="border-b border-line px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.from} className="border-b border-line last:border-0">
                    <th scope="row" className="px-1.5 py-1.5 text-left font-normal text-ink">{row.from}</th>
                    {row.cells.map((n, i) => (
                      <td key={BUCKETS[i]} className="px-1.5 py-1.5 text-right tabular-nums text-ink">{n}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard className="min-w-0" title="Institution movement" subtitle="Exact ranks only">
          <DataTable<Row>
            dense
            pageSize={8}
            rows={rows}
            rowKey={(r) => r.id}
            initialSort={{ key: 'change', dir: 'desc' }}
            columns={[
              { key: 'name', header: 'Institution', sortable: true, sortValue: (r) => r.name, render: (r) => <InstitutionLink id={r.id}>{r.name}</InstitutionLink> },
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
