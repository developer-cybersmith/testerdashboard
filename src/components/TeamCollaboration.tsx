const members = [
  {
    name: 'Alice Johnson',
    task: 'Working on Github Project Repository',
    status: 'Completed',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
  },
  {
    name: 'David Smith',
    task: 'Working on Github Project Repository',
    status: 'In Progress',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face',
  },
  {
    name: 'Sophie Moore',
    task: 'Working on Github Project Repository',
    status: 'Pending',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
  },
  {
    name: 'Jonathan Reed',
    task: 'Working on Github Project Repository',
    status: 'In Progress',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face',
  },
]

const statusStyles: Record<string, string> = {
  Completed: 'bg-[#dcfce7] text-[#15803d]',
  'In Progress': 'bg-[#fef3c7] text-[#b45309]',
  Pending: 'bg-[#fee2e2] text-[#b91c1c]',
}

export default function TeamCollaboration() {
  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Team Collaboration</h3>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-cs-line px-3 py-1.5 text-[12px] font-semibold text-cs-ink transition-colors hover:bg-gray-50"
        >
          + Add Member
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-3.5">
        {members.map((m) => (
          <li key={m.name} className="flex items-center gap-3">
            <img
              src={m.avatar}
              alt={m.name}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-cs-ink">{m.name}</p>
              <p className="truncate text-[11px] text-cs-muted">{m.task}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[m.status]}`}
            >
              {m.status}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
