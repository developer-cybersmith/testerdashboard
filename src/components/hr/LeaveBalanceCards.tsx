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
        Earned {EARNED_LEAVE_MAX} per year
        {saturdayCredits
          ? ` plus ${saturdayCredits} day${saturdayCredits === 1 ? '' : 's'} for 1st / 3rd Saturdays worked`
          : ''}
        . Casual and sick ({CASUAL_LEAVE_MAX} each) reset every year and do not carry forward.
      </p>
    </div>
  )
}
