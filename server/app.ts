import { createAdminClient, resolveEnv } from '@supabase/server/core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { AuthError, createSupabaseContext } from '@supabase/server'
import { withSupabase } from '@supabase/server/adapters/hono'
import type { SupabaseContext } from '@supabase/server'
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
import { syncAuthUsersIntoPeople } from './ensureStaff.ts'
import { deleteChallenge, hashOtp, newChallengeId, newOtpCode, otpMatches, readChallenge, saveChallenge } from './otpChallenge.ts'
import { sendTwilioSms, twilioConfigured } from './twilio.ts'
import { findPersonByEmail, loadSnapshot, samePhone, saveSnapshot, toE164Phone, upsertPerson } from './store.ts'
import { isStrongPassword, PASSWORD_POLICY } from '../src/security/wstg.ts'
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
  const hasSecret = Boolean(
    (process.env.SUPABASE_SECRET_KEY || '').trim() ||
      (resolved.data && Object.keys(resolved.data.secretKeys || {}).length),
  )
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
  const reader = secretConfigured() ? createAdminClient() : userClient
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
            'Add SUPABASE_SECRET_KEY on the server. The OTP is sent to the mobile number stored on the employee account, and that record cannot be read without this key.',
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
  })
})

app.get('/api/health', async (c) => {
  const env = supabaseProcessEnv()
  return c.json({
    ok: Boolean(env.supabaseUrl),
    redis: await redisPing(),
    twilio: twilioConfigured() ? 'configured' : 'missing',
    supabase: env.supabaseUrl || 'missing SUPABASE_URL',
    hasSecret: env.hasSecret,
    time: new Date().toISOString(),
  })
})

function maskPhone(e164: string) {
  const digits = e164.replace(/\D/g, '')
  return `+${digits.slice(0, Math.min(2, digits.length - 4))} •••• ${digits.slice(-4)}`
}

async function issueAccountOtp(input: {
  purpose: 'login' | 'reset'
  email: string
  authUserId: string | null
  accessToken: string
  refreshToken: string
  person: Person
  snapshot: AppSnapshot | null
}) {
  const phone = toE164Phone(input.person.phone || '')
  if (!phone) {
    return {
      status: 400 as const,
      body: { message: 'This account has no mobile number. Ask HR to add it on the employee record.' },
    }
  }
  if (!twilioConfigured()) {
    return {
      status: 503 as const,
      body: {
        message:
          'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID on the server before an OTP can be sent.',
      },
    }
  }
  const challengeId = newChallengeId()
  const otp = newOtpCode()
  await saveChallenge(challengeId, {
    purpose: input.purpose,
    email: input.email,
    authUserId: input.authUserId,
    otpHash: hashOtp(challengeId, otp),
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    person: input.person,
    snapshot: input.snapshot,
    attempts: 0,
  })
  try {
    const action = input.purpose === 'reset' ? 'password reset' : 'login'
    await sendTwilioSms(phone, `Your Cybersmith Secure ${action} code is ${otp}. It expires in 5 minutes.`)
  } catch (err) {
    await deleteChallenge(challengeId)
    return {
      status: 502 as const,
      body: { message: err instanceof Error ? err.message : 'Could not send the OTP' },
    }
  }
  return {
    status: 200 as const,
    body: { challengeId, phoneHint: maskPhone(phone) },
  }
}

app.post('/api/auth/otp/verify', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { challengeId?: string; token?: string }
  const challengeId = (body.challengeId || '').trim()
  const token = (body.token || '').replace(/\D/g, '')
  if (!challengeId || token.length < 6) return c.json({ message: 'Enter the 6-digit OTP from the SMS' }, 400)
  const challenge = await readChallenge(challengeId)
  if (!challenge || challenge.purpose !== 'login') return c.json({ message: 'That OTP has expired. Sign in again.' }, 401)
  const wait = await loginLocked(challenge.email)
  if (wait) return c.json({ message: `Too many attempts. Try again in ${wait}s` }, 429)
  if (!otpMatches(challengeId, token, challenge.otpHash)) {
    const attempts = challenge.attempts + 1
    if (attempts >= 5) {
      await deleteChallenge(challengeId)
      const fail = await recordLoginFailure(challenge.email)
      if (fail.locked) return c.json({ message: `Too many attempts. Try again in ${fail.wait}s` }, 429)
    } else {
      await saveChallenge(challengeId, { ...challenge, attempts })
    }
    return c.json({ message: 'That OTP is not valid' }, 401)
  }
  await deleteChallenge(challengeId)
  await clearLoginFailures(challenge.email)
  return c.json({
    accessToken: challenge.accessToken,
    refreshToken: challenge.refreshToken,
    person: challenge.person,
    snapshot: challenge.snapshot,
  })
})

app.post('/api/auth/forgot', withSupabase({ auth: 'publishable' }), async (c) => {
  const { supabase, supabaseAdmin } = c.var.supabaseContext
  const body = (await c.req.json().catch(() => ({}))) as { email?: string }
  const email = normalizeCompanyEmail(body.email || '')
  if (!email) {
    return c.json({ message: `Use a company email ending with @${COMPANY_DOMAIN}` }, 400)
  }
  const wait = await loginLocked(email)
  if (wait) return c.json({ message: `Too many attempts. Try again in ${wait}s` }, 429)
  let found = null as Awaited<ReturnType<typeof findPersonByEmail>>
  try {
    found = await findPersonByEmail(supabase, email)
  } catch {
    found = null
  }
  if (!found && secretConfigured()) {
    try {
      found = await findPersonByEmail(supabaseAdmin, email)
    } catch (err) {
      return c.json({ message: err instanceof Error ? err.message : 'Could not read employee records' }, 503)
    }
  }
  if (!found) return c.json({ message: 'That company email is not on an employee record' }, 404)
  if (closedAccount(found.person)) {
    return c.json({ message: 'This account is closed. The employee record stays in Employees for HR records.' }, 403)
  }
  const issued = await issueAccountOtp({
    purpose: 'reset',
    email,
    authUserId: found.authUserId,
    accessToken: '',
    refreshToken: '',
    person: found.person,
    snapshot: null,
  })
  return c.json(issued.body, issued.status)
})

app.post('/api/auth/otp/reset', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    challengeId?: string
    token?: string
    password?: string
  }
  const challengeId = (body.challengeId || '').trim()
  const token = (body.token || '').replace(/\D/g, '')
  const password = (body.password || '').trim()
  if (!challengeId || token.length < 6) return c.json({ message: 'Enter the 6-digit OTP from the SMS' }, 400)
  if (!isStrongPassword(password)) return c.json({ message: PASSWORD_POLICY }, 400)
  const challenge = await readChallenge(challengeId)
  if (!challenge || challenge.purpose !== 'reset') {
    return c.json({ message: 'That OTP has expired. Request a new code.' }, 401)
  }
  if (!otpMatches(challengeId, token, challenge.otpHash)) {
    const attempts = challenge.attempts + 1
    if (attempts >= 5) await deleteChallenge(challengeId)
    else await saveChallenge(challengeId, { ...challenge, attempts })
    return c.json({ message: 'That OTP is not valid' }, 401)
  }
  if (!secretConfigured() || !challenge.authUserId) {
    return c.json({ message: 'Add SUPABASE_SECRET_KEY before the password can be saved.' }, 503)
  }
  const admin = createAdminClient()
  const { error: passwordError } = await admin.auth.admin.updateUserById(challenge.authUserId, { password })
  if (passwordError) return c.json({ message: passwordError.message }, 400)
  const { data: ctx, error: ctxError } = await createSupabaseContext(c.req.raw, { auth: 'publishable' })
  if (ctxError || !ctx) return c.json({ message: ctxError?.message || 'Could not sign in with the new password' }, 401)
  const { data, error } = await ctx.supabase.auth.signInWithPassword({ email: challenge.email, password })
  if (error || !data.session) return c.json({ message: error?.message || 'Could not sign in with the new password' }, 401)
  await deleteChallenge(challengeId)
  const person = { ...challenge.person, mustChangePassword: false }
  return c.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    person,
    snapshot: challenge.snapshot,
  })
})

app.post('/api/auth/login', withSupabase({ auth: 'publishable' }), async (c) => {
  const { supabase, supabaseAdmin } = c.var.supabaseContext
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
    found = await findPersonByEmail(supabase, email)
  } catch {
    found = null
  }
  if (!found) {
    try {
      found = await findPersonByEmail(supabaseAdmin, email)
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
  }
  if (!found) {
    return c.json({ message: 'Employee record not found. Run the SQL migration and npm run seed.' }, 404)
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
    snapshot = await cachedBootstrap(supabase)
  } catch {
    try {
      snapshot = secretConfigured() ? await cachedBootstrap(c.var.supabaseContext.supabaseAdmin) : null
    } catch {
      snapshot = null
    }
  }
  const issued = await issueAccountOtp({
    purpose: 'login',
    email,
    authUserId: found.authUserId,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    person: found.person,
    snapshot,
  })
  return c.json(issued.body, issued.status)
})

app.get('/api/bootstrap', withSupabase({ auth: 'user' }), async (c) => {
  const { supabase, supabaseAdmin, userClaims } = c.var.supabaseContext
  let snapshot = null
  try {
    snapshot = await cachedBootstrap(supabase)
  } catch {
    snapshot = await cachedBootstrap(supabaseAdmin)
  }
  if (!snapshot) {
    return c.json({ message: 'Database is empty. Run npm run seed after applying the SQL migration.' }, 404)
  }
  const claims = userClaims as { email?: string; phone?: string } | null
  const email = claims?.email?.toLowerCase()
  const phone = claims?.phone || ''
  const person = snapshot.people.find(
    (p) => (email && p.email.toLowerCase() === email) || (phone && samePhone(p.phone || '', phone)),
  )
  if (person) await cachePerson(person)
  return c.json({ person: person || null, snapshot })
})

app.put('/api/snapshot', withSupabase({ auth: 'user' }), async (c) => {
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

app.post('/api/employees/provision', withSupabase({ auth: 'user' }), async (c) => {
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
  const admin = createAdminClient()
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

app.post('/api/auth/password', withSupabase({ auth: 'user' }), async (c) => {
  const { supabase } = c.var.supabaseContext
  const body = (await c.req.json()) as { password?: string }
  if (!body.password) return c.json({ message: 'Password is required' }, 400)
  const { error } = await supabase.auth.updateUser({ password: body.password })
  if (error) return c.json({ message: error.message }, 400)
  return c.json({ ok: true })
})
