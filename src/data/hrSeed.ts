import type {
  AccessGrant,
  ChannelIntegrations,
  ChannelPost,
  EmployeeChecklist,
  HistoricalExit,
  HrTicket,
  ItAsset,
  Payslip,
  PerformanceReview,
  RegularizationRequest,
  RosterEntry,
} from '../types'

export const initialChecklists: EmployeeChecklist[] = []

export const initialReviews: PerformanceReview[] = []

export const initialAssets: ItAsset[] = []

export const initialAccessGrants: AccessGrant[] = []

export const initialPayslips: Payslip[] = []

export const initialHrTickets: HrTicket[] = []

export const initialRegularizations: RegularizationRequest[] = []

export const initialRoster: RosterEntry[] = []

export const initialIntegrations: ChannelIntegrations = {
  slackEnabled: false,
  slackWebhook: '',
  teamsEnabled: false,
  teamsWebhook: '',
}

export const initialChannelPosts: ChannelPost[] = []

export const historicalExits: HistoricalExit[] = []
