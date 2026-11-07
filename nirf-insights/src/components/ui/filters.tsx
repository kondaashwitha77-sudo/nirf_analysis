import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { YEARS } from '../../data/mock/constants'
import { METRIC_OPTIONS } from '../../data/selectors'
import type { ChartType, Option } from '../../types'

/* ---------------------------- FilterBar ---------------------------- */
export function FilterBar({
  children,
  onReset,
  className,
}: {
  children: ReactNode
  onReset?: () => void
  className?: string
}) {
  return (
    <div className={cn('rounded-card border border-line bg-white p-3 shadow-card', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{children}</div>
      {onReset && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="text-xs font-medium text-accent hover:text-deep" onClick={onReset}>
            Reset filters
          </button>
        </div>
      )}
    </div>
  )
}

/* --------------------------- SelectFilter -------------------------- */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field-control" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* --------------------------- MetricSelector ------------------------ */
export function MetricSelector({
  value,
  onChange,
  options = METRIC_OPTIONS,
  label = 'Metric',
}: {
  value: string
  onChange: (v: string) => void
  options?: Option[]
  label?: string
}) {
  return <SelectFilter label={label} value={value} onChange={onChange} options={options} />
}

/* ------------------------- YearRangeSelector ----------------------- */
export function YearRangeSelector({
  start,
  end,
  onChange,
  years = YEARS,
  label = 'Year range',
}: {
  start: number
  end: number
  onChange: (start: number, end: number) => void
  years?: number[]
  label?: string
}) {
  const sid = useId()
  const eid = useId()
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-2">
        <select
          id={sid}
          aria-label={`${label} start`}
          className="field-control"
          value={start}
          onChange={(e) => {
            const s = Number(e.target.value)
            onChange(s, Math.max(s, end))
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">to</span>
        <select
          id={eid}
          aria-label={`${label} end`}
          className="field-control"
          value={end}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(Math.min(start, v), v)
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* --------------------------- SearchInput --------------------------- */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  onSubmit,
  className,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onSubmit?: () => void
  className?: string
  label?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={id}
          type="search"
          className="field-control pl-8 pr-8"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit?.()
          }}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-ink"
            onClick={() => onChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------------------- MultiSelect -------------------------- */
export function MultiSelect({
  label,
  options,
  values,
  onChange,
  max,
  placeholder = 'Select…',
  className,
}: {
  label: string
  options: Option[]
  values: string[]
  onChange: (v: string[]) => void
  max?: number
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 80),
    [options, query],
  )
  const atMax = max !== undefined && values.length >= max
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : atMax ? values : [...values, v])

  return (
    <div className={cn('relative', className)} ref={ref}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="field-control flex items-center justify-between text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn('truncate', !values.length && 'text-slate-400')}>
          {values.length ? `${values.length} selected` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {values.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className="inline-flex max-w-full items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-deep">
              <span className="truncate">{options.find((o) => o.value === v)?.label ?? v}</span>
              <button type="button" aria-label="Remove" onClick={() => toggle(v)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-md border border-line bg-white shadow-pop">
          <div className="border-b border-line p-2">
            <input
              autoFocus
              className="field-control h-8"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {max !== undefined && (
              <p className="mt-1 text-[11px] text-muted">
                {values.length}/{max} selected
              </p>
            )}
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
            {filtered.map((o) => {
              const checked = values.includes(o.value)
              const disabled = !checked && atMax
              return (
                <li key={o.value}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50',
                      disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(o.value)} className="h-4 w-4 accent-blue-600" />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* -------------------------- ChartTypeSelector ---------------------- */
const TYPE_LABEL: Record<ChartType, string> = {
  bar: 'Bar',
  line: 'Line',
  scatter: 'Scatter',
  box: 'Box',
  histogram: 'Histogram',
  heatmap: 'Heatmap',
  area: 'Area',
  pie: 'Pie',
  donut: 'Donut',
}

export function ChartTypeSelector({
  value,
  onChange,
  types = ['bar', 'line', 'scatter', 'box', 'histogram', 'heatmap', 'area', 'pie', 'donut'],
}: {
  value: ChartType
  onChange: (t: ChartType) => void
  types?: ChartType[]
}) {
  return (
    <div>
      <span className="field-label">Chart type</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Chart type">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            onClick={() => onChange(t)}
            className={cn(
              'h-9 rounded-md border px-3 text-sm font-medium transition',
              value === t ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink hover:bg-slate-50',
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------- Segmented ---------------------------- */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div>
      {label && <span className="field-label">{label}</span>}
      <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded px-3 text-sm font-medium transition',
              value === o.value ? 'bg-navy text-white' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
