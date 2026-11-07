import { Menu, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BRAND_ICON } from '../../config/navigation'
import { useGlobalFilters } from '../../context/GlobalFilters'
import { USE_MOCK } from '../../services/apiClient'
import { categoryOptions, yearOptions } from '../../data/selectors'
import { InstitutionSearch } from '../ui/InstitutionSearch'

export function Header({ onOpenNav }: { onOpenNav: () => void }) {
  const Brand = BRAND_ICON
  const { year, setYear, category, setCategory } = useGlobalFilters()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-4">
      <button
        type="button"
        aria-label="Open navigation"
        aria-controls="app-sidebar"
        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
        onClick={onOpenNav}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-white">
          <Brand className="h-4 w-4" aria-hidden />
        </span>
        <span className="hidden text-base font-bold tracking-tight text-navy sm:inline">
          NIRF <span className="text-accent">Insights</span>
        </span>
      </div>

      <div className="min-w-0 flex-1 sm:max-w-md sm:flex-none sm:basis-80">
        <InstitutionSearch placeholder="Search institutions…" />
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <select aria-label="Global year" className="field-control w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {yearOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Global category" className="field-control w-36" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-300 xl:inline-flex"
          title={USE_MOCK ? 'Showing generated demo data. Not actual NIRF results.' : 'Connected to the API'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${USE_MOCK ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
          {USE_MOCK ? 'Demo / Mock Data' : 'Live data'}
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={menu}
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 sm:h-9 sm:w-9"
            onClick={() => setMenu((m) => !m)}
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
          {menu && (
            <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-md border border-line bg-white p-3 text-sm shadow-pop">
              <p className="font-semibold text-ink">Settings</p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Data source</dt>
                  <dd className="font-medium text-ink">{USE_MOCK ? 'Demo / Mock Data' : 'FastAPI backend'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">API base URL</dt>
                  <dd className="truncate font-medium text-ink">{import.meta.env.VITE_API_BASE_URL ?? '/api'}</dd>
                </div>
              </dl>
              <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                Set VITE_USE_MOCK=false to read from the API once the backend exists.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
