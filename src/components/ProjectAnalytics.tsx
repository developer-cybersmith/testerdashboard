import { useState } from 'react'
import FilterSelect from './FilterSelect'

type AnalyticsRange = 'daily' | 'weekly' | 'monthly'

const barsByRange: Record<
  AnalyticsRange,
  { day: string; height: number; type: string; tooltip?: string }[]
> = {
  daily: [
    { day: '9a', height: 35, type: 'solid-mint' },
    { day: '11a', height: 58, type: 'solid-forest' },
    { day: '1p', height: 82, type: 'solid-mint', tooltip: '82%' },
    { day: '3p', height: 48, type: 'striped' },
    { day: '5p', height: 70, type: 'solid-forest' },
    { day: '7p', height: 40, type: 'striped' },
  ],
  weekly: [
    { day: 'S', height: 42, type: 'solid-mint' },
    { day: 'M', height: 68, type: 'solid-forest' },
    { day: 'T', height: 92, type: 'solid-mint', tooltip: '78%' },
    { day: 'W', height: 55, type: 'striped' },
    { day: 'T', height: 78, type: 'solid-forest' },
    { day: 'F', height: 48, type: 'striped' },
    { day: 'S', height: 62, type: 'solid-mint' },
  ],
  monthly: [
    { day: 'W1', height: 50, type: 'solid-mint' },
    { day: 'W2', height: 72, type: 'solid-forest', tooltip: '72%' },
    { day: 'W3', height: 64, type: 'striped' },
    { day: 'W4', height: 88, type: 'solid-mint' },
  ],
}

export default function ProjectAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>('weekly')
  const bars = barsByRange[range]

  return (
    <article className="flex h-full flex-col rounded-[22px] bg-white p-5 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-cs-ink">Project Analytics</h3>
        <FilterSelect
          value={range}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
          onChange={setRange}
          ariaLabel="Analytics range"
        />
      </div>

      <div className="flex h-[180px] flex-1 items-end justify-between gap-2 px-1 pb-1 pt-8">
        {bars.map((bar, i) => (
          <div
            key={`${bar.day}-${i}`}
            className="relative flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            {bar.tooltip && (
              <div className="absolute bottom-[calc(100%+6px)] rounded-md bg-cs-ink px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                {bar.tooltip}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-cs-ink" />
              </div>
            )}
            <div
              className={`w-full max-w-[28px] rounded-full ${
                bar.type === 'solid-mint'
                  ? 'bg-cs-mint'
                  : bar.type === 'solid-forest'
                    ? 'bg-cs-forest'
                    : 'striped-bar'
              }`}
              style={{ height: `${bar.height}%` }}
            />
            <span className="text-[12px] font-medium text-cs-muted">{bar.day}</span>
          </div>
        ))}
      </div>
    </article>
  )
}
