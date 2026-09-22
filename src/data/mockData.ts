import type {
  AppNotification,
  Blocker,
  ClientDiscussion,
  DailyUpdate,
  EmploymentMetrics,
  KpiMetric,
  KraItem,
  LeaveRequest,
  Project,
  QueryItem,
  RequirementChangeRequest,
} from '../types'
import { people } from './staff'

export { people }

export const initialProjects: Project[] = []

export const initialUpdates: DailyUpdate[] = []

export const initialQueries: QueryItem[] = []

export const initialLeaveRequests: LeaveRequest[] = []

export const initialRequirementRequests: RequirementChangeRequest[] = []

export const initialBlockers: Blocker[] = []

export const initialDiscussions: ClientDiscussion[] = []

export const employmentMetrics: EmploymentMetrics = {
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

export const vaptKpis: KpiMetric[] = []

export const vaptKras: KraItem[] = []

export const teamPerformanceSeries: { month: string; value: number }[] = []

export const initialNotifications: AppNotification[] = []
