import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSecretKey() {
  return (
    (process.env.SUPABASE_SECRET_KEY || '').trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )
}

export function getAdminClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || '').trim()
  const secret = getSecretKey()
  if (!url || !secret) {
    throw new Error('SUPABASE_SECRET_KEY is not set')
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getPublishableClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
