import { ArrowRight, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface HeroStat {
  value: string
  label: string
}

/** Landing band for the Overview page: badge, headline, search, quick-jump chips, optional aside and stat strip. */
export function Hero({
  badge,
  title,
  highlight,
  description,
  chips,
  stats,
  actions,
  search,
  aside,
}: {
  badge: string
  title: string
  highlight: string
  description: string
  chips?: { label: string; to: string }[]
  stats?: HeroStat[]
  actions?: ReactNode
  search?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="relative rounded-2xl bg-gradient-to-br from-navy via-deep to-accent text-white shadow-pop">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-spark/10" />
      </div>

      <div className="relative px-5 py-8 sm:px-8 sm:py-10">
        <div className={aside ? 'grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]' : undefined}>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
              <Sparkles className="h-3.5 w-3.5 text-spark" aria-hidden />
              {badge}
            </span>

            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {title} <span className="text-spark">{highlight}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-teal-50/90 sm:text-base">{description}</p>

            {search && <div className="mt-5 max-w-xl">{search}</div>}

            {(chips?.length || actions) && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {chips?.map((c) => (
                  <Link
                    key={c.to + c.label}
                    to={c.to}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white hover:text-navy"
                  >
                    {c.label}
                    <ArrowRight className="h-3 w-3 opacity-70" aria-hidden />
                  </Link>
                ))}
                {actions}
              </div>
            )}
          </div>

          {aside && <div className="min-w-0">{aside}</div>}
        </div>

        {stats && stats.length > 0 && (
          <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-navy/60 px-4 py-3 backdrop-blur">
                <dd className="text-2xl font-extrabold tabular-nums">{s.value}</dd>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-teal-100/80">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
