import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Phone,
  Share2,
} from 'lucide-react'
import { PAID_LEAVE_MAX, isOrgAdmin, personLabel, roleLabel, useApp } from '../context/AppContext'
import { dayAttendanceMark } from '../attendance'
import type { Person } from '../types'
import { Badge, Card, Field, PrimaryButton, inputClass } from './ui'

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

function prettyDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function ringStyle(used: number, max: number) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  return {
    background: `conic-gradient(#0b4f3c ${pct * 3.6}deg, #e8eaed 0deg)`,
  }
}

function LeaveStat({
  label,
  used,
  max,
}: {
  label: string
  used: number
  max: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f7f8fa] px-3 py-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={ringStyle(used, max)}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-bold text-cs-forest">
          {used}
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold text-cs-ink">{label}</p>
        <p className="text-[11px] text-cs-muted">
          {used}/{max} Days
        </p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[12px] text-cs-muted">{label}</span>
      <span className="min-w-0 break-all text-right text-[13px] font-semibold text-cs-ink">
        {value}
      </span>
    </div>
  )
}

export default function EmployeeDetails({ person }: { person: Person }) {
  const { session, updates, leaveRequests, updateEmployeeCode } = useApp()
  const [cursor, setCursor] = useState(() => new Date(2026, 7, 1))
  const [code, setCode] = useState(person.employeeCode || '')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  const isAdmin = isOrgAdmin(session?.person.role)
  const score = person.performanceScore ?? 80
  const leave = person.leaveBalance || {
    allUsed: 0,
    allMax: PAID_LEAVE_MAX,
    annualUsed: 0,
    annualMax: PAID_LEAVE_MAX,
    casualUsed: 0,
    casualMax: 0,
    sickUsed: 0,
    sickMax: PAID_LEAVE_MAX,
  }

  const mine = updates.filter((u) => u.userId === person.id)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: startPad + daysInMonth }, (_, i) =>
    i < startPad ? null : i - startPad + 1,
  )

  const weekHours = useMemo(() => {
    const start = startOfWeek(new Date(2026, 7, 18))
    const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const seed = person.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
    return labels.map((label, index) => {
      const date = isoDate(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const logged = mine.filter((u) => u.date === date).reduce((sum, u) => sum + u.hoursSpent, 0)
      const demo = index >= 5 ? 0 : 5 + ((seed + index * 3) % 4)
      return { label, hours: logged || demo, date }
    })
  }, [mine, person.id])

  const weekTotal = weekHours.reduce((sum, d) => sum + d.hours, 0)
  const maxBar = Math.max(8, ...weekHours.map((d) => d.hours))

  const chart = useMemo(() => {
    const values = MONTHS.map((_, i) => {
      const wave = Math.sin(i / 1.6) * 5
      return Math.max(62, Math.min(98, score - 10 + (i / 11) * 8 + wave))
    })
    const w = 560
    const h = 160
    const step = w / (values.length - 1)
    const y = (v: number) => h - ((v - 60) / 40) * (h - 16)
    const d = values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${y(v)}`)
      .join(' ')
    const area = `${d} L ${w} ${h} L 0 ${h} Z`
    return { values, d, area, w, h, y, step }
  }, [score])

  const dayMark = (day: number) => {
    const date = isoDate(year, month, day)
    return dayAttendanceMark(updates, leaveRequests, person.id, date)
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-12">
      <div className="min-w-0 space-y-4 xl:col-span-3">
        <Card>
          <img
            src={person.avatar}
            alt=""
            className="mb-4 h-44 w-full rounded-2xl object-cover"
          />
          <h2 className="text-[20px] font-bold text-cs-ink">{person.name}</h2>
          <p className="text-[13px] text-cs-muted">
            {person.jobTitle || roleLabel(person.role)}
            {person.department ? ` | ${person.department}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin && person.employeeCode && (
              <Badge tone="forest">{person.employeeCode}</Badge>
            )}
            <Badge tone={person.status === 'inactive' ? 'gray' : 'green'}>
              {person.status === 'inactive' ? 'Inactive' : 'Active'}
            </Badge>
          </div>
          {isAdmin && (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                const result = updateEmployeeCode(person.id, code)
                setCodeMsg(result || 'Employee ID updated')
              }}
            >
              <Field label="Employee ID">
                <input
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="EMP-001"
                />
              </Field>
              <PrimaryButton type="submit" className="!py-2">
                Save employee ID
              </PrimaryButton>
              {codeMsg && <p className="text-[12px] text-cs-muted">{codeMsg}</p>}
            </form>
          )}
          <div className="mt-4 divide-y divide-cs-line text-[13px]">
            <InfoRow label="Employment Type" value={person.employmentType || 'Full-Time'} />
            <InfoRow label="Join Date" value={prettyDate(person.joinDate)} />
          </div>
          <div className="mt-4 flex gap-2">
            {[Share2, Globe, Mail].map((Icon, i) => (
              <span
                key={i}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf7f1] text-cs-forest"
              >
                <Icon size={15} />
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 text-[15px] font-bold text-cs-ink">Personal Info</h3>
          <div className="divide-y divide-cs-line">
            <InfoRow label="Gender" value={person.gender || '—'} />
            <InfoRow label="Date of Birth" value={prettyDate(person.dateOfBirth)} />
            <div className="min-w-0 py-2.5">
              <p className="text-[12px] text-cs-muted">Email Address</p>
              <p className="mt-1 flex min-w-0 items-start gap-2 text-[13px] font-semibold text-cs-ink">
                <Mail size={14} className="mt-0.5 shrink-0 text-cs-forest" />
                <span className="min-w-0 break-all">{person.email}</span>
              </p>
            </div>
            <div className="min-w-0 py-2.5">
              <p className="text-[12px] text-cs-muted">Phone</p>
              <p className="mt-1 flex min-w-0 items-start gap-2 text-[13px] font-semibold text-cs-ink">
                <Phone size={14} className="mt-0.5 shrink-0 text-cs-forest" />
                <span className="min-w-0 break-all">{person.phone || '—'}</span>
              </p>
            </div>
            <div className="min-w-0 py-2.5">
              <p className="text-[12px] text-cs-muted">Location</p>
              <p className="mt-1 flex min-w-0 items-start gap-2 text-[13px] font-semibold text-cs-ink">
                <MapPin size={14} className="mt-0.5 shrink-0 text-cs-forest" />
                <span className="min-w-0 break-words">{person.location || '—'}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-4 xl:col-span-6">
        <div className="grid min-w-0 gap-3">
          <LeaveStat
            label="Paid leave (annual / sick)"
            used={Math.min(PAID_LEAVE_MAX, leave.annualUsed)}
            max={PAID_LEAVE_MAX}
          />
          <p className="text-[12px] leading-relaxed text-cs-muted">
            12 paid leaves per year. Any other leave is decided by the Team Leader and Admin on
            approval and does not use this quota.
          </p>
        </div>

        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-cs-muted">Performance Overview</p>
              <p className="text-[28px] font-bold leading-none text-cs-ink">{score.toFixed(2)}%</p>
              <p className="mt-1 text-[12px] font-semibold text-emerald-600">
                +2.01% increased by last year
              </p>
            </div>
            <Badge tone="forest">Avg 2025 {(score - 6).toFixed(1)}%</Badge>
          </div>
          <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="h-40 w-full">
            <path d={chart.area} fill="#d4edd9" />
            <path d={chart.d} fill="none" stroke="#0b4f3c" strokeWidth="3" />
            {chart.values.map((v, i) => (
              <circle key={MONTHS[i]} cx={i * chart.step} cy={chart.y(v)} r="3.5" fill="#0b4f3c" />
            ))}
          </svg>
          <div className="mt-1 grid grid-cols-12 text-center text-[10px] text-cs-muted">
            {MONTHS.map((m) => (
              <span key={m}>{m.slice(0, 3)}</span>
            ))}
          </div>
        </Card>

        <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-cs-ink">Hours Logged</h3>
              <p className="text-[12px] font-semibold text-cs-forest">
                {weekTotal.toFixed(0)} / 30 hrs
              </p>
            </div>
            <p className="mb-3 text-[11px] text-cs-muted">This Week</p>
            <div className="flex h-36 items-end gap-2">
              {weekHours.map((d) => (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-cs-forest"
                    style={{ height: `${Math.max(8, (d.hours / maxBar) * 100)}%` }}
                  />
                  <span className="text-[10px] text-cs-muted">{d.label.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </Card>
      </div>

      <div className="min-w-0 xl:col-span-3">
        <Card className="h-full">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-cs-ink">
              {MONTHS[month]} {year}
            </h3>
            <div className="flex gap-1">
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
              const mark = dayMark(day)
              const tone =
                mark === 'present'
                  ? 'bg-[#14b8a6] text-white'
                  : mark === 'half'
                    ? 'bg-[#facc15] text-[#713f12]'
                    : mark === 'leave'
                    ? 'bg-cs-forest text-white'
                    : 'text-cs-ink'
              return (
                <div key={isoDate(year, month, day)} className="flex h-9 items-center justify-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold ${tone}`}
                  >
                    {day}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-cs-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" /> Present
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" /> Half day
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-cs-forest" /> On Leave
            </span>
          </div>
          <p className="mt-6 text-[12px] leading-relaxed text-cs-muted">
            Viewing {personLabel(person)}. Payroll is not shown on employee records.
          </p>
        </Card>
      </div>
    </div>
  )
}
