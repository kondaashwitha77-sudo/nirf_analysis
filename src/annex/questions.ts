import type { Args, Res } from './core'
import { defaults } from './core'
import { q11, q12, q13, q14, q15, q21, q22, q23, q24, q25, q31, q32, q33, q34, q35 } from './q1to3'
import { q41, q42, q43, q44, q45, q4x, q51, q52, q53, q54, q55, q61, q62, q63, q64, q65 } from './q4to6'
import { q71, q72, q73, q74, q75, q81, q82, q83, q84, q85 } from './q7to8'
import { catYears } from './core'

const nearest = (ys: number[], y: number) => (ys.includes(y) || !ys.length ? y : ys.reduce((p, c) => (Math.abs(c - y) < Math.abs(p - y) ? c : p)))

/** Runs a question safely: clamps years to those the category has, and never throws. */
export function runQuestion(q: AnnexQuestion, a: Args): Res {
  const ys = catYears(a.category)
  if (!ys.length) return { answer: `No ranking data for ${a.category}.`, chips: [], charts: [] }
  try {
    return q.run({ ...a, year: nearest(ys, a.year), year2: nearest(ys, a.year2) })
  } catch {
    return { answer: `There is not enough ${a.category} data for this selection. Try another year, category or parameter.`, chips: [a.category], charts: [] }
  }
}

export type ControlKey = keyof Args

export interface AnnexQuestion {
  id: string
  section: string
  text: string
  controls: ControlKey[]
  run: (a: Args) => Res
  /** per-question defaults applied on top of the global defaults */
  init?: (d: Args) => Partial<Args>
}

export const SECTIONS = [
  '1. Time-series and trend analysis',
  '2. Geospatial and regional analysis',
  '3. Univariate analysis',
  '4. Bivariate analysis and correlation',
  '5. Multivariate analysis',
  '6. Distribution and statistical comparison',
  '7. Ranking transitions and institutional mobility',
  '8. Outlier detection and performance gaps',
]

const fullSpan = (d: Args) => { const ys = catYears(d.category); return { year: ys[0] ?? d.year, year2: ys[ys.length - 1] ?? d.year2 } }
const lastPair = (d: Args) => { const ys = catYears(d.category); return { year: ys[ys.length - 2] ?? d.year, year2: ys[ys.length - 1] ?? d.year2 } }
const firstDefault = (d: Args) => { const ys = catYears(d.category); return { year: ys[1] ?? d.year, year2: ys[ys.length - 1] ?? d.year2 } }

export const QUESTIONS: AnnexQuestion[] = [
  { id: '1.1', section: SECTIONS[0], text: 'How has the overall NIRF ranking of a selected institution changed from 2017 to 2025?', controls: ['category', 'institutions'], run: q11 },
  { id: '1.2', section: SECTIONS[0], text: 'Which institutions have shown the greatest improvement in rank over the nine years?', controls: ['category', 'year', 'year2', 'topN'], run: q12, init: firstDefault },
  { id: '1.3', section: SECTIONS[0], text: 'Which institutions have experienced the largest decline in ranking?', controls: ['category', 'year', 'year2', 'topN'], run: q13, init: firstDefault },
  { id: '1.4', section: SECTIONS[0], text: 'How has the average score of institutions changed over time?', controls: ['category', 'param'], run: q14, init: () => ({ param: 'score' }) },
  { id: '1.5', section: SECTIONS[0], text: 'Which institutions have remained consistently in the top 10 across multiple years?', controls: ['category', 'year', 'year2', 'topN', 'minYears'], run: q15, init: (d) => ({ ...fullSpan(d), minYears: 5 }) },

  { id: '2.1', section: SECTIONS[1], text: 'Which states have the highest number of institutions in the top 100?', controls: ['category', 'year', 'topN'], run: q21, init: () => ({ topN: 100 }) },
  { id: '2.2', section: SECTIONS[1], text: 'How is the geographical distribution of top-ranked institutions changing from 2017 to 2025?', controls: ['category', 'year', 'year2', 'topN'], run: q22, init: (d) => ({ ...fullSpan(d), topN: 100 }) },
  { id: '2.3', section: SECTIONS[1], text: 'Which states have improved their representation in the top 100 over time?', controls: ['category', 'year', 'year2', 'topN'], run: q23, init: (d) => ({ ...fullSpan(d), topN: 100 }) },
  { id: '2.4', section: SECTIONS[1], text: 'How do the rankings of institutions in Karnataka compare with those in Tamil Nadu?', controls: ['category', 'year', 'state', 'state2', 'topN'], run: q24, init: () => ({ topN: 100 }) },
  { id: '2.5', section: SECTIONS[1], text: 'Which states have produced the largest number of newly appearing institutions in the rankings?', controls: ['category', 'year', 'year2'], run: q25, init: fullSpan },

  { id: '3.1', section: SECTIONS[2], text: 'What is the distribution of NIRF scores for a selected year?', controls: ['category', 'year', 'param', 'bins'], run: q31, init: () => ({ param: 'score' }) },
  { id: '3.2', section: SECTIONS[2], text: 'What is the distribution of overall ranks across all institutions?', controls: ['category', 'year', 'basis', 'bandSize'], run: q32, init: () => ({ basis: 'median', bandSize: 10 }) },
  { id: '3.3', section: SECTIONS[2], text: 'What is the average, median, minimum, and maximum score in a given year?', controls: ['category', 'year', 'param'], run: q33, init: () => ({ param: 'score' }) },
  { id: '3.4', section: SECTIONS[2], text: 'What percentage of ranked institutions fall into each score quartile?', controls: ['category', 'year', 'basis'], run: q34, init: () => ({ basis: 'pooled' }) },
  { id: '3.5', section: SECTIONS[2], text: 'How does the spread of scores differ across NIRF categories?', controls: ['year', 'param'], run: q35, init: () => ({ param: 'score' }) },

  { id: '4.1', section: SECTIONS[3], text: 'How strongly are Research and Professional Practice (RPC) scores associated with overall scores?', controls: ['category', 'year', 'trend'], run: q41, init: () => ({ param: 'RPC' }) },
  { id: '4.2', section: SECTIONS[3], text: 'How does Perception (PR) relate to overall scores?', controls: ['category', 'year', 'trend'], run: q42, init: () => ({ param: 'Perception' }) },
  { id: '4.3', section: SECTIONS[3], text: 'Which NIRF parameter has the strongest correlation with the overall score?', controls: ['category', 'year'], run: q43 },
  { id: '4.4', section: SECTIONS[3], text: 'How are TLR and RPC scores related across institutions?', controls: ['category', 'year', 'trend'], run: q44, init: () => ({ param: 'TLR', param2: 'RPC' }) },
  { id: '4.5', section: SECTIONS[3], text: 'Has the correlation between research scores and overall scores changed from 2017 to 2025?', controls: ['category', 'param'], run: q45, init: () => ({ param: 'RPC' }) },
  { id: '4.x', section: SECTIONS[3], text: 'Select-two-variables tool: choose any two numerical attributes for a scatter plot, correlation coefficient and optional trend line.', controls: ['category', 'year', 'attrX', 'attrY', 'trend'], run: q4x },

  { id: '5.1', section: SECTIONS[4], text: 'How do the top five institutions compare across all five NIRF parameters?', controls: ['category', 'year', 'topN'], run: q51, init: () => ({ topN: 5 }) },
  { id: '5.2', section: SECTIONS[4], text: 'Which institutions have high research scores but relatively low teaching scores?', controls: ['category', 'year', 'pctHigh', 'pctLow'], run: q52, init: () => ({ pctHigh: 75, pctLow: 50 }) },
  { id: '5.3', section: SECTIONS[4], text: 'Which institutions have high teaching scores but relatively low perception scores?', controls: ['category', 'year', 'pctHigh', 'pctLow'], run: q53, init: () => ({ pctHigh: 75, pctLow: 50 }) },
  { id: '5.4', section: SECTIONS[4], text: 'Which institutions have improved their overall scores despite declining scores in one or more parameters?', controls: ['category', 'year', 'year2', 'topN'], run: q54, init: lastPair },
  { id: '5.5', section: SECTIONS[4], text: 'Which institutions have the largest difference between their strongest and weakest parameters?', controls: ['category', 'year', 'topN'], run: q55 },

  { id: '6.1', section: SECTIONS[5], text: 'How does the score distribution differ between the top 10 and the remaining institutions?', controls: ['category', 'year', 'topN'], run: q61, init: () => ({ topN: 10 }) },
  { id: '6.2', section: SECTIONS[5], text: 'Are NIRF scores more dispersed in one year than another?', controls: ['category', 'param'], run: q62, init: () => ({ param: 'score' }) },
  { id: '6.3', section: SECTIONS[5], text: 'Which NIRF parameter exhibits the greatest variability across institutions?', controls: ['category', 'year', 'basis'], run: q63, init: () => ({ basis: 'sd' }) },
  { id: '6.4', section: SECTIONS[5], text: 'How do the median and interquartile range of scores change over time?', controls: ['category', 'param'], run: q64, init: () => ({ param: 'score' }) },
  { id: '6.5', section: SECTIONS[5], text: 'How does the score distribution differ across states?', controls: ['category', 'year', 'param', 'minCount'], run: q65, init: () => ({ param: 'score', minCount: 3 }) },

  { id: '7.1', section: SECTIONS[6], text: 'How many institutions moved from the 51–100 band into the top 50 between two selected years?', controls: ['category', 'year', 'year2', 'cut'], run: q71, init: (d) => { const ys = catYears(d.category); return { year: ys[ys.length - 3] ?? d.year, year2: ys[ys.length - 1] ?? d.year2, cut: 50 } } },
  { id: '7.2', section: SECTIONS[6], text: 'Which institutions entered or exited the top 10 between consecutive years?', controls: ['category', 'year', 'year2', 'topN'], run: q72, init: (d) => ({ ...fullSpan(d), topN: 10 }) },
  { id: '7.3', section: SECTIONS[6], text: 'What percentage of institutions remained in the same rank band from one year to the next?', controls: ['category', 'bandSize'], run: q73, init: () => ({ bandSize: 10 }) },
  { id: '7.4', section: SECTIONS[6], text: 'Which institutions experienced the largest upward and downward rank movements?', controls: ['category', 'year', 'year2', 'topN'], run: q74, init: (d) => ({ ...lastPair(d), topN: 8 }) },
  { id: '7.5', section: SECTIONS[6], text: 'How many institutions moved up, moved down, or retained their positions each year?', controls: ['category', 'year', 'year2'], run: q75, init: fullSpan },

  { id: '8.1', section: SECTIONS[7], text: 'Which institutions have unusually high research scores relative to their overall scores?', controls: ['category', 'year', 'param', 'z'], run: q81, init: () => ({ param: 'RPC', z: 1.5 }) },
  { id: '8.2', section: SECTIONS[7], text: 'Which institutions perform substantially better in research than in teaching?', controls: ['category', 'year', 'param', 'param2', 'topN', 'z'], run: q82, init: () => ({ param: 'RPC', param2: 'TLR', z: 1.5 }) },
  { id: '8.3', section: SECTIONS[7], text: 'Which institutions experienced an unusually large year-to-year score change?', controls: ['category', 'year', 'year2', 'topN', 'z'], run: q83, init: (d) => ({ ...fullSpan(d), z: 2.5, topN: 10 }) },
  { id: '8.4', section: SECTIONS[7], text: 'Which institutions have a strong parameter score but a relatively poor overall rank?', controls: ['category', 'year', 'param', 'pctHigh', 'cut'], run: q84, init: () => ({ param: 'Perception', pctHigh: 60, cut: 50 }) },
  { id: '8.5', section: SECTIONS[7], text: 'Which institutions have unusually high ranking volatility compared with similar institutions?', controls: ['category', 'minYears', 'z'], run: q85, init: () => ({ minYears: 4, z: 1.5 }) },
]

export function initialArgs(q: AnnexQuestion, base: Args = defaults()): Args {
  return { ...base, ...(q.init ? q.init(base) : {}) }
}
