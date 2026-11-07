import { MapPin } from 'lucide-react'
import { InstitutionLink } from './InstitutionLink'

/** Compact leaderboard card: big rank number, name, place and a score pill. */
export function RankCard({
  id,
  rank,
  name,
  city,
  state,
  score,
}: {
  id?: string
  rank: number | null
  name: string
  city: string
  state: string
  score: number | null
}) {
  const podium = rank !== null && rank <= 3
  return (
    <article className="flex items-center gap-4 rounded-card border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div
        className={
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-extrabold tabular-nums ' +
          (podium ? 'bg-spark-soft text-amber-800 ring-1 ring-spark/40' : 'bg-teal-50 text-deep')
        }
        aria-label={rank !== null ? `Rank ${rank}` : 'Unranked'}
      >
        {rank ?? '—'}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink" title={name}>{id ? <InstitutionLink id={id}>{name}</InstitutionLink> : name}</h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          {city}, {state}
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold tabular-nums text-navy">{score !== null ? score.toFixed(1) : '—'}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Score</p>
      </div>
    </article>
  )
}
