import { useState, type FormEvent } from 'react'
import {
  COMPANY_DOMAIN,
  nextEmployeeCode,
  personLabel,
  roleLabel,
  useApp,
} from '../../context/AppContext'
import type { NavKey } from '../../components/Sidebar'
import type { Role } from '../../types'
import { LeadDashboardWidgets } from '../../components/dashboard/DashboardWidgets'
import { Badge, Card, Field, PrimaryButton, SecondaryButton, SectionTitle, inputClass } from '../../components/ui'
import EmployeeDetails from '../../components/EmployeeDetails'
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
          {projects.map((p) => (
            <div key={p.id} className="rounded-xl border border-cs-line px-3 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-cs-ink">{p.name}</p>
                  <p className="text-[12px] text-cs-muted">
                    {p.client} · {p.allocations.length} allocated · Start {p.startDate}
                    {p.closureDate ? ` · Closed ${p.closureDate}` : ''}
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
          ))}
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
  const { people, renamePerson, registerEmployee, updateEmployeeCode } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formOk, setFormOk] = useState<string | null>(null)
  const [reg, setReg] = useState({
    name: '',
    localEmail: '',
    password: '',
    role: 'user' as Role,
    jobTitle: '',
    phone: '',
    department: 'VAPT',
    employmentType: 'Full-Time',
    employeeCode: nextEmployeeCode(people),
    joinDate: '',
    gender: '',
    dateOfBirth: '',
    address: '',
  })

  const selected = people.find((p) => p.id === selectedId)

  const startEdit = (id: string) => {
    const person = people.find((p) => p.id === id)
    if (!person) return
    setEditingId(id)
    setName(person.name)
    setJobTitle(person.jobTitle || '')
    setEmployeeCode(person.employeeCode || '')
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!editingId || !name.trim()) return
    renamePerson(editingId, name.trim(), jobTitle.trim())
    const codeError = updateEmployeeCode(editingId, employeeCode)
    if (codeError) {
      setFormError(codeError)
      return
    }
    setEditingId(null)
  }

  const submitRegister = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormOk(null)
    const error = registerEmployee({
      name: reg.name,
      email: `${reg.localEmail}@${COMPANY_DOMAIN}`,
      password: reg.password,
      role: reg.role === 'admin' ? 'user' : reg.role,
      jobTitle: reg.jobTitle,
      phone: reg.phone,
      department: reg.department,
      employmentType: reg.employmentType,
      employeeCode: reg.employeeCode,
      joinDate: reg.joinDate,
      gender: reg.gender,
      dateOfBirth: reg.dateOfBirth,
      address: reg.address,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormOk(`Registered ${reg.name} with ${reg.localEmail}@${COMPANY_DOMAIN}`)
    setReg((prev) => ({
      ...prev,
      name: '',
      localEmail: '',
      password: '',
      jobTitle: '',
      phone: '',
      gender: '',
      dateOfBirth: '',
      address: '',
      employeeCode: nextEmployeeCode([...people, { employeeCode: reg.employeeCode }]),
    }))
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <SecondaryButton onClick={() => setSelectedId(null)}>Back to employees</SecondaryButton>
        <EmployeeDetails person={selected} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Register new employee" />
        <p className="mb-4 text-[13px] text-cs-muted">
          Only Admin can create accounts. Emails must use @{COMPANY_DOMAIN}.
        </p>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={submitRegister}>
          <Field label="Full name">
            <input
              className={inputClass}
              value={reg.name}
              onChange={(e) => setReg({ ...reg, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Company email">
            <div className="flex overflow-hidden rounded-xl border border-cs-line">
              <input
                className="min-w-0 flex-1 px-3 py-2.5 text-[13px] outline-none"
                value={reg.localEmail}
                onChange={(e) =>
                  setReg({ ...reg, localEmail: e.target.value.replace(/@.*$/, '') })
                }
                placeholder="first.last"
                required
              />
              <span className="shrink-0 bg-[#f7f8fa] px-3 py-2.5 text-[12px] font-semibold text-cs-muted">
                @{COMPANY_DOMAIN}
              </span>
            </div>
          </Field>
          <Field label="Temporary password">
            <input
              className={inputClass}
              type="password"
              minLength={8}
              value={reg.password}
              onChange={(e) => setReg({ ...reg, password: e.target.value })}
              required
            />
          </Field>
          <Field label="Role">
            <select
              className={inputClass}
              value={reg.role}
              onChange={(e) => setReg({ ...reg, role: e.target.value as Role })}
            >
              <option value="user">Tester</option>
              <option value="tl">Team Leader</option>
            </select>
          </Field>
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={reg.employeeCode}
              onChange={(e) => setReg({ ...reg, employeeCode: e.target.value.toUpperCase() })}
              placeholder="EMP-001"
              required
            />
          </Field>
          <Field label="Job title">
            <input
              className={inputClass}
              value={reg.jobTitle}
              onChange={(e) => setReg({ ...reg, jobTitle: e.target.value })}
              placeholder="Security Analyst"
            />
          </Field>
          <Field label="Department">
            <input
              className={inputClass}
              value={reg.department}
              onChange={(e) => setReg({ ...reg, department: e.target.value })}
            />
          </Field>
          <Field label="Employment type">
            <select
              className={inputClass}
              value={reg.employmentType}
              onChange={(e) => setReg({ ...reg, employmentType: e.target.value })}
            >
              <option>Full-Time</option>
              <option>Part-Time</option>
              <option>Contract</option>
              <option>Intern</option>
            </select>
          </Field>
          <Field label="Join date">
            <input
              className={inputClass}
              type="date"
              value={reg.joinDate}
              onChange={(e) => setReg({ ...reg, joinDate: e.target.value })}
            />
          </Field>
          <Field label="Gender">
            <input
              className={inputClass}
              value={reg.gender}
              onChange={(e) => setReg({ ...reg, gender: e.target.value })}
            />
          </Field>
          <Field label="Date of birth">
            <input
              className={inputClass}
              type="date"
              value={reg.dateOfBirth}
              onChange={(e) => setReg({ ...reg, dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={reg.phone}
              onChange={(e) => setReg({ ...reg, phone: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Address">
              <input
                className={inputClass}
                value={reg.address}
                onChange={(e) => setReg({ ...reg, address: e.target.value })}
              />
            </Field>
          </div>
          {formError && (
            <p className="md:col-span-2 xl:col-span-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {formError}
            </p>
          )}
          {formOk && (
            <p className="md:col-span-2 xl:col-span-3 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
              {formOk}
            </p>
          )}
          <div className="md:col-span-2 xl:col-span-3">
            <PrimaryButton type="submit">Create employee account</PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <Card key={p.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setSelectedId(p.id)}
            >
              <img src={p.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div>
                <p className="text-[14px] font-semibold text-cs-ink">{p.name}</p>
                {p.jobTitle && (
                  <p className="text-[12px] font-medium text-cs-forest">{p.jobTitle}</p>
                )}
                <p className="text-[12px] text-cs-muted">{p.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="forest">{roleLabel(p.role)}</Badge>
                  {p.employeeCode && <Badge>{p.employeeCode}</Badge>}
                </div>
              </div>
            </button>
            {editingId === p.id ? (
              <form className="mt-3 space-y-2" onSubmit={save}>
                <Field label="Display name">
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Title shown in the app">
                  <input
                    className={inputClass}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Intern, VAPT Intern"
                  />
                </Field>
                <Field label="Employee ID">
                  <input
                    className={inputClass}
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="EMP-001"
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <PrimaryButton type="submit">Save name</PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex gap-2">
                <SecondaryButton onClick={() => setSelectedId(p.id)}>View details</SecondaryButton>
                {p.role !== 'admin' && (
                  <SecondaryButton onClick={() => startEdit(p.id)}>Rename</SecondaryButton>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
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
