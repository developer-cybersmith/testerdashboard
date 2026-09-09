import { useMemo, useRef, useState } from 'react'
import { Download, Paperclip, Search, Send, X } from 'lucide-react'
import { personLabel, publicRoleLabel, useApp } from '../context/AppContext'
import type { QueryAttachment, QueryItem } from '../types'
import { PrimaryButton, inputClass } from './ui'

function timeLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    day: 'numeric',
    month: 'short',
  })
}

function downloadAttachment(att: QueryAttachment) {
  const a = document.createElement('a')
  a.href = att.dataUrl
  a.download = att.name
  a.click()
}

function readFiles(files: FileList | File[]): Promise<QueryAttachment[]> {
  const list = Array.from(files).slice(0, 5)
  return Promise.all(
    list.map(
      (file) =>
        new Promise<QueryAttachment | null>((resolve) => {
          if (file.size > 1_500_000) {
            resolve(null)
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : ''
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const kind = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? 'image' : 'file'
            resolve({
              id: `att-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              kind,
              mime: file.type,
              dataUrl,
              size: file.size,
            })
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(file)
        }),
    ),
  ).then((rows) => rows.filter((row): row is QueryAttachment => Boolean(row)))
}

function AttachmentList({
  items,
  onRemove,
  inverted,
}: {
  items: QueryAttachment[]
  onRemove?: (id: string) => void
  inverted?: boolean
}) {
  if (!items.length) return null
  return (
    <div className="mt-2 space-y-2">
      {items.map((att) =>
        att.kind === 'image' ? (
          <div key={att.id} className="relative max-w-xs">
            <img src={att.dataUrl} alt={att.name} className="max-h-48 rounded-xl object-cover" />
            {onRemove && (
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white"
                onClick={() => onRemove(att.id)}
                aria-label={`Remove ${att.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <div
            key={att.id}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] ${
              inverted ? 'bg-white/15 text-white' : 'bg-white text-cs-ink ring-1 ring-cs-line'
            }`}
          >
            <span className="truncate font-semibold">{att.name}</span>
            {onRemove ? (
              <button type="button" onClick={() => onRemove(att.id)} aria-label={`Remove ${att.name}`}>
                <X size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => downloadAttachment(att)} aria-label={`Download ${att.name}`}>
                <Download size={14} />
              </button>
            )}
          </div>
        ),
      )}
    </div>
  )
}

export default function QueryChatSession() {
  const { session, queries, people, projects, sendQueryMessage, addQuery } = useApp()
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [draftFiles, setDraftFiles] = useState<QueryAttachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    if (!session) return []
    const me = session.person.id
    return queries.filter((q) => {
      const project = projects.find((p) => p.id === q.projectId)
      if (!project) return false
      if (session.person.role === 'admin') return true
      return q.fromUserId === me || q.toPersonId === me
    })
  }, [queries, session, projects])

  const otherId = (q: QueryItem) =>
    session?.person.id === q.fromUserId ? q.toPersonId : q.fromUserId

  const conversations = useMemo(() => {
    const map = new Map<string, QueryItem[]>()
    visible.forEach((q) => {
      const id = otherId(q)
      map.set(id, [...(map.get(id) || []), q])
    })
    return [...map.entries()]
      .map(([personId, threads]) => {
        const sorted = [...threads].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        const last = sorted
          .flatMap((t) => t.messages || [])
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .at(-1)
        return {
          personId,
          threads: sorted,
          lastAt: last?.createdAt || sorted.at(-1)?.createdAt || '',
        }
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  }, [visible, session])

  const directory = useMemo(() => {
    if (!session) return []
    const q = search.trim().toLowerCase()
    if (!q) return []
    return people.filter((p) => {
      if (p.id === session.person.id) return false
      return (
        p.name.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.jobTitle || '').toLowerCase().includes(q)
      )
    })
  }, [people, search, session])

  const selectedPersonId = partnerId || (search.trim() ? null : conversations[0]?.personId) || null
  const selectedConv =
    conversations.find((c) => c.personId === selectedPersonId) ||
    (selectedPersonId
      ? { personId: selectedPersonId, threads: [] as QueryItem[], lastAt: '' }
      : null)
  const selectedThreads = selectedConv?.threads || []
  const myThreads = selectedThreads.filter(
    (q) => q.fromUserId === session?.person.id || q.toPersonId === session?.person.id,
  )
  const activeThread = myThreads.at(-1) || null

  const history = selectedThreads
    .flatMap((thread) =>
      (thread.messages?.length
        ? thread.messages
        : [
            {
              id: `${thread.id}-legacy`,
              senderId: thread.fromUserId,
              senderName: thread.fromUserName,
              body: thread.message,
              createdAt: thread.createdAt,
            },
          ]
      ).map((m) => ({ ...m, subject: thread.subject, queryId: thread.id })),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const avatarFor = (userId: string, name: string) => {
    const p = people.find((x) => x.id === userId)
    return p?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
  }

  const personName = (id: string) => personLabel(people.find((p) => p.id === id))

  const openPerson = (id: string) => {
    setPartnerId(id)
    setSearch('')
  }

  const send = () => {
    if (!selectedPersonId || (!draft.trim() && draftFiles.length === 0)) return
    if (activeThread) {
      sendQueryMessage(activeThread.id, draft.trim(), draftFiles)
    } else {
      addQuery({
        toPersonId: selectedPersonId,
        message: draft.trim(),
        attachments: draftFiles,
      })
    }
    setDraft('')
    setDraftFiles([])
  }

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[22px] border border-cs-line bg-white shadow-card lg:flex-row">
      <section className="flex w-full shrink-0 flex-col border-b border-cs-line lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-cs-line p-4">
          <div>
            <p className="text-[14px] font-bold text-cs-ink">Queries</p>
            <p className="text-[11px] text-cs-muted">Search a name and start chatting</p>
          </div>
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted" />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
            />
          </label>
        </div>
        <ul className="max-h-[240px] flex-1 overflow-y-auto lg:max-h-none">
          {search.trim() ? (
            directory.length === 0 ? (
              <li className="px-4 py-8 text-center text-[13px] text-cs-muted">
                No matching people
              </li>
            ) : (
              directory.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => openPerson(person.id)}
                    className={`flex w-full gap-3 border-b border-cs-line/60 px-3 py-3 text-left transition-colors hover:bg-[#f7f8fa] ${
                      selectedPersonId === person.id ? 'bg-[#edf7f1]/70' : ''
                    }`}
                  >
                    <img src={avatarFor(person.id, person.name)} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-cs-ink">{person.name}</p>
                      <p className="truncate text-[11px] text-cs-muted">
                        {publicRoleLabel(person, session?.person.role) || person.jobTitle || person.email}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )
          ) : conversations.length === 0 ? (
            <li className="px-4 py-8 text-center text-[13px] text-cs-muted">
              Search a name to start a query
            </li>
          ) : (
            conversations.map((conv) => {
              const person = people.find((p) => p.id === conv.personId)
              const last = conv.threads.at(-1)
              const lastMsg =
                last?.messages?.at(-1)?.body || last?.message || last?.subject || ''
              return (
                <li key={conv.personId}>
                  <button
                    type="button"
                    onClick={() => openPerson(conv.personId)}
                    className={`flex w-full gap-3 border-b border-cs-line/60 px-3 py-3 text-left transition-colors hover:bg-[#f7f8fa] ${
                      selectedPersonId === conv.personId ? 'bg-[#edf7f1]/70' : ''
                    }`}
                  >
                    <img
                      src={avatarFor(conv.personId, person?.name || '')}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-cs-ink">
                          {personName(conv.personId)}
                        </p>
                        <span className="shrink-0 text-[10px] text-cs-muted">
                          {timeLabel(conv.lastAt)}
                        </span>
                      </div>
                      <p className="truncate text-[12px] text-cs-muted">{lastMsg}</p>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </section>

      <section className="flex min-w-0 flex-1 flex-col">
        {!selectedConv ? (
          <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-cs-muted">
            Search or select a person to start chatting
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-cs-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={avatarFor(selectedConv.personId, personName(selectedConv.personId))}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-cs-ink">
                    {personName(selectedConv.personId)}
                  </p>
                  <p className="truncate text-[12px] text-cs-muted">
                    {history.length ? `${history.length} messages` : 'New conversation'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafbfc] p-4">
              {history.length === 0 && (
                <p className="text-center text-[12px] text-cs-muted">
                  Type a message below to start this query
                </p>
              )}
              {history.map((m, index) => {
                const mine = m.senderId === session?.person.id
                const showSubject = index === 0 || history[index - 1].subject !== m.subject
                return (
                  <div key={m.id}>
                    {showSubject && m.subject && m.subject !== 'Chat' && (
                      <p className="mb-2 text-center text-[11px] font-semibold text-cs-muted">
                        {m.subject}
                      </p>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] shadow-sm sm:max-w-[70%] ${
                          mine
                            ? 'rounded-br-md bg-cs-forest text-white'
                            : 'rounded-bl-md bg-white text-cs-ink ring-1 ring-cs-line'
                        }`}
                      >
                        {!mine && (
                          <p className="mb-1 text-[11px] font-semibold text-cs-forest">
                            {m.senderName}
                          </p>
                        )}
                        {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                        <AttachmentList items={m.attachments || []} inverted={mine} />
                        <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-cs-muted'}`}>
                          {timeLabel(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-cs-line p-3">
              <p className="mb-2 truncate text-[12px] text-cs-muted">
                To:{' '}
                <span className="font-semibold text-cs-ink">{personName(selectedConv.personId)}</span>
              </p>
              <AttachmentList
                items={draftFiles}
                onRemove={(id) => setDraftFiles((prev) => prev.filter((f) => f.id !== id))}
              />
              <div className="mt-2 flex min-w-0 gap-2">
                <textarea
                  className={`${inputClass} min-h-[72px] flex-1`}
                  placeholder="Type a message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return
                    const added = await readFiles(e.target.files)
                    setDraftFiles((prev) => [...prev, ...added].slice(0, 5))
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="self-end rounded-xl border border-cs-line px-3 py-2.5 text-cs-forest"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip size={16} />
                </button>
                <PrimaryButton onClick={send} className="self-end">
                  <Send size={15} /> Send
                </PrimaryButton>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
