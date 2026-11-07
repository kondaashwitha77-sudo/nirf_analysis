import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { institutionPath } from '../../data/selectors'
import { cn } from '../../lib/cn'

/** An institution name that opens its profile, keeping the surrounding text style. */
export function InstitutionLink({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <Link to={institutionPath(id)} className={cn('hover:underline', className)}>
      {children}
    </Link>
  )
}
