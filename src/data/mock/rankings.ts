import type { Institution, MissingReason, ParamKey, RankingRecord } from '../../types'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_SIZE,
  PARAM_KEYS,
  STATES,
  STATE_CITIES,
  YEARS,
} from './constants'

/* ------------------------------------------------------------------ */
/* Seeded RNG so the demo data is identical on every load.            */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20170925)
const gauss = () => {
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round2 = (v: number) => Math.round(v * 100) / 100

function pickState(): string {
  const total = STATES.reduce((s, x) => s + x.weight, 0)
  let r = rand() * total
  for (const s of STATES) {
    r -= s.weight
    if (r <= 0) return s.name
  }
  return STATES[0].name
}

/* ------------------------------------------------------------------ */
/* Institutions (fictional names, clearly labelled as demo)           */
/* ------------------------------------------------------------------ */
interface Latent extends Institution {
  base: number
  slope: number
  entry: number
  exit: number
}

const latents: Latent[] = []
let counter = 1
for (const cat of CATEGORIES.filter((c) => c !== 'Overall')) {
  const n = Math.round(CATEGORY_SIZE[cat] * 1.18)
  for (let i = 0; i < n; i++) {
    const state = pickState()
    const cities = STATE_CITIES[state] ?? [state]
    const city = cities[Math.floor(rand() * cities.length)]
    const entry = rand() < 0.86 ? YEARS[0] : YEARS[1 + Math.floor(rand() * 6)]
    const exit = rand() < 0.07 ? YEARS[2 + Math.floor(rand() * 6)] : YEARS[YEARS.length - 1]
    latents.push({
      id: `inst-${String(counter).padStart(4, '0')}`,
      name: `Demo ${CATEGORY_LABEL[cat]} ${String(i + 1).padStart(2, '0')}, ${city}`,
      city,
      state,
      primaryCategory: cat,
      base: Math.pow(rand(), 0.85),
      slope: (rand() - 0.5) * 0.035,
      entry,
      exit,
    })
    counter++
  }
}

export const INSTITUTIONS: Institution[] = latents.map(({ id, name, city, state, primaryCategory }) => ({
  id,
  name,
  city,
  state,
  primaryCategory,
}))

/* ------------------------------------------------------------------ */
/* Parameter availability: absence always carries a reason            */
/* ------------------------------------------------------------------ */
export function structuralAvailability(
  category: string,
  year: number,
  p: ParamKey,
): MissingReason | null {
  if (p === 'Perception' && year >= 2022) return 'not_published'
  if (p === 'OI' && year === 2017) return 'not_published'
  if (category === 'Innovation' && !['RPC', 'OI', 'Perception', 'GO'].includes(p)) return 'not_applicable'
  return null
}

/* ------------------------------------------------------------------ */
/* Records                                                            */
/* ------------------------------------------------------------------ */
interface Scored {
  inst: Latent
  latent: number
  score: number
}

function rankYearCategory(year: number, pool: Latent[], size: number): Scored[] {
  const scored: Scored[] = pool
    .filter((i) => i.entry <= year && i.exit >= year)
    .map((inst) => {
      const latent = clamp(inst.base + inst.slope * (year - YEARS[0]) + gauss() * 0.035, 0, 1)
      return { inst, latent, score: round2(clamp(30 + latent * 62 + gauss() * 0.4, 30, 94)) }
    })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, size)
}

const records: RankingRecord[] = []
let rid = 1

function pushRecord(category: string, year: number, rankPos: number, s: Scored) {
  let rank: number | null = rankPos
  let rankType: RankingRecord['rankType'] = 'exact'
  if (rand() < 0.012) {
    rank = null
    rankType = 'unavailable'
  }

  const params = {} as Record<ParamKey, number | null>
  const paramReasons: RankingRecord['paramReasons'] = {}
  for (const p of PARAM_KEYS) {
    const structural = structuralAvailability(category, year, p)
    if (structural) {
      params[p] = null
      paramReasons[p] = structural
      continue
    }
    const roll = rand()
    if (roll < 0.025) {
      params[p] = null
      paramReasons[p] = 'missing'
    } else if (roll < 0.032) {
      params[p] = null
      paramReasons[p] = 'parser_failure'
    } else if (roll < 0.035) {
      params[p] = null
      paramReasons[p] = 'invalid'
    } else {
      params[p] = round2(clamp(s.score + gauss() * 9 + (p === 'Perception' ? -6 : 0), 15, 100))
    }
  }

  records.push({
    id: rid++,
    year,
    category,
    institutionId: s.inst.id,
    institution: s.inst.name,
    city: s.inst.city,
    state: s.inst.state,
    rank,
    rankType,
    score: s.score,
    params,
    paramReasons,
  })
}

for (const year of YEARS) {
  const overallPool: Scored[] = []
  for (const cat of CATEGORIES.filter((c) => c !== 'Overall')) {
    const pool = latents.filter((l) => l.primaryCategory === cat)
    const ranked = rankYearCategory(year, pool, CATEGORY_SIZE[cat])
    ranked.forEach((s, idx) => pushRecord(cat, year, idx + 1, s))
    if (cat !== 'Innovation' && cat !== 'College') overallPool.push(...ranked)
  }
  overallPool.sort((a, b) => b.score - a.score)
  overallPool.slice(0, CATEGORY_SIZE.Overall).forEach((s, idx) => pushRecord('Overall', year, idx + 1, s))
}

// Flag a few records as duplicate candidates (near-identical entries to review).
for (let i = 0; i < 9; i++) {
  const r = records[Math.floor(rand() * records.length)]
  r.duplicateCandidate = true
}

export const RECORDS: RankingRecord[] = records

function buildInstitutionOptions() {
  return Array.from(new Map(RECORDS.map((r) => [r.institutionId, r.institution])).entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Filled in place so live data can replace the demo data before pages import these. */
export const INSTITUTION_OPTIONS: { value: string; label: string }[] = buildInstitutionOptions()
export const STATE_OPTIONS: string[] = STATES.map((s) => s.name).sort()

export function refreshOptions() {
  INSTITUTION_OPTIONS.splice(0, INSTITUTION_OPTIONS.length, ...buildInstitutionOptions())
  STATE_OPTIONS.splice(0, STATE_OPTIONS.length, ...STATES.map((s) => s.name).sort())
}
