import { Sparkles } from 'lucide-react'
import type { AIQueryResponse } from '../../types'
import { AnalysisView } from './AnalysisView'
import { SectionCard } from './SectionCard'
import { StatusBadge } from './StatusBadge'

export function AIResponseCard({ response }: { response: AIQueryResponse }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Answer"
        actions={response.isMock ? <StatusBadge variant="mock">Mock AI response</StatusBadge> : undefined}
      >
        <p className="mb-2 text-xs text-muted">“{response.question}”</p>
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <p className="text-base leading-relaxed text-ink">{response.answer}</p>
        </div>
      </SectionCard>
      <AnalysisView
        chart={response.chart}
        table={response.table}
        filters={response.filters}
        methodology={response.methodology}
        limitations={response.limitations}
      />
    </div>
  )
}
