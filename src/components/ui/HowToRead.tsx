import { BookOpen } from 'lucide-react'
import type { ReactNode } from 'react'

/** A short "how to read this page" strip: what the charts show and the caveat that matters. */
export function HowToRead({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-deep">
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">How to read this. </span>
        {children}
      </p>
    </div>
  )
}
