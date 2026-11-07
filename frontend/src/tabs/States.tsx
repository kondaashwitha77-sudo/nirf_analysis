import { useEffect, useState } from 'react'
import { api, type Meta } from '../api'
import Plot from '../Plot'
import { Card, Select } from '../ui'

export default function States({ meta }: { meta: Meta }) {
  const [year, setYear] = useState(meta.years[meta.years.length - 1])
  const [category, setCategory] = useState('Overall')
  const [top, setTop] = useState(100)
  const [data, setData] = useState<{ state: string; count: number; avg_score: number }[]>([])
  useEffect(() => { api.states(year, category, top).then(setData) }, [year, category, top])
  const cats = meta.categories.filter(c => year >= c.min_year && year <= c.max_year)
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3">
          <Select label="Year" value={year} onChange={v => setYear(+v)} options={meta.years.map(y => ({ value: y, label: String(y) }))} />
          <Select label="Category" value={category} onChange={setCategory} options={cats.map(c => ({ value: c.name, label: c.name }))} />
          <Select label="Top N" value={top} onChange={v => setTop(+v)} options={[10, 25, 50, 100, 200].map(n => ({ value: n, label: `Top ${n}` }))} />
        </div>
      </Card>
      <Card title={`Institutions in the top ${top} by state (${year}, ${category})`}>
        <Plot data={[{ type: 'bar', x: data.map(d => d.state), y: data.map(d => d.count), marker: { color: '#0d9488' }, customdata: data.map(d => d.avg_score) as never, hovertemplate: '%{x}<br>%{y} institutions<br>avg score %{customdata}<extra></extra>' }]}
          layout={{ xaxis: { tickangle: -40 }, yaxis: { title: { text: 'Institutions' } }, margin: { b: 130, l: 60, t: 10, r: 10 } }} height={440} />
      </Card>
    </div>
  )
}
