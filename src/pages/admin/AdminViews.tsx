import { useState, type FormEvent } from 'react'
import { personLabel, roleLabel, COMPANY_DOMAIN, nextEmployeeCode, OFFICE_LOCATIONS, useApp } from '../../context/AppContext'
import type { NavKey } from '../../components/Sidebar'
import { LeadDashboardWidgets } from '../../components/dashboard/DashboardWidgets'
import { Badge, Card, Field, PrimaryButton, SecondaryButton, SectionTitle, inputClass } from '../../components/ui'
import EmployeeDetails from '../../components/EmployeeDetails'
import type { Role } from '../../types'
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

function HrAddEmployeeForm() {
  const { people, registerEmployee } = useApp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [employeeCode, setEmployeeCode] = useState(() => nextEmployeeCode(people))
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('VAPT')
  const [employmentType, setEmploymentType] = useState('Full-Time')
  const [joinDate, setJoinDate] = useState('')
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setOk(null)
    const error = registerEmployee({
      name,
      email,
      password,
      role,
      employeeCode,
      jobTitle,
      department,
      employmentType,
      joinDate,
      gender,
      dateOfBirth,
      phone,
      location,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setOk(`${name.trim()} was added. They must change the temporary password on first login.`)
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    setEmployeeCode(nextEmployeeCode([...people, { employeeCode }]))
    setJobTitle('')
    setDepartment('VAPT')
    setEmploymentType('Full-Time')
    setJoinDate('')
    setGender('')
    setDateOfBirth('')
    setPhone('')
    setLocation('')
  }

  return (
    <Card>
      <SectionTitle title="Add employee" />
      <p className="mb-3 text-[12px] text-cs-muted">
        HR can create Tester and Team Leader accounts. Use a company email (@{COMPANY_DOMAIN}).
        Temporary password: 8–128 characters with upper, lower, number, and a symbol.
      </p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <Field label="Full name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={`Company email (@${COMPANY_DOMAIN})`}>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name@${COMPANY_DOMAIN}`}
            required
          />
        </Field>
        <Field label="Temporary password">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Field label="Role">
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="user">Tester</option>
            <option value="tl">Team Leader</option>
          </select>
        </Field>
        <Field label="Employee ID">
          <input
            className={inputClass}
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
            placeholder="EMP-007"
            required
          />
        </Field>
        <Field label="Job title">
          <input
            className={inputClass}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Security Analyst"
          />
        </Field>
        <Field label="Department">
          <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label="Employment type">
          <select
            className={inputClass}
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
          >
            <option>Full-Time</option>
            <option>Intern</option>
            <option>Contract</option>
          </select>
        </Field>
        <Field label="Join date">
          <input
            className={inputClass}
            type="date"
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
          />
        </Field>
        <Field label="Gender">
          <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Select</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input
            className={inputClass}
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Location">
            <select className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Select city</option>
              {OFFICE_LOCATIONS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {formError && (
          <p className="md:col-span-2 text-[12px] font-semibold text-red-600">{formError}</p>
        )}
        {ok && <p className="md:col-span-2 text-[12px] font-semibold text-cs-forest">{ok}</p>}
        <PrimaryButton type="submit">Add employee</PrimaryButton>
      </form>
    </Card>
  )
}

function AdminPeople() {
  const { people, renamePerson, updateEmployeeCode, session } = useApp()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const selected = people.find((p) => p.id === selectedId)

  const startEdit = (id: string) => {
    const person = people.find((p) => p.id === id)
    if (!person) return
    setEditingId(id)
    setName(person.name)
    setJobTitle(person.jobTitle || '')
    setEmployeeCode(person.employeeCode || '')
    setFormError(null)
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
    setFormError(null)
    setEditingId(null)
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
      {session?.person.role === 'hr' && <HrAddEmployeeForm />}
      {formError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{formError}</p>
      )}
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
                {(p.role === 'tl' || p.role === 'user') && (
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
