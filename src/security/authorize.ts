import type { Role } from '../types'

const rank: Record<Role, number> = {
  user: 1,
  tl: 2,
  admin: 3,
  hr: 3,
}

export function isOrgAdmin(role?: Role) {
  return role === 'admin' || role === 'hr'
}

export function isContractStaff(person: { role: Role }) {
  return person.role === 'user' || person.role === 'tl'
}

export function canViewDirectoryPerson(
  viewer: { id: string; role: Role } | undefined,
  target: { id: string; role: Role },
) {
  if (!viewer) return false
  if (viewer.id === target.id) return true
  if (viewer.role === 'user' || viewer.role === 'tl') {
    return target.role !== 'admin' && target.role !== 'hr'
  }
  return true
}

export function canAct(actor: Role | undefined, allowed: Role[]) {
  return !!actor && allowed.includes(actor)
}

export function hasAtLeast(actor: Role | undefined, minimum: Role) {
  return !!actor && rank[actor] >= rank[minimum]
}
