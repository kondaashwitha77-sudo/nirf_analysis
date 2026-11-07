import type { MockSpec, Question, QuestionGroup } from '../../types'

/**
 * PLACEHOLDER WORDING — replace `text` with the exact Annexure A question text.
 * The IDs, grouping, and `mock` specs stay as-is; only the backend executor changes later.
 */

type Chart = Question['recommendedChart']
const q = (id: string, group: QuestionGroup, text: string, recommendedChart: Chart, mock: MockSpec): Question => ({
  id,
  group,
  text,
  recommendedChart,
  mock,
})

const T: QuestionGroup = 'Time-Series / Trend Analysis'
const G: QuestionGroup = 'Geospatial / Regional Analysis'
const U: QuestionGroup = 'Univariate Analysis'
const B: QuestionGroup = 'Bivariate / Correlation'
const M: QuestionGroup = 'Multivariate Analysis'
const D: QuestionGroup = 'Distribution / Statistical Comparison'
const R: QuestionGroup = 'Ranking Transitions / Mobility'
const O: QuestionGroup = 'Outlier / Performance Gaps'

export const QUESTION_GROUPS: QuestionGroup[] = [T, G, U, B, M, D, R, O]

export const QUESTIONS: Question[] = [
  q('Q01', T, 'How has the overall score of the leading Engineering institutions changed from 2017 to 2025?', 'line', { kind: 'trendScore', category: 'Engineering', top: 5 }),
  q('Q02', T, 'How has the exact rank of the leading Overall institutions moved over time?', 'line', { kind: 'trendRank', category: 'Overall', top: 5 }),
  q('Q03', T, 'How many institutions were listed in each category in each year?', 'line', { kind: 'countYearCategory' }),
  q('Q04', T, 'How has the median overall score of the Overall category changed year over year?', 'line', { kind: 'medianByYear', category: 'Overall', metric: 'score' }),
  q('Q05', T, 'Which categories gained or lost the most median score between 2017 and 2025?', 'bar', { kind: 'categoryDelta', metric: 'score' }),

  q('Q06', G, 'Which states had the most institutions in the Engineering top 50 in 2024?', 'bar', { kind: 'stateCount', category: 'Engineering', year: 2024, top: 50 }),
  q('Q07', G, 'How has the number of Overall top-100 institutions per state changed over time?', 'line', { kind: 'stateTrend', category: 'Overall', top: 100 }),
  q('Q08', G, 'Which states have the highest median overall score in 2025?', 'choropleth', { kind: 'stateMedian', category: 'Overall', year: 2025, metric: 'score' }),
  q('Q09', G, 'Which states contributed the most newly appearing Engineering institutions after 2017?', 'bar', { kind: 'stateNew', category: 'Engineering' }),
  q('Q10', G, 'How concentrated is the Overall top 100 in its three best-represented states each year?', 'line', { kind: 'concentration', category: 'Overall', top: 100 }),

  q('Q11', U, 'What is the distribution of overall scores in the University category in 2025?', 'histogram', { kind: 'histogram', category: 'University', year: 2025, metric: 'score' }),
  q('Q12', U, 'What is the distribution of TLR scores for Engineering institutions in 2024?', 'histogram', { kind: 'histogram', category: 'Engineering', year: 2024, metric: 'TLR' }),
  q('Q13', U, 'What share of 2025 ranking records belongs to each category?', 'pie', { kind: 'pieCategory', year: 2025 }),
  q('Q14', U, 'How are 2024 records split between exact ranks, rank bands, and unavailable ranks?', 'pie', { kind: 'pieRankType', year: 2024 }),
  q('Q15', U, 'What is the distribution of Graduation Outcomes (GO) scores for Overall in 2023?', 'histogram', { kind: 'histogram', category: 'Overall', year: 2023, metric: 'GO' }),

  q('Q16', B, 'Is overall score associated with TLR among Engineering institutions in 2024?', 'scatter', { kind: 'scatter', category: 'Engineering', year: 2024, metric: 'TLR', metric2: 'score' }),
  q('Q17', B, 'How are RPC and GO related for University institutions in 2025?', 'scatter', { kind: 'scatter', category: 'University', year: 2025, metric: 'RPC', metric2: 'GO' }),
  q('Q18', B, 'How are the parameter scores correlated with each other for Overall in 2024?', 'heatmap', { kind: 'corr', category: 'Overall', year: 2024 }),
  q('Q19', B, 'Do institutions with a higher RPC score tend to have a better exact rank in Engineering, 2024?', 'scatter', { kind: 'scatter', category: 'Engineering', year: 2024, metric: 'RPC', metric2: 'rank' }),
  q('Q20', B, 'Is Perception associated with overall score in Overall for 2021 (the last year it is published)?', 'scatter', { kind: 'scatter', category: 'Overall', year: 2021, metric: 'Perception', metric2: 'score' }),

  q('Q21', M, 'How do the parameter correlations in Engineering look in 2025?', 'heatmap', { kind: 'corr', category: 'Engineering', year: 2025 }),
  q('Q22', M, 'How does median overall score vary jointly by category and year?', 'heatmap', { kind: 'heatCatYear', metric: 'score' }),
  q('Q23', M, 'How does institution count vary jointly by state and year in Engineering?', 'heatmap', { kind: 'heatStateYear', category: 'Engineering' }),
  q('Q24', M, 'How do mean parameter scores compare across five categories in 2024?', 'bar', { kind: 'paramByCategory', year: 2024 }),
  q('Q25', M, 'On which parameters do the top 10 Overall institutions differ most from the rest in 2025?', 'bar', { kind: 'topVsRest', category: 'Overall', year: 2025 }),

  q('Q26', D, 'How do overall scores differ across categories in 2025?', 'box', { kind: 'boxCategory', year: 2025, metric: 'score' }),
  q('Q27', D, 'How has the spread of Overall scores changed from year to year?', 'box', { kind: 'boxYear', category: 'Overall', metric: 'score' }),
  q('Q28', D, 'How do TLR scores differ across categories in 2024?', 'box', { kind: 'boxCategory', year: 2024, metric: 'TLR' }),
  q('Q29', D, 'How does the Engineering score distribution in 2017 compare with 2025?', 'histogram', { kind: 'histCompare', category: 'Engineering', year: 2017, year2: 2025, metric: 'score' }),
  q('Q30', D, 'How do Engineering scores vary across states in 2025?', 'box', { kind: 'boxState', category: 'Engineering', year: 2025, metric: 'score' }),

  q('Q31', R, 'Which Overall institutions moved the most places between 2017 and 2025?', 'slope', { kind: 'slope', category: 'Overall', year: 2017, year2: 2025, top: 15 }),
  q('Q32', R, 'Which Engineering institutions improved their exact rank the most between 2018 and 2024?', 'bar', { kind: 'movers', category: 'Engineering', year: 2018, year2: 2024, metric: 'improve', top: 10 }),
  q('Q33', R, 'Which Engineering institutions declined the most between 2018 and 2024?', 'bar', { kind: 'movers', category: 'Engineering', year: 2018, year2: 2024, metric: 'decline', top: 10 }),
  q('Q34', R, 'How many institutions entered the University category each year?', 'bar', { kind: 'entrants', category: 'University' }),
  q('Q35', R, 'How many institutions left the University category each year?', 'bar', { kind: 'exits', category: 'University' }),

  q('Q36', O, 'Which Overall institutions are score outliers in 2025 under the IQR rule?', 'box', { kind: 'outliers', category: 'Overall', year: 2025, metric: 'score', method: 'iqr' }),
  q('Q37', O, 'Which Engineering institutions are RPC outliers in 2024 under the z-score rule?', 'box', { kind: 'outliers', category: 'Engineering', year: 2024, metric: 'RPC', method: 'zscore' }),
  q('Q38', O, 'Which University institutions fall outside the 5th–95th percentile of overall score in 2025?', 'box', { kind: 'outliers', category: 'University', year: 2025, metric: 'score', method: 'percentile' }),
  q('Q39', O, 'Where are the biggest score gaps between consecutive Overall positions in 2025?', 'bar', { kind: 'rankGap', category: 'Overall', year: 2025 }),
  q('Q40', O, 'How far does the leader sit above the median in each category in 2025?', 'bar', { kind: 'categoryGap', year: 2025 }),
]
