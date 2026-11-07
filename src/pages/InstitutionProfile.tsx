import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChartCard } from '../components/charts/ChartCard'
import { COLORWAY } from '../components/charts/PlotChart'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { SelectFilter } from '../components/ui/filters'
import { HowToRead } from '../components/ui/HowToRead'
import { InstitutionLink } from '../components/ui/InstitutionLink'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { ParamCell, RankCell } from '../components/ui/RecordCells'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState } from '../components/ui/States'
import { StatusBadge } from '../components/ui/StatusBadge'
import { CATEGORIES, PARAMS, YEARS } from '../data/mock/constants'
import { selectRecords } from '../data/selectors'
import { downloadCsv, fmt } from '../lib/format'
import { median } from '../lib/mockMath'
import type { RankingRecord } from '../types'

const TEAL = COLORWAY[0]
const MEDIAN_COLOR = COLORWAY[6]

const medianOf = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? Math.round(median(present) * 100) / 100 : null
}

/** Every year from the first to the last listed, so a gap in listing breaks the line. */
const yearSpan = (years: number[]) => YEARS.filter((y) => y >= years[0] && y <= years[years.length - 1])

const places = (n: number) => `${n} place${n === 1 ? '' : 's'}`

/** Records of a category-year in rank order; ties fall back to score, then name. */
const rankOrder = (a: RankingRecord, b: RankingRecord) =>
  (a.rank as number) - (b.rank as number) || (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.institution.localeCompare(b.institution)

export default function InstitutionProfile() {
  const { id = '' } = useParams()
  const records = useMemo(() => selectRecords({ institutionIds: [id] }), [id])
  if (!records.length) {
    return (
      <EmptyState
        title="No such institution"
        message="This link does not match any institution in the data."
        action={<Link to="/overview" className="btn-secondary mt-1">Go to Overview</Link>}
      />
    )
  }
  // The key resets the category selector when moving from one profile to another.
  return <Profile key={id} id={id} records={records} />
}

function Profile({ id, records }: { id: string; records: RankingRecord[] }) {
  const latestYear = Math.max(...records.map((r) => r.year))
  const newest = records.find((r) => r.year === latestYear) as RankingRecord
  const categories = CATEGORIES.filter((c) => records.some((r) => r.category === c))
  const [category, setCategory] = useState(() => categories.find((c) => records.some((r) => r.category === c && r.year === latestYear)) ?? categories[0])

  const rows = useMemo(() => records.filter((r) => r.category === category).sort((a, b) => a.year - b.year), [records, category])
  const everyone = useMemo(() => selectRecords({ category }), [category])

  const latest = rows[rows.length - 1]
  const ranked = rows.filter((r): r is RankingRecord & { rank: number } => r.rankType === 'exact' && r.rank !== null)
  const bestRank = ranked.length ? Math.min(...ranked.map((r) => r.rank)) : null
  const bestYears = ranked.filter((r) => r.rank === bestRank).map((r) => r.year)
  const firstRanked = ranked[0]
  const lastRanked = ranked[ranked.length - 1]
  const rankChange = ranked.length > 1 ? firstRanked.rank - lastRanked.rank : null
  const categoryYears = new Set(everyone.map((r) => r.year)).size

  const years = rows.map((r) => r.year)
  const span = yearSpan(years)
  const byYear = new Map(rows.map((r) => [r.year, r]))
  const latestPool = everyone.filter((r) => r.year === latest.year)

  const parameters = PARAMS.map((p) => ({
    ...p,
    value: latest.params[p.key],
    med: medianOf(latestPool.map((r) => r.params[p.key])),
  }))
  const published = parameters.filter((p): p is typeof p & { value: number } => p.value !== null).sort((a, b) => b.value - a.value)
  const notPublished = parameters.filter((p) => p.value === null).map((p) => p.label)

  const peerList = latestPool.filter((r) => r.rankType === 'exact' && r.rank !== null).sort(rankOrder)
  const me = peerList.findIndex((r) => r.institutionId === id)
  const peers = me < 0 ? [] : peerList.slice(Math.max(0, me - 3), me + 4)

  const highlights = buildHighlights(category, rows, ranked, bestRank, bestYears, published)

  const exportCsv = () =>
    downloadCsv(
      `${newest.institution.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      [
        { key: 'year', header: 'Year' }, { key: 'category', header: 'Category' }, { key: 'rank', header: 'Rank' }, { key: 'score', header: 'Overall score' },
        ...PARAMS.map((p) => ({ key: p.key, header: p.label })),
      ],
      rows.map((r) => ({ year: r.year, category: r.category, rank: r.rank, score: r.score, ...r.params })),
    )

  return (
    <>
      <PageHeader title={newest.institution} description={[`${newest.city}, ${newest.state}`, newest.zone].filter(Boolean).join(' · ')} />

      <HowToRead>Lower rank numbers are better. The dashed line is the category median. Bars start at zero.</HowToRead>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-card border border-line bg-white p-3 shadow-card">
        <div className="flex min-w-0 flex-wrap gap-x-8 gap-y-2">
          {newest.institutionType && (
            <div>
              <p className="field-label">Type</p>
              <StatusBadge variant="info">{newest.institutionType}</StatusBadge>
            </div>
          )}
          <div className="min-w-0">
            <p className="field-label">Listed in</p>
            <p className="text-sm text-ink">{categories.join(', ')}</p>
          </div>
        </div>
        {categories.length > 1 && (
          <SelectFilter label="Category" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} className="w-full sm:w-64" />
        )}
      </div>

      <KpiGrid cols={5}>
        <KpiCard label="Latest rank" value={latest.rank ?? '—'} hint={`${category}, ${latest.year}`} />
        <KpiCard label="Best rank ever" value={bestRank ?? '—'} hint={bestYears.length ? `In ${bestYears.join(', ')}` : 'No exact rank'} />
        <KpiCard label="Years listed" value={`${rows.length} of ${YEARS.length}`} hint={categoryYears < YEARS.length ? `${category} was ranked in ${categoryYears} of them` : `First listed ${years[0]}`} />
        <KpiCard label="Rank change" value={rankChange === null ? '—' : rankChange > 0 ? `+${rankChange}` : rankChange} hint={rankChange === null ? 'Needs two ranked years' : `${firstRanked.year} to ${lastRanked.year}; + = improved`} />
        <KpiCard label="Latest overall score" value={fmt(latest.score)} hint={String(latest.year)} />
      </KpiGrid>

      <SectionCard title="Highlights" subtitle={category}>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
          {highlights.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard className="min-w-0" title="Rank over time" subtitle={`${category}; exact ranks only`} why="Rank is ordinal, so a line with rank 1 at the top shows movement over time.">
          <SpecChart
            height={320}
            emptyMessage="No exact rank was published for this category."
            spec={{ type: 'line', title: `Rank over time — ${newest.institution}`, xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, rankAxis: true, xTickValues: years, series: [{ name: 'Rank', color: TEAL, x: ranked.length ? span : [], y: ranked.length ? span.map((y) => byYear.get(y)?.rank ?? null) : [] }] }}
          />
        </ChartCard>
        <ChartCard className="min-w-0" title="Overall score over time" subtitle={`Compared with the median of all ${category} institutions each year`} why="The dashed median gives each score a reference point, so a rise can be read against the field.">
          <SpecChart
            height={320}
            spec={{ type: 'line', title: `Overall score over time — ${newest.institution}`, xTitle: 'Year', yTitle: 'Overall score', xTickValues: years, series: [
              { name: newest.institution, color: TEAL, x: span, y: span.map((y) => byYear.get(y)?.score ?? null) },
              { name: 'Category median', color: MEDIAN_COLOR, dash: true, x: span, y: span.map((y) => medianOf(everyone.filter((r) => r.year === y).map((r) => r.score))) },
            ] }}
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          className="min-w-0"
          title="What the score is made of"
          subtitle={`${category}, ${latest.year}; largest first, with the category median`}
          why="Sorted horizontal bars from zero make the parameters easy to compare; the grey bar shows above or below median."
          footer={
            <>
              {notPublished.length > 0 && published.length > 0 && <p>Not published in {latest.year}: {notPublished.join(', ')}.</p>}
              <p>{PARAMS.map((p) => `${p.label}: ${p.full}`).join('; ')}.</p>
            </>
          }
        >
          {published.length ? (
            <SpecChart
              height={340}
              spec={{ type: 'bar', horizontal: true, title: `Parameter scores, ${latest.year}`, xTitle: 'Parameter', yTitle: 'Score', series: [
                { name: newest.institution, color: TEAL, x: published.map((p) => p.label), y: published.map((p) => p.value) },
                { name: 'Category median', color: MEDIAN_COLOR, x: published.map((p) => p.label), y: published.map((p) => p.med) },
              ] }}
            />
          ) : (
            <EmptyState title="Parameters not published" message={`No parameter scores were published for ${category} in ${latest.year}.`} />
          )}
        </ChartCard>

        <SectionCard
          className="min-w-0"
          title="Peers"
          subtitle={`Ranked just above and just below in ${category}, ${latest.year}`}
          actions={<Link to="/institution-comparison" className="btn-secondary">Compare with…</Link>}
        >
          {peers.length ? (
            <DataTable<RankingRecord>
              dense
              pageSize={7}
              rows={peers}
              rowKey={(r) => r.id}
              columns={[
                { key: 'rank', header: 'Rank', align: 'right', render: (r) => <RankCell record={r} /> },
                { key: 'name', header: 'Institution', render: (r) => (r.institutionId === id ? <span className="font-semibold">{r.institution} (this institution)</span> : <InstitutionLink id={r.institutionId}>{r.institution}</InstitutionLink>) },
                { key: 'state', header: 'State', render: (r) => r.state },
                { key: 'score', header: 'Score', align: 'right', render: (r) => fmt(r.score) },
              ]}
            />
          ) : (
            <EmptyState title="No peers to show" message={`This institution has no exact rank in ${category} for ${latest.year}.`} />
          )}
        </SectionCard>
      </div>

      <ChartCard title="Parameters over time" subtitle={`${category}; every chart uses the same 0–100 scale`} why="Small multiples on one shared scale let you compare the shape of each parameter without crowding one chart.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PARAMS.map((p) => {
            const withValues = rows.filter((r) => r.params[p.key] !== null).map((r) => r.year)
            const pSpan = withValues.length ? yearSpan(withValues) : []
            return (
              <div key={p.key} className="min-w-0">
                <p className="text-xs font-semibold text-ink" title={p.full}>{p.label}</p>
                {withValues.length ? (
                  <SpecChart
                    height={190}
                    spec={{ type: 'line', title: `${p.label} over time`, yRange: [0, 100], xTickValues: [...new Set([withValues[0], withValues[withValues.length - 1]])], series: [{ name: p.label, color: TEAL, x: pSpan, y: pSpan.map((y) => byYear.get(y)?.params[p.key] ?? null) }] }}
                  />
                ) : (
                  <p className="flex h-[190px] items-center justify-center text-center text-xs text-muted">Not published for {category}</p>
                )}
              </div>
            )
          })}
        </div>
      </ChartCard>

      <SectionCard
        title="Year-by-year records"
        subtitle={category}
        actions={<button type="button" className="btn-secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</button>}
      >
        <DataTable<RankingRecord>
          dense
          pageSize={10}
          rows={rows}
          rowKey={(r) => r.id}
          initialSort={{ key: 'year', dir: 'desc' }}
          columns={[
            { key: 'year', header: 'Year', sortable: true, sortValue: (r) => r.year, render: (r) => r.year },
            { key: 'category', header: 'Category', render: (r) => r.category },
            { key: 'rank', header: 'Rank', align: 'right', sortable: true, sortValue: (r) => r.rank, render: (r) => <RankCell record={r} /> },
            { key: 'score', header: 'Overall score', align: 'right', sortable: true, sortValue: (r) => r.score, render: (r) => fmt(r.score) },
            ...PARAMS.map((p) => ({ key: p.key, header: p.label, align: 'right' as const, render: (r: RankingRecord) => <ParamCell record={r} param={p.key} /> })),
          ]}
        />
      </SectionCard>
    </>
  )
}

/** Plain sentences computed from the data; a sentence is skipped when its data is missing. */
function buildHighlights(
  category: string,
  rows: RankingRecord[],
  ranked: (RankingRecord & { rank: number })[],
  bestRank: number | null,
  bestYears: number[],
  published: { label: string; value: number; med: number | null }[],
): string[] {
  const out: string[] = []
  const latest = rows[rows.length - 1]
  if (bestRank !== null) out.push(`Its best ${category} rank is ${bestRank}, reached in ${bestYears.join(', ')}.`)

  const moves = ranked.slice(1).map((r, i) => ({ from: ranked[i], to: r })).filter((m) => m.to.year - m.from.year === 1 && m.from.rank !== m.to.rank)
  if (moves.length) {
    const big = moves.reduce((a, b) => (Math.abs(b.from.rank - b.to.rank) > Math.abs(a.from.rank - a.to.rank) ? b : a))
    const change = big.from.rank - big.to.rank
    out.push(`Its biggest one-year move was ${change > 0 ? 'a rise' : 'a fall'} of ${places(Math.abs(change))}, from rank ${big.from.rank} in ${big.from.year} to rank ${big.to.rank} in ${big.to.year}.`)
  }

  const gaps = published.filter((p): p is typeof p & { med: number } => p.med !== null).map((p) => ({ label: p.label, gap: p.value - p.med })).sort((a, b) => b.gap - a.gap)
  if (gaps.length > 1) {
    const say = (g: number) => (g === 0 ? 'level with the median' : `${Math.abs(g).toFixed(1)} points ${g > 0 ? 'above' : 'below'} the median`)
    const top = gaps[0]
    const low = gaps[gaps.length - 1]
    out.push(`In ${latest.year}, its strongest parameter against the ${category} median was ${top.label} (${say(top.gap)}) and its weakest was ${low.label} (${say(low.gap)}).`)
  }

  out.push(`It has been listed in ${category} in ${rows.length} of the ${YEARS.length} years in this data (${rows[0].year === latest.year ? latest.year : `${rows[0].year}–${latest.year}`}).`)
  return out
}
