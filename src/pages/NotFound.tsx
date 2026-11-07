import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-white px-4 py-20 text-center shadow-card">
      <Compass className="h-10 w-10 text-slate-300" aria-hidden />
      <p className="text-xs font-bold uppercase tracking-wider text-accent">404</p>
      <h1 className="text-xl font-bold text-navy">Page not found</h1>
      <p className="max-w-md text-sm text-muted">The page you are looking for does not exist or has moved.</p>
      <Link to="/overview" className="btn-primary mt-2">
        Back to Overview
      </Link>
    </div>
  )
}
