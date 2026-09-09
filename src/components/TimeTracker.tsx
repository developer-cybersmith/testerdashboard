import { Pause, Square } from 'lucide-react'

export default function TimeTracker() {
  return (
    <article className="wave-card relative flex h-full flex-col overflow-hidden rounded-[22px] p-5 text-white shadow-card">
      <div className="relative z-10 flex h-full flex-col">
        <h3 className="mb-6 text-[16px] font-semibold text-white/95">Time Tracker</h3>

        <div className="mb-auto flex flex-1 flex-col items-center justify-center">
          <p className="font-mono text-[42px] font-bold tracking-wider tabular-nums">01:24:08</p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-cs-forest shadow-sm transition-transform hover:scale-105"
            aria-label="Pause"
          >
            <Pause size={20} fill="currentColor" />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ef4444] text-white shadow-sm transition-transform hover:scale-105"
            aria-label="Stop"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </div>
    </article>
  )
}
