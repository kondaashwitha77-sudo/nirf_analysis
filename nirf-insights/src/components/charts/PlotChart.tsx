import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-dist-min'
import type { Config, Data, Layout } from 'plotly.js-dist-min'
import { useMemo } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../ui/States'

// react-plotly.js ships CJS + ESM builds; normalise the factory default export.
const factory = ((createPlotlyComponent as unknown as { default?: typeof createPlotlyComponent }).default ??
  createPlotlyComponent) as typeof createPlotlyComponent
const Plot = factory(Plotly)

export const COLORWAY = ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#0EA5E9', '#64748B', '#EC4899', '#14B8A6', '#F97316']

export interface PlotChartProps {
  data: Data[]
  /** Used as the accessible name and the export filename. Visible titles are rendered by ChartCard. */
  title: string
  xTitle?: string
  yTitle?: string
  showLegend?: boolean
  reverseY?: boolean
  yFromZero?: boolean
  /** estimated rows taken by a horizontal legend; reserves bottom space */
  legendRows?: number
  height?: number
  layout?: Partial<Layout>
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: boolean
  emptyMessage?: string
}

/** Thin Plotly wrapper: structured props in, responsive chart out. No business logic. */
export function PlotChart({
  data,
  title,
  xTitle,
  yTitle,
  showLegend = false,
  reverseY = false,
  yFromZero = false,
  legendRows = 1,
  height = 340,
  layout,
  loading,
  error,
  onRetry,
  empty,
  emptyMessage,
}: PlotChartProps) {
  const merged = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      margin: { l: 56, r: 16, t: 12, b: showLegend ? 56 + legendRows * 20 : 48 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#0F172A' },
      colorway: COLORWAY,
      hovermode: 'closest',
      hoverlabel: { bgcolor: '#172554', font: { color: '#FFFFFF', size: 12 }, bordercolor: '#172554' },
      showlegend: showLegend,
      legend: { orientation: 'h', yref: 'container', y: 0, yanchor: 'bottom', x: 0, xanchor: 'left', font: { size: 11 } },
      yaxis: {
        title: { text: yTitle },
        automargin: true,
        gridcolor: '#E2E8F0',
        linecolor: '#CBD5E1',
        zeroline: false,
        autorange: reverseY ? 'reversed' : true,
        rangemode: yFromZero ? 'tozero' : 'normal',
      },
      ...layout,
      // merge per axis so overrides (e.g. shortened tick labels) keep titles and grid styling
      xaxis: { title: { text: xTitle }, automargin: true, gridcolor: '#E2E8F0', linecolor: '#CBD5E1', zeroline: false, ...layout?.xaxis },
    }),
    [xTitle, yTitle, showLegend, reverseY, yFromZero, legendRows, layout],
  )

  const config = useMemo<Partial<Config>>(
    () => ({
      displaylogo: false,
      responsive: true,
      displayModeBar: 'hover',
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: { filename: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), format: 'png' },
    }),
    [title],
  )

  const box = { minHeight: height }
  if (loading) return <div style={box} className="flex items-center justify-center"><LoadingState label="Loading chart…" /></div>
  if (error) return <div style={box} className="flex items-center justify-center"><ErrorState message={error} onRetry={onRetry} /></div>
  if (empty || !data.length) return <div style={box} className="flex items-center justify-center"><EmptyState message={emptyMessage} /></div>

  return (
    <div role="img" aria-label={title}>
      <Plot data={data} layout={merged} config={config} useResizeHandler style={{ width: '100%', height }} />
    </div>
  )
}
