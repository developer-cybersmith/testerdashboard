import type {
  AccessGrant,
  DailyUpdate,
  HistoricalExit,
  ItAsset,
  LeaveBalance,
  LeaveKind,
  LeaveRequest,
  LifecycleStatus,
  PeopleAlert,
  Person,
  Project,
  ShiftTemplate,
  WorkedDayRequest,
} from '../types'

export const EARNED_LEAVE_MAX = 12
export const CASUAL_LEAVE_MAX = 6
export const SICK_LEAVE_MAX = 6
export const ALL_LEAVE_MAX = EARNED_LEAVE_MAX + CASUAL_LEAVE_MAX + SICK_LEAVE_MAX
export const PAID_LEAVE_MAX = EARNED_LEAVE_MAX

export const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'shift-general', name: 'General', start: '10:00', end: '19:00' },
  { id: 'shift-early', name: 'Early', start: '08:30', end: '17:30' },
  { id: 'shift-late', name: 'Late', start: '12:00', end: '21:00' },
]

export const TOOL_CATALOG = ['Jira', 'Burp Cloud', 'Slack', 'SharePoint', 'VPN portal'] as const

export const ONBOARDING_LABELS = [
  'Identity documents collected',
  'Signed contract on file',
  'Bank / PAN details collected',
  'Laptop allotted',
  'ID card issued',
  'VPN access granted',
  'Induction completed',
  'Policy acknowledgement',
]

export const OFFBOARDING_LABELS = [
  'Exit interview',
  'Laptop returned',
  'ID card returned',
  'VPN access revoked',
  'Tool / project access revoked',
  'Full and final initiated',
  'Experience letter',
]

export function defaultLeaveBalance(partial?: Partial<LeaveBalance>): LeaveBalance {
  const next: LeaveBalance = {
    allUsed: 0,
    allMax: ALL_LEAVE_MAX,
    annualUsed: 0,
    annualMax: EARNED_LEAVE_MAX,
    casualUsed: 0,
    casualMax: CASUAL_LEAVE_MAX,
    sickUsed: 0,
    sickMax: SICK_LEAVE_MAX,
    ...partial,
  }
  next.allMax = ALL_LEAVE_MAX
  next.annualMax = EARNED_LEAVE_MAX
  next.casualMax = CASUAL_LEAVE_MAX
  next.sickMax = SICK_LEAVE_MAX
  next.allUsed = next.annualUsed + next.casualUsed + next.sickUsed
  return next
}

export function quotaBucket(kind?: LeaveKind | string): 'earned' | 'sick' | 'casual' | null {
  if (kind === 'sick') return 'sick'
  if (kind === 'casual') return 'casual'
  if (kind === 'paid' || kind === 'earned') return 'earned'
  return null
}

export function leaveKindLabel(kind?: LeaveKind | string) {
  if (kind === 'sick') return 'Sick'
  if (kind === 'casual') return 'Casual'
  if (kind === 'earned' || kind === 'paid') return 'Earned'
  if (kind === 'other') return 'Other'
  return 'Leave'
}

export function leaveCap(bucket: 'earned' | 'sick' | 'casual') {
  if (bucket === 'sick') return SICK_LEAVE_MAX
  if (bucket === 'casual') return CASUAL_LEAVE_MAX
  return EARNED_LEAVE_MAX
}

export function leaveDaysCommitted(
  requests: LeaveRequest[],
  userId: string,
  bucket: 'earned' | 'sick' | 'casual',
  year?: number,
) {
  return requests
    .filter((lv) => {
      if (lv.userId !== userId) return false
      if (lv.status === 'rejected') return false
      if (quotaBucket(lv.kind) !== bucket) return false
      if (year != null && !lv.fromDate.startsWith(String(year))) return false
      return true
    })
    .reduce((sum, lv) => {
      const start = new Date(`${lv.fromDate}T00:00:00`)
      const end = new Date(`${lv.toDate}T00:00:00`)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return sum
      return sum + Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
    }, 0)
}

export function isFirstOrThirdSaturday(iso: string) {
  const day = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(day.getTime()) || day.getDay() !== 6) return false
  const occurrence = Math.ceil(day.getDate() / 7)
  return occurrence === 1 || occurrence === 3
}

export function saturdayCompOffs(
  userId: string,
  updates: DailyUpdate[] = [],
  workedDays: WorkedDayRequest[] = [],
) {
  const dates = new Set<string>()
  updates.forEach((row) => {
    if (row.userId === userId && isFirstOrThirdSaturday(row.date)) dates.add(row.date)
  })
  workedDays.forEach((row) => {
    if (row.userId === userId && row.status === 'approved' && isFirstOrThirdSaturday(row.date)) {
      dates.add(row.date)
    }
  })
  return dates.size
}

export function applyLeaveUsage(
  balance: LeaveBalance | undefined,
  bucket: 'earned' | 'sick' | 'casual',
  days: number,
): LeaveBalance {
  const next = defaultLeaveBalance(balance)
  if (bucket === 'sick') next.sickUsed = Math.min(next.sickMax, next.sickUsed + days)
  else if (bucket === 'casual') next.casualUsed = Math.min(next.casualMax, next.casualUsed + days)
  else next.annualUsed = Math.min(next.annualMax, next.annualUsed + days)
  next.allUsed = next.annualUsed + next.casualUsed + next.sickUsed
  return next
}

export function remainingLeave(
  person: Person,
  requests: LeaveRequest[],
  bucket: 'earned' | 'sick' | 'casual',
  extras?: {
    updates?: DailyUpdate[]
    workedDays?: WorkedDayRequest[]
    today?: Date
  },
) {
  const year = (extras?.today || new Date()).getFullYear()
  const usedThisYear = leaveDaysCommitted(requests, person.id, bucket, year)
  if (bucket === 'sick' || bucket === 'casual') {
    return Math.max(0, leaveCap(bucket) - usedThisYear)
  }
  const saturdayCredits = saturdayCompOffs(person.id, extras?.updates || [], extras?.workedDays || [])
  return Math.max(0, EARNED_LEAVE_MAX + saturdayCredits - usedThisYear)
}

export function earnedLeaveMax(
  personId: string,
  updates: DailyUpdate[] = [],
  workedDays: WorkedDayRequest[] = [],
) {
  return EARNED_LEAVE_MAX + saturdayCompOffs(personId, updates, workedDays)
}

export function lifecycleLabel(status?: LifecycleStatus) {
  if (status === 'onboarding') return 'Onboarding'
  if (status === 'probation') return 'Probation'
  if (status === 'offboarding') return 'Offboarding'
  if (status === 'exited') return 'Exited'
  return 'Confirmed'
}

export function matchesEmployeeSearch(person: Person, query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return true
  const hay = [
    person.name,
    person.email,
    person.employeeCode,
    person.department,
    person.location,
    person.jobTitle,
    person.phone,
    ...(person.skills || []),
    lifecycleLabel(person.lifecycleStatus),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(term)
}

export function shiftLabel(shiftId?: string) {
  const shift = SHIFT_TEMPLATES.find((item) => item.id === shiftId) || SHIFT_TEMPLATES[0]
  return `${shift.name} ${shift.start}–${shift.end}`
}

export function checklistProgress(items: { done: boolean }[]) {
  if (!items.length) return 0
  return Math.round((items.filter((item) => item.done).length / items.length) * 100)
}

function monthDay(iso?: string) {
  return iso && iso.length >= 10 ? iso.slice(5, 10) : ''
}

function daysUntilMonthDay(md: string, today: Date) {
  if (!/^\d{2}-\d{2}$/.test(md)) return null
  const year = today.getFullYear()
  const target = new Date(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5)))
  target.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  if (target < start) target.setFullYear(year + 1)
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

function daysUntilIso(iso: string | undefined, today: Date) {
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

function daysPhrase(n: number) {
  return n === 1 ? '1 day' : `${n} days`
}

function yearsSince(iso: string | undefined, today: Date) {
  if (!iso) return 0
  const start = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  let years = today.getFullYear() - start.getFullYear()
  const hadBirthday =
    today.getMonth() > start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() >= start.getDate())
  if (!hadBirthday) years -= 1
  return Math.max(0, years)
}

export function buildPeopleAlerts(people: Person[], today = new Date()): PeopleAlert[] {
  const alerts: PeopleAlert[] = []
  people
    .filter((p) => p.status !== 'inactive' && p.lifecycleStatus !== 'exited')
    .forEach((person) => {
      const birthdayIn = daysUntilMonthDay(monthDay(person.dateOfBirth), today)
      if (birthdayIn !== null && birthdayIn <= 14) {
        alerts.push({
          id: `bday-${person.id}`,
          kind: 'birthday',
          title: birthdayIn === 0 ? `Birthday today — ${person.name}` : `Birthday in ${daysPhrase(birthdayIn)}`,
          message: `${person.name} · ${person.department || 'Team'}`,
          personId: person.id,
          personName: person.name,
          date: person.dateOfBirth || '',
          urgency: birthdayIn === 0 ? 'today' : 'soon',
        })
      }
      const anniIn = daysUntilMonthDay(monthDay(person.joinDate), today)
      if (anniIn !== null && anniIn <= 14 && yearsSince(person.joinDate, today) >= 1) {
        const shown = anniIn === 0 ? yearsSince(person.joinDate, today) : yearsSince(person.joinDate, today) + 1
        alerts.push({
          id: `anni-${person.id}`,
          kind: 'anniversary',
          title:
            anniIn === 0
              ? `Work anniversary today — ${person.name}`
              : `Work anniversary in ${daysPhrase(anniIn)}`,
          message: `${shown} year${shown === 1 ? '' : 's'} at Cybersmith Secure`,
          personId: person.id,
          personName: person.name,
          date: person.joinDate || '',
          urgency: anniIn === 0 ? 'today' : 'soon',
        })
      }
      const contractIn = daysUntilIso(person.contractEndDate, today)
      if (
        person.role !== 'admin' &&
        contractIn !== null &&
        contractIn >= 0 &&
        contractIn <= 30
      ) {
        alerts.push({
          id: `contract-${person.id}`,
          kind: 'contract',
          title: contractIn === 0 ? 'Contract ends today' : `Contract renewal in ${daysPhrase(contractIn)}`,
          message: `${person.name} · ${person.contractEndDate}`,
          personId: person.id,
          personName: person.name,
          date: person.contractEndDate || '',
          urgency: contractIn <= 7 ? 'today' : 'soon',
        })
      }
    })
  const rank = { today: 0, soon: 1 }
  return alerts.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.title.localeCompare(b.title))
}

export function departmentDistribution(people: Person[]) {
  const counts = new Map<string, number>()
  people
    .filter((p) => p.lifecycleStatus !== 'exited' && p.status !== 'inactive')
    .forEach((p) => {
      const key = p.department || 'Unassigned'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function headcountTrend(people: Person[], exits: HistoricalExit[], months = 6, today = new Date()) {
  const points: { label: string; headcount: number }[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const cursor = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const current = people.filter((p) => {
      if (p.lifecycleStatus === 'exited') return false
      if (!p.joinDate) return true
      return new Date(`${p.joinDate}T00:00:00`) <= end
    }).length
    const stillHereThen = exits.filter((row) => {
      const joined = new Date(`${row.joinDate}T00:00:00`)
      const left = new Date(`${row.leftDate}T00:00:00`)
      return joined <= end && left > end
    }).length
    points.push({
      label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
      headcount: current + stillHereThen,
    })
  }
  return points
}

export function attritionRate(people: Person[], exits: HistoricalExit[], today = new Date()) {
  const yearAgo = new Date(today)
  yearAgo.setFullYear(today.getFullYear() - 1)
  const recentExits = exits.filter((row) => new Date(`${row.leftDate}T00:00:00`) >= yearAgo).length
  const avgHeadcount = Math.max(
    1,
    people.filter((p) => p.lifecycleStatus !== 'exited').length + recentExits / 2,
  )
  return Math.round((recentExits / avgHeadcount) * 1000) / 10
}

export function accessRows(people: Person[], projects: Project[], grants: AccessGrant[], assets: ItAsset[]) {
  return people
    .filter((p) => p.lifecycleStatus !== 'exited')
    .map((person) => {
      const projectNames = projects
        .filter(
          (project) =>
            project.tlId === person.id || project.allocations.some((row) => row.userId === person.id),
        )
        .map((project) => project.name)
      const tools = grants
        .filter((g) => g.personId === person.id && g.scope === 'tool' && g.status === 'active')
        .map((g) => g.name)
      const held = assets.filter((a) => a.personId === person.id && a.status === 'allotted')
      return { person, projectNames, tools, assets: held }
    })
}
