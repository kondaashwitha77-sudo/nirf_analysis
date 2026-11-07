import { AlertTriangle } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { MOCK_DISCLAIMER } from '../../data/mock/constants'
import { USE_MOCK } from '../../services/apiClient'
import { LoadingState } from '../ui/States'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const KEY = 'nirf-sidebar-collapsed'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    document.getElementById('main-content')?.scrollTo({ top: 0 })
  }, [pathname])

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? '0' : '1')
      } catch {
        /* storage unavailable */
      }
      return !c
    })

  return (
    <div className="flex h-full flex-col bg-canvas">
      <Header onOpenNav={() => setMobileOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          {USE_MOCK && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <strong>Demo / Mock Data.</strong> {MOCK_DISCLAIMER}
              </span>
            </div>
          )}
          <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 sm:p-6">
              <Suspense fallback={<LoadingState label="Loading page…" className="py-24" />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
