import { Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AIResponseCard, QuestionBubble } from '../components/ui/AIResponseCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { ErrorState, LoadingState } from '../components/ui/States'
import { EXAMPLE_QUESTIONS } from '../data/mock/ai'
import { askAnalyst } from '../services'
import type { AIQueryResponse, AnalysisPlan } from '../types'

const KEY = 'nirf-ai-recent'

const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

interface Turn {
  id: number
  question: string
  response?: AIQueryResponse
  error?: string
}

const chip = 'rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-medium text-ink transition hover:border-accent hover:bg-teal-50 hover:text-deep'

export default function AIAnalyst() {
  const [text, setText] = useState('')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const plan = useRef<AnalysisPlan | undefined>(undefined)
  const nextId = useRef(1)
  const lastTurn = useRef<HTMLDivElement>(null)

  useEffect(() => {
    lastTurn.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [turns])

  const ask = async (question: string) => {
    const q = question.trim().slice(0, 500)
    if (!q || loading) return
    const id = nextId.current++
    setText('')
    setLoading(true)
    setTurns((t) => [...t, { id, question: q }])
    try {
      const response = await askAnalyst(q, plan.current)
      if (response.plan) plan.current = response.plan
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, response } : x)))
      const next = [q, ...recent.filter((r) => r !== q)].slice(0, 6)
      setRecent(next)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'The assistant could not answer that question.'
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error } : x)))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setTurns([])
    plan.current = undefined
  }

  return (
    <>
      <PageHeader
        title="AI Analyst"
        description="Ask about the NIRF rankings in plain language, even with typos. Every number comes from the data loaded here. The AI key stays on the backend, never in the browser."
        actions={turns.length > 0 ? (
          <button type="button" className="btn-secondary" onClick={clear}>
            <Trash2 className="h-4 w-4" /> Clear conversation
          </button>
        ) : undefined}
      />

      {turns.map((t, i) => (
        <div key={t.id} ref={i === turns.length - 1 ? lastTurn : undefined} className="scroll-mt-4 space-y-3">
          <QuestionBubble text={t.question} />
          {t.response && <AIResponseCard response={t.response} onAsk={(q) => void ask(q)} />}
          {t.error && <SectionCard><ErrorState message={t.error} onRetry={() => void ask(t.question)} /></SectionCard>}
          {!t.response && !t.error && <SectionCard><LoadingState label="Analysing your question…" /></SectionCard>}
        </div>
      ))}

      <SectionCard>
        <label htmlFor="ai-question" className="field-label">Your question</label>
        <textarea
          id="ai-question"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(text)
            }
          }}
          placeholder="Compare IIT Madras and IIT Delhi"
          className="w-full resize-y rounded-md border border-line bg-white p-3 text-base text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Enter to ask, Shift + Enter for a new line</p>
          <button type="button" className="btn-primary" disabled={!text.trim() || loading} onClick={() => void ask(text)}>
            <Send className="h-4 w-4" /> Ask
          </button>
        </div>

        {turns.length === 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="field-label">Example questions</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((e) => (
                <button key={e} type="button" className={chip} onClick={() => void ask(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="field-label">Recent questions</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} type="button" className={chip} onClick={() => void ask(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </>
  )
}
