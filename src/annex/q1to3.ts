import {
  type Args, type Res, COLORWAY, BLUE, GREY, ORANGE, QSHADES, TEAL, byId, catYears, countByState, describe, f1, f2, hbar, heat, history, boxTrace,
  mean, nameOf, numbers, plural, quantile, rows, short, table, tallH, topRows, val, PLABEL, pairs, stateList, std,
} from './core'

const span = (a: Args) => {
  const ys = catYears(a.category)
  return { lo: Math.min(a.year, a.year2), hi: Math.max(a.year, a.year2), ys }
}

/* ============================ 1. Time series ============================ */
export function q11(a: Args): Res {
  const ys = catYears(a.category)
  const ids = a.institutions.slice(0, 6)
  const traces = ids.map((id, i) => {
    const h = history(a.category, id)
    return {
      type: 'scatter', mode: 'lines+markers', name: short(nameOf(id, a.category), 30), x: ys, y: ys.map((y) => h.get(y)?.rank ?? null), connectgaps: false,
      line: { color: COLORWAY[i % 7], width: 2.5 }, marker: { size: 7 }
    }
  })
  const tr = ids.map((id) => {
    const h = history(a.category, id)
    const yrs = [...h.keys()]
    const row: Record<string, string | number | null> = { institution: nameOf(id, a.category) }
    ys.forEach((y) => (row['y' + y] = h.get(y)?.rank ?? null))
    row.change = yrs.length > 1 ? (h.get(yrs[0])!.rank as number) - (h.get(yrs[yrs.length - 1])!.rank as number) : null
    return row
  })
  const sents = ids.map((id) => {
    const h = history(a.category, id), yrs = [...h.keys()]
    if (!yrs.length) return `${nameOf(id)} is not ranked in ${a.category}.`
    const r0 = h.get(yrs[0])!.rank as number, r1 = h.get(yrs[yrs.length - 1])!.rank as number
    const d = r0 - r1
    return `${nameOf(id, a.category)}: rank ${r0} (${yrs[0]}) → ${r1} (${yrs[yrs.length - 1]}), ${d > 0 ? `up ${d} places` : d < 0 ? `down ${-d} places` : 'unchanged'}.`
  })
  return {
    answer: ids.length ? sents.join(' ') : 'Select one or more institutions to see how their rank changed.',
    chips: [a.category, `${ys[0]}–${ys[ys.length - 1]}`, plural(ids.length, 'institution')],
    charts: [{
      title: `Rank of selected institutions, ${a.category}`, data: traces as never, xTitle: 'Year', yTitle: 'Rank (1 = best)', reverseY: true, showLegend: true, legendRows: 2, height: 400, layout: { yaxis: { tickformat: 'd', ...(ids.some((id) => [...history(a.category, id).values()].some((r) => (r.rank as number) > 12)) ? {} : { dtick: 1 }) } },
      why: 'Time is on the x-axis, so lines are right; the rank axis is flipped so a better rank sits higher. Position on a common scale is the most accurate encoding, and a gap means the institution was not ranked that year.'
    } as never],
    table: table([['institution', 'Institution'], ...ys.map((y) => ['y' + y, String(y)] as [string, string]), ['change', 'Places gained']], tr),
  }
}

function movers(a: Args, dir: 'up' | 'down', title: string): Res {
  const { lo, hi } = span(a)
  const A = byId(a.category, lo), B = byId(a.category, hi)
  const all = [...B.values()].filter((r) => A.has(r.institutionId)).map((r) => ({ r, d: (A.get(r.institutionId)!.rank as number) - (r.rank as number) }))
  const sel = all.filter((x) => (dir === 'up' ? x.d > 0 : x.d < 0)).sort((x, y) => (dir === 'up' ? y.d - x.d : x.d - y.d)).slice(0, a.topN)
  const labels = sel.map((x) => short(x.r.institution, 38))
  return {
    answer: sel.length ? `${sel[0].r.institution} ${dir === 'up' ? 'improved' : 'declined'} the most between ${lo} and ${hi}: rank ${A.get(sel[0].r.institutionId)!.rank} → ${sel[0].r.rank} (${sel[0].d > 0 ? '+' : ''}${sel[0].d} places). Compared across the ${all.length} institutions ranked in both years.` : `No institution ${dir === 'up' ? 'improved' : 'declined'} between ${lo} and ${hi} in ${a.category}.`,
    chips: [a.category, `${lo} → ${hi}`, `Top ${a.topN}`],
    charts: [{
      title, data: [hbar(labels, sel.map((x) => Math.abs(x.d)), { color: dir === 'up' ? BLUE : ORANGE, text: sel.map((x) => `${x.d > 0 ? '+' : '−'}${Math.abs(x.d)}`) })], xTitle: 'Places moved (rank in start year − rank in end year)', height: tallH(sel.length), yFromZero: true,
      why: 'A sorted horizontal bar chart ranks the movers by length from a common zero baseline; blue means improvement and orange decline, the same encoding used elsewhere.'
    }],
    table: table([['institution', 'Institution'], ['state', 'State'], ['from', `Rank ${lo}`], ['to', `Rank ${hi}`], ['moved', 'Places moved']],
      sel.map((x) => ({ institution: x.r.institution, state: x.r.state, from: A.get(x.r.institutionId)!.rank, to: x.r.rank, moved: x.d }))),
    facts: { first: sel[0]?.r.institution ?? '', moved: sel[0]?.d ?? 0, names: sel.map((x) => x.r.institution) },
  }
}
export const q12 = (a: Args) => movers(a, 'up', `Greatest rank improvement, ${a.category}`)
export const q13 = (a: Args) => movers(a, 'down', `Largest rank decline, ${a.category}`)

export function q14(a: Args): Res {
  const ys = catYears(a.category)
  const m = a.param || 'score'
  const stats = ys.map((y) => describe(rows(a.category, y).map((r) => val(r, m))))
  const first = stats[0], last = stats[stats.length - 1]
  return {
    answer: `The average ${PLABEL[m]} of ranked ${a.category} institutions moved from ${f1(first.mean)} in ${ys[0]} to ${f1(last.mean)} in ${ys[ys.length - 1]} (${last.mean >= first.mean ? '+' : ''}${f1(last.mean - first.mean)}).`,
    chips: [a.category, PLABEL[m], `${ys[0]}–${ys[ys.length - 1]}`],
    charts: [{
      title: `Average ${PLABEL[m]} by year, ${a.category}`, data: [{
        type: 'scatter', mode: 'lines+markers', x: ys, y: stats.map((s) => s.mean), line: { color: TEAL, width: 3 }, marker: { size: 8 }, name: 'Mean',
        text: stats.map((s) => `n = ${s.n}`), hovertemplate: '%{x}: %{y:.2f}<br>%{text}<extra></extra>'
      } as never], xTitle: 'Year', yTitle: `Mean ${PLABEL[m]}`,
      why: 'Time on the x-axis makes a line chart the right form. Only the top ~100 institutions are ranked each year, so this is the average of the ranked set, not of all colleges.'
    }],
    table: table([['year', 'Year'], ['n', 'Institutions'], ['mean', 'Mean'], ['median', 'Median']], ys.map((y, i) => ({ year: y, n: stats[i].n, mean: +stats[i].mean.toFixed(2), median: +stats[i].median.toFixed(2) }))),
  }
}

export function q15(a: Args): Res {
  const { lo, hi } = span(a)
  const ys = catYears(a.category).filter((y) => y >= lo && y <= hi)
  const cnt = new Map<string, number>()
  const nm = new Map<string, string>()
  for (const y of ys) for (const r of topRows(a.category, y, a.topN)) { cnt.set(r.institutionId, (cnt.get(r.institutionId) ?? 0) + 1); nm.set(r.institutionId, r.institution) }
  const list = [...cnt].filter(([, c]) => c >= Math.max(1, a.minYears)).sort((x, y) => y[1] - x[1] || nm.get(x[0])!.localeCompare(nm.get(y[0])!))
  const full = list.filter(([, c]) => c === ys.length)
  const shown = list.slice(0, 25)
  return {
    answer: `${plural(full.length, 'institution')} stayed in the top ${a.topN} of ${a.category} in all ${ys.length} years (${lo}–${hi})${full.length ? ': ' + full.map(([id]) => nm.get(id)).join(', ') : ''}. ${plural(list.length, 'institution')} appeared in at least ${a.minYears} of those years.`,
    chips: [a.category, `Top ${a.topN}`, `${lo}–${hi}`, `≥ ${a.minYears} years`],
    kpis: [{ label: `In all ${ys.length} years`, value: String(full.length) }, { label: `In ≥ ${a.minYears} years`, value: String(list.length) }],
    charts: [{
      title: `Years inside the top ${a.topN}, ${a.category}`, data: [hbar(shown.map(([id]) => short(nm.get(id)!, 38)), shown.map(([, c]) => c), { color: shown.map(([, c]) => (c === ys.length ? TEAL : '#7CC3C8')), text: shown.map(([, c]) => `${c}/${ys.length}`) })],
      xTitle: `Number of years in the top ${a.topN}`, height: tallH(shown.length), yFromZero: true,
      why: 'Counting years per institution is a magnitude comparison, so sorted bars from zero. The darker bars are institutions present in every year.'
    }],
    table: table([['institution', 'Institution'], ['years', 'Years in top N'], ['of', 'Years compared']], list.map(([id, c]) => ({ institution: nm.get(id)!, years: c, of: ys.length }))),
    facts: { full: full.map(([id]) => nm.get(id)!) },
  }
}

/* ============================ 2. Geospatial ============================ */
const stateBars = (counts: Record<string, number>, title: string, why: string, limit = 20) => {
  const e = Object.entries(counts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, limit)
  return { title, data: [hbar(e.map(([s]) => s), e.map(([, c]) => c), { text: e.map(([, c]) => String(c)) })], xTitle: 'Institutions', height: tallH(e.length), yFromZero: true, why }
}
export function q21(a: Args): Res {
  const rs = topRows(a.category, a.year, a.topN)
  const c = countByState(rs)
  const e = Object.entries(c).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  return {
    answer: `In the ${a.year} ${a.category} top ${a.topN}, ${e[0]?.[0]} leads with ${e[0]?.[1]} institutions, followed by ${e.slice(1, 3).map(([s, n]) => `${s} (${n})`).join(' and ')}. ${plural(e.length, 'state')} are represented.`,
    chips: [a.category, String(a.year), `Top ${a.topN}`],
    maps: [{ title: `Top ${a.topN} institutions by state, ${a.year}`, counts: c, max: Math.max(1, ...Object.values(c)) }],
    charts: [stateBars(c, `States ranked by institutions in the top ${a.topN}`, 'Sorted bars give exact, comparable counts; the map next to it shows where they sit, with one teal hue getting darker as the count rises.')],
    table: table([['state', 'State'], ['n', 'Institutions']], e.map(([state, n]) => ({ state, n }))),
    facts: { top: e.slice(0, 3).map(([s, n]) => `${s}:${n}`) },
  }
}

export function q22(a: Args): Res {
  const ys = catYears(a.category)
  const y1 = ys.includes(a.year) ? a.year : ys[0], y2 = ys.includes(a.year2) ? a.year2 : ys[ys.length - 1]
  const c1 = countByState(topRows(a.category, y1, a.topN)), c2 = countByState(topRows(a.category, y2, a.topN))
  const max = Math.max(1, ...Object.values(c1), ...Object.values(c2))
  const tot = new Map<string, number>()
  for (const y of ys) for (const [s, n] of Object.entries(countByState(topRows(a.category, y, a.topN)))) tot.set(s, (tot.get(s) ?? 0) + n)
  const states = [...tot].sort((x, y) => y[1] - x[1]).slice(0, 14).map(([s]) => s)
  const z = states.map((s) => ys.map((y) => countByState(topRows(a.category, y, a.topN))[s] ?? 0))
  const gain = Object.keys({ ...c1, ...c2 }).map((s) => [s, (c2[s] ?? 0) - (c1[s] ?? 0)] as [string, number]).sort((x, y) => y[1] - x[1])
  return {
    answer: `Between ${y1} and ${y2}, ${gain[0]?.[0]} gained the most top-${a.topN} places (${gain[0]?.[1] >= 0 ? '+' : ''}${gain[0]?.[1]}), while ${gain[gain.length - 1]?.[0]} changed by ${gain[gain.length - 1]?.[1]}.`,
    chips: [a.category, `${y1} vs ${y2}`, `Top ${a.topN}`],
    maps: [{ title: `${y1}`, counts: c1, max }, { title: `${y2}`, counts: c2, max }],
    charts: [{
      title: `Top-${a.topN} institutions per state across years (14 largest states)`, data: [heat(z, ys, states, { fmt: (v) => String(v) })], xTitle: 'Year', height: tallH(states.length) + 40, layout: { yaxis: { autorange: 'reversed' } },
      why: 'Two maps on one shared colour scale show the geographic shift; the state × year heat-map shows the trend precisely, which colour alone cannot.'
    }],
    table: table([['state', 'State'], ['a', String(y1)], ['b', String(y2)], ['d', 'Change']], gain.map(([state, d]) => ({ state, a: c1[state] ?? 0, b: c2[state] ?? 0, d }))),
  }
}

export function q23(a: Args): Res {
  const { lo, hi, ys } = span(a)
  const yA = ys.filter((y) => y >= lo)[0], yB = [...ys].reverse().find((y) => y <= hi) ?? hi
  const c1 = countByState(topRows(a.category, yA, a.topN)), c2 = countByState(topRows(a.category, yB, a.topN))
  const d = Object.keys({ ...c1, ...c2 }).map((s) => [s, (c2[s] ?? 0) - (c1[s] ?? 0)] as [string, number]).filter(([, v]) => v !== 0).sort((x, y) => y[1] - x[1])
  const up = d.filter(([, v]) => v > 0)
  return {
    answer: `${plural(up.length, 'state')} improved their top-${a.topN} representation between ${yA} and ${yB}${up.length ? ': ' + up.slice(0, 5).map(([s, v]) => `${s} (+${v})`).join(', ') : ''}. ${plural(d.length - up.length, 'state')} lost places.`,
    chips: [a.category, `${yA} → ${yB}`, `Top ${a.topN}`],
    maps: (() => { const max = Math.max(1, ...Object.values(c1), ...Object.values(c2)); return [{ title: `Top ${a.topN} institutions by state, ${yA}`, counts: c1, max }, { title: `Top ${a.topN} institutions by state, ${yB}`, counts: c2, max }] })(),
    charts: [{
      title: `Change in top-${a.topN} count by state, ${yA} → ${yB}`, data: [{
        type: 'bar', orientation: 'h', y: d.map((x) => x[0]).reverse(), x: d.map((x) => x[1]).reverse(), marker: { color: d.map((x) => (x[1] > 0 ? BLUE : ORANGE)).reverse() },
        text: d.map((x) => (x[1] > 0 ? '+' : '') + x[1]).reverse(), textposition: 'outside', cliponaxis: false
      } as never], xTitle: 'Change in institutions', height: tallH(d.length),
      why: 'A signed change needs a diverging encoding centred on zero: blue for gains, orange for losses, sorted so the biggest winners and losers sit at the two ends.'
    }],
    table: table([['state', 'State'], ['a', String(yA)], ['b', String(yB)], ['d', 'Change']], d.map(([state, v]) => ({ state, a: c1[state] ?? 0, b: c2[state] ?? 0, d: v }))),
  }
}

export function q24(a: Args): Res {
  const ys = catYears(a.category)
  const s1 = a.state, s2 = a.state2
  const cnt = (s: string) => ys.map((y) => topRows(a.category, y, a.topN).filter((r) => r.state === s).length)
  const rk = (s: string) => rows(a.category, a.year).filter((r) => r.state === s)
  const A = rk(s1), B = rk(s2)
  const med = (rs: { rank: number | null }[]) => quantile(numbers(rs.map((r) => r.rank)).sort((x, y) => x - y), 0.5)
  return {
    answer: `In ${a.year}, ${s1} has ${plural(A.length, 'ranked institution')} (median rank ${f1(med(A))}) and ${s2} has ${B.length} (median rank ${f1(med(B))}). Lower rank numbers are better, so ${med(A) <= med(B) ? s1 : s2} has the stronger typical position.`,
    chips: [a.category, `${s1} vs ${s2}`, String(a.year)],
    kpis: [{ label: `${s1} institutions`, value: String(A.length) }, { label: `${s2} institutions`, value: String(B.length) }],
    maps: (() => { const c = countByState(topRows(a.category, a.year, a.topN)); return [{ title: `Top ${a.topN} institutions by state, ${a.year} (compare ${s1} and ${s2})`, counts: c, max: Math.max(1, ...Object.values(c)) }] })(),
    charts: [
      {
        title: `Institutions in the top ${a.topN} per year`, data: [s1, s2].map((s, i) => ({ type: 'scatter', mode: 'lines+markers', name: s, x: ys, y: cnt(s), line: { color: COLORWAY[i], width: 3 }, marker: { size: 7 } })) as never,
        xTitle: 'Year', yTitle: 'Institutions', showLegend: true, yFromZero: true, why: 'Counts over time: two lines, one colour per state, direct comparison on a shared axis.'
      },
      {
        title: `Rank distribution in ${a.year}`, data: [boxTrace(s1, A.map((r) => r.rank as number), COLORWAY[0], 'v', A.map((r) => r.institution)), boxTrace(s2, B.map((r) => r.rank as number), COLORWAY[1], 'v', B.map((r) => r.institution))] as never,
        yTitle: 'Rank (1 = best)', reverseY: true, showLegend: false, why: 'Box plots show median and spread of rank for each state; rank is ordinal, so the median, not the mean, is the summary.'
      },
    ],
    table: table([['institution', 'Institution'], ['state', 'State'], ['rank', 'Rank']], [...A, ...B].map((r) => ({ institution: r.institution, state: r.state, rank: r.rank }))),
    facts: { [s1]: cnt(s1).join(','), [s2]: cnt(s2).join(',') },
  }
}

export function q25(a: Args): Res {
  const { lo, hi, ys } = span(a)
  const first = new Map<string, { y: number; r: ReturnType<typeof rows>[number] }>()
  for (const y of ys) for (const r of rows(a.category, y)) if (!first.has(r.institutionId)) first.set(r.institutionId, { y, r })
  const base = ys[0]
  const fresh = [...first.values()].filter((x) => x.y > base && x.y >= lo && x.y <= hi)
  const c: Record<string, number> = {}
  fresh.forEach((x) => (c[x.r.state] = (c[x.r.state] ?? 0) + 1))
  const e = Object.entries(c).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
  return {
    answer: `${plural(fresh.length, 'institution')} appeared in ${a.category} for the first time between ${Math.max(lo, ys[1] ?? lo)} and ${hi}. ${e[0] ? `${e[0][0]} produced the most (${e[0][1]})` : 'None found'}${e[1] ? `, then ${e[1][0]} (${e[1][1]})` : ''}. "Newly appearing" means the first year the institution is ranked in this category after ${base}.`,
    chips: [a.category, `${lo}–${hi}`],
    maps: [{ title: `Newly appearing institutions by state, ${lo}–${hi}`, counts: c, max: Math.max(1, ...Object.values(c)) }],
    charts: [stateBars(c, `Newly appearing institutions by state, ${lo}–${hi}`, 'Counting by state is a simple magnitude comparison, so a sorted bar chart from zero.')],
    table: table([['institution', 'Institution'], ['state', 'State'], ['year', 'First ranked']], fresh.sort((x, y) => x.y - y.y).map((x) => ({ institution: x.r.institution, state: x.r.state, year: x.y }))),
    facts: { total: fresh.length },
  }
}

/* ============================ 3. Univariate ============================ */
export function q31(a: Args): Res {
  const m = a.param || 'score'
  const v = numbers(rows(a.category, a.year).map((r) => val(r, m))).sort((x, y) => x - y)
  const d = describe(v)
  return {
    answer: `${plural(d.n, 'institution')} in ${a.category} ${a.year}: scores range ${f1(d.min)}–${f1(d.max)}, mean ${f1(d.mean)}, median ${f1(d.median)}. ${d.mean > d.median ? 'The mean exceeds the median, so a few high scorers pull the distribution to the right (right-skewed).' : 'The distribution is roughly symmetric or left-skewed.'}`,
    chips: [a.category, String(a.year), PLABEL[m]],
    charts: [{
      title: `Distribution of ${PLABEL[m]}, ${a.category} ${a.year}`, data: [{ type: 'histogram', x: v, nbinsx: a.bins, marker: { color: TEAL, line: { color: '#fff', width: 1 } }, name: 'Institutions' } as never,
      { type: 'scatter', mode: 'lines', x: [d.mean, d.mean], y: [0, 1], yaxis: 'y2', name: `Mean ${f1(d.mean)}`, line: { color: ORANGE, width: 2 } } as never,
      { type: 'scatter', mode: 'lines', x: [d.median, d.median], y: [0, 1], yaxis: 'y2', name: `Median ${f1(d.median)}`, line: { color: '#111827', width: 2, dash: 'dash' } } as never],
      xTitle: PLABEL[m], yTitle: 'Number of institutions', showLegend: true, yFromZero: true, layout: { yaxis2: { overlaying: 'y', range: [0, 1], visible: false } },
      why: 'A histogram shows the shape of a single continuous variable; the mean and median lines expose skew. Bars touch because the x-axis is continuous.'
    }],
    table: table([['stat', 'Statistic'], ['value', 'Value']], [['Count', d.n], ['Mean', +d.mean.toFixed(2)], ['Median', +d.median.toFixed(2)], ['Min', d.min], ['Max', d.max], ['Std dev', +d.std.toFixed(2)]].map(([stat, value]) => ({ stat, value }))),
  }
}

export function q32(a: Args): Res {
  const ys = catYears(a.category)
  let vals: number[]
  let label: string
  if (a.basis === 'year') {
    vals = rows(a.category, a.year).map((r) => r.rank as number)
    label = `Rank in ${a.year}`
  } else {
    const per = new Map<string, number[]>()
    for (const y of ys) for (const r of rows(a.category, y)) per.set(r.institutionId, [...(per.get(r.institutionId) ?? []), r.rank as number])
    vals = [...per.values()].map((x) => quantile(x.sort((p, q) => p - q), 0.5))
    label = 'Median rank across all years'
  }
  const size = Math.max(1, Math.round(a.bandSize))
  const mx = Math.ceil(Math.max(...vals) / size) * size
  const edges = Array.from({ length: mx / size }, (_, i) => i * size)
  const cnt = edges.map((e) => vals.filter((v) => v > e && v <= e + size).length)
  const med = quantile(vals.slice().sort((x, y) => x - y), 0.5)
  return {
    answer: `${plural(vals.length, 'institution')} (${label.toLowerCase()}): median ${f1(med)}. Ranks are ordinal, so the distribution is shown in bands of ${size} and the median is the right summary. Within a single year every rank appears once, so the interesting shape is across years.`,
    chips: [a.category, label],
    charts: [{
      title: `Distribution of ${label.toLowerCase()}, ${a.category}`, data: [{ type: 'bar', x: edges.map((e) => `${e + 1}–${e + size}`), y: cnt, marker: { color: TEAL }, text: cnt.map(String), textposition: 'outside', cliponaxis: false } as never],
      xTitle: 'Rank band', yTitle: 'Institutions', yFromZero: true, why: 'Ordinal ranks are binned into equal-width bands and drawn as touching bars (a histogram); the median, not the mean, summarises an ordinal variable.'
    }],
    table: table([['band', 'Rank band'], ['n', 'Institutions']], edges.map((e, i) => ({ band: `${e + 1}–${e + size}`, n: cnt[i] }))),
  }
}

export function q33(a: Args): Res {
  const m = a.param || 'score'
  const rs = rows(a.category, a.year)
  const v = numbers(rs.map((r) => val(r, m)))
  const d = describe(v)
  const hi = rs.find((r) => val(r, m) === d.max), lo = rs.find((r) => val(r, m) === d.min)
  return {
    answer: `${a.category} ${a.year} ${PLABEL[m]}: average ${f2(d.mean)}, median ${f2(d.median)}, minimum ${f2(d.min)}${lo ? ` (${lo.institution})` : ''}, maximum ${f2(d.max)}${hi ? ` (${hi.institution})` : ''}.`,
    chips: [a.category, String(a.year), PLABEL[m]],
    kpis: [{ label: 'Average', value: f2(d.mean) }, { label: 'Median', value: f2(d.median) }, { label: 'Minimum', value: f2(d.min) }, { label: 'Maximum', value: f2(d.max) }],
    charts: [{
      title: `${PLABEL[m]} summary, ${a.category} ${a.year}`, data: [boxTrace('Institutions', v, TEAL, 'h', rs.map((r) => r.institution))] as never, xTitle: PLABEL[m], showLegend: false, height: 220,
      why: 'The four numbers are shown as exact values; the box plot places them in context (quartiles, whiskers, outliers) on one axis.'
    }],
    facts: { mean: d.mean, median: d.median, min: d.min, max: d.max },
  }
}

export function q34(a: Args): Res {
  const ys = catYears(a.category)
  const pooled = numbers(ys.flatMap((y) => rows(a.category, y).map((r) => r.score))).sort((x, y) => x - y)
  const cutsFor = (y: number) => {
    const s = (a.basis === 'year' ? numbers(rows(a.category, y).map((r) => r.score)) : pooled).slice().sort((p, q) => p - q)
    return [quantile(s, 0.25), quantile(s, 0.5), quantile(s, 0.75)]
  }
  const share = (y: number) => {
    const c = cutsFor(a.basis === 'year' ? y : y)
    const v = numbers(rows(a.category, y).map((r) => r.score))
    const bins = [0, 0, 0, 0]
    v.forEach((x) => bins[x <= c[0] ? 0 : x <= c[1] ? 1 : x <= c[2] ? 2 : 3]++)
    return bins.map((b) => (v.length ? (100 * b) / v.length : 0))
  }
  const names = ['Q1 (lowest 25%)', 'Q2', 'Q3', 'Q4 (highest 25%)']
  const one = share(a.year)
  const c0 = cutsFor(a.year)
  const note = a.basis === 'year' ? 'Quartiles are computed within the selected year, so each holds about 25% by construction. Switch the basis to "pooled" to see how a year compares with all years.' : `Quartile cut-offs come from all years pooled (${f1(c0[0])} / ${f1(c0[1])} / ${f1(c0[2])}).`
  const chart = a.basis === 'trend'
    ? {
      title: 'Share of institutions in each pooled-score quartile, by year', data: names.map((n, i) => ({ type: 'bar', name: n, x: ys, y: ys.map((y) => share(y)[i]), marker: { color: QSHADES[i] } })) as never, layout: { barmode: 'stack' }, xTitle: 'Year', yTitle: '% of ranked institutions', showLegend: true, yFromZero: true,
      why: 'A 100% stacked bar compares part-to-whole across years; four shades of one teal hue show an ordered variable, darker = higher scores.'
    }
    : {
      title: `Share of institutions per score quartile, ${a.year}`, data: [{ type: 'bar', x: names, y: one, marker: { color: QSHADES }, text: one.map((v) => f1(v) + '%'), textposition: 'outside', cliponaxis: false } as never], yTitle: '% of ranked institutions', yFromZero: true, layout: { yaxis: { range: [0, 100] } },
      why: 'Four ordered bars from zero, shaded light to dark teal because quartiles are an ordered variable (low → high).'
    }
  const rowsT = (a.basis === 'trend' ? ys : [a.year]).map((y) => { const s = share(y); return { year: y, q1: +s[0].toFixed(1), q2: +s[1].toFixed(1), q3: +s[2].toFixed(1), q4: +s[3].toFixed(1) } })
  return {
    answer: a.basis === 'trend' ? `Using pooled cut-offs (${f1(c0[0])} / ${f1(c0[1])} / ${f1(c0[2])}), the share in the top quartile was ${f1(share(ys[0])[3])}% in ${ys[0]} and ${f1(share(ys[ys.length - 1])[3])}% in ${ys[ys.length - 1]}.` : `${one.map((v, i) => `${f1(v)}% fall in ${names[i].split(' ')[0]}`).join(', ')}. ${note}`,
    chips: [a.category, a.basis === 'year' ? String(a.year) : 'pooled quartiles', a.basis === 'trend' ? 'all years' : String(a.year)],
    charts: [chart as never], table: table([['year', 'Year'], ['q1', 'Q1 %'], ['q2', 'Q2 %'], ['q3', 'Q3 %'], ['q4', 'Q4 %']], rowsT),
  }
}

export function q35(a: Args): Res {
  const m = a.param || 'score'
  const list = ALLCATS().map((c) => ({ c, v: numbers(rows(c, a.year).map((r) => val(r, m))) })).filter((x) => x.v.length >= 5)
  list.sort((x, y) => quantile(y.v.slice().sort((p, q) => p - q), 0.5) - quantile(x.v.slice().sort((p, q) => p - q), 0.5))
  const sd = list.map((x) => ({ c: x.c, s: std(x.v), iqr: describe(x.v).iqr }))
  const widest = sd.slice().sort((x, y) => y.iqr - x.iqr)[0], tight = sd.slice().sort((x, y) => x.iqr - y.iqr)[0]
  return {
    answer: list.length ? `In ${a.year}, ${widest.c} has the widest spread of ${PLABEL[m]} (IQR ${f1(widest.iqr)}) and ${tight.c} the tightest (IQR ${f1(tight.iqr)}). Categories differ in size (n), so compare spread with care.` : `No category has enough institutions in ${a.year}.`,
    chips: [String(a.year), PLABEL[m], plural(list.length, 'category').replace('categorys', 'categories')],
    charts: [{
      title: `${PLABEL[m]} spread by category, ${a.year}`, data: list.map((x) => boxTrace(`${x.c} (n=${x.v.length})`, x.v, TEAL, 'h')).reverse() as never, xTitle: PLABEL[m], showLegend: false, height: tallH(list.length) + 60,
      why: 'Box plots put many distributions side by side on a common axis, showing median, spread and outliers per category; one colour because the category is already labelled on the axis.'
    }],
    table: table([['c', 'Category'], ['n', 'n'], ['median', 'Median'], ['iqr', 'IQR'], ['sd', 'Std dev']], list.map((x, i) => ({ c: x.c, n: x.v.length, median: +quantile(x.v.slice().sort((p, q) => p - q), 0.5).toFixed(2), iqr: +sd[i].iqr.toFixed(2), sd: +sd[i].s.toFixed(2) }))),
  }
}

import { allCategories } from './core'
const ALLCATS = () => allCategories()
void mean; void stateList; void pairs; void GREY; void std
