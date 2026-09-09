import type { Project, ScopeCredit, SharePointLink, VpnAccess } from '../types'
import { Field, inputClass } from './ui'

type ShareRow = { title: string; url: string }
type VpnRow = { type: 'profile' | 'credits'; label: string; details: string; fileName: string }
type CreditRow = { type: 'text' | 'excel'; content: string; fileName: string }

export type ProjectAccessValues = {
  sharepoint: ShareRow[]
  urls: string[]
  ips: string[]
  configFiles: string[]
  scopeNotes: string
  vpn: VpnRow[]
  scopeCredits: CreditRow[]
  remarks: string
}

export function emptyProjectAccess(): ProjectAccessValues {
  return {
    sharepoint: [{ title: '', url: '' }],
    urls: [''],
    ips: [''],
    configFiles: [''],
    scopeNotes: '',
    vpn: [{ type: 'profile', label: '', details: '', fileName: '' }],
    scopeCredits: [{ type: 'text', content: '', fileName: '' }],
    remarks: '',
  }
}

function filled(list: string[]) {
  return list.map((item) => item.trim()).filter(Boolean)
}

export function fromProjectAccess(project: Project): ProjectAccessValues {
  return {
    sharepoint: project.sharepoint.length
      ? project.sharepoint.map((s) => ({ title: s.title, url: s.url }))
      : [{ title: '', url: '' }],
    urls: project.scope.urls.length ? [...project.scope.urls] : [''],
    ips: project.scope.ips.length ? [...project.scope.ips] : [''],
    configFiles: project.scope.configFiles.length ? [...project.scope.configFiles] : [''],
    scopeNotes: project.scope.notes || '',
    vpn: project.vpn.length
      ? project.vpn.map((v) => ({
          type: v.type,
          label: v.label,
          details: v.details,
          fileName: v.fileName || '',
        }))
      : [{ type: 'profile', label: '', details: '', fileName: '' }],
    scopeCredits: project.scopeCredits.length
      ? project.scopeCredits.map((c) => ({
          type: c.type,
          content: c.content,
          fileName: c.fileName || '',
        }))
      : [{ type: 'text', content: '', fileName: '' }],
    remarks: project.remarks || '',
  }
}

export function toProjectAccessPayload(values: ProjectAccessValues, sharedBy: string) {
  const sharepoint: SharePointLink[] = values.sharepoint
    .filter((row) => row.title.trim() && row.url.trim())
    .map((row, index) => ({
      id: `sp-${Date.now()}-${index}`,
      title: row.title.trim(),
      url: row.url.trim(),
      sharedBy,
    }))

  const vpn: VpnAccess[] = values.vpn
    .filter((row) => row.label.trim() || row.details.trim() || row.fileName.trim())
    .map((row) => ({
      type: row.type,
      label: row.label.trim() || (row.type === 'profile' ? 'VPN Profile' : 'VPN Credits'),
      details: row.details.trim(),
      fileName: row.fileName.trim() || undefined,
    }))

  const scopeCredits: ScopeCredit[] = values.scopeCredits
    .filter((row) => row.content.trim() || row.fileName.trim())
    .map((row) => ({
      type: row.type,
      content: row.content.trim(),
      fileName: row.fileName.trim() || undefined,
    }))

  return {
    sharepoint,
    scope: {
      urls: filled(values.urls),
      ips: filled(values.ips),
      configFiles: filled(values.configFiles),
      notes: values.scopeNotes.trim() || undefined,
    },
    vpn,
    scopeCredits,
    remarks: values.remarks.trim(),
  }
}

export function isProjectAccessComplete(values: ProjectAccessValues) {
  const payload = toProjectAccessPayload(values, 'check')
  return Boolean(
    payload.sharepoint.length &&
      (payload.scope.urls.length || payload.scope.ips.length || payload.scope.configFiles.length) &&
      payload.vpn.length &&
      payload.scopeCredits.length &&
      payload.remarks,
  )
}

function AddMoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-[12px] font-semibold text-cs-forest hover:underline"
    >
      + {label}
    </button>
  )
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-cs-line px-3 py-2 text-[12px] font-semibold text-cs-muted disabled:opacity-40"
    >
      Remove
    </button>
  )
}

function StringList({
  label,
  placeholder,
  items,
  onChange,
  addLabel,
}: {
  label: string
  placeholder: string
  items: string[]
  onChange: (next: string[]) => void
  addLabel: string
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex gap-2">
            <input
              className={inputClass}
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items]
                next[index] = e.target.value
                onChange(next)
              }}
            />
            <RemoveButton
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          </div>
        ))}
      </div>
      <AddMoreButton label={addLabel} onClick={() => onChange([...items, ''])} />
    </Field>
  )
}

export default function ProjectAccessFields({
  values,
  onChange,
}: {
  values: ProjectAccessValues
  onChange: (next: ProjectAccessValues) => void
}) {
  return (
    <div className="md:col-span-2 space-y-4">
      <div className="rounded-2xl border border-cs-line p-4">
        <p className="mb-3 text-[14px] font-semibold text-cs-ink">SharePoint folder access</p>
        <div className="space-y-3">
          {values.sharepoint.map((row, index) => (
            <div key={`sp-${index}`} className="grid gap-2 rounded-xl bg-[#f7f8fa] p-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Folder name">
                <input
                  className={inputClass}
                  value={row.title}
                  placeholder="e.g. Arc VAPT Workspace"
                  onChange={(e) => {
                    const next = [...values.sharepoint]
                    next[index] = { ...row, title: e.target.value }
                    onChange({ ...values, sharepoint: next })
                  }}
                />
              </Field>
              <Field label="SharePoint URL">
                <input
                  className={inputClass}
                  value={row.url}
                  placeholder="https://..."
                  onChange={(e) => {
                    const next = [...values.sharepoint]
                    next[index] = { ...row, url: e.target.value }
                    onChange({ ...values, sharepoint: next })
                  }}
                />
              </Field>
              <div className="flex items-end">
                <RemoveButton
                  disabled={values.sharepoint.length === 1}
                  onClick={() =>
                    onChange({
                      ...values,
                      sharepoint: values.sharepoint.filter((_, i) => i !== index),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <AddMoreButton
          label="Add SharePoint folder"
          onClick={() =>
            onChange({ ...values, sharepoint: [...values.sharepoint, { title: '', url: '' }] })
          }
        />
      </div>

      <div className="rounded-2xl border border-cs-line p-4">
        <p className="mb-3 text-[14px] font-semibold text-cs-ink">Scope (URLs, IPs, config files)</p>
        <div className="grid gap-3 md:grid-cols-3">
          <StringList
            label="URLs"
            placeholder="https://..."
            items={values.urls}
            onChange={(urls) => onChange({ ...values, urls })}
            addLabel="Add URL"
          />
          <StringList
            label="IPs"
            placeholder="203.0.113.10"
            items={values.ips}
            onChange={(ips) => onChange({ ...values, ips })}
            addLabel="Add IP"
          />
          <StringList
            label="Config files"
            placeholder="targets.txt"
            items={values.configFiles}
            onChange={(configFiles) => onChange({ ...values, configFiles })}
            addLabel="Add config file"
          />
        </div>
        <div className="mt-3">
          <Field label="Scope notes">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={values.scopeNotes}
              onChange={(e) => onChange({ ...values, scopeNotes: e.target.value })}
              placeholder="e.g. External + limited internal scope. Do not test payment gateway after 6 PM IST."
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-cs-line p-4">
        <p className="mb-3 text-[14px] font-semibold text-cs-ink">How to connect to clients</p>
        <div className="space-y-3">
          {values.vpn.map((row, index) => (
            <div key={`vpn-${index}`} className="space-y-2 rounded-xl bg-[#f7f8fa] p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Type">
                  <select
                    className={inputClass}
                    value={row.type}
                    onChange={(e) => {
                      const next = [...values.vpn]
                      next[index] = {
                        ...row,
                        type: e.target.value as 'profile' | 'credits',
                      }
                      onChange({ ...values, vpn: next })
                    }}
                  >
                    <option value="profile">VPN Profile</option>
                    <option value="credits">VPN Credits</option>
                  </select>
                </Field>
                <Field label="Title">
                  <input
                    className={inputClass}
                    value={row.label}
                    placeholder="e.g. Arc Client VPN Profile"
                    onChange={(e) => {
                      const next = [...values.vpn]
                      next[index] = { ...row, label: e.target.value }
                      onChange({ ...values, vpn: next })
                    }}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Details">
                    <textarea
                      className={`${inputClass} min-h-[64px]`}
                      value={row.details}
                      placeholder="Profile purpose, username, secure note, MFA steps..."
                      onChange={(e) => {
                        const next = [...values.vpn]
                        next[index] = { ...row, details: e.target.value }
                        onChange({ ...values, vpn: next })
                      }}
                    />
                  </Field>
                </div>
                <Field label="File name (optional)">
                  <input
                    className={inputClass}
                    value={row.fileName}
                    placeholder="arc-client.ovpn"
                    onChange={(e) => {
                      const next = [...values.vpn]
                      next[index] = { ...row, fileName: e.target.value }
                      onChange({ ...values, vpn: next })
                    }}
                  />
                </Field>
                <div className="flex items-end">
                  <RemoveButton
                    disabled={values.vpn.length === 1}
                    onClick={() =>
                      onChange({ ...values, vpn: values.vpn.filter((_, i) => i !== index) })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <AddMoreButton
          label="Add VPN profile or credits"
          onClick={() =>
            onChange({
              ...values,
              vpn: [...values.vpn, { type: 'credits', label: '', details: '', fileName: '' }],
            })
          }
        />
      </div>

      <div className="rounded-2xl border border-cs-line p-4">
        <p className="mb-3 text-[14px] font-semibold text-cs-ink">Scope credits</p>
        <div className="space-y-3">
          {values.scopeCredits.map((row, index) => (
            <div key={`credit-${index}`} className="space-y-2 rounded-xl bg-[#f7f8fa] p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Type">
                  <select
                    className={inputClass}
                    value={row.type}
                    onChange={(e) => {
                      const next = [...values.scopeCredits]
                      next[index] = { ...row, type: e.target.value as 'text' | 'excel' }
                      onChange({ ...values, scopeCredits: next })
                    }}
                  >
                    <option value="text">Plain text</option>
                    <option value="excel">Excel attachment</option>
                  </select>
                </Field>
                <Field label="File name (optional)">
                  <input
                    className={inputClass}
                    value={row.fileName}
                    placeholder="Arc_Scope_Credits_v2.xlsx"
                    onChange={(e) => {
                      const next = [...values.scopeCredits]
                      next[index] = { ...row, fileName: e.target.value }
                      onChange({ ...values, scopeCredits: next })
                    }}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      className={`${inputClass} min-h-[72px]`}
                      value={row.content}
                      placeholder="Authorized host list with severity guidance from client."
                      onChange={(e) => {
                        const next = [...values.scopeCredits]
                        next[index] = { ...row, content: e.target.value }
                        onChange({ ...values, scopeCredits: next })
                      }}
                    />
                  </Field>
                </div>
                <RemoveButton
                  disabled={values.scopeCredits.length === 1}
                  onClick={() =>
                    onChange({
                      ...values,
                      scopeCredits: values.scopeCredits.filter((_, i) => i !== index),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <AddMoreButton
          label="Add scope credit"
          onClick={() =>
            onChange({
              ...values,
              scopeCredits: [
                ...values.scopeCredits,
                { type: 'text', content: '', fileName: '' },
              ],
            })
          }
        />
      </div>

      <Field label="Remarks">
        <textarea
          className={`${inputClass} min-h-[90px]`}
          value={values.remarks}
          onChange={(e) => onChange({ ...values, remarks: e.target.value })}
          placeholder="Prioritize auth & IDOR first. Escalate any P1 findings to TL within 1 hour."
        />
      </Field>
    </div>
  )
}
