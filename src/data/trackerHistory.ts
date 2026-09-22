import type { DailyUpdate, Person } from '../types'

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function unit(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function eachDate(from: string, to: string) {
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (cursor <= end) {
    dates.push(iso(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

const PROJECT_BY_USER: Record<string, string> = {
  'admin-2': 'proj-101',
  'admin-1': 'proj-102',
}

/**
 * Fills weekday tracker logs from 2026-01-01 (or join) through 2026-09-19
 * so profile graphs have real daily attendance + hours. Existing hand-written
 * updates for a person+date+slot are left untouched.
 */
export function buildTrackerHistory(people: Person[], existing: DailyUpdate[]): DailyUpdate[] {
  const taken = new Set(existing.map((u) => `${u.userId}|${u.date}|${u.slot || ''}`))
  const extra: DailyUpdate[] = []
  let n = 0

  people
    .filter((p) => p.role === 'user' || p.role === 'tl')
    .forEach((person) => {
      const from = person.joinDate && person.joinDate > '2026-01-01' ? person.joinDate : '2026-01-01'
      const cap = person.exitDate && person.exitDate < '2026-09-19' ? person.exitDate : '2026-09-19'
      if (from > cap) return
      const projectId = PROJECT_BY_USER[person.id] || 'proj-101'
      eachDate(from, cap).forEach((date) => {
        const day = new Date(`${date}T00:00:00`).getDay()
        if (day === 0) return
        if (day === 6) return
        const r = unit(`${person.id}:${date}:live`)
        if (r < 0.08) return
        const half = r < 0.18
        const morningKey = `${person.id}|${date}|morning`
        if (!taken.has(morningKey)) {
          n += 1
          extra.push({
            id: `upd-hist-${n}`,
            projectId,
            userId: person.id,
            userName: person.name,
            date,
            submittedAt: `${date}T10:12:00`,
            workDone: half ? 'Morning slot only — wrap-up pending.' : 'Daily testing progress logged.',
            workPoints: half
              ? ['Morning recon and notes']
              : ['Daily testing progress', 'Evidence updated', 'Synced status with the team'],
            hoursSpent: half ? 3.5 : 6 + (r * 1.5),
            slot: 'morning',
          })
          taken.add(morningKey)
        }
        if (!half) {
          const eveningKey = `${person.id}|${date}|evening`
          if (!taken.has(eveningKey)) {
            n += 1
            extra.push({
              id: `upd-hist-${n}`,
              projectId,
              userId: person.id,
              userName: person.name,
              date,
              submittedAt: `${date}T19:08:00`,
              workDone: 'Evening wrap-up of the day’s testing.',
              workPoints: ['Closed remaining cases', 'Updated tracker hours'],
              hoursSpent: 1.5 + r,
              slot: 'evening',
            })
            taken.add(eveningKey)
          }
        }
      })
    })

  return extra
}
