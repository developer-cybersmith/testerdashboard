import { useState, type FormEvent } from 'react'
import { PAID_LEAVE_MAX, isOrgAdmin, useApp } from '../context/AppContext'
import { sanitizeText } from '../security/wstg'
import type { LeaveRequest } from '../types'
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  inputClass,
} from './ui'

function statusTone(s: string) {
  if (s === 'approved') return 'green' as const
  if (s === 'rejected') return 'red' as const
  if (s === 'pending-admin') return 'blue' as const
  return 'yellow' as const
}

function LeaveForm({
  otherLabel,
  helper,
}: {
  otherLabel: string
  helper: string
}) {
  const { submitLeaveRequest } = useApp()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<'paid' | 'other'>('paid')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!fromDate || !toDate || !reason.trim()) return
    const error = submitLeaveRequest({
      fromDate,
      toDate,
      reason: sanitizeText(reason, 1000),
      kind,
    })
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setFromDate('')
    setToDate('')
    setReason('')
    setKind('paid')
  }

  return (
    <>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <Field label="From date">
          <input
            type="date"
            className={inputClass}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            className={inputClass}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Leave type">
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as 'paid' | 'other')}
            >
              <option value="paid">Paid (counts toward 12 annual/sick days)</option>
              <option value="other">{otherLabel}</option>
            </select>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Reason">
            <textarea
              className={`${inputClass} min-h-[90px]`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </Field>
        </div>
        {formError && (
          <p className="md:col-span-2 text-[12px] font-semibold text-red-600">{formError}</p>
        )}
        <PrimaryButton type="submit">Submit leave request</PrimaryButton>
      </form>
      <p className="mt-3 text-[12px] text-cs-muted">{helper}</p>
    </>
  )
}

function LeaveCard({
  lv,
  canReviewTl,
  canReviewAdmin,
  notes,
  setNotes,
  onAct,
}: {
  lv: LeaveRequest
  canReviewTl?: boolean
  canReviewAdmin?: boolean
  notes: Record<string, string>
  setNotes: (next: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  onAct: (id: string, decision: 'approve' | 'reject') => void
}) {
  return (
    <li className="rounded-xl border border-cs-line px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <img src={lv.userAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-cs-ink">{lv.userName}</p>
            <p className="text-[11px] text-cs-muted">
              {lv.fromDate} → {lv.toDate}
              {lv.kind === 'paid' ? ' · Paid' : lv.kind === 'other' ? ' · Other' : ''}
            </p>
          </div>
        </div>
        <Badge tone={statusTone(lv.status)}>{lv.status}</Badge>
      </div>
      <p className="text-[13px] text-cs-muted">{lv.reason}</p>
      {lv.tlNote && <p className="mt-2 text-[12px] text-cs-forest">TL note: {lv.tlNote}</p>}
      {lv.adminNote && (
        <p className="mt-1 text-[12px] text-cs-forest">Admin / HR note: {lv.adminNote}</p>
      )}
      {canReviewTl && lv.status === 'pending-tl' && (
        <div className="mt-3 space-y-2">
          <Field label="Why are you approving / rejecting?">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={notes[lv.id] || ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [lv.id]: e.target.value }))}
              placeholder="Required when approving"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => onAct(lv.id, 'approve')}>
              Approve and send to Admin / HR
            </PrimaryButton>
            <SecondaryButton onClick={() => onAct(lv.id, 'reject')}>Reject</SecondaryButton>
          </div>
        </div>
      )}
      {canReviewAdmin && lv.status === 'pending-admin' && (
        <div className="mt-3 space-y-2">
          <Field label="Approval note">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={notes[lv.id] || ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [lv.id]: e.target.value }))}
              placeholder="Required when approving"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => onAct(lv.id, 'approve')}>Final approve</PrimaryButton>
            <SecondaryButton onClick={() => onAct(lv.id, 'reject')}>Reject</SecondaryButton>
          </div>
        </div>
      )}
    </li>
  )
}

export function LeaveRequestPanel() {
  const { session, leaveRequests, decideLeaveRequest, leaveStats } = useApp()
  const [notes, setNotes] = useState<Record<string, string>>({})

  if (!session) return null
  const role = session.person.role
  const myId = session.person.id

  const teamRequests =
    role === 'tl'
      ? leaveRequests.filter((l) => l.tlId === myId && l.userId !== myId)
      : isOrgAdmin(role)
        ? leaveRequests
        : leaveRequests.filter((l) => l.userId === myId)

  const myRequests = leaveRequests.filter((l) => l.userId === myId)

  const act = (id: string, decision: 'approve' | 'reject') => {
    const note = notes[id] || ''
    if (decision === 'approve' && !note.trim()) return
    decideLeaveRequest(id, decision, note)
    setNotes((prev) => ({ ...prev, [id]: '' }))
  }

  const list = (items: LeaveRequest[], empty: string, canReviewTl = false, canReviewAdmin = false) =>
    items.length === 0 ? (
      <EmptyState text={empty} />
    ) : (
      <ul className="space-y-3">
        {items.map((lv) => (
          <LeaveCard
            key={lv.id}
            lv={lv}
            canReviewTl={canReviewTl}
            canReviewAdmin={canReviewAdmin}
            notes={notes}
            setNotes={setNotes}
            onAct={act}
          />
        ))}
      </ul>
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[13px] text-cs-muted">Approved</p>
          <p className="mt-2 text-[28px] font-bold text-cs-ink">{leaveStats.approved}</p>
        </Card>
        <Card>
          <p className="text-[13px] text-cs-muted">Pending review</p>
          <p className="mt-2 text-[28px] font-bold text-cs-ink">{leaveStats.pending}</p>
        </Card>
        <Card>
          <p className="text-[13px] text-cs-muted">This month</p>
          <p className="mt-2 text-[28px] font-bold text-cs-ink">{leaveStats.thisMonth}</p>
        </Card>
      </div>

      {role === 'tl' && (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card className="min-w-0">
            <SectionTitle title="Team leave requests" />
            <p className="mb-3 text-[12px] text-cs-muted">
              Review tester requests, then send approved ones to Admin or HR.
            </p>
            {list(teamRequests, 'No team leave requests.', true)}
          </Card>
          <div className="min-w-0 space-y-4">
            <Card>
              <SectionTitle title="Request your leave" />
              <LeaveForm
                otherLabel="Other (Admin or HR approval)"
                helper={`${PAID_LEAVE_MAX} paid annual/sick days per year. Your leave goes to Admin or HR for approval.`}
              />
            </Card>
            <Card>
              <SectionTitle title="My leave requests" />
              {list(myRequests, 'You have not requested leave yet.')}
            </Card>
          </div>
        </div>
      )}

      {role === 'user' && (
        <>
          <Card>
            <SectionTitle title="Request leave" />
            <LeaveForm
              otherLabel="Other (Team Leader + Admin or HR approval)"
              helper={`${PAID_LEAVE_MAX} paid annual/sick days per year. Other leave does not use that quota and still needs Team Leader then Admin or HR approval.`}
            />
          </Card>
          <Card>
            <SectionTitle title="My leave requests" />
            {list(myRequests, 'No leave requests.')}
          </Card>
        </>
      )}

      {isOrgAdmin(role) && (
        <Card>
          <SectionTitle title="Leave requests" />
          {list(teamRequests, 'No leave requests.', false, true)}
        </Card>
      )}
    </div>
  )
}
