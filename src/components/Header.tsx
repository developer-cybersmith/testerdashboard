import { roleLabel, useApp } from '../context/AppContext'
import HeaderSearch from './HeaderSearch'
import PeopleAlerts from './hr/PeopleAlerts'
import NotificationBell from './NotificationBell'
import type { NavKey } from './Sidebar'

export default function Header({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { session, syncError } = useApp()
  if (!session) return null

  return (
    <header className="mb-3">
      {syncError ? (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-950">{syncError}</p>
      ) : null}
      <div className="flex items-center gap-3">
      <HeaderSearch onNavigate={onNavigate} />

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <PeopleAlerts />
        <NotificationBell onNavigate={onNavigate} />

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="ml-1 flex items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left hover:bg-white"
          aria-label="Open my profile"
        >
          <img
            src={session.person.avatar}
            alt=""
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
        </button>
      </div>
      </div>
    </header>
  )
}
