import { personLabel, useApp } from '../../context/AppContext'
import type { NavKey } from '../../components/Sidebar'
import { LeadDashboardWidgets } from '../../components/dashboard/DashboardWidgets'
import { Badge, Card, SectionTitle } from '../../components/ui'
import EmployeesHub from '../../components/hr/EmployeesHub'
import {
  TLActiveProjects,
  TLBlockersView,
  TLDiscussionsView,
  TLLifecycleView,
  TLQueriesView,
  TLRequirementsView,
} from '../tl/TLViews'
import { LeaveRequestPanel } from '../../components/LeaveRequestPanel'
import UpdatesCalendar from '../../components/UpdatesCalendar'

function AdminOverview() {
  const { projects, openBlockers, updates, discussions, queries } = useApp()
  const closed = projects.filter((p) => p.status === 'closed')

  return (
    <div className="space-y-4">
      <LeadDashboardWidgets />

      <Card>
        <SectionTitle title="All project progress" />
        <div className="space-y-3">
          {projects.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-cs-muted">
              No projects yet. Progress appears after a project is created and testers are allocated.
            </p>
          ) : (
            projects.map((p) => (
            <div key={p.id} className="rounded-xl border border-cs-line px-3 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-cs-ink">{p.name}</p>
                  <p className="text-[12px] text-cs-muted">
                    {p.client} · {p.allocations.length} allocated · Start {p.startDate}
                    {p.closureDate
                      ? ` · ${p.status === 'closed' ? 'Closed' : 'Closure'} ${p.closureDate}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      p.status === 'active' ? 'green' : p.status === 'closed' ? 'gray' : 'yellow'
                    }
                  >
                    {p.status}
                  </Badge>
                  <span className="text-[14px] font-bold text-cs-forest">{p.progress}%</span>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full bg-cs-forest"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>
          ))
          )}
        </div>
        <p className="mt-3 text-[12px] text-cs-muted">
          Closed projects: {closed.length} · Open blockers: {openBlockers.length} · Open queries:{' '}
          {queries.filter((q) => q.status === 'open').length} · Client discussions:{' '}
          {discussions.length} · Updates: {updates.length}
        </p>
      </Card>
    </div>
  )
}

function AdminProjects() {
  const { projects, people } = useApp()
  const leadName = (id: string) => personLabel(people.find((p) => p.id === id))

  return (
    <div className="space-y-4">
      <TLActiveProjects />
      <Card>
        <SectionTitle title="All projects overview" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-cs-line text-cs-muted">
                <th className="py-2 font-semibold">Project</th>
                <th className="py-2 font-semibold">Client</th>
                <th className="py-2 font-semibold">Team Leader</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold">Progress</th>
                <th className="py-2 font-semibold">Team</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-cs-line/70">
                  <td className="py-3 font-semibold text-cs-ink">{p.name}</td>
                  <td className="py-3 text-cs-muted">{p.client}</td>
                  <td className="py-3 text-cs-muted">{leadName(p.tlId)}</td>
                  <td className="py-3">
                    <Badge
                      tone={
                        p.status === 'active' ? 'green' : p.status === 'closed' ? 'gray' : 'yellow'
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex min-w-[120px] items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-cs-forest"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="font-semibold text-cs-ink">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-cs-muted">{p.allocations.length} testers</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function AdminPeople() {
  return <EmployeesHub />
}

export function AdminDashboard({ active }: { active: NavKey }) {
  switch (active) {
    case 'projects':
      return <AdminProjects />
    case 'tracker':
      return <UpdatesCalendar />
    case 'updates':
      return <UpdatesCalendar />
    case 'requirements':
      return <TLRequirementsView />
    case 'discussions':
      return <TLDiscussionsView />
    case 'lifecycle':
      return <TLLifecycleView />
    case 'blockers':
      return <TLBlockersView />
    case 'queries':
      return <TLQueriesView />
    case 'leave':
      return <LeaveRequestPanel />
    case 'people':
      return <AdminPeople />
    default:
      return <AdminOverview />
  }
}
