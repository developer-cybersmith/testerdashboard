import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article className={`min-w-0 rounded-[22px] bg-white p-5 shadow-card ${className.includes('overflow-') ? '' : 'overflow-hidden'} ${className}`}>
      {children}
    </article>
  )
}

export function SectionTitle({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-[16px] font-semibold text-cs-ink">{title}</h3>
      {action}
    </div>
  )
}

export function Badge({
  children,
  tone = 'gray',
}: {
  children: ReactNode
  tone?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'forest'
}) {
  const tones = {
    gray: 'bg-gray-100 text-cs-muted',
    green: 'bg-[#dcfce7] text-[#15803d]',
    yellow: 'bg-[#fef3c7] text-[#b45309]',
    red: 'bg-[#fee2e2] text-[#b91c1c]',
    blue: 'bg-[#dbeafe] text-[#1d4ed8]',
    forest: 'bg-[#edf7f1] text-cs-forest',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-cs-forest px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-cs-forest bg-white px-4 py-2.5 text-[13px] font-semibold text-cs-forest transition-colors hover:bg-[#edf7f1] ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold text-cs-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'box-border w-full min-w-0 max-w-full rounded-xl border border-cs-line bg-white px-3 py-2.5 text-[13px] text-cs-ink outline-none focus:border-cs-mint-soft focus:ring-2 focus:ring-cs-sage'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-3 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white p-5 shadow-xl ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-bold text-cs-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cs-line px-2.5 py-1 text-[12px] font-semibold text-cs-muted"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-[13px] text-cs-muted">{text}</p>
}
