import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Mail, MapPin, Phone } from 'lucide-react'
import {
  CASUAL_LEAVE_MAX,
  isOrgAdmin,
  personLabel,
  roleLabel,
  SICK_LEAVE_MAX,
  useApp,
} from '../context/AppContext'
import { earnedLeaveMax, lifecycleLabel, remainingLeave } from '../hr/peopleOps'
import {
  EXPECTED_DAY_HOURS,
  fourWeekHours,
  inTenure,
  lifetimePerformanceSeries,
  lifetimeScore,
  mondayOnOrBefore,
  profileDayRecord,
  shiftMonday,
} from '../hr/workPerformance'
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
  const { session, updates, leaveRequests, workedDayRequests, updateEmployeeCode, people } = useApp()
  const [cursor, setCursor] = useState(() => new Date())
  const [weekMonday, setWeekMonday] = useState(() => mondayOnOrBefore())
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [code, setCode] = useState(person.employeeCode || '')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)

  useEffect(() => {
    setWeekMonday(mondayOnOrBefore())
    setCode(person.employeeCode || '')
    setCodeMsg(null)
  }, [person.id])
  const isAdmin = isOrgAdmin(session?.person.role)
  const canSeeWorkStats =
    !!session &&
    (isOrgAdmin(session.person.role) ||
      session.person.role === 'tl' ||
      session.person.id === person.id)
  const extras = { updates, workedDays: workedDayRequests }
  const earnedMax = earnedLeaveMax(person.id, updates, workedDayRequests)
  const manager = people.find((p) => p.id === person.managerId)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: startPad + daysInMonth }, (_, i) =>
    i < startPad ? null : i - startPad + 1,
  )

  const series = useMemo(
    () => lifetimePerformanceSeries(person, updates, leaveRequests, workedDayRequests),
    [person, updates, leaveRequests, workedDayRequests],
  )
  const life = lifetimeScore(series)
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const completed = series.filter((row) => row.key < todayKey)
  const thisMonth = series.find((row) => row.key === todayKey)
  const lastComplete = completed[completed.length - 1]
  const prevComplete = completed.length > 1 ? completed[completed.length - 2] : null
  const delta =
    lastComplete && prevComplete ? +(lastComplete.value - prevComplete.value).toFixed(1) : null

  const thisMonday = mondayOnOrBefore()
  const joinMonday = person.joinDate ? mondayOnOrBefore(new Date(`${person.joinDate}T00:00:00`)) : null
  const canWeekForward = weekMonday.getTime() < thisMonday.getTime()
  const earliestMonday = shiftMonday(weekMonday, -3)
  const canWeekBack = !joinMonday || earliestMonday.getTime() > joinMonday.getTime()
  const weeks = useMemo(
    () => fourWeekHours(person, updates, leaveRequests, workedDayRequests, weekMonday),
    [person, updates, leaveRequests, workedDayRequests, weekMonday.getTime()],
  )
  const weeksTotal = weeks.reduce((sum, week) => sum + week.total, 0)
  const maxBar = Math.max(
    EXPECTED_DAY_HOURS,
    ...weeks.flatMap((week) => week.days.map((d) => d.hours)),
  )

  const chart = useMemo(() => {
    const w = 560
    const h = 160
    const pad = 8
    if (series.length === 0) return { w, h, pts: [] as { x: number; y: number; label: string; value: number }[], d: '', area: '' }
    const values = series.map((row) => row.value)
    const min = Math.max(0, Math.min(...values) - 8)
    const max = Math.min(100, Math.max(...values) + 8)
    const pts = series.map((row, i) => {
      const x = series.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (series.length - 1)
      const y = h - pad - ((row.value - min) / (max - min || 1)) * (h - pad * 2)
      return { x, y, label: row.label, value: row.value }
    })
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const area = `${d} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`
    return { w, h, pts, d, area }
  }, [series])

  return (
    <div className="grid min-w-0 items-stretch gap-4 xl:min-h-[calc(100dvh-17rem)] xl:grid-cols-12">
      <div className="min-w-0 space-y-4 xl:col-span-4">
        <Card>
          <img
            src={person.avatar}
            alt=""
            className="mb-4 h-52 w-full rounded-2xl object-cover"
          />
          <h2 className="text-[20px] font-bold text-cs-ink">
            {person.employeeCode ? `${person.employeeCode} ` : ''}
            {person.name}
          </h2>
          <p className="text-[13px] text-cs-muted">
            {person.jobTitle || roleLabel(person.role)}
            {person.department ? ` | ${person.department}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin && person.employeeCode && (
              <Badge tone="forest">{person.employeeCode}</Badge>
            )}
            <Badge tone={person.status === 'inactive' ? 'gray' : 'green'}>
              {person.status === 'inactive' ? 'Inactive' : lifecycleLabel(person.lifecycleStatus)}
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
                  placeholder="CSS001"
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
            <InfoRow label="Reporting manager" value={manager ? personLabel(manager) : '—'} />
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

      <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 xl:col-span-8">
      <div className={`grid shrink-0 min-w-0 items-start gap-4 ${canSeeWorkStats ? 'xl:grid-cols-5' : ''}`}>
      <div className={`min-w-0 space-y-4 ${canSeeWorkStats ? 'xl:col-span-3' : ''}`}>
        <div className="grid min-w-0 gap-3">
          <LeaveStat
            label="Earned Leaves"
            used={Math.max(0, earnedMax - remainingLeave(person, leaveRequests, 'earned', extras))}
            max={earnedMax}
          />
          <LeaveStat
            label="Casual Leaves"
            used={Math.max(0, CASUAL_LEAVE_MAX - remainingLeave(person, leaveRequests, 'casual', extras))}
            max={CASUAL_LEAVE_MAX}
          />
          <LeaveStat
            label="Sick Leaves"
            used={Math.max(0, SICK_LEAVE_MAX - remainingLeave(person, leaveRequests, 'sick', extras))}
            max={SICK_LEAVE_MAX}
          />
          {person.skills?.length ? (
            <div className="flex flex-wrap gap-1">
              {person.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-[#edf7f1] px-2 py-1 text-[11px] font-semibold text-cs-forest">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {canSeeWorkStats && (
        <>
        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-cs-muted">Performance Overview</p>
              {series.length === 0 ? (
                <>
                  <p className="text-[28px] font-bold leading-none text-cs-ink">—</p>
                  <p className="mt-1 text-[12px] font-semibold text-cs-muted">
                    No performance yet. This chart fills from attendance and daily work.
                  </p>
                </>
              ) : (
                <>
              <p className="text-[28px] font-bold leading-none text-cs-ink">{life.score.toFixed(1)}%</p>
              <p className="mt-1 text-[12px] font-semibold text-cs-muted">
                Attendance + daily work from join date
                {person.joinDate ? ` · since ${prettyDate(person.joinDate)}` : ''}
              </p>
              {delta != null && lastComplete && (
                <p
                  className={`mt-1 text-[12px] font-semibold ${
                    delta >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta}% vs {prevComplete?.label} · last full month {lastComplete.value}%
                </p>
              )}
              {thisMonth && (
                <p className="mt-1 text-[12px] text-cs-muted">This month so far {thisMonth.value}%</p>
              )}
                </>
              )}
            </div>
            {series.length > 0 && (
              <Badge tone="forest">{life.months} month{life.months === 1 ? '' : 's'} kept</Badge>
            )}
          </div>
          {series.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-cs-muted">Waiting for daily updates.</p>
          ) : (
          <>
          <div className="relative">
            <svg
              viewBox={`0 0 ${chart.w} ${chart.h}`}
              className="h-40 w-full"
              onMouseLeave={() => setHoverIdx(null)}
            >
              {chart.area && <path d={chart.area} fill="#d4edd9" />}
              {chart.d && <path d={chart.d} fill="none" stroke="#0b4f3c" strokeWidth="3" />}
              {chart.pts.map((p, i) => (
                <circle
                  key={p.label}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIdx === i ? 5 : 3.5}
                  fill="#0b4f3c"
                  onMouseEnter={() => setHoverIdx(i)}
                  className="cursor-pointer"
                />
              ))}
            </svg>
            {hoverIdx != null && chart.pts[hoverIdx] && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-white px-3 py-2 text-[12px] shadow-lg ring-1 ring-black/5"
                style={{
                  left: `${(chart.pts[hoverIdx].x / chart.w) * 100}%`,
                  top: `${(chart.pts[hoverIdx].y / chart.h) * 100}%`,
                  marginTop: -8,
                }}
              >
                <p className="font-semibold text-cs-ink">{chart.pts[hoverIdx].label}</p>
                <p className="text-cs-forest">{chart.pts[hoverIdx].value}%</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-cs-muted">
            Each month is the average of that month’s working days (present / half day / hours logged).
            New daily updates change the current month; earlier months stay on this profile for life.
          </p>
          </>
          )}
        </Card>
        </>
        )}
      </div>

      {canSeeWorkStats && (
      <div className="min-w-0 self-start xl:col-span-2">
        <Card>
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
              const date = isoDate(year, month, day)
              const rec = profileDayRecord(person, date, updates, leaveRequests, workedDayRequests)
              const mark = rec.mark
              const onRoll = inTenure(person, date)
              const tone =
                !onRoll
                  ? 'text-cs-muted/40'
                  : rec.source === 'none'
                  ? 'text-cs-muted/50'
                  : mark === 'present'
                  ? 'bg-[#14b8a6] text-white'
                  : mark === 'half'
                    ? 'bg-[#facc15] text-[#713f12]'
                    : mark === 'leave'
                    ? 'bg-cs-forest text-white'
                    : 'text-cs-ink'
              return (
                <div key={date} className="flex h-9 items-center justify-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold ${tone}`}
                    title={`${date} · ${mark}${rec.hours ? ` · ${rec.hours}h` : ''}`}
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
        </Card>
      </div>
      )}
      </div>

      {canSeeWorkStats && (
        <Card className="flex min-h-[240px] flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-bold text-cs-ink">Hours Logged</h3>
              <p className="text-[11px] text-cs-muted">
                {weeks[0]?.label.split('–')[0].trim()} – {weeks[3]?.label.split('–')[1]?.trim()} · 4 weeks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-semibold text-cs-forest">{weeksTotal.toFixed(1)} hrs</p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7f1] text-cs-forest disabled:opacity-40"
                onClick={() =>
                  setWeekMonday((d) => {
                    const next = shiftMonday(d, -4)
                    if (!joinMonday) return next
                    const windowStart = shiftMonday(next, -3)
                    if (windowStart.getTime() < joinMonday.getTime()) {
                      const clamped = shiftMonday(joinMonday, 3)
                      return clamped.getTime() > thisMonday.getTime() ? thisMonday : clamped
                    }
                    return next
                  })
                }
                disabled={!canWeekBack}
                aria-label="Previous 4 weeks"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf7f1] text-cs-forest disabled:opacity-40"
                onClick={() =>
                  setWeekMonday((d) => {
                    const next = shiftMonday(d, 4)
                    return next.getTime() > thisMonday.getTime() ? thisMonday : next
                  })
                }
                disabled={!canWeekForward}
                aria-label="Next 4 weeks"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {weeks.map((week) => (
              <div key={week.startISO} className="flex min-h-0 flex-1 flex-col">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-cs-ink">{week.label}</p>
                  <p className="text-[11px] font-semibold text-cs-forest">{week.total.toFixed(1)} hrs</p>
                </div>
                <div className="flex min-h-28 flex-1 items-end gap-1.5">
                  {week.days.map((d) => (
                    <div
                      key={d.date}
                      className="flex flex-1 flex-col items-center gap-0.5"
                      title={`${d.label} ${d.date} · ${d.hours}h`}
                    >
                      <span className="text-[9px] font-semibold text-cs-ink">{d.hours || ''}</span>
                      <div
                        className={`w-full rounded-t-md ${
                          d.mark === 'present'
                            ? 'bg-cs-forest'
                            : d.mark === 'half'
                              ? 'bg-[#facc15]'
                              : d.mark === 'leave'
                                ? 'bg-[#86efac]'
                                : 'bg-[#d1d5db]'
                        }`}
                        style={{ height: `${Math.max(d.hours ? 8 : 4, (d.hours / maxBar) * 100)}%` }}
                      />
                      <span className="text-[9px] text-cs-muted">{d.label.slice(0, 3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      </div>
    </div>
  )
}
