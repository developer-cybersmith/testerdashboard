import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type FilterOption<T extends string = string> = {
  value: T
  label: string
}

export default function FilterSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel = 'Filter',
}: {
  value: T
  options: FilterOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)?.label || value

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-[#edf7f1] px-3 py-1 text-[12px] font-semibold text-cs-forest transition-colors hover:bg-[#d4edd9]"
      >
        {current} <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-cs-line bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`block w-full px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[#edf7f1] ${
                opt.value === value ? 'bg-[#edf7f1] text-cs-forest' : 'text-cs-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
