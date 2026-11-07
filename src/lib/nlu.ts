import { CATEGORIES, PARAMS, YEARS } from '../data/mock/constants'
import { RECORDS } from '../data/mock/rankings'
import { listInstitutions } from '../data/selectors'
import type { ParamKey } from '../types'
import { ABBREVIATIONS, normalise } from './search'

export const normalize = normalise

const words = (s: string) => s.split(' ').filter(Boolean)

export const STOP_WORDS = new Set(words(
  'a about after again all also am an and any are as at be been before being between both but by can could did do does doing done each even ever every feel few for from get give go going good got had has have having he hello help her here hey hi him his how i if in into is it its just kind know last latest let like look looks lot many may me mean means more much must my namaste near need new no not now of off ok okay on once one only or other our out over please same see she should show so some such tell than thank thanks that the their them then there these they thing think this those through to too two up us use very want was way we well were what whats when where which while who whom whose why will with would yes yet you your yours yourself ' +
  'answer ask explain define meaning question instead sure lately recently little since until till during across within per ago time times number something anything stand stands standing'))

const KEYWORDS = words(
  'compare compared comparison versus trend trends change changed changes improve improved improvement improving decline declined declining drop dropped fall fell falling rise rose rising gain gained lost mover movers outlier outliers distribution histogram spread correlation correlate correlated top best worst highest lowest leading state states region regions zone zones rank ranks ranking rankings ranked score scores scored mobility median nirf history performance performing perform better difference list year years category categories parameter parameters most college colleges university universities institute institutes institution institutions listed average mean count stayed stay remained always consistently consistent progress relationship risers fallers bottom topper city cities')
const NAME_WORDS = new Set(['college', 'university', 'institute', 'institution'])
const TYPE_WORDS = new Set([...NAME_WORDS, 'school', 'academy'])
const TYPE_PLURALS: Record<string, string> = { iits: 'IIT', nits: 'NIT', iims: 'IIM', iiits: 'IIIT', iisers: 'IISER' }
const LIST_WORD = /\b(all|list|every|how many|average|mean|median|top \d+|best \d+|highest|lowest)\b/

/** "list all IITs" asks about a type of institution, not one institution. */
export function detectInstitutionType(text: string): string | undefined {
  const plural = words(text).find((w) => TYPE_PLURALS[w])
  if (plural) return TYPE_PLURALS[plural]
  if (!LIST_WORD.test(text)) return undefined
  return text.match(/\b(iit|nit|iim|iiit|iiser|aiims)\b(?= in\b| for\b| from\b| by\b|$)/)?.[1].toUpperCase()
}
const PARAM_WORDS = words('tlr rpc oi perception teaching graduation outcomes outreach inclusivity overall')

/** Words that are never part of an institution name in a question. */
const FILLER = new Set([...STOP_WORDS, ...KEYWORDS.filter((k) => !NAME_WORDS.has(k)), ...PARAM_WORDS, 'sho'])

const GENERIC_NAME = new Set(words('college university institute institution engineering medical law management pharmacy research dental architecture planning agriculture science technology national indian'))
const NAME_STOP = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'to'])

const CATEGORY_SYNONYMS: [string, string][] = [
  ['engineering', 'Engineering'], ['engg', 'Engineering'], ['management', 'Management'], ['mba', 'Management'],
  ['medical', 'Medical'], ['medicine', 'Medical'], ['pharmacy', 'Pharmacy'], ['law', 'Law'], ['legal', 'Law'],
  ['architecture', 'Architecture and Planning'], ['dental', 'Dental'], ['dentistry', 'Dental'], ['research', 'Research'],
  ['agriculture', 'Agriculture and Allied Sectors'], ['agricultural', 'Agriculture and Allied Sectors'], ['overall', 'Overall'],
  ['colleges', 'College'], ['college', 'College'], ['universities', 'University'], ['university', 'University'],
]
const STATE_ABBREVIATIONS: Record<string, string> = {
  TN: 'Tamil Nadu', UP: 'Uttar Pradesh', MP: 'Madhya Pradesh', AP: 'Andhra Pradesh', WB: 'West Bengal', MH: 'Maharashtra',
  KA: 'Karnataka', KL: 'Kerala', GJ: 'Gujarat', RJ: 'Rajasthan', PB: 'Punjab', HR: 'Haryana', TS: 'Telangana', OD: 'Odisha',
  BR: 'Bihar', JK: 'Jammu and Kashmir', DL: 'Delhi', CG: 'Chhattisgarh', JH: 'Jharkhand',
}
const ZONES = ['North Eastern', 'Northern', 'Southern', 'Eastern', 'Western', 'Central']

/* ------------------------------ Vocabulary ----------------------------- */
interface IndexedInstitution { id: string; name: string; norm: string; nameTokens: string[]; place: Set<string> }
interface Vocabulary {
  /** 0 data terms, 1 ordinary words, 2 institution-name words */
  tier: Map<string, number>
  freq: Map<string, number>
  states: string[]
  categoryTerms: [string, string][]
  dataWords: Set<string>
  institutions: IndexedInstitution[]
}
let cached: Vocabulary | null = null

function vocabulary(): Vocabulary {
  if (cached) return cached
  const tier = new Map<string, number>()
  const freq = new Map<string, number>()
  const add = (word: string, t: number) => {
    if (word.length < 3) return
    const cur = tier.get(word)
    if (cur === undefined || t < cur) tier.set(word, t)
  }
  const institutions = listInstitutions().map((i) => {
    const norm = normalize(i.name)
    const nameTokens = words(norm).filter((w) => !NAME_STOP.has(w))
    nameTokens.forEach((w) => {
      add(w, 2)
      freq.set(w, (freq.get(w) ?? 0) + 1)
    })
    return { id: i.id, name: i.name, norm, nameTokens, place: new Set(words(normalize(`${i.city} ${i.state}`))) }
  })
  const states = [...new Set(RECORDS.map((r) => r.state))].filter((s) => s !== 'Unknown').sort((a, b) => b.length - a.length)
  const categoryTerms: [string, string][] = [
    ...[...CATEGORIES].sort((a, b) => b.length - a.length).map((c): [string, string] => [normalize(c), c]),
    ...CATEGORY_SYNONYMS.filter(([, c]) => CATEGORIES.includes(c)),
  ]
  const dataWords = new Set<string>([...KEYWORDS, ...PARAM_WORDS])
  ;[...states, ...ZONES.map((z) => `${z} zone`), ...categoryTerms.map(([t]) => t), ...PARAMS.map((p) => normalize(p.full))]
    .forEach((t) => words(normalize(t)).forEach((w) => dataWords.add(w)))
  dataWords.forEach((w) => add(w, 0))
  STOP_WORDS.forEach((w) => add(w, 1))
  cached = { tier, freq, states, categoryTerms, dataWords, institutions }
  return cached
}

/* --------------------------- Spell correction -------------------------- */
/** Damerau-Levenshtein distance (with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Phonetic fallback: first letter plus the sound of the consonants. */
function skeleton(word: string): string {
  const sounds = word.slice(1).replace(/ph/g, 'f').replace(/[ckq]/g, 'k').replace(/[sz]/g, 's').replace(/[aeiouyhw]/g, '')
  return word[0] + sounds.replace(/(.)\1+/g, '$1')
}

function correctWord(word: string, v: Vocabulary): string {
  const max = word.length <= 5 ? 1 : 2
  let best: { w: string; d: number; t: number; f: number } | null = null
  for (const [w, t] of v.tier) {
    if (w[0] !== word[0] || w.length < 4 || Math.abs(w.length - word.length) > max) continue
    const d = editDistance(word, w)
    // A name word must be one edit away, so "harvard" does not become "hamdard".
    if (d > max || (t === 2 && d > 1)) continue
    const f = v.freq.get(w) ?? 0
    if (!best || d < best.d || (d === best.d && (t < best.t || (t === best.t && f > best.f)))) best = { w, d, t, f }
  }
  if (best) return best.w
  const shape = skeleton(word)
  if (shape.length < 3) return word
  for (const [w] of v.tier) {
    if (w[0] === word[0] && w.length >= 4 && Math.abs(w.length - word.length) <= 3 && skeleton(w) === shape) return w
  }
  return word
}

export interface Correction { from: string; to: string }

export function correctSpelling(question: string): { corrected: string; corrections: Correction[] } {
  const v = vocabulary()
  const corrections: Correction[] = []
  const out = words(normalize(question.replace(/,/g, ' and '))).map((word) => {
    if (word.length < 4 || /\d/.test(word) || v.tier.has(word) || ABBREVIATIONS.has(word) || TYPE_PLURALS[word]) return word
    const to = correctWord(word, v)
    if (to !== word) corrections.push({ from: word, to })
    return to
  })
  return { corrected: out.join(' '), corrections }
}

/* ------------------------- Institution resolution ---------------------- */
export interface InstitutionMatches {
  matches: { id: string; name: string; confidence: number }[]
  ambiguous: { fragment: string; options: { id: string; name: string }[] }[]
  notFound: string[]
  /** question words used up as institution names, so "Anna University" is not read as a category */
  consumed: string[]
}

function wordScore(word: string, token: string): number {
  if (word === token) return 1
  if (word.length >= 4 && token.startsWith(word)) return 0.8
  if (word.length >= 5 && token[0] === word[0] && Math.abs(token.length - word.length) <= 1 && editDistance(word, token) <= 1) return 0.7
  return 0
}

function scoreInstitution(inst: IndexedInstitution, query: string[]): { confidence: number; exact: boolean } | null {
  const used = new Set<number>()
  let total = 0
  for (const word of query) {
    let best = 0
    let at = -1
    inst.nameTokens.forEach((t, i) => {
      const s = wordScore(word, t)
      if (s > best) {
        best = s
        at = i
      }
    })
    if (best > 0) {
      total += best
      used.add(at)
    } else if (inst.place.has(word)) total += 0.5
    else return null
  }
  const quality = query.length ? total / query.length : 0
  return { confidence: (used.size / inst.nameTokens.length) * quality, exact: quality === 1 }
}

function rankCandidates(tokens: string[], v: Vocabulary) {
  const phrases = tokens.filter((t) => ABBREVIATIONS.has(t)).map((t) => ABBREVIATIONS.get(t) as string)
  const query = tokens.flatMap((t) => words(ABBREVIATIONS.get(t) ?? t)).filter((w) => !NAME_STOP.has(w))
  const leads = (inst: IndexedInstitution) => (phrases.some((p) => inst.norm.startsWith(p)) ? 1 : 0)
  const scored = v.institutions
    .map((inst) => ({ inst, s: scoreInstitution(inst, query) }))
    .filter((c): c is { inst: IndexedInstitution; s: { confidence: number; exact: boolean } } => c.s !== null)
    .sort((a, b) => b.s.confidence - a.s.confidence || leads(b.inst) - leads(a.inst) || a.inst.name.localeCompare(b.inst.name))
  const withPhrase = scored.filter((c) => phrases.every((p) => c.inst.norm.includes(p)))
  return {
    scored: withPhrase.length ? withPhrase : scored,
    // "IIT Allahabad" only matches an IIIT: offer it rather than chart a different institute.
    phraseMissing: phrases.length > 0 && !withPhrase.length && scored.length > 0,
    usedAbbreviation: phrases.length > 0,
  }
}

const IN_COMPARE = /\b(compare|compared|comparison|versus|vs|between)\b/
const NAME_TRIGGER = /\b(about|rank of|ranking of|score of|profile of|history of)\b/

export function findInstitutions(question: string): InstitutionMatches {
  const v = vocabulary()
  const text = normalize(question.replace(/,/g, ' and '))
  const inCompare = IN_COMPARE.test(text)
  const terms = [...v.categoryTerms.map(([t]) => t), ...v.states.map(normalize)].sort((a, b) => b.length - a.length).join('|')
  const type = detectInstitutionType(text)
  const cleaned = (type ? text.replace(new RegExp(`\\b${type.toLowerCase()}s?\\b`, 'g'), ' ') : text)
    .replace(/\b(top|best) \d{1,3}\b/g, ' ')
    .replace(/\b20\d\d\b/g, ' ')
    .replace(new RegExp(`\\b(in|for|from|under|within) (the )?(${terms})\\b`, 'g'), ' ')
  const parts = cleaned
    .split(/\b(?:compare|compared|comparison|versus|vs|and|with|between|or|against|to)\b/)
    .map((raw) => ({ trigger: NAME_TRIGGER.test(raw), tokens: words(raw).filter((w) => !FILLER.has(w)) }))
    .filter((p) => p.tokens.length)

  const out: InstitutionMatches = { matches: [], ambiguous: [], notFound: [], consumed: [] }
  const accept = (id: string, name: string, confidence: number) => {
    if (!out.matches.some((m) => m.id === id)) out.matches.push({ id, name, confidence: Math.round(confidence * 100) / 100 })
  }
  const isGeneric = (t: string) => GENERIC_NAME.has(t) || v.dataWords.has(t)

  for (let i = 0; i < parts.length; i++) {
    // Names can contain a splitting word ("Birla Institute of Technology and Science, Pilani").
    let merged = false
    for (let size = Math.min(3, parts.length - i); size >= 2 && !merged; size--) {
      const tokens = parts.slice(i, i + size).flatMap((p) => p.tokens)
      if (tokens.every(isGeneric)) continue
      const { scored } = rankCandidates(tokens, v)
      if (scored[0]?.s.confidence === 1 && scored[1]?.s.confidence !== 1) {
        accept(scored[0].inst.id, scored[0].inst.name, 1)
        out.consumed.push(...tokens)
        i += size - 1
        merged = true
      }
    }
    if (merged) continue

    const { tokens, trigger } = parts[i]
    const fragment = tokens.join(' ')
    const residual = tokens.filter((t) => !isGeneric(t))
    const { scored, phraseMissing, usedAbbreviation } = rankCandidates(tokens, v)
    const top = scored[0]

    // Only categories, states, metrics and keywords are left: that is not a name, unless it is an exact one.
    if (!residual.length && !usedAbbreviation) {
      if (top?.s.confidence === 1 && tokens.length >= 2 && scored[1]?.s.confidence !== 1) {
        accept(top.inst.id, top.inst.name, 1)
        out.consumed.push(...tokens)
      }
      continue
    }
    const triggered = inCompare || trigger
    const typeWord = tokens.some((t) => TYPE_WORDS.has(t))
    const nameWord = residual.some((t) => v.freq.has(t))
    if (!usedAbbreviation && !nameWord && !typeWord && !triggered) continue
    if (!top) {
      if (triggered || typeWord) {
        out.notFound.push(fragment)
        out.consumed.push(...tokens)
      }
      continue
    }
    const allowed = triggered || usedAbbreviation || residual.some((t) => (v.freq.get(t) ?? 99) <= 8)
    const options = scored.slice(0, 6).map((c) => ({ id: c.inst.id, name: c.inst.name }))
    if (phraseMissing) {
      out.ambiguous.push({ fragment, options })
      out.consumed.push(...tokens)
      continue
    }
    const tied = scored[1] && Math.abs(scored[1].s.confidence - top.s.confidence) < 0.001
    if ((top.s.confidence >= 0.6 && !tied) || (scored.length === 1 && (allowed || top.s.exact))) {
      accept(top.inst.id, top.inst.name, top.s.confidence)
      out.consumed.push(...tokens)
    } else if (allowed) {
      out.ambiguous.push({ fragment, options })
      out.consumed.push(...tokens)
    }
  }
  return out
}

/** Closest real names, for "Did you mean…?" after a name could not be found. */
export function closestInstitutions(fragment: string, n = 4): { id: string; name: string }[] {
  const query = words(normalize(fragment)).filter((w) => !GENERIC_NAME.has(w))
  if (!query.length) return []
  return vocabulary().institutions
    .map((inst) => ({
      inst,
      d: query.reduce((sum, w) => sum + Math.min(...inst.nameTokens.map((t) => editDistance(w, t) / Math.max(w.length, t.length))), 0),
    }))
    .sort((a, b) => a.d - b.d || a.inst.name.length - b.inst.name.length)
    .slice(0, n)
    .map(({ inst }) => ({ id: inst.id, name: inst.name }))
}

/* -------------------------- Entity extraction -------------------------- */
export interface Entities {
  category?: string
  state?: string
  zone?: string
  year?: number
  year2?: number
  top?: number
  metric?: string
  recent?: boolean
}

const has = (text: string, term: string) => new RegExp(`\\b${term}\\b`).test(text)

/** `raw` is the question as typed: "UP" and "GO" only count when written in capitals. */
export function extractEntities(corrected: string, raw: string, consumed: string[] = []): Entities {
  const v = vocabulary()
  const remove = new Set(consumed)
  const text = words(corrected).filter((w) => !remove.has(w)).join(' ').replace(/\btamilnadu\b/g, 'tamil nadu')
  const e: Entities = {}

  const param = (() => {
    if (/\btlr\b|\bteaching\b/.test(text)) return 'TLR'
    if (/\brpc\b|\bresearch (score|parameter|and professional)/.test(text)) return 'RPC'
    if (/\bgraduation( outcomes?)?\b/.test(text) || /\bGO\b/.test(raw)) return 'GO'
    if (/\boi\b|\boutreach\b|\binclusivity\b/.test(text)) return 'OI'
    if (/\bperception\b/.test(text)) return 'Perception'
    return undefined
  })() as ParamKey | undefined
  if (param) e.metric = param

  const forCategory = param === 'RPC' ? text.replace(/\bresearch\b/g, ' ') : text
  const hit = v.categoryTerms.find(([t]) => has(forCategory, t))
  if (hit) e.category = hit[1]

  const state = v.states.find((s) => has(text, normalize(s)))
  if (state) e.state = state
  else {
    const code = raw.match(/\b[A-Z]{2}\b/g)?.find((c) => STATE_ABBREVIATIONS[c])
    if (code) e.state = STATE_ABBREVIATIONS[code]
  }

  const zone = ZONES.find((z) => has(text, `${z.toLowerCase()} zone`))
  if (zone) e.zone = `${zone} Zone`

  const first = YEARS[0]
  const last = YEARS[YEARS.length - 1]
  const found = (text.match(/\b20\d\d\b/g) ?? []).map(Number).filter((y) => y >= first && y <= last)
  if (/\b(last few years|past few years|recent years|lately|recently)\b/.test(text)) {
    e.year = last - 3
    e.year2 = last
    e.recent = true
  } else if (/\bover the years\b|\ball years\b/.test(text)) {
    e.year = first
    e.year2 = last
  } else if (/\bsince\b/.test(text) && found.length) {
    e.year = found[0]
    e.year2 = last
  } else if (found.length >= 2) {
    e.year = Math.min(found[0], found[1])
    e.year2 = Math.max(found[0], found[1])
  } else if (found.length === 1) e.year = found[0]
  else if (/\b(last|this|latest) year\b/.test(text)) e.year = last

  const top = text.match(/\b(?:top|best) (\d{1,3})\b/)
  if (top) e.top = Number(top[1])
  return e
}

/** Every category named; "engineering colleges" is Engineering, not also College. */
export function extractCategories(corrected: string, consumed: string[] = []): string[] {
  const v = vocabulary()
  const remove = new Set(consumed)
  const text = words(corrected).filter((w) => !remove.has(w)).join(' ')
  const found = [...new Set(v.categoryTerms.filter(([t]) => has(text, t)).map(([, c]) => c))]
  const specific = found.filter((c) => c !== 'College' && c !== 'University')
  return specific.length ? specific : found
}

export type GroupNoun = 'state' | 'zone' | 'city' | 'category' | 'year' | 'institution'

const GROUP_NOUNS: Record<string, GroupNoun> = {
  state: 'state', states: 'state', region: 'zone', regions: 'zone', zone: 'zone', zones: 'zone',
  city: 'city', cities: 'city', category: 'category', categories: 'category', year: 'year', years: 'year',
  institution: 'institution', institutions: 'institution', institute: 'institution', institutes: 'institution',
  college: 'institution', colleges: 'institution', university: 'institution', universities: 'institution', school: 'institution', schools: 'institution',
  iit: 'institution', iits: 'institution', nit: 'institution', nits: 'institution', iim: 'institution', iims: 'institution',
  iiit: 'institution', iiits: 'institution', iiser: 'institution', iisers: 'institution', aiims: 'institution',
}
const GROUP_TRIGGERS = new Set(['which', 'what', 'who', 'list', 'show', 'rank', 'name', 'display'])
const BEFORE_NOUN = new Set(words('the all me us are were a of any top best leading most highest lowest overall'))

/**
 * The noun after which/what/who/list/show/rank decides what a question groups by.
 * "number of", "highest", "most", "top N" and "best" are measures or filters, so they are stepped over.
 * "what is the average score of universities" has no grouping noun: "is" ends the search.
 */
export function groupingNoun(text: string): GroupNoun | undefined {
  const v = vocabulary()
  const adjectives = new Set(v.categoryTerms.flatMap(([t]) => words(t)))
  const tokens = words(text)
  for (let i = 0; i < tokens.length; i++) {
    if (!GROUP_TRIGGERS.has(tokens[i])) continue
    // "rank of X" asks for a value; only "rank states by…" groups.
    if (tokens[i] === 'rank' && tokens[i + 1] === 'of') continue
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j]
      if (Object.prototype.hasOwnProperty.call(GROUP_NOUNS, t)) return GROUP_NOUNS[t]
      if (!BEFORE_NOUN.has(t) && !/^\d+$/.test(t) && !adjectives.has(t)) break
    }
  }
  const by = text.match(/\b(?:per|by|each|across) (state|zone|region|city|category)\b|\b(?:per|by) (year)\b|\b(states?|regions?|zones?|cities) ranking\b|\bhow many (states|regions|zones|cities|categories)\b/)
  const noun = by?.slice(1).find(Boolean)
  return noun ? GROUP_NOUNS[noun] : undefined
}

/** Words that are neither ordinary English nor data terms: "pizza" in "best pizza in delhi". */
export function unknownWords(corrected: string, consumed: string[]): string[] {
  const v = vocabulary()
  const used = new Set(consumed)
  return words(corrected).filter((w) => w.length >= 4 && !/\d/.test(w) && !STOP_WORDS.has(w) && !v.dataWords.has(w) && !used.has(w) && !ABBREVIATIONS.has(w) && !TYPE_PLURALS[w])
}

/** True when at least one word is recognised at all; "asdf" has none. */
export function hasKnownWord(corrected: string): boolean {
  const v = vocabulary()
  return words(corrected).some((w) => STOP_WORDS.has(w) || v.dataWords.has(w))
}
