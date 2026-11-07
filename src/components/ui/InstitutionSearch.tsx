import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { institutionPath, listInstitutions } from '../../data/selectors'
import type { InstitutionEntry } from '../../data/selectors'
import { cn } from '../../lib/cn'
import { matchRank, matchesInstitution } from '../../lib/search'
import { StatusBadge } from './StatusBadge'

const MAX_RESULTS = 8

/** Search box with a keyboard-navigable list of institutions; choosing one opens its profile. */
export function InstitutionSearch({ placeholder, variant = 'bar' }: { placeholder: string; variant?: 'bar' | 'hero' }) {
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const rootRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const institutions = useMemo(listInstitutions, [])
  const q = query.trim()
  const matches = useMemo(() => {
    if (!q) return []
    return institutions
      .filter((i) => matchesInstitution(q, `${i.name} ${i.city} ${i.state}`))
      .map((i) => ({ i, order: matchRank(q, i.name) }))
      .sort((a, b) => a.order - b.order || a.i.name.localeCompare(b.i.name))
      .slice(0, MAX_RESULTS)
      .map((m) => m.i)
  }, [q, institutions])

  const showPanel = open && !!q
  const showList = showPanel && matches.length > 0

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (inst: InstitutionEntry) => {
    setQuery('')
    setOpen(false)
    setActive(-1)
    navigate(institutionPath(inst.id))
  }

  const submit = () => {
    const pick = matches[active] ?? matches[0]
    if (pick) choose(pick)
    else if (q) setOpen(true)
    else inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && matches.length) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % matches.length : a <= 0 ? matches.length - 1 : a - 1))
    }
  }

  const input = (
    <input
      ref={inputRef}
      id={id}
      type="text"
      role="combobox"
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={showList}
      aria-controls={listId}
      aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      value={query}
      placeholder={placeholder}
      onChange={(e) => {
        setQuery(e.target.value)
        setOpen(true)
        setActive(-1)
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      className={
        variant === 'hero'
          ? 'h-10 min-w-0 flex-1 text-ellipsis bg-transparent pl-3 text-xs text-ink outline-none placeholder:text-slate-500 sm:text-sm'
          : 'field-control pl-8'
      }
    />
  )

  return (
    <form
      ref={rootRef}
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search institutions
      </label>
      {variant === 'hero' ? (
        <div className="flex items-center gap-2 rounded-full bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-spark">
          {input}
          <button type="submit" className="h-10 shrink-0 rounded-full bg-accent px-3 text-sm font-semibold text-white transition hover:bg-deep sm:px-4">
            Search
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          {input}
        </div>
      )}

      {showPanel && (
        <div
          className={cn(
            'z-40 overflow-hidden rounded-md border border-line bg-white text-left text-ink shadow-pop',
            variant === 'hero' ? 'absolute inset-x-0 top-full mt-2' : 'fixed inset-x-4 top-14 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1 sm:w-[28rem]',
          )}
        >
          {matches.length > 0 ? (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Matching institutions" className="max-h-[60vh] overflow-y-auto py-1">
              {matches.map((m, i) => (
                <li
                  key={m.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2', i === active && 'bg-teal-50')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(m)}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{m.name}</span>
                    <span className="block text-xs text-muted">{m.city}, {m.state}</span>
                  </span>
                  {m.type && <StatusBadge variant="info" className="shrink-0">{m.type}</StatusBadge>}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-3 py-3 text-sm text-muted">
              No institution matches '{q}'. Try the full name, for example Indian Institute of Technology Delhi.
            </p>
          )}
        </div>
      )}
    </form>
  )
}
