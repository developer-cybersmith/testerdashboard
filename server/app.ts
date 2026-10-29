import { resolveEnv } from '@supabase/server/core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { AuthError } from '@supabase/server'
import type { SupabaseContext } from '@supabase/server'
import { getAdminClient, getPublishableClient, getSecretKey } from './supabaseAdmin.ts'
import type { Person } from '../src/types.ts'
import {
  BOOTSTRAP_CACHE_KEY,
  SESSION_CACHE_PREFIX,
  clearLoginFailures,
  loginLocked,
  recordLoginFailure,
  redisDel,
  redisPing,
  redisSet,
} from './redis.ts'
import { createMiddleware } from 'hono/factory'
import { people as staff } from '../src/data/staff.ts'
import {
  azureConfigured,
  createAzureAuthUrl,
  exchangeAzureCode,
  issueAzureSessionToken,
  peekAzureState,
  verifyAzureSessionToken,
} from './azureAuth.ts'
import { syncAuthUsersIntoPeople } from './ensureStaff.ts'
import { findPersonByEmail, loadSnapshot, saveSnapshot, upsertPerson } from './store.ts'
import { publicPeople, type AppSnapshot } from '../src/lib/appSnapshot.ts'

type Env = {
  Variables: {
    supabaseContext: SupabaseContext
  }
}

const COMPANY_DOMAIN = 'cybersmithsecure.com'

function firstConfigured(record?: Record<string, string>) {
  if (!record) return ''
  return Object.values(record).find((value) => value.trim()) || ''
}

/** Live process env. The values in .env.example are placeholders and are not used. */
export function supabaseProcessEnv() {
  const resolved = resolveEnv()
  const supabaseUrl = (process.env.SUPABASE_URL || resolved.data?.url || '').trim()
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    firstConfigured(resolved.data?.publishableKeys as Record<string, string> | undefined) ||
    ''
  ).trim()
  const hasSecret = Boolean(getSecretKey())
  return { supabaseUrl, publishableKey, hasSecret }
}

function secretConfigured() {
  return supabaseProcessEnv().hasSecret
}

function normalizeCompanyEmail(raw: string) {
  const value = raw.trim().toLowerCase()
  if (!value) return ''
  if (value.includes('@')) {
    return value.endsWith(`@${COMPANY_DOMAIN}`) ? value : ''
  }
  return `${value}@${COMPANY_DOMAIN}`
}

function closedAccount(person: Person) {
  return person.status === 'inactive' || person.lifecycleStatus === 'exited'
}

async function cachedBootstrap(userClient: SupabaseContext['supabase']) {
  const reader = secretConfigured() ? getAdminClient() : userClient
  if (secretConfigured()) {
    const added = await syncAuthUsersIntoPeople()
    if (added > 0) await redisDel(BOOTSTRAP_CACHE_KEY)
  }
  return loadSnapshot(reader)
}

async function cachePerson(person: Person) {
  await redisSet(`${SESSION_CACHE_PREFIX}${person.id}`, JSON.stringify(person), 900)
}

export const app = new Hono<Env>()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: ['Authorization', 'apikey', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  }),
)

app.onError((err, c) => {
  if (err instanceof HTTPException && err.cause instanceof AuthError) {
    const authError = err.cause
    if (authError.code === 'MISSING_DEFAULT_SECRET_KEY') {
      return c.json(
        {
          message:
            'Add SUPABASE_SECRET_KEY on the server before employee records can be read.',
        },
        503,
      )
    }
    return c.json({ message: authError.message, code: authError.code }, authError.status as 401 | 500)
  }
  console.error(err)
  return c.json({ message: err instanceof Error ? err.message : 'Internal server error' }, 500)
})

app.get('/api/config', (c) => {
  const env = supabaseProcessEnv()
  return c.json({
    supabaseUrl: env.supabaseUrl,
    publishableKey: env.publishableKey,
    canStore: env.hasSecret,
    azureEnabled: azureConfigured(),
  })
})

app.get('/api/health', async (c) => {
  const env = supabaseProcessEnv()
  return c.json({
    ok: Boolean(env.supabaseUrl),
    redis: await redisPing(),
    azure: azureConfigured() ? 'configured' : 'missing',
    supabase: env.supabaseUrl || 'missing SUPABASE_URL',
    hasSecret: env.hasSecret,
    time: new Date().toISOString(),
  })
})

async function resolveEmployeeByEmail(email: string) {
  if (secretConfigured()) {
    try {
      const found = await findPersonByEmail(getAdminClient(), email)
      if (found) return found.person
    } catch {
      /* try the next reader */
    }
  }
  const fromStaff = staff.find((p) => p.email.toLowerCase() === email)
  return fromStaff ? publicPeople([fromStaff])[0] : null
}

const allowAzureOrUser = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (token.startsWith('azs1.')) {
    const verified = verifyAzureSessionToken(token)
    if (!verified) return c.json({ message: 'Session expired. Please sign in again.' }, 401)
    const claims = {
      email: verified.email,
      sub: verified.sub,
      role: verified.role,
    } as SupabaseContext['userClaims']
    if (secretConfigured()) {
      const admin = getAdminClient()
      c.set('supabaseContext', {
        supabase: admin,
        supabaseAdmin: admin,
        userClaims: claims,
        jwtClaims: null,
        authMode: 'user',
        authKeyName: undefined,
      })
    } else {
      c.set('supabaseContext', {
        supabase: undefined as unknown as SupabaseContext['supabase'],
        supabaseAdmin: undefined as unknown as SupabaseContext['supabaseAdmin'],
        userClaims: claims,
        jwtClaims: null,
        authMode: 'user',
        authKeyName: undefined,
      })
    }
    await next()
    return
  }
  if (!token) return c.json({ message: 'Unauthorized' }, 401)
  const { data, error } = await getPublishableClient().auth.getUser(token)
  if (error || !data.user?.email) {
    return c.json({ message: 'Session expired. Please sign in again.' }, 401)
  }
  const admin = secretConfigured() ? getAdminClient() : getPublishableClient()
  c.set('supabaseContext', {
    supabase: admin,
    supabaseAdmin: admin,
    userClaims: {
      email: data.user.email,
      sub: data.user.id,
      role: typeof data.user.user_metadata?.role === 'string' ? data.user.user_metadata.role : undefined,
    } as SupabaseContext['userClaims'],
    jwtClaims: null,
    authMode: 'user',
    authKeyName: undefined,
  })
  await next()
})

app.get('/api/auth/azure/start', async (c) => {
  const origin =
    c.req.query('origin') ||
    c.req.header('origin') ||
    new URL(c.req.url).origin ||
    'http://localhost:5173'
  try {
    const result = await createAzureAuthUrl(origin)
    return c.json(result)
  } catch (err) {
    return c.json(
      { message: err instanceof Error ? err.message : 'Could not start Microsoft sign-in' },
      503,
    )
  }
})

app.get('/api/auth/callback', async (c) => {
  const code = (c.req.query('code') || '').trim()
  const state = (c.req.query('state') || '').trim()
  const error = (c.req.query('error_description') || c.req.query('error') || '').trim()
  const pending = state ? await peekAzureState(state) : null
  const returnOrigin = pending?.returnOrigin || 'http://localhost:5173'
  if (error) {
    return c.redirect(`${returnOrigin}/?azure_error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return c.redirect(`${returnOrigin}/?azure_error=${encodeURIComponent('Missing authorization code from Azure.')}`)
  }
  return c.redirect(
    `${returnOrigin}/?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  )
})

app.post('/api/auth/azure/exchange', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string; state?: string }
  const code = (body.code || '').trim()
  const state = (body.state || '').trim()
  if (!code || !state) {
    return c.json({ message: 'Authorization code and state are required' }, 400)
  }
  let azureUser: Awaited<ReturnType<typeof exchangeAzureCode>>
  try {
    azureUser = await exchangeAzureCode(code, state)
  } catch (err) {
    return c.json(
      { message: err instanceof Error ? err.message : 'Azure sign-in failed' },
      401,
    )
  }

  const email = normalizeCompanyEmail(azureUser.email)
  if (!email) {
    return c.json(
      { message: `Sign in with a company account ending with @${COMPANY_DOMAIN}` },
      403,
    )
  }

  const person = await resolveEmployeeByEmail(email)
  if (!person) {
    return c.json(
      {
        message:
          'This company email is not on an employee record. Ask HR to create the account first, then sign in with Microsoft.',
      },
      403,
    )
  }

  if (closedAccount(person)) {
    return c.json(
      { message: 'This account is closed. The employee record stays in Employees for HR records.' },
      403,
    )
  }

  let snapshot: AppSnapshot | null = null
  try {
    if (secretConfigured()) snapshot = await cachedBootstrap(getAdminClient())
  } catch {
    snapshot = null
  }
  if (snapshot) {
    const fresh = snapshot.people.find((p) => p.email.toLowerCase() === email)
    if (fresh) {
      await clearLoginFailures(email)
      await cachePerson(fresh)
      return c.json({
        accessToken: issueAzureSessionToken({
          email,
          name: fresh.name,
          sub: fresh.id,
          role: fresh.role,
        }),
        refreshToken: 'azure',
        person: fresh,
        snapshot,
      })
    }
  }

  await clearLoginFailures(email)
  await cachePerson(person)
  const accessToken = issueAzureSessionToken({
    email,
    name: person.name,
    sub: person.id,
    role: person.role,
  })
  return c.json({
    accessToken,
    refreshToken: 'azure',
    person,
    snapshot,
  })
})

app.post('/api/auth/forgot', async (c) => {
  const supabase = getPublishableClient()
  const body = (await c.req.json().catch(() => ({}))) as { email?: string }
  const email = normalizeCompanyEmail(body.email || '')
  if (!email) {
    return c.json({ message: `Use a company email ending with @${COMPANY_DOMAIN}` }, 400)
  }
  const origin = c.req.header('origin') || 'http://localhost:5173'
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: origin })
  if (error) return c.json({ message: error.message }, 400)
  return c.json({ ok: true })
})

app.post('/api/auth/login', async (c) => {
  const supabase = getPublishableClient()
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string }
  const email = normalizeCompanyEmail(body.email || '')
  const password = (body.password || '').trim()
  if (!email) {
    return c.json({ message: `Use a company email ending with @${COMPANY_DOMAIN}` }, 400)
  }

  const wait = await loginLocked(email)
  if (wait) {
    return c.json({ message: `Too many failed sign-ins. Try again in ${wait}s` }, 429)
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    const fail = await recordLoginFailure(email)
    if (fail.locked) {
      return c.json({ message: `Too many failed sign-ins. Try again in ${fail.wait}s` }, 429)
    }
    return c.json({ message: 'Invalid email or password' }, 401)
  }

  let found = null as Awaited<ReturnType<typeof findPersonByEmail>>
  try {
    found = await findPersonByEmail(secretConfigured() ? getAdminClient() : supabase, email)
  } catch (err) {
    return c.json(
      {
        message:
          err instanceof Error
            ? err.message
            : 'Could not read employee records. Add SUPABASE_SECRET_KEY and run the SQL migration.',
      },
      503,
    )
  }
  if (!found) {
    return c.json({ message: 'Employee record not found. Ask HR to create this account first.' }, 404)
  }
  if (closedAccount(found.person)) {
    return c.json(
      { message: 'This account is closed. The employee record stays in Employees for HR records.' },
      403,
    )
  }

  await clearLoginFailures(email)
  await cachePerson(found.person)
  let snapshot = null
  try {
    snapshot = await cachedBootstrap(secretConfigured() ? getAdminClient() : supabase)
  } catch {
    snapshot = null
  }
  return c.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    person: found.person,
    snapshot,
  })
})

app.get('/api/bootstrap', allowAzureOrUser, async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const azureUser = rawToken.startsWith('azs1.') ? verifyAzureSessionToken(rawToken) : null
  const email = (c.var.supabaseContext?.userClaims?.email || azureUser?.email || '').toLowerCase()
  const stored = email ? await resolveEmployeeByEmail(email) : null

  if (azureUser && !secretConfigured()) {
    if (!stored) return c.json({ message: 'Employee record not found. Ask HR to create this account.' }, 404)
    return c.json({ person: stored, snapshot: null })
  }

  const { supabase, supabaseAdmin } = c.var.supabaseContext
  let snapshot = null
  try {
    snapshot = await cachedBootstrap(supabase)
  } catch {
    snapshot = secretConfigured() ? await cachedBootstrap(supabaseAdmin) : null
  }
  if (!snapshot) {
    return c.json({ message: 'Database is empty. Run npm run seed after applying the SQL migration.' }, 404)
  }
  const person =
    (email && snapshot.people.find((p) => p.email.toLowerCase() === email)) || stored || undefined
  if (person) await cachePerson(person)
  return c.json({ person: person || null, snapshot })
})

app.put('/api/snapshot', allowAzureOrUser, async (c) => {
  const ctx = c.var.supabaseContext
  const snapshot = (await c.req.json()) as AppSnapshot
  if (!snapshot?.people?.length) {
    return c.json({ message: 'Snapshot is missing people' }, 400)
  }
  snapshot.people = publicPeople(snapshot.people)
  if (!secretConfigured()) {
    return c.json(
      {
        message:
          'Add SUPABASE_SECRET_KEY to .env and restart the API. Testers, team leaders, and dashboard data cannot be stored until that key is set.',
      },
      503,
    )
  }
  try {
    await saveSnapshot(ctx.supabaseAdmin, snapshot)
  } catch (err) {
    try {
      await saveSnapshot(ctx.supabase, snapshot)
    } catch {
      const message = err instanceof Error ? err.message : 'Could not save to the database'
      return c.json({ message }, 500)
    }
  }
  await redisDel(BOOTSTRAP_CACHE_KEY)
  return c.json({ ok: true })
})

app.post('/api/employees/provision', allowAzureOrUser, async (c) => {
  const ctx = c.var.supabaseContext
  const callerEmail = ctx.userClaims?.email?.toLowerCase()
  if (!callerEmail) return c.json({ message: 'Unauthorized' }, 401)
  if (!secretConfigured()) {
    return c.json(
      {
        message:
          'Add SUPABASE_SECRET_KEY to .env and restart the API before adding testers or team leaders.',
      },
      503,
    )
  }
  let caller = null as Awaited<ReturnType<typeof findPersonByEmail>>
  try {
    caller = await findPersonByEmail(ctx.supabase, callerEmail)
  } catch {
    caller = null
  }
  if (!caller) caller = await findPersonByEmail(ctx.supabaseAdmin, callerEmail)
  if (!caller || caller.person.role !== 'hr') {
    return c.json({ message: 'Only HR can register employees' }, 403)
  }
  const body = (await c.req.json()) as { person?: Person; password?: string }
  if (!body.person?.email || !body.password) {
    return c.json({ message: 'Person and password are required' }, 400)
  }
  const admin = getAdminClient()
  const email = body.person.email.toLowerCase()
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listError) return c.json({ message: listError.message }, 400)
  const existing = listed.users.find((user) => user.email?.toLowerCase() === email)
  let authUserId = existing?.id
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: body.password,
      email_confirm: true,
      user_metadata: { person_id: body.person.id, role: body.person.role },
    })
    if (error) return c.json({ message: error.message }, 400)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { person_id: body.person.id, role: body.person.role },
    })
    if (error) return c.json({ message: error.message }, 400)
    authUserId = data.user?.id
  }
  await upsertPerson(admin, body.person, authUserId)
  await redisDel(BOOTSTRAP_CACHE_KEY)
  return c.json({ ok: true, authUserId })
})

app.post('/api/auth/password', allowAzureOrUser, async (c) => {
  const ctx = c.var.supabaseContext
  const body = (await c.req.json()) as { password?: string }
  if (!body.password) return c.json({ message: 'Password is required' }, 400)
  const callerEmail = ctx?.userClaims?.email?.toLowerCase()
  const authHeader = c.req.header('Authorization') || ''
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (rawToken.startsWith('azs1.') && callerEmail && secretConfigured()) {
    const admin = getAdminClient()
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const found = listed?.users.find((u) => u.email?.toLowerCase() === callerEmail)
    if (found) {
      const { error } = await admin.auth.admin.updateUserById(found.id, { password: body.password })
      if (error) return c.json({ message: error.message }, 400)
    }
    const existingRow = await findPersonByEmail(admin, callerEmail)
    if (existingRow) {
      const updatedPerson: Person = {
        ...existingRow.person,
        mustChangePassword: false,
        lifecycleStatus:
          existingRow.person.lifecycleStatus === 'onboarding'
            ? 'confirmed'
            : existingRow.person.lifecycleStatus,
        confirmationDate:
          existingRow.person.confirmationDate || new Date().toISOString().slice(0, 10),
      }
      await upsertPerson(admin, updatedPerson, existingRow.authUserId || found?.id)
      await cachePerson(updatedPerson)
      await redisDel(BOOTSTRAP_CACHE_KEY)
    }
    return c.json({ ok: true })
  }
  const { error } = await ctx.supabase.auth.updateUser({ password: body.password })
  if (error) return c.json({ message: error.message }, 400)
  if (callerEmail && secretConfigured()) {
    const admin = getAdminClient()
    const existingRow = await findPersonByEmail(admin, callerEmail)
    if (existingRow) {
      const updatedPerson: Person = {
        ...existingRow.person,
        mustChangePassword: false,
        lifecycleStatus:
          existingRow.person.lifecycleStatus === 'onboarding'
            ? 'confirmed'
            : existingRow.person.lifecycleStatus,
        confirmationDate:
          existingRow.person.confirmationDate || new Date().toISOString().slice(0, 10),
      }
      await upsertPerson(admin, updatedPerson, existingRow.authUserId || undefined)
      await cachePerson(updatedPerson)
      await redisDel(BOOTSTRAP_CACHE_KEY)
    }
  }
  return c.json({ ok: true })
})
