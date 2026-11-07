import type { AIQueryResponse, MockSpec } from '../../types'
import { CATEGORIES, LATEST_YEAR } from './constants'
import { runAnalysis } from './mockAnalysis'

export const EXAMPLE_QUESTIONS = [
  'Which states had the highest number of top 100 engineering institutions in 2024?',
  'How has the score of the top Engineering institutions changed over time?',
  'Show outliers in overall score for University in 2025',
  'Which Overall institutions improved their rank the most?',
  'What does the distribution of TLR look like for Engineering in 2024?',
]

/** Keyword router standing in for the real model. It only selects among known analyses. */
export function mockAIResponse(question: string): AIQueryResponse {
  const t = question.toLowerCase()
  const category = CATEGORIES.find((c) => t.includes(c.toLowerCase())) ?? 'Overall'
  const yearMatch = t.match(/20(1[7-9]|2[0-5])/)
  const year = yearMatch ? Number(yearMatch[0]) : LATEST_YEAR
  const topMatch = t.match(/top\s+(\d{1,3})/)
  const top = topMatch ? Number(topMatch[1]) : 10
  const metric = (['TLR', 'RPC', 'GO', 'QNR', 'QLR', 'SFC', 'OI', 'Perception'].find((p) => t.includes(p.toLowerCase())) ?? 'score')

  let spec: MockSpec
  if (t.includes('state') || t.includes('region')) spec = { kind: 'stateCount', category, year, top }
  else if (t.includes('outlier')) spec = { kind: 'outliers', category, year, metric, method: 'iqr' }
  else if (t.includes('improv') || t.includes('rank change') || t.includes('mobility')) spec = { kind: 'movers', category, year: 2018, year2: LATEST_YEAR, metric: 'improve', top: 10 }
  else if (t.includes('declin')) spec = { kind: 'movers', category, year: 2018, year2: LATEST_YEAR, metric: 'decline', top: 10 }
  else if (t.includes('distribution') || t.includes('histogram')) spec = { kind: 'histogram', category, year, metric }
  else if (t.includes('correl')) spec = { kind: 'corr', category, year }
  else if (t.includes('over time') || t.includes('trend') || t.includes('changed')) spec = { kind: 'trendScore', category, top: 5, metric }
  else spec = { kind: 'topList', category, year, top }

  const res = runAnalysis(spec)
  return {
    question,
    answer: res.summary,
    chart: res.chart,
    table: res.table,
    filters: res.filters,
    methodology:
      `${res.methodology} (Mock routing: the demo matches keywords in your question to a fixed analysis. The real service will translate the question into a validated query specification.)`,
    limitations: res.limitations,
    isMock: true,
  }
}
