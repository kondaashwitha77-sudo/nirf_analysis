import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { ChartCard } from '../components/charts/ChartCard'
import { SpecChart } from '../components/charts/SpecChart'
import { DataTable } from '../components/ui/DataTable'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { ErrorState, LoadingState } from '../components/ui/States'
import { StatusBadge } from '../components/ui/StatusBadge'
import { YEARS } from '../data/mock/constants'
import { useAsync } from '../hooks/useAsync'
import { REASON_LABEL, fmtInt } from '../lib/format'
import { getDataQuality } from '../services'

export default function DataQuality() {
  const { data, loading, error, reload } = useAsync(getDataQuality, [])

  if (loading && !data) return <><PageHeader title="Data Quality" /><LoadingState label="Checking data quality…" className="py-24" /></>
  if (error || !data) return <><PageHeader title="Data Quality" /><ErrorState message={error ?? 'No report available.'} onRetry={reload} /></>

  const t = data.totals
  const warnings = data.validation.filter((v) => v.status !== 'pass')

  return (
    <>
      <PageHeader title="Data Quality" description="What is present, what is absent, and why. Each kind of absence is tracked separately so none of it is mistaken for a real value." />

      <KpiGrid cols={6}>
        <KpiCard label="Total records" value={fmtInt(t.records)} />
        <KpiCard label="Institutions" value={fmtInt(t.institutions)} />
        <KpiCard label="Categories" value={t.categories} />
        <KpiCard label="Years" value={t.years} />
        <KpiCard label="Missing values" value={fmtInt(t.missingValues)} tone="warn" hint="All reasons combined" />
        <KpiCard label="Duplicate candidates" value={t.duplicateCandidates} tone={t.duplicateCandidates ? 'warn' : 'default'} hint={`${t.invalidRecords} records with invalid values`} />
      </KpiGrid>

      {warnings.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {warnings.map((w) => (
            <div key={w.check} className={`flex gap-3 rounded-card border p-4 ${w.status === 'fail' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              {w.status === 'fail' ? <XCircle className="h-5 w-5 shrink-0 text-red-600" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />}
              <div>
                <p className="text-sm font-semibold text-ink">{w.check}</p>
                <p className="mt-0.5 text-xs text-slate-700">{w.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionCard title="Kinds of absence" subtitle="Each category is tracked and reported separately">
        <DataTable
          dense
          pageSize={10}
          rows={data.issues}
          rowKey={(r) => r.type}
          columns={[
            { key: 'type', header: 'Type', render: (r) => <StatusBadge variant={r.type} /> },
            { key: 'count', header: 'Count', align: 'right', sortable: true, sortValue: (r) => r.count, render: (r) => fmtInt(r.count) },
            { key: 'desc', header: 'What it means', render: (r) => r.description },
          ]}
        />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Category and year coverage" subtitle="Records per category and year">
          <SpecChart height={380} spec={{ type: 'heatmap', title: 'Records per category and year', xTitle: 'Year', yTitle: 'Category', series: [{ name: 'Records', x: YEARS, yLabels: data.coverage.map((c) => c.category), z: data.coverage.map((c) => YEARS.map((y) => c.byYear[y] ?? 0)) }] }} />
        </ChartCard>
        <ChartCard title="Parameter availability" subtitle="Share of records with a value (%)" footer="Low cells usually reflect parameters that were not published or do not apply, not parser faults.">
          <SpecChart height={380} spec={{ type: 'heatmap', title: 'Parameter availability by year (%)', xTitle: 'Year', yTitle: 'Parameter', series: [{ name: '% available', x: YEARS, yLabels: data.parameterAvailability.map((p) => p.parameter), z: data.parameterAvailability.map((p) => YEARS.map((y) => p.byYear[y] ?? null)) }] }} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Source coverage">
          <DataTable dense pageSize={10} rows={data.sources} rowKey={(r) => r.source} columns={[
            { key: 's', header: 'Source', render: (r) => r.source },
            { key: 'y', header: 'Years', render: (r) => r.years },
            { key: 'n', header: 'Records', align: 'right', render: (r) => fmtInt(r.records) },
            { key: 'st', header: 'Status', render: (r) => <StatusBadge variant={r.status} /> },
          ]} />
        </SectionCard>
        <SectionCard title="Validation status">
          <ul className="divide-y divide-line">
            {data.validation.map((v) => (
              <li key={v.check} className="flex items-start gap-3 py-2.5">
                {v.status === 'pass' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : v.status === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{v.check}</p>
                  <p className="text-xs text-muted">{v.detail}</p>
                </div>
                <StatusBadge variant={v.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Duplicate candidates" subtitle="Flagged for manual review; none have been removed">
        <DataTable dense pageSize={8} rows={data.duplicates} rowKey={(r) => `${r.year}-${r.category}-${r.institution}`} emptyMessage="No duplicate candidates." columns={[
          { key: 'year', header: 'Year', render: (r) => r.year },
          { key: 'cat', header: 'Category', render: (r) => r.category },
          { key: 'inst', header: 'Institution', render: (r) => r.institution },
          { key: 'm', header: 'Matches', align: 'right', render: (r) => r.matches },
          { key: 'b', header: 'Flag', render: () => <StatusBadge variant="duplicate_candidate">{REASON_LABEL.duplicate_candidate}</StatusBadge> },
        ]} />
      </SectionCard>
    </>
  )
}
