import { roleLabel, useApp } from '../context/AppContext'
import HeaderSearch from './HeaderSearch'
import PeopleAlerts from './hr/PeopleAlerts'
import NotificationBell from './NotificationBell'
import type { NavKey } from './Sidebar'

export default function Header({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { session } = useApp()
  if (!session) return null

  return (
    <header className="mb-3 flex items-center gap-3">
      <HeaderSearch onNavigate={onNavigate} />

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <PeopleAlerts />
        <NotificationBell onNavigate={onNavigate} />

        <div className="ml-1 flex items-center gap-3">
          <img
            src={session.person.avatar}
            alt={session.person.name}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold text-cs-ink">{session.person.name}</p>
            <p className="text-[12px] text-cs-muted">
              {session.person.role === 'user'
                ? session.person.jobTitle || ''
                : `${session.person.jobTitle ? `${session.person.jobTitle} · ` : ''}${roleLabel(session.person.role)}`}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
