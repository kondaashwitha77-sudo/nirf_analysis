import type {
  AIQueryResponse,
  AnalysisPlan,
  AnalysisResult,
  DataQualityReport,
  VisualizationQuery,
  VisualizationResult,
} from '../types'
import { answerQuestion } from '../data/mock/ai'
import { AiUnavailable, answerWithLLM } from '../lib/llmAnalyst'
import { classifyIntent } from '../lib/assistantIntent'
import { YEARS } from '../data/mock/constants'
import { runAnalysis } from '../data/mock/mockAnalysis'
import { buildDataQualityReport } from '../data/mock/quality'
import { QUESTIONS } from '../data/mock/questions'
import { runVisualizationQuery } from '../data/mock/vizEngine'
import { USE_MOCK, mockDelay } from './apiClient'

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
  // Greetings, thanks and glossary terms need no model. Everything else goes to the model first.
  const intent = classifyIntent(question)
  const local = ['greeting', 'identity', 'thanks', 'glossary'].includes(intent)
  if (!USE_MOCK && !local) {
    try {
      return await answerWithLLM(question, previous)
    } catch (err) {
      const why = err instanceof AiUnavailable ? err.message : 'AI_ERROR'
      console.warn('[AI Analyst] Fell back to the rule-based analyst:', err instanceof Error ? err.message : String(err))
      const fallback = answerQuestion(question, previous)
      const notice = why === 'AI_NOT_CONFIGURED'
        ? 'The AI model is not configured (set AI_API_KEY in backend/.env), so the built-in rule-based analyst answered.'
        : 'The AI model could not be used for this question, so the built-in rule-based analyst answered.'
      return { ...fallback, limitations: [...fallback.limitations, notice] }
    }
  }
  return answerQuestion(question, previous)
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
