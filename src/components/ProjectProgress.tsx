export default function ProjectProgress() {
  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white p-5 shadow-card">
      <h3 className="mb-2 text-[16px] font-semibold text-cs-ink">Project Progress</h3>

      <div className="relative mx-auto mt-2 flex w-full max-w-[220px] flex-1 items-center justify-center">
        <svg viewBox="0 0 200 120" className="w-full">
          <defs>
            <pattern
              id="pendingStripes"
              patternUnits="userSpaceOnUse"
              width="8"
              height="8"
              patternTransform="rotate(-45)"
            >
              <rect width="8" height="8" fill="#eef0f2" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#d1d5db" strokeWidth="3" />
            </pattern>
          </defs>

          {/* Pending (striped) full arc base */}
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#pendingStripes)"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Completed segment ~41% */}
          <path
            d="M20 100 A80 80 0 0 1 112 28"
            fill="none"
            stroke="#0b4f3c"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* In progress accent segment */}
          <path
            d="M112 28 A80 80 0 0 1 138 36"
            fill="none"
            stroke="#7ddea8"
            strokeWidth="18"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 top-6 flex flex-col items-center justify-center text-center">
          <p className="text-[28px] font-bold leading-none text-cs-ink">41%</p>
          <p className="mt-1 text-[12px] font-medium text-cs-muted">Project Ended</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-cs-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cs-forest" />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cs-mint" />
          In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="striped-bar h-2.5 w-2.5 rounded-full" />
          Pending
        </span>
      </div>
    </article>
  )
}
