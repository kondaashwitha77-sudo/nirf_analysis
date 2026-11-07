import type { ReactNode } from 'react'
import { SectionCard } from '../ui/SectionCard'

/** Titled frame for a chart. Charts themselves stay logic-free (see PlotChart / SpecChart). */
export function ChartCard({
  title,
  subtitle,
  actions,
  footer,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} actions={actions} className={className}>
      {children}
      {footer && <div className="mt-3 border-t border-line pt-3 text-xs text-muted">{footer}</div>}
    </SectionCard>
  )
}
