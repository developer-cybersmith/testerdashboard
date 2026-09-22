import './env.ts'
import { createAdminClient, resolveEnv } from '@supabase/server/core'
import {
  initialBlockers,
  initialDiscussions,
  initialLeaveRequests,
  initialNotifications,
  initialProjects,
  initialQueries,
  initialRequirementRequests,
  initialUpdates,
  people as initialPeople,
} from '../src/data/mockData.ts'
import {
  historicalExits,
  initialAccessGrants,
  initialAssets,
  initialChannelPosts,
  initialChecklists,
  initialHrTickets,
  initialIntegrations,
  initialPayslips,
  initialRegularizations,
  initialReviews,
  initialRoster,
} from '../src/data/hrSeed.ts'
import { saveSnapshot, upsertPerson } from './store.ts'
import { publicPeople, type AppSnapshot } from '../src/lib/appSnapshot.ts'

const DEMO_PASSWORD = 'Secure@2026'

async function findAuthUserId(admin: ReturnType<typeof createAdminClient>, email: string) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (data.users.length < 200) return null
    page += 1
  }
}

async function provisionAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  password: string,
  metadata: { person_id: string; role: string },
) {
  const existing = await findAuthUserId(admin, email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw error
    return existing
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error
  return data.user?.id || null
}

async function main() {
  const env = resolveEnv()
  if (env.error || !env.data || !Object.keys(env.data.secretKeys || {}).length) {
    throw new Error(
      'SUPABASE_SECRET_KEY is empty in .env. Paste the full secret key from Supabase API Keys, restart the API, then run npm run seed.',
    )
  }
  const admin = createAdminClient()
  const snapshot: AppSnapshot = {
    people: publicPeople(initialPeople),
    projects: initialProjects,
    updates: initialUpdates,
    queries: initialQueries,
    blockers: initialBlockers,
    discussions: initialDiscussions,
    notifications: initialNotifications,
    leaveRequests: initialLeaveRequests,
    requirementRequests: initialRequirementRequests,
    projectStatusRequests: [],
    workedDayRequests: [],
    checklists: initialChecklists,
    reviews: initialReviews,
    assets: initialAssets,
    accessGrants: initialAccessGrants,
    payslips: initialPayslips,
    hrTickets: initialHrTickets,
    regularizations: initialRegularizations,
    roster: initialRoster,
    integrations: initialIntegrations,
    channelPosts: initialChannelPosts,
    historicalExits,
  }

  await saveSnapshot(admin, snapshot)

  for (const person of initialPeople) {
    const password = person.password || DEMO_PASSWORD
    const authUserId = await provisionAuthUser(admin, person.email, password, {
      person_id: person.id,
      role: person.role,
    })
    if (authUserId) await upsertPerson(admin, person, authUserId)
    console.log(`seeded ${person.email}`)
  }

  console.log(`Seeded ${snapshot.people.length} people and dashboard collections.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
