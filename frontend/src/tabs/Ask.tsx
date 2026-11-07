import { useRef, useState } from 'react'
import { api, type ChatTurn, type QueryResult } from '../api'
import Plot from '../Plot'
import { Card } from '../ui'

const EXAMPLES = [
  'Top 10 engineering colleges in 2025',
  'How many Tamil Nadu institutions are in the Overall top 100 in 2024?',
  'Show the rank trend of IIT Madras in Overall',
  'Which state has the highest average score in the top 50 universities in 2023?',
]

interface Msg { role: 'user' | 'assistant'; text: string; result?: QueryResult; error?: boolean }

function ResultView({ r }: { r: QueryResult }) {
  const cols = r.columns
  const nameCol = cols.find(c => c === 'institution_name') ?? cols.find(c => typeof r.rows[0]?.[c] === 'string')
  const numCol = [...cols].reverse().find(c => typeof r.rows[0]?.[c] === 'number' && c !== 'year')
  const canChart = r.rows.length > 1 && numCol && nameCol
  const isTrend = r.chart === 'line' && cols.includes('year') && numCol
  return (
    <div className="mt-2 space-y-2">
      {isTrend && (
        <Plot height={300} data={[{ type: 'scatter', mode: 'lines+markers', x: r.rows.map(x => x.year as number), y: r.rows.map(x => x[numCol!] as number) }]}
          layout={{ xaxis: { dtick: 1 }, yaxis: { autorange: numCol === 'rank_base' ? 'reversed' : true, title: { text: numCol } } }} />
      )}
      {!isTrend && canChart && r.chart === 'bar' && (
        <Plot height={300} data={[{ type: 'bar', x: r.rows.map(x => String(x[nameCol!])), y: r.rows.map(x => x[numCol!] as number), marker: { color: '#4f46e5' } }]} layout={{ xaxis: { tickangle: -30 }, margin: { b: 140, t: 10 } }} />
      )}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">{r.total_matched} matching rows · show table & query plan</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left"><thead className="bg-slate-50"><tr>{cols.map(c => <th key={c} className="px-2 py-1">{c}</th>)}</tr></thead>
            <tbody>{r.rows.map((row, i) => <tr key={i} className="border-t border-slate-100">{cols.map(c => <td key={c} className="px-2 py-1">{String(row[c] ?? '–')}</td>)}</tr>)}</tbody></table>
        </div>
        <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2">{JSON.stringify(r.plan, null, 2)}</pre>
      </details>
    </div>
  )
}

export default function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  async function send(q: string) {
    if (!q.trim() || busy) return
    const history: ChatTurn[] = msgs.filter(m => !m.error).map(m => ({ role: m.role, content: m.text }))
    setMsgs(m => [...m, { role: 'user', text: q }]); setInput(''); setBusy(true)
    try {
      const res = await api.ask(q, history)
      setMsgs(m => [...m, { role: 'assistant', text: res.answer, result: res }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: (e as Error).message, error: true }])
    } finally {
      setBusy(false); setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <Card title="Ask the data (powered by Grok)">
      <div className="mb-3 flex flex-wrap gap-2">
        {EXAMPLES.map(e => <button key={e} onClick={() => send(e)} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">{e}</button>)}
      </div>
      <div className="mb-3 max-h-[28rem] space-y-3 overflow-auto">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-full rounded-lg px-3 py-2 text-left text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : m.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-800'}`}>{m.text}</div>
            {m.result && <ResultView r={m.result} />}
          </div>
        ))}
        {busy && <p className="text-sm text-slate-400">Thinking…</p>}
        <div ref={bottom} />
      </div>
      <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask anything about NIRF rankings 2017–2025…" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Ask</button>
      </form>
    </Card>
  )
}
