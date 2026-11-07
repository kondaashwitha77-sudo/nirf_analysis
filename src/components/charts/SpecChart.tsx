import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { ChartSeries, ChartSpec } from '../../types'
import { DIV_SCALE, SEQ_SCALE } from '../../data/mock/constants'
import { wrapLabel } from '../../lib/chartData'
import { orderIndices } from '../../lib/order'
import { COLORWAY, PlotChart } from './PlotChart'
import type { PlotChartProps } from './PlotChart'

const shorten = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export { wrapLabel }

/** Names each line at its end point, spreading labels apart with thin leader lines so none overlap. */
function endLabelLayout(series: ChartSeries[], height: number): Partial<Layout> {
  const values = series.flatMap((s) => s.y ?? []).filter((v): v is number => v !== null)
  if (!values.length) return {}
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max(1, (hi - lo) * 0.05)
  const top = Math.max(lo - pad, 0.5)
  const plotHeight = height - 76
  const pxPerUnit = plotHeight / (hi + pad - top)

  const ends = series
    .map((s, i) => {
      const text = wrapLabel(s.name)
      return { s, text, h: text.split('<br>').length * 12 + 3, color: s.color ?? COLORWAY[i % COLORWAY.length], y: s.y?.[s.y.length - 1] ?? null }
    })
    .filter((e): e is typeof e & { y: number } => e.y !== null)
    .sort((a, b) => a.y - b.y)
  const wanted = ends.map((e) => (e.y - top) * pxPerUnit)
  const placed = [...wanted]
  for (let i = 1; i < placed.length; i++) placed[i] = Math.max(placed[i], placed[i - 1] + (ends[i - 1].h + ends[i].h) / 2)
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i] = Math.min(placed[i], i === placed.length - 1 ? plotHeight - ends[i].h / 2 : placed[i + 1] - (ends[i].h + ends[i + 1].h) / 2)
  }

  return {
    margin: { l: 56, r: 150, t: 12, b: 48 },
    yaxis: { autorange: false, range: [hi + pad, top], ...(hi - lo <= 10 ? { dtick: 1 } : {}) },
    annotations: ends.map((e, i) => ({
      x: e.s.x?.[(e.s.x?.length ?? 1) - 1],
      y: e.y,
      text: e.text,
      font: { size: 10 },
      align: 'left',
      xanchor: 'left',
      yanchor: 'middle',
      showarrow: true,
      arrowhead: 0,
      arrowwidth: 1,
      arrowcolor: e.color,
      ax: 16,
      ay: placed[i] - wanted[i],
    })),
  } as Partial<Layout>
}

function sortedSeries(spec: ChartSpec): ChartSeries[] {
  if (!spec.sortDesc || spec.series.length !== 1) return spec.series
  const s = spec.series[0]
  const idx = orderIndices('', (s.x ?? []).map(String), 'value_desc', s.y)
  return [{
    ...s,
    x: idx.map((i) => (s.x ?? [])[i]),
    y: idx.map((i) => (s.y ?? [])[i] ?? null),
    colors: s.colors ? idx.map((i) => s.colors![i]) : undefined,
    text: s.text ? idx.map((i) => s.text![i]) : undefined,
  }]
}

/** Pure mapping from a structured ChartSpec to Plotly traces. */
export function specToPlot(spec: ChartSpec, height = 340): { data: Data[]; layout: Partial<Layout>; legend: boolean } {
  const multi = spec.series.length > 1
  const layout: Partial<Layout> = {}
  let data: Data[] = []
  const series = sortedSeries(spec)
  const horizontal = !!spec.horizontal

  switch (spec.type) {
    case 'bar':
      data = series.map((s) => ({
        type: 'bar',
        name: s.name,
        orientation: horizontal ? 'h' : 'v',
        x: horizontal ? s.y : s.x,
        y: horizontal ? s.x : s.y,
        // Plotly crashes on a `marker` key that is present but undefined, so leave it out entirely.
        ...(s.colors ? { marker: { color: s.colors } } : s.color ? { marker: { color: s.color } } : {}),
        ...(spec.showValues ? { text: s.text ?? (s.y ?? []).map((v) => (v === null ? '' : String(v))), textposition: 'outside', cliponaxis: false } : {}),
        hovertemplate: horizontal ? `%{y}<br>${s.name}: %{x}<extra></extra>` : `%{x}<br>${s.name}: %{y}<extra></extra>`,
      }))
      layout.barmode = spec.stacked ? 'stack' : 'group'
      break
    case 'dot':
      // Dot plot (lollipop): position is the most accurate visual encoding (Cleveland & McGill).
      data = series.map((s) => ({
        type: 'scatter',
        mode: 'markers',
        name: s.name,
        x: s.y,
        y: s.x,
        marker: { size: 11, color: s.colors ?? s.color },
        error_x: {
          type: 'data',
          symmetric: false,
          array: (s.y ?? []).map(() => 0),
          arrayminus: (s.y ?? []).map((v) => (v === null ? 0 : v)),
          thickness: 1.5,
          width: 0,
          color: '#CBD5E1',
        },
        hovertemplate: `%{y}<br>${s.name}: %{x}<extra></extra>`,
      }))
      break
    case 'ecdf':
      data = spec.series.map((s) => {
        const xs = ((s.x ?? []) as number[]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
        return {
          type: 'scatter',
          mode: 'lines',
          name: s.name,
          x: xs,
          y: xs.map((_, i) => (i + 1) / xs.length),
          line: { shape: 'hv', width: 2, color: s.color },
          hovertemplate: `%{x}: %{y:.0%} at or below<extra>${s.name}</extra>`,
        } as Data
      })
      layout.yaxis = { tickformat: '.0%', range: [0, 1.02] }
      break
    case 'line':
    case 'area':
      data = spec.series.map((s) => ({
        type: 'scatter',
        // Dense series read better as plain lines; the trend matters more than each dot.
        mode: (s.x?.length ?? 0) > 24 ? 'lines' : 'lines+markers',
        name: s.name,
        x: s.x,
        y: s.y,
        connectgaps: false,
        line: { width: 2, dash: s.dash ? 'dash' : 'solid', color: s.color },
        marker: { size: 5, color: s.color },
        ...(spec.type === 'area' ? (spec.stacked ? { stackgroup: 'one' } : { fill: 'tozeroy' as const }) : {}),
        hovertemplate: `${s.name}<br>%{x}: %{y}<extra></extra>`,
      }))
      break
    case 'scatter':
      data = spec.series.map((s) => ({
        type: 'scatter',
        mode: 'markers',
        name: s.name,
        x: s.x,
        y: s.y,
        text: s.text,
        marker: { size: 7, opacity: 0.6 },
        hovertemplate: `%{text}<br>${spec.xTitle ?? 'x'}: %{x}<br>${spec.yTitle ?? 'y'}: %{y}<extra></extra>`,
      }))
      break
    case 'box':
      data = spec.series.map((s) => ({
        type: 'box',
        name: s.name,
        ...(s.x ? { x: s.x } : {}),
        y: s.y,
        // one colour for every box: the group names are already on the axis (fewer colours, L6)
        ...(s.x ? {} : { line: { color: '#0F5257', width: 1.5 }, fillcolor: 'rgba(14,124,134,0.28)' }),
        boxpoints: spec.showPoints ? 'all' : 'outliers',
        jitter: 0.3,
        pointpos: 0,
        marker: { size: 4, opacity: 0.5, ...(s.x ? {} : { color: '#0E7C86' }) },
        hovertemplate: `${s.name}<br>%{y}<extra></extra>`,
      })) as Data[]
      if (spec.series.some((s) => s.x)) (layout as { boxmode?: string }).boxmode = 'group'
      if (spec.xCategoryOrder) layout.xaxis = { type: 'category', categoryorder: 'array', categoryarray: spec.xCategoryOrder, automargin: true }
      break
    case 'histogram': {
      // Every group shares the same bin edges, so overlaid bars line up.
      const allValues = spec.series.flatMap((s) => (s.x ?? []) as number[])
      const binStart = spec.binSize && allValues.length ? Math.floor(Math.min(...allValues) / spec.binSize) * spec.binSize : undefined
      data = spec.series.map((s) => ({
        type: 'histogram',
        name: s.name,
        x: s.x as number[],
        opacity: multi ? 0.6 : 0.9,
        xbins: spec.binSize ? { size: spec.binSize, start: binStart } : undefined,
        hovertemplate: `${s.name}<br>%{x}: %{y} records<extra></extra>`,
      }))
      layout.barmode = 'overlay'
      layout.bargap = 0.04
      break
    }
    case 'heatmap': {
      const s = spec.series[0]
      data = [
        {
          type: 'heatmap',
          x: s?.x,
          y: s?.yLabels,
          z: s?.z,
          colorscale: spec.diverging ? DIV_SCALE : SEQ_SCALE,
          ...(spec.reverseScale ? { reversescale: true } : {}),
          ...(spec.diverging ? { zmin: -1, zmax: 1, zmid: 0 } : {}),
          ...(spec.showValues
            ? { texttemplate: spec.diverging ? '%{z:.2f}' : '%{z}', textfont: { size: 11 } }
            : {}),
          hoverongaps: !!spec.readableGrid,
          ...(spec.readableGrid ? { text: s?.z?.map((row) => row.map((v) => (v === null ? 'no data' : String(v)))) } : {}),
          xgap: 1,
          ygap: 1,
          colorbar: { title: { text: s?.name ?? '' }, thickness: 12 },
          hovertemplate: `${spec.xTitle ?? 'x'}: %{x}<br>${spec.yTitle ?? 'y'}: %{y}<br>${s?.name ?? 'value'}: ${spec.readableGrid ? '%{text}' : '%{z}'}<extra></extra>`,
        } as Data,
      ]
      if (spec.readableGrid) {
        layout.plot_bgcolor = '#E2E8F0'
        layout.yaxis = { autorange: 'reversed', type: 'category', automargin: true }
        layout.xaxis = { type: 'category', automargin: true }
      }
      break
    }
    case 'pie':
    case 'donut': {
      const s = spec.series[0]
      data = [
        {
          type: 'pie',
          labels: s?.labels,
          values: s?.values,
          hole: spec.type === 'donut' ? 0.55 : 0,
          sort: false,
          textinfo: 'label+percent',
          hovertemplate: '%{label}<br>%{value} (%{percent})<extra></extra>',
        },
      ]
      layout.margin = { l: 16, r: 16, t: 12, b: 16 }
      break
    }
  }

  if (horizontal && (spec.type === 'bar' || spec.type === 'dot')) {
    // first item at the top, so a sorted list reads top-down; bars start at zero
    layout.yaxis = { autorange: 'reversed', automargin: true, ...(spec.type === 'dot' ? { gridcolor: '#EEF2F1' } : {}) }
    const hasNegative = series.some((s) => s.y?.some((v) => v !== null && v < 0))
    const barValues = series.flatMap((s) => s.y ?? []).filter((v): v is number => v !== null)
    const room = (Math.max(0, ...barValues) - Math.min(0, ...barValues)) * 0.3
    layout.xaxis = {
      rangemode: 'tozero',
      automargin: true,
      ...(hasNegative ? { zeroline: true, zerolinecolor: '#64748B', zerolinewidth: 1 } : {}),
      ...(spec.showValues && barValues.length ? { range: [Math.min(0, ...barValues) - (hasNegative ? room : 0), Math.max(0, ...barValues) + room] } : {}),
    }
    layout.margin = { l: 8, r: 16, t: 12, b: 48 }
  } else if (spec.type === 'box' && series.length > 5 && !spec.xCategoryOrder) {
    const names = series.map((s) => s.name)
    layout.xaxis = { tickmode: 'array', tickvals: names, ticktext: names.map((n) => shorten(n, 16)), tickangle: -35, automargin: true }
  } else if (spec.type === 'bar' || spec.type === 'box') {
    const labels = spec.type === 'bar'
      ? [...new Set(series.flatMap((s) => (s.x ?? []).map(String)))]
      : []
    if (labels.some((l) => l.length > 22)) {
      layout.xaxis = { tickmode: 'array', tickvals: labels, ticktext: labels.map((l) => shorten(l)), tickangle: -35, automargin: true }
    }
  }

  // Year labels are categories on a bar or dot chart, never 2017.5, and categories keep the order given.
  if (spec.type === 'bar' || spec.type === 'dot') {
    if (horizontal) layout.yaxis = { ...layout.yaxis, type: 'category' }
    else layout.xaxis = { ...layout.xaxis, type: 'category' }
  }
  // Headroom so the tallest bar's outside label is never at the plot edge.
  if (spec.type === 'bar' && !horizontal && spec.showValues && !spec.reverseY && !spec.stacked) {
    const values = series.flatMap((s) => s.y ?? []).filter((v): v is number => v !== null)
    const hi = Math.max(0, ...values)
    const lo = Math.min(0, ...values)
    const room = (hi - lo) * 0.12
    if (hi > lo) layout.yaxis = { ...layout.yaxis, autorange: false, range: [lo < 0 ? lo - room : 0, hi + room] }
  }
  if (spec.refLines?.length) {
    layout.shapes = spec.refLines.map((l) => ({ type: 'line', xref: 'x', yref: 'paper', x0: l.x, x1: l.x, y0: 0, y1: 1, line: { color: l.color, width: 2, dash: 'dash' } }))
    // The smaller value's label sits to the left and the larger one's to the right, so they never collide.
    const lowest = Math.min(...spec.refLines.map((l) => l.x))
    layout.annotations = spec.refLines.map((l) => ({ x: l.x, y: 1, xref: 'x', yref: 'paper', text: l.label, showarrow: false, xanchor: l.x === lowest ? 'right' : 'left', yanchor: 'bottom', font: { size: 11, color: l.color } }))
    layout.margin = { l: 56, r: 16, t: 28, b: 48 }
  }

  if ((spec.type === 'line' || spec.type === 'area') && spec.xTickValues?.length) {
    const ticks = spec.xTickValues
    const lo = Math.min(...ticks)
    const hi = Math.max(...ticks)
    const pad = (hi - lo) * 0.06 || 1
    layout.xaxis = { tickmode: 'array', tickvals: ticks, ticktext: ticks.map(String), range: [lo - pad, hi + pad] }
  }
  if (spec.type === 'line' && spec.rankAxis) {
    const ranks = spec.series.flatMap((s) => s.y ?? []).filter((v): v is number => v !== null)
    if (ranks.length) {
      const lo = Math.min(...ranks)
      const hi = Math.max(...ranks)
      const pad = Math.max(0.5, (hi - lo) * 0.06)
      layout.yaxis = { autorange: false, range: [hi + pad, Math.max(lo - pad, 0.5)], ...(hi - lo <= 10 ? { dtick: 1 } : {}) }
    }
  }
  if (spec.yRange) layout.yaxis = { autorange: false, range: spec.yRange }
  if (spec.type === 'line' && spec.endLabels && spec.reverseY) Object.assign(layout, endLabelLayout(spec.series, height))

  const legend = spec.type === 'pie' || spec.type === 'donut' ? true : multi && spec.type !== 'heatmap' && (spec.type !== 'box' || spec.series.some((s) => s.x)) && !spec.endLabels
  return { data, layout, legend }
}

export function SpecChart({
  spec,
  height,
  ...rest
}: { spec: ChartSpec; height?: number } & Partial<Omit<PlotChartProps, 'data' | 'title' | 'height'>>) {
  const plot = useMemo(() => specToPlot(spec, height), [spec, height])
  // Rough legend height so long series names never overlap the axis.
  const legendRows = useMemo(() => {
    const px = spec.series.reduce((a, s) => a + Math.min(s.name.length, 40) * 6.4 + 38, 0)
    return Math.min(8, Math.max(1, Math.ceil(px / 520)))
  }, [spec])
  const noData = spec.series.every(
    (s) =>
      !(s.x?.length || s.y?.length || s.values?.length || s.z?.length),
  )
  return (
    <PlotChart
      data={plot.data}
      title={spec.title}
      xTitle={spec.type === 'pie' || spec.type === 'donut' ? undefined : spec.horizontal && (spec.type === 'bar' || spec.type === 'dot') ? spec.yTitle : spec.xTitle}
      yTitle={spec.type === 'pie' || spec.type === 'donut' ? undefined : spec.horizontal && (spec.type === 'bar' || spec.type === 'dot') ? undefined : spec.yTitle}
      showLegend={plot.legend}
      reverseY={spec.reverseY && !spec.horizontal}
      yFromZero={spec.yFromZero || (spec.type === 'bar' && !spec.horizontal)}
      legendRows={legendRows}
      layout={plot.layout}
      height={(height ?? 340) + (plot.legend ? (legendRows - 1) * 20 : 0)}
      empty={noData}
      {...rest}
    />
  )
}
