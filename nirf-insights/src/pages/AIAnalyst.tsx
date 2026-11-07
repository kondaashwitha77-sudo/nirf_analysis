import { Send } from 'lucide-react'
import { useState } from 'react'
import { AIResponseCard } from '../components/ui/AIResponseCard'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { ErrorState, LoadingState } from '../components/ui/States'
import { EXAMPLE_QUESTIONS } from '../data/mock/ai'
import { askAnalyst } from '../services'
import type { AIQueryResponse } from '../types'

const KEY = 'nirf-ai-recent'

const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

export default function AIAnalyst() {
  const [text, setText] = useState('')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<AIQueryResponse | null>(null)

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    try {
      setResponse(await askAnalyst(q))
      const next = [q, ...recent.filter((r) => r !== q)].slice(0, 6)
      setRecent(next)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The analyst could not answer that question.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader title="AI Analyst" description="Ask a question in plain language. In this build the answers are mocked: the demo matches keywords to a fixed analysis. The real service will run through the backend, which keeps any AI key off the browser." />

      <SectionCard>
        <label htmlFor="ai-question" className="field-label">Your question</label>
        <textarea
          id="ai-question"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask(text)
          }}
          placeholder="Which states had the highest number of top 100 engineering institutions in 2024?"
          className="w-full resize-y rounded-md border border-line bg-white p-3 text-base text-ink shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Ctrl/⌘ + Enter to ask</p>
          <button type="button" className="btn-primary" disabled={!text.trim() || loading} onClick={() => void ask(text)}>
            <Send className="h-4 w-4" /> Ask
          </button>
        </div>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          <div>
            <p className="field-label">Example questions</p>
            <ul className="space-y-1.5">
              {EXAMPLE_QUESTIONS.map((e) => (
                <li key={e}>
                  <button type="button" className="text-left text-sm text-accent hover:text-deep hover:underline" onClick={() => { setText(e); void ask(e) }}>
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="field-label">Recent questions</p>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">Your recent questions appear here.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" className="text-left text-sm text-ink hover:text-accent hover:underline" onClick={() => { setText(r); void ask(r) }}>
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      {loading && <SectionCard><LoadingState label="Analysing your question…" /></SectionCard>}
      {error && !loading && <SectionCard><ErrorState message={error} onRetry={() => void ask(text)} /></SectionCard>}
      {response && !loading && !error && <AIResponseCard response={response} />}
    </>
  )
}
