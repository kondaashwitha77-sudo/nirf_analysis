export interface Row {
  year: number; category: string; rank: number | null; rank_base: number | null
  rank_suffix: string; rank_type: string; institution_id: string; institution_name: string
  city: string; state: string; score: number | null
  TLR: number | null; RPC: number | null; GO: number | null; OI: number | null; PERCEPTION: number | null
}
export interface Meta {
  years: number[]
  categories: { name: string; min_year: number; max_year: number }[]
  states: string[]
  institutions: { id: string; name: string; state: string; first_year: number; last_year: number }[]
}
export interface QueryResult {
  answer: string; plan: unknown; columns: string[]; rows: Record<string, unknown>[]
  total_matched: number; chart: 'bar' | 'line' | 'table'
}
export type ChatTurn = { role: 'user' | 'assistant'; content: string }

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)))
  const r = await fetch(`/api/${path}?${q}`)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json()
}

export const api = {
  meta: () => get<Meta>('meta'),
  rankings: (p: { year: number; category: string; state?: string; min_rank?: number; max_rank?: number }) =>
    get<Row[]>('rankings', p),
  trend: (ids: string[], category: string) => get<Row[]>('trend', { ids: ids.join(','), category }),
  compare: (ids: string[], year: number, category: string) =>
    get<Row[]>('compare', { ids: ids.join(','), year, category }),
  states: (year: number, category: string, top: number) => get<{ state: string; count: number; avg_score: number }[]>('states', { year, category, top }),
  ask: async (question: string, history: ChatTurn[]): Promise<QueryResult> => {
    const r = await fetch('/api/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail ?? 'Request failed')
    return data
  },
}
