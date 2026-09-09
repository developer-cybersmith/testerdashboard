import type { EmploymentMetrics, TaskTrack } from '../types'

export type DashPeriod =
  | 'this-week'
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-quarter'
  | 'this-year'
  | 'all-time'

export const periodOptions: { value: DashPeriod; label: string }[] = [
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'all-time', label: 'All Time' },
]

export const performancePeriodOptions = periodOptions.filter((o) =>
  ['this-month', 'last-3-months', 'last-6-months', 'this-year', 'all-time'].includes(o.value),
)

export const trackPeriodOptions = periodOptions.filter((o) =>
  ['this-week', 'this-month', 'last-month', 'this-quarter', 'all-time'].includes(o.value),
)

export const employmentPeriodOptions = periodOptions.filter((o) =>
  ['this-week', 'this-month', 'last-month', 'this-quarter', 'this-year'].includes(o.value),
)

/** Extended team performance history (monthly) */
export const teamPerformanceHistory = [
  { month: 'Jan', value: 78 },
  { month: 'Feb', value: 80 },
  { month: 'Mar', value: 82 },
  { month: 'Apr', value: 86 },
  { month: 'May', value: 95.2 },
  { month: 'Jun', value: 88 },
  { month: 'Jul', value: 91 },
  { month: 'Aug', value: 89.5 },
]

export function getTeamPerformanceSeries(period: DashPeriod) {
  const all = teamPerformanceHistory
  switch (period) {
    case 'this-month':
      return all.slice(-1)
    case 'last-3-months':
      return all.slice(-3)
    case 'last-6-months':
      return all.slice(-6)
    case 'this-year':
    case 'all-time':
      return all
    case 'this-week':
      return [
        { month: 'Mon', value: 88 },
        { month: 'Tue', value: 90 },
        { month: 'Wed', value: 87 },
        { month: 'Thu', value: 92 },
        { month: 'Fri', value: 89.5 },
      ]
    case 'last-month':
      return all.slice(-2, -1).length ? all.slice(-2, -1) : all.slice(-1)
    case 'this-quarter':
      return all.slice(-3)
    default:
      return all.slice(-6)
  }
}

const employmentBase: EmploymentMetrics = {
  totalEmployees: 128,
  fullTime: 72,
  partTime: 24,
  contract: 20,
  intern: 12,
  attendancePct: 92,
  presentDays: 18,
  daysOff: 3,
  leaveApproved: 1,
  leavePending: 1,
  leaveThisMonth: 5,
  applicantsGrowthPct: 12,
  newApplicants: 24,
}

export function getEmploymentForPeriod(period: DashPeriod): EmploymentMetrics {
  switch (period) {
    case 'this-week':
      return {
        ...employmentBase,
        attendancePct: 96,
        presentDays: 4,
        daysOff: 1,
        leaveApproved: 0,
        leavePending: 1,
        leaveThisMonth: 1,
        applicantsGrowthPct: 4,
        newApplicants: 3,
      }
    case 'last-month':
      return {
        ...employmentBase,
        totalEmployees: 124,
        fullTime: 70,
        partTime: 23,
        contract: 19,
        intern: 12,
        attendancePct: 89,
        presentDays: 20,
        daysOff: 4,
        leaveApproved: 3,
        leavePending: 0,
        leaveThisMonth: 6,
        applicantsGrowthPct: 8,
        newApplicants: 18,
      }
    case 'this-quarter':
      return {
        ...employmentBase,
        attendancePct: 91,
        presentDays: 54,
        daysOff: 8,
        leaveApproved: 7,
        leavePending: 2,
        leaveThisMonth: 14,
        applicantsGrowthPct: 15,
        newApplicants: 41,
      }
    case 'this-year':
      return {
        ...employmentBase,
        totalEmployees: 128,
        attendancePct: 90,
        presentDays: 148,
        daysOff: 22,
        leaveApproved: 28,
        leavePending: 3,
        leaveThisMonth: 36,
        applicantsGrowthPct: 22,
        newApplicants: 96,
      }
    case 'this-month':
    default:
      return employmentBase
  }
}

/** Period-specific task track snapshots keyed by project id */
const trackByPeriod: Record<DashPeriod, Record<string, TaskTrack>> = {
  'this-week': {
    'proj-101': { todo: 3, inProgress: 2, done: 1 },
    'proj-102': { todo: 1, inProgress: 3, done: 2 },
    'proj-103': { todo: 4, inProgress: 1, done: 0 },
  },
  'this-month': {
    'proj-101': { todo: 8, inProgress: 5, done: 12 },
    'proj-102': { todo: 4, inProgress: 7, done: 18 },
    'proj-103': { todo: 11, inProgress: 3, done: 4 },
  },
  'last-month': {
    'proj-101': { todo: 6, inProgress: 4, done: 8 },
    'proj-102': { todo: 5, inProgress: 6, done: 12 },
    'proj-103': { todo: 9, inProgress: 2, done: 1 },
  },
  'this-quarter': {
    'proj-101': { todo: 10, inProgress: 6, done: 20 },
    'proj-102': { todo: 3, inProgress: 5, done: 28 },
    'proj-103': { todo: 12, inProgress: 4, done: 6 },
  },
  'last-3-months': {
    'proj-101': { todo: 10, inProgress: 6, done: 20 },
    'proj-102': { todo: 3, inProgress: 5, done: 28 },
    'proj-103': { todo: 12, inProgress: 4, done: 6 },
  },
  'last-6-months': {
    'proj-101': { todo: 5, inProgress: 4, done: 30 },
    'proj-102': { todo: 2, inProgress: 3, done: 36 },
    'proj-103': { todo: 8, inProgress: 5, done: 10 },
  },
  'this-year': {
    'proj-101': { todo: 4, inProgress: 3, done: 40 },
    'proj-102': { todo: 2, inProgress: 2, done: 42 },
    'proj-103': { todo: 6, inProgress: 4, done: 14 },
  },
  'all-time': {
    'proj-101': { todo: 8, inProgress: 5, done: 12 },
    'proj-102': { todo: 4, inProgress: 7, done: 18 },
    'proj-103': { todo: 11, inProgress: 3, done: 4 },
    'proj-090': { todo: 0, inProgress: 0, done: 24 },
  },
}

export function getTaskTrackForPeriod(
  projectId: string,
  fallback: TaskTrack,
  period: DashPeriod,
): TaskTrack {
  return trackByPeriod[period]?.[projectId] || fallback
}

/** Inclusive project start-date window for a period (relative to Aug 2026 demo "today") */
export function projectInPeriod(startDate: string, period: DashPeriod): boolean {
  if (period === 'all-time') return true
  const start = new Date(startDate)
  const today = new Date('2026-08-11')
  const msDay = 86400000

  switch (period) {
    case 'this-week': {
      const weekAgo = new Date(today.getTime() - 7 * msDay)
      return start >= weekAgo
    }
    case 'this-month':
      return start.getFullYear() === 2026 && start.getMonth() === 7
    case 'last-month':
      return start.getFullYear() === 2026 && start.getMonth() === 6
    case 'last-3-months':
    case 'this-quarter': {
      const from = new Date(today)
      from.setMonth(from.getMonth() - 3)
      return start >= from
    }
    case 'last-6-months': {
      const from = new Date(today)
      from.setMonth(from.getMonth() - 6)
      return start >= from
    }
    case 'this-year':
      return start.getFullYear() === 2026
    default:
      return true
  }
}

export function dateInPeriod(isoDate: string, period: DashPeriod): boolean {
  return projectInPeriod(isoDate, period)
}

export const listPeriodOptions = periodOptions.filter((o) =>
  ['this-week', 'this-month', 'last-month', 'this-quarter', 'all-time'].includes(o.value),
)
