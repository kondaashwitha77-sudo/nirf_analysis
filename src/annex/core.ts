/* Annexure A engine: shared types + helpers. Pure functions over the in-memory RECORDS array. */
import type { Data } from 'plotly.js-dist-min'
import { CATEGORIES, YEARS } from '../data/mock/constants'
import { RECORDS } from '../data/mock/rankings'
import type { RankingRecord } from '../types'
import { describe, mean, numbers, pearson, quantile, std } from '../lib/stats'

export { describe, mean, numbers, pearson, quantile, std }
export type Rec = RankingRecord

export type PKey = 'TLR' | 'RPC' | 'GO' | 'OI' | 'Perception'
export const PK: PKey[] = ['TLR', 'RPC', 'GO', 'OI', 'Perception']
export const PLABEL: Record<string, string> = {
  score: 'Overall score',
  rank: 'Rank',
  TLR: 'TLR',
  RPC: 'RPC',
  GO: 'GO',
  OI: 'OI',
  Perception: 'Perception (PR)',
}
export const ATTR_OPTIONS = ['score', 'TLR', 'RPC', 'GO', 'OI', 'Perception', 'rank'].map((v) => ({ value: v, label: PLABEL[v] }))
export const PARAM_OPTIONS = PK.map((v) => ({ value: v, label: PLABEL[v] }))

export const COLORWAY = ['#0E7C86', '#D55E00', '#0072B2', '#CC79A7', '#E69F00', '#56B4E9', '#6B7280']
export const TEAL = '#0E7C86'
export const GREY = '#9CA3AF'
export const BLUE = '#2166AC'
export const ORANGE = '#B35806'
export const QSHADES = ['#CDEBEB', '#7CC3C8', '#2C9AA3', '#0B4F57']

export interface Args {
  category: string
  year: number
  year2: number
  state: string
  state2: string
  institutions: string[]
  param: string
  param2: string
  attrX: string
  attrY: string
  topN: number
  minYears: number
  bandSize: number
  cut: number
  z: number
  pctHigh: number
  pctLow: number
  basis: string
  trend: boolean
  bins: number
  minCount: number
}

export interface Ch {
  title: string
  data: Data[]
  why: string
  xTitle?: string
  yTitle?: string
  showLegend?: boolean
  reverseY?: boolean
  yFromZero?: boolean
  height?: number
  legendRows?: number
  layout?: Record<string, unknown>
}
export type Row = Record<string, string | number | null>
export interface Res {
  answer: string
  chips: string[]
  kpis?: { label: string; value: string }[]
  maps?: { title: string; counts: Record<string, number>; max: number }[]
  charts: Ch[]
  table?: { columns: { key: string; header: string }[]; rows: Row[] }
  /** machine-readable facts, used by tests */
  facts?: Record<string, number | string | string[]>
}

/* ------------------------------ data access ------------------------------ */
let _n = -1
let _idx = new Map<string, Rec[]>()
function idx() {
  if (_n !== RECORDS.length) {
    _n = RECORDS.length
    _idx = new Map()
    for (const r of RECORDS) {
      if (r.rank == null) continue
      const k = r.category + '|' + r.year
      const a = _idx.get(k)
      if (a) a.push(r)
      else _idx.set(k, [r])
    }
    for (const a of _idx.values()) a.sort((x, y) => (x.rank as number) - (y.rank as number))
  }
  return _idx
}
export const rows = (cat: string, year: number): Rec[] => idx().get(cat + '|' + year) ?? []
export const catYears = (cat: string): number[] => YEARS.filter((y) => rows(cat, y).length > 0)
export const allCategories = (): string[] => CATEGORIES.filter((c) => catYears(c).length > 0)
export const topRows = (cat: string, year: number, n: number): Rec[] => rows(cat, year).filter((r) => (r.rank as number) <= n)
export function val(r: Rec, a: string): number | null {
  if (a === 'score') return r.score
  if (a === 'rank') return r.rank
  return r.params[a as PKey] ?? null
}
export const byId = (cat: string, year: number): Map<string, Rec> => new Map(rows(cat, year).map((r) => [r.institutionId, r]))
export function nameOf(id: string, cat?: string): string {
  const r = cat ? RECORDS.find((x) => x.institutionId === id && x.category === cat) : RECORDS.find((x) => x.institutionId === id)
  return r?.institution ?? RECORDS.find((x) => x.institutionId === id)?.institution ?? id
}
export function institutionOptions(cat: string): { value: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const y of catYears(cat)) for (const r of rows(cat, y)) if (!seen.has(r.institutionId)) seen.set(r.institutionId, r.institution)
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}
export const stateList = (): string[] => [...new Set(RECORDS.map((r) => r.state).filter(Boolean))].sort()
export function countByState(rs: Rec[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const r of rs) if (r.state) c[r.state] = (c[r.state] ?? 0) + 1
  return c
}
/** history of an institution within a category: year -> record */
export function history(cat: string, id: string): Map<number, Rec> {
  const m = new Map<number, Rec>()
  for (const y of catYears(cat)) {
    const r = byId(cat, y).get(id)
    if (r) m.set(y, r)
  }
  return m
}
export const pairs = (cat: string, a: number, b: number): [number, number][] => {
  const ys = catYears(cat).filter((y) => y >= a && y <= b)
  return ys.slice(1).map((y, i) => [ys[i], y] as [number, number])
}
export const short = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
export const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '–')
export const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '–')
export const f3 = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '–')
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function defaults(): Args {
  const cat = allCategories().includes('Overall') ? 'Overall' : allCategories()[0] ?? 'Overall'
  const ys = catYears(cat)
  const last = ys[ys.length - 1] ?? 2025
  const top = topRows(cat, last, 3).map((r) => r.institutionId)
  return {
    category: cat, year: last, year2: last, state: 'Karnataka', state2: 'Tamil Nadu', institutions: top,
    param: 'RPC', param2: 'TLR', attrX: 'TLR', attrY: 'RPC', topN: 10, minYears: 2, bandSize: 10, cut: 50, z: 2,
    pctHigh: 75, pctLow: 50, basis: 'year', trend: true, bins: 15, minCount: 3,
  }
}

/* --------------------------------- charts -------------------------------- */
export function ols(xs: number[], ys: number[]) {
  const mx = mean(xs), my = mean(ys)
  let sxx = 0, sxy = 0
  xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my) })
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, intercept: my - slope * mx }
}
export const strength = (r: number) => {
  const a = Math.abs(r)
  const w = a >= 0.8 ? 'very strong' : a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'very weak'
  return `${w} ${r >= 0 ? 'positive' : 'negative'}`
}

export function hbar(labels: string[], values: number[], opt: { color?: string | string[]; text?: string[]; hover?: string[]; name?: string } = {}): Data {
  // horizontal bars, best at the top (plotly draws first category at the bottom, so reverse)
  return {
    type: 'bar', orientation: 'h', y: labels.slice().reverse(), x: values.slice().reverse(),
    marker: { color: Array.isArray(opt.color) ? opt.color.slice().reverse() : opt.color ?? TEAL },
    text: opt.text ? opt.text.slice().reverse() : values.slice().reverse().map((v) => String(Math.round(v * 100) / 100)),
    textposition: 'outside', cliponaxis: false, name: opt.name,
    hovertext: opt.hover ? opt.hover.slice().reverse() : undefined, hoverinfo: opt.hover ? 'text' : undefined,
  } as Data
}
export const tallH = (n: number) => Math.max(260, 56 + n * 26)

export function scatterChart(
  pts: { x: number; y: number; label: string; flag?: boolean }[],
  xKey: string, yKey: string, trend: boolean, title: string, why: string, extra: { annotate?: boolean; shapes?: unknown[] } = {},
): { ch: Ch; r: number; n: number; slope: number; intercept: number } {
  const { r, n } = pearson(pts.map((p) => p.x), pts.map((p) => p.y))
  const fit = ols(pts.map((p) => p.x), pts.map((p) => p.y))
  const data: Data[] = []
  const base = pts.filter((p) => !p.flag), hot = pts.filter((p) => p.flag)
  data.push({ type: 'scatter', mode: 'markers', x: base.map((p) => p.x), y: base.map((p) => p.y), text: base.map((p) => p.label), name: 'Institutions',
    marker: { color: hot.length ? GREY : TEAL, size: 8, opacity: 0.75 }, hovertemplate: `%{text}<br>${PLABEL[xKey] ?? xKey}: %{x:.2f}<br>${PLABEL[yKey] ?? yKey}: %{y:.2f}<extra></extra>` } as Data)
  if (hot.length) data.push({ type: 'scatter', mode: extra.annotate && hot.length <= 4 ? 'markers+text' : 'markers', x: hot.map((p) => p.x), y: hot.map((p) => p.y), text: hot.map((p) => short(p.label, 22)),
    textposition: 'top center', textfont: { size: 10 }, name: 'Flagged', marker: { color: ORANGE, size: 10 }, hovertext: hot.map((p) => p.label), hoverinfo: 'text' } as Data)
  if (trend && pts.length > 2) {
    const xs = pts.map((p) => p.x), lo = Math.min(...xs), hi = Math.max(...xs)
    data.push({ type: 'scatter', mode: 'lines', x: [lo, hi], y: [fit.intercept + fit.slope * lo, fit.intercept + fit.slope * hi], name: `Trend (r = ${f2(r)})`, line: { color: '#111827', width: 2, dash: 'dot' }, hoverinfo: 'skip' } as Data)
  }
  return {
    ch: { title, data, why, xTitle: PLABEL[xKey] ?? xKey, yTitle: PLABEL[yKey] ?? yKey, showLegend: hot.length > 0 || trend, height: 400,
      reverseY: yKey === 'rank', layout: extra.shapes ? { shapes: extra.shapes } : undefined },
    r, n, slope: fit.slope, intercept: fit.intercept,
  }
}

export function boxTrace(name: string, values: number[], color = TEAL, orientation: 'v' | 'h' = 'v', labels?: string[]): Data {
  return { type: 'box', name, [orientation === 'v' ? 'y' : 'x']: values, boxpoints: 'outliers', marker: { color, size: 4 }, line: { color }, fillcolor: color + '33', orientation, text: labels,
    hoverinfo: 'y+x+text', boxmean: false } as unknown as Data
}

export function heat(z: number[][], x: (string | number)[], y: string[], opt: { diverging?: boolean; fmt?: (v: number) => string; zmin?: number; zmax?: number } = {}): Data {
  return {
    type: 'heatmap', z, x: x.map(String), y, xgap: 2, ygap: 2,
    colorscale: opt.diverging ? [[0, ORANGE], [0.5, '#F7F7F7'], [1, BLUE]] : [[0, '#E6F4F4'], [0.5, '#4FB3BA'], [1, '#0B3B3C']],
    zmin: opt.zmin, zmax: opt.zmax, zmid: opt.diverging ? 0 : undefined,
    text: z.map((row) => row.map((v) => (opt.fmt ? opt.fmt(v) : String(v)))), texttemplate: '%{text}', textfont: { size: 11 },
    hovertemplate: '%{y}<br>%{x}: %{text}<extra></extra>', colorbar: { thickness: 12 },
  } as unknown as Data
}

export const table = (columns: [string, string][], rows: Row[]) => ({ columns: columns.map(([key, header]) => ({ key, header })), rows })
