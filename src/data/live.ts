import type { ParamKey, RankingRecord } from '../types'
import { apiClient } from '../services/apiClient'
import { CATEGORIES, STATES, YEARS } from './mock/constants'
import type { StateInfo } from './mock/constants'
import { RECORDS, refreshOptions } from './mock/rankings'

/** Row shape returned by GET /api/rankings/all (see backend app/schemas/ranking.py). */
export interface ApiRow {
  year: number
  category: string
  canonical_institution_id: string
  institution: string
  institution_type: string
  city: string | null
  state: string | null
  zone: string | null
  rank: number | null
  overall_score: number | null
  tlr_score: number | null
  rpc_score: number | null
  go_score: number | null
  oi_score: number | null
  perception_score: number | null
}

/** Approximate state / UT centroids for the bubble map. */
const CENTROIDS: Record<string, [number, number]> = {
  'Andaman and Nicobar Islands': [11.7, 92.7], 'Andhra Pradesh': [15.9, 79.7], 'Arunachal Pradesh': [28.2, 94.7],
  Assam: [26.2, 92.9], Bihar: [25.6, 85.6], Chandigarh: [30.7, 76.8], Chhattisgarh: [21.3, 81.7], Delhi: [28.6, 77.2],
  Goa: [15.3, 74.1], Gujarat: [22.3, 71.2], Haryana: [29.1, 76.1], 'Himachal Pradesh': [31.9, 77.2],
  'Jammu and Kashmir': [33.8, 76.6], Jharkhand: [23.6, 85.3], Karnataka: [15.3, 75.7], Kerala: [10.5, 76.3],
  'Madhya Pradesh': [23.5, 78.3], Maharashtra: [19.7, 75.7], Manipur: [24.8, 93.9], Meghalaya: [25.5, 91.4],
  Mizoram: [23.2, 92.9], Nagaland: [26.1, 94.6], Odisha: [20.5, 84.4], Puducherry: [11.9, 79.8], Punjab: [31.1, 75.3],
  Rajasthan: [27.0, 74.2], Sikkim: [27.6, 88.5], 'Tamil Nadu': [11.1, 78.7], Telangana: [17.9, 79.1],
  Tripura: [23.8, 91.7], 'Uttar Pradesh': [26.8, 80.9], Uttarakhand: [30.1, 79.2], 'West Bengal': [22.9, 87.8],
}

const CATEGORY_ORDER = [
  'Overall', 'University', 'Engineering', 'College', 'Management', 'Pharmacy', 'Medical', 'Law',
  'Architecture and Planning', 'Research', 'Dental', 'Agriculture and Allied Sectors', 'State Public University',
]

export function toRecord(r: ApiRow, id: number): RankingRecord {
  const params: Record<ParamKey, number | null> = {
    TLR: r.tlr_score, RPC: r.rpc_score, GO: r.go_score,
    OI: r.oi_score, Perception: r.perception_score,
  }
  const paramReasons: RankingRecord['paramReasons'] = {}
  ;(Object.keys(params) as ParamKey[]).forEach((k) => {
    if (params[k] === null) paramReasons[k] = 'not_published'
  })
  return {
    id,
    year: r.year,
    category: r.category,
    institutionId: r.canonical_institution_id,
    institution: r.institution,
    city: r.city ?? '—',
    state: r.state ?? 'Unknown',
    rank: r.rank,
    rankType: r.rank !== null ? 'exact' : 'unavailable',
    score: r.overall_score,
    params,
    paramReasons,
    zone: r.zone ?? undefined,
    institutionType: r.institution_type,
  }
}

/**
 * Replaces the demo data with the real NIRF records, in place, so every page and selector
 * that already reads RECORDS / YEARS / CATEGORIES / STATES sees the live data.
 * Must run before the app's pages are imported (see main.tsx). The tests share this.
 */
export function applyRows(data: ApiRow[]): number {
  const records = data.map((r, i) => toRecord(r, i + 1))
  RECORDS.splice(0, RECORDS.length, ...records)

  const years = [...new Set(records.map((r) => r.year))].sort((a, b) => a - b)
  YEARS.splice(0, YEARS.length, ...years)

  const present = new Set(records.map((r) => r.category))
  const cats = [...CATEGORY_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort()]
  CATEGORIES.splice(0, CATEGORIES.length, ...cats)

  const states: StateInfo[] = [...new Set(records.map((r) => r.state))]
    .filter((s) => CENTROIDS[s])
    .sort()
    .map((name) => ({ name, lat: CENTROIDS[name][0], lon: CENTROIDS[name][1], weight: 1 }))
  STATES.splice(0, STATES.length, ...states)

  refreshOptions()
  return records.length
}

export async function loadLiveData(): Promise<number> {
  const { data } = await apiClient.get<ApiRow[]>('/rankings/all', { timeout: 60_000 })
  if (!Array.isArray(data) || data.length === 0) throw new Error('The API returned no ranking records.')
  return applyRows(data)
}
