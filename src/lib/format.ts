import type { MissingReason } from '../types'

export const fmt = (v: number | null | undefined, digits = 2): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—'

export const fmtInt = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN') : '—'

export const REASON_LABEL: Record<MissingReason | 'duplicate_candidate', string> = {
  missing: 'Missing',
  not_published: 'Not published',
  not_applicable: 'Not applicable',
  parser_failure: 'Parser failure',
  invalid: 'Invalid',
  duplicate_candidate: 'Duplicate candidate',
}

export const REASON_HELP: Record<MissingReason | 'duplicate_candidate', string> = {
  missing: 'The source should contain this value but it was not found.',
  not_published: 'The value was not published for this category and year.',
  not_applicable: 'The parameter does not apply to this category.',
  parser_failure: 'The extraction step failed to read the value.',
  invalid: 'The value was read but failed validation.',
  duplicate_candidate: 'Near-identical entry flagged for manual review.',
}

export const downloadCsv = (
  filename: string,
  columns: { key: string; header: string }[],
  rows: Record<string, string | number | null | undefined>[],
) => {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [columns.map((c) => esc(c.header)).join(',')]
    .concat(rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
