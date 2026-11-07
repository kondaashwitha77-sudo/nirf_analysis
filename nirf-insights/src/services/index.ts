import type {
  AIQueryResponse,
  AnalysisResult,
  DataQualityReport,
  VisualizationQuery,
  VisualizationResult,
} from '../types'
import { mockAIResponse } from '../data/mock/ai'
import { runAnalysis } from '../data/mock/mockAnalysis'
import { buildDataQualityReport } from '../data/mock/quality'
import { QUESTIONS } from '../data/mock/questions'
import { runVisualizationQuery } from '../data/mock/vizEngine'
import { USE_MOCK, apiClient, mockDelay } from './apiClient'

/** POST /api/visualization/query — sends a structured query spec, never SQL or code. */
export async function queryVisualization(query: VisualizationQuery): Promise<VisualizationResult> {
  if (USE_MOCK) return mockDelay(runVisualizationQuery(query), 300)
  const { data } = await apiClient.post<VisualizationResult>('/visualization/query', query)
  return data
}

/** POST /api/ai/query — the backend holds any AI provider key. */
export async function askAnalyst(question: string): Promise<AIQueryResponse> {
  if (USE_MOCK) return mockDelay(mockAIResponse(question), 1100)
  const { data } = await apiClient.post<AIQueryResponse>('/ai/query', { question })
  return data
}

/** POST /api/questions/{question_id}/execute */
export async function executeQuestion(questionId: string): Promise<AnalysisResult> {
  if (USE_MOCK) {
    const q = QUESTIONS.find((x) => x.id === questionId)
    if (!q) throw new Error(`Unknown question ${questionId}`)
    return mockDelay(runAnalysis(q.mock), 500)
  }
  const { data } = await apiClient.post<AnalysisResult>(`/questions/${questionId}/execute`)
  return data
}

/** GET /api/data-quality */
export async function getDataQuality(): Promise<DataQualityReport> {
  if (USE_MOCK) return mockDelay(buildDataQualityReport(), 400)
  const { data } = await apiClient.get<DataQualityReport>('/data-quality')
  return data
}
