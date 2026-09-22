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

export function publishableKey() {
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
}

export function isRemoteConfigured() {
  return Boolean(publishableKey())
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

export async function remoteLogin(email: string, password: string) {
  return request<RemoteSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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
