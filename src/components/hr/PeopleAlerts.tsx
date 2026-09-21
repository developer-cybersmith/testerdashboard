import { useEffect, useRef, useState } from 'react'
import { Cake, CalendarHeart, ScrollText, Sparkles } from 'lucide-react'
import { isOrgAdmin, useApp } from '../../context/AppContext'
import { buildPeopleAlerts } from '../../hr/peopleOps'
import type { PeopleAlert } from '../../types'

const ICONS: Record<PeopleAlert['kind'], typeof Cake> = {
  birthday: Cake,
  anniversary: CalendarHeart,
  contract: ScrollText,
}

export default function PeopleAlerts() {
  const { session, people } = useApp()
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const open = hovering || pinned

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!session) return null

  const orgView = isOrgAdmin(session.person.role)
  const alerts = buildPeopleAlerts(people).filter((alert) => {
    if (orgView) return true
    if (alert.kind === 'birthday' || alert.kind === 'anniversary') return true
    return alert.personId === session.person.id
  })
  const todayCount = alerts.filter((alert) => alert.urgency === 'today').length

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        className="relative flex h-10 items-center gap-2 rounded-full border border-cs-line bg-white px-3 text-cs-muted transition-colors hover:text-cs-ink"
        aria-label="People alerts"
        aria-expanded={open}
      >
        <Sparkles size={16} strokeWidth={1.8} className="text-cs-forest" />
        <span className="hidden text-[13px] font-semibold sm:inline">People alerts</span>
        {alerts.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b45309] px-1 text-[10px] font-bold text-white">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#fde68a] bg-[#fffbeb] shadow-xl">
          <div className="flex items-center justify-between border-b border-[#fde68a] px-4 py-3">
            <p className="text-[14px] font-bold text-cs-ink">People alerts</p>
            <p className="text-[11px] font-semibold text-[#b45309]">
              {todayCount ? `${todayCount} today` : alerts.length ? 'Upcoming' : 'None'}
            </p>
          </div>
          <ul className="max-h-[420px] overflow-y-auto p-2">
            {alerts.length === 0 ? (
              <li className="px-3 py-8 text-center text-[13px] text-cs-muted">
                No birthday, anniversary, or contract alerts.
              </li>
            ) : (
              alerts.map((alert) => {
                const Icon = ICONS[alert.kind]
                return (
                  <li
                    key={alert.id}
                    className={`mb-1 flex items-start gap-3 rounded-xl px-3 py-2 last:mb-0 ${
                      alert.urgency === 'today' ? 'bg-white' : 'bg-white/70'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={`mt-0.5 shrink-0 ${
                        alert.urgency === 'today' ? 'text-[#b45309]' : 'text-cs-forest'
                      }`}
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-cs-ink">{alert.title}</p>
                      <p className="text-[12px] text-cs-muted">{alert.message}</p>
                    </div>
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
