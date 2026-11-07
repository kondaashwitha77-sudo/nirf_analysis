import { useEffect, useState } from 'react'
import { api, type Meta, type Row } from '../api'
import Picker from '../Picker'
import Plot from '../Plot'
import { Card, Select } from '../ui'

const PARAMS = ['TLR', 'RPC', 'GO', 'OI', 'PERCEPTION'] as const

export default function Compare({ meta }: { meta: Meta }) {
  const [ids, setIds] = useState<string[]>(() => ['Indian Institute of Technology Madras', 'Indian Institute of Technology Bombay'].map(n => meta.institutions.find(i => i.name === n)?.id).filter(Boolean) as string[])
  const [year, setYear] = useState(meta.years[meta.years.length - 1])
  const [category, setCategory] = useState('Overall')
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => { ids.length ? api.compare(ids, year, category).then(setRows) : setRows([]) }, [ids, year, category])
  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <Select label="Year" value={year} onChange={v => setYear(+v)} options={meta.years.map(y => ({ value: y, label: String(y) }))} />
          <Select label="Category" value={category} onChange={setCategory} options={meta.categories.map(c => ({ value: c.name, label: c.name }))} />
        </div>
        <Picker meta={meta} selected={ids} onChange={setIds} />
      </Card>
      <Card title="Parameter scores (TLR, RPC, GO, OI, PERCEPTION)">
        <Plot data={rows.map(r => ({ type: 'bar', name: `${r.institution_name} (#${r.rank_base})`, x: [...PARAMS], y: PARAMS.map(p => r[p]) }))}
          layout={{ barmode: 'group', yaxis: { range: [0, 100] } }} height={420} />
        {ids.length > 0 && rows.length === 0 && <p className="text-sm text-slate-500">None of the selected institutions are ranked in {category} {year}.</p>}
      </Card>
    </div>
  )
}
