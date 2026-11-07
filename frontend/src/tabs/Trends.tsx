import { useEffect, useState } from 'react'
import { api, type Meta, type Row } from '../api'
import Picker from '../Picker'
import Plot from '../Plot'
import { Card, Select } from '../ui'

// Default selection: IIT Madras, IISc, IIT Delhi (looked up by name so ids are never hard-coded)
const DEFAULT_NAMES = ['Indian Institute of Technology Madras', 'Indian Institute of Science', 'Indian Institute of Technology Delhi']

export default function Trends({ meta }: { meta: Meta }) {
  const [ids, setIds] = useState<string[]>(() => DEFAULT_NAMES.map(n => meta.institutions.find(i => i.name === n)?.id).filter(Boolean) as string[])
  const [category, setCategory] = useState('Overall')
  const [metric, setMetric] = useState<'rank_base' | 'score'>('rank_base')
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => { ids.length ? api.trend(ids, category).then(setRows) : setRows([]) }, [ids, category])

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <Select label="Category" value={category} onChange={setCategory} options={meta.categories.map(c => ({ value: c.name, label: c.name }))} />
          <Select label="Metric" value={metric} onChange={v => setMetric(v as 'rank_base' | 'score')} options={[{ value: 'rank_base', label: 'Rank (lower is better)' }, { value: 'score', label: 'Score' }]} />
        </div>
        <Picker meta={meta} selected={ids} onChange={setIds} />
      </Card>
      <Card title={metric === 'rank_base' ? 'Rank over time' : 'Score over time'}>
        <Plot data={ids.map(id => {
          const r = rows.filter(x => x.institution_id === id)
          return { type: 'scatter', mode: 'lines+markers', name: meta.institutions.find(i => i.id === id)?.name, x: r.map(x => x.year), y: r.map(x => x[metric]) }
        })} layout={{ xaxis: { dtick: 1, title: { text: 'Year' } }, yaxis: { autorange: metric === 'rank_base' ? 'reversed' : true, title: { text: metric === 'rank_base' ? 'Rank' : 'Score' } } }} height={420} />
        {ids.length > 0 && rows.length === 0 && <p className="text-sm text-slate-500">No data in this category for the selected institutions.</p>}
      </Card>
    </div>
  )
}
