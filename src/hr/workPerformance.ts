import { dayAttendanceMark, slotFromUpdate, type DayAttendance } from '../attendance'
import { isFirstOrThirdSaturday } from './peopleOps'
import type { DailyUpdate, LeaveRequest, Person, WorkedDayRequest } from '../types'

export const EXPECTED_DAY_HOURS = 8

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function isoFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoFromParts(d.getFullYear(), d.getMonth(), d.getDate())
}

export function todayISO(now = new Date()) {
  return isoFromParts(now.getFullYear(), now.getMonth(), now.getDate())
}

export function tenureEnd(person: Person, today = todayISO()) {
  const exit = person.exitDate || person.lastWorkingDate
  if (exit && exit < today) return exit
  return today
}

export function inTenure(person: Person, date: string, today = todayISO()) {
  const join = person.joinDate || date
  const end = tenureEnd(person, today)
  return date >= join && date <= end
}

function weekdayIndex(iso: string) {
  return new Date(`${iso}T00:00:00`).getDay()
}

export function isExpectedWorkDate(iso: string) {
  const day = weekdayIndex(iso)
  if (day === 0) return false
  if (day === 6) return isFirstOrThirdSaturday(iso)
  return true
}

function leaveCoversDate(leaves: LeaveRequest[], userId: string, date: string) {
  return leaves.some(
    (lv) =>
      lv.userId === userId &&
      lv.status === 'approved' &&
      lv.fromDate <= date &&
      lv.toDate >= date,
  )
}

export function hoursOnDate(
  updates: DailyUpdate[],
  workedDays: WorkedDayRequest[] = [],
  userId: string,
  date: string,
) {
  const logged = updates
    .filter((u) => u.userId === userId && u.date === date)
    .reduce((sum, u) => sum + (u.hoursSpent || 0), 0)
  const extra = workedDays
    .filter((row) => row.userId === userId && row.status === 'approved' && row.date === date)
    .reduce((sum, row) => sum + (row.hoursSpent || 0), 0)
  return logged + extra
}

export function profileDayRecord(
  person: Person,
  date: string,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  today = todayISO(),
): { mark: DayAttendance; hours: number; slots: number; source: 'live' | 'none' } {
  if (!inTenure(person, date, today)) {
    return { mark: 'absent', hours: 0, slots: 0, source: 'none' }
  }
  if (leaveCoversDate(leaves, person.id, date)) {
    return { mark: 'leave', hours: 0, slots: 0, source: 'live' }
  }
  const liveHours = hoursOnDate(updates, workedDays, person.id, date)
  const liveMark = dayAttendanceMark(updates, leaves, person.id, date)
  const hasLive =
    liveHours > 0 ||
    liveMark !== 'absent' ||
    updates.some((u) => u.userId === person.id && u.date === date)
  if (hasLive) {
    const slots = updates.filter((u) => u.userId === person.id && u.date === date)
    const morning = slots.some((u) => slotFromUpdate(u) === 'morning')
    const evening = slots.some((u) => slotFromUpdate(u) === 'evening')
    const slotCount = (morning ? 1 : 0) + (evening ? 1 : 0)
    return { mark: liveMark, hours: liveHours, slots: slotCount, source: 'live' }
  }
  return { mark: 'absent', hours: 0, slots: 0, source: 'none' }
}

/** 0–100 for a working day. Leave days return null (not scored). Non-work days return null unless they actually worked. */
export function dayPerformanceScore(
  person: Person,
  date: string,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  today = todayISO(),
) {
  const rec = profileDayRecord(person, date, updates, leaves, workedDays, today)
  if (rec.source === 'none') return null
  if (rec.mark === 'leave') return null
  if (date === today && rec.mark === 'absent' && rec.hours <= 0) return null
  if (date > today) return null
  const expected = isExpectedWorkDate(date)
  if (!expected && rec.hours <= 0 && rec.mark === 'absent') return null

  const attendance =
    rec.mark === 'present' ? 100 : rec.mark === 'half' ? 50 : 0
  const hoursPct = Math.min(1, rec.hours / EXPECTED_DAY_HOURS)
  const slotPct = rec.slots >= 2 || rec.mark === 'present' ? 1 : rec.slots === 1 || rec.mark === 'half' ? 0.45 : 0
  const points = updates
    .filter((u) => u.userId === person.id && u.date === date)
    .reduce((sum, u) => sum + (u.workPoints?.length || 0), 0)
  const pointsPct = Math.min(1, points / 4)
  const work = hoursPct * 70 + slotPct * 20 + pointsPct * 10
  return Math.round(attendance * 0.55 + work * 0.45)
}

export type MonthPerformance = {
  key: string
  label: string
  year: number
  month: number
  value: number
  hours: number
  present: number
  half: number
  absent: number
  scoredDays: number
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function personMonthPerformance(
  person: Person,
  year: number,
  month: number,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  today = todayISO(),
): MonthPerformance {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let total = 0
  let scoredDays = 0
  let hours = 0
  let present = 0
  let half = 0
  let absent = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = isoFromParts(year, month, day)
    if (!inTenure(person, date, today)) continue
    if (date > today) continue
    const rec = profileDayRecord(person, date, updates, leaves, workedDays, today)
    if (date === today && rec.mark === 'absent' && rec.hours <= 0) continue
    hours += rec.hours
    if (rec.mark === 'present') present += 1
    else if (rec.mark === 'half') half += 1
    else if (rec.mark === 'absent' && isExpectedWorkDate(date)) absent += 1
    const score = dayPerformanceScore(person, date, updates, leaves, workedDays, today)
    if (score == null) continue
    total += score
    scoredDays += 1
  }
  const value = scoredDays ? Math.round((total / scoredDays) * 10) / 10 : 0
  const label = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  return {
    key: monthKey(year, month),
    label,
    year,
    month,
    value,
    hours: Math.round(hours * 10) / 10,
    present,
    half,
    absent,
    scoredDays,
  }
}

export function lifetimePerformanceSeries(
  person: Person,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  today = todayISO(),
) {
  const join = person.joinDate || today
  const end = tenureEnd(person, today)
  const start = new Date(`${join}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  const rows: MonthPerformance[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= last) {
    const row = personMonthPerformance(
      person,
      cursor.getFullYear(),
      cursor.getMonth(),
      updates,
      leaves,
      workedDays,
      today,
    )
    if (row.scoredDays > 0 || row.hours > 0) rows.push(row)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return rows
}

export function lifetimeScore(series: MonthPerformance[]) {
  if (!series.length) return { score: 0, previous: null as number | null, hours: 0, months: 0 }
  const hours = series.reduce((sum, row) => sum + row.hours, 0)
  const weighted = series.reduce((sum, row) => sum + row.value * row.scoredDays, 0)
  const days = series.reduce((sum, row) => sum + row.scoredDays, 0)
  const score = days ? Math.round((weighted / days) * 100) / 100 : 0
  const previous = series.length > 1 ? series[series.length - 2].value : null
  return { score, previous, hours: Math.round(hours * 10) / 10, months: series.length }
}

export function monthDailyHours(
  person: Person,
  year: number,
  month: number,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  today = todayISO(),
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const date = isoFromParts(year, month, day)
    const rec = profileDayRecord(person, date, updates, leaves, workedDays, today)
    const score = dayPerformanceScore(person, date, updates, leaves, workedDays, today)
    return {
      day,
      date,
      hours: Math.round(rec.hours * 10) / 10,
      mark: rec.mark,
      score,
      inTenure: inTenure(person, date, today),
    }
  })
}

export function mondayOnOrBefore(date = new Date()) {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

export function shiftMonday(monday: Date, weeks: number) {
  const next = new Date(monday)
  next.setDate(next.getDate() + weeks * 7)
  return next
}

export function weekHourBars(
  person: Person,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  around = new Date(),
) {
  const start = mondayOnOrBefore(around)
  const today = todayISO()
  return WEEKDAYS.map((label, index) => {
    const date = isoFromParts(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const rec = profileDayRecord(person, date, updates, leaves, workedDays, today)
    return { label, date, hours: Math.round(rec.hours * 10) / 10, mark: rec.mark }
  })
}

export function fourWeekHours(
  person: Person,
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  workedDays: WorkedDayRequest[] = [],
  latestMonday = mondayOnOrBefore(),
) {
  return [3, 2, 1, 0].map((back) => {
    const start = shiftMonday(latestMonday, -back)
    const days = weekHourBars(person, updates, leaves, workedDays, start)
    const total = Math.round(days.reduce((sum, d) => sum + d.hours, 0) * 10) / 10
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const from = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const to = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    return {
      startISO: isoFromParts(start.getFullYear(), start.getMonth(), start.getDate()),
      label: `${from} – ${to}`,
      days,
      total,
    }
  })
}
