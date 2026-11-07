export type ParamKey = 'TLR' | 'RPC' | 'GO' | 'OI' | 'Perception'

/** How a rank value should be interpreted. */
export type RankType = 'exact' | 'unavailable'

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
  rankType: RankType
  score: number | null
  params: Record<ParamKey, number | null>
  paramReasons: Partial<Record<ParamKey, MissingReason>>
  duplicateCandidate?: boolean
  /** NIRF geographic zone (live data only) */
  zone?: string
  institutionType?: string
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
  | 'dot'
  | 'ecdf'

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
  /** line style hint: drawn dashed */
  dash?: boolean
  /** explicit colour for semantic series (e.g. improved / declined) */
  color?: string
  /** one colour per bar / point (e.g. zone colours) */
  colors?: string[]
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
  /** bars / dots: draw horizontally with the first item at the top (long labels, sorted lists) */
  horizontal?: boolean
  /** bars / dots: sort the single series by value, largest first */
  sortDesc?: boolean
  /** heatmap: diverging blue-white-orange scale centred on 0 (correlations) */
  diverging?: boolean
  /** heatmap: print the value in each cell; bars: print it at the end of each bar */
  showValues?: boolean
  /** line charts: show only these x ticks, with padding so the labels are not cut off */
  xTickValues?: number[]
  /** reversed line charts: name each line at its end point instead of using a legend */
  endLabels?: boolean
  /** line charts: whole-number rank axis, rank 1 at the top, never showing rank 0 */
  rankAxis?: boolean
  /** fixed y range, so small multiples share one scale */
  yRange?: [number, number]
  /** heatmap: flip the colour scale, so darker means better for rank */
  reverseScale?: boolean
  /** heatmap: first row at the top, grey empty cells that say "no data" on hover */
  readableGrid?: boolean
  /** box: left-to-right order of the categories */
  xCategoryOrder?: string[]
  /** vertical reference lines, e.g. mean and median on a histogram */
  refLines?: { x: number; label: string; color: string }[]
  /** histogram: fixed bin width */
  binSize?: number
  /** box plots: overlay every point, jittered */
  showPoints?: boolean
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
  /** optional extra charts; when present these replace `chart` */
  charts?: ChartSpec[]
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
  state?: string
  zone?: string
  yearRange?: [number, number]
}

export interface AnalysisPlan {
  kind: 'compare' | 'institution' | 'stateCount' | 'trend' | 'outliers' | 'movers' | 'histogram' | 'corr' | 'topList'
    | 'lookup' | 'count' | 'aggregate' | 'consistency' | 'categoryCompare' | 'groupCount'
  /** the dimension the question groups by: "which states…" */
  groupBy?: 'state' | 'zone' | 'city' | 'category' | 'year' | 'institution'
  /** "how many states…" asks for the number of groups too */
  countGroups?: boolean
  /** "best" was read as "most institutions listed" */
  bestMeansCount?: boolean
  institutions?: string[]
  category?: string
  categories?: string[]
  institutionType?: string
  aggregate?: 'mean' | 'median' | 'min' | 'max'
  /** name the leader in the answer; the chart shows a few more for context */
  lead?: boolean
  recent?: boolean
  state?: string
  zone?: string
  year?: number
  year2?: number
  metric?: string
  top?: number
  direction?: 'improve' | 'decline'
}

export type AggregationKey = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max' | 'std'

export type OrderKey = 'value_desc' | 'value_asc' | 'fixed' | 'alpha' | 'time'

export interface VisualizationQuery {
  dataset: string
  x: string
  y: string
  aggregation: AggregationKey
  groupBy: string | null
  filters: { years: number[]; categories: string[]; states: string[] }
  chartType: ChartType
  sort: OrderKey
  limit: number
  /** histogram bin width; empty means automatic */
  binWidth?: number | null
}

export interface VisualizationResult {
  spec: ChartSpec
  table: TableData
  meta: { rowsUsed: number; missingExcluded: number; note?: string; emptyReason?: string }
}

export interface AIQueryResponse {
  question: string
  answer: string
  kind: 'analysis' | 'chat'
  charts: ChartSpec[]
  table?: TableData
  filters: { label: string; value: string }[]
  methodology: string
  limitations: string[]
  isMock: boolean
  understood?: { label: string; value: string }[]
  corrections?: { from: string; to: string }[]
  correctedQuestion?: string
  clarify?: { fragment: string; options: { id: string; name: string; question: string }[] }
  suggestions?: string[]
  assumptions?: string[]
  /** remembered by the page for follow-up questions */
  plan?: AnalysisPlan
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
