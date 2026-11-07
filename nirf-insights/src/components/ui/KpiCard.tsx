import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'warn' | 'bad'
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
      </div>
      <p
        className={cn(
          'mt-1.5 text-2xl font-bold tabular-nums tracking-tight',
          tone === 'default' && 'text-navy',
          tone === 'warn' && 'text-amber-700',
          tone === 'bad' && 'text-red-700',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function KpiGrid({ children, cols = 5 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = {
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
  } as const
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', map[cols])}>{children}</div>
}
