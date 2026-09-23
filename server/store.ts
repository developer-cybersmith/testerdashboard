import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelIntegrations, HistoricalExit, Person } from '../src/types.ts'
import {
  RECORD_COLLECTIONS,
  publicPeople,
  type AppSnapshot,
} from '../src/lib/appSnapshot.ts'

const emptyIntegrations: ChannelIntegrations = {
  slackEnabled: false,
  slackWebhook: '',
  teamsEnabled: false,
  teamsWebhook: '',
}

export async function loadSnapshot(admin: SupabaseClient): Promise<AppSnapshot | null> {
  const { data: peopleRows, error: peopleError } = await admin.from('people').select('id, email, role, payload')
  if (peopleError) throw peopleError
  if (!peopleRows?.length) return null

  const people = peopleRows.map((row) => {
    const payload = (row.payload || {}) as Person
    return {
      ...payload,
      id: row.id as string,
      email: row.email as string,
      role: row.role as Person['role'],
    }
  })

  const { data: records, error: recordsError } = await admin.from('app_records').select('collection, id, payload')
  if (recordsError) throw recordsError

  const grouped: Record<string, unknown[]> = {}
  for (const name of RECORD_COLLECTIONS) grouped[name] = []
  for (const row of records || []) {
    const collection = row.collection as string
    if (!grouped[collection]) grouped[collection] = []
    grouped[collection].push({ ...(row.payload as object), id: row.id })
  }

  const { data: kvRows, error: kvError } = await admin.from('app_kv').select('key, payload')
  if (kvError) throw kvError
  const kv = Object.fromEntries((kvRows || []).map((row) => [row.key, row.payload]))

  return {
    people: publicPeople(people),
    projects: (grouped.projects || []) as AppSnapshot['projects'],
    updates: (grouped.updates || []) as AppSnapshot['updates'],
    queries: (grouped.queries || []) as AppSnapshot['queries'],
    blockers: (grouped.blockers || []) as AppSnapshot['blockers'],
    discussions: (grouped.discussions || []) as AppSnapshot['discussions'],
    notifications: (grouped.notifications || []) as AppSnapshot['notifications'],
    leaveRequests: (grouped.leaveRequests || []) as AppSnapshot['leaveRequests'],
    requirementRequests: (grouped.requirementRequests || []) as AppSnapshot['requirementRequests'],
    projectStatusRequests: (grouped.projectStatusRequests || []) as AppSnapshot['projectStatusRequests'],
    workedDayRequests: (grouped.workedDayRequests || []) as AppSnapshot['workedDayRequests'],
    checklists: (grouped.checklists || []) as AppSnapshot['checklists'],
    reviews: (grouped.reviews || []) as AppSnapshot['reviews'],
    assets: (grouped.assets || []) as AppSnapshot['assets'],
    accessGrants: (grouped.accessGrants || []) as AppSnapshot['accessGrants'],
    payslips: (grouped.payslips || []) as AppSnapshot['payslips'],
    hrTickets: (grouped.hrTickets || []) as AppSnapshot['hrTickets'],
    regularizations: (grouped.regularizations || []) as AppSnapshot['regularizations'],
    roster: (grouped.roster || []) as AppSnapshot['roster'],
    channelPosts: (grouped.channelPosts || []) as AppSnapshot['channelPosts'],
    integrations: (kv.integrations as ChannelIntegrations) || emptyIntegrations,
    historicalExits: (kv.historicalExits as HistoricalExit[]) || [],
  }
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function toE164Phone(value: string) {
  const digits = phoneDigits(value)
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`
  return ''
}

export function samePhone(left: string, right: string) {
  const a = phoneDigits(left)
  const b = phoneDigits(right)
  if (a.length < 10 || b.length < 10) return false
  return a === b || a.endsWith(b) || b.endsWith(a)
}

export async function findPersonByPhone(admin: SupabaseClient, phone: string) {
  const { data, error } = await admin.from('people').select('id, email, role, payload, auth_user_id')
  if (error) throw error
  const row = (data || []).find((item) => samePhone(String((item.payload as Person | null)?.phone || ''), phone))
  if (!row) return null
  const payload = (row.payload || {}) as Person
  return {
    person: publicPeople([
      {
        ...payload,
        id: row.id as string,
        email: row.email as string,
        role: row.role as Person['role'],
      },
    ])[0],
    authUserId: row.auth_user_id as string | null,
  }
}

export async function findPersonByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin
    .from('people')
    .select('id, email, role, payload, auth_user_id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const payload = (data.payload || {}) as Person
  return {
    person: publicPeople([
      {
        ...payload,
        id: data.id as string,
        email: data.email as string,
        role: data.role as Person['role'],
      },
    ])[0],
    authUserId: data.auth_user_id as string | null,
  }
}

export async function saveSnapshot(admin: SupabaseClient, snapshot: AppSnapshot) {
  const peopleRows = snapshot.people.map((person) => ({
    id: person.id,
    email: person.email.toLowerCase(),
    role: person.role,
    payload: { ...person, password: undefined },
    updated_at: new Date().toISOString(),
  }))

  const { error: peopleError } = await admin.from('people').upsert(peopleRows, { onConflict: 'id' })
  if (peopleError) throw peopleError

  for (const collection of RECORD_COLLECTIONS) {
    const rows = (snapshot[collection] as { id?: string }[]).map((item, index) => ({
      collection,
      id: item.id || `${collection}-${index}`,
      payload: item,
      updated_at: new Date().toISOString(),
    }))
    const { error: delError } = await admin.from('app_records').delete().eq('collection', collection)
    if (delError) throw delError
    if (rows.length) {
      const { error: insError } = await admin.from('app_records').insert(rows)
      if (insError) throw insError
    }
  }

  const { error: kvError } = await admin.from('app_kv').upsert(
    [
      {
        key: 'integrations',
        payload: snapshot.integrations,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'historicalExits',
        payload: snapshot.historicalExits,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'key' },
  )
  if (kvError) throw kvError
}

export async function upsertPerson(
  admin: SupabaseClient,
  person: Person,
  authUserId?: string,
) {
  const { error } = await admin.from('people').upsert(
    {
      id: person.id,
      email: person.email.toLowerCase(),
      role: person.role,
      auth_user_id: authUserId || null,
      payload: { ...person, password: undefined },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}
