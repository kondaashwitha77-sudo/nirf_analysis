export type ParamKey = 'TLR' | 'RPC' | 'GO' | 'QNR' | 'QLR' | 'SFC' | 'OI' | 'Perception'

/** How a rank value should be interpreted. Bands are never exact ranks. */
export type RankType = 'exact' | 'band' | 'unavailable'

/** Why a value is absent. Absence is never encoded as 0. */
export type MissingReason =
  | 'missing'
  | 'not_published'
  | 'not_applicable'
  | 'parser_failure'
  | 'invalid'

export interface Institution {
  id: string
  name: string
  city: string
  state: string
  primaryCategory: string
}

export interface RankingRecord {
  id: number
  year: number
  category: string
  institutionId: string
  institution: string
  city: string
  state: string
  rank: number | null
  rankBand: string | null
  rankType: RankType
  score: number | null
  params: Record<ParamKey, number | null>
  paramReasons: Partial<Record<ParamKey, MissingReason>>
  duplicateCandidate?: boolean
}

export interface Option<T extends string | number = string> {
  value: T
  label: string
}

export type ChartType =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'box'
  | 'histogram'
  | 'heatmap'
  | 'area'
  | 'pie'
  | 'donut'

export interface ChartSeries {
  name: string
  x?: (string | number)[]
  y?: (number | null)[]
  /** heatmap */
  z?: (number | null)[][]
  yLabels?: string[]
  /** pie / donut */
  labels?: string[]
  values?: number[]
  /** per-point hover text */
  text?: string[]
  /** line style hint, e.g. rank bands drawn dashed */
  dash?: boolean
  /** explicit colour for semantic series (e.g. improved / declined) */
  color?: string
}

/** Structured chart description. The chart layer renders this; it holds no business logic. */
export interface ChartSpec {
  type: ChartType
  title: string
  xTitle?: string
  yTitle?: string
  series: ChartSeries[]
  /** rank charts: lower number is better, so the y axis is reversed */
  reverseY?: boolean
  stacked?: boolean
  /** counts and shares should not have a truncated axis */
  yFromZero?: boolean
  yCategoryOrder?: string[]
}

export interface TableColumn {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
}

export interface TableData {
  columns: TableColumn[]
  rows: Record<string, string | number | null>[]
}

export interface AnalysisResult {
  summary: string
  chart: ChartSpec | null
  table: TableData
  filters: { label: string; value: string }[]
  methodology: string
  limitations: string[]
  isMock: boolean
}

export type QuestionGroup =
  | 'Time-Series / Trend Analysis'
  | 'Geospatial / Regional Analysis'
  | 'Univariate Analysis'
  | 'Bivariate / Correlation'
  | 'Multivariate Analysis'
  | 'Distribution / Statistical Comparison'
  | 'Ranking Transitions / Mobility'
  | 'Outlier / Performance Gaps'

export interface Question {
  id: string
  group: QuestionGroup
  text: string
  recommendedChart: ChartType | 'slope' | 'sankey' | 'choropleth'
  /** internal hint used by the mock executor only */
  mock: MockSpec
}

/** Parameters for the local mock analysis engine (replaced by the backend later). */
export interface MockSpec {
  kind: string
  metric?: string
  metric2?: string
  category?: string
  year?: number
  year2?: number
  top?: number
  method?: 'iqr' | 'zscore' | 'percentile'
}

export type AggregationKey = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max' | 'std'

export interface VisualizationQuery {
  dataset: string
  x: string
  y: string
  aggregation: AggregationKey
  groupBy: string | null
  filters: { years: number[]; categories: string[]; states: string[] }
  chartType: ChartType
  sort: 'x_asc' | 'x_desc' | 'y_asc' | 'y_desc'
  limit: number
}

export interface VisualizationResult {
  spec: ChartSpec
  table: TableData
  meta: { rowsUsed: number; missingExcluded: number; note?: string }
}

export interface AIQueryResponse {
  question: string
  answer: string
  chart: ChartSpec | null
  table: TableData
  filters: { label: string; value: string }[]
  methodology: string
  limitations: string[]
  isMock: boolean
}

export interface DataQualityReport {
  totals: {
    records: number
    institutions: number
    categories: number
    years: number
    missingValues: number
    duplicateCandidates: number
    invalidRecords: number
  }
  coverage: { category: string; byYear: Record<number, number> }[]
  parameterAvailability: { parameter: ParamKey; byYear: Record<number, number> }[]
  issues: { type: MissingReason | 'duplicate_candidate'; count: number; description: string }[]
  sources: { source: string; years: string; records: number; status: 'validated' | 'partial' | 'failed' }[]
  validation: { check: string; status: 'pass' | 'warn' | 'fail'; detail: string }[]
  duplicates: { year: number; category: string; institution: string; matches: number }[]
  isMock: boolean
}
