import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { BRAND_ICON, NAV } from '../../config/navigation'

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onClose,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onClose: () => void
}) {
  const Brand = BRAND_ICON
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-white transition-transform duration-200',
          'lg:static lg:z-20 lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        )}
      >
        {/* mobile drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-white">
              <Brand className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-navy">NIRF Insights</span>
          </div>
          <button type="button" aria-label="Close navigation" className="flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={cn('flex-1 overflow-y-auto px-2 py-3', collapsed && 'lg:overflow-visible')}>
          {NAV.map((section, i) => (
            <div key={section.heading} className={cn(i > 0 && 'mt-4')}>
              <p className={cn('mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400', collapsed && 'lg:hidden')}>
                {section.heading}
              </p>
              {collapsed && i > 0 && <div className="mx-3 mb-2 hidden border-t border-line lg:block" />}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                            collapsed && 'lg:justify-center lg:px-0',
                            isActive
                              ? 'bg-blue-50 font-semibold text-deep before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-ink',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-accent' : 'text-slate-400 group-hover:text-slate-600')} aria-hidden />
                            <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                            {collapsed && (
                              <span
                                role="tooltip"
                                className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded bg-navy px-2 py-1 text-xs font-medium text-white shadow-pop lg:group-hover:block lg:group-focus-visible:block"
                              >
                                {item.label}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-line p-2 lg:block">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('flex h-9 w-full items-center gap-2 rounded-md px-3 text-xs font-medium text-muted hover:bg-slate-50 hover:text-ink', collapsed && 'justify-center px-0')}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  )
}
