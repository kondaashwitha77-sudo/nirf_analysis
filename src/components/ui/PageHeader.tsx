import type { ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'

export function PageHeader({
  title,
  description,
  actions,
  showMockBadge = true,
}: {
  title: string
  description?: string
  actions?: ReactNode
  showMockBadge?: boolean
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">{title}</h1>
          {showMockBadge && <StatusBadge variant="mock" />}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
