import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  employmentMetrics,
  initialBlockers,
  initialDiscussions,
  initialLeaveRequests,
  initialNotifications,
  initialProjects,
  initialQueries,
  initialRequirementRequests,
  initialUpdates,
  people as initialPeople,
  teamPerformanceSeries,
  vaptKpis,
  vaptKras,
} from '../data/mockData'
import {
  historicalExits,
  initialAccessGrants,
  initialAssets,
  initialChannelPosts,
  initialChecklists,
  initialHrTickets,
  initialIntegrations,
  initialPayslips,
  initialRegularizations,
  initialReviews,
  initialRoster,
} from '../data/hrSeed'
import type {
  AccessGrant,
  AppNotification,
  AppUserSession,
  AssetKind,
  Blocker,
  BlockerSeverity,
  ChannelIntegrations,
  ChannelPost,
  ChatMessage,
  ClientDiscussion,
  DailyUpdate,
  EmployeeChecklist,
  HrTicket,
  ItAsset,
  LeaveKind,
  LeaveRequest,
  LeaveStatus,
  Payslip,
  PerformanceReview,
  Person,
  Project,
  ProjectRequirement,
  ProjectStatus,
  ProjectStatusAction,
  ProjectStatusRequest,
  RegularizationRequest,
  RequirementStatus,
  QueryAttachment,
  QueryItem,
  RequirementAction,
  RequirementChangeRequest,
  Role,
  RosterEntry,
  ScopeCredit,
  ScopeItem,
  SharePointLink,
  VpnAccess,
  WorkedDayRequest,
} from '../types'
import { canAct, isOrgAdmin } from '../security/authorize'
import {
  clampNumber,
  isSafeAttachmentName,
  isStrongPassword,
  PASSWORD_POLICY,
  sanitizeDataUrl,
  sanitizeImageDataUrl,
  sanitizeLines,
  sanitizePdfDataUrl,
  sanitizeText,
  sanitizeUrl,
} from '../security/wstg'
import { isLateMorningGateway, slotFromUpdate } from '../attendance'
import {
  applyLeaveUsage,
  defaultLeaveBalance,
  OFFBOARDING_LABELS,
  ONBOARDING_LABELS,
  quotaBucket,
  remainingLeave,
} from '../hr/peopleOps'
import { publicPeople, type AppSnapshot } from '../lib/appSnapshot'
import {
  clearStoredSession,
  ensureRemoteConfig,
  isRemoteConfigured,
  readStoredSession,
  remoteBootstrap,
  remoteLogin,
  remoteProvisionEmployee,
  remoteSaveSnapshot,
  remoteUpdatePassword,
  storeSession,
} from '../lib/api'

export { isOrgAdmin, isContractStaff, canViewDirectoryPerson } from '../security/authorize'
export { isLateMorningGateway, slotFromUpdate } from '../attendance'
export {
  ALL_LEAVE_MAX,
  CASUAL_LEAVE_MAX,
  EARNED_LEAVE_MAX,
  PAID_LEAVE_MAX,
  SICK_LEAVE_MAX,
} from '../hr/peopleOps'
export const DEMO_PASSWORD = 'Secure@2026'
export const COMPANY_DOMAIN = 'cybersmithsecure.com'
export const OFFICE_LOCATIONS = [
  'Mumbai',
  'Pune',
  'Gurugram',
  'Bengaluru',
  'Kolkata',
  'Ahmedabad',
  'Kochi',
] as const

const TRACKER_WINDOW_HOURS = 7
export type UpdateSlot = 'morning' | 'evening'

function localDateISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function leaveDayCount(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function addCalendarDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function httpsWebhook(raw: string) {
  const url = sanitizeUrl(raw)
  return url.startsWith('https://') ? url : ''
}

function makeChecklist(personId: string, kind: 'onboarding' | 'offboarding'): EmployeeChecklist {
  const labels = kind === 'onboarding' ? ONBOARDING_LABELS : OFFBOARDING_LABELS
  return {
    personId,
    kind,
    items: labels.map((label, index) => ({
      id: `${kind}-${personId}-${index + 1}`,
      label,
      done: false,
    })),
  }
}

export function currentUpdateSlot(now = new Date()): UpdateSlot | null {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins >= 10 * 60 && mins <= 10 * 60 + 30) return 'morning'
  if (mins >= 19 * 60 && mins <= 19 * 60 + 30) return 'evening'
  return null
}

export function updateSlotLabel(slot?: UpdateSlot | null) {
  if (slot === 'morning') return 'Morning (10:00–10:30 AM)'
  if (slot === 'evening') return 'Evening (7:00–7:30 PM)'
  return 'Update'
}

export function isAfterEveningWindow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes() > 19 * 60 + 30
}

export function sortBlockersByPriority<T extends { raisedByRole?: Role; severity: BlockerSeverity }>(
  list: T[],
) {
  const rank: Record<BlockerSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  return [...list].sort((a, b) => {
    const aLead = a.raisedByRole === 'tl' ? 0 : 1
    const bLead = b.raisedByRole === 'tl' ? 0 : 1
    if (aLead !== bLead) return aLead - bLead
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)
  })
}

function notifyRecipients(
  ids: string[],
  push: (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void,
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'recipientId'>,
) {
  ids.forEach((recipientId) => {
    push({ ...payload, recipientId })
  })
}

function notifyAutoClosed(
  project: Project,
  push: (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void,
  leadIds: string[],
) {
  const recipients = new Set<string>([
    project.tlId,
    ...leadIds,
    ...project.allocations.map((row) => row.userId),
  ])
  recipients.forEach((recipientId) => {
    push({
      recipientId,
      type: 'lifecycle',
      title: `${project.name} closed`,
      message: 'All requirements are fulfilled. The project closed automatically.',
      relatedId: project.id,
    })
  })
}

function applyAutoClose(project: Project): { project: Project; didClose: boolean } {
  if (project.status === 'closed') return { project, didClose: false }
  if (!project.requirements.length) return { project, didClose: false }
  if (!project.requirements.every((item) => item.status === 'fulfilled')) {
    return { project, didClose: false }
  }
  return {
    project: {
      ...project,
      status: 'closed',
      progress: 100,
      closureDate: project.closureDate || localDateISO(),
      closureRemark:
        project.closureRemark || 'Closed automatically — all requirements fulfilled',
    },
    didClose: true,
  }
}

interface AppContextValue {
  session: AppUserSession | null
  login: (personId: string) => void
  loginWithEmail: (email: string, password: string) => Promise<string | null>
  logout: () => void
  companyDomain: string
  registerEmployee: (input: {
    name: string
    email: string
    password: string
    role: Role
    jobTitle?: string
    phone?: string
    department?: string
    employmentType?: string
    employeeCode?: string
    joinDate?: string
    gender?: string
    dateOfBirth?: string
    location?: string
    managerId?: string
    skills?: string
  }) => Promise<string | null>
  people: Person[]
  projects: Project[]
  updates: DailyUpdate[]
  queries: QueryItem[]
  blockers: Blocker[]
  discussions: ClientDiscussion[]
  notifications: AppNotification[]
  myNotifications: AppNotification[]
  unreadCount: number
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  trackerWindowHours: number
  hoursSinceLogin: number
  hasSubmittedToday: boolean
  todayMarkedWorked: boolean
  trackerDueSoon: boolean
  trackerOverdue: boolean
  morningUpdateToday: boolean
  eveningUpdateToday: boolean
  currentUpdateSlot: 'morning' | 'evening' | null
  myProjects: Project[]
  activeProjects: Project[]
  openBlockers: Blocker[]
  employment: typeof employmentMetrics
  kpis: typeof vaptKpis
  kras: typeof vaptKras
  teamPerformance: typeof teamPerformanceSeries
  addDailyUpdate: (input: {
    projectId: string
    workPoints: string[]
    hoursSpent: number
  }) => string | null
  addQuery: (input: {
    projectId?: string
    toRole?: Role
    toPersonId?: string
    subject?: string
    message: string
    attachments?: QueryAttachment[]
  }) => void
  replyQuery: (queryId: string, reply: string) => void
  sendQueryMessage: (queryId: string, body: string, attachments?: QueryAttachment[]) => void
  toggleQueryStar: (queryId: string) => void
  addBlocker: (input: {
    projectId: string
    title: string
    description: string
    severity: BlockerSeverity
  }) => string | null
  updateBlockerStatus: (blockerId: string, status: Blocker['status']) => void
  addDiscussion: (input: Omit<ClientDiscussion, 'id'>) => void
  setProjectStatus: (
    projectId: string,
    status: ProjectStatus,
    extra?: {
      closureDate?: string
      holdSource?: 'client' | 'internal'
      holdRemark?: string
      closureRemark?: string
    },
  ) => void
  requestProjectStatusChange: (input: {
    projectId: string
    action: ProjectStatusAction
    remark: string
    holdSource?: 'client' | 'internal'
  }) => string | null
  decideProjectStatusRequest: (
    requestId: string,
    decision: 'approve' | 'reject',
    adminNote?: string,
  ) => void
  projectStatusRequests: ProjectStatusRequest[]
  renamePerson: (personId: string, name: string, jobTitle?: string) => void
  updateEmployeeCode: (personId: string, employeeCode: string) => string | null
  updateOwnProfile: (input: { avatarDataUrl?: string }) => string | null
  changePassword: (currentPassword: string, nextPassword: string) => string | null
  createProject: (input: {
    name: string
    client: string
    tlId: string
    allocateUserIds: string[]
    remarks: string
    startDate: string
    closureDate: string
    initialReportDate: string
    closureReportDate: string
    requirements?: Array<string | ProjectRequirement>
    sharepoint?: SharePointLink[]
    scope?: ScopeItem
    vpn?: VpnAccess[]
    scopeCredits?: ScopeCredit[]
  }) => void
  updateProjectAssignment: (input: {
    projectId: string
    tlId: string
    allocateUserIds: string[]
    sharepoint?: SharePointLink[]
    scope?: ScopeItem
    vpn?: VpnAccess[]
    scopeCredits?: ScopeCredit[]
    remarks?: string
    startDate?: string
    closureDate?: string
    initialReportDate?: string
    closureReportDate?: string
  }) => void
  /** Admin can apply immediately; TL creates approval request */
  applyRequirementChange: (input: {
    projectId: string
    action: RequirementAction
    index?: number
    newValue?: string
  }) => void
  updateRequirementStatus: (
    projectId: string,
    requirementId: string,
    status: RequirementStatus,
  ) => void
  approveRequirementChange: (requestId: string) => void
  rejectRequirementChange: (requestId: string) => void
  requirementRequests: RequirementChangeRequest[]
  leaveRequests: LeaveRequest[]
  submitLeaveRequest: (input: {
    fromDate: string
    toDate: string
    reason: string
    kind: LeaveKind
  }) => string | null
  decideLeaveRequest: (
    leaveId: string,
    decision: 'approve' | 'reject',
    note: string,
  ) => void
  leaveStats: { approved: number; pending: number; thisMonth: number }
  workedDayRequests: WorkedDayRequest[]
  requestWorkedDay: (reason: string) => string | null
  requestLateMorning: (input: {
    reason: string
    projectId: string
    workPoints: string[]
    hoursSpent: number
  }) => string | null
  decideWorkedDay: (requestId: string, decision: 'approve' | 'reject') => void
  lateMorningGatewayOpen: boolean
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
  historicalExits: typeof historicalExits
  remoteReady: boolean
  syncError: string | null
  toggleChecklistItem: (
    personId: string,
    kind: 'onboarding' | 'offboarding',
    itemId: string,
  ) => void
  startOffboarding: (personId: string, lastWorkingDate?: string) => string | null
  completeOffboarding: (personId: string) => string | null
  extendEmploymentPeriod: (
    personId: string,
    input: { lastWorkingDate?: string; contractEndDate?: string },
  ) => string | null
  confirmProbation: (personId: string) => string | null
  submitSelfReview: (personId: string, cycle: string, text: string) => string | null
  submitManagerReview: (reviewId: string, text: string, rating: number) => string | null
  allotAsset: (input: {
    personId: string
    kind: AssetKind
    label: string
    serial?: string
  }) => string | null
  closeAsset: (assetId: string, next: 'returned' | 'revoked') => string | null
  grantToolAccess: (personId: string, name: string) => string | null
  revokeAccessGrant: (grantId: string) => void
  uploadPayslip: (input: {
    personId: string
    month: string
    fileName: string
    dataUrl: string
  }) => string | null
  raiseHrTicket: (subject: string, message: string) => string | null
  replyHrTicket: (ticketId: string, reply: string) => string | null
  requestRegularization: (date: string, reason: string) => string | null
  decideRegularization: (requestId: string, decision: 'approve' | 'reject') => void
  setPersonShift: (personId: string, shiftId: string) => void
  upsertRoster: (personId: string, date: string, shiftId: string) => void
  saveIntegrations: (input: ChannelIntegrations) => string | null
  updateHrProfile: (personId: string, input: {
    managerId?: string
    skills?: string[]
    department?: string
    location?: string
    jobTitle?: string
    contractEndDate?: string
    nextAppraisalDate?: string
    documentExpiryDate?: string
    probationEndDate?: string
  }) => string | null
  directoryFocusId: string | null
  openDirectoryPerson: (personId: string) => void
  clearDirectoryFocus: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function confirmAfterSetup(person: Person): Person {
  if (person.lifecycleStatus !== 'onboarding') return person
  if (!person.avatarUploaded || person.mustChangePassword) return person
  return {
    ...person,
    lifecycleStatus: 'confirmed',
    confirmationDate: person.confirmationDate || todayISO(),
  }
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function toRequirementItems(list?: Array<string | ProjectRequirement>): ProjectRequirement[] {
  if (!list?.length) {
    return [
      { id: uid('req'), text: 'Daily tracker updates', status: 'incomplete' },
      { id: uid('req'), text: 'Log blockers immediately', status: 'incomplete' },
    ]
  }
  return list.map((item) =>
    typeof item === 'string'
      ? { id: uid('req'), text: sanitizeText(item, 400), status: 'incomplete' }
      : {
          id: item.id || uid('req'),
          text: sanitizeText(item.text, 400),
          status: item.status || 'incomplete',
        },
  )
}

function cleanAttachments(input?: QueryAttachment[]): QueryAttachment[] {
  if (!input?.length) return []
  return input
    .slice(0, 5)
    .map((att) => {
      const name = sanitizeText(att.name, 120)
      if (!isSafeAttachmentName(name)) return null
      const ext = name.split('.').pop()?.toLowerCase() || ''
      const kind: QueryAttachment['kind'] = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
        ? 'image'
        : 'file'
      const dataUrl = sanitizeDataUrl(att.dataUrl, kind === 'image' ? 750_000 : 1_500_000)
      if (!dataUrl) return null
      return {
        id: att.id || uid('att'),
        name,
        kind,
        mime: sanitizeText(att.mime, 80),
        dataUrl,
        size: att.size || 0,
      }
    })
    .filter((att): att is QueryAttachment => Boolean(att))
}

export function normalizeCompanyEmail(raw: string, domain = COMPANY_DOMAIN) {
  const cleaned = sanitizeText(raw, 120).toLowerCase()
  const local = (cleaned.includes('@') ? cleaned.split('@')[0] : cleaned).replace(
    /[^a-z0-9._-]/g,
    '',
  )
  if (!local) return ''
  return `${local}@${domain}`
}

export function normalizeEmployeeCode(raw: string) {
  const cleaned = sanitizeText(raw, 16).toUpperCase().replace(/\s+/g, '')
  const match = cleaned.match(/^(CSS|EMP)-?(\d+)$/) || cleaned.match(/^(\d+)$/)
  if (match && match.length === 3) {
    const prefix = match[1] === 'EMP' ? 'EMP' : 'CSS'
    return `${prefix}${match[2].padStart(3, '0')}`
  }
  if (match && match.length === 2) {
    return `CSS${match[1].padStart(3, '0')}`
  }
  const digits = cleaned.replace(/\D/g, '')
  if (!digits) return ''
  return `CSS${digits.padStart(3, '0')}`
}

export function nextEmployeeCode(people: { employeeCode?: string }[]) {
  const nums = people.map((p) => {
    const found = (p.employeeCode || '').match(/(?:CSS|EMP)-?(\d+)/i)
    return found ? Number(found[1]) : 0
  })
  const next = Math.max(0, ...nums) + 1
  return `CSS${String(next).padStart(3, '0')}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppUserSession | null>(null)
  const [directoryFocusId, setDirectoryFocusId] = useState<string | null>(null)
  const openDirectoryPerson = useCallback((personId: string) => {
    setDirectoryFocusId(personId)
  }, [])
  const clearDirectoryFocus = useCallback(() => {
    setDirectoryFocusId(null)
  }, [])
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const orgAdminIds = useMemo(
    () => people.filter((p) => p.role === 'admin' || p.role === 'hr').map((p) => p.id),
    [people],
  )
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [updates, setUpdates] = useState<DailyUpdate[]>(initialUpdates)
  const [queries, setQueries] = useState<QueryItem[]>(initialQueries)
  const [blockers, setBlockers] = useState<Blocker[]>(initialBlockers)
  const [discussions, setDiscussions] = useState<ClientDiscussion[]>(initialDiscussions)
  const [notifications, setNotifications] =
    useState<AppNotification[]>(initialNotifications)
  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>(initialLeaveRequests)
  const [requirementRequests, setRequirementRequests] = useState<RequirementChangeRequest[]>(
    initialRequirementRequests,
  )
  const [projectStatusRequests, setProjectStatusRequests] = useState<ProjectStatusRequest[]>([])
  const [workedDayRequests, setWorkedDayRequests] = useState<WorkedDayRequest[]>([])
  const [checklists, setChecklists] = useState<EmployeeChecklist[]>(initialChecklists)
  const [reviews, setReviews] = useState<PerformanceReview[]>(initialReviews)
  const [assets, setAssets] = useState<ItAsset[]>(initialAssets)
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>(initialAccessGrants)
  const [payslips, setPayslips] = useState<Payslip[]>(initialPayslips)
  const [hrTickets, setHrTickets] = useState<HrTicket[]>(initialHrTickets)
  const [regularizations, setRegularizations] = useState<RegularizationRequest[]>(initialRegularizations)
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster)
  const [integrations, setIntegrations] = useState<ChannelIntegrations>(initialIntegrations)
  const [channelPosts, setChannelPosts] = useState<ChannelPost[]>(initialChannelPosts)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [loginFails, setLoginFails] = useState(0)
  const [loginLockedUntil, setLoginLockedUntil] = useState(0)
  const lastActiveRef = useRef(Date.now())
  const accessTokenRef = useRef<string | null>(null)
  const skipPersistRef = useRef(true)
  const dirtyRef = useRef(false)
  const snapshotRef = useRef<AppSnapshot | null>(null)
  const [remoteReady, setRemoteReady] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [exitHistory, setExitHistory] = useState(historicalExits)

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const bump = () => {
      lastActiveRef.current = Date.now()
    }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [])

  const pushNotification = useCallback(
    (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
      setNotifications((prev) => [
        {
          ...input,
          id: uid('ntf'),
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ])
    },
    [],
  )

  const applySnapshot = useCallback((snap: AppSnapshot) => {
    skipPersistRef.current = true
    setPeople(snap.people)
    setProjects(snap.projects)
    setUpdates(snap.updates)
    setQueries(snap.queries)
    setBlockers(snap.blockers)
    setDiscussions(snap.discussions)
    setNotifications(snap.notifications)
    setLeaveRequests(snap.leaveRequests)
    setRequirementRequests(snap.requirementRequests)
    setProjectStatusRequests(snap.projectStatusRequests || [])
    setWorkedDayRequests(snap.workedDayRequests || [])
    setChecklists(snap.checklists)
    setReviews(snap.reviews)
    setAssets(snap.assets)
    setAccessGrants(snap.accessGrants)
    setPayslips(snap.payslips)
    setHrTickets(snap.hrTickets)
    setRegularizations(snap.regularizations)
    setRoster(snap.roster)
    setIntegrations(snap.integrations)
    setChannelPosts(snap.channelPosts)
    setExitHistory(snap.historicalExits || [])
    window.setTimeout(() => {
      skipPersistRef.current = false
    }, 50)
  }, [])

  useEffect(() => {
    let cancelled = false
    void ensureRemoteConfig().then(() => {
      if (cancelled || !isRemoteConfigured()) return
      const stored = readStoredSession()
      if (!stored?.accessToken) return
      accessTokenRef.current = stored.accessToken
      void remoteBootstrap(stored.accessToken).then((res) => {
        if (cancelled || !res.ok) {
          if (!res.ok) {
            clearStoredSession()
            accessTokenRef.current = null
          }
          return
        }
        applySnapshot(res.data.snapshot)
        if (
          res.data.person &&
          res.data.person.status !== 'inactive' &&
          res.data.person.lifecycleStatus !== 'exited'
        ) {
          lastActiveRef.current = Date.now()
          setSession({ person: res.data.person, loginAt: new Date().toISOString() })
        }
        setSyncError(null)
        setRemoteReady(true)
      })
    })
    return () => {
      cancelled = true
    }
  }, [applySnapshot])

  const liveSnapshot: AppSnapshot = {
    people,
    projects,
    updates,
    queries,
    blockers,
    discussions,
    notifications,
    leaveRequests,
    requirementRequests,
    projectStatusRequests,
    workedDayRequests,
    checklists,
    reviews,
    assets,
    accessGrants,
    payslips,
    hrTickets,
    regularizations,
    roster,
    integrations,
    channelPosts,
    historicalExits: exitHistory,
  }
  snapshotRef.current = liveSnapshot

  const pushSnapshot = useCallback(async (snapshot: AppSnapshot) => {
    const token = accessTokenRef.current
    if (!token) return false
    const res = await remoteSaveSnapshot(token, { ...snapshot, people: publicPeople(snapshot.people) })
    if (!res.ok) {
      dirtyRef.current = true
      setSyncError(res.message)
      return false
    }
    dirtyRef.current = false
    setSyncError(null)
    return true
  }, [])

  useEffect(() => {
    if (skipPersistRef.current || !remoteReady || !accessTokenRef.current) return
    dirtyRef.current = true
    const snapshot = snapshotRef.current
    if (!snapshot) return
    const t = window.setTimeout(() => {
      void pushSnapshot(snapshot).then((ok) => {
        if (ok) return
        window.setTimeout(() => {
          const latest = snapshotRef.current
          if (latest && dirtyRef.current) void pushSnapshot(latest)
        }, 2000)
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [
    remoteReady,
    people,
    projects,
    updates,
    queries,
    blockers,
    discussions,
    notifications,
    leaveRequests,
    requirementRequests,
    projectStatusRequests,
    workedDayRequests,
    checklists,
    reviews,
    assets,
    accessGrants,
    payslips,
    hrTickets,
    regularizations,
    roster,
    integrations,
    channelPosts,
    exitHistory,
    pushSnapshot,
  ])

  useEffect(() => {
    if (!remoteReady) return
    const pull = async () => {
      if (dirtyRef.current || skipPersistRef.current) return
      const token = accessTokenRef.current
      if (!token) return
      const res = await remoteBootstrap(token)
      if (!res.ok || dirtyRef.current) return
      applySnapshot(res.data.snapshot)
      if (res.data.person) {
        setSession((current) =>
          current && current.person.id === res.data.person?.id
            ? { ...current, person: res.data.person as NonNullable<typeof res.data.person> }
            : current,
        )
      }
    }
    const timer = window.setInterval(() => void pull(), 4000)
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      const snapshot = snapshotRef.current
      if (snapshot && dirtyRef.current) void pushSnapshot(snapshot)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [remoteReady, applySnapshot, pushSnapshot])

  const login = useCallback((personId: string) => {
    const person = people.find((p) => p.id === personId)
    if (!person) return
    setSession({ person, loginAt: new Date().toISOString() })
  }, [people])

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (Date.now() < loginLockedUntil) {
      const wait = Math.ceil((loginLockedUntil - Date.now()) / 1000)
      return `Too many failed sign-ins. Try again in ${wait}s`
    }
    const raw = email.trim().toLowerCase()
    if (raw.includes('@') && !raw.endsWith(`@${COMPANY_DOMAIN}`)) {
      return `Use a company email ending with @${COMPANY_DOMAIN}`
    }
    await ensureRemoteConfig()
    const cleanEmail = normalizeCompanyEmail(email)
    const cleanPass = password.trim()
    if (!cleanEmail) {
      return `Use a company email ending with @${COMPANY_DOMAIN}`
    }

    if (isRemoteConfigured()) {
      const remote = await remoteLogin(cleanEmail, cleanPass)
      if (remote.ok && remote.data.person && remote.data.accessToken) {
        accessTokenRef.current = remote.data.accessToken
        storeSession({
          accessToken: remote.data.accessToken,
          refreshToken: remote.data.refreshToken,
        })
        if (remote.data.snapshot) applySnapshot(remote.data.snapshot)
        else skipPersistRef.current = false
        setRemoteReady(true)
        setSyncError(null)
        setLoginFails(0)
        setLoginLockedUntil(0)
        lastActiveRef.current = Date.now()
        setSession({ person: remote.data.person, loginAt: new Date().toISOString() })
        return null
      }
      if (!remote.ok && remote.status === 429) {
        return remote.message
      }
    }

    const person = people.find((p) => p.email.toLowerCase() === cleanEmail)
    if (!person || (person.password || DEMO_PASSWORD) !== cleanPass) {
      const nextFails = loginFails + 1
      setLoginFails(nextFails)
      if (nextFails >= 5) {
        setLoginLockedUntil(Date.now() + 2 * 60 * 1000)
        setLoginFails(0)
        return 'Too many failed sign-ins. Try again in 120s'
      }
      return 'Invalid email or password'
    }
    if (person.status === 'inactive' || person.lifecycleStatus === 'exited') {
      return 'This account is closed. The employee record stays in Employees for HR records.'
    }
    setLoginFails(0)
    setLoginLockedUntil(0)
    lastActiveRef.current = Date.now()
    if (isRemoteConfigured()) {
      setSyncError(
        'This session is on this browser only. Supabase sign-in did not start, so testers, team leaders, and updates are not being stored.',
      )
    }
    setSession({ person, loginAt: new Date().toISOString() })
    return null
  }, [people, loginFails, loginLockedUntil, applySnapshot])

  const registerEmployee: AppContextValue['registerEmployee'] = useCallback(
    async (input) => {
      if (!session || !canAct(session.person.role, ['hr'])) {
        return 'Only HR can register employees'
      }
      const email = normalizeCompanyEmail(input.email)
      if (!email) {
        return `Email must use @${COMPANY_DOMAIN}`
      }
      if (people.some((p) => p.email.toLowerCase() === email)) {
        return 'That company email is already registered'
      }
      const name = sanitizeText(input.name, 80)
      const password = input.password.trim()
      if (!name) return 'Name is required'
      if (!isStrongPassword(password)) return PASSWORD_POLICY
      const employeeCode = normalizeEmployeeCode(input.employeeCode || nextEmployeeCode(people))
      if (!employeeCode) return 'Employee ID is required (e.g. CSS001)'
      if (people.some((p) => (p.employeeCode || '').toUpperCase() === employeeCode)) {
        return 'That employee ID is already in use'
      }
      const role = input.role === 'tl' ? 'tl' : 'user'
      const person: Person = {
        id: uid(role === 'tl' ? 'tl' : 'user'),
        name,
        email,
        password,
        role,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0b4f3c&color=fff`,
        avatarUploaded: false,
        jobTitle: input.jobTitle ? sanitizeText(input.jobTitle, 80) : undefined,
        employeeCode,
        status: 'active',
        employmentType: input.employmentType || 'Full-Time',
        joinDate: input.joinDate || todayISO(),
        gender: input.gender ? sanitizeText(input.gender, 20) : undefined,
        dateOfBirth: input.dateOfBirth,
        phone: input.phone ? sanitizeText(input.phone, 30) : undefined,
        location: input.location ? sanitizeText(input.location, 80) : undefined,
        managerId: input.managerId && people.some((p) => p.id === input.managerId) ? input.managerId : undefined,
        skills: input.skills
          ? input.skills
              .split(',')
              .map((s) => sanitizeText(s, 40))
              .filter(Boolean)
              .slice(0, 8)
          : [],
        lifecycleStatus: 'onboarding',
        probationEndDate: addCalendarDays(input.joinDate || todayISO(), 90),
        contractEndDate: addCalendarDays(input.joinDate || todayISO(), 365),
        nextAppraisalDate: addCalendarDays(input.joinDate || todayISO(), 180),
        shiftId: 'shift-general',
        mustChangePassword: true,
        department: input.department ? sanitizeText(input.department, 80) : 'VAPT',
        leaveBalance: defaultLeaveBalance(),
        performanceScore: 80,
        documents: [
          { name: 'Contract Agreement.pdf', kind: 'pdf' },
          { name: 'Curriculum Vitae.pdf', kind: 'pdf' },
        ],
        notes: [],
      }
      await ensureRemoteConfig()
      const token = accessTokenRef.current
      if (isRemoteConfigured() && !token) {
        return 'Database sign-in is not active, so this tester or team leader cannot be stored yet.'
      }
      if (token) {
        const saved = await remoteProvisionEmployee(token, person, password)
        if (!saved.ok) return saved.message
      }
      setPeople((prev) => [...prev, person])
      setChecklists((prev) => [...prev, makeChecklist(person.id, 'onboarding')])
      return null
    },
    [session, people],
  )

  useEffect(() => {
    if (!session) return
    const fresh = people.find((p) => p.id === session.person.id)
    if (!fresh) return
    if (
      fresh.name !== session.person.name ||
      fresh.jobTitle !== session.person.jobTitle ||
      fresh.role !== session.person.role ||
      fresh.avatar !== session.person.avatar ||
      fresh.employeeCode !== session.person.employeeCode ||
      fresh.phone !== session.person.phone ||
      fresh.location !== session.person.location ||
      fresh.gender !== session.person.gender ||
      fresh.dateOfBirth !== session.person.dateOfBirth ||
      fresh.avatarUploaded !== session.person.avatarUploaded ||
      fresh.mustChangePassword !== session.person.mustChangePassword ||
      fresh.managerId !== session.person.managerId ||
      fresh.shiftId !== session.person.shiftId ||
      fresh.lifecycleStatus !== session.person.lifecycleStatus ||
      JSON.stringify(fresh.leaveBalance) !== JSON.stringify(session.person.leaveBalance) ||
      JSON.stringify(fresh.skills) !== JSON.stringify(session.person.skills)
    ) {
      setSession((s) => (s ? { ...s, person: fresh } : s))
    }
  }, [people, session])

  const logout = useCallback(() => {
    const snapshot = snapshotRef.current
    const token = accessTokenRef.current
    if (token && snapshot && dirtyRef.current) void remoteSaveSnapshot(token, { ...snapshot, people: publicPeople(snapshot.people) })
    accessTokenRef.current = null
    dirtyRef.current = false
    setRemoteReady(false)
    setSyncError(null)
    clearStoredSession()
    setSession(null)
  }, [])

  useEffect(() => {
    if (!session) return
    const idle = Date.now() - lastActiveRef.current
    const age = Date.now() - new Date(session.loginAt).getTime()
    if (idle > 30 * 60 * 1000 || age > 8 * 60 * 60 * 1000) {
      const snapshot = snapshotRef.current
      const token = accessTokenRef.current
      if (token && snapshot && dirtyRef.current) {
        void remoteSaveSnapshot(token, { ...snapshot, people: publicPeople(snapshot.people) })
      }
      accessTokenRef.current = null
      dirtyRef.current = false
      setRemoteReady(false)
      setSyncError(null)
      clearStoredSession()
      setSession(null)
    }
  }, [nowTick, session])

  const hoursSinceLogin = useMemo(() => {
    if (!session) return 0
    void nowTick
    return (Date.now() - new Date(session.loginAt).getTime()) / (1000 * 60 * 60)
  }, [session, nowTick])

  const todayUpdates = useMemo(() => {
    if (!session) return []
    const today = localDateISO()
    return updates.filter((u) => u.userId === session.person.id && u.date === today)
  }, [session, updates])

  const morningUpdateToday = todayUpdates.some((u) => slotFromUpdate(u) === 'morning')
  const eveningUpdateToday = todayUpdates.some((u) => slotFromUpdate(u) === 'evening')
  const currentSlot = currentUpdateSlot(new Date(nowTick))
  const lateMorningGatewayOpen = isLateMorningGateway(new Date(nowTick))
  const workedApprovedToday = Boolean(
    session &&
      workedDayRequests.some(
        (req) =>
          req.userId === session.person.id &&
          req.date === localDateISO() &&
          req.status === 'approved',
      ),
  )
  const markedWorkedToday = todayUpdates.some((u) => u.markedWorked)
  const hasSubmittedToday =
    (morningUpdateToday && eveningUpdateToday) || workedApprovedToday || markedWorkedToday
  const todayMarkedWorked = workedApprovedToday || markedWorkedToday

  const trackerDueSoon =
    !!session &&
    session.person.role === 'user' &&
    currentSlot !== null &&
    !(currentSlot === 'morning' ? morningUpdateToday : eveningUpdateToday)

  const nowMins = new Date(nowTick).getHours() * 60 + new Date(nowTick).getMinutes()
  const trackerOverdue =
    !!session &&
    session.person.role === 'user' &&
    ((!morningUpdateToday && nowMins > 10 * 60 + 30) ||
      (!eveningUpdateToday && nowMins > 19 * 60 + 30))

  const myProjects = useMemo(() => {
    if (!session) return []
    const { person } = session
    if (person.role === 'user') {
      return projects.filter((p) =>
        p.allocations.some((a) => a.userId === person.id),
      )
    }
    if (person.role === 'tl') {
      return projects.filter((p) => p.tlId === person.id)
    }
    return projects
  }, [session, projects])

  const activeProjects = useMemo(
    () => myProjects.filter((p) => p.status === 'active'),
    [myProjects],
  )

  const openBlockers = useMemo(
    () => blockers.filter((b) => b.status === 'open' || b.status === 'in-review'),
    [blockers],
  )

  const myNotifications = useMemo(() => {
    if (!session) return []
    const list =
      session.person.role === 'admin' || session.person.role === 'hr'
        ? notifications
        : notifications.filter((n) => n.recipientId === session.person.id)
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [session, notifications])

  const unreadCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications],
  )

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    if (!session) return
    setNotifications((prev) =>
      prev.map((n) =>
        session.person.role === 'admin' ||
        session.person.role === 'hr' ||
        n.recipientId === session.person.id
          ? { ...n, read: true }
          : n,
      ),
    )
  }, [session])

  const addDailyUpdate: AppContextValue['addDailyUpdate'] = useCallback(
    ({ projectId, workPoints, hoursSpent }) => {
      if (!session || !canAct(session.person.role, ['user'])) {
        return 'Only testers submit daily updates'
      }
      const slot = currentUpdateSlot()
      if (!slot) {
        return 'Updates can only be submitted from 10:00–10:30 AM and 7:00–7:30 PM'
      }
      const today = localDateISO()
      const already = updates.some(
        (u) => u.userId === session.person.id && u.date === today && slotFromUpdate(u) === slot,
      )
      if (already) {
        return `${updateSlotLabel(slot)} is already submitted for today`
      }
      const project = projects.find((p) => p.id === projectId)
      const allowed = project?.allocations.some((a) => a.userId === session.person.id)
      if (!project || !allowed) return 'Choose a project allocated to you'
      const points = sanitizeLines(workPoints, 20, 400)
      if (points.length === 0) return 'Add at least one work point'
      const entry: DailyUpdate = {
        id: uid('upd'),
        projectId,
        userId: session.person.id,
        userName: session.person.name,
        date: today,
        submittedAt: new Date().toISOString(),
        workDone: points.join('\n'),
        workPoints: points,
        hoursSpent: clampNumber(hoursSpent, 0, 24),
        slot,
      }
      setUpdates((prev) => [entry, ...prev])
      const recipients = new Set<string>([
        project.tlId,
        ...orgAdminIds,
        session.person.id,
        ...project.allocations.map((a) => a.userId),
      ])
      recipients.forEach((recipientId) => {
        pushNotification({
          recipientId,
          type: 'tracker',
          title:
            recipientId === session.person.id
              ? `${slot === 'morning' ? 'Morning' : 'Evening'} update submitted`
              : `Daily update from ${session.person.name}`,
          message: `${project.name}: ${points.join(' · ').slice(0, 80)}`,
          relatedId: entry.id,
        })
      })
      return null
    },
    [session, projects, updates, pushNotification, orgAdminIds],
  )

  const addQuery: AppContextValue['addQuery'] = useCallback(
    ({ projectId, subject, message, toPersonId: requestedTo, attachments }) => {
      if (!session) return
      const project = projects.find((p) => p.id === projectId) || projects[0]
      if (!project) return
      const cleanMessage = sanitizeText(message, 2000)
      const files = cleanAttachments(attachments)
      const cleanSubject =
        sanitizeText(subject || '', 160) ||
        sanitizeText(cleanMessage, 40) ||
        (files.length ? 'Chat' : '')
      if (!cleanSubject || (!cleanMessage && files.length === 0)) return
      const toPersonId =
        requestedTo &&
        requestedTo !== session.person.id &&
        people.some((p) => p.id === requestedTo)
          ? requestedTo
          : ''
      if (!toPersonId) return
      const recipient = people.find((p) => p.id === toPersonId)
      const toRole: Role = recipient?.role || 'tl'
      const firstMsg: ChatMessage = {
        id: uid('qm'),
        senderId: session.person.id,
        senderName: session.person.name,
        body: cleanMessage,
        createdAt: new Date().toISOString(),
        attachments: files,
      }
      const item: QueryItem = {
        id: uid('q'),
        projectId: project.id,
        fromUserId: session.person.id,
        fromUserName: session.person.name,
        toRole,
        toPersonId,
        subject: cleanSubject,
        message: cleanMessage,
        createdAt: new Date().toISOString(),
        status: 'open',
        messages: [firstMsg],
        folder: 'inbox',
        starred: false,
      }
      setQueries((prev) => [item, ...prev])
      pushNotification({
        recipientId: toPersonId,
        type: 'query',
        title: `New query from ${session.person.name}`,
        message: cleanSubject,
        relatedId: item.id,
      })
    },
    [session, projects, people, pushNotification],
  )

  const replyQuery = useCallback(
    (queryId: string, reply: string) => {
      if (!session) return
      const cleanReply = sanitizeText(reply, 2000)
      if (!cleanReply) return
      setQueries((prev) =>
        prev.map((q) => {
          if (q.id !== queryId) return q
          const msg: ChatMessage = {
            id: uid('qm'),
            senderId: session.person.id,
            senderName: session.person.name,
            body: cleanReply,
            createdAt: new Date().toISOString(),
          }
          pushNotification({
            recipientId: q.fromUserId,
            type: 'query-reply',
            title: `Reply from ${session.person.name}`,
            message: q.subject,
            relatedId: queryId,
          })
          return {
            ...q,
            status: 'answered' as const,
            reply: cleanReply,
            messages: [...(q.messages || []), msg],
          }
        }),
      )
    },
    [session, pushNotification],
  )

  const sendQueryMessage = useCallback(
    (queryId: string, body: string, attachments?: QueryAttachment[]) => {
      if (!session) return
      const files = cleanAttachments(attachments)
      const cleanBody = sanitizeText(body, 2000)
      if (!cleanBody && files.length === 0) return
      setQueries((prev) =>
        prev.map((q) => {
          if (q.id !== queryId) return q
          if (
            session.person.id !== q.fromUserId &&
            session.person.id !== q.toPersonId
          ) {
            return q
          }
          const msg: ChatMessage = {
            id: uid('qm'),
            senderId: session.person.id,
            senderName: session.person.name,
            body: cleanBody,
            createdAt: new Date().toISOString(),
            attachments: files,
          }
          const otherPersonId =
            session.person.id === q.fromUserId ? q.toPersonId : q.fromUserId
          if (otherPersonId !== session.person.id) {
            pushNotification({
              recipientId: otherPersonId,
              type: 'query-reply',
              title: `Message from ${session.person.name}`,
              message: cleanBody.slice(0, 80) || files[0]?.name || 'Attachment',
              relatedId: queryId,
            })
          }
          return {
            ...q,
            status: 'open' as const,
            messages: [...(q.messages || []), msg],
          }
        }),
      )
    },
    [session, pushNotification],
  )

  const toggleQueryStar = useCallback((queryId: string) => {
    setQueries((prev) =>
      prev.map((q) => (q.id === queryId ? { ...q, starred: !q.starred } : q)),
    )
  }, [])

  const addBlocker: AppContextValue['addBlocker'] = useCallback(
    ({ projectId, title, description, severity }) => {
      if (!session || !canAct(session.person.role, ['user', 'tl'])) {
        return 'Only testers and Team Leaders can raise blockers'
      }
      const project = projects.find((p) => p.id === projectId)
      if (!project) return 'Choose a project'
      const cleanTitle = sanitizeText(title, 160)
      const cleanDescription = sanitizeText(description, 2000)
      if (!cleanTitle || !cleanDescription) return 'Title and description are required'
      const item: Blocker = {
        id: uid('blk'),
        projectId,
        projectName: project.name,
        raisedById: session.person.id,
        raisedByName: session.person.name,
        raisedByRole: session.person.role,
        title: cleanTitle,
        description: cleanDescription,
        severity,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      setBlockers((prev) => [item, ...prev])
      const recipients = new Set<string>([...orgAdminIds])
      if (session.person.role === 'tl') {
        project.allocations.forEach((row) => recipients.add(row.userId))
      } else {
        recipients.add(project.tlId)
      }
      recipients.forEach((recipientId) => {
        if (recipientId === session.person.id) return
        pushNotification({
          recipientId,
          type: severity === 'critical' ? 'critical-vuln' : 'blocker',
          title:
            session.person.role === 'tl'
              ? `Team Leader blocker on ${project.name}`
              : `${severity.toUpperCase()} blocker on ${project.name}`,
          message: cleanTitle,
          relatedId: item.id,
        })
      })
      return null
    },
    [session, projects, pushNotification, orgAdminIds],
  )

  const updateBlockerStatus = useCallback(
    (blockerId: string, status: Blocker['status']) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr', 'tl'])) return
      setBlockers((prev) => {
        const target = prev.find((b) => b.id === blockerId)
        if (target && status === 'resolved') {
          pushNotification({
            recipientId: target.raisedById,
            type: 'blocker',
            title: `Blocker resolved by ${session.person.name}`,
            message: target.title,
            relatedId: blockerId,
          })
        }
        return prev.map((b) => (b.id === blockerId ? { ...b, status } : b))
      })
    },
    [session, pushNotification],
  )

  const addDiscussion: AppContextValue['addDiscussion'] = useCallback((input) => {
    if (!session || !canAct(session.person.role, ['admin', 'hr', 'tl'])) return
    setDiscussions((prev) => [
      {
        ...input,
        id: uid('cd'),
        summary: sanitizeText(input.summary, 2000),
        participants: sanitizeText(input.participants, 200),
        outcome: input.outcome ? sanitizeText(input.outcome, 400) : input.outcome,
        loggedBy: sanitizeText(input.loggedBy, 80),
      },
      ...prev,
    ])
  }, [session])

  const setProjectStatus = useCallback(
    (
      projectId: string,
      status: ProjectStatus,
      extra?: {
        closureDate?: string
        holdSource?: 'client' | 'internal'
        holdRemark?: string
        closureRemark?: string
      },
    ) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr'])) return
      const current = projects.find((p) => p.id === projectId)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status,
                closureDate:
                  status === 'closed'
                    ? extra?.closureDate || todayISO()
                    : status === 'active'
                      ? undefined
                      : p.closureDate,
                progress: status === 'closed' ? 100 : p.progress,
                holdSource: status === 'on-hold' ? extra?.holdSource : undefined,
                holdRemark: status === 'on-hold' ? extra?.holdRemark : undefined,
                closureRemark: status === 'closed' ? extra?.closureRemark : undefined,
              }
            : p,
        ),
      )
      setProjectStatusRequests((prev) =>
        prev.map((r) =>
          r.projectId === projectId && r.status === 'pending'
            ? { ...r, status: 'approved' as const, decidedBy: session.person.name }
            : r,
        ),
      )
      if (!current) return
      const recipients = new Set<string>([
        current.tlId,
        ...people.filter((p) => p.role === 'admin' || p.role === 'hr').map((p) => p.id),
        ...current.allocations.map((a) => a.userId),
      ])
      recipients.delete(session.person.id)
      const title =
        status === 'on-hold'
          ? `${current.name} put on hold`
          : status === 'closed'
            ? `${current.name} closed`
            : `${current.name} reopened`
      const message =
        status === 'on-hold'
          ? `${extra?.holdSource === 'internal' ? 'From our side' : 'From client side'}${
              extra?.holdRemark ? ` — ${extra.holdRemark}` : ''
            }`
          : extra?.closureRemark || current.name
      recipients.forEach((recipientId) => {
        pushNotification({
          recipientId,
          type: 'lifecycle',
          title,
          message,
          relatedId: projectId,
        })
      })
    },
    [projects, session, people, pushNotification],
  )

  const requestProjectStatusChange: AppContextValue['requestProjectStatusChange'] = useCallback(
    ({ projectId, action, remark, holdSource }) => {
      if (!session || session.person.role !== 'tl') {
        return 'Only Team Leaders can request hold or closure'
      }
      const project = projects.find((p) => p.id === projectId)
      if (!project) return 'Project not found'
      if (project.tlId !== session.person.id) return 'You can only request changes on your projects'
      const cleanRemark = sanitizeText(remark, 800)
      if (!cleanRemark) return 'A remark is required'
      if (projectStatusRequests.some((r) => r.projectId === projectId && r.status === 'pending')) {
        return 'A request is already waiting for Admin approval'
      }
      const item: ProjectStatusRequest = {
        id: uid('psr'),
        projectId,
        projectName: project.name,
        requestedById: session.person.id,
        requestedByName: session.person.name,
        action,
        remark: cleanRemark,
        holdSource: action === 'on-hold' ? holdSource || 'client' : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setProjectStatusRequests((prev) => [item, ...prev])
      people
        .filter((p) => p.role === 'admin' || p.role === 'hr')
        .forEach((admin) => {
          pushNotification({
            recipientId: admin.id,
            type: 'lifecycle',
            title: `${session.person.name} requested to ${
              action === 'on-hold' ? 'hold' : action === 'closed' ? 'close' : 'reopen'
            } ${project.name}`,
            message: cleanRemark,
            relatedId: item.id,
          })
        })
      return null
    },
    [session, projects, projectStatusRequests, people, pushNotification],
  )

  const decideProjectStatusRequest = useCallback(
    (requestId: string, decision: 'approve' | 'reject', adminNote?: string) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr'])) return
      const request = projectStatusRequests.find((r) => r.id === requestId)
      if (!request || request.status !== 'pending') return
      const note = adminNote ? sanitizeText(adminNote, 400) : ''
      setProjectStatusRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: decision === 'approve' ? 'approved' : 'rejected',
                decidedBy: session.person.name,
                adminNote: note || undefined,
              }
            : r,
        ),
      )
      if (decision === 'approve') {
        setProjectStatus(request.projectId, request.action, {
          holdSource: request.holdSource,
          holdRemark: request.remark,
          closureRemark: request.action === 'closed' ? request.remark : undefined,
        })
      } else {
        pushNotification({
          recipientId: request.requestedById,
          type: 'lifecycle',
          title: `Request rejected: ${request.projectName}`,
          message: note || `Admin rejected the ${request.action} request`,
          relatedId: request.projectId,
        })
      }
    },
    [session, projectStatusRequests, setProjectStatus, pushNotification],
  )

  const renamePerson = useCallback((personId: string, name: string, jobTitle?: string) => {
    if (!session || !canAct(session.person.role, ['admin', 'hr'])) return
    const trimmed = sanitizeText(name, 80)
    if (!trimmed) return
    const title = jobTitle ? sanitizeText(jobTitle, 80) || undefined : undefined
    setPeople((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, name: trimmed, jobTitle: title } : p)),
    )
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        team: p.team.map((m) =>
          m.id === personId ? { ...m, name: trimmed, jobTitle: title } : m,
        ),
      })),
    )
  }, [session])

  const updateEmployeeCode = useCallback(
    (personId: string, employeeCode: string) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr'])) {
        return 'Only Admin can change employee IDs'
      }
      const code = normalizeEmployeeCode(employeeCode)
      if (!code) return 'Use a code like CSS001'
      const taken = people.some(
        (p) => p.id !== personId && (p.employeeCode || '').toUpperCase() === code,
      )
      if (taken) return 'That employee ID is already in use'
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, employeeCode: code } : p)))
      return null
    },
    [session, people],
  )

  const updateOwnProfile = useCallback(
    (input: { avatarDataUrl?: string }) => {
      if (!session || !canAct(session.person.role, ['user', 'tl'])) {
        return 'Only testers and Team Leaders can update this photo'
      }
      const current = people.find((p) => p.id === session.person.id)
      if (!current) return 'Profile not found'
      let avatar = current.avatar
      let avatarUploaded = Boolean(current.avatarUploaded)
      if (input.avatarDataUrl) {
        const safe = sanitizeImageDataUrl(input.avatarDataUrl)
        if (!safe) return 'Upload a JPG, PNG, or WEBP photo under 750 KB'
        avatar = safe
        avatarUploaded = true
      }
      if (!avatarUploaded) return 'Profile photo is required'
      setPeople((prev) =>
        prev.map((p) =>
          p.id === current.id ? confirmAfterSetup({ ...p, avatar, avatarUploaded }) : p,
        ),
      )
      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          team: project.team.map((m) => (m.id === current.id ? { ...m, avatar } : m)),
        })),
      )
      return null
    },
    [session, people],
  )

  const changePassword = useCallback(
    (currentPassword: string, nextPassword: string) => {
      if (!session || !canAct(session.person.role, ['user', 'tl'])) {
        return 'Only testers and Team Leaders can change password here'
      }
      const current = people.find((p) => p.id === session.person.id)
      if (!current) return 'Profile not found'
      if ((current.password || DEMO_PASSWORD) !== currentPassword.trim()) {
        return 'Current password is incorrect'
      }
      const next = nextPassword.trim()
      if (!isStrongPassword(next)) return PASSWORD_POLICY
      if (next === currentPassword.trim()) return 'Choose a different password'
      setPeople((prev) =>
        prev.map((p) =>
          p.id === current.id
            ? confirmAfterSetup({ ...p, password: next, mustChangePassword: false })
            : p,
        ),
      )
      const token = accessTokenRef.current
      if (token) void remoteUpdatePassword(token, next)
      return null
    },
    [session, people],
  )

  const promoteToTl = useCallback((personId: string) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === personId && p.role === 'user' ? { ...p, role: 'tl' } : p)),
    )
  }, [])

  const createProject: AppContextValue['createProject'] = useCallback(
    ({
      name,
      client,
      tlId,
      allocateUserIds,
      remarks,
      startDate,
      closureDate,
      initialReportDate,
      closureReportDate,
      requirements,
      sharepoint,
      scope,
      vpn,
      scopeCredits,
    }) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr', 'tl'])) return
      const resolvedTlId =
        session.person.role === 'tl' ? session.person.id : tlId
      const memberIds = Array.from(new Set([...allocateUserIds, resolvedTlId]))
      const allocatedPeople = people.filter((p) => memberIds.includes(p.id))
      const tl = people.find((p) => p.id === resolvedTlId)
      if (!tl) return
      if (!startDate || !closureDate || !initialReportDate || !closureReportDate) return
      promoteToTl(resolvedTlId)

      const project: Project = {
        id: uid('proj'),
        name: sanitizeText(name, 120),
        client: sanitizeText(client, 120),
        status: 'active',
        progress: 0,
        startDate: sanitizeText(startDate, 12),
        closureDate: sanitizeText(closureDate, 12),
        initialReportDate: sanitizeText(initialReportDate, 12),
        closureReportDate: sanitizeText(closureReportDate, 12),
        tlId: resolvedTlId,
        allocations: memberIds.map((userId) => ({
          userId,
          allocatedAt: new Date().toISOString(),
        })),
        team: [
          { id: tl.id, name: tl.name, role: 'tl', avatar: tl.avatar, jobTitle: tl.jobTitle },
          ...allocatedPeople
            .filter((p) => p.id !== tl.id)
            .map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              avatar: p.avatar,
              jobTitle: p.jobTitle,
            })),
        ],
        sharepoint: (sharepoint || [])
          .map((link) => ({
            ...link,
            title: sanitizeText(link.title, 120),
            url: sanitizeUrl(link.url),
            sharedBy: sanitizeText(link.sharedBy, 80),
          }))
          .filter((link) => link.title && link.url),
        scope: scope || { urls: [], ips: [], configFiles: [], notes: '' },
        vpn: vpn?.length ? vpn : [],
        scopeCredits: scopeCredits?.length ? scopeCredits : [],
        remarks: sanitizeText(remarks, 2000),
        requirements: toRequirementItems(requirements),
        taskTrack: { todo: 6, inProgress: 0, done: 0 },
      }
      setProjects((prev) => [project, ...prev])
      memberIds.forEach((userId) => {
        if (userId === session.person.id) return
        pushNotification({
          recipientId: userId,
          type: 'general',
          title: userId === resolvedTlId ? 'Assigned as Team Leader' : 'New project allocated',
          message:
            userId === resolvedTlId
              ? `You are TL for ${name}`
              : `${name} has been assigned to you`,
          relatedId: project.id,
        })
      })
    },
    [session, people, pushNotification, promoteToTl],
  )

  const updateProjectAssignment: AppContextValue['updateProjectAssignment'] = useCallback(
    ({
      projectId,
      tlId,
      allocateUserIds,
      sharepoint,
      scope,
      vpn,
      scopeCredits,
      remarks,
      startDate,
      closureDate,
      initialReportDate,
      closureReportDate,
    }) => {
      const memberIds = Array.from(new Set([...allocateUserIds, tlId]))
      const tl = people.find((p) => p.id === tlId)
      const allocatedPeople = people.filter((p) => memberIds.includes(p.id))
      if (!tl) return
      promoteToTl(tlId)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tlId,
                allocations: memberIds.map((userId) => ({
                  userId,
                  allocatedAt: new Date().toISOString(),
                })),
                team: [
                  {
                    id: tl.id,
                    name: tl.name,
                    role: 'tl' as const,
                    avatar: tl.avatar,
                    jobTitle: tl.jobTitle,
                  },
                  ...allocatedPeople
                    .filter((u) => u.id !== tl.id)
                    .map((u) => ({
                      id: u.id,
                      name: u.name,
                      role: u.role,
                      avatar: u.avatar,
                      jobTitle: u.jobTitle,
                    })),
                ],
                sharepoint: sharepoint ?? p.sharepoint,
                scope: scope ?? p.scope,
                vpn: vpn ?? p.vpn,
                scopeCredits: scopeCredits ?? p.scopeCredits,
                remarks: remarks ?? p.remarks,
                startDate: startDate ? sanitizeText(startDate, 12) : p.startDate,
                closureDate: closureDate ? sanitizeText(closureDate, 12) : p.closureDate,
                initialReportDate: initialReportDate
                  ? sanitizeText(initialReportDate, 12)
                  : p.initialReportDate,
                closureReportDate: closureReportDate
                  ? sanitizeText(closureReportDate, 12)
                  : p.closureReportDate,
              }
            : p,
        ),
      )
    },
    [people, promoteToTl],
  )

  const applyRequirementChange: AppContextValue['applyRequirementChange'] = useCallback(
    ({ projectId, action, index, newValue }) => {
      if (!session) return
      const project = projects.find((p) => p.id === projectId)
      if (!project) return

      let proposed = project.requirements.map((item) => ({ ...item }))
      let oldValue: string | undefined
      if (action === 'add' && newValue?.trim()) {
        proposed = [
          ...proposed,
          {
            id: uid('req'),
            text: sanitizeText(newValue, 400),
            status: 'incomplete' as const,
          },
        ]
      } else if (action === 'edit' && index !== undefined && newValue?.trim() && proposed[index]) {
        oldValue = proposed[index].text
        proposed[index] = { ...proposed[index], text: sanitizeText(newValue, 400) }
      } else if (action === 'delete' && index !== undefined && proposed[index]) {
        oldValue = proposed[index].text
        proposed = proposed.filter((_, i) => i !== index)
      } else {
        return
      }

      // Admin applies immediately
      if (isOrgAdmin(session.person.role)) {
        const next = applyAutoClose({ ...project, requirements: proposed })
        setProjects((prev) => prev.map((p) => (p.id === projectId ? next.project : p)))
        if (next.didClose) notifyAutoClosed(next.project, pushNotification, orgAdminIds)
        return
      }

      // TL needs Admin or HR approval
      const req: RequirementChangeRequest = {
        id: uid('reqch'),
        projectId,
        projectName: project.name,
        requestedById: session.person.id,
        requestedByName: session.person.name,
        action,
        index,
        oldValue,
        newValue: newValue?.trim(),
        proposedRequirements: proposed,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setRequirementRequests((prev) => [req, ...prev])
      notifyRecipients(orgAdminIds, pushNotification, {
        type: 'requirement',
        title: `Requirement ${action} approval needed`,
        message: `${session.person.name} on ${project.name}`,
        relatedId: req.id,
      })
    },
    [session, projects, pushNotification, orgAdminIds],
  )

  const updateRequirementStatus = useCallback(
    (projectId: string, requirementId: string, status: RequirementStatus) => {
      if (!session || !canAct(session.person.role, ['admin', 'hr', 'tl'])) return
      const current = projects.find((project) => project.id === projectId)
      if (!current) return
      const next = applyAutoClose({
        ...current,
        requirements: current.requirements.map((item) =>
          item.id === requirementId ? { ...item, status } : item,
        ),
      })
      setProjects((prev) => prev.map((project) => (project.id === projectId ? next.project : project)))
      if (next.didClose) notifyAutoClosed(next.project, pushNotification, orgAdminIds)
    },
    [session, projects, pushNotification, orgAdminIds],
  )

  const approveRequirementChange = useCallback(
    (requestId: string) => {
      setRequirementRequests((prev) => {
        const target = prev.find((r) => r.id === requestId)
        if (target && target.status === 'pending') {
          setProjects((ps) =>
            ps.map((p) => {
              if (p.id !== target.projectId) return p
              const next = applyAutoClose({
                ...p,
                requirements: target.proposedRequirements,
              })
              if (next.didClose) notifyAutoClosed(next.project, pushNotification, orgAdminIds)
              return next.project
            }),
          )
          pushNotification({
            recipientId: target.requestedById,
            type: 'requirement',
            title: 'Requirement change approved',
            message: target.projectName,
            relatedId: requestId,
          })
        }
        return prev.map((r) =>
          r.id === requestId ? { ...r, status: 'approved' as const } : r,
        )
      })
    },
    [pushNotification],
  )

  const rejectRequirementChange = useCallback(
    (requestId: string) => {
      setRequirementRequests((prev) => {
        const target = prev.find((r) => r.id === requestId)
        if (target) {
          pushNotification({
            recipientId: target.requestedById,
            type: 'requirement',
            title: 'Requirement change rejected',
            message: target.projectName,
            relatedId: requestId,
          })
        }
        return prev.map((r) =>
          r.id === requestId ? { ...r, status: 'rejected' as const } : r,
        )
      })
    },
    [pushNotification],
  )

  const submitLeaveRequest: AppContextValue['submitLeaveRequest'] = useCallback(
    ({ fromDate, toDate, reason, kind }) => {
      if (!session || (session.person.role !== 'user' && session.person.role !== 'tl')) {
        return 'Only testers and Team Leaders can request leave'
      }
      const days = leaveDayCount(fromDate, toDate)
      if (!days) return 'Choose a valid date range'
      const cleanedReason = sanitizeText(reason, 1000)
      if (!cleanedReason) return 'Reason is required'
      const leaveKind: LeaveKind =
        kind === 'sick' || kind === 'casual' || kind === 'earned' || kind === 'paid' || kind === 'other'
          ? kind
          : 'other'
      const bucket = quotaBucket(leaveKind)
      if (bucket) {
        const remaining = remainingLeave(session.person, leaveRequests, bucket, {
          updates,
          workedDays: workedDayRequests,
        })
        if (days > remaining) {
          return remaining <= 0
            ? `All ${bucket} leave days are used or already requested`
            : `Only ${remaining} ${bucket} leave day${remaining === 1 ? '' : 's'} remaining`
        }
      }
      const isTlSelf = session.person.role === 'tl'
      const myProj = projects.find((p) =>
        isTlSelf
          ? p.tlId === session.person.id
          : p.allocations.some((a) => a.userId === session.person.id),
      )
      const tlId = isTlSelf ? session.person.id : myProj?.tlId || 'admin-2'
      const leave: LeaveRequest = {
        id: uid('lv'),
        userId: session.person.id,
        userName: session.person.name,
        userAvatar: session.person.avatar,
        fromDate: sanitizeText(fromDate, 12),
        toDate: sanitizeText(toDate, 12),
        reason: cleanedReason,
        kind: leaveKind,
        status: isTlSelf ? 'pending-admin' : 'pending-tl',
        tlId,
        createdAt: new Date().toISOString(),
      }
      setLeaveRequests((prev) => [leave, ...prev])
      if (isTlSelf) {
        notifyRecipients(orgAdminIds, pushNotification, {
          type: 'leave',
          title: 'Team Leader leave request',
          message: `${session.person.name}: ${fromDate} → ${toDate}`,
          relatedId: leave.id,
        })
        pushNotification({
          recipientId: session.person.id,
          type: 'leave',
          title: 'Leave request submitted',
          message: `Waiting for Admin or HR approval: ${fromDate} → ${toDate}`,
          relatedId: leave.id,
        })
      } else {
        pushNotification({
          recipientId: tlId,
          type: 'leave',
          title: 'New leave request',
          message: `${session.person.name}: ${fromDate} → ${toDate}`,
          relatedId: leave.id,
        })
        pushNotification({
          recipientId: session.person.id,
          type: 'leave',
          title: 'Leave request submitted',
          message: `Waiting for Team Leader review: ${fromDate} → ${toDate}`,
          relatedId: leave.id,
        })
      }
      return null
    },
    [session, projects, leaveRequests, updates, workedDayRequests, pushNotification, orgAdminIds],
  )

  const queueChannelPost = useCallback(
    (title: string, message: string) => {
      const stamp = new Date().toISOString()
      const rows: ChannelPost[] = []
      const deliver = (channel: 'slack' | 'teams', webhookRaw: string, enabled: boolean) => {
        if (!enabled) return
        const id = uid('ch')
        const webhook = httpsWebhook(webhookRaw)
        rows.push({
          id,
          channel,
          title: sanitizeText(title, 120),
          message: sanitizeText(message, 400),
          createdAt: stamp,
          delivery: webhook ? 'logged' : 'logged',
        })
        if (!webhook) return
        void fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${title}\n${message}` }),
        })
          .then((res) => {
            setChannelPosts((prev) =>
              prev.map((p) =>
                p.id === id ? { ...p, delivery: res.ok ? 'sent' : 'failed' } : p,
              ),
            )
          })
          .catch(() => {
            setChannelPosts((prev) =>
              prev.map((p) => (p.id === id ? { ...p, delivery: 'failed' } : p)),
            )
          })
      }
      deliver('slack', integrations.slackWebhook, integrations.slackEnabled)
      deliver('teams', integrations.teamsWebhook, integrations.teamsEnabled)
      if (rows.length) setChannelPosts((prev) => [...rows, ...prev])
    },
    [integrations],
  )

  const decideLeaveRequest = useCallback(
    (leaveId: string, decision: 'approve' | 'reject', note: string) => {
      if (!session) return
      const cleanedNote = sanitizeText(note, 1000)
      if (decision === 'approve' && !cleanedNote) return
      const target = leaveRequests.find((lv) => lv.id === leaveId)
      const actorIsOrgAdmin = isOrgAdmin(session.person.role)
      const bucket = target ? quotaBucket(target.kind) : null
      if (
        decision === 'approve' &&
        actorIsOrgAdmin &&
        target?.status === 'pending-admin' &&
        bucket
      ) {
        const days = leaveDayCount(target.fromDate, target.toDate)
        const owner = people.find((p) => p.id === target.userId)
        const remaining = owner
          ? remainingLeave(
              owner,
              leaveRequests.filter((row) => row.id !== leaveId),
              bucket,
              { updates, workedDays: workedDayRequests },
            )
          : 0
        if (days > remaining) return
        setPeople((prev) =>
          prev.map((p) =>
            p.id === target.userId
              ? { ...p, leaveBalance: applyLeaveUsage(p.leaveBalance, bucket, days) }
              : p,
          ),
        )
      }
      setLeaveRequests((prev) =>
        prev.map((lv) => {
          if (lv.id !== leaveId) return lv
          if (session.person.role === 'tl' && lv.userId === session.person.id) return lv
          if (decision === 'reject') {
            if (
              !(
                (session.person.role === 'tl' &&
                  lv.tlId === session.person.id &&
                  lv.status === 'pending-tl') ||
                (actorIsOrgAdmin &&
                  (lv.status === 'pending-admin' || lv.status === 'pending-tl'))
              )
            ) {
              return lv
            }
            pushNotification({
              recipientId: lv.userId,
              type: 'leave',
              title: 'Leave request rejected',
              message: cleanedNote || `${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
            return {
              ...lv,
              status: 'rejected' as LeaveStatus,
              decidedBy: session.person.id,
              ...(session.person.role === 'tl' ? { tlNote: cleanedNote } : { adminNote: cleanedNote }),
            }
          }
          if (
            session.person.role === 'tl' &&
            lv.tlId === session.person.id &&
            lv.status === 'pending-tl'
          ) {
            notifyRecipients(orgAdminIds, pushNotification, {
              type: 'leave',
              title: 'Leave pending Admin or HR approval',
              message: `${lv.userName}: ${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
            pushNotification({
              recipientId: lv.userId,
              type: 'leave',
              title: 'Leave approved by Team Leader',
              message: 'Waiting for Admin or HR final approval',
              relatedId: leaveId,
            })
            return {
              ...lv,
              status: 'pending-admin' as LeaveStatus,
              tlNote: cleanedNote,
              decidedBy: session.person.id,
            }
          }
          if (actorIsOrgAdmin && lv.status === 'pending-admin') {
            const lvBucket = quotaBucket(lv.kind)
            if (lvBucket) {
              const days = leaveDayCount(lv.fromDate, lv.toDate)
              const owner = people.find((p) => p.id === lv.userId)
              const remaining = owner
                ? remainingLeave(
                    owner,
                    leaveRequests.filter((row) => row.id !== lv.id),
                    lvBucket,
                    { updates, workedDays: workedDayRequests },
                  )
                : 0
              if (days > remaining) return lv
            }
            pushNotification({
              recipientId: lv.userId,
              type: 'leave',
              title: 'Leave request approved',
              message: cleanedNote || `${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
            if (lv.tlId !== lv.userId) {
              pushNotification({
                recipientId: lv.tlId,
                type: 'leave',
                title: 'Leave fully approved',
                message: `${lv.userName}: ${lv.fromDate} → ${lv.toDate}`,
                relatedId: leaveId,
              })
            }
            queueChannelPost(
              'Leave approved',
              `${lv.userName}: ${lv.fromDate} → ${lv.toDate}`,
            )
            return {
              ...lv,
              status: 'approved' as LeaveStatus,
              adminNote: cleanedNote,
              decidedBy: session.person.id,
            }
          }
          return lv
        }),
      )
    },
    [session, leaveRequests, people, updates, workedDayRequests, pushNotification, orgAdminIds, queueChannelPost],
  )

  const requestWorkedDay = useCallback(
    (reason: string) => {
      if (!session || session.person.role !== 'user') {
        return 'Only testers can request a worked-day mark'
      }
      if (!isAfterEveningWindow()) {
        return 'You can send this request only after 7:30 PM'
      }
      const today = localDateISO()
      const todayMine = updates.filter((u) => u.userId === session.person.id && u.date === today)
      const alreadyDone =
        (todayMine.some((u) => slotFromUpdate(u) === 'morning') &&
          todayMine.some((u) => slotFromUpdate(u) === 'evening')) ||
        todayMine.some((u) => u.markedWorked) ||
        workedDayRequests.some(
          (req) => req.userId === session.person.id && req.date === today && req.status === 'approved',
        )
      if (alreadyDone) return 'Today is already marked as worked'
      if (
        workedDayRequests.some(
          (req) =>
            req.userId === session.person.id &&
            req.date === today &&
            req.status === 'pending' &&
            (req.kind || 'worked-day') === 'worked-day',
        )
      ) {
        return 'A request is already waiting for approval'
      }
      const cleaned = sanitizeText(reason, 1000)
      if (!cleaned) return 'Add a short reason for the missed window'
      const item: WorkedDayRequest = {
        id: uid('wd'),
        userId: session.person.id,
        userName: session.person.name,
        date: today,
        reason: cleaned,
        kind: 'worked-day',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setWorkedDayRequests((prev) => [item, ...prev])
      people
        .filter((p) => p.role === 'admin' || p.role === 'hr' || p.role === 'tl')
        .forEach((p) => {
          pushNotification({
            recipientId: p.id,
            type: 'worked-day',
            title: 'Worked-day request',
            message: `${session.person.name} asked to mark ${today} as worked`,
            relatedId: item.id,
          })
        })
      return null
    },
    [session, updates, workedDayRequests, people, pushNotification],
  )

  const requestLateMorning: AppContextValue['requestLateMorning'] = useCallback(
    ({ reason, projectId, workPoints, hoursSpent }) => {
      if (!session || session.person.role !== 'user') {
        return 'Only testers can request a late morning update'
      }
      if (!isLateMorningGateway()) {
        return 'Late requests are only accepted from 10:30–11:00 AM'
      }
      const today = localDateISO()
      const todayMine = updates.filter((u) => u.userId === session.person.id && u.date === today)
      if (todayMine.some((u) => slotFromUpdate(u) === 'morning')) {
        return 'Morning update is already submitted'
      }
      if (
        workedDayRequests.some(
          (req) =>
            req.userId === session.person.id &&
            req.date === today &&
            req.status === 'pending' &&
            req.kind === 'late-morning',
        )
      ) {
        return 'A late request is already waiting for Admin approval'
      }
      const project = projects.find((p) => p.id === projectId)
      const allowed = project?.allocations.some((a) => a.userId === session.person.id)
      if (!project || !allowed) return 'Choose a project allocated to you'
      const points = sanitizeLines(workPoints, 20, 400)
      if (points.length === 0) return 'Add at least one work point'
      const cleaned = sanitizeText(reason, 1000)
      if (!cleaned) return 'Add a short reason for being late'
      const item: WorkedDayRequest = {
        id: uid('late'),
        userId: session.person.id,
        userName: session.person.name,
        date: today,
        reason: cleaned,
        kind: 'late-morning',
        projectId: project.id,
        workPoints: points,
        hoursSpent: clampNumber(hoursSpent, 0, 24),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setWorkedDayRequests((prev) => [item, ...prev])
      people
        .filter((p) => p.role === 'admin' || p.role === 'hr')
        .forEach((p) => {
          pushNotification({
            recipientId: p.id,
            type: 'worked-day',
            title: 'Late morning request',
            message: `${session.person.name} missed 10:00–10:30 AM and asked Admin to accept a late update`,
            relatedId: item.id,
          })
        })
      return null
    },
    [session, updates, workedDayRequests, projects, people, pushNotification],
  )

  const decideWorkedDay = useCallback(
    (requestId: string, decision: 'approve' | 'reject') => {
      const target = workedDayRequests.find((req) => req.id === requestId)
      if (!session || !target || target.status !== 'pending') return
      const isLate = target.kind === 'late-morning'
      if (isLate) {
        if (!canAct(session.person.role, ['admin', 'hr'])) return
      } else if (!canAct(session.person.role, ['admin', 'hr', 'tl'])) {
        return
      }
      setWorkedDayRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: decision === 'approve' ? 'approved' : 'rejected',
                decidedBy: session.person.id,
                decidedByName: session.person.name,
              }
            : req,
        ),
      )
      if (decision === 'approve') {
        const project =
          projects.find((p) => p.id === target.projectId) ||
          projects.find((p) => p.allocations.some((row) => row.userId === target.userId))
        const points = target.workPoints?.length
          ? target.workPoints
          : [`Day marked as worked — ${target.reason}`]
        setUpdates((prev) => [
          {
            id: uid('upd'),
            projectId: project?.id || '',
            userId: target.userId,
            userName: target.userName,
            date: target.date,
            submittedAt: new Date().toISOString(),
            workDone: isLate ? points.join('\n') : `Day marked as worked by ${session.person.name}. ${target.reason}`,
            workPoints: points,
            hoursSpent: isLate ? clampNumber(target.hoursSpent || 0, 0, 24) : 0,
            slot: isLate ? 'morning' : 'evening',
            markedWorked: !isLate,
            late: isLate,
          },
          ...prev,
        ])
      }
      if (decision === 'approve') {
        queueChannelPost(
          isLate ? 'Late morning approved' : 'Worked day approved',
          `${target.userName} · ${target.date}`,
        )
      }
      pushNotification({
        recipientId: target.userId,
        type: 'worked-day',
        title: isLate
          ? decision === 'approve'
            ? 'Late morning update accepted'
            : 'Late morning request declined'
          : decision === 'approve'
            ? 'Day marked as worked'
            : 'Worked-day request declined',
        message: isLate
          ? decision === 'approve'
            ? `${session.person.name} accepted your late morning update for ${target.date}`
            : `${session.person.name} declined the late request for ${target.date}`
          : decision === 'approve'
            ? `${session.person.name} marked ${target.date} as worked`
            : `${session.person.name} declined the request for ${target.date}`,
        relatedId: requestId,
      })
    },
    [session, workedDayRequests, projects, pushNotification, queueChannelPost],
  )

  const toggleChecklistItem = useCallback(
    (personId: string, kind: 'onboarding' | 'offboarding', itemId: string) => {
      if (!session || !canAct(session.person.role, ['hr', 'admin'])) return
      setChecklists((prev) => {
        const exists = prev.some((c) => c.personId === personId && c.kind === kind)
        const base = exists ? prev : [...prev, makeChecklist(personId, kind)]
        return base.map((c) => {
          if (c.personId !== personId || c.kind !== kind) return c
          return {
            ...c,
            items: c.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    done: !item.done,
                    doneAt: !item.done ? new Date().toISOString() : undefined,
                    doneBy: !item.done ? session.person.id : undefined,
                  }
                : item,
            ),
          }
        })
      })
    },
    [session],
  )

  const startOffboarding = useCallback(
    (personId: string, lastWorkingDate?: string) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can start offboarding'
      const person = people.find((p) => p.id === personId)
      if (!person) return 'Employee not found'
      if (person.lifecycleStatus === 'exited') return 'This employee has already exited'
      if (person.lifecycleStatus === 'offboarding') return 'Offboarding is already in progress'
      const exitOn = lastWorkingDate || addCalendarDays(todayISO(), 30)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exitOn) || exitOn < todayISO()) {
        return 'Last working date must be today or later'
      }
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? { ...p, lifecycleStatus: 'offboarding' as const, lastWorkingDate: exitOn }
            : p,
        ),
      )
      setChecklists((prev) =>
        prev.some((c) => c.personId === personId && c.kind === 'offboarding')
          ? prev
          : [...prev, makeChecklist(personId, 'offboarding')],
      )
      pushNotification({
        recipientId: personId,
        type: 'people',
        title: 'Offboarding started',
        message: `Last working day is ${exitOn}. Complete the exit checklist with HR.`,
        relatedId: personId,
      })
      return null
    },
    [session, people, pushNotification],
  )

  const completeOffboarding = useCallback(
    (personId: string) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can complete offboarding'
      const person = people.find((p) => p.id === personId)
      if (!person) return 'Employee not found'
      if (person.lifecycleStatus !== 'offboarding') return 'Start offboarding before completing exit'
      const exitDate = person.lastWorkingDate && person.lastWorkingDate < todayISO()
        ? person.lastWorkingDate
        : todayISO()
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? {
                ...p,
                lifecycleStatus: 'exited' as const,
                status: 'inactive' as const,
                exitDate,
                lastWorkingDate: p.lastWorkingDate || exitDate,
              }
            : p,
        ),
      )
      setAssets((prev) =>
        prev.map((a) =>
          a.personId === personId && a.status === 'allotted'
            ? { ...a, status: 'returned' as const, returnedAt: todayISO() }
            : a,
        ),
      )
      setChecklists((prev) =>
        prev.map((c) => {
          if (c.personId !== personId || c.kind !== 'offboarding') return c
          return {
            ...c,
            items: c.items.map((item) => {
              const autoDone =
                item.label === 'Laptop returned' ||
                item.label === 'ID card returned' ||
                item.label === 'VPN access revoked' ||
                item.label === 'Tool / project access revoked'
              if (!autoDone || item.done) return item
              return {
                ...item,
                done: true,
                doneAt: new Date().toISOString(),
                doneBy: session.person.id,
              }
            }),
          }
        }),
      )
      setAccessGrants((prev) =>
        prev.map((g) =>
          g.personId === personId && g.status === 'active'
            ? { ...g, status: 'revoked' as const, revokedAt: todayISO() }
            : g,
        ),
      )
      pushNotification({
        recipientId: personId,
        type: 'people',
        title: 'Exit clearance completed',
        message: 'Assets returned and access revoked.',
        relatedId: personId,
      })
      return null
    },
    [session, people, pushNotification],
  )

  const extendEmploymentPeriod = useCallback(
    (personId: string, input: { lastWorkingDate?: string; contractEndDate?: string }) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can extend this period'
      const person = people.find((p) => p.id === personId)
      if (!person) return 'Employee not found'
      if (person.lifecycleStatus === 'exited') return 'Cannot extend an exited employee'
      const nextLast = input.lastWorkingDate?.trim()
      const nextContract = input.contractEndDate?.trim()
      if (!nextLast && !nextContract) return 'Choose a new last working date or contract end date'
      if (nextLast) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextLast) || nextLast < todayISO()) {
          return 'Last working date must be today or later'
        }
        if (person.lifecycleStatus !== 'offboarding') {
          return 'Start offboarding before extending the last working date'
        }
        if (person.lastWorkingDate && nextLast <= person.lastWorkingDate) {
          return 'Pick a last working date after the current one'
        }
      }
      if (nextContract) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextContract) || nextContract <= todayISO()) {
          return 'Contract end date must be after today'
        }
        if (person.contractEndDate && nextContract <= person.contractEndDate) {
          return 'Pick a contract end date after the current one'
        }
      }
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? {
                ...p,
                lastWorkingDate: nextLast || p.lastWorkingDate,
                contractEndDate: nextContract || p.contractEndDate,
              }
            : p,
        ),
      )
      pushNotification({
        recipientId: personId,
        type: 'people',
        title: 'Period extended',
        message: nextLast
          ? `Last working day moved to ${nextLast}`
          : `Contract now ends ${nextContract}`,
        relatedId: personId,
      })
      return null
    },
    [session, people, pushNotification],
  )

  const confirmProbation = useCallback(
    (personId: string) => {
      if (!session || !canAct(session.person.role, ['hr', 'admin'])) {
        return 'Only HR or Admin can confirm employment'
      }
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? {
                ...p,
                lifecycleStatus: 'confirmed' as const,
                confirmationDate: todayISO(),
              }
            : p,
        ),
      )
      pushNotification({
        recipientId: personId,
        type: 'people',
        title: 'Employment confirmed',
        message: 'Probation closed. You are confirmed.',
        relatedId: personId,
      })
      return null
    },
    [session, pushNotification],
  )

  const submitSelfReview = useCallback(
    (personId: string, cycle: string, text: string) => {
      if (!session) return 'Sign in required'
      if (session.person.id !== personId && !isOrgAdmin(session.person.role)) {
        return 'You can only submit your own self-review'
      }
      const cleaned = sanitizeText(text, 2000)
      if (!cleaned) return 'Self-review notes are required'
      setReviews((prev) => {
        const found = prev.find((r) => r.personId === personId && r.cycle === cycle)
        if (!found) {
          return [
            {
              id: uid('rev'),
              personId,
              cycle: sanitizeText(cycle, 40),
              selfReview: cleaned,
              selfSubmittedAt: new Date().toISOString(),
              status: 'self-done' as const,
              managerId: people.find((p) => p.id === personId)?.managerId,
            },
            ...prev,
          ]
        }
        return prev.map((r) =>
          r.id === found.id
            ? {
                ...r,
                selfReview: cleaned,
                selfSubmittedAt: new Date().toISOString(),
                status: r.status === 'complete' ? r.status : ('self-done' as const),
              }
            : r,
        )
      })
      const managerId = people.find((p) => p.id === personId)?.managerId
      if (managerId) {
        pushNotification({
          recipientId: managerId,
          type: 'people',
          title: 'Self-review submitted',
          message: `${session.person.name} submitted ${cycle}`,
          relatedId: personId,
        })
      }
      return null
    },
    [session, people, pushNotification],
  )

  const submitManagerReview = useCallback(
    (reviewId: string, text: string, rating: number) => {
      if (!session || !canAct(session.person.role, ['tl', 'admin', 'hr'])) {
        return 'Only a manager, Admin, or HR can submit this review'
      }
      const cleaned = sanitizeText(text, 2000)
      if (!cleaned) return 'Manager review notes are required'
      const target = reviews.find((r) => r.id === reviewId)
      if (!target) return 'Review not found'
      if (
        session.person.role === 'tl' &&
        target.managerId &&
        target.managerId !== session.person.id
      ) {
        return 'You can only review your own reports'
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                managerReview: cleaned,
                managerSubmittedAt: new Date().toISOString(),
                rating: clampNumber(rating, 1, 5),
                status: 'complete' as const,
                managerId: r.managerId || session.person.id,
              }
            : r,
        ),
      )
      pushNotification({
        recipientId: target.personId,
        type: 'people',
        title: 'Manager review completed',
        message: `${target.cycle} review is complete`,
        relatedId: reviewId,
      })
      return null
    },
    [session, reviews, pushNotification],
  )

  const allotAsset = useCallback(
    (input: { personId: string; kind: AssetKind; label: string; serial?: string }) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can allot IT assets'
      const holder = people.find((p) => p.id === input.personId)
      if (!holder || holder.role === 'admin') return 'Allot assets to testers and team leaders only'
      const label = sanitizeText(input.label, 80)
      if (!label) return 'Asset label is required'
      setAssets((prev) => [
        {
          id: uid('ast'),
          personId: input.personId,
          kind: input.kind,
          label,
          serial: input.serial ? sanitizeText(input.serial, 40) : undefined,
          status: 'allotted',
          allottedAt: todayISO(),
          allottedBy: session.person.id,
        },
        ...prev,
      ])
      return null
    },
    [session, people],
  )

  const closeAsset = useCallback(
    (assetId: string, next: 'returned' | 'revoked') => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can update assets'
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) return 'Asset not found'
      if (asset.status !== 'allotted') return 'This asset is already closed'
      const closedAt = todayISO()
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, status: next, returnedAt: closedAt } : a,
        ),
      )
      const checklistLabel =
        asset.kind === 'laptop'
          ? 'Laptop returned'
          : asset.kind === 'id-card'
            ? 'ID card returned'
            : asset.kind === 'vpn'
              ? 'VPN access revoked'
              : null
      if (checklistLabel) {
        setChecklists((prev) => {
          const exists = prev.some((c) => c.personId === asset.personId && c.kind === 'offboarding')
          const base = exists ? prev : [...prev, makeChecklist(asset.personId, 'offboarding')]
          return base.map((c) => {
            if (c.personId !== asset.personId || c.kind !== 'offboarding') return c
            return {
              ...c,
              items: c.items.map((item) =>
                item.label === checklistLabel
                  ? {
                      ...item,
                      done: true,
                      doneAt: new Date().toISOString(),
                      doneBy: session.person.id,
                    }
                  : item,
              ),
            }
          })
        })
      }
      pushNotification({
        recipientId: asset.personId,
        type: 'people',
        title: next === 'returned' ? 'Asset returned' : 'Asset revoked',
        message: `${asset.label} marked ${next}`,
        relatedId: assetId,
      })
      return null
    },
    [session, assets, pushNotification],
  )

  const grantToolAccess = useCallback(
    (personId: string, name: string) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can grant tool access'
      const tool = sanitizeText(name, 40)
      if (!tool) return 'Tool name is required'
      setAccessGrants((prev) => [
        {
          id: uid('acc'),
          personId,
          scope: 'tool',
          name: tool,
          status: 'active',
          grantedAt: todayISO(),
        },
        ...prev,
      ])
      return null
    },
    [session],
  )

  const revokeAccessGrant = useCallback(
    (grantId: string) => {
      if (!session || !canAct(session.person.role, ['hr'])) return
      setAccessGrants((prev) =>
        prev.map((g) =>
          g.id === grantId ? { ...g, status: 'revoked' as const, revokedAt: todayISO() } : g,
        ),
      )
    },
    [session],
  )

  const uploadPayslip = useCallback(
    (input: { personId: string; month: string; fileName: string; dataUrl: string }) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can upload payslips'
      const holder = people.find((p) => p.id === input.personId)
      if (!holder || holder.role === 'admin') return 'Payslips are for testers and team leaders only'
      if (!/^\d{4}-\d{2}$/.test(input.month)) return 'Use YYYY-MM for the payslip month'
      if (!isSafeAttachmentName(input.fileName) || !input.fileName.toLowerCase().endsWith('.pdf')) {
        return 'Upload a PDF file'
      }
      const dataUrl = sanitizePdfDataUrl(input.dataUrl)
      if (!dataUrl) return 'PDF must be a valid file under 2 MB'
      setPayslips((prev) => [
        {
          id: uid('pay'),
          personId: input.personId,
          month: input.month,
          fileName: sanitizeText(input.fileName, 120),
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: session.person.id,
        },
        ...prev,
      ])
      pushNotification({
        recipientId: input.personId,
        type: 'people',
        title: 'Payslip available',
        message: `HR uploaded ${input.month} payslip`,
        relatedId: input.personId,
      })
      return null
    },
    [session, people, pushNotification],
  )

  const raiseHrTicket = useCallback(
    (subject: string, message: string) => {
      if (!session || (session.person.role !== 'user' && session.person.role !== 'tl')) {
        return 'Only employees can raise HR tickets'
      }
      const sub = sanitizeText(subject, 120)
      const body = sanitizeText(message, 2000)
      if (!sub || !body) return 'Subject and message are required'
      const ticket: HrTicket = {
        id: uid('hrt'),
        fromUserId: session.person.id,
        fromUserName: session.person.name,
        subject: sub,
        message: body,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      setHrTickets((prev) => [ticket, ...prev])
      people
        .filter((p) => p.role === 'hr')
        .forEach((p) => {
          pushNotification({
            recipientId: p.id,
            type: 'hr-ticket',
            title: `HR ticket from ${session.person.name}`,
            message: sub,
            relatedId: ticket.id,
          })
        })
      return null
    },
    [session, people, pushNotification],
  )

  const replyHrTicket = useCallback(
    (ticketId: string, reply: string) => {
      if (!session || !canAct(session.person.role, ['hr'])) return 'Only HR can reply to these tickets'
      const cleaned = sanitizeText(reply, 2000)
      if (!cleaned) return 'Reply is required'
      const target = hrTickets.find((t) => t.id === ticketId)
      setHrTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: 'answered' as const,
                reply: cleaned,
                repliedBy: session.person.id,
                repliedAt: new Date().toISOString(),
              }
            : t,
        ),
      )
      if (target) {
        pushNotification({
          recipientId: target.fromUserId,
          type: 'hr-ticket',
          title: 'HR replied to your ticket',
          message: target.subject,
          relatedId: ticketId,
        })
      }
      return null
    },
    [session, hrTickets, pushNotification],
  )

  const requestRegularization = useCallback(
    (date: string, reason: string) => {
      if (!session || (session.person.role !== 'user' && session.person.role !== 'tl')) {
        return 'Only employees can request regularization'
      }
      const cleaned = sanitizeText(reason, 1000)
      if (!date || !cleaned) return 'Date and reason are required'
      if (
        regularizations.some(
          (r) => r.userId === session.person.id && r.date === date && r.status !== 'rejected',
        )
      ) {
        return 'A regularization request already exists for that date'
      }
      const item: RegularizationRequest = {
        id: uid('reg'),
        userId: session.person.id,
        userName: session.person.name,
        date: sanitizeText(date, 12),
        reason: cleaned,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setRegularizations((prev) => [item, ...prev])
      notifyRecipients(orgAdminIds, pushNotification, {
        type: 'worked-day',
        title: 'Attendance regularization',
        message: `${session.person.name} · ${date}`,
        relatedId: item.id,
      })
      return null
    },
    [session, regularizations, orgAdminIds, pushNotification],
  )

  const decideRegularization = useCallback(
    (requestId: string, decision: 'approve' | 'reject') => {
      if (!session || !canAct(session.person.role, ['admin', 'hr'])) return
      const target = regularizations.find((r) => r.id === requestId)
      if (!target || target.status !== 'pending') return
      setRegularizations((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: decision === 'approve' ? 'approved' : 'rejected',
                decidedBy: session.person.id,
                decidedByName: session.person.name,
              }
            : r,
        ),
      )
      if (decision === 'approve') {
        setUpdates((prev) => [
          {
            id: uid('upd'),
            projectId: projects.find((p) => p.allocations.some((a) => a.userId === target.userId))?.id || '',
            userId: target.userId,
            userName: target.userName,
            date: target.date,
            submittedAt: new Date().toISOString(),
            workDone: `Attendance regularized by ${session.person.name}. ${target.reason}`,
            workPoints: [`Attendance regularized — ${target.reason}`],
            hoursSpent: 0,
            slot: 'evening',
            markedWorked: true,
          },
          ...prev,
        ])
        queueChannelPost('Regularization approved', `${target.userName} · ${target.date}`)
      }
      pushNotification({
        recipientId: target.userId,
        type: 'worked-day',
        title:
          decision === 'approve' ? 'Attendance regularized' : 'Regularization declined',
        message: `${session.person.name} · ${target.date}`,
        relatedId: requestId,
      })
    },
    [session, regularizations, projects, pushNotification, queueChannelPost],
  )

  const setPersonShift = useCallback(
    (personId: string, shiftId: string) => {
      if (!session || !canAct(session.person.role, ['hr', 'admin'])) return
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, shiftId } : p)))
    },
    [session],
  )

  const upsertRoster = useCallback(
    (personId: string, date: string, shiftId: string) => {
      if (!session || !canAct(session.person.role, ['hr', 'admin'])) return
      setRoster((prev) => {
        const found = prev.find((r) => r.personId === personId && r.date === date)
        if (found) return prev.map((r) => (r.id === found.id ? { ...r, shiftId } : r))
        return [{ id: uid('ros'), personId, date, shiftId }, ...prev]
      })
    },
    [session],
  )

  const saveIntegrations = useCallback(
    (input: ChannelIntegrations) => {
      if (!session || !isOrgAdmin(session.person.role)) return 'Only Admin or HR can save integrations'
      setIntegrations({
        slackEnabled: Boolean(input.slackEnabled),
        slackWebhook: httpsWebhook(input.slackWebhook),
        teamsEnabled: Boolean(input.teamsEnabled),
        teamsWebhook: httpsWebhook(input.teamsWebhook),
      })
      return null
    },
    [session],
  )

  const updateHrProfile = useCallback(
    (
      personId: string,
      input: {
        managerId?: string
        skills?: string[]
        department?: string
        location?: string
        jobTitle?: string
        contractEndDate?: string
        nextAppraisalDate?: string
        documentExpiryDate?: string
        probationEndDate?: string
      },
    ) => {
      if (!session || !isOrgAdmin(session.person.role)) return 'Only Admin or HR can update this profile'
      setPeople((prev) =>
        prev.map((p) =>
          p.id === personId
            ? {
                ...p,
                managerId: input.managerId || undefined,
                skills: input.skills?.map((s) => sanitizeText(s, 40)).filter(Boolean).slice(0, 8) ?? p.skills,
                department: input.department ? sanitizeText(input.department, 80) : p.department,
                location: input.location ? sanitizeText(input.location, 80) : p.location,
                jobTitle: input.jobTitle ? sanitizeText(input.jobTitle, 80) : p.jobTitle,
                contractEndDate: input.contractEndDate || p.contractEndDate,
                nextAppraisalDate: input.nextAppraisalDate || p.nextAppraisalDate,
                documentExpiryDate: input.documentExpiryDate || p.documentExpiryDate,
                probationEndDate: input.probationEndDate || p.probationEndDate,
              }
            : p,
        ),
      )
      return null
    },
    [session],
  )

  const leaveStats = useMemo(() => {
    const approved = leaveRequests.filter((l) => l.status === 'approved').length
    const pending = leaveRequests.filter(
      (l) => l.status === 'pending-tl' || l.status === 'pending-admin',
    ).length
    const thisMonth = leaveRequests.filter((l) => {
      const d = new Date(l.createdAt)
      return d.getFullYear() === 2026 && d.getMonth() === 7
    }).length
    return { approved, pending, thisMonth }
  }, [leaveRequests])

  const value: AppContextValue = {
    session,
    login,
    loginWithEmail,
    logout,
    companyDomain: COMPANY_DOMAIN,
    registerEmployee,
    syncError,
    people,
    projects,
    updates,
    queries,
    blockers,
    discussions,
    notifications,
    myNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    trackerWindowHours: TRACKER_WINDOW_HOURS,
    hoursSinceLogin,
    hasSubmittedToday,
    todayMarkedWorked,
    trackerDueSoon,
    trackerOverdue,
    morningUpdateToday,
    eveningUpdateToday,
    currentUpdateSlot: currentSlot,
    lateMorningGatewayOpen,
    myProjects,
    activeProjects,
    openBlockers,
    employment: employmentMetrics,
    kpis: vaptKpis,
    kras: vaptKras,
    teamPerformance: teamPerformanceSeries,
    addDailyUpdate,
    addQuery,
    replyQuery,
    sendQueryMessage,
    toggleQueryStar,
    addBlocker,
    updateBlockerStatus,
    addDiscussion,
    setProjectStatus,
    requestProjectStatusChange,
    decideProjectStatusRequest,
    projectStatusRequests,
    renamePerson,
    updateEmployeeCode,
    updateOwnProfile,
    changePassword,
    createProject,
    updateProjectAssignment,
    applyRequirementChange,
    updateRequirementStatus,
    approveRequirementChange,
    rejectRequirementChange,
    requirementRequests,
    leaveRequests,
    submitLeaveRequest,
    decideLeaveRequest,
    leaveStats,
    workedDayRequests,
    requestWorkedDay,
    requestLateMorning,
    decideWorkedDay,
    checklists,
    reviews,
    assets,
    accessGrants,
    payslips,
    hrTickets,
    regularizations,
    roster,
    integrations,
    channelPosts,
    historicalExits: exitHistory,
    remoteReady,
    toggleChecklistItem,
    startOffboarding,
    completeOffboarding,
    extendEmploymentPeriod,
    confirmProbation,
    submitSelfReview,
    submitManagerReview,
    allotAsset,
    closeAsset,
    grantToolAccess,
    revokeAccessGrant,
    uploadPayslip,
    raiseHrTicket,
    replyHrTicket,
    requestRegularization,
    decideRegularization,
    setPersonShift,
    upsertRoster,
    saveIntegrations,
    updateHrProfile,
    directoryFocusId,
    openDirectoryPerson,
    clearDirectoryFocus,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function roleLabel(role: Role) {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'hr':
      return 'HR'
    case 'tl':
      return 'Team Leader'
    case 'user':
      return 'Tester'
  }
}

/** Frontend label: admin title if set, otherwise the person's name. Never show raw IDs. */
export function personLabel(person?: { name: string; jobTitle?: string } | null) {
  if (!person) return 'Team member'
  return person.jobTitle ? `${person.name} (${person.jobTitle})` : person.name
}

export function publicRoleLabel(
  person: { role: Role; jobTitle?: string; employeeCode?: string },
  viewerRole?: Role,
) {
  if (person.role === 'user') {
    if (viewerRole === 'user') return person.jobTitle || ''
    return 'Tester'
  }
  return roleLabel(person.role)
}
