import type { ParamKey, RankingRecord } from '../../types'
import { fmt } from '../../lib/format'
import { NotAvailableState } from './States'

/** Rank is shown according to its type: exact number or unavailable. */
export function RankCell({ record }: { record: RankingRecord }) {
  if (record.rankType === 'exact' && record.rank !== null) {
    return <span className="font-semibold tabular-nums">{record.rank}</span>
  }
  return <NotAvailableState reason="missing" inline />
}

/** A parameter value, or the reason it is absent. Never renders 0 for missing data. */
export function ParamCell({ record, param }: { record: RankingRecord; param: ParamKey }) {
  const v = record.params[param]
  if (v !== null) return <span className="tabular-nums">{fmt(v)}</span>
  return <NotAvailableState reason={record.paramReasons[param] ?? 'missing'} inline />
}
