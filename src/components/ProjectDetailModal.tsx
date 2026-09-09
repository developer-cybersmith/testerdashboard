import { ExternalLink, FileSpreadsheet, KeyRound, Users } from 'lucide-react'
import { useState } from 'react'
import type { Project } from '../types'
import { Badge, Modal, SecondaryButton } from './ui'
import { personLabel, publicRoleLabel, useApp } from '../context/AppContext'
import EmployeeDetails from './EmployeeDetails'

export default function ProjectDetailModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const { session, people } = useApp()
  const [profileId, setProfileId] = useState<string | null>(null)
  const viewerRole = session?.person.role
  const canViewProfiles = viewerRole === 'admin' || viewerRole === 'tl'
  const profilePerson = people.find((p) => p.id === profileId)

  if (profilePerson && canViewProfiles) {
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
    <Modal title={project.name} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="forest">{project.client}</Badge>
        <Badge tone={project.status === 'active' ? 'green' : 'gray'}>{project.status}</Badge>
        <Badge tone="blue">{project.progress}% progress</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <Users size={16} /> Team allocated
          </div>
          <ul className="space-y-2">
            {project.team.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-cs-ink">{personLabel(m)}</p>
                  {publicRoleLabel(m, viewerRole) && (
                    <p className="text-[11px] text-cs-muted">{publicRoleLabel(m, viewerRole)}</p>
                  )}
                </div>
                {canViewProfiles && (
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
          {project.sharepoint.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No links shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {project.sharepoint.map((link) => (
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
                {project.scope.urls.map((u) => (
                  <li key={u} className="break-all rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {u}
                  </li>
                ))}
                {project.scope.urls.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-cs-muted">IPs</p>
              <ul className="space-y-1 text-[13px] text-cs-ink">
                {project.scope.ips.map((ip) => (
                  <li key={ip} className="rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {ip}
                  </li>
                ))}
                {project.scope.ips.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase text-cs-muted">Config files</p>
              <ul className="space-y-1 text-[13px] text-cs-ink">
                {project.scope.configFiles.map((f) => (
                  <li key={f} className="rounded-lg bg-[#f7f8fa] px-2 py-1">
                    {f}
                  </li>
                ))}
                {project.scope.configFiles.length === 0 && (
                  <li className="text-cs-muted">None listed</li>
                )}
              </ul>
            </div>
          </div>
          {project.scope.notes && (
            <p className="mt-3 rounded-xl bg-[#edf7f1] px-3 py-2 text-[13px] text-cs-forest">
              {project.scope.notes}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <KeyRound size={16} /> How to connect to clients
          </div>
          <ul className="space-y-2">
            {project.vpn.map((v, index) => (
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
            {project.vpn.length === 0 && (
              <li className="text-[13px] text-cs-muted">No VPN access shared yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-cs-line p-4">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-cs-ink">
            <FileSpreadsheet size={16} /> Scope credits
          </div>
          {project.scopeCredits.length === 0 ? (
            <p className="text-[13px] text-cs-muted">No scope credits yet.</p>
          ) : (
            <ul className="space-y-3">
              {project.scopeCredits.map((credit, index) => (
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
            {project.remarks || 'No specific instructions yet.'}
          </p>
        </section>
      </div>
    </Modal>
  )
}
