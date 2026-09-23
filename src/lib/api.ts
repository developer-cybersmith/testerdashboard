import type { Person } from '../types'
import type { AppSnapshot } from './appSnapshot'

const TOKEN_KEY = 'cs.supabase.session'

export interface RemoteSession {
  accessToken: string
  refreshToken: string
  person: Person
  snapshot: AppSnapshot | null
}

function apiBase() {
  return import.meta.env.VITE_API_URL || '/api'
}

type ServerConfig = {
  supabaseUrl: string
  publishableKey: string
  canStore: boolean
}

let serverConfig: ServerConfig | null = null
let configLoad: Promise<ServerConfig | null> | null = null

export function publishableKey() {
  return (
    serverConfig?.publishableKey ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    ''
  )
}

export function isRemoteConfigured() {
  return Boolean(publishableKey())
}

export function canStoreRemotely() {
  return Boolean(serverConfig?.canStore)
}

/** Read SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from the API process, not from example placeholders. */
export function ensureRemoteConfig() {
  if (!configLoad) {
    configLoad = fetch(`${apiBase()}/config`)
      .then(async (res) => {
        if (!res.ok) return null
        const json = (await res.json()) as Partial<ServerConfig>
        serverConfig = {
          supabaseUrl: json.supabaseUrl || '',
          publishableKey: json.publishableKey || '',
          canStore: Boolean(json.canStore),
        }
        return serverConfig
      })
      .catch(() => null)
  }
  return configLoad
}

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Pick<RemoteSession, 'accessToken' | 'refreshToken'>
  } catch {
    return null
  }
}

export function storeSession(session: Pick<RemoteSession, 'accessToken' | 'refreshToken'>) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const key = publishableKey()
  if (key) headers.set('apikey', key)
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  try {
    const res = await fetch(`${apiBase()}${path}`, { ...init, headers })
    const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null
    if (!res.ok || json == null || typeof json !== 'object') {
      return { ok: false, status: res.status, message: json?.message || `Request failed (${res.status})` }
    }
    return { ok: true, data: json }
  } catch {
    return { ok: false, status: 0, message: 'API unavailable' }
  }
}

export async function remoteHealth() {
  return request<{ ok: boolean; redis: string; database: string }>('/health')
}

export interface LoginChallenge {
  challengeId: string
  phoneHint: string
}

export async function remoteForgotPassword(email: string) {
  return request<LoginChallenge>('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function remoteLogin(email: string, password: string) {
  return request<LoginChallenge>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function remoteVerifyLoginOtp(challengeId: string, token: string) {
  return request<RemoteSession>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, token }),
  })
}

export async function remoteCompletePasswordReset(challengeId: string, token: string, password: string) {
  return request<RemoteSession>('/auth/otp/reset', {
    method: 'POST',
    body: JSON.stringify({ challengeId, token, password }),
  })
}

export async function remoteBootstrap(token: string) {
  return request<{ person: Person | null; snapshot: AppSnapshot }>('/bootstrap', { token })
}

export async function remoteSaveSnapshot(token: string, snapshot: AppSnapshot) {
  return request<{ ok: boolean }>('/snapshot', {
    method: 'PUT',
    token,
    body: JSON.stringify(snapshot),
  })
}

export async function remoteProvisionEmployee(token: string, person: Person, password: string) {
  return request<{ ok: boolean }>('/employees/provision', {
    method: 'POST',
    token,
    body: JSON.stringify({ person, password }),
  })
}

export async function remoteUpdatePassword(token: string, password: string) {
  return request<{ ok: boolean }>('/auth/password', {
    method: 'POST',
    token,
    body: JSON.stringify({ password }),
  })
}
