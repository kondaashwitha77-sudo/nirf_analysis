import { useState } from 'react'
import { chartHasData } from '../../lib/chartData'
import { cn } from '../../lib/cn'
import type { AnalysisResult, ChartSpec, TableData } from '../../types'
import { ChartCard } from '../charts/ChartCard'
import { SpecChart } from '../charts/SpecChart'
import { SectionCard } from './SectionCard'
import { TableDataView } from './DataTable'

type Props = Partial<Pick<AnalysisResult, 'chart' | 'charts' | 'filters' | 'methodology' | 'limitations'>> & {
  table?: TableData
  /** conversation layout: table behind a toggle, notes collapsed */
  compact?: boolean
}

function chartHeight(chart: ChartSpec) {
  if (chart.horizontal) return Math.max(320, 80 + (chart.series[0]?.x?.length ?? 0) * 38)
  return compactLine(chart) ? 320 : 340
}
const compactLine = (chart: ChartSpec) => chart.type === 'line' || chart.type === 'bar'

/** Shared result layout for Question Explorer and AI Analyst: filters, charts, table, methodology, limitations. */
export function AnalysisView({ chart, charts, table, filters = [], methodology, limitations = [], compact }: Props) {
  const [showTable, setShowTable] = useState(false)
  const list = (charts ?? (chart ? [chart] : [])).filter(chartHasData)
  const hasRows = !!table?.rows.length

  const notes = (methodology || limitations.length > 0) && (
    <div className="grid gap-4 md:grid-cols-2">
      {methodology && (
        <SectionCard title="Methodology">
          <p className="text-sm leading-relaxed text-ink">{methodology}</p>
        </SectionCard>
      )}
      {limitations.length > 0 && (
        <SectionCard title="Data limitations">
          <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  )

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

      {list.length > 0 && (
        <div className={cn('grid gap-4', list.length > 1 && 'lg:grid-cols-2')}>
          {list.map((c, i) => (
            <ChartCard key={`${c.title}-${i}`} title={c.title} className={cn('min-w-0', list.length === 3 && i === 2 && 'lg:col-span-2')}>
              <SpecChart spec={c} height={chartHeight(c)} />
            </ChartCard>
          ))}
        </div>
      )}

      {hasRows && compact && list.length > 0 && (
        <button type="button" className="btn-secondary" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
      )}
      {hasRows && (!compact || list.length === 0 || showTable) && (
        <SectionCard title="Data table">
          <TableDataView data={table as TableData} pageSize={8} />
        </SectionCard>
      )}

      {compact
        ? notes && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-accent">Method and limitations</summary>
              <div className="mt-2">{notes}</div>
            </details>
          )
        : notes}
    </div>
  )
}
