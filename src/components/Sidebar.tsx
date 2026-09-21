import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  MessageSquareWarning,
  MessagesSquare,
  LogOut,
  ShieldAlert,
  Users,
  FileText,
  CalendarRange,
  CircleUser,
} from 'lucide-react'
import { isOrgAdmin, roleLabel, useApp } from '../context/AppContext'
import type { NotificationType, Role } from '../types'

export type NavKey =
  | 'dashboard'
  | 'projects'
  | 'tracker'
  | 'queries'
  | 'blockers'
  | 'requirements'
  | 'discussions'
  | 'lifecycle'
  | 'people'
  | 'leave'
  | 'updates'
  | 'profile'

const leadNav = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects' as const, label: 'Active Projects', icon: FolderKanban },
  { key: 'tracker' as const, label: 'Updates', icon: CalendarRange },
  { key: 'requirements' as const, label: 'Requirements', icon: FileText },
  { key: 'discussions' as const, label: 'Client Discussions', icon: MessagesSquare },
  { key: 'lifecycle' as const, label: 'Start / Closure', icon: FolderKanban },
  { key: 'blockers' as const, label: 'Blockers', icon: ShieldAlert },
  { key: 'queries' as const, label: 'Query Session', icon: MessageSquareWarning },
  { key: 'leave' as const, label: 'Leave Requests', icon: ClipboardList },
  { key: 'people' as const, label: 'Employees', icon: Users },
  { key: 'profile' as const, label: 'My Profile', icon: CircleUser },
]

const orgNav = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects' as const, label: 'All Projects', icon: FolderKanban },
  { key: 'tracker' as const, label: 'Updates', icon: CalendarRange },
  { key: 'requirements' as const, label: 'Requirements', icon: FileText },
  { key: 'discussions' as const, label: 'Client Discussions', icon: MessagesSquare },
  { key: 'lifecycle' as const, label: 'Start / Closure', icon: FolderKanban },
  { key: 'blockers' as const, label: 'Blockers', icon: ShieldAlert },
  { key: 'queries' as const, label: 'Query Session', icon: MessageSquareWarning },
  { key: 'leave' as const, label: 'Leave Requests', icon: ClipboardList },
  { key: 'people' as const, label: 'Employees', icon: Users },
]

const navByRole: Record<Role, { key: NavKey; label: string; icon: typeof LayoutDashboard }[]> = {
  admin: orgNav,
  hr: orgNav,
  tl: leadNav,
  user: [
    { key: 'dashboard', label: 'My Work', icon: LayoutDashboard },
    { key: 'projects', label: 'My Projects', icon: FolderKanban },
    { key: 'tracker', label: 'Daily Update', icon: ClipboardList },
    { key: 'updates', label: 'Updates', icon: CalendarRange },
    { key: 'queries', label: 'Query Session', icon: MessageSquareWarning },
    { key: 'leave', label: 'Leave Request', icon: CalendarRange },
    { key: 'blockers', label: 'My Blockers', icon: ShieldAlert },
    { key: 'people', label: 'Employees', icon: Users },
    { key: 'profile', label: 'My Profile', icon: CircleUser },
  ],
}

export function notificationNavKey(type: NotificationType, role?: Role): NavKey {
  switch (type) {
    case 'query':
    case 'query-reply':
      return 'queries'
    case 'blocker':
    case 'critical-vuln':
      return 'blockers'
    case 'tracker':
      return role === 'user' ? 'updates' : 'tracker'
    case 'leave':
      return 'leave'
    case 'requirement':
      return 'requirements'
    case 'lifecycle':
      return 'lifecycle'
    case 'worked-day':
      return role === 'user' || role === 'tl' ? 'leave' : 'leave'
    case 'hr-ticket':
      return isOrgAdmin(role) ? 'people' : 'profile'
    case 'people':
      return 'people'
    default:
      return 'projects'
  }
}

export function roleHasNav(role: Role, key: NavKey) {
  return navByRole[role].some((item) => item.key === key)
}

export default function Sidebar({
  active,
  onNavigate,
}: {
  active: NavKey
  onNavigate: (key: NavKey) => void
}) {
  const { session, logout, openBlockers, trackerOverdue } = useApp()
  if (!session) return null

  const role = session.person.role
  const menu = navByRole[role]
  const blockerCount = openBlockers.length

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col rounded-[28px] bg-white p-4 pt-4 shadow-card">
      <div className="mb-4 flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cs-forest">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M5 10.5c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2"
              stroke="#7DDEA8"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M7.2 10.5c0-1.8 1.3-3.1 2.8-3.1s2.8 1.3 2.8 3.1"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="10" cy="13" r="1.3" fill="#7DDEA8" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-cs-ink">Cybersmith</div>
          <div className="text-[11px] font-semibold tracking-wide text-cs-forest">SECURE</div>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-[#edf7f1] px-3 py-2">
        {role !== 'user' && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cs-forest">
            {roleLabel(role)}
          </p>
        )}
        <p className="truncate text-[13px] font-semibold text-cs-ink">{session.person.name}</p>
        {session.person.jobTitle && (
          <p className="truncate text-[11px] text-cs-forest">{session.person.jobTitle}</p>
        )}
      </div>

      <div className="mb-auto">
        <p className="mb-3 px-3 text-[11px] font-semibold tracking-[0.08em] text-cs-muted">MENU</p>
        <nav className="flex flex-col gap-1">
          {menu.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            const showBlockerBadge = item.key === 'blockers' && blockerCount > 0
            const showTrackerAlert = item.key === 'tracker' && role === 'user' && trackerOverdue
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors ${
                  isActive
                    ? 'bg-[#edf7f1] font-semibold text-cs-forest'
                    : 'font-medium text-cs-muted hover:bg-gray-50 hover:text-cs-ink'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-cs-forest" />
                )}
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {showBlockerBadge && (
                  <span className="rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {blockerCount}
                  </span>
                )}
                {showTrackerAlert && (
                  <span className="rounded-full bg-[#f59e0b] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Due
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mt-4">
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-cs-muted hover:bg-gray-50 hover:text-cs-ink"
          >
            <LogOut size={18} strokeWidth={1.8} />
            Logout
          </button>
        </nav>
      </div>
    </aside>
  )
}
