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
import { ONBOARDING_LABELS, OFFBOARDING_LABELS } from '../hr/peopleOps'

function pdfDataUrl() {
  const body =
    '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000109 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n'
  return `data:application/pdf;base64,${btoa(body)}`
}

function checklist(
  personId: string,
  kind: 'onboarding' | 'offboarding',
  doneCount: number,
): EmployeeChecklist {
  const labels = kind === 'onboarding' ? ONBOARDING_LABELS : OFFBOARDING_LABELS
  return {
    personId,
    kind,
    items: labels.map((label, index) => ({
      id: `${kind}-${personId}-${index + 1}`,
      label,
      done: index < doneCount,
      doneAt: index < doneCount ? '2026-09-10T10:00:00' : undefined,
      doneBy: index < doneCount ? 'hr-1' : undefined,
    })),
  }
}

export const initialChecklists: EmployeeChecklist[] = [
  checklist('user-2', 'onboarding', 5),
  checklist('user-3', 'onboarding', 8),
  checklist('user-1', 'onboarding', 8),
  checklist('tl-1', 'onboarding', 8),
]

export const initialReviews: PerformanceReview[] = [
  {
    id: 'rev-1',
    personId: 'user-1',
    cycle: 'H2 2026',
    selfReview:
      'Delivered Arc auth findings on schedule and improved evidence notes after the June review.',
    managerId: 'tl-1',
    selfSubmittedAt: '2026-09-12T09:00:00',
    status: 'self-done',
  },
  {
    id: 'rev-2',
    personId: 'user-2',
    cycle: 'H2 2026',
    managerId: 'tl-1',
    status: 'draft',
  },
  {
    id: 'rev-3',
    personId: 'user-3',
    cycle: 'H2 2026',
    managerId: 'tl-2',
    status: 'draft',
  },
]

export const initialAssets: ItAsset[] = [
  {
    id: 'ast-1',
    personId: 'user-1',
    kind: 'laptop',
    label: 'ThinkPad X1 Carbon',
    serial: 'CS-LT-104',
    status: 'allotted',
    allottedAt: '2022-02-14',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-2',
    personId: 'user-1',
    kind: 'id-card',
    label: 'Employee ID card',
    serial: 'EMP-004',
    status: 'allotted',
    allottedAt: '2022-02-14',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-3',
    personId: 'user-1',
    kind: 'vpn',
    label: 'VPN profile',
    serial: 'vpn-user-1',
    status: 'allotted',
    allottedAt: '2022-02-14',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-4',
    personId: 'user-2',
    kind: 'laptop',
    label: 'ThinkPad T14',
    serial: 'CS-LT-118',
    status: 'allotted',
    allottedAt: '2026-08-18',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-5',
    personId: 'user-2',
    kind: 'id-card',
    label: 'Employee ID card',
    serial: 'EMP-005',
    status: 'allotted',
    allottedAt: '2026-08-20',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-6',
    personId: 'user-3',
    kind: 'laptop',
    label: 'ThinkPad T14',
    serial: 'CS-LT-121',
    status: 'allotted',
    allottedAt: '2022-09-19',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-7',
    personId: 'tl-1',
    kind: 'laptop',
    label: 'MacBook Pro 14',
    serial: 'CS-LT-012',
    status: 'allotted',
    allottedAt: '2020-06-15',
    allottedBy: 'hr-1',
  },
  {
    id: 'ast-8',
    personId: 'user-4',
    kind: 'laptop',
    label: 'ThinkPad T14',
    serial: 'CS-LT-090',
    status: 'returned',
    allottedAt: '2021-04-12',
    returnedAt: '2026-06-28',
    allottedBy: 'hr-1',
  },
]

export const initialAccessGrants: AccessGrant[] = [
  {
    id: 'acc-1',
    personId: 'user-1',
    scope: 'tool',
    name: 'Jira',
    status: 'active',
    grantedAt: '2022-02-14',
  },
  {
    id: 'acc-2',
    personId: 'user-1',
    scope: 'tool',
    name: 'Burp Cloud',
    status: 'active',
    grantedAt: '2022-02-14',
  },
  {
    id: 'acc-3',
    personId: 'user-1',
    scope: 'tool',
    name: 'Slack',
    status: 'active',
    grantedAt: '2022-02-14',
  },
  {
    id: 'acc-4',
    personId: 'user-2',
    scope: 'tool',
    name: 'Jira',
    status: 'active',
    grantedAt: '2026-08-18',
  },
  {
    id: 'acc-5',
    personId: 'user-2',
    scope: 'tool',
    name: 'SharePoint',
    status: 'active',
    grantedAt: '2026-08-18',
  },
  {
    id: 'acc-6',
    personId: 'user-3',
    scope: 'tool',
    name: 'Burp Cloud',
    status: 'active',
    grantedAt: '2022-09-19',
  },
  {
    id: 'acc-7',
    personId: 'tl-1',
    scope: 'tool',
    name: 'Jira',
    status: 'active',
    grantedAt: '2020-06-15',
  },
  {
    id: 'acc-8',
    personId: 'tl-1',
    scope: 'tool',
    name: 'Slack',
    status: 'active',
    grantedAt: '2020-06-15',
  },
]

export const initialPayslips: Payslip[] = [
  {
    id: 'pay-1',
    personId: 'user-1',
    month: '2026-08',
    fileName: 'Payslip-Aug-2026-EMP-004.pdf',
    dataUrl: pdfDataUrl(),
    uploadedAt: '2026-09-02T11:00:00',
    uploadedBy: 'hr-1',
  },
  {
    id: 'pay-2',
    personId: 'user-1',
    month: '2026-07',
    fileName: 'Payslip-Jul-2026-EMP-004.pdf',
    dataUrl: pdfDataUrl(),
    uploadedAt: '2026-08-02T11:00:00',
    uploadedBy: 'hr-1',
  },
  {
    id: 'pay-3',
    personId: 'tl-1',
    month: '2026-08',
    fileName: 'Payslip-Aug-2026-EMP-002.pdf',
    dataUrl: pdfDataUrl(),
    uploadedAt: '2026-09-02T11:05:00',
    uploadedBy: 'hr-1',
  },
]

export const initialHrTickets: HrTicket[] = [
  {
    id: 'hrt-1',
    fromUserId: 'user-1',
    fromUserName: 'Totok Michael',
    subject: 'Leave balance for planned procedure',
    message: 'Please confirm remaining sick and earned leave after the July medical leave.',
    status: 'answered',
    createdAt: '2026-08-01T10:00:00',
    reply: 'Earned 6 remaining, sick 4 remaining, casual 4 remaining after the approved July leave.',
    repliedBy: 'hr-1',
    repliedAt: '2026-08-01T15:20:00',
  },
  {
    id: 'hrt-2',
    fromUserId: 'user-2',
    fromUserName: 'Sneha Patel',
    subject: 'ID card reprint',
    message: 'My ID card chip is not reading at the Gurugram gate. Can HR reprint it?',
    status: 'open',
    createdAt: '2026-09-18T09:40:00',
  },
]

export const initialRegularizations: RegularizationRequest[] = [
  {
    id: 'reg-1',
    userId: 'user-1',
    userName: 'Totok Michael',
    date: '2026-09-16',
    reason: 'Client call ran past 7:30 PM; evening update was submitted at 7:41.',
    status: 'pending',
    createdAt: '2026-09-16T19:45:00',
  },
]

export const initialRoster: RosterEntry[] = [
  { id: 'ros-1', personId: 'user-1', date: '2026-09-21', shiftId: 'shift-general' },
  { id: 'ros-2', personId: 'user-2', date: '2026-09-21', shiftId: 'shift-early' },
  { id: 'ros-3', personId: 'user-3', date: '2026-09-21', shiftId: 'shift-general' },
  { id: 'ros-4', personId: 'tl-1', date: '2026-09-21', shiftId: 'shift-general' },
  { id: 'ros-5', personId: 'user-1', date: '2026-09-22', shiftId: 'shift-late' },
]

export const initialIntegrations: ChannelIntegrations = {
  slackEnabled: true,
  slackWebhook: '',
  teamsEnabled: false,
  teamsWebhook: '',
}

export const initialChannelPosts: ChannelPost[] = [
  {
    id: 'ch-1',
    channel: 'slack',
    title: 'Leave approved',
    message: 'Totok Michael · 2026-07-15 → 2026-07-19 · earned leave',
    createdAt: '2026-07-10T12:00:00',
    delivery: 'logged',
  },
]

export const historicalExits: HistoricalExit[] = [
  {
    name: 'Kiran Rao',
    department: 'VAPT',
    joinDate: '2024-01-08',
    leftDate: '2026-03-12',
  },
  {
    name: 'Dev Malhotra',
    department: 'Operations',
    joinDate: '2023-06-01',
    leftDate: '2025-11-02',
  },
]
