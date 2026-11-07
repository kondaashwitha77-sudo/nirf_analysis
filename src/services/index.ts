import type {
  AIQueryResponse,
  AnalysisPlan,
  AnalysisResult,
  DataQualityReport,
  VisualizationQuery,
  VisualizationResult,
} from '../types'
import { answerQuestion } from '../data/mock/ai'
import { YEARS } from '../data/mock/constants'
import { runAnalysis } from '../data/mock/mockAnalysis'
import { buildDataQualityReport } from '../data/mock/quality'
import { QUESTIONS } from '../data/mock/questions'
import { runVisualizationQuery } from '../data/mock/vizEngine'
import { USE_MOCK, apiClient, mockDelay } from './apiClient'

/** Runs a structured visualization query against the loaded records. */
export async function queryVisualization(query: VisualizationQuery): Promise<VisualizationResult> {
  // The query is a structured spec (never SQL or code) and is run on the loaded records, live or demo.
  return mockDelay(runVisualizationQuery(query), USE_MOCK ? 300 : 0)
}

const numbersIn = (text: string) => (text.replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

/** The AI may only word the result: any number not in the computed result discards its text. */
export function narrationIsSafe(narration: string, summary: string, rows: Record<string, unknown>[]): boolean {
  const allowed = new Set([...numbersIn(summary), ...rows.flatMap((r) => Object.values(r).flatMap((v) => numbersIn(String(v ?? ''))))])
  return numbersIn(narration.replace(/#\d+/g, ' ')).every((n) => YEARS.includes(n) || allowed.has(n))
}

/**
 * Greetings, glossary and refusals are answered locally. Analyses are planned locally and computed from the
 * loaded records; the backend (which holds the AI key) may then reword the computed answer.
 */
export async function askAnalyst(question: string, previous?: AnalysisPlan): Promise<AIQueryResponse> {
  const base = answerQuestion(question, previous)
  if (USE_MOCK || base.kind !== 'analysis') return base
  const rows = base.table?.rows.slice(0, 20) ?? []
  try {
    const { data } = await apiClient.post<{ answer: string }>('/ai/narrate', {
      question: question.slice(0, 500),
      summary: base.answer.slice(0, 2000),
      columns: base.table?.columns.map((c) => c.key).slice(0, 20) ?? [],
      rows,
    })
    return narrationIsSafe(data.answer, base.answer, rows) ? { ...base, answer: data.answer } : base
  } catch (err) {
    const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
    return code === 'AI_NOT_CONFIGURED'
      ? { ...base, limitations: [...base.limitations, 'AI wording is unavailable (set AI_API_KEY in the backend .env); showing the computed summary.'] }
      : base
  }
}

/** Runs one Annexure A question on the loaded records. */
export async function executeQuestion(questionId: string): Promise<AnalysisResult> {
  const q = QUESTIONS.find((x) => x.id === questionId)
  if (!q) throw new Error(`Unknown question ${questionId}`)
  return mockDelay(runAnalysis(q.mock), USE_MOCK ? 500 : 0)
}

/** Coverage and validation report computed from the loaded records. */
export async function getDataQuality(): Promise<DataQualityReport> {
  return mockDelay(buildDataQualityReport(), USE_MOCK ? 400 : 0)
}
