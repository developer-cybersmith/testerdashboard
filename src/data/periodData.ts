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

export const teamPerformanceHistory: { month: string; value: number }[] = []

export function getTeamPerformanceSeries(_period: DashPeriod) {
  return teamPerformanceHistory
}

const emptyEmployment: EmploymentMetrics = {
  totalEmployees: 0,
  fullTime: 0,
  partTime: 0,
  contract: 0,
  intern: 0,
  attendancePct: 0,
  presentDays: 0,
  daysOff: 0,
  leaveApproved: 0,
  leavePending: 0,
  leaveThisMonth: 0,
  applicantsGrowthPct: 0,
  newApplicants: 0,
}

export function getEmploymentForPeriod(_period: DashPeriod): EmploymentMetrics {
  return emptyEmployment
}

export function getTaskTrackForPeriod(
  _projectId: string,
  fallback: TaskTrack,
  _period: DashPeriod,
): TaskTrack {
  return fallback
}

export function projectInPeriod(_startDate: string, period: DashPeriod): boolean {
  return period === 'all-time' || period === 'this-month' || period === 'this-quarter' || period === 'this-year'
}

export function dateInPeriod(isoDate: string, period: DashPeriod): boolean {
  return projectInPeriod(isoDate, period)
}

export const listPeriodOptions = periodOptions.filter((o) =>
  ['this-week', 'this-month', 'last-month', 'this-quarter', 'all-time'].includes(o.value),
)
