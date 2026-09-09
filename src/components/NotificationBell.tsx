import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { personLabel, useApp } from '../context/AppContext'
import { notificationNavKey, roleHasNav, type NavKey } from './Sidebar'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const typeLabel: Record<string, string> = {
  query: 'Query',
  'query-reply': 'Query',
  blocker: 'Blocker',
  'critical-vuln': 'Blocker',
  tracker: 'Daily update',
  leave: 'Leave',
  requirement: 'Requirements',
  general: 'Project',
  'peer-review': 'Update',
}

export default function NotificationBell({
  onNavigate,
}: {
  onNavigate: (key: NavKey) => void
}) {
  const {
    session,
    people,
    myNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!session) return null

  const openItem = (id: string, type: string) => {
    markNotificationRead(id)
    const dest = notificationNavKey(
      type as Parameters<typeof notificationNavKey>[0],
      session.person.role,
    )
    onNavigate(roleHasNav(session.person.role, dest) ? dest : 'dashboard')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-cs-line bg-white text-cs-muted transition-colors hover:text-cs-ink"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-cs-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-cs-line px-4 py-3">
            <p className="text-[14px] font-bold text-cs-ink">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-[12px] font-semibold text-cs-forest"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {myNotifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-[13px] text-cs-muted">
                No notifications yet
              </li>
            ) : (
              myNotifications.map((n) => {
                const forPerson = people.find((p) => p.id === n.recipientId)
                const showAudience =
                  session.person.role === 'admin' && n.recipientId !== session.person.id
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n.id, n.type)}
                      className={`w-full border-b border-cs-line/70 px-4 py-3 text-left transition-colors hover:bg-[#f7f8fa] ${
                        n.read ? 'bg-white' : 'bg-[#edf7f1]/60'
                      }`}
                    >
                      <div className="mb-0.5 flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-cs-ink">{n.title}</p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cs-forest" />
                        )}
                      </div>
                      <p className="text-[12px] text-cs-muted">{n.message}</p>
                      <p className="mt-1 text-[11px] text-cs-muted">
                        {typeLabel[n.type] || 'Update'} · {timeAgo(n.createdAt)}
                        {showAudience ? ` · For ${personLabel(forPerson)}` : ''}
                      </p>
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
