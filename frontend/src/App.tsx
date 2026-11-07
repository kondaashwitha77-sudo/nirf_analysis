import { useEffect, useState } from 'react'
import { api, type Meta } from './api'
import { Loading } from './ui'
import Ask from './tabs/Ask'
import Compare from './tabs/Compare'
import Rankings from './tabs/Rankings'
import States from './tabs/States'
import Trends from './tabs/Trends'

const TABS = ['Rankings', 'Trends', 'States', 'Compare', 'Ask AI'] as const

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<(typeof TABS)[number]>('Rankings')
  useEffect(() => { api.meta().then(setMeta).catch(() => setErr('Cannot reach the backend. Is uvicorn running on port 8000?')) }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold">NIRF Insights <span className="text-sm font-normal text-slate-400">2017–2025</span></h1>
          <nav className="flex gap-1">
            {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>)}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {err ? <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">{err}</p> : !meta ? <Loading /> : (
          <>
            {tab === 'Rankings' && <Rankings meta={meta} />}
            {tab === 'Trends' && <Trends meta={meta} />}
            {tab === 'States' && <States meta={meta} />}
            {tab === 'Compare' && <Compare meta={meta} />}
            {tab === 'Ask AI' && <Ask />}
          </>
        )}
      </main>
    </div>
  )
}
