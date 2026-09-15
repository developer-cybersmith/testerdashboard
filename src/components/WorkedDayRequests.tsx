import { useState, type FormEvent } from 'react'
import { isAfterEveningWindow, isLateMorningGateway, isOrgAdmin, useApp } from '../context/AppContext'
import { sanitizeLines, sanitizeText } from '../security/wstg'
import { Badge, Card, Field, PrimaryButton, SecondaryButton, SectionTitle, inputClass } from './ui'

export function LateMorningRequestForm() {
  const {
    session,
    activeProjects,
    requestLateMorning,
    workedDayRequests,
    morningUpdateToday,
    lateMorningGatewayOpen,
  } = useApp()
  const [reason, setReason] = useState('')
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || '')
  const [points, setPoints] = useState(['', ''])
  const [hoursSpent, setHoursSpent] = useState('3')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const pending = workedDayRequests.find(
    (req) =>
      req.userId === session?.person.id &&
      req.kind === 'late-morning' &&
      req.date === today &&
      req.status === 'pending',
  )

  if (session?.person.role !== 'user') return null
  if (morningUpdateToday) return null
  if (!lateMorningGatewayOpen && !pending && !isLateMorningGateway()) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(null)
    const result = requestLateMorning({
      reason: sanitizeText(reason, 1000),
      projectId,
      workPoints: sanitizeLines(points, 20, 400),
      hoursSpent: Number(hoursSpent) || 0,
    })
    if (result) {
      setError(result)
      return
    }
    setOk('Late request sent to Admin / HR.')
    setReason('')
    setPoints(['', ''])
  }

  return (
    <Card>
      <SectionTitle title="Late morning request (10:30–11:00 AM)" />
      <p className="mb-3 text-[13px] text-cs-muted">
        The 10:00–10:30 AM window is closed. Until 11:00 AM you can ask Admin or HR to accept this
        morning update as late.
      </p>
      {pending ? (
        <p className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a3412]">
          Waiting for Admin / HR: {pending.reason}
        </p>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Project">
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Why are you late?">
            <textarea
              className={inputClass}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </Field>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-cs-muted">Morning work points</p>
            <div className="space-y-2">
              {points.map((point, index) => (
                <input
                  key={index}
                  className={inputClass}
                  value={point}
                  onChange={(e) => {
                    const next = [...points]
                    next[index] = e.target.value
                    setPoints(next)
                  }}
                  placeholder={`Point ${index + 1}`}
                />
              ))}
            </div>
          </div>
          <Field label="Hours spent">
            <input
              className={inputClass}
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={hoursSpent}
              onChange={(e) => setHoursSpent(e.target.value)}
            />
          </Field>
          {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}
          {ok && <p className="text-[12px] font-semibold text-cs-forest">{ok}</p>}
          <PrimaryButton type="submit">Request Admin to accept late update</PrimaryButton>
        </form>
      )}
    </Card>
  )
}

export function WorkedDayRequestForm() {
  const { hasSubmittedToday, requestWorkedDay, workedDayRequests, session } = useApp()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const afterWindow = isAfterEveningWindow()
  const mine = workedDayRequests.filter((req) => req.userId === session?.person.id)
  const pendingToday = mine.find((req) => req.status === 'pending')

  if (hasSubmittedToday) return null
  if (!afterWindow && !pendingToday) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(null)
    const result = requestWorkedDay(reason)
    if (result) {
      setError(result)
      return
    }
    setOk('Request sent to Admin, HR, and Team Leaders.')
    setReason('')
  }

  return (
    <Card>
      <SectionTitle title="Mark today as worked" />
      <p className="mb-3 text-[13px] text-cs-muted">
        The 7:00–7:30 PM window is closed. Send a request so Admin, HR, or a Team Leader can mark
        today as worked.
      </p>
      {pendingToday ? (
        <p className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a3412]">
          Request waiting for approval: {pendingToday.reason}
        </p>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Reason">
            <textarea
              className={inputClass}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why the evening update was missed"
              required
            />
          </Field>
          {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}
          {ok && <p className="text-[12px] font-semibold text-cs-forest">{ok}</p>}
          <PrimaryButton type="submit">Send request</PrimaryButton>
        </form>
      )}
      {mine.length > 0 && (
        <ul className="mt-4 space-y-2">
          {mine.slice(0, 5).map((req) => (
            <li key={req.id} className="rounded-xl border border-cs-line px-3 py-2 text-[12px]">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-cs-ink">{req.date}</span>
                <Badge
                  tone={
                    req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : 'yellow'
                  }
                >
                  {req.status}
                </Badge>
              </div>
              <p className="text-cs-muted">{req.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function WorkedDayApprovals() {
  const { session, workedDayRequests, decideWorkedDay } = useApp()
  if (!session || (!isOrgAdmin(session.person.role) && session.person.role !== 'tl')) return null

  const canReviewLate = isOrgAdmin(session.person.role)
  const pendingLate = canReviewLate
    ? workedDayRequests.filter((req) => req.status === 'pending' && req.kind === 'late-morning')
    : []
  const pendingWorked = workedDayRequests.filter(
    (req) => req.status === 'pending' && (req.kind || 'worked-day') === 'worked-day',
  )
  const recent = workedDayRequests.filter((req) => req.status !== 'pending').slice(0, 6)

  if (pendingLate.length === 0 && pendingWorked.length === 0 && recent.length === 0) return null

  return (
    <div className="space-y-4">
      {pendingLate.length > 0 && (
        <Card>
          <SectionTitle title="Late morning requests" />
          <ul className="space-y-3">
            {pendingLate.map((req) => (
              <li key={req.id} className="rounded-xl border border-cs-line px-3 py-3">
                <p className="text-[13px] font-semibold text-cs-ink">
                  {req.userName} · {req.date}
                </p>
                <p className="mt-1 text-[13px] text-cs-muted">{req.reason}</p>
                {req.workPoints && req.workPoints.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-[12px] text-cs-ink">
                    {req.workPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => decideWorkedDay(req.id, 'approve')}>
                    Accept late morning
                  </PrimaryButton>
                  <SecondaryButton onClick={() => decideWorkedDay(req.id, 'reject')}>
                    Decline
                  </SecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(pendingWorked.length > 0 || recent.length > 0) && (
        <Card>
          <SectionTitle title="Worked-day requests" />
          {pendingWorked.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No pending worked-day requests.</p>
          ) : (
            <ul className="space-y-3">
              {pendingWorked.map((req) => (
                <li key={req.id} className="rounded-xl border border-cs-line px-3 py-3">
                  <p className="text-[13px] font-semibold text-cs-ink">
                    {req.userName} · {req.date}
                  </p>
                  <p className="mt-1 text-[13px] text-cs-muted">{req.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => decideWorkedDay(req.id, 'approve')}>
                      Mark as worked
                    </PrimaryButton>
                    <SecondaryButton onClick={() => decideWorkedDay(req.id, 'reject')}>
                      Decline
                    </SecondaryButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {recent.length > 0 && (
            <ul className="mt-4 space-y-2">
              {recent.map((req) => (
                <li key={req.id} className="flex flex-wrap items-center gap-2 text-[12px] text-cs-muted">
                  <Badge tone={req.status === 'approved' ? 'green' : 'red'}>{req.status}</Badge>
                  <span>
                    {req.kind === 'late-morning' ? 'Late · ' : ''}
                    {req.userName} · {req.date}
                    {req.decidedByName ? ` · ${req.decidedByName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
