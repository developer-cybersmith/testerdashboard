const projects = [
  {
    name: 'Develop API Endpoints',
    due: 'Due date: Nov 26, 2024',
    color: 'bg-[#3b82f6]',
    icon: '</>',
  },
  {
    name: 'Onboarding Flow',
    due: 'Due date: Nov 28, 2024',
    color: 'bg-[#f59e0b]',
    icon: '◎',
  },
  {
    name: 'Build Dashboard',
    due: 'Due date: Nov 30, 2024',
    color: 'bg-[#ef4444]',
    icon: '▣',
  },
  {
    name: 'Optimize Page Load',
    due: 'Due date: Dec 5, 2024',
    color: 'bg-[#22c55e]',
    icon: '⚡',
  },
  {
    name: 'Cross-Browser Testing',
    due: 'Due date: Dec 6, 2024',
    color: 'bg-[#a855f7]',
    icon: '◎',
  },
]

export default function ProjectList() {
  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-cs-ink">Project</h3>
        <button
          type="button"
          className="rounded-lg bg-cs-forest px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          + New
        </button>
      </div>

      <ul className="scrollbar-thin flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {projects.map((p) => (
          <li key={p.name} className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white ${p.color}`}
            >
              {p.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-cs-ink">{p.name}</p>
              <p className="text-[11px] text-cs-muted">{p.due}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}
