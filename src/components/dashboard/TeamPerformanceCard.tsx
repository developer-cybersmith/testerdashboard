import { useMemo, useState } from 'react'
import { Card } from '../ui'
import FilterSelect from '../FilterSelect'
import {
  getTeamPerformanceSeries,
  performancePeriodOptions,
  type DashPeriod,
} from '../../data/periodData'

export function TeamPerformanceCard() {
  const [period, setPeriod] = useState<DashPeriod>('last-6-months')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const series = useMemo(() => getTeamPerformanceSeries(period), [period])

  const latest = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : null
  const delta = latest && prev ? +(latest.value - prev.value).toFixed(2) : 0

  const chart = useMemo(() => {
    const w = 320
    const h = 120
    const pad = 8
    if (series.length === 0) return { w, h, pts: [] as { x: number; y: number; month: string; value: number }[], path: '' }
    const values = series.map((p) => p.value)
    const min = Math.min(...values) - 5
    const max = Math.max(...values) + 5
    const pts = series.map((p, i) => {
      const x =
        series.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (series.length - 1)
      const y = h - pad - ((p.value - min) / (max - min || 1)) * (h - pad * 2)
      return { x, y, ...p }
    })
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return { w, h, pts, path }
  }, [series])

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Team Performance</h3>
        <FilterSelect
          value={period}
          options={performancePeriodOptions}
          onChange={(v) => {
            setPeriod(v)
            setHoverIdx(null)
          }}
          ariaLabel="Team performance period"
        />
      </div>

      <div className="mb-3 flex items-end gap-2">
        <p className="text-[28px] font-bold leading-none text-cs-ink">{latest?.value ?? 0}%</p>
        {prev !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              delta >= 0 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          className="h-[140px] w-full"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {chart.path && (
            <path d={chart.path} fill="none" stroke="#0b4f3c" strokeWidth="2.5" />
          )}
          {chart.pts.map((p, i) => (
            <circle
              key={`${p.month}-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 6 : 4}
              fill={hoverIdx === i ? '#0b4f3c' : '#7ddea8'}
              stroke="#fff"
              strokeWidth="2"
              onMouseEnter={() => setHoverIdx(i)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        {hoverIdx !== null && chart.pts[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-white px-3 py-2 text-[12px] shadow-lg ring-1 ring-black/5"
            style={{
              left: `${(chart.pts[hoverIdx].x / chart.w) * 100}%`,
              top: `${(chart.pts[hoverIdx].y / chart.h) * 100}%`,
              marginTop: -8,
            }}
          >
            <p className="font-semibold text-cs-ink">{chart.pts[hoverIdx].month}</p>
            <p className="text-cs-forest">{chart.pts[hoverIdx].value}%</p>
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-white" />
          </div>
        )}
      </div>
    </Card>
  )
}
