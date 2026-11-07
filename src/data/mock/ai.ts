import { STARTERS, chatReply, classifyIntent } from '../../lib/assistantIntent'
import { chartHasData, wrapLabel } from '../../lib/chartData'
import { closestInstitutions, correctSpelling, detectInstitutionType, extractCategories, extractEntities, findInstitutions, groupingNoun } from '../../lib/nlu'
import type { Entities, GroupNoun } from '../../lib/nlu'
import { USE_MOCK } from '../../services/apiClient'
import type { AIQueryResponse, AnalysisPlan, ChartSpec, MockSpec, RankingRecord, TableData } from '../../types'
import { metricLabel, metricValue, selectRecords } from '../selectors'
import { CATEGORIES, DECLINED_COLOR, IMPROVED_COLOR, PARAMS, YEARS, ZONE_BY_STATE, ZONE_COLORS } from './constants'
import { runAnalysis } from './mockAnalysis'

export const EXAMPLE_QUESTIONS = [
  'Compare IIT Madras and IIT Delhi',
  'How has IIT Bombay changed over the years?',
  'Which states have the most top 50 engineering institutions in 2024?',
  'Show outliers in overall score for University in 2025',
  'Which institutions improved their rank the most?',
  'What is TLR?',
  'Who is number 1 in pharmacy?',
  'List all IITs in 2025',
  'Which institutions stayed in the top 10 every year?',
]

const COMPARE_WORD = /\b(compare|compared|comparison|versus|vs|better|difference)\b/
const FOLLOW_UP = /^(and|also|same|what about|how about)\b|\b(instead|same|this)\b|^(for|in)\b/
const DECLINE_WORD = /\b(declined?|declining|dropped|drop|fell|fall|falling|slipped|lost|fallers?)\b/
const LEAD_WORD = /\bnumber (1|one)\b|\bno 1\b|\brank 1\b|\btopper\b|\bbest (college|university|institute|institution)\b/
const LOOKUP_WORD = /\b(rank of|ranking of|score of|what rank|which rank|where does|where do|stand|standing)\b/
const DASH_COLOR = '#6B7280'
const SOURCE_NOTE = 'Rows NIRF lists only as a rank band are not in this data, and an institution missing from a year was not listed in it.'

const lastYear = () => YEARS[YEARS.length - 1]
const round = (v: number) => Number(v.toFixed(2))
const present = (v: (number | null)[]) => v.filter((x): x is number => x !== null)
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** A statistic only when it is about a value: "highest number of" is a count, "highest score" is not. */
function statOf(text: string): AnalysisPlan['aggregate'] {
  if (/\b(average|mean)\b/.test(text)) return 'mean'
  if (/\bmedian\b/.test(text)) return 'median'
  if (/\b(?:highest|maximum) (?:\w+ ){0,2}(?:scores?|tlr|rpc|oi|perception|teaching|graduation|outreach)\b/.test(text)) return 'max'
  if (/\b(?:lowest|minimum) (?:\w+ ){0,2}(?:scores?|tlr|rpc|oi|perception|teaching|graduation|outreach)\b/.test(text)) return 'min'
  return undefined
}

/** What the verbs ask for; used for institution lists, so it never returns a scalar kind. */
function verbKind(text: string): AnalysisPlan['kind'] | undefined {
  if (/\b(stayed|stay|remained|always|consistently|every year|each year)\b/.test(text)) return 'consistency'
  if (/\boutliers?\b/.test(text)) return 'outliers'
  if (/\b(improved?|improvement|improving|rose|gained?|climbed|risers?)\b/.test(text) || DECLINE_WORD.test(text)) return 'movers'
  if (/\b(distribution|histogram|spread)\b/.test(text)) return 'histogram'
  if (/\b(correlat\w*|relationship)\b/.test(text)) return 'corr'
  if (/\b(trends?|over time|over the years|changed?|progress|lately|recently|doing|performing)\b/.test(text)) return 'trend'
  return undefined
}

function kindForNoun(noun: GroupNoun, text: string): AnalysisPlan['kind'] {
  if (noun === 'state' || noun === 'zone') return 'stateCount'
  if (noun === 'institution') return verbKind(text) ?? 'topList'
  if (noun === 'category' && statOf(text)) return 'categoryCompare'
  return 'groupCount'
}

/** Used only when the question has no grouping noun. */
function detectKind(text: string, categories: string[], type?: string): AnalysisPlan['kind'] | undefined {
  if (categories.length >= 2 && /\b(compare|compared|comparison|versus|vs|difference|better|between)\b/.test(text)) return 'categoryCompare'
  const verb = verbKind(text)
  if (verb === 'consistency') return verb
  if (/\b(how many|number of|count of)\b/.test(text)) return 'count'
  if (statOf(text)) return 'aggregate'
  if (verb) return verb
  if (LEAD_WORD.test(text) || /\b(top|best|worst|bottom|leading|highest|lowest|list)\b/.test(text)) return 'topList'
  return type ? 'topList' : undefined
}

const GROUP_HEADER: Record<GroupNoun, string> = { state: 'State', zone: 'Zone', city: 'City', category: 'Category', year: 'Year', institution: 'Institution' }

/** The answer must be about what was asked: the first column and the bar categories match the grouping noun. */
export function groupingFits(noun: GroupNoun, table: TableData | undefined, charts: ChartSpec[]): boolean {
  const want = GROUP_HEADER[noun]
  if (!table?.columns.length || table.columns[0].header !== want) return false
  const bars = charts.filter((c) => c.type === 'bar')
  return !bars.length || bars.some((c) => c.xTitle === want)
}

/** "Tamil Nadu (14)" / "Delhi and Punjab (7 each)", naming ties together. */
function tier(names: string[], value: string | number): string {
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  return `${list} (${value}${names.length > 1 ? ' each' : ''})`
}

const chat = (question: string, answer: string, suggestions: string[], extra: Partial<AIQueryResponse> = {}): AIQueryResponse => ({
  question, answer, kind: 'chat', charts: [], filters: [], methodology: '', limitations: [], isMock: false, suggestions, ...extra,
})

const recordsOf = (id: string, category?: string): RankingRecord[] =>
  selectRecords({ institutionIds: [id], category }).sort((a, b) => a.year - b.year)

/** The category named in the question, else the category of the latest record. */
function categoryFor(id: string, wanted?: string): string {
  const recs = recordsOf(id)
  if (wanted && recs.some((r) => r.category === wanted)) return wanted
  const newest = recs[recs.length - 1].year
  return CATEGORIES.find((c) => recs.some((r) => r.category === c && r.year === newest)) ?? recs[recs.length - 1].category
}

const yearSpan = (years: number[]) => YEARS.filter((y) => y >= Math.min(...years) && y <= Math.max(...years))

interface Built {
  answer: string
  charts: ChartSpec[]
  table?: TableData
  methodology: string
  limitations: string[]
  suggestions: string[]
  plan: AnalysisPlan
  assumptions?: string[]
}

const scopeOf = (plan: AnalysisPlan) => (r: RankingRecord) =>
  (!plan.state || r.state === plan.state) &&
  (!plan.zone || (r.zone ?? ZONE_BY_STATE[r.state]) === plan.zone) &&
  (!plan.institutionType || r.institutionType === plan.institutionType)

const whereOf = (plan: AnalysisPlan) => (plan.state ? ` in ${plan.state}` : plan.zone ? ` in the ${plan.zone}` : '')
const typeName = (t: string) => (t === 'AIIMS' ? t : `${t}s`)

/** Defaults the question left out, said out loud in the answer. */
const baseAssumptions = (plan: AnalysisPlan, useYear = true) => [
  ...(plan.category === undefined ? ['category Overall'] : []),
  ...(useYear && plan.year === undefined ? [`the latest year (${lastYear()})`] : []),
]

const nothing = (plan: AnalysisPlan): Built => ({ answer: '', charts: [], methodology: '', limitations: [], suggestions: [], plan })

function runCompare(plan: AnalysisPlan): Built {
  const ids = plan.institutions as string[]
  const common = CATEGORIES.filter((c) => ids.every((id) => recordsOf(id, c).length))
  const category = plan.category && common.includes(plan.category) ? plan.category : common.includes('Overall') ? 'Overall' : common[0]
  const notes: string[] = []
  if (plan.category && category !== plan.category) notes.push(`They are not all listed in ${plan.category}, so this uses ${category ?? "each institution's own category"}.`)
  const catOf = (id: string) => category ?? categoryFor(id)
  const data = ids.map((id) => {
    const rows = recordsOf(id, catOf(id))
    return { id, name: rows[rows.length - 1].institution, rows }
  })
  type Item = (typeof data)[number]
  const span = yearSpan(data.flatMap((d) => d.rows.map((r) => r.year)))
  const label = (d: Item) => (category ? d.name : `${d.name} (${catOf(d.id)})`)
  const at = (d: Item, y: number) => d.rows.find((r) => r.year === y)

  const charts: ChartSpec[] = [
    { type: 'line', title: 'Rank over time', xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, rankAxis: true, xTickValues: span, series: data.map((d) => ({ name: label(d), x: span, y: span.map((y) => { const r = at(d, y); return r && r.rankType === 'exact' ? r.rank : null }) })) },
    { type: 'line', title: 'Overall score over time', xTitle: 'Year', yTitle: 'Overall score', xTickValues: span, series: data.map((d) => ({ name: label(d), x: span, y: span.map((y) => at(d, y)?.score ?? null) })) },
  ]

  // With no shared category, a same-year ranking means nothing, so the answer lists latest records instead.
  const commonYears = category ? span.filter((y) => data.every((d) => at(d, y))) : []
  const year = plan.year && commonYears.includes(plan.year) ? plan.year : commonYears[commonYears.length - 1]
  if (plan.year && year !== plan.year && commonYears.length) notes.push(`They are not all listed in ${plan.year}, so this uses ${year}.`)
  const latest = data.map((d) => ({ d, r: year ? (at(d, year) as RankingRecord) : d.rows[d.rows.length - 1] }))
  const table: TableData = {
    columns: [{ key: 'institution', header: 'Institution' }, { key: 'category', header: 'Category' }, { key: 'year', header: 'Year', align: 'right' }, { key: 'rank', header: 'Rank', align: 'right' }, { key: 'score', header: 'Score', align: 'right' }, ...PARAMS.map((p) => ({ key: p.key, header: p.label, align: 'right' as const }))],
    rows: latest.map(({ d, r }) => ({ institution: d.name, category: r.category, year: r.year, rank: r.rank, score: r.score, ...r.params })),
  }
  const params = PARAMS.filter((p) => latest.some(({ r }) => r.params[p.key] !== null))
  if (params.length) {
    charts.push({ type: 'bar', title: `Parameters, ${category ?? 'latest records'}${year ? `, ${year}` : ''}`, xTitle: 'Parameter', yTitle: 'Score', yFromZero: true, series: latest.map(({ d, r }) => ({ name: label(d), x: params.map((p) => p.label), y: params.map((p) => r.params[p.key]) })) })
  }

  let answer: string
  if (!year) {
    answer = `These institutions were never listed in the same category and year, so here are their latest records: ${latest.map(({ d, r }) => `${d.name} was rank ${r.rank ?? 'unavailable'} in ${r.category}, ${r.year}`).join('; ')}.`
  } else {
    const sorted = [...latest].sort((a, b) => (a.r.rank ?? Infinity) - (b.r.rank ?? Infinity))
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const gapRank = (worst.r.rank ?? 0) - (best.r.rank ?? 0)
    const gapScore = best.r.score !== null && worst.r.score !== null ? round(best.r.score - worst.r.score) : null
    const list = sorted.map(({ d, r }) => `${d.name} (rank ${r.rank ?? 'unavailable'}, score ${r.score ?? 'unavailable'})`).join(', ')
    const head = gapRank === 0
      ? `In ${category} ${year}, they share the same rank: ${list}.`
      : `In ${category} ${year}, the order is ${list}: a gap of ${gapRank} place${gapRank === 1 ? '' : 's'}${gapScore === null ? '' : ` and ${gapScore} points`} between first and last.`
    const strengths = latest.map(({ d, r }) => {
      const gaps = params
        .map((p) => {
          const others = present(latest.filter((o) => o.d.id !== d.id).map((o) => o.r.params[p.key]))
          const mine = r.params[p.key]
          return mine === null || !others.length ? null : { label: p.label, gap: mine - Math.max(...others) }
        })
        .filter((g): g is { label: string; gap: number } => g !== null)
        .sort((a, b) => b.gap - a.gap)
      return gaps[0] && gaps[0].gap > 0 ? `${d.name} is furthest ahead in ${gaps[0].label} (by ${round(gaps[0].gap)})` : null
    }).filter(Boolean)
    answer = `${head}${strengths.length ? ` ${strengths.join('; ')}.` : ''}`
  }
  if (notes.length) answer = `${notes.join(' ')} ${answer}`

  const prev = year ? commonYears.filter((y) => y < year).pop() : undefined
  return {
    answer,
    charts,
    table,
    methodology: 'Institutions are matched by name, then their ranks, scores and parameters are read from the loaded NIRF records. Lines break in years an institution was not listed.',
    limitations: [SOURCE_NOTE],
    suggestions: [...(prev ? [`Show this for ${prev}`] : []), `Tell me about ${data[0].name}`],
    plan: { ...plan, category, year },
  }
}

function runInstitution(plan: AnalysisPlan): Built {
  const id = (plan.institutions as string[])[0]
  const category = categoryFor(id, plan.category)
  const rows = recordsOf(id, category)
  const latest = rows[rows.length - 1]
  const name = latest.institution
  const span = yearSpan(rows.map((r) => r.year))
  const at = (y: number) => rows.find((r) => r.year === y)
  const ranked = rows.filter((r) => r.rankType === 'exact' && r.rank !== null)
  const pool = selectRecords({ category })
  const medians = span.map((y) => {
    const v = present(pool.filter((r) => r.year === y).map((r) => r.score))
    return v.length ? round(median(v)) : null
  })
  const charts: ChartSpec[] = [
    { type: 'line', title: 'Rank over time', xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, rankAxis: true, xTickValues: span, series: [{ name: 'Rank', x: span, y: span.map((y) => { const r = at(y); return r && r.rankType === 'exact' ? r.rank : null }) }] },
    { type: 'line', title: 'Overall score over time', xTitle: 'Year', yTitle: 'Overall score', xTickValues: span, series: [{ name, x: span, y: span.map((y) => at(y)?.score ?? null) }, { name: 'Category median', color: DASH_COLOR, dash: true, x: span, y: medians }] },
  ]
  const table: TableData = {
    columns: [{ key: 'year', header: 'Year' }, { key: 'rank', header: 'Rank', align: 'right' }, { key: 'score', header: 'Score', align: 'right' }, ...PARAMS.map((p) => ({ key: p.key, header: p.label, align: 'right' as const }))],
    rows: [...rows].reverse().map((r) => ({ year: r.year, rank: r.rank, score: r.score, ...r.params })),
  }
  const parts = [`${name} in ${category}: latest rank ${latest.rank ?? 'unavailable'} in ${latest.year}.`]
  if (ranked.length) {
    const best = Math.min(...ranked.map((r) => r.rank as number))
    parts.push(`Best rank ${best} in ${ranked.filter((r) => r.rank === best).map((r) => r.year).join(', ')}.`)
  }
  parts.push(`Listed in ${rows.length} of ${YEARS.length} years.`)
  if (ranked.length > 1) {
    const change = (ranked[0].rank as number) - (ranked[ranked.length - 1].rank as number)
    parts.push(change === 0 ? `Its rank is the same as at its first listing in ${ranked[0].year}.` : `It has ${change > 0 ? 'gained' : 'lost'} ${Math.abs(change)} place${Math.abs(change) === 1 ? '' : 's'} since ${ranked[0].year}.`)
  }
  if (plan.year && !plan.year2) {
    const r = at(plan.year)
    parts.push(r ? `In ${plan.year} it was rank ${r.rank ?? 'unavailable'} with a score of ${r.score ?? 'unavailable'}.` : `It was not listed in ${category} in ${plan.year}.`)
  }
  const list = pool.filter((r) => r.year === latest.year && r.rank !== null).sort((a, b) => (a.rank as number) - (b.rank as number))
  const me = list.findIndex((r) => r.institutionId === id)
  const peer = me >= 0 ? list[me + 1] ?? list[me - 1] : undefined
  const shownYear = plan.year ?? latest.year
  return {
    answer: parts.join(' '),
    charts,
    table,
    methodology: "Read from this institution's records in the loaded NIRF data; the dashed line is the median overall score of all institutions in the category that year.",
    limitations: [SOURCE_NOTE],
    suggestions: [...(peer ? [`Compare ${name} with ${peer.institution}`] : []), ...(shownYear > span[0] ? [`Show this for ${shownYear - 1}`] : [])],
    plan: { ...plan, category },
  }
}

function runTop(plan: AnalysisPlan): Built {
  const category = plan.category ?? 'Overall'
  const year = plan.year ?? lastYear()
  const worst = plan.direction === 'decline'
  const listed = selectRecords({ category, year })
    .filter(scopeOf(plan))
    .filter((r) => r.rank !== null)
    .sort((a, b) => (a.rank as number) - (b.rank as number) || (b.score ?? -1) - (a.score ?? -1))
  const rows = (worst ? [...listed].reverse() : listed).slice(0, plan.top ?? (plan.lead ? 5 : 10))
  const resolved = { ...plan, category, year, top: plan.lead && plan.top === undefined ? 1 : rows.length }
  if (!rows.length) return nothing(resolved)
  const first = rows[0]
  const where = whereOf(plan)
  const answer = plan.lead
    ? where
      ? `${first.institution} is the highest-ranked ${category} institution${where} in ${year} (national rank ${first.rank}, score ${first.score ?? 'unavailable'}). The chart shows the top ${rows.length} for context.`
      : `${first.institution} is number 1 in ${category} for ${year} (score ${first.score ?? 'unavailable'}). The chart shows the top ${rows.length} for context.`
    : `${worst ? 'Lowest-ranked' : 'Top'} ${rows.length} ${category} institutions${where} in ${year}: ${first.institution} ${worst ? 'is last' : 'leads'} with rank ${first.rank} and a score of ${first.score ?? 'unavailable'}.`
  const prev = [...new Set(selectRecords({ category }).map((r) => r.year))].sort((x, y) => x - y).filter((y) => y < year).pop()
  return {
    answer,
    charts: [{ type: 'bar', title: `${worst ? 'Lowest-ranked' : 'Top'} ${rows.length} ${category} institutions${where}, ${year}`, xTitle: 'Institution', yTitle: 'Overall score', horizontal: true, showValues: true, series: [{ name: 'Score', x: rows.map((r) => wrapLabel(r.institution, 30)), y: rows.map((r) => r.score) }] }],
    table: {
      columns: [{ key: 'institution', header: 'Institution' }, { key: 'rank', header: 'Rank', align: 'right' }, { key: 'state', header: 'State' }, { key: 'score', header: 'Score', align: 'right' }],
      rows: rows.map((r) => ({ institution: r.institution, rank: r.rank, state: r.state, score: r.score })),
    },
    methodology: 'Institutions are ordered by their exact NIRF rank for that category and year.',
    limitations: [SOURCE_NOTE],
    suggestions: [...(rows.length > 1 ? [`Compare ${rows[0].institution} and ${rows[1].institution}`] : []), ...(prev ? [`Show this for ${prev}`] : [])],
    plan: resolved,
    assumptions: [...baseAssumptions(plan), ...(plan.top === undefined && !plan.lead ? ['a top 10 list'] : [])],
  }
}

function runTypeList(plan: AnalysisPlan): Built {
  const type = plan.institutionType as string
  const year = plan.year ?? lastYear()
  const pool = selectRecords({ year, category: plan.category }).filter(scopeOf(plan))
  const byInstitution = new Map<string, RankingRecord[]>()
  pool.forEach((r) => byInstitution.set(r.institutionId, [...(byInstitution.get(r.institutionId) ?? []), r]))
  const chosen = [...byInstitution.values()].map((rs) => CATEGORIES.map((c) => rs.find((r) => r.category === c)).find(Boolean) ?? rs[0])
  const main = plan.category ?? 'Overall'
  const inMain = chosen.filter((r) => r.category === main).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
  const others = chosen.filter((r) => r.category !== main).sort((a, b) => a.institution.localeCompare(b.institution))
  const ordered = [...inMain, ...others].slice(0, plan.top ?? 9999)
  const resolved = { ...plan, year }
  if (!ordered.length) return nothing(resolved)
  const barRows = ordered.filter((r) => r.category === main)
  const lead = barRows[0]
  const answer = plan.top && plan.top < 999 && lead ? `Top ${ordered.length} ${typeName(type)} in ${main}${whereOf(plan)}, ${year}: led by ${lead.institution} (rank ${lead.rank}, score ${lead.score ?? 'unavailable'}).` : `${chosen.length} ${typeName(type)} are listed${whereOf(plan)} in ${year}.${inMain.length ? ` ${inMain.length} appear in ${main}, led by ${lead.institution} (rank ${lead.rank}, score ${lead.score ?? 'unavailable'}).` : ''}${others.length ? ` The other ${others.length} are shown under the category they are listed in.` : ''}`
  return {
    answer,
    charts: barRows.length ? [{ type: 'bar', title: `${typeName(type)} in ${main}, ${year}`, xTitle: 'Institution', yTitle: 'Overall score', horizontal: true, showValues: true, series: [{ name: 'Score', x: barRows.map((r) => wrapLabel(r.institution, 30)), y: barRows.map((r) => r.score) }] }] : [],
    table: {
      columns: [{ key: 'institution', header: 'Institution' }, { key: 'category', header: 'Category' }, { key: 'rank', header: 'Rank', align: 'right' }, { key: 'score', header: 'Score', align: 'right' }, { key: 'state', header: 'State' }],
      rows: ordered.map((r) => ({ institution: r.institution, category: r.category, rank: r.rank, score: r.score, state: r.state })),
    },
    methodology: `Institutions whose recorded type is ${type}, one row each: their ${main} record when they have one, otherwise another category they are listed in.`,
    limitations: [SOURCE_NOTE],
    suggestions: [...(barRows.length > 1 ? [`Compare ${barRows[0].institution} and ${barRows[1].institution}`] : []), `Show this for ${year - 1}`],
    plan: resolved,
    assumptions: plan.year === undefined ? [`the latest year (${lastYear()})`] : [],
  }
}

function runLookup(plan: AnalysisPlan): Built {
  const id = (plan.institutions as string[])[0]
  const recs = recordsOf(id)
  const name = recs[recs.length - 1].institution
  const inCategory = plan.category ? recs.filter((r) => r.category === plan.category) : recs
  const scope = plan.category && inCategory.length ? inCategory : recs
  const year = plan.year ?? Math.max(...scope.map((r) => r.year))
  const rows = scope.filter((r) => r.year === year).sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))
  const say = (r: RankingRecord) => `rank ${r.rank ?? 'unavailable'} with a score of ${r.score ?? 'unavailable'} in ${r.category}`
  const parts: string[] = []
  if (plan.category && !inCategory.length) parts.push(`${name} is not listed in ${plan.category}; it appears in ${[...new Set(recs.map((r) => r.category))].join(', ')}.`)
  let shown = rows
  if (rows.length) {
    parts.push(`In ${year}, ${name} was ${rows.map(say).join('; ')}.`)
  } else {
    const years = [...new Set(scope.map((r) => r.year))].sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b).slice(0, 2).sort((a, b) => a - b)
    shown = scope.filter((r) => years.includes(r.year)).sort((a, b) => a.year - b.year)
    parts.push(`${name} was not listed${plan.category && inCategory.length ? ` in ${plan.category}` : ''} in ${year}. The nearest listed years are ${years.join(' and ')}: ${shown.map((r) => `${r.year}, ${say(r)}`).join('; ')}.`)
  }
  return {
    answer: parts.join(' '),
    charts: [],
    table: {
      columns: [{ key: 'year', header: 'Year' }, { key: 'category', header: 'Category' }, { key: 'rank', header: 'Rank', align: 'right' }, { key: 'score', header: 'Score', align: 'right' }],
      rows: shown.map((r) => ({ year: r.year, category: r.category, rank: r.rank, score: r.score })),
    },
    methodology: "Read directly from this institution's records in the loaded NIRF data.",
    limitations: [SOURCE_NOTE],
    suggestions: [`Tell me about ${name}`, ...(year > YEARS[0] ? [`What is the rank of ${name} in ${year - 1}`] : [])],
    plan: { ...plan, year },
    assumptions: plan.year === undefined ? [`its latest listed year (${year})`] : [],
  }
}

function runCount(plan: AnalysisPlan): Built {
  const year = plan.year ?? lastYear()
  const scope = scopeOf(plan)
  const top = plan.top
  const countFor = (y: number, c?: string) => new Set(selectRecords({ year: y, category: c }).filter(scope).filter((r) => top === undefined || (r.rank !== null && r.rank <= top)).map((r) => r.institutionId)).size
  const n = countFor(year, plan.category)
  const resolved = { ...plan, year }
  const subject = plan.institutionType ? typeName(plan.institutionType) : plan.category ? `${plan.category} institutions` : 'distinct institutions'
  const answer = `${n} ${subject} ${top === undefined ? 'are listed' : `rank in the top ${top}`}${whereOf(plan)} in ${year}${plan.category ? '' : ', counted across all categories'}.`
  const byYear = !!plan.category
  const labels = byYear ? YEARS.map(String) : CATEGORIES
  const values = byYear ? YEARS.map((y) => countFor(y, plan.category)) : CATEGORIES.map((c) => countFor(year, c))
  const order = byYear ? labels.map((_, i) => i) : labels.map((_, i) => i).sort((p, q) => values[q] - values[p])
  const col = byYear ? 'Year' : 'Category'
  return {
    answer,
    charts: [{ type: 'bar', title: byYear ? `${subject}${top === undefined ? '' : ` in the top ${top}`} per year` : `Institutions${top === undefined ? '' : ` in the top ${top}`} per category, ${year}`, xTitle: col, yTitle: 'Institutions', horizontal: !byYear, showValues: !byYear, yFromZero: true, series: [{ name: 'Institutions', x: order.map((i) => labels[i]), y: order.map((i) => values[i]) }] }],
    table: { columns: [{ key: 'group', header: col }, { key: 'count', header: 'Institutions', align: 'right' }], rows: order.map((i) => ({ group: labels[i], count: values[i] })) },
    methodology: `Distinct institutions${top === undefined ? ' listed' : ` with an exact rank of ${top} or better`}. An institution in several categories counts once in the headline number.`,
    limitations: [SOURCE_NOTE],
    suggestions: [`Show this for ${year - 1}`],
    plan: resolved,
    assumptions: plan.year === undefined ? [`the latest year (${lastYear()})`] : [],
  }
}

/** The category most institutions of a type are listed in: IIMs are mostly in Management, not Overall. */
function mainCategoryOf(type: string, year: number): string {
  const counts = new Map<string, number>()
  selectRecords({ year }).filter((r) => r.institutionType === type).forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Overall'
}

function runAggregate(plan: AnalysisPlan): Built {
  const year = plan.year ?? lastYear()
  const inferred = !plan.category && plan.institutionType ? mainCategoryOf(plan.institutionType, year) : undefined
  const category = plan.category ?? inferred ?? 'Overall'
  const metric = plan.metric ?? 'score'
  const stat = plan.aggregate ?? 'mean'
  const scope = scopeOf(plan)
  const label = metricLabel(metric)
  const pairs = (y: number) => selectRecords({ category, year: y }).filter(scope).map((r) => ({ r, v: metricValue(r, metric) })).filter((p): p is { r: RankingRecord; v: number } => p.v !== null)
  const compute = (vals: number[]) => (!vals.length ? null : round(stat === 'mean' ? vals.reduce((p, q) => p + q, 0) / vals.length : stat === 'median' ? median(vals) : stat === 'max' ? Math.max(...vals) : Math.min(...vals)))
  const now = pairs(year)
  const value = compute(now.map((p) => p.v))
  const resolved = { ...plan, category, year }
  if (value === null) return nothing(resolved)
  const word = { mean: 'average', median: 'median', max: 'highest', min: 'lowest' }[stat]
  const holder = stat === 'max' || stat === 'min' ? now.find((p) => round(p.v) === value)?.r.institution : undefined
  const group = plan.institutionType ? `${typeName(plan.institutionType)} in ${category}` : `${category} institutions`
  const answer = `The ${word} ${label} of ${group}${whereOf(plan)} in ${year} is ${value}${holder ? `, held by ${holder}` : ''}, across ${now.length} institutions.`
  const rows = YEARS.map((y) => { const p = pairs(y); return { year: String(y), value: compute(p.map((x) => x.v)), n: p.length } }).filter((r) => r.n > 0)
  return {
    answer,
    charts: rows.length > 1 ? [{ type: 'bar', title: `${word[0].toUpperCase()}${word.slice(1)} ${label} by year — ${category}${whereOf(plan)}`, xTitle: 'Year', yTitle: label, yFromZero: true, series: [{ name: label, x: rows.map((r) => r.year), y: rows.map((r) => r.value) }] }] : [],
    table: { columns: [{ key: 'year', header: 'Year' }, { key: 'value', header: word, align: 'right' }, { key: 'n', header: 'Institutions', align: 'right' }], rows },
    methodology: `The ${word} of non-missing ${label} values. The list only holds exact-ranked institutions, so this describes those institutions, not all institutions in India.`,
    limitations: [SOURCE_NOTE],
    suggestions: [`Show this for ${year - 1}`, `Show the distribution of ${metric === 'score' ? 'overall score' : metric} for ${category} in ${year}`],
    plan: resolved,
    assumptions: inferred ? [`category ${inferred}, where most ${typeName(plan.institutionType as string)} are listed`, ...(plan.year === undefined ? [`the latest year (${lastYear()})`] : [])] : baseAssumptions(plan),
  }
}

function runConsistency(plan: AnalysisPlan): Built {
  const category = plan.category ?? 'Overall'
  const top = plan.top
  const pool = selectRecords({ category }).filter(scopeOf(plan)).filter((r) => r.rank !== null && (top === undefined || r.rank <= top))
  const catYears = [...new Set(selectRecords({ category }).map((r) => r.year))].sort((p, q) => p - q)
  const seen = new Map<string, { name: string; years: number[] }>()
  pool.forEach((r) => {
    const cur = seen.get(r.institutionId) ?? { name: r.institution, years: [] }
    cur.years.push(r.year)
    cur.name = r.institution
    seen.set(r.institutionId, cur)
  })
  const rows = [...seen.values()].map((v) => ({ ...v, years: [...v.years].sort((p, q) => p - q) })).sort((p, q) => q.years.length - p.years.length || p.name.localeCompare(q.name))
  const resolved = { ...plan, category }
  if (!rows.length) return nothing(resolved)
  const always = rows.filter((r) => r.years.length === catYears.length)
  const span = `${catYears[0]}–${catYears[catYears.length - 1]}`
  const scopeText = top === undefined ? 'listed' : `in the top ${top}`
  const answer = always.length
    ? `${always.length} ${category} institution${always.length === 1 ? ' was' : 's were'} ${scopeText}${whereOf(plan)} in every year, ${span}: ${always.slice(0, 10).map((r) => r.name).join(', ')}${always.length > 10 ? `, and ${always.length - 10} more` : ''}.`
    : `No ${category} institution was ${scopeText}${whereOf(plan)} in every year, ${span}. The closest is ${rows[0].name}, in ${rows[0].years.length} of ${catYears.length} years.`
  const chartRows = rows.slice(0, 15)
  return {
    answer,
    charts: [{ type: 'bar', title: `Years ${scopeText} — ${category}, ${span}`, xTitle: 'Institution', yTitle: 'Years', horizontal: true, showValues: true, series: [{ name: 'Years', x: chartRows.map((r) => wrapLabel(r.name, 30)), y: chartRows.map((r) => r.years.length) }] }],
    table: { columns: [{ key: 'institution', header: 'Institution' }, { key: 'count', header: 'Years', align: 'right' }, { key: 'years', header: 'Which years' }], rows: rows.slice(0, 50).map((r) => ({ institution: r.name, count: r.years.length, years: r.years.join(', ') })) },
    methodology: `Counts the years each institution had an exact rank${top === undefined ? '' : ` of ${top} or better`} in this category.`,
    limitations: [SOURCE_NOTE],
    suggestions: [`Which institutions stayed in the top ${top === 10 ? 25 : 10} every year in ${category}`, ...(always.length > 1 ? [`Compare ${always[0].name} and ${always[1].name}`] : [])],
    plan: resolved,
    assumptions: baseAssumptions(plan, false),
  }
}

function runCategoryCompare(plan: AnalysisPlan): Built {
  const cats = plan.categories?.length ? plan.categories : CATEGORIES
  const year = plan.year ?? lastYear()
  const metric = plan.metric ?? 'score'
  const label = metricLabel(metric)
  const values = (c: string, y: number) => present(selectRecords({ category: c, year: y }).map((r) => metricValue(r, metric)))
  const stats = cats.map((c) => {
    const v = values(c, year)
    return { category: c, n: v.length, median: v.length ? round(median(v)) : null, mean: v.length ? round(v.reduce((p, q) => p + q, 0) / v.length) : null, max: v.length ? Math.max(...v) : null }
  }).filter((x) => x.n > 0)
  const resolved = { ...plan, year }
  if (!stats.length) return nothing(resolved)
  const key = plan.aggregate === 'mean' ? 'mean' : 'median'
  const word = key === 'mean' ? 'average' : 'median'
  const sorted = [...stats].sort((p, q) => (q[key] as number) - (p[key] as number))
  const answer = plan.categories && plan.categories.length >= 2
    ? `In ${year}, the ${word} ${label} is ${sorted.map((x) => `${x[key]} for ${x.category} (${x.n} institutions)`).join(' and ')}, so ${sorted[0].category} is higher.`
    : `${sorted[0].category} has the highest ${word} ${label} in ${year} (${sorted[0][key]})${sorted.length > 1 ? `, followed by ${sorted.slice(1, 3).map((x) => `${x.category} (${x[key]})`).join(' and ')}` : ''}.`
  const span = YEARS.filter((y) => cats.some((c) => values(c, y).length))
  return {
    answer,
    charts: [
      { type: 'box', title: `${label} distribution by category, ${year}`, xTitle: 'Category', yTitle: label, series: stats.map((x) => ({ name: x.category, y: values(x.category, year) })) },
      { type: 'line', title: `Median ${label} by year`, xTitle: 'Year', yTitle: `Median ${label}`, xTickValues: span, series: stats.map((x) => ({ name: x.category, x: span, y: span.map((y) => { const v = values(x.category, y); return v.length ? round(median(v)) : null }) })) },
    ],
    table: { columns: [{ key: 'category', header: 'Category' }, { key: 'n', header: 'Institutions', align: 'right' }, { key: 'median', header: 'Median', align: 'right' }, { key: 'mean', header: 'Average', align: 'right' }, { key: 'max', header: 'Highest', align: 'right' }], rows: sorted.map((x) => ({ ...x })) },
    methodology: 'Non-missing values for each category in the same year.',
    limitations: [SOURCE_NOTE, 'Categories list different numbers of institutions and are scored by NIRF separately, so treat comparisons between them as a rough guide.'],
    suggestions: [`Show this for ${year - 1}`],
    plan: resolved,
    assumptions: plan.year === undefined ? [`the latest year (${lastYear()})`] : [],
  }
}

function runGroup(plan: AnalysisPlan): Built {
  const noun = plan.groupBy as Exclude<GroupNoun, 'institution'>
  const byCategory = noun === 'category'
  const category = byCategory ? undefined : plan.category ?? 'Overall'
  const year = noun === 'year' ? undefined : plan.year ?? lastYear()
  const top = plan.top !== undefined && plan.top < 999 ? plan.top : undefined
  const metric = plan.metric ?? 'score'
  const stat = plan.aggregate
  const keyOf = (r: RankingRecord): string => {
    if (noun === 'zone') return r.zone ?? ZONE_BY_STATE[r.state] ?? 'Unknown'
    if (noun === 'year') return String(r.year)
    return r[noun]
  }
  const pool = selectRecords({ category, year }).filter(scopeOf(plan)).filter((r) => top === undefined || (r.rank !== null && r.rank <= top))
  const resolved = { ...plan, category, year }
  if (!pool.length) return nothing(resolved)

  const groups = new Map<string, RankingRecord[]>()
  pool.forEach((r) => groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]))
  const lowerBetter = metric === 'rank'
  const compute = (v: number[]) => (stat === 'mean' ? v.reduce((a, b) => a + b, 0) / v.length : stat === 'median' ? median(v) : stat === 'max' ? Math.max(...v) : Math.min(...v))
  const rows = [...groups.entries()]
    .map(([group, rs]) => {
      const count = new Set(rs.map((r) => r.institutionId)).size
      const vals = present(rs.map((r) => metricValue(r, metric)))
      return { group, count, value: stat ? (vals.length ? round(compute(vals)) : null) : count }
    })
    .filter((r) => r.value !== null)
    .sort((a, b) => ((b.value as number) - (a.value as number)) * (stat && lowerBetter ? -1 : 1) || a.group.localeCompare(b.group))
  if (!rows.length) return nothing(resolved)

  const header = GROUP_HEADER[noun]
  const word = stat ? { mean: 'average', median: 'median', max: 'highest', min: 'lowest' }[stat] : ''
  const measure = stat ? `${word} ${metricLabel(metric)}` : 'Institutions'
  const tiers: { names: string[]; value: number }[] = []
  rows.forEach((r) => {
    const last = tiers[tiers.length - 1]
    if (last && last.value === r.value) last.names.push(r.group)
    else tiers.push({ names: [r.group], value: r.value as number })
  })
  const [first, ...others] = tiers
  const next: string[] = []
  let named = 0
  for (const t of others) {
    if (named >= 2) break
    next.push(tier(t.names, t.value))
    named += t.names.length
  }
  const whereIn = `${category && top !== undefined ? ` in the ${category} top ${top}` : category ? ` among listed ${category} institutions` : top !== undefined ? ` in the top ${top}` : ''}${whereOf(plan)}${year ? ` in ${year}` : ''}`
  const verb = first.names.length > 1 ? 'have' : 'has'
  const superlative = word === 'highest' || word === 'lowest' ? word : `highest ${word}`
  const lead = stat
    ? `${first.names.join(' and ')} ${verb} the ${superlative} ${metricLabel(metric)} (${first.value})${whereIn}`
    : `${first.names.join(' and ')} ${verb} the most institutions (${first.value})${whereIn}`
  const plural = { state: 'states', zone: 'zones', city: 'cities', category: 'categories', year: 'years' }[noun]
  const answer = `${plan.countGroups ? `${rows.length} ${plural} have institutions${whereIn}. ` : ''}${lead}${next.length ? `, followed by ${next.join(' and ')}` : ''}.`

  const shown = rows.slice(0, 15)
  const charts: ChartSpec[] = [{ type: 'bar', title: `${measure} per ${header.toLowerCase()}${whereIn}`, xTitle: header, yTitle: measure, horizontal: noun !== 'year', showValues: true, series: [{ name: measure, x: shown.map((r) => r.group), y: shown.map((r) => r.value), ...(noun === 'zone' ? { colors: shown.map((r) => ZONE_COLORS[r.group] ?? DASH_COLOR) } : {}) }] }]
  if (noun === 'state' && !stat) {
    const zones = new Map<string, number>()
    pool.forEach((r) => {
      const z = r.zone ?? ZONE_BY_STATE[r.state]
      if (z) zones.set(z, (zones.get(z) ?? 0) + 1)
    })
    const list = [...zones.entries()].sort((a, b) => b[1] - a[1])
    if (list.length) charts.push({ type: 'bar', title: `Share of institutions by zone${whereIn}`, xTitle: 'Zone', yTitle: 'Share (%)', horizontal: true, showValues: true, series: [{ name: 'Share (%)', x: list.map(([z]) => z), y: list.map(([, n]) => round((n / pool.length) * 100)), colors: list.map(([z]) => ZONE_COLORS[z] ?? DASH_COLOR) }] })
  }
  return {
    answer,
    charts,
    table: {
      columns: [{ key: 'group', header }, { key: 'count', header: 'Institutions', align: 'right' }, ...(stat ? [{ key: 'value', header: word[0].toUpperCase() + word.slice(1), align: 'right' as const }] : [])],
      rows: rows.map((r) => ({ group: r.group, count: r.count, ...(stat ? { value: r.value } : {}) })),
    },
    methodology: `${top === undefined ? 'Listed institutions' : `Institutions with an exact rank of ${top} or better`} are grouped by ${header.toLowerCase()}.`,
    limitations: [SOURCE_NOTE],
    suggestions: [...(year && year > YEARS[0] ? [`Show this for ${year - 1}`] : [])],
    plan: resolved,
    assumptions: [...(plan.category === undefined && !byCategory ? ['category Overall'] : []), ...(plan.year === undefined && noun !== 'year' ? [`the latest year (${lastYear()})`] : []), ...(plan.bestMeansCount ? ['"best" means having the most institutions listed'] : [])],
  }
}

/** One specific question plus clickable readings that keep what was detected. */
function clarifyOptions(e: Entities): { ask: string; options: string[] } {
  const y = e.year ?? lastYear()
  const place = e.state ? ` in ${e.state}` : ''
  if (e.category) {
    const c = e.category
    return {
      ask: `What would you like to know about ${c}${place}?`,
      options: [`Rank trend of the top ${c} institutions${place}`, `Score trend of the top ${c} institutions${place}`, `Top ${c} institutions${place} in ${y}`, e.state ? `Average score of ${c} institutions${place} in ${y}` : `${c} states ranking in ${y}`],
    }
  }
  if (e.metric) {
    return { ask: `What would you like to know about ${e.metric}?`, options: [`What is ${e.metric}?`, `Distribution of ${e.metric} in ${y}`, `Average ${e.metric} in ${y}`, `Outliers in ${e.metric} in ${y}`] }
  }
  if (e.state) {
    return { ask: `What would you like to know about ${e.state}?`, options: [`Top institutions${place} in ${y}`, `Score trend of the top institutions${place}`, `How many institutions are listed${place} in ${y}`, `Best college${place} in ${y}`] }
  }
  if (e.year !== undefined) {
    return { ask: `What would you like to see for ${y}?`, options: [`Top institutions in ${y}`, `How many institutions are listed in ${y}`, `Which states have the most institutions in ${y}`, `Show outliers in overall score in ${y}`] }
  }
  return { ask: 'I could not map that to an analysis of the NIRF data. Which of these is closest?', options: EXAMPLE_QUESTIONS.slice(0, 4) }
}

const sortedBars = (chart: ChartSpec, names: string[], values: (number | null)[], extra: Partial<ChartSpec['series'][number]> = {}, sort = true): ChartSpec => ({
  ...chart,
  horizontal: true,
  sortDesc: sort,
  showValues: true,
  series: [{ ...chart.series[0], x: names.map((n) => wrapLabel(n, 30)), y: values, ...extra }],
})

function runGeneral(plan: AnalysisPlan): Built {
  const category = plan.category ?? 'Overall'
  const catYears = [...new Set(selectRecords({ category }).map((r) => r.year))].sort((a, b) => a - b)
  const year = plan.year ?? lastYear()
  const shared = { category, state: plan.state, zone: plan.zone }
  const spec: MockSpec = (() => {
    switch (plan.kind) {
      case 'trend': return { kind: plan.metric === 'rank' ? 'trendRank' : 'trendScore', ...shared, metric: plan.metric ?? 'score', top: plan.top ?? 5, yearRange: plan.year2 ? [plan.year as number, plan.year2] as [number, number] : undefined }
      case 'outliers': return { kind: 'outliers', ...shared, year, metric: plan.metric ?? 'score', method: 'iqr' as const }
      case 'movers': return { kind: 'movers', ...shared, year: plan.year ?? catYears[0], year2: plan.year2 ?? lastYear(), metric: plan.direction ?? 'improve', top: plan.top ?? 10 }
      case 'histogram': return { kind: 'histogram', ...shared, year, metric: plan.metric ?? 'score' }
      case 'corr': return { kind: 'corr', ...shared, year }
      default: return { kind: 'topList', ...shared, year, top: plan.top ?? 10 }
    }
  })()
  const res = runAnalysis(spec)
  const rows = res.table.rows
  let answer = res.summary
  let chart = res.chart as ChartSpec

  if (plan.kind === 'movers' && rows.length) {
    const changes = rows.map((r) => r.change as number)
    chart = sortedBars(chart, rows.map((r) => String(r.name)), changes, {
      colors: changes.map((c) => (c > 0 ? IMPROVED_COLOR : DECLINED_COLOR)),
      text: changes.map((c) => (c > 0 ? `+${c}` : String(c))),
    }, false)
    answer = `${res.summary} ${rows.slice(0, 3).map((r) => `${r.name} (${(r.change as number) > 0 ? '+' : ''}${r.change})`).join(', ')}.`
  } else if (plan.kind === 'outliers' && rows.length) {
    answer = `${res.summary} ${rows.slice(0, 5).map((r) => `${r.institution} (${r.value})`).join(', ')}.`
  } else if (plan.kind === 'trend') {
    chart = { ...chart, xTickValues: chart.series[0]?.x as number[] | undefined, ...(chart.reverseY ? { rankAxis: true } : {}) }
    const isRank = plan.metric === 'rank'
    const leader = chart.series
      .map((s) => ({ name: s.name, v: [...(s.y ?? [])].reverse().find((v) => v !== null) ?? null }))
      .filter((s): s is { name: string; v: number } => s.v !== null)
      .sort((a, b) => (isRank ? a.v - b.v : b.v - a.v))[0]
    if (leader) answer = `${answer} ${leader.name} is ahead most recently, at ${isRank ? 'rank ' : ''}${leader.v}.`
  } else if (plan.kind === 'corr') {
    chart = { ...chart, diverging: true, showValues: true }
    const scoreRow = rows.find((r) => r.row === 'score')
    const strongest = Object.entries(scoreRow ?? {})
      .filter((e): e is [string, number] => e[0] !== 'row' && e[0] !== 'score' && typeof e[1] === 'number')
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
    if (strongest) answer = `${answer} ${strongest[0]} is most closely linked to the overall score (r = ${strongest[1]}).`
  }

  const assumptions = baseAssumptions(plan, plan.kind !== 'trend' && plan.kind !== 'movers')
  if (plan.kind === 'trend' && plan.top === undefined) {
    answer = `${answer} I used the top ${chart.series.length} ${category} institutions${whereOf(plan)} of ${lastYear()}; ask for a different number to change this.`
  }
  if (plan.recent) answer = `${answer} I took "recent" to mean ${plan.year}–${plan.year2}.`

  const charts = [chart]
  const yearBased = plan.kind !== 'trend' && plan.kind !== 'movers'
  const prevYear = catYears.filter((y) => y < year).pop()
  const pair = plan.kind === 'topList' && rows.length > 1 ? [`Compare ${rows[0].institution} and ${rows[1].institution}`] : []
  return {
    answer,
    charts,
    table: rows.length ? res.table : undefined,
    methodology: res.methodology,
    limitations: res.limitations,
    suggestions: [...pair, ...(yearBased && prevYear ? [`Show this for ${prevYear}`] : []), ...(yearBased ? [] : [`Show this for ${category === 'Engineering' ? 'University' : 'Engineering'}`])].slice(0, 2),
    plan: { ...plan, category, ...(plan.kind === 'trend' ? { top: chart.series.length } : {}), ...(plan.kind === 'movers' ? { year: spec.year, year2: spec.year2 } : yearBased ? { year } : {}) },
    assumptions,
  }
}

const CHART_NAMES: Partial<Record<ChartSpec['type'], string>> = { line: 'Line', bar: 'Bar', box: 'Box plot', histogram: 'Histogram', heatmap: 'Heatmap' }

function understoodFor(plan: AnalysisPlan, charts: ChartSpec[], defaulted: Set<string>) {
  const out: { label: string; value: string }[] = []
  const mark = (label: string, value: string) => out.push({ label, value: defaulted.has(label) ? `${value} (default)` : value })
  if (plan.groupBy) out.push({ label: 'Grouped by', value: GROUP_HEADER[plan.groupBy] })
  if (plan.institutionType) out.push({ label: 'Type', value: plan.institutionType })
  if (plan.categories?.length) out.push({ label: 'Categories', value: plan.categories.join(', ') })
  if (plan.aggregate) out.push({ label: 'Statistic', value: { mean: 'Average', median: 'Median', max: 'Highest', min: 'Lowest' }[plan.aggregate] })
  if (plan.institutions?.length) out.push({ label: 'Institutions', value: plan.institutions.map((id) => { const r = recordsOf(id); return r[r.length - 1].institution }).join(', ') })
  if (plan.category) mark('Category', plan.category)
  if (plan.year2) out.push({ label: 'Years', value: `${plan.year ?? YEARS[0]}–${plan.year2}` })
  else if (plan.year) mark('Year', String(plan.year))
  else if (plan.kind === 'trend') out.push({ label: 'Years', value: 'All years (default)' })
  if (plan.state) out.push({ label: 'State', value: plan.state })
  if (plan.zone) out.push({ label: 'Zone', value: plan.zone })
  if (plan.metric === 'rank') out.push({ label: 'Metric', value: 'Rank' })
  else if (plan.metric && plan.metric !== 'score') out.push({ label: 'Parameter', value: plan.metric })
  else if (plan.kind === 'trend') out.push({ label: 'Metric', value: 'Overall score' })
  if (plan.top && plan.top < 999) mark('Top', String(plan.top))
  const types = [...new Set(charts.map((c) => CHART_NAMES[c.type] ?? c.type))]
  if (types.length) out.push({ label: 'Charts', value: types.join(', ') })
  return out
}

/** Local planner: understands the question, runs the plan on the loaded records, computes the answer. */
export function answerQuestion(question: string, previous?: AnalysisPlan): AIQueryResponse {
  const intent = classifyIntent(question)
  if (intent !== 'analysis') {
    const reply = chatReply(intent, question)
    return chat(question, reply.answer, reply.suggestions)
  }

  const { corrected, corrections } = correctSpelling(question)
  const shown = corrections.length ? { corrections, correctedQuestion: corrected } : {}
  const found = findInstitutions(corrected)

  if (found.notFound.length) {
    const f = found.notFound[0]
    const typed = question.match(new RegExp('\\b' + f + '\\b', 'i'))?.[0] ?? f
    const known = found.matches[0]?.name
    return chat(question, 'I could not find "' + typed + '" in the NIRF data. Did you mean one of these?', known ? ['Tell me about ' + known] : [], {
      ...shown,
      clarify: { fragment: f, options: closestInstitutions(f).map((o) => ({ ...o, question: corrected.replace(new RegExp('\\b' + f + '\\b'), o.name) })) },
    })
  }
  if (found.ambiguous.length) {
    const { fragment, options } = found.ambiguous[0]
    return chat(question, 'Which institution do you mean by "' + fragment + '"?', [], {
      ...shown,
      clarify: { fragment, options: options.map((o) => ({ ...o, question: corrected.replace(new RegExp('\\b' + fragment + '\\b'), o.name) })) },
    })
  }

  const e = extractEntities(corrected, question, found.consumed)
  const categories = extractCategories(corrected, found.consumed)
  const type = detectInstitutionType(corrected)
  const follow = previous && FOLLOW_UP.test(corrected) ? previous : undefined
  let ids = found.matches.map((m) => m.id)
  if (follow?.institutions?.length) {
    if (!ids.length) ids = follow.institutions
    else if (follow.kind === 'compare') ids = /\binstead\b/.test(corrected) ? [...follow.institutions.slice(0, -1), ...ids] : [...follow.institutions, ...ids]
    else if (COMPARE_WORD.test(corrected)) ids = [...follow.institutions, ...ids]
  }
  ids = [...new Set(ids)].slice(0, 5)

  // The grouping noun decides first; count and aggregate only apply when there is none.
  const noun = ids.length ? undefined : groupingNoun(corrected) ?? follow?.groupBy
  const word = noun ? kindForNoun(noun, corrected) : detectKind(corrected, categories, type)
  const lookup = ids.length === 1 && (LOOKUP_WORD.test(corrected) || (e.year !== undefined && /\b(rank|ranked|score)\b/.test(corrected)))
  const kind: AnalysisPlan['kind'] | undefined = ids.length >= 2 ? 'compare' : lookup ? 'lookup' : ids.length === 1 ? 'institution' : word ?? follow?.kind
  if (!kind) {
    const { ask, options } = clarifyOptions(e)
    return chat(question, ask, options, shown)
  }

  const plan: AnalysisPlan = {
    kind,
    institutions: ids.length ? ids : undefined,
    category: kind === 'categoryCompare' ? undefined : e.category ?? follow?.category,
    categories: kind === 'categoryCompare' && categories.length >= 2 ? categories : undefined,
    institutionType: type ?? follow?.institutionType,
    state: e.state ?? follow?.state,
    zone: e.zone ?? follow?.zone,
    year: e.year ?? follow?.year,
    year2: e.year2 ?? (e.year !== undefined ? undefined : follow?.year2),
    metric: e.metric ?? follow?.metric ?? (kind === 'trend' && /\branks?\b/.test(corrected) ? 'rank' : undefined),
    top: e.top ?? follow?.top ?? (kind === 'consistency' && /\btop\b/.test(corrected) ? 10 : /\blist all\b/.test(corrected) ? 1000 : undefined),
    aggregate: statOf(corrected) ?? follow?.aggregate,
    direction: /\b(worst|bottom)\b/.test(corrected) || DECLINE_WORD.test(corrected) ? 'decline' : word === 'movers' ? 'improve' : follow?.direction,
    lead: LEAD_WORD.test(corrected) || /\b(which|what) (college|university|institute|institution)\b/.test(corrected),
    groupBy: noun,
    countGroups: /\bhow many (states|regions|zones|cities|categories)\b/.test(corrected),
    bestMeansCount: !!noun && noun !== 'institution' && /\bbest\b/.test(corrected),
    recent: e.recent,
  }
  const run = {
    compare: runCompare,
    institution: runInstitution,
    lookup: runLookup,
    count: runCount,
    aggregate: runAggregate,
    consistency: runConsistency,
    categoryCompare: runCategoryCompare,
    topList: plan.institutionType ? runTypeList : runTop,
    stateCount: runGroup,
    groupCount: runGroup,
  } as Partial<Record<AnalysisPlan['kind'], (p: AnalysisPlan) => Built>>
  let built = (run[kind] ?? runGeneral)(plan)
  // Self-check: re-plan once with the grouping noun forced, and ask rather than show a wrong answer.
  if (noun && (built.charts.length || built.table) && !groupingFits(noun, built.table, built.charts.filter(chartHasData))) {
    const forced: AnalysisPlan = { ...plan, kind: kindForNoun(noun, corrected), groupBy: noun }
    built = (run[forced.kind] ?? runGeneral)(forced)
    if ((built.charts.length || built.table) && !groupingFits(noun, built.table, built.charts.filter(chartHasData))) {
      return chat(question, `I could not group that by ${GROUP_HEADER[noun].toLowerCase()}. Which of these did you mean?`, clarifyOptions(e).options, shown)
    }
  }
  const charts = built.charts.filter(chartHasData)
  const defaulted = new Set([...(plan.category === undefined ? ['Category'] : []), ...(plan.year === undefined ? ['Year'] : []), ...(plan.top === undefined ? ['Top'] : [])])
  const understood = understoodFor(built.plan, charts, defaulted)

  if (!charts.length && !built.table?.rows.length) {
    const scope = [built.plan.institutionType, built.plan.category, built.plan.year, built.plan.state, built.plan.metric].filter(Boolean).join(', ')
    return chat(question, 'I found no data for that selection (' + scope + '). Try a different year or category.', clarifyOptions(e).options.slice(0, 3), { ...shown, understood, plan: built.plan })
  }
  const assumptions = built.assumptions ?? []
  return {
    question,
    answer: assumptions.length ? built.answer + ' I assumed ' + assumptions.join(' and ') + '.' : built.answer,
    kind: 'analysis',
    charts,
    table: built.table,
    filters: [],
    methodology: built.methodology + ' Your question is matched by rules in this app; every number is computed from the loaded records.',
    limitations: built.limitations,
    isMock: USE_MOCK,
    understood,
    assumptions,
    suggestions: [...new Set([...built.suggestions, ...STARTERS])].slice(0, 2),
    plan: built.plan,
    ...shown,
  }
}
