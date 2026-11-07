import type { Option, ParamKey, RankingRecord } from '../types'
import { CATEGORIES, LATEST_YEAR, PARAMS, YEARS } from './mock/constants'
import { RECORDS } from './mock/rankings'

export const METRIC_OPTIONS: Option[] = [
  { value: 'score', label: 'Overall Score' },
  { value: 'rank', label: 'Rank (exact only)' },
  ...PARAMS.map((p) => ({ value: p.key as string, label: `${p.label} score` })),
]

export const SCORE_METRIC_OPTIONS: Option[] = METRIC_OPTIONS.filter((m) => m.value !== 'rank')

export const metricLabel = (metric: string) =>
  METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric

/** Returns null (never 0) when a value is unavailable. */
export function metricValue(r: RankingRecord, metric: string): number | null {
  if (metric === 'rank') return r.rankType === 'exact' ? r.rank : null
  if (metric === 'score') return r.score
  return r.params[metric as ParamKey] ?? null
}

export interface RecordFilter {
  year?: number
  yearRange?: [number, number]
  category?: string
  state?: string
  institutionIds?: string[]
}

export function selectRecords(f: RecordFilter = {}): RankingRecord[] {
  return RECORDS.filter((r) => {
    if (f.year !== undefined && r.year !== f.year) return false
    if (f.yearRange && (r.year < f.yearRange[0] || r.year > f.yearRange[1])) return false
    if (f.category && r.category !== f.category) return false
    if (f.state && r.state !== f.state) return false
    if (f.institutionIds && !f.institutionIds.includes(r.institutionId)) return false
    return true
  })
}

/** Records for a category-year, ordered best first (missing scores last). */
export function topRecords(category: string, year: number, n: number): RankingRecord[] {
  return selectRecords({ category, year })
    .slice()
    .sort((a, b) => (a.score === null ? 1 : b.score === null ? -1 : b.score - a.score))
    .slice(0, n)
}

export const institutionPath = (id: string) => `/institution/${encodeURIComponent(id)}`

export interface InstitutionEntry {
  id: string
  name: string
  city: string
  state: string
  type?: string
}

/** One entry per institution, taken from its latest record. */
export function listInstitutions(): InstitutionEntry[] {
  const latest = new Map<string, RankingRecord>()
  RECORDS.forEach((r) => {
    const cur = latest.get(r.institutionId)
    if (!cur || r.year > cur.year) latest.set(r.institutionId, r)
  })
  return [...latest.values()].map((r) => ({ id: r.institutionId, name: r.institution, city: r.city, state: r.state, type: r.institutionType }))
}

export const yearOptions: Option[] = YEARS.map((y) => ({ value: String(y), label: String(y) }))
export const categoryOptions: Option[] = CATEGORIES.map((c) => ({ value: c, label: c }))
export const yearsBetween = (start: number, end: number) => YEARS.filter((y) => y >= start && y <= end)
export { LATEST_YEAR, YEARS, CATEGORIES }
