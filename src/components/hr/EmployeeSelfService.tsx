import { useApp } from '../../context/AppContext'
import { Badge, Card, EmptyState, SectionTitle } from '../ui'
import LeaveBalanceCards from './LeaveBalanceCards'

export default function EmployeeSelfService() {
  const { session, payslips, assets } = useApp()
  const person = session?.person

  if (!person || (person.role !== 'user' && person.role !== 'tl')) return null

  const minePayslips = payslips.filter((p) => p.personId === person.id)
  const mineAssets = assets.filter((a) => a.personId === person.id)

  return (
    <div className="space-y-4">
      <LeaveBalanceCards person={person} />

      <Card>
        <SectionTitle title="Payslips" />
        {minePayslips.length === 0 ? (
          <EmptyState text="HR has not uploaded a payslip yet." />
        ) : (
          <ul className="space-y-2">
            {minePayslips.map((slip) => (
              <li
                key={slip.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cs-line px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-semibold text-cs-ink">{slip.month}</p>
                  <p className="text-[12px] text-cs-muted">{slip.fileName}</p>
                </div>
                <a
                  className="rounded-xl bg-cs-forest px-3 py-1.5 text-[12px] font-semibold text-white"
                  href={slip.dataUrl}
                  download={slip.fileName}
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title="My assets" />
        <p className="mb-2 text-[12px] text-cs-muted">Allotted by HR. Returned items stay on record.</p>
        {mineAssets.length === 0 ? (
          <EmptyState text="No assets allotted yet." />
        ) : (
          <ul className="space-y-1 text-[13px] text-cs-ink">
            {mineAssets.map((asset) => (
              <li key={asset.id}>
                <Badge tone={asset.status === 'allotted' ? 'forest' : asset.status === 'returned' ? 'green' : 'red'}>
                  {asset.status}
                </Badge>{' '}
                {asset.label} · {asset.kind}
                {asset.returnedAt ? ` · ${asset.returnedAt}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
