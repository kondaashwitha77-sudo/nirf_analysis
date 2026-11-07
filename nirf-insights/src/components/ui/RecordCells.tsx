import type { ParamKey, RankingRecord } from '../../types'
import { fmt } from '../../lib/format'
import { NotAvailableState } from './States'
import { StatusBadge } from './StatusBadge'

/** Rank is shown according to its type: exact number, labelled band, or unavailable. */
export function RankCell({ record }: { record: RankingRecord }) {
  if (record.rankType === 'exact' && record.rank !== null) {
    return <span className="font-semibold tabular-nums">{record.rank}</span>
  }
  if (record.rankType === 'band' && record.rankBand) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular-nums text-slate-600">{record.rankBand}</span>
        <StatusBadge variant="band">Band</StatusBadge>
      </span>
    )
  }
  return <NotAvailableState reason="missing" inline />
}

/** A parameter value, or the reason it is absent. Never renders 0 for missing data. */
export function ParamCell({ record, param }: { record: RankingRecord; param: ParamKey }) {
  const v = record.params[param]
  if (v !== null) return <span className="tabular-nums">{fmt(v)}</span>
  return <NotAvailableState reason={record.paramReasons[param] ?? 'missing'} inline />
}
