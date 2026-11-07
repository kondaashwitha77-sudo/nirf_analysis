import { useEffect, useState } from 'react'
import { api, type Meta, type Row } from '../api'
import Plot from '../Plot'
import { Card, Loading, Select } from '../ui'

export default function Rankings({ meta }: { meta: Meta }) {
  const [year, setYear] = useState(meta.years[meta.years.length - 1])
  const [category, setCategory] = useState('Overall')
  const [state, setState] = useState('')
  const [band, setBand] = useState('1-50')
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    const [lo, hi] = band.split('-').map(Number)
    setRows(null)
    api.rankings({ year, category, state: state || undefined, min_rank: lo, max_rank: hi }).then(setRows)
  }, [year, category, state, band])

  const cats = meta.categories.filter(c => year >= c.min_year && year <= c.max_year)
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-3">
          <Select label="Year" value={year} onChange={v => setYear(+v)} options={meta.years.map(y => ({ value: y, label: String(y) }))} />
          <Select label="Category" value={category} onChange={setCategory} options={cats.map(c => ({ value: c.name, label: c.name }))} />
          <Select label="State" value={state} onChange={setState} options={[{ value: '', label: 'All states' }, ...meta.states.map(s => ({ value: s, label: s }))]} />
          <Select label="Rank band" value={band} onChange={setBand} options={['1-10', '1-25', '1-50', '51-100', '101-200'].map(b => ({ value: b, label: b }))} />
        </div>
      </Card>
      {!rows ? <Loading /> : rows.length === 0 ? <Card><p className="text-sm text-slate-500">No institutions for this selection.</p></Card> : (
        <>
          <Card title="Score by institution">
            <Plot height={Math.max(320, rows.length * 22)} data={[{
              type: 'bar', orientation: 'h',
              y: rows.map(r => `${r.rank_base}. ${r.institution_name}`).reverse(),
              x: rows.map(r => r.score).reverse(), marker: { color: '#4f46e5' },
            }]} layout={{ margin: { l: 330, t: 10, r: 20, b: 40 }, xaxis: { title: { text: 'NIRF score' } } }} />
          </Card>
          <Card title="Table">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr>
                  {['Rank', 'Institution', 'State', 'Score', 'TLR', 'RPC', 'GO', 'OI', 'PER'].map(h => <th key={h} className="px-2 py-1.5">{h}</th>)}
                </tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.institution_id + r.rank_base + r.rank_suffix} className="border-t border-slate-100">
                    <td className="px-2 py-1">{r.rank_base}{r.rank_suffix}</td><td className="px-2 py-1">{r.institution_name}</td>
                    <td className="px-2 py-1">{r.state}</td><td className="px-2 py-1">{r.score ?? '–'}</td>
                    <td className="px-2 py-1">{r.TLR ?? '–'}</td><td className="px-2 py-1">{r.RPC ?? '–'}</td><td className="px-2 py-1">{r.GO ?? '–'}</td>
                    <td className="px-2 py-1">{r.OI ?? '–'}</td><td className="px-2 py-1">{r.PERCEPTION ?? '–'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
