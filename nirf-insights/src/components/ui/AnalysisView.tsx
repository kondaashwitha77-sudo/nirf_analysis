import type { AnalysisResult } from '../../types'
import { ChartCard } from '../charts/ChartCard'
import { SpecChart } from '../charts/SpecChart'
import { SectionCard } from './SectionCard'
import { TableDataView } from './DataTable'

type Props = Pick<AnalysisResult, 'chart' | 'table' | 'filters' | 'methodology' | 'limitations'>

/** Shared result layout for Question Explorer and AI Analyst: filters, chart, table, methodology, limitations. */
export function AnalysisView({ chart, table, filters, methodology, limitations }: Props) {
  return (
    <div className="space-y-4">
      {filters.length > 0 && (
        <div>
          <p className="field-label">Filters used</p>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <span key={f.label} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-ink">
                <span className="text-muted">{f.label}:</span> <span className="font-medium">{f.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {chart && (
        <ChartCard title={chart.title}>
          <SpecChart spec={chart} height={340} />
        </ChartCard>
      )}

      <SectionCard title="Data table">
        <TableDataView data={table} pageSize={8} />
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Methodology">
          <p className="text-sm leading-relaxed text-ink">{methodology}</p>
        </SectionCard>
        <SectionCard title="Data limitations">
          <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
