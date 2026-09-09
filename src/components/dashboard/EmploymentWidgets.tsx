import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import FilterSelect from '../FilterSelect'
import { Card } from '../ui'
import {
  employmentPeriodOptions,
  getEmploymentForPeriod,
  type DashPeriod,
} from '../../data/periodData'

export function EmploymentMetricStrip() {
  const { leaveStats } = useApp()
  const [period, setPeriod] = useState<DashPeriod>('this-month')
  const employment = getEmploymentForPeriod(period)

  const cards = [
    {
      title: 'Total Employees',
      value: String(employment.totalEmployees),
      footer: "You're part of a growing team!",
    },
    {
      title: 'Attendance',
      value: `${employment.attendancePct}%`,
      sub: `Present · ${employment.daysOff} Days Off`,
      footer: `${employment.presentDays} working days tracked`,
    },
    {
      title: 'Leave Requests',
      value: `${leaveStats.approved} Approved`,
      sub: `${leaveStats.pending} Pending Review`,
      footer: `${leaveStats.thisMonth} leave requests this month`,
    },
    {
      title: 'Team Growth',
      value: `+${employment.applicantsGrowthPct}%`,
      sub: 'New applicants trend',
      footer: `${employment.newApplicants} new applicants`,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <FilterSelect
          value={period}
          options={employmentPeriodOptions}
          onChange={setPeriod}
          ariaLabel="Employment period filter"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="!p-0 overflow-hidden">
            <div className="p-5">
              <p className="text-[13px] font-medium text-cs-muted">{c.title}</p>
              <p className="mt-2 text-[32px] font-bold leading-none text-cs-ink">{c.value}</p>
              {c.sub && <p className="mt-2 text-[12px] text-cs-muted">{c.sub}</p>}
            </div>
            <div className="bg-[#edf7f1] px-5 py-2.5 text-[12px] font-medium text-cs-forest">
              {c.footer}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function EmploymentStatusCard() {
  const { employment: base } = useApp()
  const [period, setPeriod] = useState<DashPeriod>('this-month')
  const employment = getEmploymentForPeriod(period)
  const total = employment.totalEmployees || base.totalEmployees
  const segments = [
    { label: 'Full-Time', count: employment.fullTime, color: '#0b4f3c' },
    { label: 'Part-Time', count: employment.partTime, color: '#14b8a6' },
    { label: 'Contract', count: employment.contract, color: '#7ddea8' },
    { label: 'Intern', count: employment.intern, color: '#d4edd9' },
  ]

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Employment Status</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-[12px] font-semibold text-cs-forest">
            {total} Employees
          </span>
          <FilterSelect
            value={period}
            options={employmentPeriodOptions}
            onChange={setPeriod}
            ariaLabel="Employment status period"
          />
        </div>
      </div>
      <div className="mb-4 flex h-3 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[13px] text-cs-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="text-[12px] font-semibold text-cs-muted">
              {Math.round((s.count / total) * 100)}% · {s.count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
