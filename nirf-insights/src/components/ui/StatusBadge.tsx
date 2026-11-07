import { cn } from '../../lib/cn'

export type BadgeVariant =
  | 'exact'
  | 'band'
  | 'unavailable'
  | 'missing'
  | 'not_published'
  | 'not_applicable'
  | 'parser_failure'
  | 'invalid'
  | 'duplicate_candidate'
  | 'pass'
  | 'warn'
  | 'fail'
  | 'validated'
  | 'partial'
  | 'failed'
  | 'mock'
  | 'info'

const STYLE: Record<BadgeVariant, { cls: string; label: string }> = {
  exact: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Exact rank' },
  band: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'Rank band' },
  unavailable: { cls: 'bg-slate-100 text-slate-600 ring-slate-200', label: 'Unavailable' },
  missing: { cls: 'bg-slate-100 text-slate-700 ring-slate-300', label: 'Missing' },
  not_published: { cls: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'Not published' },
  not_applicable: { cls: 'bg-violet-50 text-violet-700 ring-violet-200', label: 'Not applicable' },
  parser_failure: { cls: 'bg-orange-50 text-orange-700 ring-orange-200', label: 'Parser failure' },
  invalid: { cls: 'bg-red-50 text-red-700 ring-red-200', label: 'Invalid' },
  duplicate_candidate: { cls: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200', label: 'Duplicate candidate' },
  pass: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Pass' },
  warn: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'Warning' },
  fail: { cls: 'bg-red-50 text-red-700 ring-red-200', label: 'Fail' },
  validated: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Validated' },
  partial: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'Partial' },
  failed: { cls: 'bg-red-50 text-red-700 ring-red-200', label: 'Failed' },
  mock: { cls: 'bg-amber-50 text-amber-800 ring-amber-300', label: 'Demo / Mock Data' },
  info: { cls: 'bg-blue-50 text-blue-700 ring-blue-200', label: 'Info' },
}

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant
  children?: React.ReactNode
  className?: string
}) {
  const s = STYLE[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        s.cls,
        className,
      )}
    >
      {children ?? s.label}
    </span>
  )
}
