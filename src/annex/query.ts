/* Generic query engine for the AI Analyst. The language model only fills in a QueryPlan; every number here is
   computed from the loaded NIRF records. Pure functions, never throws. */
import type { Data } from 'plotly.js-dist-min'
import { CATEGORIES, YEARS } from '../data/mock/constants'
import { RECORDS } from '../data/mock/rankings'
import {
  COLORWAY, PLABEL, TEAL, countByState, f1, f2, hbar, mean, quantile, scatterChart, short, table, tallH, val,
  type Ch, type Rec, type Res,
} from './core'

export type Op = 'top' | 'bottom' | 'aggregate' | 'trend' | 'correlation' | 'lookup'
export type Agg = 'count' | 'mean' | 'median' | 'min' | 'max' | 'sum'
export type GroupBy = 'none' | 'state' | 'category' | 'year' | 'institution'

export interface QueryPlan {
  op: Op
  metric: string
  metric2?: string
  agg?: Agg
  groupBy?: GroupBy
  categories: string[]
  years: number[]
  states: string[]
  /** resolved institution ids */
  ids: string[]
  topN?: number
  rankMax?: number | null
  institutionType?: string
}

/** What the engine really used. The verifier compares this with the plan. */
export interface Used {
  op: Op
  metric: string
  metric2?: string
  years: number[]
  categories: string[]
  states: string[]
  ids: string[]
  notes: string[]
}
export interface QueryResult { res: Res; used: Used }

const METRICS = ['score', 'rank', 'TLR', 'RPC', 'GO', 'OI', 'Perception']
export const normMetric = (m?: string): string | null => {
  if (!m) return null
  const k = m.trim().toLowerCase().replace(/[^a-z]/g, '')
  const hit = METRICS.find((x) => x.toLowerCase() === k)
  if (hit) return hit
  if (['overall', 'overallscore', 'totalscore', 'total', 'points', 'marks'].includes(k)) return 'score'
  if (['ranking', 'position', 'nirfrank'].includes(k)) return 'rank'
  if (k === 'pr' || k === 'perceptionscore') return 'Perception'
  if (k === 'research' || k === 'researchscore') return 'RPC'
  if (k === 'teaching' || k === 'teachingscore') return 'TLR'
  if (k === 'graduationoutcomes' || k === 'placement') return 'GO'
  if (k === 'outreach' || k === 'inclusivity') return 'OI'
  return null
}
const label = (m: string) => PLABEL[m] ?? m
const fmt = (m: string, v: number) => (m === 'rank' ? String(Math.round(v)) : f2(v))
const LOWER_BETTER = (m: string) => m === 'rank'

const TYPE_RE: Record<string, RegExp> = {
  IIT: /^indian institute of technology/i, NIT: /^national institute of technology/i, IIIT: /^indian institute of information technology/i,
  IISER: /^indian institute of science education/i, AIIMS: /^all india institute of medical/i,
}

/* ------------------------------- data access ------------------------------ */
let _n = -1
let _ix = new Map<string, Rec[]>()
function ix() {
  if (_n !== RECORDS.length) {
    _n = RECORDS.length
    _ix = new Map()
    for (const r of RECORDS) {
      const k = r.category + '|' + r.year
      const a = _ix.get(k)
      if (a) a.push(r)
      else _ix.set(k, [r])
    }
  }
  return _ix
}
const pool = (cat: string, year: number): Rec[] => ix().get(cat + '|' + year) ?? []
const yearsOf = (cat: string): number[] => YEARS.filter((y) => pool(cat, y).length > 0)
const catsWithData = (): string[] => CATEGORIES.filter((c) => yearsOf(c).length > 0)

function keep(r: Rec, p: QueryPlan, metric: string): boolean {
  if (p.states.length && !p.states.some((s) => s.toLowerCase() === (r.state ?? '').toLowerCase())) return false
  if (p.ids.length && !p.ids.includes(r.institutionId)) return false
  if (p.institutionType && TYPE_RE[p.institutionType.toUpperCase()] && !TYPE_RE[p.institutionType.toUpperCase()].test(r.institution)) return false
  if (p.rankMax != null && (r.rank == null || r.rank > p.rankMax)) return false
  if (metric !== 'count' && val(r, metric) == null) return false
  return true
}

/** Categories and years the plan really refers to, with notes when the data has no such year/category. */
function resolveScope(p: QueryPlan): { combos: { cat: string; year: number }[]; cats: string[]; years: number[]; notes: string[] } {
  const notes: string[] = []
  const all = catsWithData()
  let cats = p.categories.filter((c) => all.includes(c))
  const dropped = p.categories.filter((c) => !all.includes(c))
  if (dropped.length) notes.push(`No data for ${dropped.join(', ')}.`)
  if (!cats.length && p.groupBy === 'category') cats = all
  if (!cats.length) {
    if (p.ids.length) {
      const counts = new Map<string, number>()
      for (const r of RECORDS) if (p.ids.includes(r.institutionId)) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
      cats = counts.has('Overall') ? ['Overall'] : [...counts].sort((a, b) => b[1] - a[1]).slice(0, 1).map((x) => x[0])
    }
    if (!cats.length) cats = [all.includes('Overall') ? 'Overall' : all[0]]
  }
  const combos: { cat: string; year: number }[] = []
  const usedYears = new Set<number>()
  const missing = new Set<number>()
  for (const cat of cats) {
    const have = yearsOf(cat)
    const want = p.years.length ? p.years : p.op === 'trend' || p.groupBy === 'year' ? have : [have[have.length - 1]]
    for (const y of want) {
      if (have.includes(y)) { combos.push({ cat, year: y }); usedYears.add(y) } else missing.add(y)
    }
  }
  if (missing.size) {
    const have = [...new Set(cats.flatMap(yearsOf))].sort((a, b) => a - b)
    notes.push(`${cats.join(', ')} has no ranking for ${[...missing].sort().join(', ')}${have.length ? ` (available: ${have[0]}–${have[have.length - 1]})` : ''}.`)
  }
  return { combos, cats, years: [...usedYears].sort((a, b) => a - b), notes }
}

const empty = (answer: string, used: Used, chips: string[] = []): QueryResult => ({ res: { answer, chips, charts: [] }, used })
const chipsFor = (u: Used, extra: string[] = []) => [
  label(u.metric) + (u.metric2 ? ` vs ${label(u.metric2)}` : ''),
  u.categories.join(', '),
  u.years.length > 1 ? `${u.years[0]}–${u.years[u.years.length - 1]}` : u.years.join(''),
  ...u.states, ...extra,
].filter(Boolean)
const scopeText = (u: Used) => `${u.categories.length > 3 ? `${u.categories.length} categories` : u.categories.join(' + ')}, ${u.years.length > 1 ? `${u.years[0]}–${u.years[u.years.length - 1]}` : u.years[0]}`
const line = (name: string, xs: number[], ys: (number | null)[], color: string): Data =>
  ({ type: 'scatter', mode: 'lines+markers', name, x: xs, y: ys, connectgaps: false, line: { color, width: 2 }, marker: { size: 6 } }) as Data

/* --------------------------------- engine --------------------------------- */
export function runQuery(p: QueryPlan): QueryResult {
  const metric = normMetric(p.metric) ?? 'score'
  const metric2 = normMetric(p.metric2) ?? undefined
  const scope = resolveScope(p)
  const used: Used = { op: p.op, metric, metric2, years: scope.years, categories: scope.cats, states: p.states, ids: p.ids, notes: scope.notes }
  try {
    if (!scope.combos.length) return empty(`There is no ranking data for that selection. ${scope.notes.join(' ')}`.trim(), { ...used, notes: [] })
    switch (p.op) {
      case 'top': case 'bottom': return rankList(p, metric, scope, used)
      case 'aggregate': return aggregate(p, metric, scope, used)
      case 'trend': return trend(p, metric, scope, used)
      case 'correlation': return correlation(p, metric, metric2 ?? (metric === 'score' ? 'RPC' : 'score'), scope, used)
      case 'lookup': return lookup(p, metric, scope, used)
      default: return empty('I could not turn that into a supported analysis.', used)
    }
  } catch {
    return empty('There is not enough data for this selection. Try another year, category or metric.', used)
  }
}

type Scope = ReturnType<typeof resolveScope>

function ordered(rs: Rec[], metric: string, best: boolean): Rec[] {
  const asc = LOWER_BETTER(metric) ? best : !best
  return rs.slice().sort((a, b) => ((val(a, metric) as number) - (val(b, metric) as number)) * (asc ? 1 : -1) || (a.rank ?? 1e9) - (b.rank ?? 1e9))
}

function rankList(p: QueryPlan, metric: string, sc: Scope, used: Used): QueryResult {
  const best = p.op === 'top'
  const n = Math.max(1, Math.min(p.topN ?? 10, 50))
  const word = LOWER_BETTER(metric) ? (best ? 'best' : 'worst') : best ? 'highest' : 'lowest'
  const groups = sc.combos.map((c) => ({ ...c, rs: ordered(pool(c.cat, c.year).filter((r) => keep(r, p, metric)), metric, best) })).filter((g) => g.rs.length)
  if (!groups.length) return empty(`No institutions have a ${label(metric)} value for that selection.`, used)
  const rows = groups.flatMap((g) => g.rs.slice(0, n).map((r, i) => ({ '#': i + 1, institution: r.institution, state: r.state, category: g.cat, year: g.year, value: val(r, metric), rank: r.rank, score: r.score })))
  const tbl = table([['#', '#'], ['institution', 'Institution'], ['state', 'State'], ['category', 'Category'], ['year', 'Year'], ['value', label(metric)], ['rank', 'Rank'], ['score', 'Score']], rows)
  const charts: Ch[] = []
  const facts: Res['facts'] = { metric, op: p.op, categories: sc.cats.join(','), years: sc.years.join(','), leader: groups[0].rs[0].institution }
  let answer: string
  if (groups.length === 1) {
    const g = groups[0], shown = g.rs.slice(0, Math.max(n, 5)).slice(0, 15)
    const lead = g.rs[0], v = val(lead, metric) as number
    const ties = g.rs.filter((r) => val(r, metric) === v).length
    answer = n === 1
      ? `${lead.institution} (${lead.state}) has the ${word} ${label(metric)} in ${g.cat}, ${g.year}: ${fmt(metric, v)}.${ties > 1 ? ` ${ties - 1} other institution(s) share this value.` : ''}`
      : `Top ${Math.min(n, g.rs.length)} by ${label(metric)} in ${g.cat}, ${g.year}: ${g.rs.slice(0, Math.min(n, 3)).map((r) => r.institution).join(', ')}${n > 3 ? ' …' : ''}. ${word === 'lowest' || word === 'worst' ? 'These are the lowest values.' : ''}`.trim()
    charts.push({
      title: `${best ? 'Highest' : 'Lowest'} ${label(metric)} · ${g.cat} ${g.year}`, why: 'A sorted horizontal bar chart ranks institutions on one measure, starting at zero so bar length is honest.',
      data: [hbar(shown.map((r) => short(r.institution, 40)), shown.map((r) => val(r, metric) as number), { text: shown.map((r) => fmt(metric, val(r, metric) as number)) })],
      height: tallH(shown.length), xTitle: label(metric), yFromZero: true, showLegend: false,
    })
  } else {
    answer = `${best ? 'Top' : 'Bottom'} institution on ${label(metric)} for each selection: ` +
      groups.slice(0, 6).map((g) => `${g.cat} ${g.year}: ${g.rs[0].institution} (${fmt(metric, val(g.rs[0], metric) as number)})`).join('; ') + (groups.length > 6 ? '; …' : '.')
    const xs = groups.map((g) => `${g.cat} ${g.year}`.replace(/^Overall /, ''))
    charts.push({
      title: `Leader's ${label(metric)} per selection`, why: 'One bar per category-year shows how the leading value moves; hover for the institution.',
      data: [{ type: 'bar', x: xs, y: groups.map((g) => val(g.rs[0], metric) as number), text: groups.map((g) => short(g.rs[0].institution, 18)), textposition: 'outside', cliponaxis: false, marker: { color: TEAL }, hovertext: groups.map((g) => g.rs[0].institution), hoverinfo: 'text+y' } as Data],
      yTitle: label(metric), yFromZero: true, showLegend: false, height: 380,
    })
  }
  return { res: { answer, chips: chipsFor(used), charts, table: tbl, facts }, used }
}

function aggregate(p: QueryPlan, metric: string, sc: Scope, used: Used): QueryResult {
  const agg: Agg = p.agg ?? 'count'
  let gb: GroupBy = p.groupBy ?? 'none'
  if (gb === 'none') gb = sc.years.length > 1 ? 'year' : sc.cats.length > 1 ? 'category' : 'none'
  const m = agg === 'count' ? 'count' : metric
  const buckets = new Map<string, number[]>()
  const order: string[] = []
  const push = (k: string, v: number) => { if (!buckets.has(k)) { buckets.set(k, []); order.push(k) } buckets.get(k)!.push(v) }
  for (const c of sc.combos) for (const r of pool(c.cat, c.year)) {
    if (!keep(r, p, m)) continue
    const k = gb === 'state' ? r.state || 'Unknown' : gb === 'category' ? c.cat : gb === 'year' ? String(c.year) : gb === 'institution' ? r.institution : 'All'
    push(k, agg === 'count' ? 1 : (val(r, metric) as number))
  }
  if (!buckets.size) return empty('No institutions match that selection.', used)
  const calc = (a: number[]) => agg === 'count' ? a.length : agg === 'sum' ? a.reduce((x, y) => x + y, 0) : agg === 'mean' ? mean(a) : agg === 'median' ? quantile(a, 0.5) : agg === 'min' ? Math.min(...a) : Math.max(...a)
  let out = order.map((k) => ({ k, v: calc(buckets.get(k)!), n: buckets.get(k)!.length }))
  const AGGW: Record<Agg, string> = { count: 'Number of institutions', mean: 'Average', median: 'Median', min: 'Minimum', max: 'Maximum', sum: 'Total' }
  const what = agg === 'count' ? 'Number of institutions' : `${AGGW[agg]} ${label(metric)}`
  const nf = (v: number) => (agg === 'count' || metric === 'rank' ? String(Math.round(v * 10) / 10) : f2(v))
  const charts: Ch[] = []
  let answer: string
  const maps: Res['maps'] = []
  if (gb === 'year') {
    out = out.sort((a, b) => Number(a.k) - Number(b.k))
    answer = `${what} by year (${sc.cats.join(', ')}): ${out.map((o) => `${o.k}: ${nf(o.v)}`).join(', ')}.`
    charts.push({ title: `${what} over time`, why: 'A line chart is the right form for a measure that changes over time.', data: [line(what, out.map((o) => Number(o.k)), out.map((o) => o.v), TEAL)], yTitle: what, xTitle: 'Year', showLegend: false, reverseY: metric === 'rank' && agg !== 'count', height: 360 })
  } else if (gb === 'none') {
    answer = `${what} in ${scopeText(used)}${p.states.length ? ` (${p.states.join(', ')})` : ''}${p.rankMax ? `, top ${p.rankMax}` : ''}: ${nf(out[0].v)} (from ${out[0].n} institutions).`
  } else {
    out = out.sort((a, b) => (agg === 'count' || metric !== 'rank' ? b.v - a.v : a.v - b.v) || a.k.localeCompare(b.k))
    const top = out.slice(0, 20)
    answer = `${what} by ${gb} in ${scopeText(used)}: ${out.slice(0, 5).map((o) => `${o.k} ${nf(o.v)}`).join(', ')}${out.length > 5 ? `, … (${out.length} groups)` : ''}.`
    charts.push({ title: `${what} by ${gb}`, why: 'Sorted bars from zero make the groups directly comparable.', data: [hbar(top.map((o) => short(o.k, 38)), top.map((o) => o.v), { text: top.map((o) => nf(o.v)) })], height: tallH(top.length), xTitle: what, yFromZero: true, showLegend: false })
    if (gb === 'state' && agg === 'count') {
      const counts: Record<string, number> = {}
      out.forEach((o) => { counts[o.k] = o.v })
      maps.push({ title: `${what} by state`, counts, max: Math.max(...out.map((o) => o.v)) })
    }
  }
  const tbl = table([['group', gb === 'none' ? 'Selection' : gb[0].toUpperCase() + gb.slice(1)], ['value', what], ['n', 'Institutions']], out.map((o) => ({ group: o.k === 'All' ? scopeText(used) : o.k, value: Math.round(o.v * 1000) / 1000, n: o.n })))
  return { res: { answer, chips: chipsFor(used, [AGGW[agg], p.rankMax ? `top ${p.rankMax}` : '', p.institutionType ?? '']), charts, maps: maps.length ? maps : undefined, table: tbl, facts: { metric, op: 'aggregate', agg, groupBy: gb, categories: sc.cats.join(','), years: sc.years.join(','), value: out[0].v } }, used }
}

function trend(p: QueryPlan, metric: string, sc: Scope, used: Used): QueryResult {
  const cat = sc.cats[0]
  const ids = p.ids.length ? p.ids : []
  if (!ids.length) {
    return aggregate({ ...p, op: 'aggregate', agg: 'mean', groupBy: 'year' }, metric, sc, { ...used, op: 'aggregate' })
  }
  const yrs = sc.years
  const series = ids.map((id, i) => {
    const byYear = new Map<number, Rec>()
    for (const y of yrs) { const r = pool(cat, y).find((x) => x.institutionId === id); if (r) byYear.set(y, r) }
    const any = [...byYear.values()][0]
    return { id, name: any?.institution ?? RECORDS.find((r) => r.institutionId === id)?.institution ?? id, byYear, color: COLORWAY[i % COLORWAY.length] }
  }).filter((s) => s.byYear.size)
  if (!series.length) return empty(`None of the requested institutions has a ${cat} ranking in ${yrs[0]}–${yrs[yrs.length - 1]}.`, used)
  const vals = (s: (typeof series)[number]) => yrs.map((y) => { const r = s.byYear.get(y); return r ? val(r, metric) : null })
  const rows = series.flatMap((s) => yrs.map((y) => { const r = s.byYear.get(y); return { institution: s.name, year: y, value: r ? val(r, metric) : null, rank: r?.rank ?? null, score: r?.score ?? null } }))
  const parts = series.map((s) => {
    const v = vals(s).filter((x): x is number => x != null), ys = yrs.filter((y) => s.byYear.has(y) && val(s.byYear.get(y)!, metric) != null)
    if (v.length < 2) return `${s.name}: ${v.length ? `${fmt(metric, v[0])} in ${ys[0]}` : 'no data'}`
    return `${s.name}: ${fmt(metric, v[0])} (${ys[0]}) → ${fmt(metric, v[v.length - 1])} (${ys[ys.length - 1]})`
  })
  const charts: Ch[] = [{
    title: `${label(metric)} over time · ${cat}`, why: 'A line chart shows change over time; rank axes are reversed so a rise on the chart means a better rank.',
    data: series.map((s) => line(short(s.name, 36), yrs, vals(s), s.color)), xTitle: 'Year', yTitle: label(metric), reverseY: metric === 'rank', showLegend: series.length > 1, height: 380,
  }]
  const tbl = table([['institution', 'Institution'], ['year', 'Year'], ['value', label(metric)], ['rank', 'Rank'], ['score', 'Score']], rows)
  return { res: { answer: `${label(metric)} over time in ${cat}. ${parts.join('. ')}.`, chips: chipsFor({ ...used, years: yrs }, series.map((s) => short(s.name, 28))), charts, table: tbl, facts: { metric, op: 'trend', categories: cat, years: yrs.join(',') } }, used: { ...used, ids: series.map((s) => s.id) } }
}

function correlation(p: QueryPlan, m1: string, m2: string, sc: Scope, used: Used): QueryResult {
  const pts: { x: number; y: number; label: string }[] = []
  for (const c of sc.combos) for (const r of pool(c.cat, c.year)) {
    if (!keep(r, p, 'count')) continue
    const x = val(r, m1), y = val(r, m2)
    if (x != null && y != null) pts.push({ x, y, label: `${r.institution} (${c.cat} ${c.year})` })
  }
  if (pts.length < 3) return empty('Too few institutions have both values to compute a correlation.', { ...used, metric2: m2 })
  const sc2 = scatterChart(pts, m1, m2, true, `${label(m1)} vs ${label(m2)} · ${scopeText(used)}`, 'A scatter plot shows the relationship between two numeric measures; the dotted line is the least-squares trend.')
  const r = sc2.r
  const dir = r >= 0 ? 'positive' : 'negative'
  const a = Math.abs(r)
  const words = a >= 0.8 ? 'very strong' : a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'very weak'
  const note = m1 === 'rank' || m2 === 'rank' ? ' (a lower rank number is better, so a negative correlation with rank means higher values go with better ranks)' : ''
  return {
    res: { answer: `${label(m1)} and ${label(m2)} have a ${words} ${dir} correlation in ${scopeText(used)}: r = ${f2(r)}, R² = ${f2(r * r)}, n = ${sc2.n}${note}.`, chips: chipsFor({ ...used, metric2: m2 }), charts: [sc2.ch], kpis: [{ label: 'Pearson r', value: f2(r) }, { label: 'R²', value: f2(r * r) }, { label: 'Institutions', value: String(sc2.n) }], facts: { metric: m1, metric2: m2, op: 'correlation', r: Math.round(r * 1000) / 1000, n: sc2.n, categories: sc.cats.join(','), years: sc.years.join(',') } },
    used: { ...used, metric2: m2 },
  }
}

function lookup(p: QueryPlan, metric: string, sc: Scope, used: Used): QueryResult {
  if (!p.ids.length && !p.states.length && !p.institutionType) return empty('Tell me which institution you mean.', used)
  const rows: Rec[] = []
  for (const c of sc.combos) for (const r of pool(c.cat, c.year)) if (keep(r, p, 'count')) rows.push(r)
  if (!rows.length) return empty('No matching ranking rows were found for that institution, category and year.', used)
  rows.sort((a, b) => a.institution.localeCompare(b.institution) || a.year - b.year)
  const tbl = table([['institution', 'Institution'], ['category', 'Category'], ['year', 'Year'], ['rank', 'Rank'], ['score', 'Score'], ['TLR', 'TLR'], ['RPC', 'RPC'], ['GO', 'GO'], ['OI', 'OI'], ['Perception', 'Perception']],
    rows.map((r) => ({ institution: r.institution, category: r.category, year: r.year, rank: r.rank, score: r.score, TLR: r.params.TLR, RPC: r.params.RPC, GO: r.params.GO, OI: r.params.OI, Perception: r.params.Perception })))
  const names = [...new Set(rows.map((r) => r.institution))]
  const yrs = [...new Set(rows.map((r) => r.year))].sort()
  const charts: Ch[] = []
  if (yrs.length > 1) {
    charts.push({ title: `${label(metric)} by year`, why: 'A line chart shows how the value changed across the years requested.', data: names.slice(0, 7).map((n, i) => line(short(n, 34), yrs, yrs.map((y) => { const r = rows.find((x) => x.institution === n && x.year === y); return r ? val(r, metric) : null }), COLORWAY[i % COLORWAY.length])), xTitle: 'Year', yTitle: label(metric), reverseY: metric === 'rank', showLegend: names.length > 1, height: 360 })
  } else if (names.length <= 12) {
    const vs = rows.map((r) => val(r, metric))
    charts.push({ title: `${label(metric)} · ${yrs[0]}`, why: 'Bars from zero compare the requested institutions on one measure.', data: [hbar(rows.map((r) => short(r.institution, 36)), vs.map((v) => v ?? 0), { text: vs.map((v) => (v == null ? 'n/a' : fmt(metric, v))) })], height: tallH(rows.length), xTitle: label(metric), yFromZero: true, showLegend: false })
  }
  const mv = (r: Rec) => (val(r, metric) != null ? fmt(metric, val(r, metric) as number) : 'n/a')
  const answer = rows.length <= 8
    ? rows.map((r) => `${r.institution}, ${r.category} ${r.year}: ${label(metric)} ${mv(r)}${metric !== 'rank' ? `, rank ${r.rank ?? 'n/a'}` : ''}${metric !== 'score' ? `, score ${r.score != null ? f1(r.score) : 'n/a'}` : ''}`).join('. ') + '.'
    : `Found ${rows.length} ranking rows for ${names.length} institution(s) across ${yrs.length} year(s). Selected measure: ${label(metric)}.`
  return { res: { answer, chips: chipsFor({ ...used, years: yrs }, names.slice(0, 4).map((n) => short(n, 28))), charts, table: tbl, facts: { metric, op: 'lookup', categories: sc.cats.join(','), years: yrs.join(',') } }, used }
}

/* --------------------------------- verifier -------------------------------- */
/** Checks that the result answers what was planned. Returns problems (empty = fine). */
export function verify(p: QueryPlan, r: QueryResult): string[] {
  const bad: string[] = []
  const m = normMetric(p.metric) ?? 'score'
  if (r.used.metric !== m) bad.push('metric')
  if (p.categories.length && !r.used.categories.every((c) => p.categories.includes(c))) bad.push('category')
  if (p.years.length && r.used.years.some((y) => !p.years.includes(y))) bad.push('year')
  if (p.states.length && p.states.length !== r.used.states.length) bad.push('state')
  if (p.ids.length && p.op === 'lookup' && r.used.ids.length === 0) bad.push('institution')
  return bad
}

export { countByState }
