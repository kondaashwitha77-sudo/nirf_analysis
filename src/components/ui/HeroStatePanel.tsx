export function HeroStatePanel({ rows, category, year }: { rows: { state: string; count: number }[]; category: string; year: number }) {
  const title = `Top 5 states by ranked institutions · ${category} ${year}`
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-white backdrop-brightness-90">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm">No data for this selection</p>
      ) : (
        <ul className="mt-3 space-y-2.5" aria-label={title}>
          {rows.map((r) => (
            <li key={r.state} className="flex items-center gap-2 text-xs" aria-label={`${r.state}: ${r.count} institution${r.count === 1 ? '' : 's'}`}>
              <span className="w-28 shrink-0 truncate" title={r.state}>
                {r.state}
              </span>
              <span aria-hidden className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full bg-[#F59E0B]" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right font-semibold tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
