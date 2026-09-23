import { createAdminClient, resolveEnv } from '@supabase/server/core'
import { people as staff } from '../src/data/staff.ts'
import { defaultLeaveBalance } from '../src/hr/peopleOps.ts'
import type { Person, Role } from '../src/types.ts'
import { findPersonByEmail, upsertPerson } from './store.ts'

const COMPANY_DOMAIN = 'cybersmithsecure.com'

const DEMO_PASSWORD = 'Secure@2026'

type AuthAccount = {
  id: string
  confirmed: boolean
  meta: Record<string, unknown>
}

async function authUsersByEmail(admin: ReturnType<typeof createAdminClient>) {
  const found = new Map<string, AuthAccount>()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users) {
      if (!user.email) continue
      found.set(user.email.toLowerCase(), {
        id: user.id,
        confirmed: Boolean(user.email_confirmed_at),
        meta: (user.user_metadata || {}) as Record<string, unknown>,
      })
    }
    if (data.users.length < 200) return found
    page += 1
  }
}

function roleFromMeta(value: unknown): Role {
  if (value === 'admin' || value === 'hr' || value === 'tl' || value === 'user') return value
  return 'user'
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] || 'Employee'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function personFromAuth(email: string, auth: AuthAccount): Person {
  const metaName = typeof auth.meta.name === 'string' ? auth.meta.name.trim() : ''
  const name = metaName || nameFromEmail(email)
  const id =
    typeof auth.meta.person_id === 'string' && auth.meta.person_id.trim()
      ? auth.meta.person_id.trim()
      : `user-${auth.id}`
  const today = new Date().toISOString().slice(0, 10)
  return {
    id,
    name,
    email,
    role: roleFromMeta(auth.meta.role),
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0b4f3c&color=fff`,
    avatarUploaded: false,
    status: 'active',
    employmentType: 'Full-Time',
    joinDate: today,
    lifecycleStatus: 'onboarding',
    mustChangePassword: true,
    shiftId: 'shift-general',
    department: 'VAPT',
    leaveBalance: defaultLeaveBalance(),
    skills: [],
    documents: [],
    notes: [],
  }
}

/** Add a people row for every company login that is missing from the employee table. */
export async function syncAuthUsersIntoPeople() {
  const env = resolveEnv()
  if (env.error || !env.data || !Object.keys(env.data.secretKeys || {}).length) return 0

  const admin = createAdminClient()
  const existing = await authUsersByEmail(admin)
  let added = 0
  for (const [email, auth] of existing) {
    if (!email.endsWith(`@${COMPANY_DOMAIN}`)) continue
    const row = await findPersonByEmail(admin, email)
    if (!row) {
      await upsertPerson(admin, personFromAuth(email, auth), auth.id)
      added += 1
      console.log(`stored missing employee record for ${email}`)
      continue
    }
    if (row.authUserId !== auth.id) {
      await upsertPerson(admin, row.person, auth.id)
    }
  }
  return added
}

/** Create the three staff logins when the secret key is present. Does not reset a password that already works. */
export async function ensureStaffAccounts() {
  const env = resolveEnv()
  if (env.error || !env.data || !Object.keys(env.data.secretKeys || {}).length) return

  const admin = createAdminClient()
  const existing = await authUsersByEmail(admin)

  for (const person of staff) {
    const email = person.email.toLowerCase()
    const auth = existing.get(email)
    let authUserId = auth?.id

    if (!auth) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: person.password || DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { person_id: person.id, role: person.role },
      })
      if (error) throw error
      authUserId = data.user?.id
      console.log(`created database login for ${email}`)
    } else if (!auth.confirmed) {
      const { error } = await admin.auth.admin.updateUserById(auth.id, { email_confirm: true })
      if (error) throw error
      console.log(`confirmed database login for ${email}`)
    }

    const row = await findPersonByEmail(admin, email)
    if (!row) {
      await upsertPerson(admin, person, authUserId)
      console.log(`stored employee record for ${email}`)
    } else if (authUserId && row.authUserId !== authUserId) {
      await upsertPerson(admin, row.person, authUserId)
    }
  }

  await syncAuthUsersIntoPeople()
}
