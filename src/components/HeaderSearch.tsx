import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { canViewDirectoryPerson, personLabel, roleLabel, useApp } from '../context/AppContext'
import { lifecycleLabel, matchesEmployeeSearch } from '../hr/peopleOps'
import type { NavKey } from './Sidebar'
import { Badge } from './ui'

export default function HeaderSearch({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { people, session, openDirectoryPerson } = useApp()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const results = useMemo(() => {
    const term = q.trim()
    const list = (term ? people.filter((p) => matchesEmployeeSearch(p, term)) : people).filter((p) =>
      canViewDirectoryPerson(session?.person, p),
    )
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8)
  }, [people, q, session])

  if (!session) return null

  const openPerson = (personId: string) => {
    openDirectoryPerson(personId)
    onNavigate('people')
    setOpen(false)
    setQ('')
  }

  return (
    <div className="relative min-w-0 flex-1" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full max-w-[420px] items-center gap-2 rounded-full border border-cs-line bg-white px-3 text-left text-cs-muted transition-colors hover:text-cs-ink"
        aria-label="Search employees"
        aria-expanded={open}
      >
        <Search size={16} strokeWidth={1.8} className="shrink-0 text-cs-forest" />
        <span className="truncate text-[13px] font-semibold">Search employees</span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-cs-line bg-white shadow-xl">
          <div className="border-b border-cs-line p-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted"
              />
              <input
                ref={inputRef}
                className="h-10 w-full rounded-xl border border-cs-line bg-[#f7f8fa] pl-9 pr-3 text-[13px] text-cs-ink outline-none focus:border-cs-forest"
                placeholder="Name, email, employee ID, or former staff"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <p className="mt-2 text-[11px] text-cs-muted">
              Current and former employees stay searchable after a contract or exit.
            </p>
          </div>
          <ul className="max-h-[360px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <li className="px-3 py-8 text-center text-[13px] text-cs-muted">
                No matching employees.
              </li>
            ) : (
              results.map((person) => {
                const former = person.lifecycleStatus === 'exited' || person.status === 'inactive'
                const title =
                  person.role === 'user'
                    ? person.jobTitle || person.employeeCode || ''
                    : `${person.jobTitle ? `${person.jobTitle} · ` : ''}${roleLabel(person.role)}`
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => openPerson(person.id)}
                      className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left last:mb-0 hover:bg-[#edf7f1]"
                    >
                      <img src={person.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-cs-ink">
                          {person.name}
                        </p>
                        <p className="truncate text-[12px] text-cs-muted">
                          {title || person.email} · {person.employeeCode || personLabel(person)}
                        </p>
                      </div>
                      <Badge tone={former ? 'red' : 'forest'}>{lifecycleLabel(person.lifecycleStatus)}</Badge>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
