import type { Blocker, DailyUpdate, LeaveRequest, Project, QueryItem } from './types'

export type DayAttendance = 'present' | 'half' | 'leave' | 'absent'

export function slotFromUpdate(update: DailyUpdate): 'morning' | 'evening' {
  if (update.slot) return update.slot
  const submitted = new Date(update.submittedAt)
  const mins = submitted.getHours() * 60 + submitted.getMinutes()
  return mins < 15 * 60 ? 'morning' : 'evening'
}

export function isLateMorningGateway(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  return mins > 10 * 60 + 30 && mins <= 11 * 60
}

export function slotsOnDate(updates: DailyUpdate[], userId: string, date: string) {
  const mine = updates.filter((u) => u.userId === userId && u.date === date)
  return {
    morning: mine.some((u) => slotFromUpdate(u) === 'morning'),
    evening: mine.some((u) => slotFromUpdate(u) === 'evening'),
    markedWorked: mine.some((u) => u.markedWorked),
  }
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

export function dayAttendanceMark(
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  userId: string,
  date: string,
): DayAttendance {
  if (leaveCoversDate(leaves, userId, date)) return 'leave'
  const slots = slotsOnDate(updates, userId, date)
  if (slots.markedWorked || (slots.morning && slots.evening)) return 'present'
  if (slots.morning || slots.evening) return 'half'
  return 'absent'
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function monthAttendanceMarks(
  updates: DailyUpdate[],
  leaves: LeaveRequest[],
  userId: string,
  year: number,
  month: number,
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const marks: Record<string, DayAttendance> = {}
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = isoDate(year, month, day)
    marks[date] = dayAttendanceMark(updates, leaves, userId, date)
  }
  return marks
}

export function testerAttendanceReport(input: {
  userId: string
  year: number
  month: number
  updates: DailyUpdate[]
  leaves: LeaveRequest[]
  blockers: Blocker[]
  projects: Project[]
  queries: QueryItem[]
}) {
  const { userId, year, month, updates, leaves, blockers, projects, queries } = input
  const prefix = isoDate(year, month, 1).slice(0, 7)
  const marks = monthAttendanceMarks(updates, leaves, userId, year, month)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let present = 0
  let half = 0
  let leave = 0
  let weekdays = 0
  let leaveWeekdays = 0
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = isoDate(year, month, day)
    const weekday = new Date(year, month, day).getDay()
    if (weekday === 0 || weekday === 6) continue
    weekdays += 1
    const mark = marks[date]
    if (mark === 'present') present += 1
    else if (mark === 'half') half += 1
    else if (mark === 'leave') {
      leave += 1
      leaveWeekdays += 1
    }
  }
  const scoredDays = Math.max(0, weekdays - leaveWeekdays)
  const rate = scoredDays ? Math.round(((present + half * 0.5) / scoredDays) * 100) : 0
  const monthUpdates = updates.filter((u) => u.userId === userId && u.date.startsWith(prefix))
  const monthBlockers = blockers.filter(
    (b) => b.raisedById === userId && b.createdAt.slice(0, 7) === prefix,
  )
  const assigned = projects.filter((p) => p.allocations.some((row) => row.userId === userId))
  const projectEngagement = assigned.map((project) => {
    const projectUpdates = monthUpdates.filter((u) => u.projectId === project.id)
    const projectBlockers = monthBlockers.filter((b) => b.projectId === project.id)
    const queryCount = queries.filter(
      (q) =>
        q.projectId === project.id &&
        (q.fromUserId === userId || q.messages?.some((m) => m.senderId === userId)),
    ).length
    return {
      projectId: project.id,
      name: project.name,
      updates: projectUpdates.length,
      hours: projectUpdates.reduce((sum, u) => sum + (u.hoursSpent || 0), 0),
      blockers: projectBlockers.length,
      queries: queryCount,
    }
  })
  return {
    marks,
    present,
    half,
    leave,
    weekdays,
    rate,
    updateCount: monthUpdates.length,
    morningCount: monthUpdates.filter((u) => slotFromUpdate(u) === 'morning').length,
    eveningCount: monthUpdates.filter((u) => slotFromUpdate(u) === 'evening').length,
    blockersFound: monthBlockers.length,
    blockersOpen: monthBlockers.filter((b) => b.status !== 'resolved').length,
    blockersCritical: monthBlockers.filter((b) => b.severity === 'critical' || b.severity === 'high')
      .length,
    projectEngagement,
  }
}
