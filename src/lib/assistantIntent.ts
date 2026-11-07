import { CATEGORIES, YEARS } from '../data/mock/constants'
import { RECORDS } from '../data/mock/rankings'
import { correctSpelling, detectInstitutionType, extractEntities, findInstitutions, hasKnownWord, normalize, unknownWords } from './nlu'

export type Intent = 'greeting' | 'identity' | 'thanks' | 'glossary' | 'analysis' | 'offtopic' | 'unclear'

export const GLOSSARY: Record<string, string> = {
  nirf: "NIRF is the National Institutional Ranking Framework of India's Ministry of Education. It ranks institutions each year across several categories. Try: Top 10 engineering colleges in 2024.",
  tlr: 'TLR stands for Teaching, Learning and Resources, one of the five NIRF parameters. Try: What does the distribution of TLR look like for Engineering in 2024?',
  rpc: 'RPC stands for Research and Professional Practice, one of the five NIRF parameters. Try: Show the distribution of RPC for University in 2024.',
  go: 'GO stands for Graduation Outcomes, one of the five NIRF parameters. Try: Show outliers in graduation outcomes for Engineering in 2023.',
  oi: 'OI stands for Outreach and Inclusivity, one of the five NIRF parameters. Try: Show the distribution of OI for Overall in 2023.',
  perception: 'Perception reflects how peers and employers view an institution, one of the five NIRF parameters. Try: Show the distribution of perception for Management in 2023.',
  rank: "A rank is an institution's position within its category and year, and rank 1 is best. Try: How has IIT Bombay changed over the years?",
  score: 'The overall score is the NIRF total for an institution, built from its parameter scores; higher is better. Try: Compare IIT Madras and IIT Delhi.',
  median: 'The median is the middle value when numbers are sorted, so half are above it and half below. Extreme values affect it less than the average. Try: Tell me about IIT Bombay.',
  outlier: "An outlier is a value far from the rest. Here it means outside the box plot's whiskers, 1.5 times the interquartile range beyond the middle half. Try: Show outliers in overall score for University in 2025.",
  correlation: 'Correlation measures how closely two values move together, from -1 to 1. It does not show that one causes the other. Try: Show the correlation for Engineering in 2024.',
  histogram: 'A histogram groups values into ranges and shows how many fall in each, which reveals the shape of a distribution. Try: Show the distribution of TLR for Engineering in 2024.',
  'box plot': 'A box plot shows the median and the middle half of the values as a box, with whiskers for the wider range and dots for outliers. Try: Show outliers in overall score for University in 2025.',
  ecdf: 'An ECDF shows the share of values at or below each point, so you can read any percentile off the curve. It is available on the Distribution Analysis page. Try: Show the distribution of TLR for Engineering in 2024.',
  zone: 'A zone is a group of states used by NIRF, such as the Southern Zone. Try: Which state has the most universities?',
  'rank mobility': "Rank mobility is how an institution's rank moves between two years. Try: Which institutions improved their rank the most?",
}

const TERM_ALIASES: Record<string, string> = {
  'national institutional ranking framework': 'nirf', outliers: 'outlier', zones: 'zone', ranks: 'rank', ranking: 'rank', scores: 'score',
  boxplot: 'box plot', histograms: 'histogram', mobility: 'rank mobility', 'overall score': 'score',
  'teaching learning and resources': 'tlr', 'research and professional practice': 'rpc', 'graduation outcomes': 'go', 'outreach and inclusivity': 'oi',
}

const INJECTION = /\b(ignore|disregard|forget|override|bypass)\b.*\b(instructions?|rules?|prompt|above|previous)\b|\bact as\b|\bpretend\b|\bjailbreak\b|\bapi ?key\b|\b(reveal|show|print|repeat|tell|give)\b.*\b(your|the system) (prompt|key|instructions?|rules?|secret|password)\b|\bsystem (prompt|message)\b/
const GREETING = /^(hi|hello|hey|hiya|namaste|namaskar|greetings|good (morning|afternoon|evening|day)|how are you|hows it going|how r u)( there| assistant| analyst)?( how are you)?$/
const IDENTITY = /^(help|help me)$|\b(who are you|what are you|what do you do|what can you do|how can you help|which model are you|what model are you|tell me about yourself)\b/
const THANKS = /^(thanks|thank you|thank you so much|thanks a lot|thx|ty|cheers)( very much)?$/
const GLOSSARY_ASK = /^(?:what is the meaning of|what is|what are|whats|what does|meaning of|define|explain)\s+(?:an? |the )?(.+?)(?:\s+(?:mean|means|stand for|stands for))?$/
const WEAK_KEYWORD = /\b(compare|trend|trends|changed?|improved?|improvement|declined?|dropped|outliers?|distribution|histogram|spread|correlation|top|best|worst|highest|lowest|leading|states?|regions?|zones?|ranks?|ranked|rankings?|scores?|mobility|median|nirf|institutions?|institutes?|movers?|average|mean|how many|count|stayed|always|consistently|progress|relationship|risers?|fallers?|list|listed)\b/

export function glossaryTerm(question: string): string | null {
  const m = correctSpelling(question).corrected.match(GLOSSARY_ASK)
  if (!m) return null
  const term = normalize(m[1])
  const key = TERM_ALIASES[term] ?? term
  return Object.prototype.hasOwnProperty.call(GLOSSARY, key) ? key : null
}

export function classifyIntent(question: string): Intent {
  if (INJECTION.test(normalize(question))) return 'offtopic'
  const { corrected } = correctSpelling(question)
  if (GREETING.test(corrected)) return 'greeting'
  if (IDENTITY.test(corrected)) return 'identity'
  if (THANKS.test(corrected)) return 'thanks'
  if (glossaryTerm(question)) return 'glossary'

  const found = findInstitutions(corrected)
  const e = extractEntities(corrected, question, found.consumed)
  const strong = found.matches.length > 0 || found.ambiguous.length > 0 || found.notFound.length > 0 || !!e.category || !!e.metric || !!detectInstitutionType(corrected)
  if (strong) return 'analysis'
  const weak = !!e.state || !!e.zone || e.year !== undefined || WEAK_KEYWORD.test(corrected)
  if (weak) return unknownWords(corrected, found.consumed).length ? 'offtopic' : 'analysis'
  return hasKnownWord(corrected) ? 'offtopic' : 'unclear'
}

export const STARTERS = ['Compare IIT Madras and IIT Delhi', 'How has IIT Bombay changed over the years?', 'What is TLR?']

/** Local replies; counts come from the loaded records. */
export function chatReply(intent: Intent, question: string): { answer: string; suggestions: string[] } {
  const first = YEARS[0]
  const last = YEARS[YEARS.length - 1]
  switch (intent) {
    case 'greeting':
      return { answer: `Hello! I'm the NIRF Insights assistant. I can compare institutions, show how an institution's rank and score changed from ${first} to ${last}, and answer questions about states, categories, distributions and outliers. Try: Compare IIT Madras and IIT Delhi.`, suggestions: STARTERS }
    case 'identity':
      return { answer: `I'm an AI assistant built for this NIRF Insights dashboard. I answer questions about NIRF rankings (${first}-${last}, ${new Set(RECORDS.map((r) => r.institutionId)).size} institutions, ${CATEGORIES.length} categories) using the data loaded here and show results as charts and tables. I don't answer questions outside this data.`, suggestions: STARTERS }
    case 'thanks':
      return { answer: "You're welcome! Ask another question about the rankings whenever you like.", suggestions: STARTERS }
    case 'glossary':
      return { answer: GLOSSARY[glossaryTerm(question) as string], suggestions: [glossaryTerm(question) === 'rank mobility' ? 'What is TLR?' : 'What is rank mobility?', 'Compare IIT Madras and IIT Delhi'] }
    case 'offtopic':
      return { answer: "I'm an AI assistant made only for the NIRF rankings in this dashboard, so I can't help with that. I can compare institutions, show an institution's history, rank states, and explain terms like TLR or rank mobility. Try: How has IIT Bombay changed over the years?", suggestions: STARTERS }
    default:
      return { answer: 'I could not map that to an analysis of the NIRF data. Which of these is closest?', suggestions: STARTERS }
  }
}
