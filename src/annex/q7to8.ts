import {
  type Args, type Res, BLUE, GREY, ORANGE, PK, PLABEL, TEAL, byId, catYears, describe, f1, f2, hbar, heat, history, mean, numbers, ols,
  pairs, plural, quantile, rows, scatterChart, short, std, table, tallH, boxTrace,
} from './core'

const lohi = (a: Args) => ({ lo: Math.min(a.year, a.year2), hi: Math.max(a.year, a.year2) })

/* ============================ 7. Transitions ============================ */
export function q71(a: Args): Res {
  const { lo, hi } = lohi(a)
  const A = byId(a.category, lo), B = byId(a.category, hi)
  const cut = a.cut
  const bandOf = (r?: { rank: number | null }) => (!r ? 2 : (r.rank as number) <= cut ? 0 : 1)
  const names = [`Top ${cut}`, `Ranked ${cut + 1}+`, 'Not ranked']
  const ids = new Set([...A.keys(), ...B.keys()])
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const moved: { id: string; from: number; to: number }[] = []
  ids.forEach((id) => {
    const f = bandOf(A.get(id)), t = bandOf(B.get(id))
    M[f][t]++
    if (f === 1 && t === 0) moved.push({ id, from: A.get(id)!.rank as number, to: B.get(id)!.rank as number })
  })
  const M2 = M.map((r) => r.slice())
  M2[2][2] = 0
  moved.sort((x, y) => x.to - y.to)
  return {
    answer: `${plural(moved.length, 'institution')} in ${a.category} moved from ranks ${cut + 1}+ in ${lo} into the top ${cut} in ${hi}. ${plural(M[0][1], 'institution')} moved the other way (top ${cut} → below), and ${M[0][0]} stayed in the top ${cut}.`,
    chips: [a.category, `${lo} → ${hi}`, `Band cut: ${cut}`],
    kpis: [{ label: `Moved up into top ${cut}`, value: String(moved.length) }, { label: `Dropped out of top ${cut}`, value: String(M[0][1]) }, { label: `Stayed in top ${cut}`, value: String(M[0][0]) }],
    charts: [{ title: `Band transitions, ${lo} → ${hi}`, data: [heat(M2, names.map((n) => `${hi}: ${n}`), names.map((n) => `${lo}: ${n}`), { fmt: (v) => String(v) })] as never, height: 340, layout: { yaxis: { autorange: 'reversed' } },
      why: 'A transition matrix: rows = band in the first year, columns = band in the second; the diagonal is “stayed”, the off-diagonal cells are movers. Darker teal = more institutions.' }],
    table: table([['i', 'Institution'], ['f', `Rank ${lo}`], ['t', `Rank ${hi}`]], moved.map((m) => ({ i: byId(a.category, hi).get(m.id)!.institution, f: m.from, t: m.to }))),
    facts: { moved: moved.length },
  }
}

export function q72(a: Args): Res {
  const { lo, hi } = lohi(a)
  let ps = pairs(a.category, lo, hi)
  if (!ps.length) { const ys = catYears(a.category); ps = pairs(a.category, ys[0], ys[ys.length - 1]) }
  const ev: { pair: string; type: string; inst: string; from: number | null; to: number | null }[] = []
  const stat = ps.map(([y0, y1]) => {
    const A = rows(a.category, y0).filter((r) => (r.rank as number) <= a.topN), B = rows(a.category, y1).filter((r) => (r.rank as number) <= a.topN)
    const ia = new Set(A.map((r) => r.institutionId)), ib = new Set(B.map((r) => r.institutionId))
    const ent = B.filter((r) => !ia.has(r.institutionId)), ex = A.filter((r) => !ib.has(r.institutionId))
    ent.forEach((r) => ev.push({ pair: `${y0}→${y1}`, type: 'Entered', inst: r.institution, from: byId(a.category, y0).get(r.institutionId)?.rank ?? null, to: r.rank }))
    ex.forEach((r) => ev.push({ pair: `${y0}→${y1}`, type: 'Exited', inst: r.institution, from: r.rank, to: byId(a.category, y1).get(r.institutionId)?.rank ?? null }))
    return { label: `${y0}→${y1}`, e: ent.length, x: ex.length, names: [ent.map((r) => r.institution), ex.map((r) => r.institution)] }
  })
  const last = stat[stat.length - 1]
  return {
    answer: last ? `Between ${last.label.replace('→', ' and ')}, ${plural(last.e, 'institution')} entered and ${last.x} exited the ${a.category} top ${a.topN}${last.e ? ` (entered: ${last.names[0].join(', ')})` : ''}${last.x ? ` (exited: ${last.names[1].join(', ')})` : ''}. The chart shows every consecutive pair in the selected range.` : 'No consecutive years to compare.',
    chips: [a.category, `Top ${a.topN}`, `${lo}–${hi}`],
    charts: [{ title: `Institutions entering and exiting the top ${a.topN}`, data: [
      { type: 'bar', name: 'Entered', x: stat.map((s) => s.label), y: stat.map((s) => s.e), marker: { color: BLUE }, text: stat.map((s) => String(s.e)), textposition: 'outside' } as never,
      { type: 'bar', name: 'Exited', x: stat.map((s) => s.label), y: stat.map((s) => s.x), marker: { color: ORANGE }, text: stat.map((s) => String(s.x)), textposition: 'outside' } as never],
      layout: { barmode: 'group' }, xTitle: 'Year pair', yTitle: 'Institutions', showLegend: true, yFromZero: true,
      why: 'Grouped bars compare two counts per year pair on a zero baseline; blue = entered, orange = exited (the same colours as improved/declined).' }],
    table: table([['pair', 'Years'], ['type', 'Movement'], ['inst', 'Institution'], ['from', 'Rank before'], ['to', 'Rank after']], ev),
    facts: { entered: last?.e ?? 0, exited: last?.x ?? 0 },
  }
}

export function q73(a: Args): Res {
  const ys = catYears(a.category)
  const ps = pairs(a.category, ys[0], ys[ys.length - 1])
  const size = Math.max(1, Math.round(a.bandSize))
  const stat = ps.map(([y0, y1]) => {
    const A = byId(a.category, y0), B = byId(a.category, y1)
    const both = [...A.keys()].filter((id) => B.has(id))
    const same = both.filter((id) => Math.ceil((A.get(id)!.rank as number) / size) === Math.ceil((B.get(id)!.rank as number) / size)).length
    return { label: `${y0}→${y1}`, p: both.length ? (100 * same) / both.length : NaN, same, both: both.length }
  })
  const avg = mean(stat.map((s) => s.p).filter(Number.isFinite))
  return {
    answer: `On average ${f1(avg)}% of institutions ranked in both years stayed in the same band of ${size} ranks (e.g. 1–${size}, ${size + 1}–${2 * size}) from one year to the next in ${a.category}. Highest: ${[...stat].sort((x, y) => y.p - x.p)[0]?.label} (${f1([...stat].sort((x, y) => y.p - x.p)[0]?.p)}%).`,
    chips: [a.category, `Bands of ${size}`, 'consecutive years'],
    charts: [{ title: `% of institutions staying in the same rank band (width ${size})`, data: [{ type: 'bar', x: stat.map((s) => s.label), y: stat.map((s) => s.p), marker: { color: TEAL }, text: stat.map((s) => f1(s.p) + '%'), textposition: 'outside', cliponaxis: false } as never],
      xTitle: 'Year pair', yTitle: '% in same band', yFromZero: true, layout: { yaxis: { range: [0, 105] } }, why: 'A percentage per year pair on a 0–100 axis: single-hue bars from zero. Only institutions ranked in both years are counted.' }],
    table: table([['l', 'Years'], ['b', 'Ranked in both'], ['s', 'Same band'], ['p', '%']], stat.map((s) => ({ l: s.label, b: s.both, s: s.same, p: +s.p.toFixed(1) }))),
  }
}

export function q74(a: Args): Res {
  const { lo, hi } = lohi(a)
  const A = byId(a.category, lo), B = byId(a.category, hi)
  const all = [...B.values()].filter((r) => A.has(r.institutionId)).map((r) => ({ r, d: (A.get(r.institutionId)!.rank as number) - (r.rank as number) }))
  const up = all.filter((x) => x.d > 0).sort((x, y) => y.d - x.d).slice(0, a.topN)
  const dn = all.filter((x) => x.d < 0).sort((x, y) => x.d - y.d).slice(0, a.topN)
  const comb = [...up, ...dn.slice().reverse()]
  return {
    answer: `Between ${lo} and ${hi}, the biggest rise was ${up[0]?.r.institution ?? '–'} (+${up[0]?.d ?? 0} places) and the biggest fall was ${dn[0]?.r.institution ?? '–'} (${dn[0]?.d ?? 0} places), among ${all.length} institutions ranked in both years.`,
    chips: [a.category, `${lo} → ${hi}`, `Top ${a.topN} each way`],
    charts: [{ title: `Largest upward and downward rank movements, ${lo} → ${hi}`, data: [{ type: 'bar', orientation: 'h', y: comb.map((x) => short(x.r.institution, 36)).reverse(), x: comb.map((x) => x.d).reverse(), marker: { color: comb.map((x) => (x.d > 0 ? BLUE : ORANGE)).reverse() }, text: comb.map((x) => (x.d > 0 ? '+' : '') + x.d).reverse(), textposition: 'outside', cliponaxis: false } as never],
      xTitle: 'Places moved (positive = improved)', height: tallH(comb.length), why: 'Signed movement → diverging bars around zero, blue up / orange down, biggest risers at the top and biggest fallers at the bottom.' }],
    table: table([['i', 'Institution'], ['f', `Rank ${lo}`], ['t', `Rank ${hi}`], ['d', 'Places moved']], comb.map((x) => ({ i: x.r.institution, f: A.get(x.r.institutionId)!.rank, t: x.r.rank, d: x.d }))),
    facts: { up: up[0]?.r.institution ?? '', down: dn[0]?.r.institution ?? '' },
  }
}

export function q75(a: Args): Res {
  const { lo, hi } = lohi(a)
  let ps = pairs(a.category, lo, hi)
  if (!ps.length) { const ys = catYears(a.category); ps = pairs(a.category, ys[0], ys[ys.length - 1]) }
  const st = ps.map(([y0, y1]) => {
    const A = byId(a.category, y0), B = byId(a.category, y1)
    let u = 0, d = 0, s = 0
    B.forEach((r, id) => { const o = A.get(id); if (!o) return; const m = (o.rank as number) - (r.rank as number); if (m > 0) u++; else if (m < 0) d++; else s++ })
    return { label: `${y0}→${y1}`, u, d, s }
  })
  const tot = st.reduce((p, c) => ({ u: p.u + c.u, d: p.d + c.d, s: p.s + c.s }), { u: 0, d: 0, s: 0 })
  return {
    answer: `Across ${plural(st.length, 'year pair')}, ${tot.u} institution-moves were upward, ${tot.d} downward and ${tot.s} unchanged (${a.category}). Only institutions ranked in both years of a pair are counted.`,
    chips: [a.category, `${lo}–${hi}`],
    charts: [{ title: 'Institutions that moved up, moved down or kept their rank', data: [
      { type: 'bar', name: 'Moved up', x: st.map((s) => s.label), y: st.map((s) => s.u), marker: { color: BLUE } } as never,
      { type: 'bar', name: 'Retained rank', x: st.map((s) => s.label), y: st.map((s) => s.s), marker: { color: GREY } } as never,
      { type: 'bar', name: 'Moved down', x: st.map((s) => s.label), y: st.map((s) => s.d), marker: { color: ORANGE } } as never],
      layout: { barmode: 'stack' }, xTitle: 'Year pair', yTitle: 'Institutions', showLegend: true, yFromZero: true, why: 'Stacked bars show how each year’s total splits into three outcomes; blue/grey/orange map to up/same/down.' }],
    table: table([['l', 'Years'], ['u', 'Up'], ['s', 'Same'], ['d', 'Down']], st.map((s) => ({ l: s.label, u: s.u, s: s.s, d: s.d }))),
  }
}

/* ============================ 8. Outliers ============================ */
export function q81(a: Args): Res {
  const k = a.param || 'RPC'
  const rs = rows(a.category, a.year).filter((r) => r.score != null && r.params[k as 'RPC'] != null)
  const xs = rs.map((r) => r.score as number), ys = rs.map((r) => r.params[k as 'RPC'] as number)
  const fit = ols(xs, ys)
  const res = ys.map((y, i) => y - (fit.intercept + fit.slope * xs[i]))
  const sd = std(res)
  const flag = rs.map((r, i) => ({ r, z: res[i] / sd })).filter((x) => x.z >= a.z).sort((x, y) => y.z - x.z)
  const pts = rs.map((r, i) => ({ x: xs[i], y: ys[i], label: `${r.institution} (z = ${f2(res[i] / sd)})`, flag: res[i] / sd >= a.z }))
  const sc = scatterChart(pts, 'score', k, true, `${PLABEL[k]} vs overall score with outliers, ${a.category} ${a.year}`, 'The trend line is what a typical institution’s research score looks like for its overall score; points far above it (orange) have unusually high research relative to overall.', { annotate: true })
  return {
    answer: `${plural(flag.length, 'institution')} in ${a.category} ${a.year} have a ${PLABEL[k]} score at least ${a.z} standard deviations above what their overall score predicts${flag.length ? `: ${flag.slice(0, 4).map((x) => x.r.institution).join(', ')}` : ''}.`,
    chips: [a.category, String(a.year), `z ≥ ${a.z}`],
    charts: [sc.ch], table: table([['i', 'Institution'], ['rank', 'Rank'], ['s', 'Overall score'], ['p', PLABEL[k]], ['z', 'Residual z']], flag.map((x) => ({ i: x.r.institution, rank: x.r.rank, s: x.r.score, p: x.r.params[k as 'RPC'], z: +x.z.toFixed(2) }))),
    facts: { n: flag.length },
  }
}

export function q82(a: Args): Res {
  const hiK = a.param || 'RPC', loK = a.param2 || 'TLR'
  const rs = rows(a.category, a.year).filter((r) => r.params[hiK as 'RPC'] != null && r.params[loK as 'RPC'] != null)
  const d = rs.map((r) => ({ r, d: (r.params[hiK as 'RPC'] as number) - (r.params[loK as 'RPC'] as number) })).sort((x, y) => y.d - x.d)
  const thr = mean(d.map((x) => x.d)) + a.z * std(d.map((x) => x.d))
  const flagged = d.filter((x) => x.d >= thr)
  const top = d.slice(0, a.topN)
  const pts = rs.map((r) => ({ x: r.params[loK as 'RPC'] as number, y: r.params[hiK as 'RPC'] as number, label: r.institution, flag: flagged.some((f) => f.r === r) }))
  const sc = scatterChart(pts, loK, hiK, false, `${PLABEL[hiK]} vs ${PLABEL[loK]}, ${a.category} ${a.year}`, 'Points above the diagonal do better on the y-axis parameter; the further above, the bigger the gap.', { annotate: true,
    shapes: [{ type: 'line', x0: 0, y0: 0, x1: 100, y1: 100, line: { color: '#6B7280', dash: 'dot', width: 1 } }] })
  return {
    answer: `${top[0]?.r.institution} has the largest ${PLABEL[hiK]} − ${PLABEL[loK]} gap (${f1(top[0]?.d)} points) in ${a.category} ${a.year}. ${plural(flagged.length, 'institution')} sit at least ${a.z} standard deviations above the typical gap (${f1(mean(d.map((x) => x.d)))}).`,
    chips: [a.category, String(a.year), `${PLABEL[hiK]} − ${PLABEL[loK]}`],
    charts: [{ title: `Largest gaps: ${PLABEL[hiK]} minus ${PLABEL[loK]}`, data: [hbar(top.map((x) => short(x.r.institution, 34)), top.map((x) => x.d), { color: BLUE, text: top.map((x) => f1(x.d)) })] as never, xTitle: `${PLABEL[hiK]} − ${PLABEL[loK]} (points)`, height: tallH(top.length), yFromZero: true,
      why: 'The difference between two parameters is one number per institution, so a sorted bar chart from zero.' }, sc.ch],
    table: table([['i', 'Institution'], ['rank', 'Rank'], ['a', PLABEL[hiK]], ['b', PLABEL[loK]], ['d', 'Gap']], d.slice(0, Math.max(a.topN, flagged.length)).map((x) => ({ i: x.r.institution, rank: x.r.rank, a: x.r.params[hiK as 'RPC'], b: x.r.params[loK as 'RPC'], d: +x.d.toFixed(2) }))),
    facts: { first: top[0]?.r.institution ?? '' },
  }
}

export function q83(a: Args): Res {
  const { lo, hi } = lohi(a)
  const ys = catYears(a.category)
  let ps = pairs(a.category, lo, hi)
  if (!ps.length) ps = pairs(a.category, ys[0], ys[ys.length - 1])
  const ch: { pair: string; inst: string; d: number }[] = []
  ps.forEach(([y0, y1]) => { const A = byId(a.category, y0), B = byId(a.category, y1); B.forEach((r, id) => { const o = A.get(id); if (o?.score != null && r.score != null) ch.push({ pair: `${y0}→${y1}`, inst: r.institution, d: r.score - o.score }) }) })
  const m = mean(ch.map((c) => c.d)), sd = std(ch.map((c) => c.d))
  const flagged = ch.map((c) => ({ ...c, z: (c.d - m) / sd })).filter((c) => Math.abs(c.z) >= a.z).sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
  const top = flagged.slice(0, a.topN)
  return {
    answer: `${plural(flagged.length, 'year-to-year change')} (out of ${ch.length}) are unusually large (|z| ≥ ${a.z}; typical change ${f2(m)} ± ${f2(sd)} points)${top[0] ? `. Largest: ${top[0].inst}, ${top[0].pair}, ${top[0].d >= 0 ? '+' : ''}${f1(top[0].d)} points` : ''}.`,
    chips: [a.category, `|z| ≥ ${a.z}`, `${ps.length} year pairs`],
    charts: [
      { title: 'Largest unusual score changes', data: [{ type: 'bar', orientation: 'h', y: top.map((x) => `${short(x.inst, 28)} (${x.pair})`).reverse(), x: top.map((x) => x.d).reverse(), marker: { color: top.map((x) => (x.d > 0 ? BLUE : ORANGE)).reverse() }, text: top.map((x) => (x.d > 0 ? '+' : '') + f1(x.d)).reverse(), textposition: 'outside', cliponaxis: false } as never], xTitle: 'Score change', height: tallH(top.length),
        why: 'Signed changes → diverging bars; only the flagged cases are shown so the outliers stand out.' },
      { title: 'Distribution of year-to-year score changes', data: ps.map(([y0, y1]) => boxTrace(`${y0}→${y1}`, ch.filter((c) => c.pair === `${y0}→${y1}`).map((c) => c.d), TEAL)) as never, yTitle: 'Score change', showLegend: false, why: 'Box plots per year pair show what a normal change looks like; dots beyond the whiskers are the outliers.' }],
    table: table([['inst', 'Institution'], ['pair', 'Years'], ['d', 'Score change'], ['z', 'z-score']], flagged.map((x) => ({ inst: x.inst, pair: x.pair, d: +x.d.toFixed(2), z: +x.z.toFixed(2) }))),
    facts: { n: flagged.length },
  }
}

export function q84(a: Args): Res {
  const k = a.param || 'RPC'
  const rs = rows(a.category, a.year).filter((r) => r.params[k as 'RPC'] != null)
  const vv = rs.map((r) => r.params[k as 'RPC'] as number).sort((x, y) => x - y)
  const sCut = quantile(vv, a.pctHigh / 100)
  const maxRank = Math.max(...rs.map((r) => r.rank as number))
  const rCut = a.cut > 0 && a.cut < maxRank ? a.cut : Math.floor(maxRank / 2)
  const flagged = rs.filter((r) => (r.params[k as 'RPC'] as number) >= sCut && (r.rank as number) > rCut)
  const pts = rs.map((r) => ({ x: r.params[k as 'RPC'] as number, y: r.rank as number, label: `${r.institution} (rank ${r.rank})`, flag: flagged.includes(r) }))
  const sc = scatterChart(pts, k, 'rank', false, `${PLABEL[k]} score vs overall rank, ${a.category} ${a.year}`, 'Rank on a reversed y-axis (better = higher); orange points have a strong parameter score but sit in the lower half of the ranking.', { annotate: true,
    shapes: [{ type: 'line', x0: sCut, x1: sCut, yref: 'paper', y0: 0, y1: 1, line: { color: '#6B7280', dash: 'dash', width: 1 } }, { type: 'line', y0: rCut, y1: rCut, xref: 'paper', x0: 0, x1: 1, line: { color: '#6B7280', dash: 'dash', width: 1 } }] })
  return {
    answer: `${plural(flagged.length, 'institution')} in ${a.category} ${a.year} score in the top ${100 - a.pctHigh}% on ${PLABEL[k]} (≥ ${f1(sCut)}) yet rank below ${rCut}${flagged.length ? `: ${flagged.slice(0, 4).map((r) => `${r.institution} (rank ${r.rank})`).join(', ')}` : ''}.`,
    chips: [a.category, String(a.year), `${PLABEL[k]} ≥ P${a.pctHigh}`, `rank > ${rCut}`],
    charts: [sc.ch], table: table([['i', 'Institution'], ['rank', 'Rank'], ['p', PLABEL[k]], ['s', 'Overall score']], flagged.sort((x, y) => (x.rank as number) - (y.rank as number)).map((r) => ({ i: r.institution, rank: r.rank, p: r.params[k as 'RPC'], s: r.score }))),
    facts: { n: flagged.length },
  }
}

export function q85(a: Args): Res {
  const ys = catYears(a.category)
  const ids = new Set<string>()
  ys.forEach((y) => rows(a.category, y).forEach((r) => ids.add(r.institutionId)))
  const items = [...ids].map((id) => {
    const h = history(a.category, id)
    const rk = [...h.values()].map((r) => r.rank as number)
    return { id, r: [...h.values()].pop()!, n: rk.length, sd: std(rk), mean: mean(rk) }
  }).filter((x) => x.n >= Math.max(3, a.minYears) && Number.isFinite(x.sd))
  const sorted = items.slice().sort((x, y) => x.mean - y.mean)
  const k = 4
  sorted.forEach((x, i) => ((x as never as { g: number }).g = Math.min(k - 1, Math.floor((i * k) / sorted.length))))
  const grp = (x: typeof items[number]) => (x as never as { g: number }).g
  const stats = Array.from({ length: k }, (_, g) => { const v = sorted.filter((x) => grp(x) === g).map((x) => x.sd); return { m: mean(v), s: std(v) } })
  const scored = sorted.map((x) => ({ ...x, z: (x.sd - stats[grp(x)].m) / stats[grp(x)].s })).filter((x) => Number.isFinite(x.z))
  const flagged = scored.filter((x) => x.z >= a.z).sort((x, y) => y.z - x.z)
  const pts = scored.map((x) => ({ x: x.mean, y: x.sd, label: `${x.r.institution} (z = ${f2(x.z)})`, flag: x.z >= a.z }))
  const sc = scatterChart(pts, 'rank', 'rank', false, 'Rank volatility vs average rank', 'Volatility = standard deviation of an institution’s rank over the years. Peers are the quarter of institutions with a similar average rank; orange points are unusually volatile for their peer group.', { annotate: true })
  sc.ch.xTitle = 'Average rank (lower = better)'
  sc.ch.yTitle = 'Rank volatility (std dev of rank, places)'
  sc.ch.reverseY = false
  return {
    answer: `${plural(flagged.length, 'institution')} in ${a.category} have unusually high rank volatility compared with peers of similar average rank (z ≥ ${a.z}, at least ${Math.max(3, a.minYears)} years ranked)${flagged.length ? `: ${flagged.slice(0, 4).map((x) => `${x.r.institution} (σ = ${f1(x.sd)})`).join(', ')}` : ''}.`,
    chips: [a.category, `z ≥ ${a.z}`, '4 peer groups by average rank'],
    charts: [sc.ch], table: table([['i', 'Institution'], ['n', 'Years ranked'], ['m', 'Average rank'], ['s', 'Rank std dev'], ['z', 'z vs peers']], flagged.map((x) => ({ i: x.r.institution, n: x.n, m: +x.mean.toFixed(1), s: +x.sd.toFixed(1), z: +x.z.toFixed(2) }))),
    facts: { n: flagged.length },
  }
}
void PK; void describe; void numbers
