import { CASUAL_LEAVE_MAX, SICK_LEAVE_MAX, useApp } from '../../context/AppContext'
import { earnedLeaveMax, remainingLeave } from '../../hr/peopleOps'
import type { Person } from '../../types'
import { Card } from '../ui'

export default function LeaveBalanceCards({ person }: { person?: Person | null }) {
  const { leaveRequests, updates, workedDayRequests } = useApp()
  if (!person) return null

  const extras = { updates, workedDays: workedDayRequests }
  const earnedMax = earnedLeaveMax(person.id, updates, workedDayRequests)

  return (
    <div>
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
    </div>
  )
}
