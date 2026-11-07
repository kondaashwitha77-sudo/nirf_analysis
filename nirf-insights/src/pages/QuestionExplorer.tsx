import { ChevronDown, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QUESTIONS, SECTIONS, initialArgs, runQuestion, type AnnexQuestion, type ControlKey } from '../annex/questions'
import { ATTR_OPTIONS, PARAM_OPTIONS, allCategories, catYears, defaults, institutionOptions, stateList, topRows, type Args } from '../annex/core'
import { ChartCard } from '../components/charts/ChartCard'
import { IndiaMap } from '../components/charts/IndiaMap'
import { PlotChart } from '../components/charts/PlotChart'
import { KpiCard, KpiGrid } from '../components/ui/KpiCard'
import { MultiSelect, SelectFilter } from '../components/ui/filters'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard } from '../components/ui/SectionCard'
import { TableDataView } from '../components/ui/DataTable'
import { downloadCsv } from '../lib/format'
import { cn } from '../lib/cn'

const METRIC_IDS = ['1.4', '3.1', '3.3', '3.5', '6.2', '6.4', '6.5']
const BASIS: Record<string, { value: string; label: string }[]> = {
  '3.2': [{ value: 'median', label: 'Median rank across all years' }, { value: 'year', label: 'Rank in the selected year' }],
  '3.4': [{ value: 'pooled', label: 'Pooled quartiles, selected year' }, { value: 'year', label: 'Quartiles within the selected year' }, { value: 'trend', label: 'Pooled quartiles, every year' }],
  '6.3': [{ value: 'sd', label: 'Standard deviation' }, { value: 'cv', label: 'Coefficient of variation' }, { value: 'iqr', label: 'Interquartile range' }],
}
const LABEL: Partial<Record<ControlKey, string>> = {
  category: 'Category', year: 'Year', year2: 'To year', state: 'State A', state2: 'State B', institutions: 'Institutions (up to 6)',
  param: 'Parameter', param2: 'Compare with', attrX: 'X variable', attrY: 'Y variable', topN: 'Top N', minYears: 'Minimum years', bandSize: 'Rank band width',
  cut: 'Rank cut-off', z: 'Outlier threshold (z)', pctHigh: '“High” = at least percentile', pctLow: '“Low” = at most percentile', basis: 'Basis', bins: 'Histogram bins', minCount: 'Min. institutions per state',
}
const NUM_RANGE: Partial<Record<ControlKey, [number, number, number]>> = {
  topN: [3, 100, 1], minYears: [1, 9, 1], cut: [5, 99, 1], z: [0.5, 4, 0.5], pctHigh: [50, 95, 5], pctLow: [5, 95, 5], bins: [5, 40, 1], minCount: [1, 10, 1],
}

function useAnswer(q: AnnexQuestion, a: Args) {
  return useMemo(() => runQuestion(q, a), [q, a])
}

function Controls({ q, a, set }: { q: AnnexQuestion; a: Args; set: (p: Partial<Args>) => void }) {
  const cats = allCategories()
  const years = catYears(a.category)
  const yopt = years.map((y) => ({ value: String(y), label: String(y) }))
  const hasRange = q.controls.includes('year2')
  const paramOpts = METRIC_IDS.includes(q.id) ? [{ value: 'score', label: 'Overall score' }, ...PARAM_OPTIONS] : q.id === '4.5' ? [...PARAM_OPTIONS, { value: 'ALL', label: 'All five parameters' }] : PARAM_OPTIONS
  const label = (k: ControlKey) => {
    if (k === 'year' && hasRange) return 'From year'
    if (k === 'param' && q.id === '8.2') return 'Stronger parameter'
    if (k === 'param2' && q.id === '8.2') return 'Weaker parameter'
    if (k === 'topN' && ['2.1', '2.2', '2.3', '2.4'].includes(q.id)) return 'Top N institutions'
    if (k === 'topN' && q.id === '6.1') return 'Top group size'
    if (k === 'cut' && q.id === '7.1') return 'Top-band limit (rank)'
    if (k === 'year' && q.id === '2.4') return 'Year (box plot)'
    if (k === 'minYears' && q.id === '8.5') return 'Minimum years ranked'
    return LABEL[k] ?? k
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {q.controls.map((k) => {
        if (k === 'category') return <SelectFilter key={k} label={label(k)} value={a.category} options={cats.map((c) => ({ value: c, label: c }))} onChange={(v) => {
          const ys = catYears(v)
          const near = (y: number) => (ys.includes(y) ? y : ys.reduce((p, c) => (Math.abs(c - y) < Math.abs(p - y) ? c : p), ys[0]))
          set({ category: v, year: near(a.year), year2: near(a.year2), institutions: topRows(v, ys[ys.length - 1], 3).map((r) => r.institutionId) })
        }} />
        if (k === 'year' || k === 'year2') return <SelectFilter key={k} label={label(k)} value={String(a[k])} options={yopt} onChange={(v) => set({ [k]: Number(v) } as Partial<Args>)} />
        if (k === 'state' || k === 'state2') return <SelectFilter key={k} label={label(k)} value={a[k]} options={stateList().map((s) => ({ value: s, label: s }))} onChange={(v) => set({ [k]: v } as Partial<Args>)} />
        if (k === 'institutions') return <MultiSelect key={k} label={label(k)} options={institutionOptions(a.category)} values={a.institutions} max={6} onChange={(v) => set({ institutions: v })} placeholder="Search and pick institutions…" className="sm:col-span-2" />
        if (k === 'param' || k === 'param2') return <SelectFilter key={k} label={label(k)} value={a[k]} options={q.id === '8.2' || q.id === '4.4' ? PARAM_OPTIONS : paramOpts} onChange={(v) => set({ [k]: v } as Partial<Args>)} />
        if (k === 'attrX' || k === 'attrY') return <SelectFilter key={k} label={label(k)} value={a[k]} options={ATTR_OPTIONS} onChange={(v) => set({ [k]: v } as Partial<Args>)} />
        if (k === 'basis') return <SelectFilter key={k} label={label(k)} value={a.basis} options={BASIS[q.id] ?? []} onChange={(v) => set({ basis: v })} />
        if (k === 'bandSize') return <SelectFilter key={k} label={label(k)} value={String(a.bandSize)} options={[5, 10, 20, 25, 50].map((v) => ({ value: String(v), label: `${v} ranks` }))} onChange={(v) => set({ bandSize: Number(v) })} />
        if (k === 'trend') return (
          <label key={k} className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-[#0E7C86]" checked={a.trend} onChange={(e) => set({ trend: e.target.checked })} /> Show trend line
          </label>
        )
        const r = NUM_RANGE[k]
        if (r) return (
          <div key={k}>
            <label className="field-label">{label(k)}</label>
            <input type="number" className="field-control" min={r[0]} max={r[1]} step={r[2]} value={a[k] as number} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) set({ [k]: v } as Partial<Args>) }} />
          </div>
        )
        return null
      })}
    </div>
  )
}

function Result({ q, a }: { q: AnnexQuestion; a: Args }) {
  const res = useAnswer(q, a)
  const csv = () => res.table && downloadCsv(`nirf-q${q.id}.csv`, res.table.columns, res.table.rows)
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-teal-200 bg-teal-50/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-deep">Answer</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{res.answer}</p>
        {res.chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {res.chips.map((c) => <span key={c} className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-medium text-deep">{c}</span>)}
          </div>
        )}
      </div>
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

export default function QuestionExplorer() {
  const [base] = useState(() => defaults())
  const [id, setId] = useState('1.1')
  const [argsById, setArgs] = useState<Record<string, Args>>({})
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ [SECTIONS[0]]: true })
  const q = QUESTIONS.find((x) => x.id === id) ?? QUESTIONS[0]
  const a = argsById[q.id] ?? initialArgs(q, base)
  const set = (p: Partial<Args>) => setArgs((s) => ({ ...s, [q.id]: { ...(s[q.id] ?? initialArgs(q, base)), ...p } }))
  const needle = search.trim().toLowerCase()
  const visible = QUESTIONS.filter((x) => !needle || `${x.id} ${x.text}`.toLowerCase().includes(needle))
  const pick = (qq: AnnexQuestion) => {
    setId(qq.id)
    requestAnimationFrame(() => document.getElementById('annex-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="space-y-5">
      <PageHeader showMockBadge={false} title="Question Explorer" description="All 40 questions from Annexure A. Pick a question, adjust its filters, and the answer, chart and data update from the NIRF 2017–2025 dataset." />
      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input className="field-control pl-8" placeholder="Search the 40 questions…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search questions" />
          </div>
          {SECTIONS.map((sec) => {
            const items = visible.filter((x) => x.section === sec)
            if (!items.length) return null
            const isOpen = needle ? true : open[sec] ?? false
            return (
              <div key={sec} className="rounded-card border border-line bg-white shadow-card">
                <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-navy" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [sec]: !isOpen }))}>
                  <span>{sec}</span><ChevronDown className={cn('h-4 w-4 shrink-0 transition', isOpen && 'rotate-180')} aria-hidden />
                </button>
                {isOpen && (
                  <ul className="border-t border-line">
                    {items.map((x) => (
                      <li key={x.id}>
                        <button type="button" onClick={() => pick(x)} className={cn('flex w-full gap-2 px-3 py-2 text-left text-[13px] leading-snug hover:bg-teal-50', x.id === id ? 'bg-teal-50 font-medium text-deep' : 'text-ink')}>
                          <span className="w-7 shrink-0 font-semibold tabular-nums text-accent">{x.id}</span><span>{x.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {!visible.length && <p className="text-sm text-muted">No question matches “{search}”.</p>}
        </aside>

        <div id="annex-workspace" className="min-w-0 space-y-4 scroll-mt-20">
          <SectionCard title={`Question ${q.id}`} subtitle={q.section}>
            <p className="mb-4 text-base font-semibold text-navy">{q.text}</p>
            <Controls q={q} a={a} set={set} />
            <p className="mt-3 text-[11px] text-muted">PR = Perception. Results update as you change the filters. Only institutions with an exact published rank (roughly the top 100 per category per year) are included.</p>
          </SectionCard>
          <Result key={q.id} q={q} a={a} />
        </div>
      </div>
    </div>
  )
}
