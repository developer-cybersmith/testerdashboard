import type {
  AccessGrant,
  AppNotification,
  Blocker,
  ChannelIntegrations,
  ChannelPost,
  ClientDiscussion,
  DailyUpdate,
  EmployeeChecklist,
  HistoricalExit,
  HrTicket,
  ItAsset,
  LeaveRequest,
  Payslip,
  PerformanceReview,
  Person,
  Project,
  ProjectStatusRequest,
  QueryItem,
  RegularizationRequest,
  RequirementChangeRequest,
  RosterEntry,
  WorkedDayRequest,
} from '../types'

export const RECORD_COLLECTIONS = [
  'projects',
  'updates',
  'queries',
  'blockers',
  'discussions',
  'notifications',
  'leaveRequests',
  'requirementRequests',
  'projectStatusRequests',
  'workedDayRequests',
  'checklists',
  'reviews',
  'assets',
  'accessGrants',
  'payslips',
  'hrTickets',
  'regularizations',
  'roster',
  'channelPosts',
] as const

export type RecordCollection = (typeof RECORD_COLLECTIONS)[number]

export interface AppSnapshot {
  people: Person[]
  projects: Project[]
  updates: DailyUpdate[]
  queries: QueryItem[]
  blockers: Blocker[]
  discussions: ClientDiscussion[]
  notifications: AppNotification[]
  leaveRequests: LeaveRequest[]
  requirementRequests: RequirementChangeRequest[]
  projectStatusRequests: ProjectStatusRequest[]
  workedDayRequests: WorkedDayRequest[]
  checklists: EmployeeChecklist[]
  reviews: PerformanceReview[]
  assets: ItAsset[]
  accessGrants: AccessGrant[]
  payslips: Payslip[]
  hrTickets: HrTicket[]
  regularizations: RegularizationRequest[]
  roster: RosterEntry[]
  integrations: ChannelIntegrations
  channelPosts: ChannelPost[]
  historicalExits: HistoricalExit[]
}

export function stripSecrets(person: Person): Person {
  const next = { ...person }
  delete next.password
  return next
}

export function publicPeople(people: Person[]) {
  return people.map(stripSecrets)
}
