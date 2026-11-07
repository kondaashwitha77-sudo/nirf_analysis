import type { ReactNode } from 'react'
export const Card = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    {title && <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>}
    {children}
  </section>
)
export const Select = ({ label, value, onChange, options }: { label: string; value: string | number; onChange: (v: string) => void; options: { value: string | number; label: string }[] }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
    {label}
    <select className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
)
export const Loading = () => <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
