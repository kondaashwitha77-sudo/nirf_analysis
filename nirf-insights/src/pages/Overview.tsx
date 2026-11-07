import { Building2, CalendarRange, Database, Layers, MapPin } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { NAV } from '../config/navigation'
import { buildOverview } from '../data/mock/overview'
import { YEARS } from '../data/mock/constants'
import { fmt, fmtInt } from '../lib/format'

export default function Overview() {
  const o = useMemo(buildOverview, [])
  const shortcuts = NAV.flatMap((s) => s.items).filter((i) => i.to !== '/overview')

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Institutional rankings across ${YEARS[0]}–${YEARS[YEARS.length - 1]}. Every number here comes from a generated demo dataset.`}
      />

      <KpiGrid cols={5}>
        <KpiCard label="Total institutions" value={fmtInt(o.kpis.institutions)} icon={Building2} hint="Unique across all years" />
        <KpiCard label="Ranking records" value={fmtInt(o.kpis.records)} icon={Database} hint="Category × year entries" />
        <KpiCard label="Years covered" value={o.kpis.years} icon={CalendarRange} hint={`${YEARS[0]}–${YEARS[YEARS.length - 1]}`} />
        <KpiCard label="Categories" value={o.kpis.categories} icon={Layers} />
        <KpiCard label="States represented" value={o.kpis.states} icon={MapPin} />
      </KpiGrid>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="NIRF overview" className="lg:col-span-1">
          <div className="space-y-2.5 text-sm leading-relaxed text-ink">
            <p>
              NIRF Insights is an analytics workspace for exploring national institutional rankings: trends, comparisons,
              regional spread, distributions, and rank movement.
            </p>
            <p className="text-muted">
              Lower rank numbers mean better performance. Where only a rank band is published (for example 101–150), the
              dashboard shows the band as a band and never as an exact rank.
            </p>
            <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
              The data behind this build is generated mock data. Institution names are fictional.
            </p>
          </div>
        </SectionCard>

        <SectionCard title={`Latest-year summary — ${o.latest.year}`} className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              ['Records', fmtInt(o.latest.records)],
              ['Institutions listed', fmtInt(o.latest.institutions)],
              ['Median Overall score', fmt(o.latest.medianOverallScore)],
              ['Leading state (Overall)', o.latest.topState],
              ['Records with rank bands', fmtInt(o.latest.bandRecords)],
              ['Data status', 'Demo / Mock'],
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
        <ChartCard title="Category distribution" subtitle={`Records per category in ${o.latest.year}`}>
          <SpecChart
            height={320}
            spec={{
              type: 'bar',
              title: `Records per category, ${o.latest.year}`,
              xTitle: 'Category',
              yTitle: 'Records',
              series: [{ name: 'Records', x: o.categoryDistribution.map((c) => c.category), y: o.categoryDistribution.map((c) => c.count) }],
            }}
          />
        </ChartCard>
        <ChartCard title="Year-wise institution participation" subtitle="Unique institutions listed each year">
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

      <SectionCard title={`Top institutions — Overall, ${o.latest.year}`} subtitle="Demo institutions; fictional names">
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
                className="group flex items-start gap-3 rounded-md border border-line p-3 transition hover:border-accent hover:bg-blue-50/40"
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
