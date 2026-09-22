import { createAdminClient, resolveEnv } from '@supabase/server/core'
import { people as staff } from '../src/data/staff.ts'
import { findPersonByEmail, upsertPerson } from './store.ts'

const DEMO_PASSWORD = 'Secure@2026'

async function authUsersByEmail(admin: ReturnType<typeof createAdminClient>) {
  const found = new Map<string, { id: string; confirmed: boolean }>()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users) {
      if (!user.email) continue
      found.set(user.email.toLowerCase(), {
        id: user.id,
        confirmed: Boolean(user.email_confirmed_at),
      })
    }
    if (data.users.length < 200) return found
    page += 1
  }
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
}
