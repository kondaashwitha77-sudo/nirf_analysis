import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { Hero } from '../components/ui/Hero'
import { HeroStatePanel } from '../components/ui/HeroStatePanel'
import { HowToRead } from '../components/ui/HowToRead'
import { InstitutionSearch } from '../components/ui/InstitutionSearch'
import { RankCard } from '../components/ui/RankCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useGlobalFilters } from '../context/GlobalFilters'
import { SectionCard } from '../components/ui/SectionCard'
import { NAV } from '../config/navigation'
import { buildOverview } from '../data/mock/overview'
import { CATEGORIES, YEARS } from '../data/mock/constants'
import { selectRecords } from '../data/selectors'
import { fmt, fmtInt } from '../lib/format'
import { USE_MOCK } from '../services/apiClient'

export default function Overview() {
  const o = useMemo(buildOverview, [])
  const navigate = useNavigate()
  const { year, category, setCategory } = useGlobalFilters()
  const shortcuts = NAV.flatMap((s) => s.items).filter((i) => i.to !== '/overview')
  const top5 = useMemo(() => {
    const byState = new Map<string, Set<string>>()
    selectRecords({ year, category }).forEach((r) => {
      if (r.state !== 'Unknown') byState.set(r.state, (byState.get(r.state) ?? new Set<string>()).add(r.institutionId))
    })
    return [...byState.entries()]
      .map(([state, ids]) => ({ state, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
      .slice(0, 5)
  }, [year, category])

  return (
    <>
      <Hero
        badge={`Rankings ${YEARS[0]}–${YEARS[YEARS.length - 1]}`}
        title="Explore how India's institutions"
        highlight="rise, slip and compete"
        description="Trends, comparisons, regional spread and rank movement across every NIRF category. Lower rank numbers mean better performance."
        chips={[
          { label: 'Ranking trends', to: '/ranking-trends' },
          { label: 'Compare institutions', to: '/institution-comparison' },
          { label: 'Rank mobility', to: '/rank-mobility' },
          { label: 'Geographic view', to: '/geographic-analysis' },
        ]}
        search={<InstitutionSearch variant="hero" placeholder="Search an institution, e.g. IIT Madras" />}
        aside={<HeroStatePanel rows={top5} category={category} year={year} />}
      />

      <HowToRead>
        Rank 1 is best. Start with the leaderboard, then use the category chips or the left menu to explore trends,
        compare institutions or see where the strong institutions are.
      </HowToRead>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Browse by category</span>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategory(c)
              navigate('/ranking-trends')
            }}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-accent hover:bg-teal-50 hover:text-deep"
          >
            {c}
          </button>
        ))}
        <StatusBadge variant="mock" />
      </div>

      <section aria-label="Leaderboard">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Leaderboard — Overall, {o.latest.year}</h2>
          <Link to="/data-explorer" className="text-xs font-medium text-accent hover:underline">
            See all records
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {o.topInstitutions.slice(0, 6).map((r) => (
            <RankCard key={r.institution} id={r.id} rank={r.rank} name={r.institution} city={r.city} state={r.state} score={r.score} />
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="NIRF overview" className="lg:col-span-1">
          <div className="space-y-2.5 text-sm leading-relaxed text-ink">
            <p>
              NIRF Insights is an analytics workspace for exploring national institutional rankings: trends, comparisons,
              regional spread, distributions, and rank movement.
            </p>
            <p className="text-muted">
              Lower rank numbers mean better performance.
            </p>
            {USE_MOCK ? (
              <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
                The data behind this build is generated mock data. Institution names are fictional.
              </p>
            ) : (
              <p className="rounded-md bg-teal-50 p-2.5 text-xs text-deep">
                Real NIRF data, 2017–2025. Only institutions with an exact NIRF rank are included (the top 50 or top 100 in most
                categories, depending on the year and category). Institutions that NIRF lists only in a rank band such as 101–150
                are not part of this data, so College, Pharmacy and Law lists cover only their exact-ranked institutions.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title={`Latest-year summary — ${o.latest.year}`} className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ['Records', fmtInt(o.latest.records)],
              ['Institutions listed', fmtInt(o.latest.institutions)],
              ['Median Overall score', fmt(o.latest.medianOverallScore)],
              ['Leading state (Overall)', o.latest.topState],
              ['Data status', USE_MOCK ? 'Demo / Mock' : 'Real NIRF data'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                <dd className="mt-0.5 text-lg font-bold text-navy">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Category distribution"
          subtitle={`Records per category in ${o.latest.year}, largest first`}
          why="Sorted horizontal bars: position along a common baseline is the easiest comparison, and long names stay readable (L6, L7)."
        >
          <SpecChart
            height={380}
            spec={{
              type: 'bar',
              horizontal: true,
              sortDesc: true,
              showValues: true,
              title: `Records per category, ${o.latest.year}`,
              xTitle: 'Category',
              yTitle: 'Records',
              series: [{ name: 'Records', x: o.categoryDistribution.map((c) => c.category), y: o.categoryDistribution.map((c) => c.count) }],
            }}
          />
        </ChartCard>
        <ChartCard title="Year-wise institution participation" subtitle="Unique institutions listed each year" why="A line connects ordered time points, so the eye follows the trend (L10).">
          <SpecChart
            height={320}
            spec={{
              type: 'line',
              title: 'Institutions listed per year',
              xTitle: 'Year',
              yTitle: 'Institutions',
              yFromZero: true,
              series: [{ name: 'Institutions', x: o.participation.map((p) => p.year), y: o.participation.map((p) => p.institutions) }],
            }}
          />
        </ChartCard>
      </div>

      <SectionCard title={`Top institutions — Overall, ${o.latest.year}`} subtitle={USE_MOCK ? 'Demo institutions; fictional names' : 'Exact published ranks only'}>
        <DataTable
          dense
          pageSize={10}
          rowKey={(r) => r.institution}
          rows={o.topInstitutions}
          columns={[
            { key: 'rank', header: 'Rank', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{r.rank ?? '—'}</span> },
            { key: 'institution', header: 'Institution', render: (r) => r.institution },
            { key: 'city', header: 'City', render: (r) => r.city },
            { key: 'state', header: 'State', render: (r) => r.state },
            { key: 'score', header: 'Score', align: 'right', render: (r) => fmt(r.score) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Quick analytics shortcuts">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shortcuts.map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-start gap-3 rounded-md border border-line p-3 transition hover:border-accent hover:bg-teal-50/60"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-ink group-hover:text-deep">{s.label}</span>
                  <span className="block text-xs text-muted">{s.description}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </SectionCard>
    </>
  )
}
