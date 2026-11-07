import { CATEGORIES, LATEST_YEAR, YEARS } from './constants'
import { RECORDS } from './rankings'
import { median } from '../../lib/mockMath'

export interface OverviewData {
  kpis: { institutions: number; records: number; years: number; categories: number; states: number }
  latest: {
    year: number
    records: number
    institutions: number
    medianOverallScore: number
    topState: string
  }
  categoryDistribution: { category: string; count: number }[]
  participation: { year: number; institutions: number; records: number }[]
  topInstitutions: { id: string; rank: number | null; institution: string; city: string; state: string; score: number | null }[]
}

export function buildOverview(): OverviewData {
  const latest = RECORDS.filter((r) => r.year === LATEST_YEAR)
  const overallScores = latest.filter((r) => r.category === 'Overall').map((r) => r.score as number)

  const stateCounts = new Map<string, number>()
  latest
    .filter((r) => r.category === 'Overall')
    .forEach((r) => stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1))
  const topState = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return {
    kpis: {
      institutions: new Set(RECORDS.map((r) => r.institutionId)).size,
      records: RECORDS.length,
      years: YEARS.length,
      categories: CATEGORIES.length,
      states: new Set(RECORDS.map((r) => r.state)).size,
    },
    latest: {
      year: LATEST_YEAR,
      records: latest.length,
      institutions: new Set(latest.map((r) => r.institutionId)).size,
      medianOverallScore: median(overallScores),
      topState,
    },
    categoryDistribution: CATEGORIES.map((category) => ({
      category,
      count: latest.filter((r) => r.category === category).length,
    })),
    participation: YEARS.map((year) => {
      const rows = RECORDS.filter((r) => r.year === year)
      return { year, institutions: new Set(rows.map((r) => r.institutionId)).size, records: rows.length }
    }),
    topInstitutions: latest
      .filter((r) => r.category === 'Overall')
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .slice(0, 10)
      .map((r) => ({ id: r.institutionId, rank: r.rank, institution: r.institution, city: r.city, state: r.state, score: r.score })),
  }
}
