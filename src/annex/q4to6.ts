import {
  type Args, type Res, COLORWAY, BLUE, GREY, ORANGE, PARAM_OPTIONS, PK, PLABEL, TEAL, boxTrace, catYears, describe, f1, f2, f3, hbar, heat, mean, numbers,
  pearson, plural, quantile, rows, scatterChart, short, std, table, tallH, topRows, val, byId, stateList,
} from './core'

/* ============================ 4. Bivariate ============================ */
function pairPts(a: Args, xKey: string, yKey: string, year: number) {
  return rows(a.category, year).map((r) => ({ x: val(r, xKey), y: val(r, yKey), label: `${r.institution} (rank ${r.rank})` }))
    .filter((p): p is { x: number; y: number; label: string } => p.x != null && p.y != null)
}
function bivariate(a: Args, xKey: string, yKey: string, q: string): Res {
  const pts = pairPts(a, xKey, yKey, a.year)
  const sc = scatterChart(pts, xKey, yKey, a.trend, `${PLABEL[yKey]} vs ${PLABEL[xKey]}, ${a.category} ${a.year}`,
    'Two numeric variables → a scatter plot (position on a common scale). The dotted trend line summarises the relationship; r measures its linear strength.')
  const r2 = sc.r * sc.r
  return {
    answer: `${q}: Pearson r = ${f3(sc.r)} (${strength2(sc.r)}), R² = ${f2(r2)}, n = ${sc.n} institutions in ${a.category} ${a.year}. ${f1(r2 * 100)}% of the variation in ${PLABEL[yKey]} is statistically associated with ${PLABEL[xKey]}. Correlation does not by itself prove that one causes the other.`,
    chips: [a.category, String(a.year), `r = ${f2(sc.r)}`, `n = ${sc.n}`],
    kpis: [{ label: 'Pearson r', value: f3(sc.r) }, { label: 'R²', value: f2(r2) }, { label: 'n', value: String(sc.n) }, { label: 'Slope', value: f3(sc.slope) }],
    charts: [sc.ch], table: table([['inst', 'Institution'], ['x', PLABEL[xKey]], ['y', PLABEL[yKey]]], pts.map((p) => ({ inst: p.label, x: p.x, y: p.y }))),
    facts: { r: sc.r, n: sc.n },
  }
}
const strength2 = (r: number) => {
  const a = Math.abs(r)
  return `${a >= 0.8 ? 'very strong' : a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'very weak'} ${r >= 0 ? 'positive' : 'negative'}`
}
export const q41 = (a: Args) => bivariate(a, a.param || 'RPC', 'score', `Association between ${PLABEL[a.param || 'RPC']} and the overall score`)
export const q42 = (a: Args) => bivariate(a, a.param || 'Perception', 'score', `Association between ${PLABEL[a.param || 'Perception']} and the overall score`)
export const q44 = (a: Args) => bivariate(a, a.param || 'TLR', a.param2 || 'RPC', `Relationship between ${PLABEL[a.param || 'TLR']} and ${PLABEL[a.param2 || 'RPC']}`)
export const q4x = (a: Args) => bivariate(a, a.attrX, a.attrY, `Relationship between ${PLABEL[a.attrX]} and ${PLABEL[a.attrY]}`)

export function q43(a: Args): Res {
  const rs = rows(a.category, a.year)
  const res = PK.map((k) => ({ k, ...pearson(rs.map((r) => r.params[k]), rs.map((r) => r.score)) })).filter((x) => Number.isFinite(x.r)).sort((x, y) => y.r - x.r)
  const cols = ['score', ...PK]
  const M = cols.map((c1) => cols.map((c2) => pearson(rs.map((r) => val(r, c1)), rs.map((r) => val(r, c2))).r))
  return {
    answer: res.length ? `${PLABEL[res[0].k]} has the strongest correlation with the overall score in ${a.category} ${a.year} (r = ${f3(res[0].r)}), followed by ${res.slice(1, 3).map((x) => `${PLABEL[x.k]} (${f3(x.r)})`).join(' and ')}. The weakest is ${PLABEL[res[res.length - 1].k]} (${f3(res[res.length - 1].r)}).` : 'Not enough data.',
    chips: [a.category, String(a.year), plural(res.length, 'parameter')],
    charts: [
      { title: `Correlation of each parameter with the overall score`, data: [hbar(res.map((x) => PLABEL[x.k]), res.map((x) => x.r), { color: res.map((x) => (x.r >= 0 ? BLUE : ORANGE)), text: res.map((x) => f2(x.r)) })] as never, xTitle: 'Pearson r', height: 300,
        layout: { xaxis: { range: [Math.min(0, ...res.map((x) => x.r)) - 0.05, 1.1] } }, why: 'Parameters are ranked by |r| in a sorted bar chart (position on a common scale); blue = positive, orange = negative, both anchored at zero.' },
      { title: 'Correlation matrix', data: [heat(M, cols.map((c) => PLABEL[c]), cols.map((c) => PLABEL[c]), { diverging: true, zmin: -1, zmax: 1, fmt: (v) => v.toFixed(2) })] as never, height: 380, layout: { yaxis: { autorange: 'reversed' } },
        why: 'A diverging colour scale centred on 0 (blue positive, orange negative) with the value printed in each cell, so no reading depends on colour alone.' },
    ],
    table: table([['p', 'Parameter'], ['r', 'r with overall score'], ['n', 'n']], res.map((x) => ({ p: PLABEL[x.k], r: +x.r.toFixed(3), n: x.n }))),
    facts: { order: res.map((x) => x.k) },
  }
}

export function q45(a: Args): Res {
  const ys = catYears(a.category)
  const keys = a.param === 'ALL' ? PK : [a.param as never as typeof PK[number]]
  const series = keys.map((k) => ({ k, rs: ys.map((y) => { const r = rows(a.category, y); return pearson(r.map((x) => x.params[k]), r.map((x) => x.score)).r }) }))
  const s0 = series[0]
  const valid = s0.rs.map((v, i) => [ys[i], v] as const).filter(([, v]) => Number.isFinite(v))
  return {
    answer: valid.length > 1 ? `The correlation between ${PLABEL[s0.k]} and the overall score in ${a.category} went from r = ${f2(valid[0][1])} in ${valid[0][0]} to r = ${f2(valid[valid.length - 1][1])} in ${valid[valid.length - 1][0]} (${valid[valid.length - 1][1] > valid[0][1] ? 'rising' : 'falling'}). Each point uses that year's ranked institutions only.` : 'Not enough years with data.',
    chips: [a.category, a.param === 'ALL' ? 'all parameters' : PLABEL[s0.k], `${ys[0]}–${ys[ys.length - 1]}`],
    charts: [{ title: `Correlation with overall score by year, ${a.category}`, data: series.map((s, i) => ({ type: 'scatter', mode: 'lines+markers', name: PLABEL[s.k], x: ys, y: s.rs, line: { color: COLORWAY[i], width: 3 }, marker: { size: 7 }, connectgaps: false })) as never,
      xTitle: 'Year', yTitle: 'Pearson r', showLegend: keys.length > 1, layout: { yaxis: { range: [-0.1, 1.05] } }, why: 'r computed separately for each year and drawn as a line over time; the fixed 0–1 axis stops small wiggles from looking dramatic.' }],
    table: table([['year', 'Year'], ...series.map((s) => [s.k, PLABEL[s.k]] as [string, string])], ys.map((y, i) => Object.fromEntries([['year', y], ...series.map((s) => [s.k, Number.isFinite(s.rs[i]) ? +s.rs[i].toFixed(3) : null])]))),
  }
}

/* ============================ 5. Multivariate ============================ */
export function q51(a: Args): Res {
  const n = Math.min(7, Math.max(2, a.topN > 10 ? 5 : a.topN))
  const top = topRows(a.category, a.year, n)
  return {
    answer: `The top ${n} of ${a.category} ${a.year} are ${top.map((r) => r.institution).join(', ')}. ${(() => { const best = PK.map((k) => ({ k, s: mean(numbers(top.map((r) => r.params[k]))) })).sort((x, y) => y.s - x.s); return `On average they are strongest in ${PLABEL[best[0].k]} (${f1(best[0].s)}) and weakest in ${PLABEL[best[best.length - 1].k]} (${f1(best[best.length - 1].s)}).` })()}`,
    chips: [a.category, String(a.year), `Top ${n}`],
    charts: [{ title: `Top ${n} institutions across the five NIRF parameters, ${a.year}`, data: top.map((r, i) => ({ type: 'bar', name: short(r.institution, 28), x: PK.map((k) => PLABEL[k]), y: PK.map((k) => r.params[k]), marker: { color: COLORWAY[i % 7] } })) as never,
      layout: { barmode: 'group' }, xTitle: 'Parameter', yTitle: 'Score', showLegend: true, legendRows: 2, yFromZero: true, height: 420,
      why: 'Grouped bars compare a few institutions on a common zero baseline, which reads more accurately than a radar chart. At most seven colours so each institution is distinguishable.' }],
    table: table([['i', 'Institution'], ['rank', 'Rank'], ...PK.map((k) => [k, PLABEL[k]] as [string, string])], top.map((r) => ({ i: r.institution, rank: r.rank, ...Object.fromEntries(PK.map((k) => [k, r.params[k]])) }))),
  }
}

function quadrant(a: Args, strong: string, weak: string, q: string): Res {
  const rs = rows(a.category, a.year).filter((r) => val(r, strong) != null && val(r, weak) != null)
  const sv = rs.map((r) => val(r, strong) as number).sort((x, y) => x - y), wv = rs.map((r) => val(r, weak) as number).sort((x, y) => x - y)
  const sCut = quantile(sv, a.pctHigh / 100), wCut = quantile(wv, a.pctLow / 100)
  const flagged = rs.filter((r) => (val(r, strong) as number) >= sCut && (val(r, weak) as number) <= wCut)
  const pts = rs.map((r) => ({ x: val(r, weak) as number, y: val(r, strong) as number, label: `${r.institution} (rank ${r.rank})`, flag: flagged.includes(r) }))
  const sc = scatterChart(pts, weak, strong, false, `${PLABEL[strong]} vs ${PLABEL[weak]}, ${a.category} ${a.year}`, 'A scatter with reference lines at the chosen percentiles turns "high here, low there" into a visible quadrant; flagged institutions are orange, everyone else grey.', {
    annotate: true, shapes: [
      { type: 'line', x0: wCut, x1: wCut, yref: 'paper', y0: 0, y1: 1, line: { color: '#6B7280', dash: 'dash', width: 1 } },
      { type: 'line', y0: sCut, y1: sCut, xref: 'paper', x0: 0, x1: 1, line: { color: '#6B7280', dash: 'dash', width: 1 } }] })
  const gap = flagged.map((r) => ({ r, d: (val(r, strong) as number) - (val(r, weak) as number) })).sort((x, y) => y.d - x.d)
  return {
    answer: `${q}: ${plural(flagged.length, 'institution')} in ${a.category} ${a.year} score in the top ${100 - a.pctHigh}% on ${PLABEL[strong]} (≥ ${f1(sCut)}) but at or below the ${a.pctLow}th percentile on ${PLABEL[weak]} (≤ ${f1(wCut)})${gap.length ? `, e.g. ${gap.slice(0, 3).map((x) => x.r.institution).join(', ')}` : ''}.`,
    chips: [a.category, String(a.year), `${PLABEL[strong]} ≥ P${a.pctHigh}`, `${PLABEL[weak]} ≤ P${a.pctLow}`],
    charts: [sc.ch], table: table([['i', 'Institution'], ['rank', 'Rank'], ['s', PLABEL[strong]], ['w', PLABEL[weak]], ['d', 'Gap']], gap.map((x) => ({ i: x.r.institution, rank: x.r.rank, s: val(x.r, strong), w: val(x.r, weak), d: +x.d.toFixed(2) }))),
    facts: { n: flagged.length },
  }
}
export const q52 = (a: Args) => quadrant(a, 'RPC', 'TLR', 'High research, relatively low teaching')
export const q53 = (a: Args) => quadrant(a, 'TLR', 'Perception', 'High teaching, relatively low perception')

export function q54(a: Args): Res {
  const lo = Math.min(a.year, a.year2), hi = Math.max(a.year, a.year2)
  const A = byId(a.category, lo), B = byId(a.category, hi)
  const out = [...B.values()].filter((r) => A.has(r.institutionId) && r.score != null && A.get(r.institutionId)!.score != null).map((r) => {
    const o = A.get(r.institutionId)!
    const down = PK.filter((k) => r.params[k] != null && o.params[k] != null && (r.params[k] as number) < (o.params[k] as number)).map((k) => `${k} ${f1((r.params[k] as number) - (o.params[k] as number))}`)
    return { r, gain: (r.score as number) - (o.score as number), down }
  }).filter((x) => x.gain > 0 && x.down.length > 0).sort((x, y) => y.gain - x.gain)
  const shown = out.slice(0, a.topN)
  return {
    answer: `${plural(out.length, 'institution')} raised their overall score between ${lo} and ${hi} while at least one parameter score fell${shown.length ? `, led by ${shown[0].r.institution} (+${f1(shown[0].gain)}; ${shown[0].down.join(', ')})` : ''}.`,
    chips: [a.category, `${lo} → ${hi}`],
    charts: [{ title: `Overall score gain despite falling parameters, ${lo} → ${hi}`, data: [hbar(shown.map((x) => short(x.r.institution, 34)), shown.map((x) => x.gain), { color: BLUE, text: shown.map((x) => `+${f1(x.gain)}  (↓ ${x.down.map((d) => d.split(' ')[0]).join(', ')})`) })] as never, xTitle: 'Change in overall score', height: tallH(shown.length), yFromZero: true,
      why: 'Sorted bars show the size of the gain; the label names which parameters fell, which a single chart axis cannot show.' }],
    table: table([['i', 'Institution'], ['g', 'Score change'], ['d', 'Parameters that fell (change)']], out.map((x) => ({ i: x.r.institution, g: +x.gain.toFixed(2), d: x.down.join('; ') }))),
  }
}

export function q55(a: Args): Res {
  const items = rows(a.category, a.year).map((r) => {
    const v = PK.map((k) => [k, r.params[k]] as const).filter((x): x is [typeof PK[number], number] => x[1] != null)
    if (v.length < 2) return null
    const s = v.reduce((p, c) => (c[1] > p[1] ? c : p)), w = v.reduce((p, c) => (c[1] < p[1] ? c : p))
    return { r, s, w, gap: s[1] - w[1] }
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => y.gap - x.gap).slice(0, a.topN)
  const labels = items.map((x) => short(x.r.institution, 34))
  return {
    answer: items.length ? `${items[0].r.institution} has the largest gap in ${a.category} ${a.year}: ${PLABEL[items[0].s[0]]} (${f1(items[0].s[1])}) versus ${PLABEL[items[0].w[0]]} (${f1(items[0].w[1])}), a difference of ${f1(items[0].gap)} points.` : 'No data.',
    chips: [a.category, String(a.year), `Top ${a.topN} gaps`],
    charts: [{ title: `Strongest vs weakest parameter, ${a.category} ${a.year}`, height: tallH(items.length) + 40, xTitle: 'Parameter score', showLegend: true,
      data: [
        { type: 'scatter', mode: 'lines', x: items.flatMap((x) => [x.w[1], x.s[1], null]), y: items.flatMap((_x, i) => [labels[i], labels[i], null]), line: { color: '#CBD5E1', width: 3 }, hoverinfo: 'skip', showlegend: false } as never,
        { type: 'scatter', mode: 'markers', name: 'Weakest parameter', x: items.map((x) => x.w[1]), y: labels, text: items.map((x) => `${PLABEL[x.w[0]]} ${f1(x.w[1])}`), marker: { color: ORANGE, size: 10 }, hovertemplate: '%{y}<br>%{text}<extra></extra>' } as never,
        { type: 'scatter', mode: 'markers', name: 'Strongest parameter', x: items.map((x) => x.s[1]), y: labels, text: items.map((x) => `${PLABEL[x.s[0]]} ${f1(x.s[1])}`), marker: { color: BLUE, size: 10 }, hovertemplate: '%{y}<br>%{text}<extra></extra>' } as never],
      layout: { yaxis: { autorange: 'reversed' } }, why: 'A dumbbell (dot-and-line) chart shows two values per institution and the gap between them as position on a common axis; orange = weakest, blue = strongest.' }],
    table: table([['i', 'Institution'], ['s', 'Strongest'], ['sv', 'Score'], ['w', 'Weakest'], ['wv', 'Score'], ['g', 'Gap']], items.map((x) => ({ i: x.r.institution, s: PLABEL[x.s[0]], sv: x.s[1], w: PLABEL[x.w[0]], wv: x.w[1], g: +x.gap.toFixed(2) }))),
    facts: { first: items[0]?.r.institution ?? '' },
  }
}

/* ============================ 6. Distribution comparison ============================ */
export function q61(a: Args): Res {
  const rs = rows(a.category, a.year)
  const top = numbers(rs.filter((r) => (r.rank as number) <= a.topN).map((r) => r.score)), rest = numbers(rs.filter((r) => (r.rank as number) > a.topN).map((r) => r.score))
  const dt = describe(top), dr = describe(rest)
  return {
    answer: `In ${a.category} ${a.year}, the top ${a.topN} have a median score of ${f1(dt.median)} (IQR ${f1(dt.iqr)}) versus ${f1(dr.median)} (IQR ${f1(dr.iqr)}) for the remaining ${dr.n}. The top group is ${dt.iqr > dr.iqr ? 'more' : 'less'} spread out and its median is ${f1(dt.median - dr.median)} points higher.`,
    chips: [a.category, String(a.year), `Top ${a.topN} vs rest`],
    kpis: [{ label: `Top ${a.topN} median`, value: f1(dt.median) }, { label: 'Rest median', value: f1(dr.median) }],
    charts: [{ title: `Score distribution: top ${a.topN} vs the rest, ${a.year}`, data: [boxTrace(`Top ${a.topN}`, top, COLORWAY[0]), boxTrace('Remaining', rest, COLORWAY[1])] as never, yTitle: 'Overall score', showLegend: false,
      why: 'Two groups on one axis: side-by-side box plots compare median, spread and outliers directly; two colours for two groups.' }],
    table: table([['g', 'Group'], ['n', 'n'], ['mean', 'Mean'], ['median', 'Median'], ['sd', 'Std dev'], ['iqr', 'IQR']], [['Top ' + a.topN, dt], ['Remaining', dr]].map(([g, d]) => ({ g: g as string, n: (d as typeof dt).n, mean: +(d as typeof dt).mean.toFixed(2), median: +(d as typeof dt).median.toFixed(2), sd: +(d as typeof dt).std.toFixed(2), iqr: +(d as typeof dt).iqr.toFixed(2) }))),
  }
}

export function q62(a: Args): Res {
  const ys = catYears(a.category)
  const m = a.param || 'score'
  const ds = ys.map((y) => ({ y, v: numbers(rows(a.category, y).map((r) => val(r, m))) }))
  const sd = ds.map((x) => std(x.v)), iqr = ds.map((x) => describe(x.v).iqr)
  const imax = sd.indexOf(Math.max(...sd)), imin = sd.indexOf(Math.min(...sd.filter(Number.isFinite)))
  return {
    answer: `${PLABEL[m]} is most dispersed in ${ys[imax]} (std ${f2(sd[imax])}, IQR ${f2(iqr[imax])}) and least in ${ys[imin]} (std ${f2(sd[imin])}, IQR ${f2(iqr[imin])}) for ${a.category}.`,
    chips: [a.category, PLABEL[m], `${ys[0]}–${ys[ys.length - 1]}`],
    charts: [
      { title: `Score distribution by year, ${a.category}`, data: ds.map((x) => boxTrace(String(x.y), x.v, TEAL)) as never, xTitle: 'Year', yTitle: PLABEL[m], showLegend: false, why: 'One box per year on a shared axis makes shifts in centre and width visible at once.' },
      { title: 'Dispersion measures by year', data: [{ type: 'scatter', mode: 'lines+markers', name: 'Std deviation', x: ys, y: sd, line: { color: COLORWAY[0], width: 3 } }, { type: 'scatter', mode: 'lines+markers', name: 'IQR', x: ys, y: iqr, line: { color: COLORWAY[1], width: 3 } }] as never,
        xTitle: 'Year', yTitle: 'Points', showLegend: true, yFromZero: true, why: 'Standard deviation and IQR as lines over time; IQR is robust to outliers, the standard deviation is not.' }],
    table: table([['y', 'Year'], ['n', 'n'], ['sd', 'Std dev'], ['iqr', 'IQR']], ds.map((x, i) => ({ y: x.y, n: x.v.length, sd: +sd[i].toFixed(2), iqr: +iqr[i].toFixed(2) }))),
    facts: { most: ys[imax] },
  }
}

export function q63(a: Args): Res {
  const rs = rows(a.category, a.year)
  const st = PK.map((k) => { const d = describe(rs.map((r) => r.params[k])); return { k, sd: d.std, cv: d.std / d.mean, iqr: d.iqr, n: d.n, mean: d.mean } }).filter((x) => x.n > 2)
  const key = a.basis === 'cv' ? 'cv' : a.basis === 'iqr' ? 'iqr' : 'sd'
  const lab = key === 'cv' ? 'Coefficient of variation (std ÷ mean)' : key === 'iqr' ? 'Interquartile range' : 'Standard deviation'
  st.sort((x, y) => y[key] - x[key])
  return {
    answer: `${PLABEL[st[0].k]} varies most across ${a.category} institutions in ${a.year} (${lab.toLowerCase()} = ${f2(st[0][key])}); ${PLABEL[st[st.length - 1].k]} varies least (${f2(st[st.length - 1][key])}).`,
    chips: [a.category, String(a.year), key === 'sd' ? 'std dev' : key === 'cv' ? 'CV' : 'IQR'],
    charts: [{ title: `Variability of each parameter, ${a.category} ${a.year}`, data: [hbar(st.map((x) => PLABEL[x.k]), st.map((x) => x[key]), { text: st.map((x) => f2(x[key])) })] as never, xTitle: lab, yFromZero: true, height: 300,
      why: 'One value per parameter, sorted, bars from zero. Use CV when parameters have different average levels, since standard deviation depends on scale.' },
      { title: 'Parameter distributions', data: PK.map((k) => boxTrace(PLABEL[k], numbers(rs.map((r) => r.params[k])), TEAL)) as never, yTitle: 'Score', showLegend: false, why: 'The boxes show where the variability comes from (spread and outliers).' }],
    table: table([['p', 'Parameter'], ['n', 'n'], ['mean', 'Mean'], ['sd', 'Std dev'], ['cv', 'CV'], ['iqr', 'IQR']], st.map((x) => ({ p: PLABEL[x.k], n: x.n, mean: +x.mean.toFixed(2), sd: +x.sd.toFixed(2), cv: +x.cv.toFixed(3), iqr: +x.iqr.toFixed(2) }))),
    facts: { first: st[0].k },
  }
}

export function q64(a: Args): Res {
  const ys = catYears(a.category)
  const m = a.param || 'score'
  const ds = ys.map((y) => describe(rows(a.category, y).map((r) => val(r, m))))
  return {
    answer: `The median ${PLABEL[m]} in ${a.category} moved from ${f1(ds[0].median)} (${ys[0]}, IQR ${f1(ds[0].iqr)}) to ${f1(ds[ds.length - 1].median)} (${ys[ys.length - 1]}, IQR ${f1(ds[ds.length - 1].iqr)}). The shaded band is the middle 50% of institutions.`,
    chips: [a.category, PLABEL[m], `${ys[0]}–${ys[ys.length - 1]}`],
    charts: [{ title: `Median and interquartile range, ${a.category}`, data: [
      { type: 'scatter', mode: 'lines', x: ys, y: ds.map((d) => d.q1), line: { width: 0, color: TEAL }, showlegend: false, hoverinfo: 'skip' } as never,
      { type: 'scatter', mode: 'lines', x: ys, y: ds.map((d) => d.q3), fill: 'tonexty', fillcolor: 'rgba(14,124,134,0.18)', line: { width: 0, color: TEAL }, name: 'Q1–Q3 (IQR)', hoverinfo: 'skip' } as never,
      { type: 'scatter', mode: 'lines+markers', x: ys, y: ds.map((d) => d.median), name: 'Median', line: { color: TEAL, width: 3 }, marker: { size: 8 } } as never],
      xTitle: 'Year', yTitle: PLABEL[m], showLegend: true, why: 'Time → line chart. The median is the line and the IQR a translucent band, so centre and spread over time appear in a single view.' }],
    table: table([['y', 'Year'], ['q1', 'Q1'], ['med', 'Median'], ['q3', 'Q3'], ['iqr', 'IQR']], ys.map((y, i) => ({ y, q1: +ds[i].q1.toFixed(2), med: +ds[i].median.toFixed(2), q3: +ds[i].q3.toFixed(2), iqr: +ds[i].iqr.toFixed(2) }))),
  }
}

export function q65(a: Args): Res {
  const m = a.param || 'score'
  const by = new Map<string, number[]>()
  rows(a.category, a.year).forEach((r) => { const v = val(r, m); if (v != null && r.state) by.set(r.state, [...(by.get(r.state) ?? []), v]) })
  const list = [...by].filter(([, v]) => v.length >= a.minCount).map(([s, v]) => ({ s, v, med: quantile(v.slice().sort((x, y) => x - y), 0.5) })).sort((x, y) => y.med - x.med)
  void stateList
  return {
    answer: list.length ? `Among states with at least ${a.minCount} ranked institutions, ${list[0].s} has the highest median ${PLABEL[m]} (${f1(list[0].med)}) and ${list[list.length - 1].s} the lowest (${f1(list[list.length - 1].med)}) in ${a.category} ${a.year}. States with fewer institutions are hidden because a box plot of 1–2 points is not meaningful.` : 'No state meets the minimum institution count.',
    chips: [a.category, String(a.year), `≥ ${a.minCount} institutions`],
    charts: [{ title: `${PLABEL[m]} distribution by state, ${a.category} ${a.year}`, data: list.map((x) => boxTrace(`${x.s} (n=${x.v.length})`, x.v, TEAL, 'h')).reverse() as never, xTitle: PLABEL[m], showLegend: false, height: tallH(list.length) + 60,
      why: 'Box plots per state show how each state’s scores are spread, ordered by median; one colour as the state is labelled on the axis.' }],
    table: table([['s', 'State'], ['n', 'n'], ['med', 'Median'], ['min', 'Min'], ['max', 'Max']], list.map((x) => ({ s: x.s, n: x.v.length, med: +x.med.toFixed(2), min: Math.min(...x.v), max: Math.max(...x.v) }))),
  }
}
void GREY; void PARAM_OPTIONS; void byId
