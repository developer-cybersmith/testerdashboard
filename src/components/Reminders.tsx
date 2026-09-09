import { Video } from 'lucide-react'

export default function Reminders() {
  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white p-5 shadow-card">
      <h3 className="mb-5 text-[16px] font-semibold text-cs-ink">Reminders</h3>

      <div className="mb-auto">
        <p className="mb-1 text-[15px] font-semibold text-cs-ink">Meeting with Arc Company</p>
        <p className="text-[13px] text-cs-muted">Time: 02.00 pm - 04.00 pm</p>
      </div>

      <button
        type="button"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cs-forest py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Video size={18} strokeWidth={2} />
        Start Meeting
      </button>
    </article>
  )
}
