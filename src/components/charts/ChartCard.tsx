import type { ReactNode } from 'react'
import { SectionCard } from '../ui/SectionCard'

/** Titled frame for a chart. Charts themselves stay logic-free (see PlotChart / SpecChart). */
export function ChartCard({
  title,
  subtitle,
  actions,
  footer,
  why,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  footer?: ReactNode
  /** one line naming the visualisation principle behind the chart choice */
  why?: string
  children: ReactNode
  className?: string
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} actions={actions} className={className}>
      {children}
      {(footer || why) && (
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
          {footer && <div>{footer}</div>}
          {why && (
            <p>
              <span className="font-semibold text-deep">Why this chart? </span>
              {why}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}
