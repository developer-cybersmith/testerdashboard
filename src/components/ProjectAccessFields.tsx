import { useRef, useState } from 'react'
import type { Project, ScopeCredit, SharePointLink, VpnAccess } from '../types'
import { Field, inputClass } from './ui'
import { sanitizeText } from '../security/wstg'

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

function mergeUnique(current: string[], incoming: string[]) {
  const next = filled(current)
  const seen = new Set(next.map((item) => item.toLowerCase()))
  incoming.forEach((item) => {
    const value = sanitizeText(item, 300)
    if (!value || seen.has(value.toLowerCase())) return
    next.push(value)
    seen.add(value.toLowerCase())
  })
  return next.length ? next : ['']
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    const next = src[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
        continue
      }
      if (ch === '"') {
        inQuotes = false
        continue
      }
      cell += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim()))
}

function classifyScopeValue(raw: string): 'url' | 'ip' | 'file' | null {
  const value = sanitizeText(raw, 300)
  if (!value) return null
  if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(value)) return 'ip'
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(':')) return 'ip'
  if (/^https?:\/\//i.test(value) || /^www\./i.test(value)) return 'url'
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(value) && !value.includes('@') && !/\s/.test(value)) {
    return 'url'
  }
  return 'file'
}

function headerKind(header: string): 'url' | 'ip' | 'file' | null {
  const h = header.toLowerCase().replace(/[^a-z]/g, '')
  if (!h) return null
  if (h.includes('url') || h.includes('host') || h.includes('domain') || h.includes('endpoint') || h === 'target') {
    return 'url'
  }
  if (h === 'ip' || h === 'ips' || h.includes('ipaddress') || h === 'address') return 'ip'
  if (h.includes('config') || h.includes('file') || h.includes('asset')) return 'file'
  return null
}

export function parseScopeCsv(text: string) {
  const urls: string[] = []
  const ips: string[] = []
  const configFiles: string[] = []
  const push = (kind: 'url' | 'ip' | 'file', raw: string) => {
    const value = sanitizeText(raw, 300)
    if (!value) return
    if (kind === 'url') urls.push(value)
    else if (kind === 'ip') ips.push(value)
    else configFiles.push(value)
  }

  const rows = parseCsvRows(text).slice(0, 400)
  if (!rows.length) return { urls, ips, configFiles }

  const headerKinds = rows[0].map((cell) => headerKind(cell))
  const hasHeader = headerKinds.some(Boolean)
  const dataRows = hasHeader ? rows.slice(1) : rows

  dataRows.forEach((row) => {
    row.forEach((cell, index) => {
      const fromHeader = hasHeader ? headerKinds[index] : null
      const kind = fromHeader || classifyScopeValue(cell)
      if (kind) push(kind, cell)
    })
  })

  return {
    urls: mergeUnique([], urls).filter(Boolean),
    ips: mergeUnique([], ips).filter(Boolean),
    configFiles: mergeUnique([], configFiles).filter(Boolean),
  }
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
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvMsg, setCsvMsg] = useState<string | null>(null)

  const importCsv = async (file?: File) => {
    setCsvMsg(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setCsvMsg('Use a .csv file')
      return
    }
    if (file.size > 400_000) {
      setCsvMsg('CSV must be under 400 KB')
      return
    }
    const text = await file.text()
    const parsed = parseScopeCsv(text)
    if (!parsed.urls.length && !parsed.ips.length && !parsed.configFiles.length) {
      setCsvMsg('No URLs, IPs, or config files found in that CSV')
      return
    }
    onChange({
      ...values,
      urls: mergeUnique(values.urls, parsed.urls),
      ips: mergeUnique(values.ips, parsed.ips),
      configFiles: mergeUnique(values.configFiles, parsed.configFiles),
    })
    const parts = [
      parsed.urls.length ? `${parsed.urls.length} URL${parsed.urls.length === 1 ? '' : 's'}` : '',
      parsed.ips.length ? `${parsed.ips.length} IP${parsed.ips.length === 1 ? '' : 's'}` : '',
      parsed.configFiles.length
        ? `${parsed.configFiles.length} config file${parsed.configFiles.length === 1 ? '' : 's'}`
        : '',
    ].filter(Boolean)
    setCsvMsg(`Imported ${parts.join(', ')}`)
  }

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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-cs-ink">Scope (URLs, IPs, config files)</p>
            <p className="mt-1 text-[12px] text-cs-muted">
              Import a CSV with columns like url, ip, config file, or a mixed list of values.
            </p>
          </div>
          <div className="shrink-0">
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                void importCsv(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="rounded-xl border border-cs-line px-3 py-2 text-[12px] font-semibold text-cs-forest hover:bg-[#edf7f1]"
              onClick={() => csvRef.current?.click()}
            >
              Import from CSV
            </button>
          </div>
        </div>
        {csvMsg && (
          <p
            className={`mb-3 text-[12px] font-semibold ${
              csvMsg.startsWith('Imported') ? 'text-cs-forest' : 'text-red-600'
            }`}
          >
            {csvMsg}
          </p>
        )}
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
