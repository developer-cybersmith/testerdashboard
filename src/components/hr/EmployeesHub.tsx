import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  COMPANY_DOMAIN,
  isOrgAdmin,
  nextEmployeeCode,
  OFFICE_LOCATIONS,
  personLabel,
  roleLabel,
  useApp,
} from '../../context/AppContext'
import type { AssetKind, Role } from '../../types'
import {
  checklistProgress,
  lifecycleLabel,
  matchesEmployeeSearch,
} from '../../hr/peopleOps'
import EmployeeDetails from '../EmployeeDetails'
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  inputClass,
} from '../ui'

type HubTab = 'directory' | 'lifecycle' | 'performance' | 'assets' | 'payslips'

const TABS: { key: HubTab; label: string }[] = [
  { key: 'directory', label: 'Directory' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'performance', label: 'Performance' },
  { key: 'assets', label: 'IT assets' },
  { key: 'payslips', label: 'Payslips' },
]

function TabBar({ tab, setTab, tabs }: { tab: HubTab; setTab: (key: HubTab) => void; tabs: { key: HubTab; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow-card">
      {tabs.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => setTab(item.key)}
          className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold ${
            tab === item.key ? 'bg-[#edf7f1] text-cs-forest' : 'text-cs-muted hover:text-cs-ink'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function AddEmployeeForm() {
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
  const [managerId, setManagerId] = useState('')
  const [skills, setSkills] = useState('')
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
      managerId,
      skills,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setOk(`${name.trim()} was added and started on onboarding.`)
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    setEmployeeCode(nextEmployeeCode([...people, { employeeCode }]))
    setJobTitle('')
    setSkills('')
    setManagerId('')
  }

  return (
    <Card>
      <SectionTitle title="Add employee" />
      <p className="mb-3 text-[12px] text-cs-muted">
        HR-only. Company email (@{COMPANY_DOMAIN}). Opens an onboarding checklist automatically.
      </p>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <Field label="Full name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={`Company email (@${COMPANY_DOMAIN})`}>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Temporary password">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Role">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="user">Tester</option>
            <option value="tl">Team Leader</option>
          </select>
        </Field>
        <Field label="Employee ID">
          <input className={inputClass} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
        </Field>
        <Field label="Designation">
          <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </Field>
        <Field label="Department">
          <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label="Employment type">
          <select className={inputClass} value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
            <option>Full-Time</option>
            <option>Contract</option>
            <option>Intern</option>
          </select>
        </Field>
        <Field label="Joining date">
          <input className={inputClass} type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
        </Field>
        <Field label="Reporting manager">
          <select className={inputClass} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select</option>
            {people
              .filter((p) => p.role !== 'user' && p.lifecycleStatus !== 'exited')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
          </select>
        </Field>
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
        <Field label="Phone">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Gender">
          <input className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <input className={inputClass} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Skills (comma separated)">
            <input className={inputClass} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Web VAPT, API security" />
          </Field>
        </div>
        {formError && <p className="md:col-span-2 text-[12px] font-semibold text-red-600">{formError}</p>}
        {ok && <p className="md:col-span-2 text-[12px] font-semibold text-cs-forest">{ok}</p>}
        <PrimaryButton type="submit">Add employee</PrimaryButton>
      </form>
    </Card>
  )
}

function DirectoryTab() {
  const { people, session, renamePerson, updateEmployeeCode, directoryFocusId, clearDirectoryFocus } = useApp()
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [role, setRole] = useState('')
  const [skill, setSkill] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const openId = directoryFocusId || selectedId

  const departments = [...new Set(people.map((p) => p.department).filter(Boolean))] as string[]
  const skills = [...new Set(people.flatMap((p) => p.skills || []))]
  const selected = people.find((p) => p.id === openId)
  const managerName = (id?: string) => personLabel(people.find((p) => p.id === id))

  const filtered = people.filter((p) => {
    if (q && !matchesEmployeeSearch(p, q)) return false
    if (department && p.department !== department) return false
    if (location && p.location !== location) return false
    if (role && p.role !== role) return false
    if (skill && !(p.skills || []).includes(skill)) return false
    if (status === 'active' && (p.lifecycleStatus === 'exited' || p.status === 'inactive')) return false
    if (status === 'former' && p.lifecycleStatus !== 'exited' && p.status !== 'inactive') return false
    return true
  })

  if (selected) {
    return (
      <div className="space-y-4">
        <SecondaryButton
          onClick={() => {
            setSelectedId(null)
            clearDirectoryFocus()
          }}
        >
          Back to directory
        </SecondaryButton>
        <EmployeeDetails person={selected} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {session?.person.role === 'hr' && <AddEmployeeForm />}
      <Card>
        <SectionTitle title="Search employees" />
        <p className="mb-3 text-[12px] text-cs-muted">
          Current and former employees stay searchable even after a contract or offboarding ends.
        </p>
        <input
          className={`${inputClass} mb-3`}
          placeholder="Search name, email, employee ID, skill, or former staff"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-5">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All people</option>
            <option value="active">Current</option>
            <option value="former">Former</option>
          </select>
          <select className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">All locations</option>
            {OFFICE_LOCATIONS.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="hr">HR</option>
            <option value="tl">Team Leader</option>
            <option value="user">Tester</option>
          </select>
          <select className={inputClass} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">All skills</option>
            {skills.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </Card>
      {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{formError}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => (
          <Card key={p.id}>
            <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setSelectedId(p.id)}>
              <img src={p.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-cs-ink">{p.name}</p>
                <p className="text-[12px] font-medium text-cs-forest">{p.jobTitle || roleLabel(p.role)}</p>
                <p className="text-[12px] text-cs-muted">{p.department || '—'} · {p.location || '—'}</p>
                <p className="text-[12px] text-cs-muted">Manager: {p.managerId ? managerName(p.managerId) : '—'}</p>
                <p className="text-[12px] text-cs-muted">Joined {p.joinDate || '—'} · {p.phone || p.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={(p.lifecycleStatus === 'exited' || p.status === 'inactive') ? 'red' : 'forest'}>
                    {lifecycleLabel(p.lifecycleStatus)}
                  </Badge>
                  <Badge tone="forest">{roleLabel(p.role)}</Badge>
                  {p.employeeCode && <Badge>{p.employeeCode}</Badge>}
                </div>
                {p.skills?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.skills.slice(0, 3).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </button>
            {editingId === p.id ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  renamePerson(p.id, name, jobTitle)
                  const codeError = updateEmployeeCode(p.id, employeeCode)
                  if (codeError) {
                    setFormError(codeError)
                    return
                  }
                  setFormError(null)
                  setEditingId(null)
                }}
              >
                <Field label="Display name">
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field label="Title">
                  <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </Field>
                <Field label="Employee ID">
                  <input className={inputClass} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())} />
                </Field>
                <div className="flex gap-2">
                  <PrimaryButton type="submit">Save</PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex gap-2">
                <SecondaryButton onClick={() => setSelectedId(p.id)}>View profile</SecondaryButton>
                {(p.role === 'tl' || p.role === 'user') &&
                  session?.person.role === 'hr' &&
                  p.lifecycleStatus !== 'exited' && (
                  <SecondaryButton
                    onClick={() => {
                      setEditingId(p.id)
                      setName(p.name)
                      setJobTitle(p.jobTitle || '')
                      setEmployeeCode(p.employeeCode || '')
                    }}
                  >
                    Rename
                  </SecondaryButton>
                )}
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState text="No matching employees. Try another name or include former staff." />
          </div>
        )}
      </div>
    </div>
  )
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const LIFECYCLE_RANK: Record<string, number> = {
  offboarding: 0,
  onboarding: 1,
  probation: 2,
  confirmed: 3,
  exited: 4,
}

function LifecycleCard({ personId }: { personId: string }) {
  const {
    people,
    checklists,
    session,
    toggleChecklistItem,
    startOffboarding,
    completeOffboarding,
    extendEmploymentPeriod,
    confirmProbation,
  } = useApp()
  const person = people.find((p) => p.id === personId)
  const [lastWorkingDate, setLastWorkingDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  if (!person) return null

  const isHr = session?.person.role === 'hr'
  const canAct = isOrgAdmin(session?.person.role)
  const onboarding = checklists.find((c) => c.personId === person.id && c.kind === 'onboarding')
  const offboarding = checklists.find((c) => c.personId === person.id && c.kind === 'offboarding')
  const status = person.lifecycleStatus || 'confirmed'
  const active =
    status === 'offboarding' ? offboarding : status === 'onboarding' ? onboarding : undefined
  const pct =
    status === 'exited'
      ? 100
      : active
        ? checklistProgress(active.items)
        : status === 'confirmed'
          ? 100
          : 0
  const remaining = active ? active.items.filter((item) => !item.done).length : 0

  const run = (result: string | null, success: string) => {
    if (result) {
      setOk(null)
      setError(result)
      return
    }
    setError(null)
    setOk(success)
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-cs-ink">{person.name}</p>
          <p className="text-[12px] text-cs-muted">
            {lifecycleLabel(person.lifecycleStatus)}
            {person.jobTitle ? ` · ${person.jobTitle}` : ''}
            {status === 'offboarding' && person.lastWorkingDate
              ? ` · Last working day ${person.lastWorkingDate}`
              : ''}
            {status === 'exited' && person.exitDate ? ` · Exited ${person.exitDate}` : ''}
            {person.contractEndDate ? ` · Contract ${person.contractEndDate}` : ''}
            {status === 'probation' && person.probationEndDate
              ? ` · Probation ends ${person.probationEndDate}`
              : ''}
          </p>
        </div>
        <Badge tone={status === 'offboarding' ? 'yellow' : status === 'exited' ? 'red' : 'forest'}>
          {lifecycleLabel(person.lifecycleStatus)}
        </Badge>
      </div>
      {active && (
        <>
          <div className="mb-3 h-2.5 rounded-full bg-gray-100">
            <div className="h-2.5 rounded-full bg-cs-forest" style={{ width: `${pct}%` }} />
          </div>
          <p className="mb-3 text-[12px] text-cs-muted">
            {pct}% {active.kind} complete
            {remaining ? ` · ${remaining} item${remaining === 1 ? '' : 's'} left` : ''}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {active.items.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-[13px] text-cs-ink">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canAct || status === 'exited'}
                    onChange={() => toggleChecklistItem(person.id, active.kind, item.id)}
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {isHr && status !== 'exited' && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label={status === 'offboarding' ? 'New last working date' : 'Last working date (notice)'}>
            <input
              className={inputClass}
              type="date"
              min={addDaysIso(0)}
              value={lastWorkingDate}
              onChange={(e) => setLastWorkingDate(e.target.value)}
            />
          </Field>
          <Field label="New contract end date">
            <input
              className={inputClass}
              type="date"
              min={addDaysIso(1)}
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
            />
          </Field>
        </div>
      )}
      {isHr && status !== 'exited' && (
        <p className="mt-2 text-[12px] text-cs-muted">
          Pick the new date first, then click Extend period. The record updates to the date you selected.
        </p>
      )}

      {error && <p className="mt-3 text-[12px] font-semibold text-red-600">{error}</p>}
      {ok && <p className="mt-3 text-[12px] font-semibold text-cs-forest">{ok}</p>}

      {canAct && status !== 'exited' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {status === 'probation' && (
            <PrimaryButton onClick={() => run(confirmProbation(person.id), 'Employment confirmed.')}>
              Confirm employment
            </PrimaryButton>
          )}
          {isHr && status !== 'offboarding' && (
            <SecondaryButton
              onClick={() => {
                if (!lastWorkingDate) {
                  setError('Select a last working date before starting offboarding')
                  setOk(null)
                  return
                }
                const result = startOffboarding(person.id, lastWorkingDate)
                run(result, 'Offboarding started. You can complete exit without finishing every checklist item.')
                if (!result) setLastWorkingDate('')
              }}
            >
              Start offboarding
            </SecondaryButton>
          )}
          {isHr && (
            <SecondaryButton
              onClick={() => {
                if (!lastWorkingDate && !contractEndDate) {
                  setError('Select the new period date first')
                  setOk(null)
                  return
                }
                const result = extendEmploymentPeriod(person.id, {
                  lastWorkingDate: status === 'offboarding' ? lastWorkingDate || undefined : undefined,
                  contractEndDate: contractEndDate || undefined,
                })
                run(result, 'Period extended to the date you selected.')
                if (!result) {
                  setLastWorkingDate('')
                  setContractEndDate('')
                }
              }}
            >
              Extend period
            </SecondaryButton>
          )}
          {isHr && status === 'offboarding' && (
            <PrimaryButton
              onClick={() =>
                run(completeOffboarding(person.id), 'Exit completed. Assets returned and access revoked.')
              }
            >
              Complete exit
            </PrimaryButton>
          )}
        </div>
      )}
    </Card>
  )
}

function LifecycleTab() {
  const { people } = useApp()
  const rows = [...people]
    .filter((p) => p.role === 'user' || p.role === 'tl' || p.lifecycleStatus)
    .sort(
      (a, b) =>
        (LIFECYCLE_RANK[a.lifecycleStatus || 'confirmed'] ?? 9) -
        (LIFECYCLE_RANK[b.lifecycleStatus || 'confirmed'] ?? 9),
    )

  return (
    <div className="space-y-4">
      {rows.map((person) => (
        <LifecycleCard key={person.id} personId={person.id} />
      ))}
    </div>
  )
}

function PerformanceTab() {
    const { people, reviews, session, submitManagerReview } = useApp()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const isManager = session && (session.person.role === 'tl' || isOrgAdmin(session.person.role))

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const person = people.find((p) => p.id === review.personId)
        if (!person) return null
        const canManage =
          isOrgAdmin(session?.person.role) ||
          (session?.person.role === 'tl' && review.managerId === session.person.id)
        return (
          <Card key={review.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold text-cs-ink">
                  {person.name} · {review.cycle}
                </p>
                <p className="text-[12px] text-cs-muted">
                  Manager: {personLabel(people.find((p) => p.id === review.managerId))}
                </p>
              </div>
              <Badge tone={review.status === 'complete' ? 'green' : review.status === 'self-done' ? 'blue' : 'yellow'}>
                {review.status}
              </Badge>
            </div>
            {review.selfReview && <p className="text-[13px] text-cs-ink">Self: {review.selfReview}</p>}
            {review.managerReview && (
              <p className="mt-1 text-[13px] text-cs-forest">
                Manager: {review.managerReview} {review.rating ? `· ${review.rating}/5` : ''}
              </p>
            )}
            {canManage && review.status !== 'complete' && (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  submitManagerReview(review.id, notes[review.id] || '', Number(ratings[review.id] || 4))
                }}
              >
                <Field label="Manager review">
                  <textarea
                    className={`${inputClass} min-h-[72px]`}
                    value={notes[review.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  />
                </Field>
                <Field label="Rating (1–5)">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={5}
                    value={ratings[review.id] || '4'}
                    onChange={(e) => setRatings((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  />
                </Field>
                <PrimaryButton type="submit">Submit manager review</PrimaryButton>
              </form>
            )}
            {session && isManager && review.status === 'draft' && (
              <p className="mt-2 text-[12px] text-cs-muted">Waiting for the employee self-review.</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function AssetsTab() {
  const { people, assets, allotAsset, closeAsset, session } = useApp()
  const isHr = session?.person.role === 'hr'
  const [personId, setPersonId] = useState(people.find((p) => p.role === 'user')?.id || '')
  const [kind, setKind] = useState<AssetKind>('laptop')
  const [label, setLabel] = useState('')
  const [serial, setSerial] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = allotAsset({ personId, kind, label, serial })
    setError(result)
    if (!result) {
      setLabel('')
      setSerial('')
    }
  }

  return (
    <div className="space-y-4">
      {isHr && (
        <Card>
          <SectionTitle title="Allot IT asset" />
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <Field label="Employee">
              <select className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
                {people
                  .filter((p) => p.lifecycleStatus !== 'exited')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
                <option value="laptop">Laptop</option>
                <option value="id-card">ID card</option>
                <option value="vpn">VPN access</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Label">
              <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
            </Field>
            <Field label="Serial / ID">
              <input className={inputClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
            </Field>
            {error && <p className="md:col-span-2 text-[12px] font-semibold text-red-600">{error}</p>}
            <PrimaryButton type="submit">Allot</PrimaryButton>
          </form>
        </Card>
      )}
      <Card>
        <SectionTitle title="Asset tracker" />
        {error && <p className="mb-2 text-[12px] font-semibold text-red-600">{error}</p>}
        <ul className="space-y-2">
          {assets.map((asset) => {
            const holder = people.find((p) => p.id === asset.personId)
            return (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cs-line px-3 py-2">
                <div>
                  <p className="text-[13px] font-semibold text-cs-ink">
                    {asset.label} · {asset.kind}
                  </p>
                  <p className="text-[12px] text-cs-muted">
                    {holder?.name} · {asset.serial || 'no serial'} · {asset.status}
                  </p>
                </div>
                {isHr && asset.status === 'allotted' && (
                  <div className="flex gap-2">
                    <SecondaryButton
                      onClick={() => {
                        const result = closeAsset(asset.id, 'returned')
                        setError(result)
                      }}
                    >
                      Returned
                    </SecondaryButton>
                    <SecondaryButton
                      onClick={() => {
                        const result = closeAsset(asset.id, 'revoked')
                        setError(result)
                      }}
                    >
                      Revoke
                    </SecondaryButton>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function PayslipsTab() {
  const { people, payslips, uploadPayslip, session } = useApp()
  const isHr = session?.person.role === 'hr'
  const [personId, setPersonId] = useState(people.find((p) => p.role === 'user')?.id || '')
  const [month, setMonth] = useState('2026-09')
  const [error, setError] = useState<string | null>(null)

  const onFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const result = uploadPayslip({
        personId,
        month,
        fileName: file.name,
        dataUrl,
      })
      setError(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      {isHr && (
        <Card>
          <SectionTitle title="Upload payslip PDF" />
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Employee">
              <select className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
                {people
                  .filter((p) => p.role === 'user' || p.role === 'tl')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Month">
              <input className={inputClass} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="PDF">
              <input
                className={inputClass}
                type="file"
                accept="application/pdf"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </Field>
          </div>
          {error && <p className="mt-2 text-[12px] font-semibold text-red-600">{error}</p>}
        </Card>
      )}
      <Card>
        <SectionTitle title="Uploaded payslips" />
        {payslips.length === 0 ? (
          <EmptyState text="No payslips yet." />
        ) : (
          <ul className="space-y-2">
            {payslips.map((slip) => (
              <li key={slip.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cs-line px-3 py-2">
                <p className="text-[13px] font-semibold text-cs-ink">
                  {people.find((p) => p.id === slip.personId)?.name} · {slip.month}
                </p>
                <a className="text-[12px] font-semibold text-cs-forest" href={slip.dataUrl} download={slip.fileName}>
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default function EmployeesHub() {
  const { session, directoryFocusId } = useApp()
  const orgView = isOrgAdmin(session?.person.role)
  const tabs = orgView ? TABS : TABS.filter((item) => item.key === 'directory')
  const [tab, setTab] = useState<HubTab>('directory')

  useEffect(() => {
    if (directoryFocusId) setTab('directory')
  }, [directoryFocusId])

  const body = useMemo(() => {
    if (!orgView) return <DirectoryTab />
    switch (tab) {
      case 'lifecycle':
        return <LifecycleTab />
      case 'performance':
        return <PerformanceTab />
      case 'assets':
        return <AssetsTab />
      case 'payslips':
        return <PayslipsTab />
      default:
        return <DirectoryTab />
    }
  }, [tab, orgView])

  return (
    <div className="space-y-4">
      {tabs.length > 1 && <TabBar tab={tab} setTab={setTab} tabs={tabs} />}
      {body}
    </div>
  )
}
