import {
  CASUAL_LEAVE_MAX,
  EARNED_LEAVE_MAX,
  SICK_LEAVE_MAX,
  useApp,
} from '../../context/AppContext'
import { earnedLeaveMax, remainingLeave } from '../../hr/peopleOps'
import type { Person } from '../../types'
import { Card } from '../ui'

export default function LeaveBalanceCards({ person }: { person?: Person | null }) {
  const { leaveRequests, updates, workedDayRequests } = useApp()
  if (!person) return null

  const extras = { updates, workedDays: workedDayRequests }
  const earnedMax = earnedLeaveMax(person.id, updates, workedDayRequests)
  const saturdayCredits = earnedMax - EARNED_LEAVE_MAX

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[12px] text-cs-muted">Earned Leaves</p>
          <p className="mt-1 text-[22px] font-bold text-cs-ink">
            {remainingLeave(person, leaveRequests, 'earned', extras)}/{earnedMax}
          </p>
        </Card>
        <Card>
          <p className="text-[12px] text-cs-muted">Casual Leaves</p>
          <p className="mt-1 text-[22px] font-bold text-cs-ink">
            {remainingLeave(person, leaveRequests, 'casual', extras)}/{CASUAL_LEAVE_MAX}
          </p>
        </Card>
        <Card>
          <p className="text-[12px] text-cs-muted">Sick Leaves</p>
          <p className="mt-1 text-[22px] font-bold text-cs-ink">
            {remainingLeave(person, leaveRequests, 'sick', extras)}/{SICK_LEAVE_MAX}
          </p>
        </Card>
      </div>
      <p className="text-[12px] text-cs-muted">
        Earned leave starts at {EARNED_LEAVE_MAX}. Each Saturday or Sunday with logged work adds 1
        {saturdayCredits ? ` (${saturdayCredits} so far)` : ''}. Casual {CASUAL_LEAVE_MAX} and sick{' '}
        {SICK_LEAVE_MAX} reset every year and do not carry forward.
      </p>
    </div>
  )
}
