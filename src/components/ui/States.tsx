import { AlertTriangle, Ban, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { REASON_HELP, REASON_LABEL } from '../../lib/format'
import type { MissingReason } from '../../types'

const wrap = 'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center'

export function EmptyState({
  title = 'No data for this selection',
  message = 'Try widening the filters or choosing a different year or category.',
  action,
  className,
}: {
  title?: string
  message?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(wrap, className)}>
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn(wrap, className)} role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}

export function ErrorState({
  message = 'Something went wrong while loading this view.',
  onRetry,
  className,
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn(wrap, className)} role="alert">
      <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden />
      <p className="text-sm font-semibold text-ink">Unable to load</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Block version explains why data is absent; `inline` is for table cells. Absence is never shown as 0. */
export function NotAvailableState({
  reason = 'not_published',
  inline = false,
  className,
}: {
  reason?: MissingReason
  inline?: boolean
  className?: string
}) {
  if (inline) {
    return (
      <span className={cn('text-xs italic text-slate-400', className)} title={REASON_HELP[reason]}>
        {REASON_LABEL[reason]}
      </span>
    )
  }
  return (
    <div className={cn(wrap, className)}>
      <Ban className="h-7 w-7 text-slate-300" aria-hidden />
      <p className="text-sm font-semibold text-ink">{REASON_LABEL[reason]}</p>
      <p className="max-w-sm text-sm text-muted">{REASON_HELP[reason]}</p>
    </div>
  )
}
