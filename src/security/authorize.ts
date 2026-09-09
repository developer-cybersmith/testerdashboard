import type { Role } from '../types'

const rank: Record<Role, number> = {
  user: 1,
  tl: 2,
  admin: 3,
}

export function canAct(actor: Role | undefined, allowed: Role[]) {
  return !!actor && allowed.includes(actor)
}

export function hasAtLeast(actor: Role | undefined, minimum: Role) {
  return !!actor && rank[actor] >= rank[minimum]
}
