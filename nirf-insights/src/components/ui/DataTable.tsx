import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { TableData } from '../../types'
import { EmptyState } from './States'
import { NotAvailableState } from './States'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Value used for sorting. Null values always sort last. */
  sortValue?: (row: T) => string | number | null
  render: (row: T) => ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string | number
  pageSize?: number
  pageSizeOptions?: number[]
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  emptyMessage?: string
  dense?: boolean
  maxHeight?: string
  caption?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  pageSizeOptions,
  initialSort,
  emptyMessage,
  dense,
  maxHeight,
  caption,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(pageSize)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir
    })
  }, [rows, sort, columns])

  const pages = Math.max(1, Math.ceil(sorted.length / size))
  useEffect(() => {
    if (page > pages - 1) setPage(0)
  }, [pages, page])
  const visible = sorted.slice(page * size, page * size + size)

  const toggleSort = (c: Column<T>) => {
    if (!c.sortable) return
    setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }))
  }

  if (!rows.length) return <EmptyState message={emptyMessage} />

  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2.5'
  return (
    <div>
      <div className="overflow-auto rounded-md border border-line" style={{ maxHeight }}>
        <table className="min-w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'whitespace-nowrap border-b border-line text-[11px] font-semibold uppercase tracking-wide text-muted',
                      pad,
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {c.sortable ? (
                      <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => toggleSort(c)}>
                        {c.header}
                        {active ? (
                          sort?.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={rowKey(row, page * size + i)} className="border-b border-line last:border-0 hover:bg-slate-50/70">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'text-ink',
                      pad,
                      c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.className,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(sorted.length > size || pageSizeOptions) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {page * size + 1}–{Math.min(sorted.length, page * size + size)} of {sorted.length.toLocaleString('en-IN')}
          </span>
          <div className="flex items-center gap-2">
            {pageSizeOptions && (
              <select
                aria-label="Rows per page"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs"
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value))
                  setPage(0)
                }}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            )}
            <button type="button" aria-label="Previous page" className="btn-secondary h-8 px-2" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              Page {page + 1} / {pages}
            </span>
            <button type="button" aria-label="Next page" className="btn-secondary h-8 px-2" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Renders a generic TableData payload (the shape the API will return). Null shows as "—", never 0. */
export function TableDataView({ data, pageSize = 10, maxHeight }: { data: TableData; pageSize?: number; maxHeight?: string }) {
  const columns: Column<TableData['rows'][number]>[] = data.columns.map((c) => ({
    key: c.key,
    header: c.header,
    align: c.align,
    sortable: true,
    sortValue: (r) => r[c.key] ?? null,
    render: (r) => {
      const v = r[c.key]
      if (v === null || v === undefined) return <NotAvailableState reason="missing" inline />
      return typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : String(v)
    },
  }))
  return <DataTable columns={columns} rows={data.rows} rowKey={(_, i) => i} pageSize={pageSize} dense maxHeight={maxHeight} />
}
