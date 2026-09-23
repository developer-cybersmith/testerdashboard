import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { AppProvider, roleLabel, useApp } from './context/AppContext'
import Sidebar, { type NavKey } from './components/Sidebar'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import { UserDashboard } from './pages/user/UserViews'
import { TLDashboard } from './pages/tl/TLViews'
import { AdminDashboard } from './pages/admin/AdminViews'

function DashboardShell() {
  const { session } = useApp()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cs-nav-collapsed') === '1'
    } catch {
      return false
    }
  })
  const [active, setActive] = useState<NavKey>('dashboard')

  const needsLockedProfile =
    !!session &&
    (session.person.role === 'user' || session.person.role === 'tl') &&
    (!session.person.avatarUploaded || Boolean(session.person.mustChangePassword))

  useEffect(() => {
    if (needsLockedProfile) {
      setActive('profile')
    } else {
      setActive('dashboard')
    }
    setMobileNavOpen(false)
  }, [session?.person.id])

  useEffect(() => {
    if (needsLockedProfile && active !== 'profile') {
      setActive('profile')
    }
  }, [active, needsLockedProfile])

  useEffect(() => {
    try {
      localStorage.setItem('cs-nav-collapsed', navCollapsed ? '1' : '0')
    } catch {
      /* ignore private browsing */
    }
  }, [navCollapsed])

  if (!session) return <LoginPage />

  const role = session.person.role
  const subtitle =
    role === 'user'
      ? 'Your allocated projects, daily progress, queries, and blockers.'
      : role === 'admin'
        ? 'Full org control — every Team Leader capability plus people and all projects.'
        : role === 'hr'
          ? 'HR workspace — the same as Admin, plus adding employees.'
          : 'Team Leader workspace — projects, trackers, requirements, discussions, and closure.'

  const titles: Partial<Record<NavKey, string>> = {
    dashboard: role === 'user' ? 'My Work' : 'Dashboard',
    projects: role === 'user' ? 'My Projects' : role === 'admin' || role === 'hr' ? 'All Projects' : 'Projects',
    tracker: role === 'user' ? 'Daily Update' : 'Updates',
    updates: 'Updates',
    queries: 'Query Session',
    blockers: role === 'user' ? 'My Blockers' : 'Blockers',
    requirements: 'Requirements',
    discussions: 'Client Discussions',
    lifecycle: 'Start / Closure',
    people: 'Employees',
    leave: 'Leave Requests',
    profile: 'My Profile',
  }

  const onNavigate = (key: NavKey) => {
    setActive(key)
    setMobileNavOpen(false)
  }

  return (
    <div className="min-h-full bg-cs-bg p-2 md:p-3 lg:p-3">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 m-3 h-[calc(100%-1.5rem)]">
            <button
              type="button"
              className="absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <Sidebar active={active} onNavigate={onNavigate} />
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1440px] gap-3 md:min-h-[calc(100vh-1.5rem)] lg:min-h-[calc(100vh-1.5rem)]">
        <div className="hidden shrink-0 lg:block">
          <Sidebar
            active={active}
            onNavigate={onNavigate}
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed((open) => !open)}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col rounded-[28px] bg-[#f7f8fa] p-3 md:p-4 lg:px-5 lg:pb-5 lg:pt-3">
          <div className="mb-2 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cs-line bg-white text-cs-ink"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-cs-ink">Cybersmith</div>
              <div className="text-[10px] font-semibold tracking-wide text-cs-forest">
                {role === 'user'
                  ? (session.person.jobTitle || 'SECURE').toUpperCase()
                  : roleLabel(role).toUpperCase()}
              </div>
            </div>
          </div>

          <Header onNavigate={onNavigate} />

          <div className="mb-4">
            <h1 className="text-[26px] font-bold tracking-tight text-cs-ink md:text-[30px]">
              {titles[active] || 'Dashboard'}
            </h1>
            <p className="mt-0.5 text-[13px] text-cs-muted md:text-[14px]">{subtitle}</p>
          </div>

          {(role === 'admin' || role === 'hr') && <AdminDashboard active={active} />}
          {role === 'tl' && <TLDashboard active={active} />}
          {role === 'user' && <UserDashboard active={active} onNavigate={onNavigate} />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  )
}
