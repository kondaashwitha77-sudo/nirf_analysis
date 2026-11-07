import Plotly from 'plotly.js-basic-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { Data, Layout } from 'plotly.js'

const PlotlyComponent = createPlotlyComponent(Plotly)

export default function Plot({ data, layout, height = 380 }: { data: Data[]; layout?: Partial<Layout>; height?: number }) {
  return (
    <PlotlyComponent
      data={data}
      layout={{ autosize: true, height, margin: { t: 30, r: 20, b: 50, l: 60 }, paper_bgcolor: 'rgba(0,0,0,0)', legend: { orientation: 'h', y: -0.2 }, ...layout }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
      useResizeHandler
    />
  )
}
