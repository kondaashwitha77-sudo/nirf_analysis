export const ABBREVIATIONS = new Map([
  ['iit', 'indian institute of technology'],
  ['iisc', 'indian institute of science'],
  ['nit', 'national institute of technology'],
  ['iiit', 'indian institute of information technology'],
  ['iim', 'indian institute of management'],
  ['iiser', 'indian institute of science education and research'],
  ['aiims', 'all india institute of medical sciences'],
  ['bits', 'birla institute of technology and science'],
  ['jnu', 'jawaharlal nehru university'],
  ['bhu', 'banaras hindu university'],
  ['du', 'university of delhi'],
  ['vit', 'vellore institute of technology'],
  ['srm', 'srm institute of science and technology'],
  ['kiit', 'kalinga institute of industrial technology'],
  ['lpu', 'lovely professional university'],
  ['amu', 'aligarh muslim university'],
  ['jmi', 'jamia millia islamia'],
  ['dtu', 'delhi technological university'],
  ['tiss', 'tata institute of social sciences'],
  ['nlsiu', 'national law school of india university'],
  ['vnit', 'visvesvaraya national institute of technology'],
  ['mnnit', 'motilal nehru national institute of technology'],
  ['mnit', 'malaviya national institute of technology'],
  ['manit', 'maulana azad national institute of technology'],
  ['iiest', 'indian institute of engineering science and technology'],
  ['iist', 'indian institute of space science and technology'],
  ['mahe', 'manipal academy of higher education'],
  ['trichy', 'tiruchirappalli'],
])

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z]) (?=[a-z]\b)/g, '$1') // "S. R. M." and "SRM" compare equal
    .trim()
}

const expandWords = (words: string[]) => words.flatMap((w) => (ABBREVIATIONS.get(w) ?? w).split(' '))

/**
 * True when every query word appears in the haystack, in any order, with abbreviations expanded.
 * Expanded words match from the start of a word ("mad" finds "Madras"). The unexpanded query must
 * match whole words, so "du" finds a literal "DU" but not "Hindu" or "Durgapur".
 */
export function matchesInstitution(query: string, haystack: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const text = ` ${normalise(haystack)} `
  const expanded = expandWords(words)
  return expanded.every((w) => text.includes(` ${w}`)) || words.every((w) => text.includes(` ${w} `))
}

/** Orders search results: 0 = the name starts with the query, 1 = it contains it, 2 = other match. */
export function matchRank(query: string, name: string): number {
  const q = normalise(query)
  const full = expandWords(q.split(' ')).join(' ')
  const n = normalise(name)
  if (n.startsWith(q) || n.startsWith(full)) return 0
  if (n.includes(q) || n.includes(full)) return 1
  return 2
}
