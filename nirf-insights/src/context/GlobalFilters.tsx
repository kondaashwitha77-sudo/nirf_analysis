import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LATEST_YEAR } from '../data/mock/constants'

interface GlobalFilterState {
  year: number
  setYear: (y: number) => void
  category: string
  setCategory: (c: string) => void
}

const Ctx = createContext<GlobalFilterState | null>(null)

/** Year and category shared by the header and any page that exposes those controls. */
export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(LATEST_YEAR)
  const [category, setCategory] = useState('Overall')
  const value = useMemo(() => ({ year, setYear, category, setCategory }), [year, category])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGlobalFilters() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGlobalFilters must be used inside GlobalFiltersProvider')
  return v
}
