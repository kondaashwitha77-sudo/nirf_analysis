/* LLM-first AI Analyst.
   1. PLAN     the backend asks the language model to turn ANY wording (typos, "and"/"or", year lists) into a JSON plan.
   2. VALIDATE this file checks every field against the real categories, states, years and institution names.
   3. EXECUTE  code computes all numbers from the loaded NIRF records (query engine or the 40 Annexure analyses).
   4. VERIFY   the result must echo what was asked (metric, years, category, ...). Otherwise we do not show it as an answer.
   The model never sees data and never produces a number. Returns null when the model is unavailable so the caller can fall back. */
import { QUESTIONS, initialArgs, runQuestion } from '../annex/questions'
import { allCategories, catYears, defaults, type Args, type Res } from '../annex/core'
import { normMetric, runQuery, verify, type Agg, type GroupBy, type Op, type QueryPlan, type Used } from '../annex/query'
import { YEARS } from '../data/mock/constants'
import { RECORDS, STATE_OPTIONS } from '../data/mock/rankings'
import { apiClient } from '../services/apiClient'
import type { AIQueryResponse, AnalysisPlan } from '../types'
import { closestInstitutions, findInstitutions, normalize } from './nlu'

export class AiUnavailable extends Error {}

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : typeof v === 'string' && v.trim() ? [v.trim()] : [])
const num = (v: unknown): number | undefined => { const n = typeof v === 'string' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined }

/* ------------------------------ call the backend ------------------------------ */
async function requestPlan(question: string, previous?: unknown): Promise<Raw> {
  try {
    const { data } = await apiClient.post<{ plan: Raw }>('/ai/plan', {
      question: question.slice(0, 600), categories: allCategories(), states: STATE_OPTIONS, years: YEARS, previous_plan: previous ?? null,
    })
    if (!isObj(data?.plan)) throw new AiUnavailable('bad plan')
    return data.plan
  } catch (err) {
    if (err instanceof AiUnavailable) throw err
    throw new AiUnavailable((err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code ?? 'AI_UNREACHABLE')
  }
}

/* ------------------------------- normalisers ------------------------------- */
const key = (s: string) => normalize(s).replace(/\b(category|institutions?|colleges?|ranking|rankings)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export function matchCategory(name: string): string | null {
  const k = key(name)
  if (!k) return null
  const cats = allCategories()
  const exact = cats.find((c) => key(c) === k)
  if (exact) return exact
  const one = cats.filter((c) => key(c).includes(k) || k.includes(key(c)))
  if (one.length === 1) return one[0]
  const alias: Record<string, string> = { engg: 'Engineering', eng: 'Engineering', btech: 'Engineering', univ: 'University', pharma: 'Pharmacy', med: 'Medical', mba: 'Management', b: 'Management', arch: 'Architecture', agri: 'Agriculture' }
  const a = alias[k]
  if (a) return cats.find((c) => key(c).startsWith(key(a))) ?? null
  return one[0] ?? null
}
export function matchState(name: string): string | null {
  const k = key(name)
  return STATE_OPTIONS.find((s) => key(s) === k) ?? STATE_OPTIONS.find((s) => key(s).startsWith(k) && k.length >= 4) ?? null
}
const yearList = (v: unknown): number[] => {
  const arr = Array.isArray(v) ? v : v == null ? [] : [v]
  const ys = arr.map((x) => Number(x)).filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100)
  return [...new Set(ys)].sort((a, b) => a - b)
}

interface Resolved { ids: string[]; unknown: { fragment: string; options: { id: string; name: string }[] }[] }
export function resolveInstitutions(names: string[]): Resolved {
  const ids: string[] = []
  const unknown: Resolved['unknown'] = []
  for (const n of names) {
    const f = findInstitutions(n)
    if (f.matches.length) f.matches.forEach((m) => { if (!ids.includes(m.id)) ids.push(m.id) })
    else if (f.ambiguous.length) unknown.push({ fragment: n, options: f.ambiguous[0].options.slice(0, 4) })
    else {
      const near = closestInstitutions(n, 4)
      unknown.push({ fragment: n, options: near })
    }
  }
  return { ids, unknown }
}

/* -------------------------------- response builders -------------------------------- */
const base = (question: string, p: Partial<AIQueryResponse>): AIQueryResponse => ({
  question, answer: '', kind: 'chat', charts: [], filters: [], methodology: '', limitations: [], isMock: false, ...p,
})
const NOTE = 'Only institutions with a published score are included. Institutions without an exact published rank are included only where the measure does not need a rank.'

function understoodFrom(u: Used, extra: { label: string; value: string }[] = [], hideMetric = false) {
  const ys = u.years.length > 1 ? `${u.years[0]}–${u.years[u.years.length - 1]}${u.years.length > 2 && u.years[u.years.length - 1] - u.years[0] + 1 !== u.years.length ? ` (${u.years.join(', ')})` : ''}` : u.years.join('')
  return [
    ...(hideMetric ? [] : [{ label: 'Metric', value: u.metric2 ? `${u.metric} vs ${u.metric2}` : u.metric }]),
    { label: 'Category', value: u.categories.join(', ') },
    { label: 'Year', value: ys },
    ...(u.states.length ? [{ label: 'State', value: u.states.join(', ') }] : []),
    ...extra,
  ].filter((x) => x.value)
}

function fromRes(question: string, res: Res, understood: { label: string; value: string }[], method: string, llm: unknown, notes: string[] = []): AIQueryResponse {
  return base(question, {
    kind: 'analysis', answer: res.answer + (notes.length ? ' ' + notes.join(' ') : ''), understood, filters: understood,
    methodology: method, limitations: [NOTE], annex: res,
    plan: { kind: 'lookup', llm } as unknown as AnalysisPlan, assumptions: ['Question interpreted by the AI model; all numbers are computed from the NIRF data.'],
  })
}

/* -------------------------------- main entry -------------------------------- */
export async function answerWithLLM(question: string, previous?: AnalysisPlan): Promise<AIQueryResponse> {
  const prevLlm = (previous as unknown as { llm?: unknown } | undefined)?.llm
  const raw = await requestPlan(question, prevLlm)
  const intent = String(raw.intent ?? '')
  const reply = typeof raw.reply === 'string' ? raw.reply.trim() : ''
  const options = strs(raw.options).slice(0, 4)

  if (intent === 'chat' || intent === 'unsupported') {
    if (!reply) throw new AiUnavailable('empty reply')
    return base(question, { answer: reply, suggestions: options, plan: previous })
  }
  if (intent === 'clarify') {
    if (!reply) throw new AiUnavailable('empty clarify')
    return base(question, { answer: reply, clarify: options.length ? { fragment: question, options: options.map((o, i) => ({ id: String(i), name: o, question: o })) } : undefined, plan: previous })
  }

  if (intent === 'annex' && isObj(raw.annex)) return runAnnex(question, raw)
  if (intent === 'query' && isObj(raw.query)) return runGeneric(question, raw)
  throw new AiUnavailable('unrecognised plan')
}

function clarifyUnknown(question: string, r: Resolved): AIQueryResponse | null {
  if (!r.unknown.length) return null
  const u = r.unknown[0]
  return base(question, {
    answer: `I could not find "${u.fragment}" in the NIRF data. Did you mean one of these?`,
    clarify: { fragment: u.fragment, options: u.options.map((o) => ({ ...o, question: question.replace(new RegExp(u.fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), o.name) })) },
  })
}

function runGeneric(question: string, raw: Raw): AIQueryResponse {
  const q = raw.query as Raw
  const op = (['top', 'bottom', 'aggregate', 'trend', 'correlation', 'lookup'] as Op[]).find((o) => o === q.op) ?? 'top'
  const metric = normMetric(String(q.metric ?? '')) ?? 'score'
  const metric2 = normMetric(String(q.metric2 ?? '')) ?? undefined
  const agg = (['count', 'mean', 'median', 'min', 'max', 'sum'] as Agg[]).find((a) => a === q.agg)
  const groupBy = (['none', 'state', 'category', 'year', 'institution'] as GroupBy[]).find((g) => g === q.groupBy)
  const cats = strs(q.categories).map(matchCategory)
  const unknownCat = strs(q.categories).filter((_, i) => !cats[i])
  const states = strs(q.states).map(matchState)
  const inst = resolveInstitutions(strs(q.institutions))
  const clarify = clarifyUnknown(question, inst)
  if (clarify) return clarify
  if (unknownCat.length) return base(question, { answer: `I could not match the category "${unknownCat[0]}". The categories are: ${allCategories().join(', ')}.`, suggestions: allCategories().slice(0, 4).map((c) => `${question} (${c})`) })
  const plan: QueryPlan = {
    op, metric, metric2, agg, groupBy,
    categories: [...new Set(cats.filter((c): c is string => !!c))],
    years: yearList(q.years), states: [...new Set(states.filter((s): s is string => !!s))], ids: inst.ids,
    topN: num(q.topN), rankMax: num(q.rankMax) ?? null, institutionType: typeof q.institutionType === 'string' && q.institutionType ? q.institutionType : undefined,
  }
  if (op === 'aggregate' && !agg) plan.agg = 'count'
  const result = runQuery(plan)
  const bad = verify(plan, result)
  if (bad.length) throw new AiUnavailable('verification failed: ' + bad.join(','))
  const u = result.used
  const extra = [
    ...(op === 'aggregate' ? [{ label: 'Calculation', value: `${plan.agg ?? 'count'}${plan.groupBy && plan.groupBy !== 'none' ? ` by ${plan.groupBy}` : ''}` }] : [{ label: 'Operation', value: op }]),
    ...(plan.topN && (op === 'top' || op === 'bottom') ? [{ label: 'Top N', value: String(plan.topN) }] : []),
    ...(plan.rankMax ? [{ label: 'Rank limit', value: `top ${plan.rankMax}` }] : []),
    ...(plan.institutionType ? [{ label: 'Type', value: plan.institutionType }] : []),
    ...(u.ids.length ? [{ label: 'Institutions', value: u.ids.map((id) => RECORDS.find((r) => r.institutionId === id)?.institution ?? id).slice(0, 4).join(', ') + (u.ids.length > 4 ? ` +${u.ids.length - 4}` : '') }] : []),
  ]
  return fromRes(question, result.res, understoodFrom(u, extra, op === 'aggregate' && plan.agg === 'count'), 'The AI model translated your question into a structured plan. The numbers are then computed from the loaded NIRF records (not by the model). A lower rank number is better.', raw, u.notes)
}

function runAnnex(question: string, raw: Raw): AIQueryResponse {
  const a = raw.annex as Raw
  const q = QUESTIONS.find((x) => x.id === String(a.id))
  if (!q) throw new AiUnavailable('unknown annex id')
  const args = isObj(a.args) ? a.args : {}
  const baseArgs = defaults()
  const patch: Partial<Args> = {}
  const cat = strs(args.category)[0] ? matchCategory(strs(args.category)[0]) : null
  if (cat) patch.category = cat
  const withCat = initialArgs(q, { ...baseArgs, ...patch })
  const ys = catYears(withCat.category)
  const y1 = num(args.year), y2 = num(args.year2)
  if (y1 && ys.includes(y1)) patch.year = y1
  if (y2 && ys.includes(y2)) patch.year2 = y2
  const s1 = strs(args.state)[0] ? matchState(strs(args.state)[0]) : null
  const s2 = strs(args.state2)[0] ? matchState(strs(args.state2)[0]) : null
  if (s1) patch.state = s1
  if (s2) patch.state2 = s2
  for (const k of ['param', 'param2', 'attrX', 'attrY'] as const) {
    const m = normMetric(typeof args[k] === 'string' ? (args[k] as string) : '')
    if (m) patch[k] = m
  }
  for (const k of ['topN', 'minYears', 'bandSize', 'cut', 'z', 'pctHigh', 'pctLow'] as const) { const n = num(args[k]); if (n) patch[k] = n }
  const names = strs(args.institutions)
  if (names.length) {
    const inst = resolveInstitutions(names)
    const clarify = clarifyUnknown(question, inst)
    if (clarify) return clarify
    if (inst.ids.length) patch.institutions = inst.ids.slice(0, 6)
  }
  const final = { ...withCat, ...patch }
  if (final.year > final.year2 && !patch.year) final.year = final.year2
  if (final.year > final.year2) [final.year, final.year2] = [final.year2, final.year]
  const res = runQuestion(q, final)
  if (!res.charts.length && !res.maps?.length && !res.table) throw new AiUnavailable('annex produced nothing')
  const u: Used = { op: 'lookup', metric: final.param, years: [final.year, final.year2].filter((y, i, arr) => arr.indexOf(y) === i), categories: [final.category], states: [], ids: [], notes: [] }
  const understood = [
    { label: 'Analysis', value: `Annexure ${q.id}` },
    { label: 'Category', value: final.category },
    { label: 'Year', value: u.years.length > 1 ? `${u.years[0]}–${u.years[1]}` : String(u.years[0]) },
    ...(patch.state ? [{ label: 'State', value: final.state }] : []),
    ...(patch.param ? [{ label: 'Parameter', value: final.param }] : []),
  ]
  return fromRes(question, res, understood, `The AI model matched your question to Annexure A question ${q.id} (“${q.text}”) and filled its filters. The analysis runs on the loaded NIRF records.`, raw)
}
