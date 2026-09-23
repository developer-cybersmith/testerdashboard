import { AlertTriangle, ClipboardList, ExternalLink, FileSpreadsheet, KeyRound, Users } from 'lucide-react'
import { useState } from 'react'
import type { Project, RequirementStatus } from '../types'
import { REQUIREMENT_STATUS_OPTIONS, requirementStatusLabel } from '../types'
import { Badge, Modal, PrimaryButton, SecondaryButton, inputClass } from './ui'
import { canViewDirectoryPerson, isOrgAdmin, personLabel, publicRoleLabel, sortBlockersByPriority, useApp } from '../context/AppContext'
import EmployeeDetails from './EmployeeDetails'

function requirementTone(status: RequirementStatus) {
  if (status === 'fulfilled') return 'green' as const
  if (status === 'pending-client') return 'yellow' as const
  if (status === 'pending-us') return 'blue' as const
  return 'gray' as const
}

function blockerTone(severity: string) {
  return severity === 'critical' || severity === 'high' ? ('red' as const) : ('yellow' as const)
}

export default function ProjectDetailModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const {
    session,
    people,
    projects,
    blockers,
    updateBlockerStatus,
    updateRequirementStatus,
  } = useApp()
  const [profileId, setProfileId] = useState<string | null>(null)
  const viewerRole = session?.person.role
  const canManage = isOrgAdmin(viewerRole) || viewerRole === 'tl'
  const liveProject = projects.find((p) => p.id === project.id) || project
  const profilePerson = people.find((p) => p.id === profileId)
  const openBlockers = sortBlockersByPriority(
    blockers.filter((b) => b.projectId === liveProject.id && b.status !== 'resolved'),
  )

  if (profilePerson && canViewDirectoryPerson(session?.person, profilePerson)) {
    return (
      <Modal title={profilePerson.name} onClose={onClose} wide>
        <SecondaryButton className="mb-4" onClick={() => setProfileId(null)}>
          Back to project
        </SecondaryButton>
        <EmployeeDetails person={profilePerson} />
      </Modal>
    )
  }
  return (
    <Modal title={liveProject.name} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="forest">{liveProject.client}</Badge>
        <Badge tone={liveProject.status === 'active' ? 'green' : 'gray'}>{liveProject.status}</Badge>
        <Badge tone="blue">{liveProject.progress}% progress</Badge>
      </div>
      <div className="mb-4 grid gap-2 rounded-2xl border border-cs-line bg-white px-3 py-3 text-[12px] text-cs-muted sm:grid-cols-2">
        <p>
          <span className="font-semibold text-cs-ink">Start date:</span> {liveProject.startDate || '—'}
        </p>
        <p>
          <span className="font-semibold text-cs-ink">Closure date:</span>{' '}
          {liveProject.closureDate || '—'}
        </p>
        <p>
          <span className="font-semibold text-cs-ink">Initial report submission:</span>{' '}
          {liveProject.initialReportDate || '—'}
        </p>
        <p>
          <span className="font-semibold text-cs-ink">Closure report date:</span>{' '}
          {liveProject.closureReportDate || '—'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <Users size={16} /> Team allocated
          </div>
          <ul className="space-y-2">
            {liveProject.team.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-cs-ink">{personLabel(m)}</p>
                  {publicRoleLabel(m, viewerRole) && (
                    <p className="text-[11px] text-cs-muted">{publicRoleLabel(m, viewerRole)}</p>
                  )}
                </div>
                {canViewDirectoryPerson(session?.person, m) && (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-cs-forest"
                    onClick={() => setProfileId(m.id)}
                  >
                    View
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 text-[14px] font-semibold text-cs-ink">SharePoint folder access</div>
          {liveProject.sharepoint.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No links shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {liveProject.sharepoint.map((link) => (
                <li key={link.id} className="rounded-xl bg-[#f7f8fa] px-3 py-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-cs-forest hover:underline"
                  >
                    {link.title} <ExternalLink size={13} />
                  </a>
                  <p className="text-[11px] text-cs-muted">Shared by {link.sharedBy}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-cs-line p-4 md:col-span-2">
          <div className="mb-3 text-[14px] font-semibold text-cs-ink">
            Scope (URLs, IPs, config files)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-cs-muted">URLs</p>
              <ul className="space-y-1 text-[13px] text-cs-ink">
                {liveProject.scope.urls.map((u) => (
                  <li key={u} className="break-all rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {u}
                  </li>
                ))}
                {liveProject.scope.urls.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-cs-muted">IPs</p>
              <ul className="space-y-1 text-[13px] text-cs-ink">
                {liveProject.scope.ips.map((ip) => (
                  <li key={ip} className="rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {ip}
                  </li>
                ))}
                {liveProject.scope.ips.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-cs-muted">Config files</p>
              <ul className="space-y-1 text-[13px] text-cs-ink">
                {liveProject.scope.configFiles.map((f) => (
                  <li key={f} className="rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {f}
                  </li>
                ))}
                {liveProject.scope.configFiles.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
          </div>
          {liveProject.scope.notes && (
            <p className="mt-3 rounded-xl bg-[#edf7f1] px-3 py-2 text-[13px] text-cs-forest">
              {liveProject.scope.notes}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <KeyRound size={16} /> How to connect to clients
          </div>
          <ul className="space-y-2">
            {liveProject.vpn.map((v, index) => (
              <li key={`${v.label}-${index}`} className="rounded-xl bg-[#f7f8fa] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge tone={v.type === 'profile' ? 'blue' : 'yellow'}>
                    {v.type === 'profile' ? 'VPN Profile' : 'VPN Credits'}
                  </Badge>
                  <span className="text-[13px] font-semibold text-cs-ink">{v.label}</span>
                </div>
                <p className="mt-1 text-[12px] text-cs-muted">{v.details}</p>
                {v.fileName && (
                  <p className="mt-1 text-[12px] font-medium text-cs-forest">{v.fileName}</p>
                )}
              </li>
            ))}
            {liveProject.vpn.length === 0 && (
              <li className="text-[13px] text-cs-muted">No VPN access shared yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <FileSpreadsheet size={16} /> Scope credits
          </div>
          {liveProject.scopeCredits.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No scope credits yet.</p>
          ) : (
            <ul className="space-y-3">
              {liveProject.scopeCredits.map((credit, index) => (
                <li key={`${credit.fileName || credit.content}-${index}`}>
                  <Badge tone={credit.type === 'excel' ? 'green' : 'gray'}>
                    {credit.type === 'excel' ? 'Excel attachment' : 'Plain text'}
                  </Badge>
                  {credit.fileName && (
                    <p className="mt-2 text-[13px] font-semibold text-cs-forest">
                      {credit.fileName}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-cs-ink">
                    {credit.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-cs-line p-4 md:col-span-2">
          <div className="mb-2 text-[14px] font-semibold text-cs-ink">Remarks</div>
          <p className="rounded-xl bg-[#fff7ed] px-3 py-3 text-[13px] leading-relaxed text-[#9a3412]">
            {liveProject.remarks || 'No specific instructions yet.'}
          </p>
        </section>

        <section className="rounded-2xl border border-cs-line p-4 md:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <AlertTriangle size={16} /> Open blockers
          </div>
          {openBlockers.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No unresolved blockers for this project.</p>
          ) : (
            <ul className="space-y-3">
              {openBlockers.map((b) => (
                <li
                  key={b.id}
                  className={`rounded-xl border px-3 py-3 ${
                    b.raisedByRole === 'tl'
                      ? 'border-[#f59e0b] bg-[#fffbeb]'
                      : b.severity === 'critical' || b.severity === 'high'
                        ? 'border-[#fecaca] bg-[#fef2f2]'
                        : 'border-cs-line bg-[#f7f8fa]'
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-cs-ink">{b.title}</p>
                    {b.raisedByRole === 'tl' && <Badge tone="yellow">Team Leader · high priority</Badge>}
                    <Badge tone={blockerTone(b.severity)}>{b.severity}</Badge>
                    <Badge tone={b.status === 'in-review' ? 'yellow' : 'red'}>{b.status}</Badge>
                  </div>
                  <p className="text-[12px] text-cs-muted">Raised by {b.raisedByName}</p>
                  <p className="mt-1 text-[13px] text-cs-ink">{b.description}</p>
                  {canManage && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.status === 'open' && (
                        <SecondaryButton onClick={() => updateBlockerStatus(b.id, 'in-review')}>
                          Mark in review
                        </SecondaryButton>
                      )}
                      <PrimaryButton onClick={() => updateBlockerStatus(b.id, 'resolved')}>
                        Mark resolved
                      </PrimaryButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-cs-line p-4 md:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <ClipboardList size={16} /> Requirements
          </div>
          {liveProject.requirements.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No requirements listed yet.</p>
          ) : (
            <ul className="space-y-2">
              {liveProject.requirements.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 flex-col gap-2 rounded-xl bg-[#f7f8fa] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 break-words text-[13px] text-cs-ink">{item.text}</p>
                  {canManage ? (
                    <select
                      className={`${inputClass} sm:max-w-[220px]`}
                      value={item.status}
                      onChange={(e) =>
                        updateRequirementStatus(
                          liveProject.id,
                          item.id,
                          e.target.value as RequirementStatus,
                        )
                      }
                    >
                      {REQUIREMENT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={requirementTone(item.status)}>
                      {requirementStatusLabel(item.status)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
