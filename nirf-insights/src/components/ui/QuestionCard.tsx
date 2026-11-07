import { Loader2, Play } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Question } from '../../types'

const CHART_LABEL: Record<Question['recommendedChart'], string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  scatter: 'Scatter plot',
  box: 'Box plot',
  histogram: 'Histogram',
  heatmap: 'Heatmap',
  area: 'Area chart',
  pie: 'Pie chart',
  donut: 'Donut chart',
  slope: 'Slope chart',
  sankey: 'Sankey diagram',
  choropleth: 'Choropleth map',
}

export function QuestionCard({
  question,
  selected,
  running,
  onExecute,
}: {
  question: Question
  selected: boolean
  running: boolean
  onExecute: (q: Question) => void
}) {
  return (
    <article
      className={cn(
        'flex flex-col justify-between gap-3 rounded-card border bg-white p-4 shadow-card transition',
        selected ? 'border-accent ring-2 ring-accent/20' : 'border-line',
      )}
    >
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="rounded bg-navy px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white">{question.id}</span>
          <span className="text-[11px] font-medium text-muted">{CHART_LABEL[question.recommendedChart]}</span>
        </div>
        <p className="text-sm leading-snug text-ink">{question.text}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-accent">{question.group}</p>
      </div>
      <button type="button" className="btn-primary self-start" disabled={running} onClick={() => onExecute(question)}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? 'Running…' : 'Execute'}
      </button>
    </article>
  )
}
