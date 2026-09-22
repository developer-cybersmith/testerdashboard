import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import type { Project, TaskTrack } from '../../types'
import { Card } from '../ui'
import FilterSelect from '../FilterSelect'
import {
  getTaskTrackForPeriod,
  trackPeriodOptions,
  type DashPeriod,
} from '../../data/periodData'

function TickBar({ percent, color }: { percent: number; color: string }) {
  const ticks = 40
  const filled = Math.round((percent / 100) * ticks)
  return (
    <div className="flex h-5 items-end gap-[2px]">
      {Array.from({ length: ticks }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: '100%',
            background: i < filled ? color : '#e5e7eb',
            opacity: i < filled ? 1 : 0.7,
          }}
        />
      ))}
    </div>
  )
}

function StatusPopup({
  track,
  title,
  anchor,
}: {
  track: TaskTrack
  title: string
  anchor: HTMLElement
}) {
  const popupRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; below: boolean } | null>(null)
  const total = track.todo + track.inProgress + track.done || 1
  const rows = [
    {
      label: 'To Do',
      count: track.todo,
      color: '#f5c542',
      pct: Math.round((track.todo / total) * 100),
    },
    {
      label: 'In Progress',
      count: track.inProgress,
      color: '#14b8a6',
      pct: Math.round((track.inProgress / total) * 100),
    },
    {
      label: 'Done',
      count: track.done,
      color: '#0b4f3c',
      pct: Math.round((track.done / total) * 100),
    },
  ]

  useLayoutEffect(() => {
    const place = () => {
      const popup = popupRef.current
      const rect = anchor.getBoundingClientRect()
      const width = popup?.offsetWidth || 220
      const height = popup?.offsetHeight || 148
      const gap = 10
      const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 8
      const fitsAbove = rect.top - gap - height >= 8
      const below = fitsBelow || !fitsAbove
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - 8,
      )
      const top = below
        ? Math.min(rect.bottom + gap, window.innerHeight - height - 8)
        : Math.max(8, rect.top - height - gap)
      setCoords({ top, left, below })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor, track, title])

  return createPortal(
    <div
      ref={popupRef}
      className="pointer-events-none fixed z-[80] w-[220px] rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5"
      style={
        coords
          ? { top: coords.top, left: coords.left }
          : { top: 0, left: 0, visibility: 'hidden' }
      }
    >
      <p className="mb-2 text-[12px] font-bold text-cs-ink">{title}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-cs-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="text-cs-muted">
                {r.count} · {r.pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${r.pct}%`, background: r.color }}
              />
            </div>
          </li>
        ))}
      </ul>
      <span
        className={`absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent ${
          coords?.below ? 'bottom-full border-b-white' : 'top-full border-t-white'
        }`}
      />
    </div>,
    document.body,
  )
}

function trackPercent(track: TaskTrack) {
  const total = track.todo + track.inProgress + track.done
  if (!total) return 0
  return Math.round((track.done / total) * 100)
}

const rowColors = ['#2dd4bf', '#0b4f3c', '#9ca3af', '#f5c542', '#14b8a6']

function usePeriodProjects(period: DashPeriod) {
  const { activeProjects } = useApp()
  return useMemo(
    () =>
      activeProjects.map((p) => ({
        ...p,
        taskTrack: getTaskTrackForPeriod(p.id, p.taskTrack, period),
      })),
    [activeProjects, period],
  )
}

export function ProjectTrackCard() {
  const [period, setPeriod] = useState<DashPeriod>('this-month')
  const [hovered, setHovered] = useState<{ id: string; el: HTMLElement } | null>(null)
  const projects = usePeriodProjects(period)

  return (
    <Card className="overflow-visible">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Project Track</h3>
        <FilterSelect
          value={period}
          options={trackPeriodOptions}
          onChange={setPeriod}
          ariaLabel="Project track period"
        />
      </div>

      {projects.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-cs-muted">No running projects.</p>
      ) : (
        <ul className="space-y-5">
          {projects.map((p, idx) => {
            const pct = trackPercent(p.taskTrack)
            const color = rowColors[idx % rowColors.length]
            const total =
              p.taskTrack.todo + p.taskTrack.inProgress + p.taskTrack.done
            return (
              <li
                key={p.id}
                className="relative"
                onMouseEnter={(e) => setHovered({ id: p.id, el: e.currentTarget })}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered?.id === p.id && (
                  <StatusPopup track={p.taskTrack} title={p.name} anchor={hovered.el} />
                )}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-cs-ink">{p.name}</p>
                  <p className="text-[12px] font-semibold text-cs-muted">
                    {p.taskTrack.done}/{total} · {pct}%
                  </p>
                </div>
                <TickBar percent={pct} color={color} />
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function TaskOverviewCard() {
  const [period, setPeriod] = useState<DashPeriod>('this-month')
  const [hovered, setHovered] = useState<{ id: string; el: HTMLElement } | null>(null)
  const projects = usePeriodProjects(period)

  const summary = projects.reduce(
    (acc, p) => {
      acc.todo += p.taskTrack.todo
      acc.inProgress += p.taskTrack.inProgress
      acc.done += p.taskTrack.done
      return acc
    },
    { todo: 0, inProgress: 0, done: 0 },
  )
  const total = summary.todo + summary.inProgress + summary.done

  return (
    <Card className="overflow-visible">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-cs-ink">Task Overview</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-[12px] font-semibold text-cs-forest">
            {total} tasks
          </span>
          <FilterSelect
            value={period}
            options={trackPeriodOptions}
            onChange={setPeriod}
            ariaLabel="Task overview period"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-cs-muted">
          No tasks yet. Overview fills in when projects and daily work exist.
        </p>
      ) : (
        <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: 'To Do', count: summary.todo, color: '#f5c542' },
          { label: 'In Progress', count: summary.inProgress, color: '#14b8a6' },
          { label: 'Done', count: summary.done, color: '#0b4f3c' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#f7f8fa] px-3 py-3 text-center">
            <p className="text-[20px] font-bold text-cs-ink">{s.count}</p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-cs-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {projects.map((p: Project) => {
          const t = p.taskTrack.todo + p.taskTrack.inProgress + p.taskTrack.done || 1
          return (
            <li
              key={p.id}
              className="relative rounded-xl border border-cs-line px-3 py-2.5 transition-colors hover:bg-[#f7f8fa]"
              onMouseEnter={(e) => setHovered({ id: p.id, el: e.currentTarget })}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered?.id === p.id && (
                <StatusPopup track={p.taskTrack} title={`${p.name} status`} anchor={hovered.el} />
              )}
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-cs-ink">{p.name}</p>
                <p className="text-[11px] text-cs-muted">{trackPercent(p.taskTrack)}% done</p>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full">
                <div
                  style={{
                    width: `${(p.taskTrack.done / t) * 100}%`,
                    background: '#0b4f3c',
                  }}
                />
                <div
                  style={{
                    width: `${(p.taskTrack.inProgress / t) * 100}%`,
                    background: '#14b8a6',
                  }}
                />
                <div
                  style={{
                    width: `${(p.taskTrack.todo / t) * 100}%`,
                    background: '#f5c542',
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
        </>
      )}
    </Card>
  )
}
