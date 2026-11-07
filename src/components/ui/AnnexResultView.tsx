import { Download } from 'lucide-react'
import type { Res } from '../../annex/core'
import { cn } from '../../lib/cn'
import { downloadCsv } from '../../lib/format'
import { ChartCard } from '../charts/ChartCard'
import { IndiaMap } from '../charts/IndiaMap'
import { PlotChart } from '../charts/PlotChart'
import { KpiCard, KpiGrid } from './KpiCard'
import { SectionCard } from './SectionCard'
import { TableDataView } from './DataTable'

/** Charts, maps, KPIs and table of an engine result (used by the AI Analyst; the answer text is shown by the chat card). */
export function AnnexResultView({ res, fileName = 'nirf-answer.csv' }: { res: Res; fileName?: string }) {
  const csv = () => res.table && downloadCsv(fileName, res.table.columns, res.table.rows)
  return (
    <div className="space-y-4">
      {res.kpis && <KpiGrid cols={res.kpis.length >= 4 ? 4 : 3}>{res.kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} />)}</KpiGrid>}
      {res.maps && (
        <div className={cn('grid gap-4', res.maps.length > 1 && 'lg:grid-cols-2')}>
          {res.maps.map((m) => <SectionCard key={m.title} title={m.title}><IndiaMap counts={m.counts} max={m.max} /></SectionCard>)}
        </div>
      )}
      {res.charts.map((c) => (
        <ChartCard key={c.title} title={c.title} why={c.why}>
          <PlotChart data={c.data} title={c.title} xTitle={c.xTitle} yTitle={c.yTitle} showLegend={c.showLegend} reverseY={c.reverseY} yFromZero={c.yFromZero} legendRows={c.legendRows} height={c.height ?? 360} layout={c.layout as never} empty={!c.data.length} emptyMessage="No data for this selection." />
        </ChartCard>
      ))}
      {res.table && res.table.rows.length > 0 && (
        <SectionCard title="Data behind the answer" actions={<button type="button" onClick={csv} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-deep hover:bg-teal-50"><Download className="h-3.5 w-3.5" aria-hidden /> CSV</button>}>
          <TableDataView data={res.table as never} pageSize={10} />
        </SectionCard>
      )}
    </div>
  )
}
