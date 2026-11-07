import { useMemo, useState } from 'react'
import { SEQ_SCALE, ZONE_BY_STATE } from '../../data/mock/constants'
import geo from '../../data/india-states.json'

/**
 * Choropleth of India built from state boundaries (GeoJSON from github.com/udit-001/india-maps-data,
 * dissolved from districts and simplified). Rendered as plain SVG, so it works offline.
 * Darker teal = more institutions. Click a state to filter.
 */
type Ring = number[][]
interface Feat { properties: { st_nm: string }; geometry: { type: string; coordinates: unknown } }

const W = 640
const H = 700
const LAT0 = Math.cos((22 * Math.PI) / 180)

function rings(g: Feat['geometry']): Ring[] {
  const c = g.coordinates as number[][][] | number[][][][]
  return (g.type === 'Polygon' ? [c as number[][][]] : (c as number[][][][])).flat() as Ring[]
}

const PROJECTED = (() => {
  const feats = (geo as unknown as { features: Feat[] }).features
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  feats.forEach((f) => rings(f.geometry).forEach((r) => r.forEach(([lon, lat]) => {
    const x = lon * LAT0, y = -lat
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  })))
  const s = Math.min((W - 20) / (maxX - minX), (H - 20) / (maxY - minY))
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2
  return feats.map((f) => ({
    name: f.properties.st_nm,
    d: rings(f.geometry)
      .map((r) => 'M' + r.map(([lon, lat]) => `${((lon * LAT0 - minX) * s + ox).toFixed(1)},${((-lat - minY) * s + oy).toFixed(1)}`).join('L') + 'Z')
      .join(''),
  }))
})()

function shade(t: number): string {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  for (let i = 1; i < SEQ_SCALE.length; i++) {
    if (t <= SEQ_SCALE[i][0]) {
      const [a, b] = [hex(SEQ_SCALE[i - 1][1]), hex(SEQ_SCALE[i][1])]
      const f = (t - SEQ_SCALE[i - 1][0]) / (SEQ_SCALE[i][0] - SEQ_SCALE[i - 1][0])
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`
    }
  }
  return SEQ_SCALE[SEQ_SCALE.length - 1][1]
}

export function IndiaMap({
  counts,
  selected,
  onSelect,
  max: maxProp,
}: {
  counts: Record<string, number>
  selected?: string
  onSelect?: (state: string) => void
  /** shared colour-scale maximum, so two maps can be compared */
  max?: number
}) {
  const [hover, setHover] = useState<string>('')
  const max = maxProp ?? Math.max(1, ...Object.values(counts))
  const shown = hover || selected || ''
  const info = useMemo(() => (shown ? `${shown}: ${counts[shown] ?? 0} institution${(counts[shown] ?? 0) === 1 ? '' : 's'}${ZONE_BY_STATE[shown] ? ' · ' + ZONE_BY_STATE[shown] : ''}` : 'Hover or click a state'), [shown, counts])

  return (
    <div>
      <p className="mb-2 text-center text-sm font-medium text-ink" aria-live="polite">{info}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-lg" role="img" aria-label="Map of India: institutions per state">
        {PROJECTED.map((s) => {
          const n = counts[s.name] ?? 0
          const active = selected === s.name
          return (
            <path
              key={s.name}
              d={s.d}
              fill={n === 0 ? '#F1F5F4' : shade(n / max)}
              stroke={active ? '#F59E0B' : '#FFFFFF'}
              strokeWidth={active ? 2.5 : 0.8}
              strokeLinejoin="round"
              className="cursor-pointer transition hover:brightness-90"
              onMouseEnter={() => setHover(s.name)}
              onMouseLeave={() => setHover('')}
              onClick={() => onSelect?.(active ? '' : s.name)}
            >
              <title>{`${s.name}: ${n}`}</title>
            </path>
          )
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-2">
          Fewer
          <span aria-hidden className="h-2.5 w-24 rounded-full" style={{ background: `linear-gradient(to right, ${SEQ_SCALE.map(([, c]) => c).join(',')})` }} />
          More institutions
        </span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2.5 w-3 rounded-sm bg-[#F1F5F4] ring-1 ring-line" />None in selection</span>
      </div>
    </div>
  )
}
