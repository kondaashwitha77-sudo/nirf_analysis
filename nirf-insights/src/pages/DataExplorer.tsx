import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable } from '../components/ui/DataTable'
import type { Column } from '../components/ui/DataTable'
import { FilterBar, MultiSelect, SearchInput, SelectFilter } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { ParamCell, RankCell } from '../components/ui/RecordCells'
import { SectionCard } from '../components/ui/SectionCard'
import { PARAMS } from '../data/mock/constants'
import { INSTITUTION_OPTIONS, RECORDS, STATE_OPTIONS } from '../data/mock/rankings'
import { categoryOptions, yearOptions } from '../data/selectors'
import { downloadCsv, fmt } from '../lib/format'
import type { RankingRecord } from '../types'

const RANK_FILTERS = [
  { value: 'top10', label: 'Exact rank ≤ 10' },
  { value: 'top25', label: 'Exact rank ≤ 25' },
  { value: 'top50', label: 'Exact rank ≤ 50' },
  { value: 'exact', label: 'Exact ranks only' },
  { value: 'band', label: 'Rank bands only' },
  { value: 'unavailable', label: 'Rank unavailable' },
]

const columns: Column<RankingRecord>[] = [
  { key: 'year', header: 'Year', sortable: true, sortValue: (r) => r.year, render: (r) => r.year },
  { key: 'category', header: 'Category', sortable: true, sortValue: (r) => r.category, render: (r) => r.category },
  { key: 'institution', header: 'Institution', sortable: true, sortValue: (r) => r.institution, render: (r) => <span className="font-medium">{r.institution}</span>, className: 'min-w-[260px]' },
  { key: 'city', header: 'City', sortable: true, sortValue: (r) => r.city, render: (r) => r.city },
  { key: 'state', header: 'State', sortable: true, sortValue: (r) => r.state, render: (r) => r.state },
  { key: 'rank', header: 'Rank', align: 'right', sortable: true, sortValue: (r) => (r.rankType === 'exact' ? r.rank : null), render: (r) => (r.rankType === 'exact' ? <RankCell record={r} /> : <RankCell record={{ ...r, rankBand: null, rankType: r.rankType === 'band' ? 'unavailable' : r.rankType }} />) },
  { key: 'band', header: 'Rank band', align: 'right', render: (r) => (r.rankBand ? <span className="tabular-nums">{r.rankBand}</span> : <span className="text-slate-300">—</span>) },
  { key: 'score', header: 'Score', align: 'right', sortable: true, sortValue: (r) => r.score, render: (r) => (r.score === null ? <span className="text-xs italic text-slate-400">Missing</span> : fmt(r.score)) },
  ...PARAMS.map((p): Column<RankingRecord> => ({ key: p.key, header: p.label, align: 'right', sortable: true, sortValue: (r) => r.params[p.key], render: (r) => <ParamCell record={r} param={p.key} /> })),
]

export default function DataExplorer() {
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState('')
  const [state, setState] = useState('')
  const [rankFilter, setRankFilter] = useState('')
  const [ids, setIds] = useState<string[]>([])

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return RECORDS.filter((r) => {
      if (category && r.category !== category) return false
      if (year && r.year !== Number(year)) return false
      if (state && r.state !== state) return false
      if (ids.length && !ids.includes(r.institutionId)) return false
      if (s && !`${r.institution} ${r.city} ${r.state}`.toLowerCase().includes(s)) return false
      switch (rankFilter) {
        case 'top10': return r.rankType === 'exact' && (r.rank ?? 999) <= 10
        case 'top25': return r.rankType === 'exact' && (r.rank ?? 999) <= 25
        case 'top50': return r.rankType === 'exact' && (r.rank ?? 999) <= 50
        case 'exact': return r.rankType === 'exact'
        case 'band': return r.rankType === 'band'
        case 'unavailable': return r.rankType === 'unavailable'
        default: return true
      }
    })
  }, [search, category, year, state, rankFilter, ids])

  const reset = () => { setSearch(''); setCategory(''); setYear(''); setState(''); setRankFilter(''); setIds([]) }

  const exportCsv = () =>
    downloadCsv(
      'nirf-insights-demo-records.csv',
      [
        { key: 'year', header: 'Year' }, { key: 'category', header: 'Category' }, { key: 'institution', header: 'Institution' },
        { key: 'city', header: 'City' }, { key: 'state', header: 'State' }, { key: 'rank', header: 'Rank' }, { key: 'rankBand', header: 'Rank Band' },
        { key: 'score', header: 'Score' }, ...PARAMS.map((p) => ({ key: p.key, header: p.label })),
      ],
      rows.map((r) => ({ year: r.year, category: r.category, institution: r.institution, city: r.city, state: r.state, rank: r.rankType === 'exact' ? r.rank : null, rankBand: r.rankBand, score: r.score, ...r.params })),
    )

  return (
    <>
      <PageHeader title="Data Explorer" description="Browse the records behind every page. Unavailable values show the reason they are absent, never a zero." />

      <FilterBar onReset={reset}>
        <SearchInput label="Search" value={search} onChange={setSearch} placeholder="Institution, city, or state" className="sm:col-span-2" />
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} placeholder="All categories" />
        <SelectFilter label="Year" value={year} onChange={setYear} options={yearOptions} placeholder="All years" />
        <SelectFilter label="State" value={state} onChange={setState} options={STATE_OPTIONS.map((s) => ({ value: s, label: s }))} placeholder="All states" />
        <SelectFilter label="Rank filter" value={rankFilter} onChange={setRankFilter} options={RANK_FILTERS} placeholder="Any rank" />
        <MultiSelect label="Institution" options={INSTITUTION_OPTIONS} values={ids} onChange={setIds} max={10} placeholder="Any institution" className="sm:col-span-2" />
      </FilterBar>

      <SectionCard
        title={`${rows.length.toLocaleString('en-IN')} records`}
        subtitle="Scroll sideways on small screens to see all columns"
        actions={<button type="button" className="btn-secondary" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</button>}
      >
        <DataTable<RankingRecord>
          dense
          pageSize={15}
          pageSizeOptions={[15, 30, 50, 100]}
          rows={rows}
          rowKey={(r) => r.id}
          columns={columns}
          initialSort={{ key: 'year', dir: 'desc' }}
          emptyMessage="No records match these filters."
          caption="Ranking records"
        />
      </SectionCard>
    </>
  )
}
