import { Sparkles, User } from 'lucide-react'
import { Suspense, lazy } from 'react'
import type { AIQueryResponse } from '../../types'
import { SectionCard } from './SectionCard'
import { StatusBadge } from './StatusBadge'

// Charts load only when an answer needs them; chat replies never pull in the chart library.
const AnalysisView = lazy(() => import('./AnalysisView').then((m) => ({ default: m.AnalysisView })))

const chip = 'rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-medium text-ink transition hover:border-accent hover:bg-teal-50 hover:text-deep'

export function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <p className="max-w-[85%] rounded-lg bg-navy px-3 py-2 text-sm text-white">{text}</p>
      <User className="mt-2 h-4 w-4 shrink-0 text-muted" aria-hidden />
    </div>
  )
}

export function AIResponseCard({ response, onAsk }: { response: AIQueryResponse; onAsk: (question: string) => void }) {
  const r = response
  return (
    <div className="space-y-4">
      <SectionCard title={r.isMock ? 'Answer' : undefined} actions={r.isMock ? <StatusBadge variant="mock">Mock AI response</StatusBadge> : undefined}>
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-base leading-relaxed text-ink">{r.answer}</p>
            {r.correctedQuestion && (
              <p className="text-xs text-muted">
                Showing results for <span className="font-medium text-ink">{r.correctedQuestion}</span>. (You typed: {r.question})
              </p>
            )}
            {!!r.understood?.length && (
              <div>
                <p className="field-label">Understood as</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.understood.map((u) => (
                    <span key={u.label} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-ink">
                      <span className="text-muted">{u.label}:</span> <span className="font-medium">{u.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {r.clarify && (
              <div className="flex flex-wrap gap-2">
                {r.clarify.options.map((o) => (
                  <button key={o.id} type="button" className={chip} onClick={() => onAsk(o.question)}>
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {(r.charts.length > 0 || !!r.table?.rows.length) && (
        <Suspense fallback={<div className="h-60 animate-pulse rounded-card bg-slate-100" aria-label="Loading charts" />}>
          <AnalysisView charts={r.charts} table={r.table} filters={r.filters} methodology={r.methodology} limitations={r.limitations} compact />
        </Suspense>
      )}

      {!!r.suggestions?.length && (
        <div className="flex flex-wrap gap-2">
          {r.suggestions.map((s) => (
            <button key={s} type="button" className={chip} onClick={() => onAsk(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
