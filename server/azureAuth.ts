import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Person } from '../src/types.ts'
import { redisDel, redisGet, redisSet } from './redis.ts'

const STATE_TTL_SECONDS = 600
const SESSION_TTL_SECONDS = 12 * 60 * 60
const TOKEN_PREFIX = 'azs1.'

type PendingState = {
  codeVerifier: string
  redirectUri: string
  returnOrigin: string
  exp: number
}

const memoryStates = new Map<string, PendingState>()

export function azureEnv() {
  return {
    tenantId: (process.env.AZURE_TENANT_ID || '').trim(),
    clientId: (process.env.AZURE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.AZURE_CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.AUTH_REDIRECT_URI || '').trim(),
  }
}

export function azureConfigured() {
  const env = azureEnv()
  return Boolean(env.tenantId && env.clientId)
}

function base64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function signingSecret() {
  return (
    (process.env.AUTH_SESSION_SECRET || '').trim() ||
    (process.env.AZURE_CLIENT_SECRET || '').trim() ||
    (process.env.SUPABASE_SECRET_KEY || '').trim() ||
    (process.env.AZURE_CLIENT_ID || '').trim() ||
    'cybersmith-local-dev-secret'
  )
}

export function resolveRedirectUri(requestOrigin: string) {
  const configured = azureEnv().redirectUri
  if (configured) return configured
  const cleanOrigin = requestOrigin.replace(/\/+$/, '') || 'http://localhost:5173'
  return `${cleanOrigin}/api/auth/callback`
}

export async function createAzureAuthUrl(requestOrigin: string) {
  const env = azureEnv()
  if (!env.tenantId || !env.clientId) {
    throw new Error('Add AZURE_TENANT_ID and AZURE_CLIENT_ID in .env before using Microsoft sign-in.')
  }
  const state = base64Url(randomBytes(24))
  const codeVerifier = base64Url(randomBytes(32))
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest())
  const returnOrigin = requestOrigin.replace(/\/+$/, '') || 'http://localhost:5173'
  const redirectUri = resolveRedirectUri(returnOrigin)

  const pending: PendingState = {
    codeVerifier,
    redirectUri,
    returnOrigin,
    exp: Date.now() + STATE_TTL_SECONDS * 1000,
  }
  memoryStates.set(state, pending)
  await redisSet(`azure:state:${state}`, JSON.stringify(pending), STATE_TTL_SECONDS)

  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })

  return {
    authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/oauth2/v2.0/authorize?${params.toString()}`,
    redirectUri,
  }
}

export async function peekAzureState(state: string): Promise<PendingState | null> {
  if (!state) return null
  const fromRedis = await redisGet(`azure:state:${state}`)
  if (fromRedis) {
    try {
      return JSON.parse(fromRedis) as PendingState
    } catch {
      return null
    }
  }
  const local = memoryStates.get(state)
  if (!local || local.exp < Date.now()) {
    memoryStates.delete(state)
    return null
  }
  return local
}

async function consumeAzureState(state: string): Promise<PendingState | null> {
  const found = await peekAzureState(state)
  memoryStates.delete(state)
  await redisDel(`azure:state:${state}`)
  return found
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function exchangeAzureCode(code: string, state: string) {
  const env = azureEnv()
  if (!env.tenantId || !env.clientId) {
    throw new Error('Azure authentication is not configured on the server.')
  }
  const saved = await consumeAzureState(state)
  if (!saved) {
    throw new Error('Sign-in session expired or state did not match. Please try signing in again.')
  }

  const body = new URLSearchParams({
    client_id: env.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: saved.redirectUri,
    code_verifier: saved.codeVerifier,
    scope: 'openid profile email User.Read',
  })
  if (env.clientSecret) {
    body.set('client_secret', env.clientSecret)
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  )
  const tokenJson = (await tokenRes.json().catch(() => null)) as {
    id_token?: string
    access_token?: string
    error_description?: string
    error?: string
  } | null

  if (!tokenRes.ok || !tokenJson) {
    const detail = tokenJson?.error_description || tokenJson?.error || 'Could not exchange Azure authorization code.'
    throw new Error(detail)
  }

  const claims = tokenJson.id_token ? decodeJwtPayload(tokenJson.id_token) : null
  let email = String(
    claims?.email || claims?.preferred_username || claims?.upn || claims?.unique_name || '',
  )
    .trim()
    .toLowerCase()
  let name = String(claims?.name || '').trim()
  const oid = String(claims?.oid || claims?.sub || '').trim()

  if (!email && tokenJson.access_token) {
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    if (meRes.ok) {
      const me = (await meRes.json().catch(() => null)) as {
        mail?: string
        userPrincipalName?: string
        displayName?: string
      } | null
      email = String(me?.mail || me?.userPrincipalName || '').trim().toLowerCase()
      if (!name && me?.displayName) name = me.displayName.trim()
    }
  }

  if (!email) {
    throw new Error('Azure account did not return an email address.')
  }

  return { email, name, oid }
}

export function issueAzureSessionToken(user: {
  email: string
  name?: string
  sub?: string
  role?: Person['role']
}) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        email: user.email.toLowerCase(),
        name: user.name || '',
        sub: user.sub || user.email.toLowerCase(),
        role: user.role || '',
        exp,
      }),
      'utf8',
    ),
  )
  const sig = base64Url(createHmac('sha256', signingSecret()).update(payload).digest())
  return `${TOKEN_PREFIX}${payload}.${sig}`
}

export function verifyAzureSessionToken(token: string): {
  email: string
  name: string
  sub: string
  role?: Person['role']
} | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null
  const rest = token.slice(TOKEN_PREFIX.length)
  const dot = rest.indexOf('.')
  if (dot <= 0) return null
  const payload = rest.slice(0, dot)
  const sig = rest.slice(dot + 1)
  const expected = base64Url(createHmac('sha256', signingSecret()).update(payload).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { email?: string; name?: string; sub?: string; role?: string; exp?: number }
    if (!parsed.email || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null
    const role =
      parsed.role === 'admin' || parsed.role === 'hr' || parsed.role === 'tl' || parsed.role === 'user'
        ? parsed.role
        : undefined
    return {
      email: parsed.email.toLowerCase(),
      name: parsed.name || '',
      sub: parsed.sub || parsed.email.toLowerCase(),
      role,
    }
  } catch {
    return null
  }
}
