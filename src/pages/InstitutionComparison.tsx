import { useEffect, useMemo, useState } from 'react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { FilterBar, MultiSelect, SelectFilter, YearRangeSelector } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { ParamCell, RankCell } from '../components/ui/RecordCells'
import { EmptyState } from '../components/ui/States'
import { SectionCard } from '../components/ui/SectionCard'
import { useGlobalFilters } from '../context/GlobalFilters'
import { LATEST_YEAR, PARAMS, PARAM_KEYS, YEARS } from '../data/mock/constants'
import { categoryOptions, selectRecords, topRecords, yearOptions, yearsBetween } from '../data/selectors'
import { fmt } from '../lib/format'
import type { RankingRecord } from '../types'

const MAX = 6

export default function InstitutionComparison() {
  const { category, setCategory, year, setYear } = useGlobalFilters()
  const [ids, setIds] = useState<string[]>([])
  const [range, setRange] = useState<[number, number]>([YEARS[0], LATEST_YEAR])

  // Default selection: leaders of the chosen category.
  useEffect(() => {
    setIds(topRecords(category, LATEST_YEAR, 4).map((r) => r.institutionId))
  }, [category])

  const options = useMemo(() => {
    const m = new Map<string, string>()
    selectRecords({ category }).forEach((r) => m.set(r.institutionId, r.institution))
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [category])

  const names = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options])
  const yearRecords = useMemo(() => {
    const m = new Map<string, RankingRecord>()
    selectRecords({ category, year, institutionIds: ids }).forEach((r) => m.set(r.institutionId, r))
    return m
  }, [category, year, ids])
  const listed = ids.map((id) => yearRecords.get(id)).filter((r): r is RankingRecord => !!r)
  const notListed = ids.filter((id) => !yearRecords.has(id))
  const years = yearsBetween(range[0], range[1])
  const trend = useMemo(() => selectRecords({ category, yearRange: range, institutionIds: ids }), [category, range, ids])

  return (
    <>
      <PageHeader title="Institution Comparison" description="Pick up to six institutions and compare them in a chosen year. Parameters that were not published show as “Not published” rather than a number." />

      <FilterBar onReset={() => { setCategory('Overall'); setYear(LATEST_YEAR); setRange([YEARS[0], LATEST_YEAR]) }}>
        <SelectFilter label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <SelectFilter label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOptions} />
        <MultiSelect label={`Institutions (max ${MAX})`} options={options} values={ids} onChange={setIds} max={MAX} placeholder="Search and select…" className="sm:col-span-2" />
        <YearRangeSelector label="Trend range" start={range[0]} end={range[1]} onChange={(s, e) => setRange([s, e])} />
      </FilterBar>

      {ids.length === 0 ? (
        <SectionCard><EmptyState title="No institutions selected" message="Choose at least two institutions to compare." /></SectionCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ids.map((id) => {
              const r = yearRecords.get(id)
              return (
                <div key={id} className="rounded-card border border-line bg-white p-4 shadow-card">
                  <p className="text-sm font-semibold leading-snug text-ink">{names.get(id) ?? id}</p>
                  {r ? (
                    <>
                      <p className="mt-0.5 text-xs text-muted">{r.city}, {r.state}</p>
                      <div className="mt-3 flex items-end gap-6">
                        <div><p className="field-label">Rank {year}</p><p className="text-xl font-bold text-navy"><RankCell record={r} /></p></div>
                        <div><p className="field-label">Score</p><p className="text-xl font-bold text-navy tabular-nums">{fmt(r.score)}</p></div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm italic text-slate-400">Not listed in {category} for {year}</p>
                  )}
                </div>
              )
            })}
          </div>

          {listed.length === 0 ? (
            <SectionCard><EmptyState message={`None of the selected institutions are listed in ${category} for ${year}.`} /></SectionCard>
          ) : (
            <>
              {notListed.length > 0 && (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-muted">
                  Not listed in {year}: {notListed.map((i) => names.get(i)).join('; ')}. They are left out of the charts below.
                </p>
              )}
              <div className="grid gap-5 lg:grid-cols-2">
                <ChartCard title="Rank comparison" subtitle="Exact ranks only; further left = better" footer="Institutions without an exact rank show no dot." why="Dot plot: position on a shared scale is the most accurate comparison (L7).">
                  <SpecChart height={Math.max(220, 80 + listed.length * 40)} spec={{ type: 'dot', horizontal: true, title: `Rank, ${year}`, xTitle: 'Institution', yTitle: 'Rank (1 = best)', series: [{ name: 'Rank', x: [...listed].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).map((r) => r.institution), y: [...listed].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)).map((r) => r.rank) }] }} />
                </ChartCard>
                <ChartCard title="Score comparison" subtitle="Overall score, highest first" why="Same scale and order as the rank chart so the two read together.">
                  <SpecChart height={Math.max(220, 80 + listed.length * 40)} spec={{ type: 'dot', horizontal: true, sortDesc: true, title: `Overall score, ${year}`, xTitle: 'Institution', yTitle: 'Overall score', series: [{ name: 'Score', x: listed.map((r) => r.institution), y: listed.map((r) => r.score) }] }} />
                </ChartCard>
              </div>

              <ChartCard title="Parameter comparison" subtitle="Missing bars mean the parameter was not published or does not apply">
                <SpecChart height={340} spec={{ type: 'bar', title: `Parameter scores, ${year}`, xTitle: 'Parameter', yTitle: 'Score', series: listed.map((r) => ({ name: r.institution, x: PARAM_KEYS as string[], y: PARAM_KEYS.map((p) => r.params[p]) })) }} />
              </ChartCard>

              <ChartCard title="Score trend" subtitle={`${range[0]}–${range[1]}`}>
                <SpecChart height={300} spec={{ type: 'line', title: 'Overall score over time', xTitle: 'Year', yTitle: 'Overall score', series: ids.map((id) => ({ name: names.get(id) ?? id, x: years, y: years.map((y) => trend.find((r) => r.institutionId === id && r.year === y)?.score ?? null) })) }} />
              </ChartCard>

              <SectionCard title="Comparison table" subtitle={`${category}, ${year}`}>
                <DataTable<RankingRecord>
                  dense
                  pageSize={10}
                  rows={listed}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: 'inst', header: 'Institution', render: (r) => r.institution },
                    { key: 'rank', header: 'Rank', align: 'right', render: (r) => <RankCell record={r} /> },
                    { key: 'score', header: 'Score', align: 'right', render: (r) => fmt(r.score) },
                    ...PARAMS.map((p) => ({ key: p.key, header: p.label, align: 'right' as const, render: (r: RankingRecord) => <ParamCell record={r} param={p.key} /> })),
                  ]}
                />
              </SectionCard>
            </>
          )}
        </>
      )}
    </>
  )
}
