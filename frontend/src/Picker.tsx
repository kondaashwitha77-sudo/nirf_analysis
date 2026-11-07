import { useState } from 'react'
import type { Meta } from './api'

/** Search-and-add institution picker; selected institutions show as removable chips. */
export default function Picker({ meta, selected, onChange, max = 6 }: { meta: Meta; selected: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const [q, setQ] = useState('')
  const matches = q.length < 2 ? [] : meta.institutions.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) && !selected.includes(i.id)).slice(0, 8)
  const name = (id: string) => meta.institutions.find(i => i.id === id)?.name ?? id
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {selected.map(id => (
          <button key={id} onClick={() => onChange(selected.filter(s => s !== id))} className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100">{name(id)} ✕</button>
        ))}
      </div>
      {selected.length < max && (
        <div className="relative max-w-md">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search institution to add…" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              {matches.map(m => <li key={m.id}><button className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { onChange([...selected, m.id]); setQ('') }}>{m.name} <span className="text-xs text-slate-400">· {m.state}</span></button></li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
