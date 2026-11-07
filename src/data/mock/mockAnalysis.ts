import type { AnalysisResult, ChartSpec, MockSpec, RankingRecord, TableData } from '../../types'
import { describe, detectOutliers, pearson, quantile } from '../../lib/stats'
import { CATEGORIES, LATEST_YEAR, PARAM_KEYS, YEARS, ZONE_BY_STATE } from './constants'
import { RECORDS } from './rankings'
import { USE_MOCK } from '../../services/apiClient'
import { metricLabel, metricValue, selectRecords, topRecords } from '../selectors'

/**
 * Analysis executor shared by the Question Explorer and the AI Analyst. It computes from the loaded records
 * (demo data in demo mode, the real NIRF data in live mode).
 */
const TAG = USE_MOCK ? ' (demo data)' : ''

const r2 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)
const med = (v: number[]) => quantile([...v].sort((a, b) => a - b), 0.5)
const countBy = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, number>()
  items.forEach((i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1))
  return m
}

const table = (cols: [string, string, ('left' | 'right')?][], rows: TableData['rows']): TableData => ({
  columns: cols.map(([key, header, align]) => ({ key, header, align })),
  rows,
})

function build(
  summary: string,
  chart: ChartSpec | null,
  data: TableData,
  filters: [string, string][],
  methodology: string,
  extra: string[] = [],
): AnalysisResult {
  return {
    summary,
    chart,
    table: data,
    filters: filters.map(([label, value]) => ({ label, value })),
    methodology,
    limitations: [
      USE_MOCK
        ? 'Demo / mock data — generated for interface development, not actual NIRF results.'
        : 'Real NIRF data, 2017–2025. Rows reported only as a rank band were excluded, so lower-ranked College, Pharmacy and Law lists are incomplete.',
      'Only exact ranks are used in rank calculations; unranked entries are excluded.',
      ...extra,
    ],
    isMock: USE_MOCK,
  }
}

/** Optional state / zone filter from the question. */
const inScope = (spec: MockSpec) => (r: RankingRecord) =>
  (!spec.state || r.state === spec.state) && (!spec.zone || (r.zone ?? ZONE_BY_STATE[r.state]) === spec.zone)

export function runAnalysis(spec: MockSpec): AnalysisResult {
  const cat = spec.category ?? 'Overall'
  const year = spec.year ?? LATEST_YEAR
  const year2 = spec.year2 ?? LATEST_YEAR
  const metric = spec.metric ?? 'score'
  const top = spec.top ?? 10
  const mLabel = metricLabel(metric)
  const fCat: [string, string] = ['Category', cat]
  const fYear: [string, string] = ['Year', String(year)]
  const scope = inScope(spec)

  switch (spec.kind) {
    case 'trendScore':
    case 'trendRank': {
      const isRank = spec.kind === 'trendRank'
      const m = isRank ? 'rank' : metric
      const ids = topRecords(cat, LATEST_YEAR, 9999).filter(scope).slice(0, Math.min(top, 8))
      const span = spec.yearRange ? YEARS.filter((y) => y >= spec.yearRange![0] && y <= spec.yearRange![1]) : YEARS
      const series = ids.map((r) => ({
        name: r.institution,
        x: span,
        y: span.map((y) => {
          const rec = RECORDS.find((x) => x.year === y && x.category === cat && x.institutionId === r.institutionId)
          return rec ? metricValue(rec, m) : null
        }),
      }))
      return build(
        `Showing ${metricLabel(m)} over ${span[0]}–${span[span.length - 1]} for the ${ids.length} leading ${cat} institutions in ${LATEST_YEAR}${TAG}.${isRank ? ' Lower rank numbers are better.' : ''}`,
        { type: 'line', title: `${metricLabel(m)} over time — top ${ids.length} ${cat}`, xTitle: 'Year', yTitle: metricLabel(m), series, reverseY: isRank },
        table(
          [['institution', 'Institution'], ...span.map((y): [string, string, 'right'] => [String(y), String(y), 'right'])],
          series.map((s) => ({ institution: s.name, ...Object.fromEntries(span.map((y, i) => [String(y), s.y?.[i] ?? null])) })),
        ),
        [fCat, ['Years', `${span[0]}–${span[span.length - 1]}`], ['Institutions', `Top ${ids.length} in ${LATEST_YEAR}`]],
        'Institutions are selected by their latest-year position; each year’s value is looked up for the same institution. Missing years remain gaps rather than zeros.',
      )
    }

    case 'countYearCategory': {
      const series = CATEGORIES.map((c) => ({
        name: c,
        x: YEARS,
        y: YEARS.map((y) => selectRecords({ category: c, year: y }).length),
      }))
      return build(
        `Number of listed institutions per category and year${TAG}.`,
        { type: 'line', title: 'Listed institutions per year', xTitle: 'Year', yTitle: 'Institutions', yFromZero: true, series },
        table(
          [['category', 'Category'], ...YEARS.map((y): [string, string, 'right'] => [String(y), String(y), 'right'])],
          series.map((s) => ({ category: s.name, ...Object.fromEntries(YEARS.map((y, i) => [String(y), s.y?.[i] ?? null])) })),
        ),
        [['Categories', 'All'], ['Years', `${YEARS[0]}–${LATEST_YEAR}`]],
        'Counts of ranking records grouped by year and category.',
      )
    }

    case 'medianByYear': {
      const rows = YEARS.map((y) => {
        const v = selectRecords({ category: cat, year: y }).map((r) => metricValue(r, metric)).filter((x): x is number => x !== null)
        return { year: y, median: r2(med(v)), n: v.length }
      })
      return build(
        `Median ${mLabel} for ${cat} by year${TAG}.`,
        { type: 'line', title: `Median ${mLabel} — ${cat}`, xTitle: 'Year', yTitle: `Median ${mLabel}`, series: [{ name: cat, x: YEARS, y: rows.map((r) => r.median) }] },
        table([['year', 'Year'], ['median', 'Median', 'right'], ['n', 'n', 'right']], rows),
        [fCat, ['Metric', mLabel]],
        'Median of non-missing values per year; n shows the sample used.',
      )
    }

    case 'categoryDelta': {
      const rows = CATEGORIES.map((c) => {
        const a = med(selectRecords({ category: c, year: YEARS[0] }).map((r) => metricValue(r, metric)).filter((x): x is number => x !== null))
        const b = med(selectRecords({ category: c, year: LATEST_YEAR }).map((r) => metricValue(r, metric)).filter((x): x is number => x !== null))
        return { category: c, start: r2(a), end: r2(b), change: r2(b - a) }
      }).sort((x, y) => (y.change ?? -999) - (x.change ?? -999))
      return build(
        `Change in median ${mLabel} between ${YEARS[0]} and ${LATEST_YEAR}, by category${TAG}.`,
        { type: 'bar', title: `Change in median ${mLabel}, ${YEARS[0]}→${LATEST_YEAR}`, xTitle: 'Category', yTitle: 'Change', series: [{ name: 'Change', x: rows.map((r) => r.category), y: rows.map((r) => r.change) }] },
        table([['category', 'Category'], ['start', String(YEARS[0]), 'right'], ['end', String(LATEST_YEAR), 'right'], ['change', 'Change', 'right']], rows),
        [['Metric', mLabel], ['Years', `${YEARS[0]} vs ${LATEST_YEAR}`]],
        'Difference between medians. Categories with no published values in either year show gaps.',
      )
    }

    case 'stateCount':
    case 'stateTrend':
    case 'stateMedian':
    case 'stateNew':
    case 'concentration':
      return runGeo(spec, cat, year, metric, top)

    case 'histogram': {
      const recs = selectRecords({ category: cat, year }).filter(scope)
      const values = recs.map((r) => metricValue(r, metric))
      const s = describe(values)
      return build(
        `${mLabel} for ${cat} in ${year}: median ${r2(s.median)}, IQR ${r2(s.q1)}–${r2(s.q3)} across ${s.n} institutions${TAG}.`,
        { type: 'histogram', title: `Distribution of ${mLabel} — ${cat}, ${year}`, xTitle: mLabel, yTitle: 'Institutions', series: [{ name: cat, x: values.filter((v): v is number => v !== null) }] },
        table([['stat', 'Statistic'], ['value', 'Value', 'right']], [
          { stat: 'n', value: s.n }, { stat: 'Missing', value: s.missing }, { stat: 'Mean', value: r2(s.mean) },
          { stat: 'Median', value: r2(s.median) }, { stat: 'Std. dev.', value: r2(s.std) }, { stat: 'Min', value: r2(s.min) }, { stat: 'Max', value: r2(s.max) },
        ]),
        [fCat, fYear, ['Metric', mLabel]],
        'Histogram of non-missing values; summary statistics use the sample standard deviation.',
        s.missing ? [`${s.missing} records have no value for this metric and are excluded.`] : [],
      )
    }

    case 'pieCategory': {
      const m = countBy(selectRecords({ year }), (r) => r.category)
      const rows = [...m.entries()].map(([category, count]) => ({ category, count }))
      return build(
        `Records per category in ${year}${TAG}.`,
        { type: 'donut', title: `Category share of records, ${year}`, series: [{ name: 'Records', labels: rows.map((r) => r.category), values: rows.map((r) => r.count) }] },
        table([['category', 'Category'], ['count', 'Records', 'right']], rows),
        [fYear], 'Count of ranking records per category.',
      )
    }

    case 'pieRankType': {
      const m = countBy(selectRecords({ year }), (r) => r.rankType)
      const rows = [...m.entries()].map(([type, count]) => ({ type, count }))
      return build(
        `How rank information is available in ${year}: exact rank or unavailable${TAG}.`,
        { type: 'donut', title: `Rank type share, ${year}`, series: [{ name: 'Records', labels: rows.map((r) => r.type), values: rows.map((r) => r.count) }] },
        table([['type', 'Rank type'], ['count', 'Records', 'right']], rows),
        [fYear], 'Count of records by rank type.',
      )
    }

    case 'scatter': {
      const m2 = spec.metric2 ?? 'rank'
      const pts = selectRecords({ category: cat, year })
        .map((r) => ({ r, x: metricValue(r, metric), y: metricValue(r, m2) }))
        .filter((p): p is { r: (typeof RECORDS)[number]; x: number; y: number } => p.x !== null && p.y !== null)
      const { r, n } = pearson(pts.map((p) => p.x), pts.map((p) => p.y))
      return build(
        `${metricLabel(m2)} vs ${mLabel}: Pearson r = ${r2(r)} across ${n} institutions${TAG}. Correlation does not imply causation.`,
        { type: 'scatter', title: `${metricLabel(m2)} vs ${mLabel}`, xTitle: mLabel, yTitle: metricLabel(m2), reverseY: m2 === 'rank', series: [{ name: cat, x: pts.map((p) => p.x), y: pts.map((p) => p.y), text: pts.map((p) => p.r.institution) }] },
        table([['institution', 'Institution'], ['x', mLabel, 'right'], ['y', metricLabel(m2), 'right']], pts.slice(0, 40).map((p) => ({ institution: p.r.institution, x: r2(p.x), y: r2(p.y) }))),
        [fCat, fYear, ['X', mLabel], ['Y', metricLabel(m2)]],
        'Only institutions with both values present are plotted (pairwise deletion).',
        [`${selectRecords({ category: cat, year }).length - pts.length} records lack one of the two values.`],
      )
    }

    case 'corr': {
      const keys = ['score', ...PARAM_KEYS]
      const recs = selectRecords({ category: cat, year })
      const z = keys.map((a) => keys.map((b) => r2(pearson(recs.map((r) => metricValue(r, a)), recs.map((r) => metricValue(r, b))).r)))
      return build(
        `Pairwise Pearson correlations between score and parameters for ${cat}, ${year}${TAG}. Blank cells have too few paired values.`,
        { type: 'heatmap', title: `Correlation matrix — ${cat}, ${year}`, xTitle: 'Metric', yTitle: 'Metric', series: [{ name: 'r', x: keys, yLabels: keys, z }] },
        table([['row', 'Metric'], ...keys.map((k): [string, string, 'right'] => [k, k, 'right'])], keys.map((k, i) => ({ row: k, ...Object.fromEntries(keys.map((c, j) => [c, z[i][j]])) }))),
        [fCat, fYear], 'Pairwise-complete Pearson correlation; at least 3 paired values required.',
        ['Parameters not published for this category/year have no correlations.'],
      )
    }

    case 'heatCatYear': {
      const z = CATEGORIES.map((c) => YEARS.map((y) => r2(med(selectRecords({ category: c, year: y }).map((r) => metricValue(r, metric)).filter((x): x is number => x !== null)))))
      return build(
        `Median ${mLabel} by category and year${TAG}.`,
        { type: 'heatmap', title: `Median ${mLabel}: category × year`, xTitle: 'Year', yTitle: 'Category', series: [{ name: mLabel, x: YEARS, yLabels: CATEGORIES, z }] },
        table([['category', 'Category'], ...YEARS.map((y): [string, string, 'right'] => [String(y), String(y), 'right'])], CATEGORIES.map((c, i) => ({ category: c, ...Object.fromEntries(YEARS.map((y, j) => [String(y), z[i][j]])) }))),
        [['Metric', mLabel]], 'Median of non-missing values per cell; empty cells have no published values.',
      )
    }

    case 'heatStateYear': {
      const states = [...countBy(selectRecords({ category: cat }), (r) => r.state).entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s]) => s)
      const z = states.map((s) => YEARS.map((y) => selectRecords({ category: cat, year: y, state: s }).length))
      return build(
        `Institutions per state and year in ${cat} for the 12 best-represented states${TAG}.`,
        { type: 'heatmap', title: `Institutions per state and year — ${cat}`, xTitle: 'Year', yTitle: 'State', series: [{ name: 'Institutions', x: YEARS, yLabels: states, z }] },
        table([['state', 'State'], ...YEARS.map((y): [string, string, 'right'] => [String(y), String(y), 'right'])], states.map((s, i) => ({ state: s, ...Object.fromEntries(YEARS.map((y, j) => [String(y), z[i][j]])) }))),
        [fCat], 'Counts of records per state and year.',
      )
    }

    case 'paramByCategory': {
      const cats = ['Engineering', 'University', 'Management', 'Medical', 'Research']
      const series = cats.map((c) => ({
        name: c,
        x: PARAM_KEYS as string[],
        y: PARAM_KEYS.map((p) => {
          const v = selectRecords({ category: c, year }).map((r) => r.params[p]).filter((x): x is number => x !== null)
          return v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null
        }),
      }))
      return build(
        `Mean parameter scores across five categories in ${year}. Gaps mean the parameter is not published or not applicable${TAG}.`,
        { type: 'bar', title: `Mean parameter score by category, ${year}`, xTitle: 'Parameter', yTitle: 'Mean score', series },
        table([['category', 'Category'], ...PARAM_KEYS.map((p): [string, string, 'right'] => [p, p, 'right'])], series.map((s) => ({ category: s.name, ...Object.fromEntries(PARAM_KEYS.map((p, i) => [p, s.y?.[i] ?? null])) }))),
        [fYear], 'Arithmetic mean of non-missing values per parameter.',
      )
    }

    case 'topVsRest': {
      const sorted = topRecords(cat, year, 999)
      const head = sorted.slice(0, 10)
      const rest = sorted.slice(10)
      const avg = (rs: typeof sorted, p: (typeof PARAM_KEYS)[number]) => {
        const v = rs.map((r) => r.params[p]).filter((x): x is number => x !== null)
        return v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null
      }
      const series = [
        { name: 'Top 10', x: PARAM_KEYS as string[], y: PARAM_KEYS.map((p) => avg(head, p)) },
        { name: 'Rest', x: PARAM_KEYS as string[], y: PARAM_KEYS.map((p) => avg(rest, p)) },
      ]
      return build(
        `Parameter means for the top 10 vs the rest of ${cat} in ${year}${TAG}.`,
        { type: 'bar', title: `Top 10 vs rest — ${cat}, ${year}`, xTitle: 'Parameter', yTitle: 'Mean score', series },
        table([['group', 'Group'], ...PARAM_KEYS.map((p): [string, string, 'right'] => [p, p, 'right'])], series.map((s) => ({ group: s.name, ...Object.fromEntries(PARAM_KEYS.map((p, i) => [p, s.y?.[i] ?? null])) }))),
        [fCat, fYear], 'Groups are defined by overall score order.',
      )
    }

    case 'boxCategory':
    case 'boxYear':
    case 'boxState': {
      const byYear = spec.kind === 'boxYear'
      const byState = spec.kind === 'boxState'
      const groups = new Map<string, number[]>()
      const pool = byYear ? selectRecords({ category: cat }) : byState ? selectRecords({ category: cat, year }) : selectRecords({ year })
      pool.forEach((r) => {
        const v = metricValue(r, metric)
        if (v === null) return
        const g = byYear ? String(r.year) : byState ? r.state : r.category
        groups.set(g, [...(groups.get(g) ?? []), v])
      })
      const entries = [...groups.entries()].filter(([, v]) => v.length >= (byState ? 4 : 1)).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      const dim = byYear ? 'Year' : byState ? 'State' : 'Category'
      return build(
        `Spread of ${mLabel} by ${dim.toLowerCase()}${TAG}.`,
        { type: 'box', title: `${mLabel} by ${dim}`, xTitle: dim, yTitle: mLabel, reverseY: metric === 'rank', series: entries.map(([name, y]) => ({ name, y })) },
        table([['group', dim], ['n', 'n', 'right'], ['q1', 'Q1', 'right'], ['median', 'Median', 'right'], ['q3', 'Q3', 'right']], entries.map(([group, v]) => { const s = describe(v); return { group, n: s.n, q1: r2(s.q1), median: r2(s.median), q3: r2(s.q3) } })),
        byYear ? [fCat, ['Metric', mLabel]] : byState ? [fCat, fYear, ['Metric', mLabel]] : [fYear, ['Metric', mLabel]],
        'Box = Q1–Q3 with median; whiskers extend to 1.5×IQR. Missing values are excluded.',
        byState ? ['States with fewer than 4 values are omitted.'] : [],
      )
    }

    case 'histCompare': {
      const get = (y: number) => selectRecords({ category: cat, year: y }).map((r) => metricValue(r, metric)).filter((v): v is number => v !== null)
      const a = get(spec.year ?? YEARS[0])
      const b = get(year2)
      return build(
        `${mLabel} distribution in ${spec.year ?? YEARS[0]} compared with ${year2} for ${cat}${TAG}.`,
        { type: 'histogram', title: `${mLabel}: ${spec.year ?? YEARS[0]} vs ${year2}`, xTitle: mLabel, yTitle: 'Institutions', series: [{ name: String(spec.year ?? YEARS[0]), x: a }, { name: String(year2), x: b }] },
        table([['stat', 'Statistic'], ['a', String(spec.year ?? YEARS[0]), 'right'], ['b', String(year2), 'right']], [
          { stat: 'n', a: a.length, b: b.length }, { stat: 'Median', a: r2(med(a)), b: r2(med(b)) }, { stat: 'Mean', a: r2(describe(a).mean), b: r2(describe(b).mean) }, { stat: 'Std. dev.', a: r2(describe(a).std), b: r2(describe(b).std) },
        ]),
        [fCat, ['Years', `${spec.year ?? YEARS[0]} vs ${year2}`]], 'Two overlaid histograms using identical metric definitions.',
      )
    }

    case 'slope':
    case 'movers':
    case 'entrants':
    case 'exits':
      return runMobility(spec, cat, top)

    case 'outliers': {
      const method = spec.method ?? 'iqr'
      const recs = selectRecords({ category: cat, year }).filter(scope)
      const res = detectOutliers(recs, (r) => metricValue(r, metric), method)
      return build(
        `${res.outliers.length} outlier(s) found among ${res.tested} institutions using ${method.toUpperCase()} on ${mLabel}${TAG}.`,
        { type: 'box', title: `${mLabel} — ${cat}, ${year}`, yTitle: mLabel, series: [{ name: cat, y: recs.map((r) => metricValue(r, metric)).filter((v): v is number => v !== null) }] },
        table([['institution', 'Institution'], ['value', 'Value', 'right'], ['threshold', 'Threshold', 'right'], ['direction', 'Direction']], res.outliers.map((o) => ({ institution: o.item.institution, value: r2(o.value), threshold: r2(o.threshold), direction: o.direction }))),
        [fCat, fYear, ['Metric', mLabel], ['Method', method]],
        'IQR: outside Q1−1.5·IQR / Q3+1.5·IQR. Z-score: |z| > 2.5. Percentile: outside P5–P95. Missing values are never flagged.',
        res.skippedMissing ? [`${res.skippedMissing} records without a value were skipped.`] : [],
      )
    }

    case 'rankGap': {
      const rows = topRecords(cat, year, 20)
      const gaps = rows.slice(1).map((r, i) => ({ step: `#${i + 1}→#${i + 2}`, gap: r2((rows[i].score ?? 0) - (r.score ?? 0)) }))
      return build(
        `Score gap between consecutive positions in the top 20 of ${cat}, ${year}${TAG}.`,
        { type: 'bar', title: `Score gap between consecutive positions — ${cat}, ${year}`, xTitle: 'Position step', yTitle: 'Score gap', series: [{ name: 'Gap', x: gaps.map((g) => g.step), y: gaps.map((g) => g.gap) }] },
        table([['step', 'Step'], ['gap', 'Score gap', 'right']], gaps),
        [fCat, fYear], 'Differences between sorted overall scores.',
      )
    }

    case 'categoryGap': {
      const rows = CATEGORIES.map((c) => {
        const recs = topRecords(c, year, 999)
        const first = recs[0]?.score ?? null
        const m = med(recs.map((r) => r.score).filter((v): v is number => v !== null))
        return { category: c, leader: r2(first), median: r2(m), gap: first === null ? null : r2(first - m) }
      })
      return build(
        `Gap between the leading score and the median score in each category, ${year}${TAG}.`,
        { type: 'bar', title: `Leader-to-median score gap, ${year}`, xTitle: 'Category', yTitle: 'Score gap', series: [{ name: 'Gap', x: rows.map((r) => r.category), y: rows.map((r) => r.gap) }] },
        table([['category', 'Category'], ['leader', 'Leader', 'right'], ['median', 'Median', 'right'], ['gap', 'Gap', 'right']], rows),
        [fYear], 'Leader score minus median score per category.',
      )
    }

    default: {
      const rows = topRecords(cat, year, 9999).filter(scope).slice(0, top)
      return build(
        `Top ${rows.length} ${cat} institutions in ${year} by overall score${TAG}.`,
        { type: 'bar', title: `Top ${rows.length} ${cat} institutions by score, ${year}`, xTitle: 'Institution', yTitle: 'Overall score', series: [{ name: 'Score', x: rows.map((r) => r.institution), y: rows.map((r) => r.score) }] },
        table([['rank', 'Rank', 'right'], ['institution', 'Institution'], ['state', 'State'], ['score', 'Score', 'right']], rows.map((r) => ({ rank: r.rank ?? '—', institution: r.institution, state: r.state, score: r.score }))),
        [fCat, fYear, ['Top-N', String(top)]], 'Records ordered by overall score; rank shown as published (exact or unavailable).',
      )
    }
  }
}

function runGeo(spec: MockSpec, cat: string, year: number, metric: string, top: number): AnalysisResult {
  const mLabel = metricLabel(metric)
  if (spec.kind === 'stateCount') {
    const rows = topRecords(cat, year, top)
    const m = [...countBy(rows, (r) => r.state).entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const scopeLabel = top >= 999 ? 'all listed' : `the top ${top}`
    return build(
      `${m[0]?.[0] ?? '—'} has the most institutions (${m[0]?.[1] ?? 0}) among ${scopeLabel} ${cat} institutions in ${year}${TAG}.`,
      { type: 'bar', title: `Institutions per state — ${cat}, ${scopeLabel}, ${year}`, xTitle: 'State', yTitle: 'Institutions', series: [{ name: 'Institutions', x: m.map(([s]) => s), y: m.map(([, c]) => c) }] },
      table([['state', 'State'], ['count', 'Institutions', 'right']], m.map(([state, count]) => ({ state, count }))),
      [['Category', cat], ['Year', String(year)], ['Top-N', String(top)]],
      'Institutions are ordered by overall score; the top N are counted by state.',
    )
  }
  if (spec.kind === 'stateTrend') {
    const latest = topRecords(cat, LATEST_YEAR, top)
    const states = [...countBy(latest, (r) => r.state).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s)
    const series = states.map((s) => ({ name: s, x: YEARS, y: YEARS.map((y) => topRecords(cat, y, top).filter((r) => r.state === s).length) }))
    return build(
      `Yearly count of ${cat} top-${top} institutions for the five leading states${TAG}.`,
      { type: 'line', title: `Top-${top} ${cat} institutions per state`, xTitle: 'Year', yTitle: 'Institutions', yFromZero: true, series },
      table([['state', 'State'], ...YEARS.map((y): [string, string, 'right'] => [String(y), String(y), 'right'])], series.map((s) => ({ state: s.name, ...Object.fromEntries(YEARS.map((y, i) => [String(y), s.y?.[i] ?? null])) }))),
      [['Category', cat], ['Top-N', String(top)]], 'For each year, the top N by score are counted per state.',
    )
  }
  if (spec.kind === 'stateMedian') {
    const m = new Map<string, number[]>()
    selectRecords({ category: cat, year }).forEach((r) => {
      const v = metricValue(r, metric)
      if (v !== null) m.set(r.state, [...(m.get(r.state) ?? []), v])
    })
    const rows = [...m.entries()].filter(([, v]) => v.length >= 3).map(([state, v]) => ({ state, median: r2(med(v)), n: v.length })).sort((a, b) => (b.median ?? 0) - (a.median ?? 0)).slice(0, 12)
    return build(
      `Highest median ${mLabel} by state in ${cat}, ${year}; states with fewer than 3 values are omitted${TAG}.`,
      { type: 'bar', title: `Median ${mLabel} by state — ${cat}, ${year}`, xTitle: 'State', yTitle: `Median ${mLabel}`, series: [{ name: 'Median', x: rows.map((r) => r.state), y: rows.map((r) => r.median) }] },
      table([['state', 'State'], ['median', 'Median', 'right'], ['n', 'n', 'right']], rows),
      [['Category', cat], ['Year', String(year)], ['Metric', mLabel]], 'Median of non-missing values per state.',
    )
  }
  if (spec.kind === 'stateNew') {
    const first = new Map<string, { year: number; state: string }>()
    selectRecords({ category: cat }).forEach((r) => {
      const cur = first.get(r.institutionId)
      if (!cur || r.year < cur.year) first.set(r.institutionId, { year: r.year, state: r.state })
    })
    const m = countBy([...first.values()].filter((f) => f.year > YEARS[0]), (f) => f.state)
    const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([state, count]) => ({ state, count }))
    return build(
      `Institutions appearing in ${cat} after ${YEARS[0]}, by state${TAG}.`,
      { type: 'bar', title: `New ${cat} entrants by state`, xTitle: 'State', yTitle: 'New institutions', series: [{ name: 'New entrants', x: rows.map((r) => r.state), y: rows.map((r) => r.count) }] },
      table([['state', 'State'], ['count', 'New institutions', 'right']], rows),
      [['Category', cat], ['Since', String(YEARS[1])]], 'An institution is "new" when its first appearance in the category is after the first year.',
      ['Absence in earlier years may reflect missing source data rather than a true new entry.'],
    )
  }
  const rows = YEARS.map((y) => {
    const t = topRecords(cat, y, top)
    const m = [...countBy(t, (r) => r.state).values()].sort((a, b) => b - a)
    const share = t.length ? ((m[0] ?? 0) + (m[1] ?? 0) + (m[2] ?? 0)) / t.length : 0
    return { year: y, share: r2(share * 100) }
  })
  return build(
    `Share of the ${cat} top ${top} held by the three best-represented states each year${TAG}.`,
    { type: 'line', title: `Top-3 state concentration — ${cat} top ${top}`, xTitle: 'Year', yTitle: 'Share of institutions (%)', yFromZero: true, series: [{ name: 'Top-3 states', x: YEARS, y: rows.map((r) => r.share) }] },
    table([['year', 'Year'], ['share', 'Share (%)', 'right']], rows),
    [['Category', cat], ['Top-N', String(top)]], 'For each year, the three states with the most top-N institutions are summed and divided by N.',
  )
}

function runMobility(spec: MockSpec, cat: string, top: number): AnalysisResult {
  const start = spec.year ?? YEARS[0]
  const end = spec.year2 ?? LATEST_YEAR
  const scope = inScope(spec)
  const rank = (y: number) => new Map(selectRecords({ category: cat, year: y }).filter((r) => r.rankType === 'exact' && scope(r)).map((r) => [r.institutionId, r]))
  const a = rank(start)
  const b = rank(end)
  const fCat: [string, string] = ['Category', cat]
  const fYears: [string, string] = ['Years', `${start} → ${end}`]
  const common = [...b.values()].filter((r) => a.has(r.institutionId)).map((r) => ({ name: r.institution, from: a.get(r.institutionId)!.rank as number, to: r.rank as number, change: (a.get(r.institutionId)!.rank as number) - (r.rank as number) }))

  if (spec.kind === 'slope') {
    const sel = common.sort((x, y) => x.to - y.to).slice(0, top)
    return build(
      `Rank movement from ${start} to ${end} for ${sel.length} institutions present with exact ranks in both years${TAG}. Lower is better.`,
      { type: 'line', title: `Rank slope ${start} → ${end} — ${cat}`, xTitle: 'Year', yTitle: 'Rank', reverseY: true, series: sel.map((s) => ({ name: s.name, x: [start, end], y: [s.from, s.to] })) },
      table([['name', 'Institution'], ['from', `Rank ${start}`, 'right'], ['to', `Rank ${end}`, 'right'], ['change', 'Change', 'right']], sel.map((s) => ({ ...s }))),
      [fCat, fYears, ['Top-N', String(top)]], 'Only institutions with exact ranks in both years are compared; positive change means a better rank.',
      ['Institutions without an exact rank in both years are excluded.'],
    )
  }
  if (spec.kind === 'movers') {
    const decline = spec.metric === 'decline'
    const sel = [...common].sort((x, y) => (decline ? x.change - y.change : y.change - x.change)).slice(0, top)
    return build(
      `${decline ? 'Largest rank declines' : 'Largest rank improvements'} in ${cat} from ${start} to ${end}${TAG}.`,
      { type: 'bar', title: `${decline ? 'Largest declines' : 'Largest improvements'} — ${cat}, ${start}→${end}`, xTitle: 'Institution', yTitle: 'Places gained (+) / lost (−)', series: [{ name: 'Rank change', x: sel.map((s) => s.name), y: sel.map((s) => s.change) }] },
      table([['name', 'Institution'], ['from', `Rank ${start}`, 'right'], ['to', `Rank ${end}`, 'right'], ['change', 'Change', 'right']], sel.map((s) => ({ ...s }))),
      [fCat, fYears], 'Change = start rank − end rank over institutions with exact ranks in both years.',
    )
  }
  const entrants = spec.kind === 'entrants'
  const years = YEARS.slice(1)
  const rows = years.map((y) => {
    const cur = new Set(selectRecords({ category: cat, year: y }).map((r) => r.institutionId))
    const prev = new Set(selectRecords({ category: cat, year: y - 1 }).map((r) => r.institutionId))
    const n = entrants ? [...cur].filter((i) => !prev.has(i)).length : [...prev].filter((i) => !cur.has(i)).length
    return { year: y, count: n }
  })
  return build(
    `${entrants ? 'New entrants' : 'Exits'} per year in ${cat}${TAG}.`,
    { type: 'bar', title: `${entrants ? 'New entrants' : 'Exits'} per year — ${cat}`, xTitle: 'Year', yTitle: 'Institutions', series: [{ name: entrants ? 'Entrants' : 'Exits', x: rows.map((r) => r.year), y: rows.map((r) => r.count) }] },
    table([['year', 'Year'], ['count', entrants ? 'Entrants' : 'Exits', 'right']], rows),
    [fCat], entrants ? 'Present this year but not the previous year.' : 'Present the previous year but not this year.',
    ['Cut-offs in the listed size can make institutions look like exits or entrants.'],
  )
}
