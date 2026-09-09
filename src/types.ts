export type Role = 'admin' | 'tl' | 'user'

export type ProjectStatus = 'active' | 'on-hold' | 'closed' | 'draft'

export type BlockerSeverity = 'low' | 'medium' | 'high' | 'critical'

export type BlockerStatus = 'open' | 'in-review' | 'resolved'

export interface Person {
  id: string
  name: string
  email: string
  role: Role
  avatar: string
  teamId?: string
  jobTitle?: string
  password?: string
  employeeCode?: string
  avatarUploaded?: boolean
  status?: 'active' | 'inactive'
  employmentType?: string
  joinDate?: string
  gender?: string
  dateOfBirth?: string
  phone?: string
  address?: string
  department?: string
  leaveBalance?: LeaveBalance
  performanceScore?: number
  documents?: EmployeeDocument[]
  notes?: EmployeeNote[]
}

export interface LeaveBalance {
  allUsed: number
  allMax: number
  annualUsed: number
  annualMax: number
  casualUsed: number
  casualMax: number
  sickUsed: number
  sickMax: number
}

export interface EmployeeDocument {
  name: string
  kind: string
}

export interface EmployeeNote {
  title: string
  date: string
  body: string
}

export interface ScopeItem {
  urls: string[]
  ips: string[]
  configFiles: string[]
  notes?: string
}

export interface VpnAccess {
  type: 'profile' | 'credits'
  label: string
  details: string
  fileName?: string
}

export interface ScopeCredit {
  type: 'text' | 'excel'
  content: string
  fileName?: string
}

export interface SharePointLink {
  id: string
  title: string
  url: string
  sharedBy: string
}

export interface TeamMemberBrief {
  id: string
  name: string
  role: Role
  avatar: string
  jobTitle?: string
}

export interface ProjectAllocation {
  userId: string
  allocatedAt: string
}

export interface Project {
  id: string
  name: string
  client: string
  status: ProjectStatus
  progress: number
  startDate: string
  closureDate?: string
  tlId: string
  allocations: ProjectAllocation[]
  team: TeamMemberBrief[]
  sharepoint: SharePointLink[]
  scope: ScopeItem
  vpn: VpnAccess[]
  scopeCredits: ScopeCredit[]
  remarks: string
  requirements: string[]
  taskTrack: TaskTrack
  holdSource?: 'client' | 'internal'
  holdRemark?: string
  closureRemark?: string
}

export interface TaskTrack {
  todo: number
  inProgress: number
  done: number
}

export type NotificationType =
  | 'query'
  | 'query-reply'
  | 'blocker'
  | 'critical-vuln'
  | 'tracker'
  | 'peer-review'
  | 'general'
  | 'leave'
  | 'requirement'
  | 'lifecycle'

export interface AppNotification {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
  relatedId?: string
}

export interface EmploymentMetrics {
  totalEmployees: number
  fullTime: number
  partTime: number
  contract: number
  intern: number
  attendancePct: number
  presentDays: number
  daysOff: number
  leaveApproved: number
  leavePending: number
  leaveThisMonth: number
  applicantsGrowthPct: number
  newApplicants: number
}

export interface KpiMetric {
  id: string
  name: string
  score: number
  max: number
  percent: number
  target: string
  frequency: string
  weightage: string
  color: string
}

export interface KraItem {
  id: string
  title: string
  points: string[]
}

export interface QueryAttachment {
  id: string
  name: string
  kind: 'image' | 'file'
  mime: string
  dataUrl: string
  size: number
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
  attachments?: QueryAttachment[]
}

export interface QueryItem {
  id: string
  projectId: string
  fromUserId: string
  fromUserName: string
  toRole: Role
  toPersonId: string
  subject: string
  message: string
  createdAt: string
  status: 'open' | 'answered'
  reply?: string
  messages: ChatMessage[]
  starred?: boolean
  folder?: 'inbox' | 'starred' | 'sent' | 'trash'
  participantIds?: string[]
}

export type LeaveStatus = 'pending-tl' | 'pending-admin' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  userId: string
  userName: string
  userAvatar: string
  fromDate: string
  toDate: string
  reason: string
  kind?: 'paid' | 'other'
  status: LeaveStatus
  tlId: string
  createdAt: string
  decidedBy?: string
  tlNote?: string
  adminNote?: string
}

export type ProjectStatusAction = 'on-hold' | 'closed' | 'active'

export interface ProjectStatusRequest {
  id: string
  projectId: string
  projectName: string
  requestedById: string
  requestedByName: string
  action: ProjectStatusAction
  remark: string
  holdSource?: 'client' | 'internal'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  decidedBy?: string
  adminNote?: string
}

export type RequirementAction = 'add' | 'edit' | 'delete'

export interface RequirementChangeRequest {
  id: string
  projectId: string
  projectName: string
  requestedById: string
  requestedByName: string
  action: RequirementAction
  index?: number
  oldValue?: string
  newValue?: string
  proposedRequirements: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface DailyUpdate {
  id: string
  projectId: string
  userId: string
  userName: string
  date: string
  submittedAt: string
  workDone: string
  workPoints?: string[]
  hoursSpent: number
  slot?: 'morning' | 'evening'
}

export interface Blocker {
  id: string
  projectId: string
  projectName: string
  raisedById: string
  raisedByName: string
  title: string
  description: string
  severity: BlockerSeverity
  status: BlockerStatus
  createdAt: string
}

export interface ClientDiscussion {
  id: string
  projectId: string
  date: string
  participants: string
  summary: string
  loggedBy: string
  outcome?: string
}

export interface AppUserSession {
  person: Person
  loginAt: string
}
