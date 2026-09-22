import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, FolderOpen } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import ProjectDetailModal from '../../components/ProjectDetailModal'
import UpdatesCalendar, { UserAttendanceWidgets, updatePoints } from '../../components/UpdatesCalendar'
import { UserDashboardWidgets } from '../../components/dashboard/DashboardWidgets'
import QueryChatSession from '../../components/QueryChatSession'
import { LeaveRequestPanel } from '../../components/LeaveRequestPanel'
import TesterProfile from '../../components/TesterProfile'
import EmployeesHub from '../../components/hr/EmployeesHub'
import { WorkedDayRequestForm, LateMorningRequestForm } from '../../components/WorkedDayRequests'
import { isAfterEveningWindow } from '../../context/AppContext'
import type { NavKey } from '../../components/Sidebar'
import type { BlockerSeverity, Project } from '../../types'
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  SectionTitle,
  inputClass,
} from '../../components/ui'

function TrackerBanner() {
  const {
    hasSubmittedToday,
    todayMarkedWorked,
    trackerDueSoon,
    trackerOverdue,
    morningUpdateToday,
    eveningUpdateToday,
    currentUpdateSlot,
    lateMorningGatewayOpen,
  } = useApp()

  if (hasSubmittedToday) {
    return (
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] text-[#15803d]">
        {todayMarkedWorked
          ? 'Today is marked as worked.'
          : 'Morning and evening updates are both submitted for today.'}
      </div>
    )
  }

  if (lateMorningGatewayOpen && !morningUpdateToday) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#b45309]">
        <Clock3 size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Morning window missed — late gateway open until 11:00 AM</p>
          <p>
            Request Admin or HR to accept a late morning update. If only one slot is submitted
            today, the calendar will show a yellow half day.
          </p>
        </div>
      </div>
    )
  }

  if (currentUpdateSlot) {
    const done = currentUpdateSlot === 'morning' ? morningUpdateToday : eveningUpdateToday
    if (done) {
      return (
        <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px] text-[#15803d]">
          {currentUpdateSlot === 'morning' ? 'Morning' : 'Evening'} update submitted. Next window:{' '}
          {currentUpdateSlot === 'morning' ? '7:00–7:30 PM' : 'tomorrow 10:00–10:30 AM'}.
        </div>
      )
    }
    return (
      <div
        className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px] ${
          trackerDueSoon
            ? 'border border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
            : 'border border-cs-line bg-white text-cs-ink'
        }`}
      >
        <Clock3 size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">
            {currentUpdateSlot === 'morning' ? 'Morning' : 'Evening'} update window is open
          </p>
          <p>
            Submit this slot now
            {currentUpdateSlot === 'morning' ? ' (10:00–10:30 AM)' : ' (7:00–7:30 PM)'}.
          </p>
        </div>
      </div>
    )
  }

  if (trackerOverdue) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Update missed</p>
          <p>
            {!morningUpdateToday ? 'Morning (10:00–10:30 AM) was not submitted. ' : ''}
            {!eveningUpdateToday ? 'Evening (7:00–7:30 PM) was not submitted. ' : ''}
            {isAfterEveningWindow()
              ? 'Send a request below so Admin or a Team Leader can mark today as worked.'
              : 'Updates can be submitted only inside those two windows.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cs-line bg-white px-4 py-3 text-[13px] text-cs-ink">
      <Clock3 size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Two updates every day</p>
        <p>
          Morning 10:00–10:30 AM
          {morningUpdateToday ? ' · done' : ''} · Evening 7:00–7:30 PM
          {eveningUpdateToday ? ' · done' : ''}.
        </p>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project
  onOpen: () => void
}) {
  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[15px] font-bold text-cs-ink">{project.name}</h4>
          <p className="text-[12px] text-cs-muted">{project.client}</p>
        </div>
        <Badge tone="green">Allocated</Badge>
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-cs-muted">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-cs-forest"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>
      <p className="mb-4 line-clamp-2 text-[12px] text-cs-muted">{project.remarks}</p>
      <div className="mb-4 flex -space-x-2">
        {project.team.slice(0, 4).map((m) => (
          <img
            key={m.id}
            src={m.avatar}
            alt={m.name}
            title={m.name}
            className="h-8 w-8 rounded-full border-2 border-white object-cover"
          />
        ))}
      </div>
      <PrimaryButton onClick={onOpen} className="w-full">
        <FolderOpen size={15} /> Open scope card
      </PrimaryButton>
    </Card>
  )
}

export function UserDashboardHome({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  const {
    activeProjects,
    openBlockers,
    hasSubmittedToday,
    morningUpdateToday,
    eveningUpdateToday,
    currentUpdateSlot,
    session,
  } = useApp()
  const [selected, setSelected] = useState<Project | null>(null)
  const myBlockers = openBlockers.filter((b) => b.raisedById === session?.person.id)
  const slotsDone = Number(morningUpdateToday) + Number(eveningUpdateToday)
  const canSubmitNow =
    Boolean(currentUpdateSlot) &&
    !(currentUpdateSlot === 'morning' ? morningUpdateToday : eveningUpdateToday)

  return (
    <div className="space-y-4">
      <TrackerBanner />
      <LateMorningRequestForm />
      <WorkedDayRequestForm />

      <div className="rounded-[22px] bg-cs-forest p-5 text-white shadow-card">
        <p className="text-[13px] text-white/80">Your work progress</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[28px] font-bold leading-none">{activeProjects.length}</p>
            <p className="mt-1 text-[12px] text-white/75">Projects</p>
          </div>
          <div>
            <p className="text-[28px] font-bold leading-none">
              {hasSubmittedToday ? 'Done' : `${slotsDone}/2`}
            </p>
            <p className="mt-1 text-[12px] text-white/75">Today updates</p>
          </div>
          <div>
            <p className="text-[28px] font-bold leading-none">{myBlockers.length}</p>
            <p className="mt-1 text-[12px] text-white/75">Open blockers</p>
          </div>
        </div>
        {canSubmitNow && (
          <button
            type="button"
            onClick={() => onNavigate('tracker')}
            className="mt-4 rounded-xl bg-cs-mint px-4 py-2 text-[13px] font-semibold text-cs-forest"
          >
            Submit {currentUpdateSlot === 'morning' ? 'morning' : 'evening'} update
          </button>
        )}
      </div>

      <UserAttendanceWidgets />

      <UserDashboardWidgets />

      <div>
        <SectionTitle title="Projects allocated to you" />
        {activeProjects.length === 0 ? (
          <EmptyState text="No projects allocated yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ProjectDetailModal project={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export function UserProjectsView() {
  const { myProjects } = useApp()
  const [selected, setSelected] = useState<Project | null>(null)
  const list = myProjects.filter((p) => p.status !== 'closed')

  return (
    <div className="space-y-4">
      <SectionTitle title="My allocated projects" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p)} />
        ))}
      </div>
      {selected && (
        <ProjectDetailModal project={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export function UserTrackerView() {
  const {
    activeProjects,
    updates,
    session,
    addDailyUpdate,
    morningUpdateToday,
    eveningUpdateToday,
    currentUpdateSlot,
  } = useApp()
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || '')
  const [points, setPoints] = useState(['', '', '', ''])
  const [hoursSpent, setHoursSpent] = useState('6')
  const [error, setError] = useState<string | null>(null)

  const mine = useMemo(
    () => updates.filter((u) => u.userId === session?.person.id),
    [updates, session],
  )
  const updateDates = useMemo(
    () => [...new Set(mine.map((u) => u.date))].sort((a, b) => b.localeCompare(a)),
    [mine],
  )
  const [filterDate, setFilterDate] = useState(
    () => updateDates[0] || new Date().toISOString().slice(0, 10),
  )
  const visible = useMemo(
    () =>
      mine
        .filter((u) => u.date === filterDate)
        .sort((a, b) => {
          const slotRank = (slot?: string) => (slot === 'morning' ? 0 : slot === 'evening' ? 1 : 2)
          return slotRank(a.slot) - slotRank(b.slot)
        }),
    [mine, filterDate],
  )
  const olderDate = updateDates.filter((d) => d < filterDate)[0]
  const newerDate = [...updateDates].filter((d) => d > filterDate).at(-1)
  const slotDone =
    currentUpdateSlot === 'morning'
      ? morningUpdateToday
      : currentUpdateSlot === 'evening'
        ? eveningUpdateToday
        : true
  const canSubmit = Boolean(currentUpdateSlot) && !slotDone

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const workPoints = points.map((p) => p.trim()).filter(Boolean)
    if (!projectId || workPoints.length === 0) return
    const result = addDailyUpdate({
      projectId,
      workPoints,
      hoursSpent: Number(hoursSpent) || 0,
    })
    if (result) {
      setError(result)
      return
    }
    setError(null)
    setPoints(['', '', '', ''])
    setFilterDate(new Date().toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-4">
      <TrackerBanner />
      <LateMorningRequestForm />
      <WorkedDayRequestForm />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <SectionTitle title="Submit daily update" />
          <p className="mb-3 text-[12px] text-cs-muted">
            Testers submit twice a day: 10:00–10:30 AM and 7:00–7:30 PM.
          </p>
          <form className="space-y-3" onSubmit={submit}>
            <Field label="Project">
              <select
                className={inputClass}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-cs-muted">Work done today</p>
              <p className="mb-2 text-[12px] text-cs-muted">
                Add one point per line. Four slots are ready; use Add point for more.
              </p>
              <div className="space-y-2">
                {points.map((point, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="mt-2.5 w-5 text-[12px] font-semibold text-cs-muted">
                      {index + 1}.
                    </span>
                    <input
                      className={inputClass}
                      value={point}
                      onChange={(e) => {
                        const next = [...points]
                        next[index] = e.target.value
                        setPoints(next)
                      }}
                      placeholder={`Point ${index + 1}`}
                    />
                    {points.length > 4 && (
                      <button
                        type="button"
                        className="rounded-xl border border-cs-line px-3 text-[12px] font-semibold text-cs-muted"
                        onClick={() => setPoints(points.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-[12px] font-semibold text-cs-forest hover:underline"
                onClick={() => setPoints([...points, ''])}
              >
                + Add point
              </button>
            </div>
            <Field label="Hours spent">
              <input
                className={inputClass}
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value)}
              />
            </Field>
            {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}
            <PrimaryButton type="submit" className="w-full" disabled={!canSubmit}>
              {!currentUpdateSlot
                ? 'Window closed'
                : slotDone
                  ? 'This slot is already submitted'
                  : `Submit ${currentUpdateSlot} update`}
            </PrimaryButton>
          </form>
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle title="My recent updates" />
          <p className="mb-3 text-[12px] text-cs-muted">
            Pick a date to see that day’s morning and evening updates.
          </p>
          <div className="mb-3 flex items-end gap-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cs-line bg-white text-cs-forest disabled:opacity-40"
              onClick={() => olderDate && setFilterDate(olderDate)}
              disabled={!olderDate}
              aria-label="Previous update date"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <Field label="Update date">
                <input
                  className={inputClass}
                  type="date"
                  value={filterDate}
                  min={updateDates[updateDates.length - 1]}
                  max={updateDates[0] || filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              className="mb-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cs-line bg-white text-cs-forest disabled:opacity-40"
              onClick={() => newerDate && setFilterDate(newerDate)}
              disabled={!newerDate}
              aria-label="Next update date"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {visible.length === 0 ? (
            <EmptyState text="No update on this date. Choose another date from the filter." />
          ) : (
            <ul className="space-y-3">
              {visible.map((u) => {
                const project = activeProjects.find((p) => p.id === u.projectId)
                return (
                  <li key={u.id} className="rounded-xl border border-cs-line px-3 py-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-cs-ink">
                        {project?.name || u.projectId}
                      </p>
                      <span className="text-[11px] text-cs-muted">
                        {u.date}
                        {u.late ? ' · Late' : ''}
                        {u.slot === 'morning'
                          ? ' · Morning'
                          : u.slot === 'evening'
                            ? ' · Evening'
                            : ''}{' '}
                        · {u.hoursSpent}h
                      </span>
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-[13px] text-cs-muted">
                      {updatePoints(u).map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export function UserQueriesView() {
  return <QueryChatSession />
}

export function UserLeaveView() {
  return <LeaveRequestPanel />
}

export function UserBlockersView() {
  const { activeProjects, blockers, session, addBlocker } = useApp()
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<BlockerSeverity>('high')

  const mine = blockers.filter((b) => b.raisedById === session?.person.id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!projectId || !title.trim() || !description.trim()) return
    addBlocker({
      projectId,
      title: title.trim(),
      description: description.trim(),
      severity,
    })
    setTitle('')
    setDescription('')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <SectionTitle title="Log a testing blocker" />
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Project">
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-[110px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Field>
          <Field label="Severity">
            <select
              className={inputClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as BlockerSeverity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
          <PrimaryButton type="submit" className="w-full">
            Log blocker
          </PrimaryButton>
        </form>
      </Card>

      <Card className="xl:col-span-3">
        <SectionTitle title="My blockers (highlighted for Team Leader)" />
        {mine.length === 0 ? (
          <EmptyState text="No blockers logged." />
        ) : (
          <ul className="space-y-3">
            {mine.map((b) => (
              <li
                key={b.id}
                className={`rounded-xl border px-3 py-3 ${
                  b.severity === 'critical' || b.severity === 'high'
                    ? 'border-[#fecaca] bg-[#fef2f2]'
                    : 'border-cs-line'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{b.title}</p>
                  <Badge
                    tone={
                      b.severity === 'critical' || b.severity === 'high' ? 'red' : 'yellow'
                    }
                  >
                    {b.severity}
                  </Badge>
                  <Badge tone={b.status === 'open' ? 'red' : 'green'}>{b.status}</Badge>
                </div>
                <p className="text-[12px] text-cs-muted">{b.projectName}</p>
                <p className="mt-1 text-[13px] text-cs-ink">{b.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function UserDashboard({
  active,
  onNavigate,
}: {
  active: NavKey
  onNavigate: (k: NavKey) => void
}) {
  switch (active) {
    case 'projects':
      return <UserProjectsView />
    case 'tracker':
      return <UserTrackerView />
    case 'updates':
      return <UpdatesCalendar />
    case 'queries':
      return <UserQueriesView />
    case 'leave':
      return <UserLeaveView />
    case 'blockers':
      return <UserBlockersView />
    case 'people':
      return <EmployeesHub />
    case 'profile':
      return <TesterProfile />
    default:
      return <UserDashboardHome onNavigate={onNavigate} />
  }
}
