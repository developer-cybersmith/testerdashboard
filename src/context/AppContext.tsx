import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type {
  AppNotification,
  AppUserSession,
  Blocker,
  BlockerSeverity,
  ChatMessage,
  ClientDiscussion,
  DailyUpdate,
  LeaveRequest,
  LeaveStatus,
  Person,
  Project,
  ProjectStatus,
  ProjectStatusAction,
  ProjectStatusRequest,
  QueryAttachment,
  QueryItem,
  RequirementAction,
  RequirementChangeRequest,
  Role,
  ScopeCredit,
  ScopeItem,
  SharePointLink,
  VpnAccess,
} from '../types'
import { canAct } from '../security/authorize'
import { clampNumber, isSafeAttachmentName, sanitizeDataUrl, sanitizeImageDataUrl, sanitizeLines, sanitizeText, sanitizeUrl } from '../security/wstg'

export const COMPANY_DOMAIN = 'cybersmith.secure.com'
export const DEMO_PASSWORD = 'Secure@2026'

const TRACKER_WINDOW_HOURS = 7
export const PAID_LEAVE_MAX = 12
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

function slotFromUpdate(update: DailyUpdate): UpdateSlot {
  if (update.slot) return update.slot
  const submitted = new Date(update.submittedAt)
  const mins = submitted.getHours() * 60 + submitted.getMinutes()
  return mins < 15 * 60 ? 'morning' : 'evening'
}

function paidLeaveDaysCommitted(requests: LeaveRequest[], userId: string) {
  return requests
    .filter(
      (lv) =>
        lv.userId === userId &&
        (lv.kind || 'other') === 'paid' &&
        (lv.status === 'approved' || lv.status === 'pending-tl' || lv.status === 'pending-admin'),
    )
    .reduce((sum, lv) => sum + leaveDayCount(lv.fromDate, lv.toDate), 0)
}

interface AppContextValue {
  session: AppUserSession | null
  login: (personId: string) => void
  loginWithEmail: (email: string, password: string) => string | null
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
    address?: string
  }) => string | null
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
  }) => void
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
  updateOwnProfile: (input: {
    avatarDataUrl?: string
    phone?: string
    address?: string
    gender?: string
    dateOfBirth?: string
  }) => string | null
  createProject: (input: {
    name: string
    client: string
    tlId: string
    allocateUserIds: string[]
    remarks: string
    requirements?: string[]
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
  }) => void
  /** Admin can apply immediately; TL creates approval request */
  applyRequirementChange: (input: {
    projectId: string
    action: RequirementAction
    index?: number
    newValue?: string
  }) => void
  approveRequirementChange: (requestId: string) => void
  rejectRequirementChange: (requestId: string) => void
  requirementRequests: RequirementChangeRequest[]
  leaveRequests: LeaveRequest[]
  submitLeaveRequest: (input: {
    fromDate: string
    toDate: string
    reason: string
    kind: 'paid' | 'other'
  }) => string | null
  decideLeaveRequest: (
    leaveId: string,
    decision: 'approve' | 'reject',
    note: string,
  ) => void
  leaveStats: { approved: number; pending: number; thisMonth: number }
}

const AppContext = createContext<AppContextValue | null>(null)

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
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
  const digits = cleaned.replace(/^EMP-?/, '').replace(/\D/g, '')
  if (!digits) return ''
  return `EMP-${digits.padStart(3, '0')}`
}

export function nextEmployeeCode(people: { employeeCode?: string }[]) {
  const nums = people.map((p) => {
    const match = (p.employeeCode || '').match(/EMP-(\d+)/i)
    return match ? Number(match[1]) : 0
  })
  const next = Math.max(0, ...nums) + 1
  return `EMP-${String(next).padStart(3, '0')}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppUserSession | null>(null)
  const [people, setPeople] = useState<Person[]>(initialPeople)
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
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(t)
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

  const login = useCallback((personId: string) => {
    const person = people.find((p) => p.id === personId)
    if (!person) return
    setSession({ person, loginAt: new Date().toISOString() })
  }, [people])

  const loginWithEmail = useCallback((email: string, password: string) => {
    const raw = email.trim().toLowerCase()
    if (raw.includes('@') && !raw.endsWith(`@${COMPANY_DOMAIN}`)) {
      return `Use a company email ending with @${COMPANY_DOMAIN}`
    }
    const cleanEmail = normalizeCompanyEmail(email)
    const cleanPass = password.trim()
    if (!cleanEmail) {
      return `Use a company email ending with @${COMPANY_DOMAIN}`
    }
    const person = people.find((p) => p.email.toLowerCase() === cleanEmail)
    if (!person || (person.password || DEMO_PASSWORD) !== cleanPass) {
      return 'Invalid email or password'
    }
    setSession({ person, loginAt: new Date().toISOString() })
    return null
  }, [people])

  const registerEmployee: AppContextValue['registerEmployee'] = useCallback(
    (input) => {
      if (!session || !canAct(session.person.role, ['admin'])) {
        return 'Only Admin can register employees'
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
      if (!name || password.length < 8) {
        return 'Name and a password of at least 8 characters are required'
      }
      const employeeCode = normalizeEmployeeCode(input.employeeCode || nextEmployeeCode(people))
      if (!employeeCode) return 'Employee ID is required (e.g. EMP-001)'
      if (people.some((p) => (p.employeeCode || '').toUpperCase() === employeeCode)) {
        return 'That employee ID is already in use'
      }
      const role = input.role === 'admin' ? 'user' : input.role
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
        address: input.address ? sanitizeText(input.address, 200) : undefined,
        department: input.department ? sanitizeText(input.department, 80) : 'VAPT',
        leaveBalance: {
          allUsed: 0,
          allMax: PAID_LEAVE_MAX,
          annualUsed: 0,
          annualMax: PAID_LEAVE_MAX,
          casualUsed: 0,
          casualMax: 0,
          sickUsed: 0,
          sickMax: PAID_LEAVE_MAX,
        },
        performanceScore: 80,
        documents: [
          { name: 'Contract Agreement.pdf', kind: 'pdf' },
          { name: 'Curriculum Vitae.pdf', kind: 'pdf' },
        ],
        notes: [],
      }
      setPeople((prev) => [...prev, person])
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
      fresh.address !== session.person.address ||
      fresh.gender !== session.person.gender ||
      fresh.dateOfBirth !== session.person.dateOfBirth ||
      fresh.avatarUploaded !== session.person.avatarUploaded
    ) {
      setSession((s) => (s ? { ...s, person: fresh } : s))
    }
  }, [people, session])

  const logout = useCallback(() => setSession(null), [])

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
  const hasSubmittedToday = morningUpdateToday && eveningUpdateToday

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
      session.person.role === 'admin'
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
        session.person.role === 'admin' || n.recipientId === session.person.id
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
        'admin-1',
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
    [session, projects, updates, pushNotification],
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
      setQueries((prev) =>
        prev.map((q) => {
          if (q.id !== queryId) return q
          const msg: ChatMessage = {
            id: uid('qm'),
            senderId: session.person.id,
            senderName: session.person.name,
            body: reply,
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
            reply,
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
      if (!session) return
      const project = projects.find((p) => p.id === projectId)
      if (!project) return
      const item: Blocker = {
        id: uid('blk'),
        projectId,
        projectName: project.name,
        raisedById: session.person.id,
        raisedByName: session.person.name,
        title,
        description,
        severity,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      setBlockers((prev) => [item, ...prev])
      const recipients = new Set([project.tlId, 'admin-1'])
      recipients.forEach((recipientId) => {
        if (recipientId === session.person.id) return
        pushNotification({
          recipientId,
          type: severity === 'critical' ? 'critical-vuln' : 'blocker',
          title: `${severity.toUpperCase()} blocker on ${project.name}`,
          message: title,
          relatedId: item.id,
        })
      })
    },
    [session, projects, pushNotification],
  )

  const updateBlockerStatus = useCallback(
    (blockerId: string, status: Blocker['status']) => {
      setBlockers((prev) => {
        const target = prev.find((b) => b.id === blockerId)
        if (target && status === 'resolved' && session) {
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
    setDiscussions((prev) => [{ ...input, id: uid('cd') }, ...prev])
  }, [])

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
      if (!session || !canAct(session.person.role, ['admin'])) return
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
        ...people.filter((p) => p.role === 'admin').map((p) => p.id),
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
        .filter((p) => p.role === 'admin')
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
      if (!session || !canAct(session.person.role, ['admin'])) return
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
    if (!session || !canAct(session.person.role, ['admin'])) return
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
      if (!session || !canAct(session.person.role, ['admin'])) {
        return 'Only Admin can change employee IDs'
      }
      const code = normalizeEmployeeCode(employeeCode)
      if (!code) return 'Use a code like EMP-001'
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
    (input: {
      avatarDataUrl?: string
      phone?: string
      address?: string
      gender?: string
      dateOfBirth?: string
    }) => {
      if (!session || session.person.role !== 'user') {
        return 'Only testers can update this profile'
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
      const phone = input.phone !== undefined ? sanitizeText(input.phone, 30) : current.phone
      const address = input.address !== undefined ? sanitizeText(input.address, 200) : current.address
      const gender = input.gender !== undefined ? sanitizeText(input.gender, 20) : current.gender
      const dateOfBirth = input.dateOfBirth !== undefined ? input.dateOfBirth : current.dateOfBirth
      setPeople((prev) =>
        prev.map((p) =>
          p.id === current.id
            ? { ...p, avatar, avatarUploaded, phone, address, gender, dateOfBirth }
            : p,
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
      requirements,
      sharepoint,
      scope,
      vpn,
      scopeCredits,
    }) => {
      if (!session || !canAct(session.person.role, ['admin', 'tl'])) return
      const resolvedTlId =
        session.person.role === 'tl' ? session.person.id : tlId
      const memberIds = Array.from(new Set([...allocateUserIds, resolvedTlId]))
      const allocatedPeople = people.filter((p) => memberIds.includes(p.id))
      const tl = people.find((p) => p.id === resolvedTlId)
      if (!tl) return
      promoteToTl(resolvedTlId)

      const project: Project = {
        id: uid('proj'),
        name: sanitizeText(name, 120),
        client: sanitizeText(client, 120),
        status: 'active',
        progress: 0,
        startDate: todayISO(),
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
        requirements: requirements?.length
          ? requirements
          : ['Daily tracker updates', 'Log blockers immediately'],
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

      let proposed = [...project.requirements]
      let oldValue: string | undefined
      if (action === 'add' && newValue?.trim()) {
        proposed = [...proposed, newValue.trim()]
      } else if (action === 'edit' && index !== undefined && newValue?.trim()) {
        oldValue = proposed[index]
        proposed[index] = newValue.trim()
      } else if (action === 'delete' && index !== undefined) {
        oldValue = proposed[index]
        proposed = proposed.filter((_, i) => i !== index)
      } else {
        return
      }

      // Admin applies immediately
      if (session.person.role === 'admin') {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, requirements: proposed } : p)),
        )
        return
      }

      // TL needs admin approval
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
      pushNotification({
        recipientId: 'admin-1',
        type: 'requirement',
        title: `Requirement ${action} approval needed`,
        message: `${session.person.name} on ${project.name}`,
        relatedId: req.id,
      })
    },
    [session, projects, pushNotification],
  )

  const approveRequirementChange = useCallback(
    (requestId: string) => {
      setRequirementRequests((prev) => {
        const target = prev.find((r) => r.id === requestId)
        if (target && target.status === 'pending') {
          setProjects((ps) =>
            ps.map((p) =>
              p.id === target.projectId
                ? { ...p, requirements: target.proposedRequirements }
                : p,
            ),
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
      if (!session || session.person.role !== 'user') return 'Only testers can request leave'
      const days = leaveDayCount(fromDate, toDate)
      if (!days) return 'Choose a valid date range'
      const cleanedReason = sanitizeText(reason, 1000)
      if (!cleanedReason) return 'Reason is required'
      const leaveKind = kind === 'paid' ? 'paid' : 'other'
      if (leaveKind === 'paid') {
        const remaining = PAID_LEAVE_MAX - paidLeaveDaysCommitted(leaveRequests, session.person.id)
        if (days > remaining) {
          return remaining <= 0
            ? 'All 12 paid leave days are used or already requested'
            : `Only ${remaining} paid leave day${remaining === 1 ? '' : 's'} remaining`
        }
      }
      const myProj = projects.find((p) =>
        p.allocations.some((a) => a.userId === session.person.id),
      )
      const tlId = myProj?.tlId || 'tl-1'
      const leave: LeaveRequest = {
        id: uid('lv'),
        userId: session.person.id,
        userName: session.person.name,
        userAvatar: session.person.avatar,
        fromDate: sanitizeText(fromDate, 12),
        toDate: sanitizeText(toDate, 12),
        reason: cleanedReason,
        kind: leaveKind,
        status: 'pending-tl',
        tlId,
        createdAt: new Date().toISOString(),
      }
      setLeaveRequests((prev) => [leave, ...prev])
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
      return null
    },
    [session, projects, leaveRequests, pushNotification],
  )

  const decideLeaveRequest = useCallback(
    (leaveId: string, decision: 'approve' | 'reject', note: string) => {
      if (!session) return
      const cleanedNote = sanitizeText(note, 1000)
      if (decision === 'approve' && !cleanedNote) return
      const target = leaveRequests.find((lv) => lv.id === leaveId)
      if (
        decision === 'approve' &&
        session.person.role === 'admin' &&
        target?.status === 'pending-admin' &&
        (target.kind || 'other') === 'paid'
      ) {
        const days = leaveDayCount(target.fromDate, target.toDate)
        const used = paidLeaveDaysCommitted(
          leaveRequests.filter((row) => row.id !== leaveId),
          target.userId,
        )
        if (used + days > PAID_LEAVE_MAX) return
        setPeople((prev) =>
          prev.map((p) => {
            if (p.id !== target.userId) return p
            const nextUsed = Math.min(PAID_LEAVE_MAX, (p.leaveBalance?.annualUsed || 0) + days)
            return {
              ...p,
              leaveBalance: {
                allUsed: nextUsed,
                allMax: PAID_LEAVE_MAX,
                annualUsed: nextUsed,
                annualMax: PAID_LEAVE_MAX,
                casualUsed: p.leaveBalance?.casualUsed || 0,
                casualMax: 0,
                sickUsed: p.leaveBalance?.sickUsed || 0,
                sickMax: PAID_LEAVE_MAX,
              },
            }
          }),
        )
      }
      setLeaveRequests((prev) =>
        prev.map((lv) => {
          if (lv.id !== leaveId) return lv
          if (decision === 'reject') {
            if (
              !(
                (session.person.role === 'tl' &&
                  lv.tlId === session.person.id &&
                  lv.status === 'pending-tl') ||
                (session.person.role === 'admin' &&
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
            pushNotification({
              recipientId: 'admin-1',
              type: 'leave',
              title: 'Leave pending Admin approval',
              message: `${lv.userName}: ${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
            pushNotification({
              recipientId: lv.userId,
              type: 'leave',
              title: 'Leave approved by Team Leader',
              message: 'Waiting for Admin final approval',
              relatedId: leaveId,
            })
            return {
              ...lv,
              status: 'pending-admin' as LeaveStatus,
              tlNote: cleanedNote,
              decidedBy: session.person.id,
            }
          }
          if (session.person.role === 'admin' && lv.status === 'pending-admin') {
            if ((lv.kind || 'other') === 'paid') {
              const days = leaveDayCount(lv.fromDate, lv.toDate)
              const used = paidLeaveDaysCommitted(
                leaveRequests.filter((row) => row.id !== lv.id),
                lv.userId,
              )
              if (used + days > PAID_LEAVE_MAX) return lv
            }
            pushNotification({
              recipientId: lv.userId,
              type: 'leave',
              title: 'Leave request approved',
              message: cleanedNote || `${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
            pushNotification({
              recipientId: lv.tlId,
              type: 'leave',
              title: 'Leave fully approved by Admin',
              message: `${lv.userName}: ${lv.fromDate} → ${lv.toDate}`,
              relatedId: leaveId,
            })
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
    [session, leaveRequests, pushNotification],
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
    trackerDueSoon,
    trackerOverdue,
    morningUpdateToday,
    eveningUpdateToday,
    currentUpdateSlot: currentSlot,
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
    createProject,
    updateProjectAssignment,
    applyRequirementChange,
    approveRequirementChange,
    rejectRequirementChange,
    requirementRequests,
    leaveRequests,
    submitLeaveRequest,
    decideLeaveRequest,
    leaveStats,
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
