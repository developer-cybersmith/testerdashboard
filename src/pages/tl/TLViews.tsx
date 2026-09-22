import { useMemo, useState, type FormEvent } from 'react'
import { isOrgAdmin, personLabel, roleLabel, sortBlockersByPriority, useApp } from '../../context/AppContext'
import TesterProfile from '../../components/TesterProfile'
import EmployeesHub from '../../components/hr/EmployeesHub'
import type { NavKey } from '../../components/Sidebar'
import { REQUIREMENT_STATUS_OPTIONS, type BlockerSeverity, type RequirementStatus } from '../../types'
import { LeadDashboardWidgets } from '../../components/dashboard/DashboardWidgets'
import FilterSelect from '../../components/FilterSelect'
import QueryChatSession from '../../components/QueryChatSession'
import UpdatesCalendar from '../../components/UpdatesCalendar'
import { LeaveRequestPanel } from '../../components/LeaveRequestPanel'
import {
  dateInPeriod,
  listPeriodOptions,
  type DashPeriod,
} from '../../data/periodData'
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  inputClass,
} from '../../components/ui'
import ProjectAccessFields, {
  emptyProjectAccess,
  fromProjectAccess,
  isProjectAccessComplete,
  toProjectAccessPayload,
  type ProjectAccessValues,
} from '../../components/ProjectAccessFields'
import ProjectDetailModal from '../../components/ProjectDetailModal'

function severityTone(severity: string) {
  return severity === 'critical' || severity === 'high' ? 'red' : 'yellow'
}

export function TLOverview() {
  const { updates, openBlockers, queries, discussions } = useApp()
  const openQueries = queries.filter((q) => q.status === 'open')

  return (
    <div className="space-y-4">
      <LeadDashboardWidgets />

      {openBlockers.length > 0 && (
        <Card className="border border-[#fecaca] bg-[#fff7f7]">
          <SectionTitle title="Blockers needing attention" />
          <ul className="space-y-2">
            {openBlockers.slice(0, 4).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-semibold text-cs-ink">{b.title}</p>
                  <p className="text-[12px] text-cs-muted">
                    {b.projectName} · {b.raisedByName}
                  </p>
                </div>
                <Badge tone={severityTone(b.severity)}>{b.severity}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle
            title="Open queries"
            action={
              <Badge tone={openQueries.length ? 'yellow' : 'green'}>
                {openQueries.length}
              </Badge>
            }
          />
          {openQueries.length === 0 ? (
            <EmptyState text="No open queries." />
          ) : (
            <ul className="space-y-2">
              {openQueries.slice(0, 4).map((q) => (
                <li key={q.id} className="rounded-xl border border-cs-line px-3 py-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{q.subject}</p>
                  <p className="text-[12px] text-cs-muted">From {q.fromUserName}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle title="Latest team updates" />
          {updates.slice(0, 4).length === 0 ? (
            <EmptyState text="No updates yet." />
          ) : (
            <ul className="space-y-2">
              {updates.slice(0, 4).map((u) => (
                <li key={u.id} className="rounded-xl border border-cs-line px-3 py-2">
                  <p className="text-[13px] font-semibold text-cs-ink">
                    {u.userName} · {u.date}
                  </p>
                  <p className="text-[13px] text-cs-muted">{u.workDone}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle title="Recent client discussions" />
          {discussions.slice(0, 4).length === 0 ? (
            <EmptyState text="No discussions logged." />
          ) : (
            <ul className="space-y-2">
              {discussions.slice(0, 4).map((d) => (
                <li key={d.id} className="rounded-xl border border-cs-line px-3 py-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{d.date}</p>
                  <p className="text-[13px] text-cs-muted">{d.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export function TLActiveProjects() {
  const { activeProjects, createProject, people, session, updateProjectAssignment } = useApp()
  const groupMembers = people.filter((p) => p.role === 'tl' || p.role === 'user')
  const isAdmin = isOrgAdmin(session?.person.role)
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closureDate, setClosureDate] = useState('')
  const [initialReportDate, setInitialReportDate] = useState('')
  const [closureReportDate, setClosureReportDate] = useState('')
  const [tlId, setTlId] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [access, setAccess] = useState<ProjectAccessValues>(emptyProjectAccess())
  const [showForm, setShowForm] = useState(false)
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null)
  const [editTlId, setEditTlId] = useState('')
  const [editUsers, setEditUsers] = useState<string[]>([])
  const [editAccess, setEditAccess] = useState<ProjectAccessValues>(emptyProjectAccess())
  const [editStartDate, setEditStartDate] = useState('')
  const [editClosureDate, setEditClosureDate] = useState('')
  const [editInitialReportDate, setEditInitialReportDate] = useState('')
  const [editClosureReportDate, setEditClosureReportDate] = useState('')
  const [viewProjectId, setViewProjectId] = useState<string | null>(null)

  const selectedPeople = groupMembers.filter((p) => selectedUsers.includes(p.id))
  const editPeople = groupMembers.filter((p) => editUsers.includes(p.id))

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (!next.includes(tlId)) setTlId(next[0] || '')
      return next
    })
  }

  const toggleEditUser = (id: string) => {
    setEditUsers((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (!next.includes(editTlId)) setEditTlId(next[0] || '')
      return next
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !client.trim() || selectedUsers.length === 0) return
    if (!startDate || !closureDate || !initialReportDate || !closureReportDate) return
    if (isAdmin && !tlId) return
    if (!isProjectAccessComplete(access)) return
    const payload = toProjectAccessPayload(
      access,
      `${session?.person.name || 'Admin'} (${session ? roleLabel(session.person.role) : 'Admin'})`,
    )
    createProject({
      name: name.trim(),
      client: client.trim(),
      tlId: isAdmin ? tlId : session?.person.id || '',
      allocateUserIds: selectedUsers,
      startDate,
      closureDate,
      initialReportDate,
      closureReportDate,
      ...payload,
    })
    setName('')
    setClient('')
    setStartDate('')
    setClosureDate('')
    setInitialReportDate('')
    setClosureReportDate('')
    setTlId('')
    setSelectedUsers([])
    setAccess(emptyProjectAccess())
    setShowForm(false)
  }

  const openAssign = (projectId: string) => {
    const p = activeProjects.find((x) => x.id === projectId)
    if (!p) return
    setAssignProjectId(projectId)
    setEditTlId(p.tlId)
    setEditUsers(Array.from(new Set([...p.allocations.map((a) => a.userId), p.tlId])))
    setEditAccess(fromProjectAccess(p))
    setEditStartDate(p.startDate || '')
    setEditClosureDate(p.closureDate || '')
    setEditInitialReportDate(p.initialReportDate || '')
    setEditClosureReportDate(p.closureReportDate || '')
  }

  const saveAssign = () => {
    if (!assignProjectId || !editTlId || editUsers.length === 0) return
    if (!isProjectAccessComplete(editAccess)) return
    const payload = toProjectAccessPayload(
      editAccess,
      `${session?.person.name || 'Admin'} (${session ? roleLabel(session.person.role) : 'Admin'})`,
    )
    updateProjectAssignment({
      projectId: assignProjectId,
      tlId: isAdmin ? editTlId : activeProjects.find((p) => p.id === assignProjectId)?.tlId || editTlId,
      allocateUserIds: isAdmin
        ? editUsers
        : activeProjects.find((p) => p.id === assignProjectId)?.allocations.map((a) => a.userId) ||
          editUsers,
      startDate: editStartDate,
      closureDate: editClosureDate,
      initialReportDate: editInitialReportDate,
      closureReportDate: editClosureReportDate,
      ...payload,
    })
    setAssignProjectId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle title="All active projects" />
        <PrimaryButton onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : '+ Create & allocate'}
        </PrimaryButton>
      </div>

      {showForm && (
        <Card>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <Field label="Project name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Client">
              <input className={inputClass} value={client} onChange={(e) => setClient(e.target.value)} required />
            </Field>
            <Field label="Start date">
              <input
                className={inputClass}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Closure date">
              <input
                className={inputClass}
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Initial report submission">
              <input
                className={inputClass}
                type="date"
                value={initialReportDate}
                onChange={(e) => setInitialReportDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Closure report date">
              <input
                className={inputClass}
                type="date"
                value={closureReportDate}
                onChange={(e) => setClosureReportDate(e.target.value)}
                required
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Allocate testers in the group">
                <p className="mb-2 text-[12px] text-cs-muted">
                  Select everyone on this project. The Team Leader must be one of these people.
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {groupMembers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                        selectedUsers.includes(u.id)
                          ? 'bg-cs-forest text-white'
                          : 'bg-gray-100 text-cs-muted'
                      }`}
                    >
                      {personLabel(u)}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {isAdmin && (
              <div className="md:col-span-2">
                <Field label="Team Leader (must be one of the allocated testers)">
                  <select
                    className={inputClass}
                    value={tlId}
                    onChange={(e) => setTlId(e.target.value)}
                    required
                    disabled={selectedPeople.length === 0}
                  >
                    <option value="">Select a Team Leader</option>
                    {selectedPeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personLabel(person)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <ProjectAccessFields values={access} onChange={setAccess} />
            <PrimaryButton type="submit">Create project & allocate</PrimaryButton>
          </form>
        </Card>
      )}

      {assignProjectId && (
        <Card>
          <SectionTitle
            title={isAdmin ? 'Reassign people & update project details' : 'Update project details'}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {isAdmin && (
              <>
                <div className="md:col-span-2">
                  <Field label="Testers in the group">
                    <div className="mt-1 flex flex-wrap gap-2">
                      {groupMembers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleEditUser(u.id)}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                            editUsers.includes(u.id)
                              ? 'bg-cs-forest text-white'
                              : 'bg-gray-100 text-cs-muted'
                          }`}
                        >
                          {personLabel(u)}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="Team Leader (from allocated testers)">
                  <select
                    className={inputClass}
                    value={editTlId}
                    onChange={(e) => setEditTlId(e.target.value)}
                    disabled={editPeople.length === 0}
                  >
                    <option value="">Select a Team Leader</option>
                    {editPeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {personLabel(person)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Start date">
              <input
                className={inputClass}
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </Field>
            <Field label="Closure date">
              <input
                className={inputClass}
                type="date"
                value={editClosureDate}
                onChange={(e) => setEditClosureDate(e.target.value)}
              />
            </Field>
            <Field label="Initial report submission">
              <input
                className={inputClass}
                type="date"
                value={editInitialReportDate}
                onChange={(e) => setEditInitialReportDate(e.target.value)}
              />
            </Field>
            <Field label="Closure report date">
              <input
                className={inputClass}
                type="date"
                value={editClosureReportDate}
                onChange={(e) => setEditClosureReportDate(e.target.value)}
              />
            </Field>
            <ProjectAccessFields values={editAccess} onChange={setEditAccess} />
            <div className="flex gap-2 md:col-span-2">
              <PrimaryButton onClick={saveAssign}>Save updates</PrimaryButton>
              <SecondaryButton onClick={() => setAssignProjectId(null)}>Cancel</SecondaryButton>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeProjects.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState text="No active projects yet. Create a project after testers and team leaders are added." />
          </div>
        ) : (
        activeProjects.map((p) => {
          const tlPerson = people.find((x) => x.id === p.tlId)
          const tlName = personLabel(tlPerson)
          return (
            <Card key={p.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-[15px] font-bold text-cs-ink">{p.name}</h4>
                  <p className="text-[12px] text-cs-muted">{p.client}</p>
                  <p className="mt-1 text-[11px] text-cs-muted">
                    Start {p.startDate}
                    {p.closureDate ? ` · Closure ${p.closureDate}` : ''}
                  </p>
                  <p className="text-[11px] text-cs-muted">
                    Initial report {p.initialReportDate || '—'} · Closure report{' '}
                    {p.closureReportDate || '—'}
                  </p>
                </div>
                <Badge tone="green">active</Badge>
              </div>
              <p className="mb-2 text-[12px] text-cs-muted">TL: {tlName}</p>
              <div className="mb-3 h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-cs-mint" style={{ width: `${p.progress}%` }} />
              </div>
              <p className="mb-2 text-[12px] font-semibold text-cs-ink">
                Testers:{' '}
                {p.allocations
                  .map((a) => {
                    const person = people.find((x) => x.id === a.userId)
                    return personLabel(person)
                  })
                  .join(', ')}
              </p>
              <div className="mb-3 flex -space-x-2">
                {p.team.map((m) => (
                  <img key={m.id} src={m.avatar} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => setViewProjectId(p.id)}>
                  View details
                </SecondaryButton>
                <SecondaryButton onClick={() => openAssign(p.id)}>
                  {isAdmin ? 'Assign & update' : 'Update details'}
                </SecondaryButton>
              </div>
            </Card>
          )
        })
        )}
      </div>
      {viewProjectId && activeProjects.find((p) => p.id === viewProjectId) && (
        <ProjectDetailModal
          project={activeProjects.find((p) => p.id === viewProjectId)!}
          onClose={() => setViewProjectId(null)}
        />
      )}
    </div>
  )
}

export function TLUpdatesView() {
  const { updates, projects } = useApp()
  const [period, setPeriod] = useState<DashPeriod>('this-month')
  const filtered = updates.filter((u) => dateInPeriod(u.date, period))

  return (
    <Card>
      <SectionTitle
        title="Every project update"
        action={
          <FilterSelect
            value={period}
            options={listPeriodOptions}
            onChange={setPeriod}
            ariaLabel="Updates period"
          />
        }
      />
      {filtered.length === 0 ? (
        <EmptyState text="No updates in this period." />
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => {
            const project = projects.find((p) => p.id === u.projectId)
            return (
              <li key={u.id} className="rounded-xl border border-cs-line px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-cs-ink">
                    {u.userName} on {project?.name || u.projectId}
                  </p>
                  <span className="text-[11px] text-cs-muted">
                    {u.date} · {u.hoursSpent}h
                  </span>
                </div>
                <p className="text-[13px] text-cs-muted">{u.workDone}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function TLTrackersView() {
  const { activeProjects, updates } = useApp()
  const [period, setPeriod] = useState<DashPeriod>('this-month')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle title="Every project update" />
        <FilterSelect
          value={period}
          options={listPeriodOptions}
          onChange={setPeriod}
          ariaLabel="Updates period"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {activeProjects.map((p) => {
          const projectUpdates = updates.filter(
            (u) => u.projectId === p.id && dateInPeriod(u.date, period),
          )
          return (
            <Card key={p.id}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-cs-ink">{p.name}</h4>
                <Badge tone="forest">{projectUpdates.length} updates</Badge>
              </div>
              {projectUpdates.length === 0 ? (
                <EmptyState text="No updates in this period." />
              ) : (
                <ul className="space-y-2">
                  {projectUpdates.map((u) => (
                    <li key={u.id} className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-[13px]">
                      <span className="font-semibold text-cs-ink">{u.userName}</span>
                      <span className="text-cs-muted"> · {u.date}</span>
                      <p className="mt-1 text-cs-muted">{u.workDone}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function TLRequirementsView() {
  const {
    myProjects,
    session,
    applyRequirementChange,
    updateRequirementStatus,
    requirementRequests,
    approveRequirementChange,
    rejectRequirementChange,
  } = useApp()
  const projects = myProjects.filter((p) => p.status !== 'closed')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Record<string, string>>({})
  const isAdmin = isOrgAdmin(session?.person.role)
  const isTl = session?.person.role === 'tl'

  const addRequirement = (projectId: string) => {
    const text = drafts[projectId]?.trim()
    if (!text) return
    applyRequirementChange({ projectId, action: 'add', newValue: text })
    setDrafts((prev) => ({ ...prev, [projectId]: '' }))
  }

  const saveEdit = (projectId: string, index: number, requirementId: string) => {
    const key = `${projectId}:${requirementId}`
    const text = editing[key]?.trim()
    if (!text) return
    applyRequirementChange({ projectId, action: 'edit', index, newValue: text })
    setEditing((prev) => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  const removeRequirement = (projectId: string, index: number) => {
    applyRequirementChange({ projectId, action: 'delete', index })
  }

  const pending = requirementRequests.filter((r) => r.status === 'pending')
  const myPending = requirementRequests.filter(
    (r) => r.requestedById === session?.person.id,
  )

  return (
    <div className="space-y-4">
      {isTl && (
        <Card className="border border-[#fde68a] bg-[#fffbeb]">
          <p className="text-[13px] text-[#92400e]">
            Team Leader edits/deletes require <strong>Admin approval</strong> before they apply.
            Add/edit/delete will be sent as a request.
          </p>
        </Card>
      )}

      {isAdmin && pending.length > 0 && (
        <Card className="border border-[#fecaca] bg-[#fff7f7]">
          <SectionTitle title="Pending requirement approvals" />
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl bg-white px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{r.projectName}</p>
                  <Badge tone="yellow">{r.action}</Badge>
                  <span className="text-[11px] text-cs-muted">by {r.requestedByName}</span>
                </div>
                {r.oldValue && (
                  <p className="text-[12px] text-cs-muted">From: {r.oldValue}</p>
                )}
                {r.newValue && (
                  <p className="text-[12px] text-cs-forest">To: {r.newValue}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <PrimaryButton onClick={() => approveRequirementChange(r.id)}>
                    Approve
                  </PrimaryButton>
                  <SecondaryButton onClick={() => rejectRequirementChange(r.id)}>
                    Reject
                  </SecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isTl && myPending.length > 0 && (
        <Card>
          <SectionTitle title="My requirement requests" />
          <ul className="space-y-2">
            {myPending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2">
                <span className="text-[13px] text-cs-ink">
                  {r.projectName} · {r.action}
                </span>
                <Badge
                  tone={
                    r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'
                  }
                >
                  {r.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SectionTitle title="Requirements by project" />
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id}>
            <h4 className="mb-3 text-[15px] font-bold text-cs-ink">{p.name}</h4>
            <ul className="mb-3 space-y-2">
              {p.requirements.length === 0 && (
                <li className="rounded-xl bg-[#f7f8fa] px-3 py-3 text-[13px] text-cs-muted">
                  No requirements yet. Add one below.
                </li>
              )}
              {p.requirements.map((r, index) => {
                const key = `${p.id}:${r.id}`
                const isEditing = editing[key] !== undefined
                return (
                  <li key={r.id} className="rounded-xl bg-[#f7f8fa] px-3 py-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          className={`${inputClass} min-h-[70px]`}
                          value={editing[key]}
                          onChange={(e) =>
                            setEditing((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <PrimaryButton onClick={() => saveEdit(p.id, index, r.id)}>
                            {isAdmin ? 'Save' : 'Send for approval'}
                          </PrimaryButton>
                          <SecondaryButton
                            onClick={() =>
                              setEditing((prev) => {
                                const copy = { ...prev }
                                delete copy[key]
                                return copy
                              })
                            }
                          >
                            Cancel
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-[13px] text-cs-ink">{r.text}</p>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditing((prev) => ({ ...prev, [key]: r.text }))
                              }
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-cs-forest hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRequirement(p.id, index)}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[#b91c1c] hover:bg-white"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <select
                          className={inputClass}
                          value={r.status}
                          onChange={(e) =>
                            updateRequirementStatus(
                              p.id,
                              r.id,
                              e.target.value as RequirementStatus,
                            )
                          }
                          aria-label={`Status for ${r.text}`}
                        >
                          {REQUIREMENT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={inputClass}
                placeholder="Add a requirement..."
                value={drafts[p.id] || ''}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRequirement(p.id)
                  }
                }}
              />
              <PrimaryButton onClick={() => addRequirement(p.id)} className="shrink-0">
                {isAdmin ? 'Add' : 'Add (needs approval)'}
              </PrimaryButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function TLDiscussionsView() {
  const { discussions, activeProjects, projects, addDiscussion, session } = useApp()
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || '')
  const [participants, setParticipants] = useState('')
  const [summary, setSummary] = useState('')
  const [outcome, setOutcome] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!projectId || !participants.trim() || !summary.trim()) return
    addDiscussion({
      projectId,
      date: new Date().toISOString().slice(0, 10),
      participants: participants.trim(),
      summary: summary.trim(),
      outcome: outcome.trim() || undefined,
      loggedBy: session?.person.name || 'Team Leader',
    })
    setParticipants('')
    setSummary('')
    setOutcome('')
  }

  const rows = useMemo(
    () =>
      discussions.map((d) => ({
        ...d,
        projectName: projects.find((p) => p.id === d.projectId)?.name || d.projectId,
      })),
    [discussions, projects],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <SectionTitle title="Log client discussion" />
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Project">
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Client Participants">
            <input className={inputClass} value={participants} onChange={(e) => setParticipants(e.target.value)} required />
          </Field>
          <Field label="Discussion summary">
            <textarea className={`${inputClass} min-h-[100px]`} value={summary} onChange={(e) => setSummary(e.target.value)} required />
          </Field>
          <Field label="Outcome">
            <input className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
          <PrimaryButton type="submit" className="w-full">
            Save discussion log
          </PrimaryButton>
        </form>
      </Card>
      <Card className="xl:col-span-3">
        <SectionTitle title="Client discussions (separate log)" />
        {rows.length === 0 ? (
          <EmptyState text="No client discussions logged." />
        ) : (
          <ul className="space-y-3">
            {rows.map((d) => (
              <li key={d.id} className="rounded-xl border border-cs-line px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone="forest">{d.projectName}</Badge>
                  <span className="text-[11px] text-cs-muted">{d.date}</span>
                </div>
                <p className="text-[12px] font-semibold text-cs-ink">{d.participants}</p>
                <p className="mt-1 text-[13px] text-cs-muted">{d.summary}</p>
                {d.outcome && (
                  <p className="mt-2 text-[12px] font-medium text-cs-forest">Outcome: {d.outcome}</p>
                )}
                <p className="mt-1 text-[11px] text-cs-muted">Logged by {d.loggedBy}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function TLLifecycleView() {
  const {
    myProjects,
    setProjectStatus,
    requestProjectStatusChange,
    decideProjectStatusRequest,
    projectStatusRequests,
    session,
  } = useApp()
  const isAdmin = isOrgAdmin(session?.person.role)
  const [holdProjectId, setHoldProjectId] = useState<string | null>(null)
  const [closeProjectId, setCloseProjectId] = useState<string | null>(null)
  const [reopenProjectId, setReopenProjectId] = useState<string | null>(null)
  const [holdSource, setHoldSource] = useState<'client' | 'internal'>('client')
  const [remark, setRemark] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pending = projectStatusRequests.filter((r) => r.status === 'pending')
  const pendingFor = (projectId: string) =>
    pending.find((r) => r.projectId === projectId)

  const resetForms = () => {
    setHoldProjectId(null)
    setCloseProjectId(null)
    setReopenProjectId(null)
    setRemark('')
    setHoldSource('client')
    setError(null)
  }

  const sendRequest = (projectId: string, action: 'on-hold' | 'closed' | 'active') => {
    if (!remark.trim()) {
      setError('A remark is required')
      return
    }
    const result = requestProjectStatusChange({
      projectId,
      action,
      remark: remark.trim(),
      holdSource: action === 'on-hold' ? holdSource : undefined,
    })
    if (result) {
      setError(result)
      return
    }
    resetForms()
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Start and closure of projects" />
      {isAdmin && pending.length > 0 && (
        <Card>
          <SectionTitle title="Pending hold / closure requests" />
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl border border-cs-line px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{r.projectName}</p>
                  <Badge tone="yellow">
                    {r.action === 'on-hold' ? 'Hold' : r.action === 'closed' ? 'Close' : 'Reopen'}
                  </Badge>
                  <span className="text-[11px] text-cs-muted">by {r.requestedByName}</span>
                </div>
                {r.holdSource && (
                  <p className="text-[12px] text-cs-muted">
                    {r.holdSource === 'internal' ? 'From our side' : 'From client side'}
                  </p>
                )}
                <p className="mt-1 text-[13px] text-cs-ink">{r.remark}</p>
                <div className="mt-3 flex gap-2">
                  <PrimaryButton onClick={() => decideProjectStatusRequest(r.id, 'approve')}>
                    Approve
                  </PrimaryButton>
                  <SecondaryButton onClick={() => decideProjectStatusRequest(r.id, 'reject')}>
                    Reject
                  </SecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {myProjects.map((p) => {
          const waiting = pendingFor(p.id)
          return (
            <Card key={p.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-[15px] font-bold text-cs-ink">{p.name}</h4>
                  <p className="text-[12px] text-cs-muted">{p.client}</p>
                </div>
                <Badge
                  tone={
                    p.status === 'active' ? 'green' : p.status === 'closed' ? 'gray' : 'yellow'
                  }
                >
                  {p.status}
                </Badge>
              </div>
              <p className="text-[12px] text-cs-muted">Start: {p.startDate}</p>
              <p className="mb-3 text-[12px] text-cs-muted">Closure: {p.closureDate || '—'}</p>
              {p.status === 'on-hold' && (
                <p className="mb-3 rounded-xl bg-[#fff8e8] px-3 py-2 text-[12px] text-cs-ink">
                  Hold from {p.holdSource === 'internal' ? 'our side' : 'client side'}
                  {p.holdRemark ? ` — ${p.holdRemark}` : ''}
                </p>
              )}
              {p.closureRemark && p.status === 'closed' && (
                <p className="mb-3 rounded-xl bg-gray-50 px-3 py-2 text-[12px] text-cs-ink">
                  Close remark: {p.closureRemark}
                </p>
              )}
              {waiting && (
                <p className="mb-3 rounded-xl bg-[#edf7f1] px-3 py-2 text-[12px] text-cs-forest">
                  Waiting for Admin: {waiting.action === 'on-hold' ? 'hold' : waiting.action === 'closed' ? 'close' : 'reopen'} — {waiting.remark}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {isAdmin && p.status === 'on-hold' && (
                  <PrimaryButton onClick={() => setProjectStatus(p.id, 'active')}>
                    Cancel hold
                  </PrimaryButton>
                )}
                {isAdmin && p.status === 'closed' && (
                  <PrimaryButton onClick={() => setProjectStatus(p.id, 'active')}>
                    Start / Reopen
                  </PrimaryButton>
                )}
                {isAdmin && p.status === 'active' && holdProjectId !== p.id && (
                  <SecondaryButton onClick={() => { resetForms(); setHoldProjectId(p.id) }}>
                    Hold
                  </SecondaryButton>
                )}
                {isAdmin && p.status !== 'closed' && closeProjectId !== p.id && (
                  <button
                    type="button"
                    onClick={() => { resetForms(); setCloseProjectId(p.id) }}
                    className="rounded-xl bg-[#ef4444] px-4 py-2.5 text-[13px] font-semibold text-white"
                  >
                    Close project
                  </button>
                )}
                {!isAdmin && !waiting && p.status === 'on-hold' && (
                  <PrimaryButton onClick={() => { resetForms(); setReopenProjectId(p.id) }}>
                    Request reopen
                  </PrimaryButton>
                )}
                {!isAdmin && !waiting && p.status === 'closed' && (
                  <PrimaryButton onClick={() => { resetForms(); setReopenProjectId(p.id) }}>
                    Request reopen
                  </PrimaryButton>
                )}
                {!isAdmin && !waiting && p.status === 'active' && holdProjectId !== p.id && (
                  <SecondaryButton onClick={() => { resetForms(); setHoldProjectId(p.id) }}>
                    Request hold
                  </SecondaryButton>
                )}
                {!isAdmin && !waiting && p.status !== 'closed' && closeProjectId !== p.id && (
                  <button
                    type="button"
                    onClick={() => { resetForms(); setCloseProjectId(p.id) }}
                    className="rounded-xl bg-[#ef4444] px-4 py-2.5 text-[13px] font-semibold text-white"
                  >
                    Request close
                  </button>
                )}
              </div>
              {(holdProjectId === p.id || closeProjectId === p.id || reopenProjectId === p.id) && (
                <div className="mt-3 space-y-2 rounded-xl border border-cs-line p-3">
                  {holdProjectId === p.id && (
                    <Field label="Hold source">
                      <select
                        className={inputClass}
                        value={holdSource}
                        onChange={(e) => setHoldSource(e.target.value as 'client' | 'internal')}
                      >
                        <option value="client">From Client side</option>
                        <option value="internal">From Our Side</option>
                      </select>
                    </Field>
                  )}
                  <Field label="Remark">
                    <textarea
                      className={`${inputClass} min-h-[80px]`}
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="Write why this project should be held, closed, or reopened"
                      required
                    />
                  </Field>
                  {error && <p className="text-[12px] text-red-700">{error}</p>}
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <PrimaryButton
                        onClick={() => {
                          if (!remark.trim()) {
                            setError('A remark is required')
                            return
                          }
                          if (holdProjectId === p.id) {
                            setProjectStatus(p.id, 'on-hold', {
                              holdSource,
                              holdRemark: remark.trim(),
                            })
                          } else if (closeProjectId === p.id) {
                            setProjectStatus(p.id, 'closed', { closureRemark: remark.trim() })
                          } else {
                            setProjectStatus(p.id, 'active')
                          }
                          resetForms()
                        }}
                      >
                        {holdProjectId === p.id
                          ? 'Hold now'
                          : closeProjectId === p.id
                            ? 'Close now'
                            : 'Reopen now'}
                      </PrimaryButton>
                    ) : (
                      <PrimaryButton
                        onClick={() =>
                          sendRequest(
                            p.id,
                            holdProjectId === p.id
                              ? 'on-hold'
                              : closeProjectId === p.id
                                ? 'closed'
                                : 'active',
                          )
                        }
                      >
                        Send request to Admin
                      </PrimaryButton>
                    )}
                    <SecondaryButton onClick={resetForms}>Cancel</SecondaryButton>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function TLBlockersView() {
  const { blockers, updateBlockerStatus, addBlocker, myProjects, session } = useApp()
  const [projectId, setProjectId] = useState(myProjects[0]?.id || '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<BlockerSeverity>('high')
  const [error, setError] = useState<string | null>(null)
  const ranked = sortBlockersByPriority(blockers)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!projectId || !title.trim() || !description.trim()) return
    const result = addBlocker({
      projectId,
      title: title.trim(),
      description: description.trim(),
      severity,
    })
    if (result) {
      setError(result)
      return
    }
    setError(null)
    setTitle('')
    setDescription('')
  }

  return (
    <div className="space-y-4">
      {session?.person.role === 'tl' && (
        <Card>
          <SectionTitle title="Raise a Team Leader blocker" />
          <p className="mb-3 text-[12px] text-cs-muted">
            Team Leader blockers appear first and with higher priority in project details.
          </p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <Field label="Project">
              <select
                className={inputClass}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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
            <div className="md:col-span-2">
              <Field label="Title">
                <input
                  className={inputClass}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Description">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Field>
            </div>
            {error && <p className="md:col-span-2 text-[12px] font-semibold text-red-600">{error}</p>}
            <div className="md:col-span-2">
              <PrimaryButton type="submit">Raise blocker</PrimaryButton>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <SectionTitle title="Blockers" />
        {ranked.length === 0 ? (
          <EmptyState text="No blockers logged." />
        ) : (
          <ul className="space-y-3">
            {ranked.map((b) => (
              <li
                key={b.id}
                className={`rounded-xl border px-3 py-3 ${
                  b.raisedByRole === 'tl'
                    ? 'border-[#f59e0b] bg-[#fffbeb]'
                    : b.status !== 'resolved' && (b.severity === 'critical' || b.severity === 'high')
                      ? 'border-[#fecaca] bg-[#fef2f2]'
                      : 'border-cs-line'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-cs-ink">{b.title}</p>
                  {b.raisedByRole === 'tl' && <Badge tone="yellow">Team Leader · high priority</Badge>}
                  <Badge tone={severityTone(b.severity)}>{b.severity}</Badge>
                  <Badge tone={b.status === 'resolved' ? 'green' : 'red'}>{b.status}</Badge>
                </div>
                <p className="text-[12px] text-cs-muted">
                  {b.projectName} · raised by {b.raisedByName}
                </p>
                <p className="mt-1 text-[13px] text-cs-ink">{b.description}</p>
                {b.status !== 'resolved' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => updateBlockerStatus(b.id, 'in-review')}>
                      Mark in review
                    </SecondaryButton>
                    <PrimaryButton onClick={() => updateBlockerStatus(b.id, 'resolved')}>
                      Resolve
                    </PrimaryButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export function TLQueriesView() {
  return <QueryChatSession />
}

export function TLDashboard({ active }: { active: NavKey }) {
  switch (active) {
    case 'projects':
      return <TLActiveProjects />
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
      return <EmployeesHub />
    case 'profile':
      return <TesterProfile />
    default:
      return <TLOverview />
  }
}
