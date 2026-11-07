import type { Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import type { ChartSpec } from '../../types'
import { PlotChart } from './PlotChart'
import type { PlotChartProps } from './PlotChart'

const shorten = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Pure mapping from a structured ChartSpec to Plotly traces. */
export function specToPlot(spec: ChartSpec): { data: Data[]; layout: Partial<Layout>; legend: boolean } {
  const multi = spec.series.length > 1
  const layout: Partial<Layout> = {}
  let data: Data[] = []

  switch (spec.type) {
    case 'bar':
      data = spec.series.map((s) => ({
        type: 'bar',
        name: s.name,
        x: s.x,
        y: s.y,
        marker: s.color ? { color: s.color } : undefined,
        hovertemplate: `%{x}<br>${s.name}: %{y}<extra></extra>`,
      }))
      layout.barmode = spec.stacked ? 'stack' : 'group'
      break
    case 'line':
    case 'area':
      data = spec.series.map((s) => ({
        type: 'scatter',
        mode: 'lines+markers',
        name: s.name,
        x: s.x,
        y: s.y,
        connectgaps: false,
        line: { width: 2, dash: s.dash ? 'dash' : 'solid', color: s.color },
        marker: { size: 5, color: s.color },
        fill: spec.type === 'area' ? 'tozeroy' : undefined,
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
        marker: { size: 7, opacity: 0.75 },
        hovertemplate: `%{text}<br>${spec.xTitle ?? 'x'}: %{x}<br>${spec.yTitle ?? 'y'}: %{y}<extra></extra>`,
      }))
      break
    case 'box':
      data = spec.series.map((s) => ({
        type: 'box',
        name: s.name,
        y: s.y,
        boxpoints: 'outliers',
        marker: { size: 4 },
        hovertemplate: `${s.name}<br>%{y}<extra></extra>`,
      }))
      break
    case 'histogram':
      data = spec.series.map((s) => ({
        type: 'histogram',
        name: s.name,
        x: s.x as number[],
        opacity: multi ? 0.65 : 0.9,
        hovertemplate: `${s.name}<br>%{x}: %{y} records<extra></extra>`,
      }))
      layout.barmode = 'overlay'
      layout.bargap = 0.04
      break
    case 'heatmap': {
      const s = spec.series[0]
      data = [
        {
          type: 'heatmap',
          x: s?.x,
          y: s?.yLabels,
          z: s?.z,
          colorscale: 'Blues',
          hoverongaps: false,
          colorbar: { title: { text: s?.name ?? '' }, thickness: 12 },
          hovertemplate: `${spec.xTitle ?? 'x'}: %{x}<br>${spec.yTitle ?? 'y'}: %{y}<br>${s?.name ?? 'value'}: %{z}<extra></extra>`,
        },
      ]
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

  if ((spec.type === 'bar' || spec.type === 'box') && spec.type !== undefined) {
    const labels = spec.type === 'bar'
      ? [...new Set(spec.series.flatMap((s) => (s.x ?? []).map(String)))]
      : []
    if (labels.some((l) => l.length > 22)) {
      layout.xaxis = { tickmode: 'array', tickvals: labels, ticktext: labels.map((l) => shorten(l)), tickangle: -35, automargin: true }
    }
  }

  const legend = spec.type === 'pie' || spec.type === 'donut' ? true : multi && spec.type !== 'heatmap'
  return { data, layout, legend }
}

export function SpecChart({
  spec,
  height,
  ...rest
}: { spec: ChartSpec; height?: number } & Partial<Omit<PlotChartProps, 'data' | 'title' | 'height'>>) {
  const plot = useMemo(() => specToPlot(spec), [spec])
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
      xTitle={spec.type === 'pie' || spec.type === 'donut' ? undefined : spec.xTitle}
      yTitle={spec.type === 'pie' || spec.type === 'donut' ? undefined : spec.yTitle}
      showLegend={plot.legend}
      reverseY={spec.reverseY}
      yFromZero={spec.yFromZero}
      legendRows={legendRows}
      layout={plot.layout}
      height={(height ?? 340) + (plot.legend ? (legendRows - 1) * 20 : 0)}
      empty={noData}
      {...rest}
    />
  )
}
