import { useApp } from '../../context/AppContext'
import { Card } from '../ui'

function currentPeople(people: { lifecycleStatus?: string; status?: string; employmentType?: string }[]) {
  return people.filter((p) => p.lifecycleStatus !== 'exited' && p.status !== 'inactive')
}

function typeCount(
  people: { employmentType?: string }[],
  matcher: (type: string) => boolean,
) {
  return people.filter((p) => matcher((p.employmentType || 'Full-Time').toLowerCase())).length
}

export function EmploymentMetricStrip() {
  const { people, leaveStats, updates } = useApp()
  const current = currentPeople(people)
  const hasAttendance = updates.length > 0

  const cards = [
    {
      title: 'Total Employees',
      value: String(current.length),
      footer: current.length
        ? 'Current people in the directory'
        : 'Headcount appears as employees are added',
    },
    {
      title: 'Attendance',
      value: '—',
      sub: hasAttendance ? 'From daily updates' : 'No attendance logged yet',
      footer: hasAttendance
        ? `${updates.length} daily updates on record`
        : 'Fills after testers log daily work',
    },
    {
      title: 'Leave Requests',
      value: `${leaveStats.approved} Approved`,
      sub: `${leaveStats.pending} Pending Review`,
      footer: `${leaveStats.thisMonth} leave requests this month`,
    },
    {
      title: 'Team Growth',
      value: '—',
      sub: 'New applicants trend',
      footer: 'Fills after HR adds employees',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="!p-0 overflow-hidden">
            <div className="p-5">
              <p className="text-[13px] font-medium text-cs-muted">{c.title}</p>
              <p className="mt-2 text-[32px] font-bold leading-none text-cs-ink">{c.value}</p>
              {c.sub && <p className="mt-2 text-[12px] text-cs-muted">{c.sub}</p>}
            </div>
            <div className="bg-[#edf7f1] px-5 py-2.5 text-[12px] font-medium text-cs-forest">
              {c.footer}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function EmploymentStatusCard() {
  const { people } = useApp()
  const current = currentPeople(people)
  const total = current.length
  const segments = [
    { label: 'Full-Time', count: typeCount(current, (t) => t.includes('full')), color: '#0b4f3c' },
    { label: 'Part-Time', count: typeCount(current, (t) => t.includes('part')), color: '#14b8a6' },
    { label: 'Contract', count: typeCount(current, (t) => t.includes('contract')), color: '#7ddea8' },
    { label: 'Intern', count: typeCount(current, (t) => t.includes('intern')), color: '#d4edd9' },
  ]

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Employment Status</h3>
        <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-[12px] font-semibold text-cs-forest">
          {total} Employees
        </span>
      </div>
      {total === 0 ? (
        <p className="py-4 text-center text-[13px] text-cs-muted">No employees on roll yet.</p>
      ) : (
        <>
          <div className="mb-4 flex h-3 overflow-hidden rounded-full">
            {segments.map((s) => (
              <div
                key={s.label}
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-cs-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-[12px] font-semibold text-cs-muted">
                  {Math.round((s.count / total) * 100)}% · {s.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
