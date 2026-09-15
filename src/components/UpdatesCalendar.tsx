import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { WorkedDayApprovals } from './WorkedDayRequests'
import { dayAttendanceMark, testerAttendanceReport } from '../attendance'
import type { DailyUpdate } from '../types'
import { Badge, Card, EmptyState } from './ui'

export function updatePoints(update: DailyUpdate) {
  if (update.workPoints?.length) return update.workPoints
  return update.workDone
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function eachDate(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const days: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(isoDate(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  return days
}

type CalEvent = {
  id: string
  date: string
  kind: 'update' | 'leave'
  title: string
  time?: string
  person: string
  note: string
  points?: string[]
  tone: 'update' | 'leave'
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default function UpdatesCalendar() {
  const { session, updates, leaveRequests, projects } = useApp()
  const [cursor, setCursor] = useState(() => new Date(2026, 7, 1))
  const [selected, setSelected] = useState('2026-08-19')

  const mineOnlyUpdates = session?.person.role === 'user'
  const ownLeavesOnly = session?.person.role === 'user' || session?.person.role === 'tl'
  const myId = session?.person.id

  const visibleUpdates = useMemo(() => {
    return mineOnlyUpdates ? updates.filter((u) => u.userId === myId) : updates
  }, [updates, mineOnlyUpdates, myId])

  const visibleLeaves = useMemo(() => {
    const list = ownLeavesOnly
      ? leaveRequests.filter((l) => l.userId === myId)
      : leaveRequests
    return list.filter((l) => l.status !== 'rejected')
  }, [leaveRequests, ownLeavesOnly, myId])

  const events = useMemo(() => {
    const items: CalEvent[] = []
    visibleUpdates.forEach((u) => {
      const time = new Date(u.submittedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      items.push({
        id: u.id,
        date: u.date,
        kind: 'update',
        title: projects.find((p) => p.id === u.projectId)?.name || 'Daily update',
        time,
        person: u.userName,
        note: `${u.hoursSpent}h logged`,
        points: updatePoints(u),
        tone: 'update',
      })
    })
    visibleLeaves.forEach((lv) => {
      eachDate(lv.fromDate, lv.toDate).forEach((date) => {
        items.push({
          id: `${lv.id}-${date}`,
          date,
          kind: 'leave',
          title: `Leave · ${lv.status === 'approved' ? 'Approved' : lv.status === 'pending-admin' ? 'Pending Admin / HR' : 'Pending TL'}`,
          person: lv.userName,
          note: lv.reason,
          tone: 'leave',
        })
      })
    })
    return items
  }, [visibleUpdates, visibleLeaves, projects])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const cells: { day: number; inMonth: boolean; date: string }[] = []
  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevDays - i
    const prev = new Date(year, month - 1, day)
    cells.push({
      day,
      inMonth: false,
      date: isoDate(prev.getFullYear(), prev.getMonth(), day),
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, date: isoDate(year, month, day) })
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - startPad - daysInMonth + 1
    const next = new Date(year, month + 1, extra)
    cells.push({
      day: extra,
      inMonth: false,
      date: isoDate(next.getFullYear(), next.getMonth(), extra),
    })
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    events.forEach((ev) => {
      const list = map.get(ev.date) || []
      list.push(ev)
      map.set(ev.date, list)
    })
    return map
  }, [events])

  const selectedEvents = eventsByDate.get(selected) || []
  const updateCount = events.filter((e) => e.kind === 'update').length
  const leaveCount = new Set(visibleLeaves.map((l) => l.id)).size
  const pendingLeave = visibleLeaves.filter(
    (l) => l.status === 'pending-tl' || l.status === 'pending-admin',
  ).length

  const shiftMonth = (delta: number) => {
    setCursor(new Date(year, month + delta, 1))
  }

  return (
    <div className="space-y-4">
      <WorkedDayApprovals />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total schedules" value={events.length} className="bg-cs-forest text-white" />
        <Metric label="Daily updates" value={updateCount} className="bg-[#edf7f1] text-cs-forest" />
        <Metric label="Leave schedules" value={leaveCount} className="bg-[#fff8e8] text-[#9a3412]" />
        <Metric label="Pending leave" value={pendingLeave} className="bg-[#d4edd9] text-cs-forest" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[20px] font-bold text-cs-ink">
              {MONTHS[month]} {year}
            </h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#edf7f1] px-3 py-1.5 text-[12px] font-semibold text-cs-forest">
                Month
              </span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf7f1] text-cs-forest"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf7f1] text-cs-forest"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-cs-line text-center text-[12px] font-semibold text-cs-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-b-2xl border border-t-0 border-cs-line">
            {cells.map((cell, index) => {
              const dayEvents = eventsByDate.get(cell.date) || []
              const isSelected = selected === cell.date
              const attend =
                session?.person.role === 'user' && myId
                  ? dayAttendanceMark(updates, leaveRequests, myId, cell.date)
                  : null
              const dayTone =
                attend === 'present'
                  ? 'bg-[#14b8a6] text-white'
                  : attend === 'half'
                    ? 'bg-[#facc15] text-[#713f12]'
                    : attend === 'leave'
                      ? 'bg-cs-forest text-white'
                      : isSelected
                        ? 'bg-cs-forest text-white'
                        : cell.inMonth
                          ? 'text-cs-ink'
                          : 'text-cs-muted/50'
              return (
                <button
                  key={`${cell.date}-${index}`}
                  type="button"
                  onClick={() => setSelected(cell.date)}
                  className={`min-h-[118px] border-b border-r border-cs-line p-2 text-left last:border-r-0 ${
                    isSelected ? 'bg-[#edf7f1]' : 'bg-white hover:bg-[#f7f8fa]'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${dayTone}`}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <p
                        key={ev.id}
                        className={`truncate rounded-md px-1.5 py-1 text-[10px] font-semibold leading-tight ${
                          ev.kind === 'update'
                            ? 'bg-[#d4edd9] text-cs-forest'
                            : 'bg-[#e8eaed] text-cs-muted'
                        }`}
                      >
                        {ev.kind === 'update' ? ev.title : 'Leave'}
                        {ev.time ? ` · ${ev.time}` : ''}
                      </p>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] font-medium text-cs-muted">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-cs-muted">
            Details schedule
          </p>
          <h3 className="mb-4 text-[16px] font-bold text-cs-ink">
            {new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h3>
          {selectedEvents.length === 0 ? (
            <EmptyState text="No updates or leave on this date." />
          ) : (
            <ul className="space-y-3">
              {selectedEvents.map((ev) => (
                <li key={ev.id} className="rounded-2xl border border-cs-line bg-[#f7f8fa] px-3 py-3">
                  <Badge tone={ev.kind === 'update' ? 'green' : 'gray'}>
                    {ev.kind === 'update' ? 'Daily update' : 'Leave'}
                  </Badge>
                  <p className="mt-2 text-[14px] font-semibold text-cs-ink">{ev.title}</p>
                  <p className="text-[12px] text-cs-muted">
                    {ev.person}
                    {ev.time ? ` · ${ev.time}` : ''}
                  </p>
                  {ev.points?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-cs-ink">
                      {ev.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[12px] text-cs-muted">{ev.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className={`rounded-[22px] p-4 shadow-card ${className}`}>
      <p className="text-[12px] opacity-80">{label}</p>
      <p className="mt-1 text-[28px] font-bold">{value}</p>
    </div>
  )
}

export function UserAttendanceWidgets() {
  const { session, updates, leaveRequests, blockers, projects, queries } = useApp()
  const [cursor, setCursor] = useState(() => new Date(2026, 7, 1))
  const myId = session?.person.id
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: startPad + daysInMonth }, (_, i) =>
    i < startPad ? null : i - startPad + 1,
  )
  const report = myId
    ? testerAttendanceReport({
        userId: myId,
        year,
        month,
        updates,
        leaves: leaveRequests,
        blockers,
        projects,
        queries,
      })
    : null

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-cs-ink">
            {MONTHS[month]} {year}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7f1] text-cs-forest"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7f1] text-cs-forest"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-cs-muted">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={`${d}-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (!day) return <div key={`p-${index}`} className="h-9" />
            const date = isoDate(year, month, day)
            const mark = report?.marks[date] || 'absent'
            return (
              <div key={date} className="flex h-9 items-center justify-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${
                    mark === 'leave'
                      ? 'bg-cs-forest text-white'
                      : mark === 'present'
                        ? 'bg-[#14b8a6] text-white'
                        : mark === 'half'
                          ? 'bg-[#facc15] text-[#713f12]'
                          : 'text-cs-ink'
                  }`}
                >
                  {day}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-cs-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" /> Present (both slots)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" /> Half day (one slot)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-cs-forest" /> Leave
          </span>
        </div>
      </Card>

      <Card className="xl:col-span-7">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-bold text-cs-ink">Attendance Report</h3>
            <p className="text-[12px] text-cs-muted">
              Built from daily updates, blockers found, and project engagement this month
            </p>
          </div>
          <div className="text-right">
            <p className="text-[28px] font-bold leading-none text-cs-ink">{report?.rate ?? 0}%</p>
            <p className="mt-1 text-[11px] text-cs-muted">Attendance Rate</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-[#edf7f1] px-3 py-2">
            <p className="text-[11px] text-cs-muted">Present days</p>
            <p className="text-[18px] font-bold text-cs-ink">{report?.present ?? 0}</p>
          </div>
          <div className="rounded-xl bg-[#fef9c3] px-3 py-2">
            <p className="text-[11px] text-cs-muted">Half days</p>
            <p className="text-[18px] font-bold text-cs-ink">{report?.half ?? 0}</p>
          </div>
          <div className="rounded-xl bg-[#f7f8fa] px-3 py-2">
            <p className="text-[11px] text-cs-muted">Daily updates</p>
            <p className="text-[18px] font-bold text-cs-ink">{report?.updateCount ?? 0}</p>
          </div>
          <div className="rounded-xl bg-[#f7f8fa] px-3 py-2">
            <p className="text-[11px] text-cs-muted">Blockers found</p>
            <p className="text-[18px] font-bold text-cs-ink">{report?.blockersFound ?? 0}</p>
          </div>
        </div>
        <p className="mb-2 text-[12px] text-cs-muted">
          Morning slots {report?.morningCount ?? 0} · Evening slots {report?.eveningCount ?? 0} ·
          High/critical blockers {report?.blockersCritical ?? 0}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-cs-line text-cs-muted">
                <th className="py-2 font-semibold">Project engagement</th>
                <th className="py-2 font-semibold">Updates</th>
                <th className="py-2 font-semibold">Hours</th>
                <th className="py-2 font-semibold">Blockers</th>
                <th className="py-2 font-semibold">Queries</th>
              </tr>
            </thead>
            <tbody>
              {(report?.projectEngagement || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-cs-muted">
                    No assigned projects this month.
                  </td>
                </tr>
              ) : (
                report?.projectEngagement.map((row) => (
                  <tr key={row.projectId} className="border-b border-cs-line/70">
                    <td className="py-2 font-semibold text-cs-ink">{row.name}</td>
                    <td className="py-2 text-cs-muted">{row.updates}</td>
                    <td className="py-2 text-cs-muted">{row.hours.toFixed(1)}</td>
                    <td className="py-2 text-cs-muted">{row.blockers}</td>
                    <td className="py-2 text-cs-muted">{row.queries}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
