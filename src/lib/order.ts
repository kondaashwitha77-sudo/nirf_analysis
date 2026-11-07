/** One place that decides the order of categorical labels, so every chart agrees. */

export const CATEGORY_ORDER = [
  'Overall',
  'Engineering',
  'University',
  'College',
  'Management',
  'Pharmacy',
  'Medical',
  'Law',
  'Architecture and Planning',
  'Dental',
  'Research',
  'Agriculture and Allied Sectors',
  'State Public University',
]
export const PARAM_ORDER = ['TLR', 'RPC', 'GO', 'OI', 'Perception']
export const ZONE_ORDER = ['Northern Zone', 'North Eastern Zone', 'Central Zone', 'Eastern Zone', 'Western Zone', 'Southern Zone']

export type OrderMode = 'value_desc' | 'value_asc' | 'fixed' | 'alpha'
type Value = number | null | undefined

const STANDARD: Record<string, string[]> = { category: CATEGORY_ORDER, parameter: PARAM_ORDER, zone: ZONE_ORDER }

export const hasStandardOrder = (dimension: string) => Boolean(STANDARD[dimension])

// numeric: true keeps years and other numbers in numeric order.
const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

function standardCompare(dimension: string) {
  const list = STANDARD[dimension]
  if (!list) return alpha
  const at = (label: string) => {
    const i = list.indexOf(label)
    return i < 0 ? list.length : i
  }
  return (a: string, b: string) => at(a) - at(b) || alpha(a, b)
}

/** Positions of `labels` in the chosen order. Missing values go last; value ties go A to Z. */
export function orderIndices(dimension: string, labels: string[], mode: OrderMode, values?: Value[]): number[] {
  const idx = labels.map((_, i) => i)
  if ((mode === 'value_desc' || mode === 'value_asc') && values) {
    const sign = mode === 'value_desc' ? -1 : 1
    const num = (i: number) => {
      const v = values[i]
      return v === null || v === undefined || !Number.isFinite(v) ? null : v
    }
    return idx.sort((a, b) => {
      const va = num(a)
      const vb = num(b)
      if (va === null && vb === null) return alpha(labels[a], labels[b])
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * sign || alpha(labels[a], labels[b])
    })
  }
  const compare = mode === 'alpha' ? alpha : standardCompare(dimension)
  return idx.sort((a, b) => compare(labels[a], labels[b]))
}

/** `values` lines up with `labels`. Years stay ascending unless a value order is explicitly requested. */
export function orderLabels(dimension: string, labels: string[], mode: OrderMode, values?: Value[]): string[] {
  return orderIndices(dimension, labels, mode, values).map((i) => labels[i])
}
