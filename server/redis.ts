import { createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

let client: RedisClient | null = null
let connecting: Promise<RedisClient | null> | null = null
let unavailableUntil = 0

function isLocalHost(url: string) {
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  } catch {
    return false
  }
}

/** Production uses Railway Redis. A localhost URL is only for a developer machine. */
function resolveRedisUrl() {
  const fromParts = (() => {
    const host = (process.env.REDISHOST || process.env.REDIS_HOST || '').trim()
    if (!host) return ''
    const port = (process.env.REDISPORT || process.env.REDIS_PORT || '6379').trim()
    const user = (process.env.REDISUSER || process.env.REDIS_USER || 'default').trim()
    const password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || ''
    if (!password) return `redis://${host}:${port}`
    return `redis://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`
  })()
  const explicit = (process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '').trim()
  const production = process.env.NODE_ENV === 'production'
  const candidates = [explicit, fromParts].filter(Boolean)
  const remote = candidates.find((url) => !isLocalHost(url))
  if (production) return remote || ''
  return explicit || fromParts
}

async function connect(): Promise<RedisClient | null> {
  if (client?.isOpen) return client
  if (Date.now() < unavailableUntil) return null
  if (connecting) return connecting
  const url = resolveRedisUrl()
  if (!url) return null
  connecting = (async () => {
    const next = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy(retries) {
          if (retries > 10) return new Error('redis unavailable')
          return Math.min(retries * 200, 2000)
        },
      },
    })
    next.on('error', () => {
      if (client === next) client = null
    })
    try {
      await next.connect()
      client = next
      return next
    } catch {
      unavailableUntil = Date.now() + 15_000
      try {
        await next.close()
      } catch {
        /* ignore */
      }
      return null
    } finally {
      connecting = null
    }
  })()
  return connecting
}

export async function redisGet(key: string) {
  const redis = await connect()
  if (!redis) return null
  try {
    return await redis.get(key)
  } catch {
    return null
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number) {
  const redis = await connect()
  if (!redis) return false
  try {
    if (ttlSeconds) await redis.set(key, value, { EX: ttlSeconds })
    else await redis.set(key, value)
    return true
  } catch {
    return false
  }
}

export async function redisDel(...keys: string[]) {
  const redis = await connect()
  if (!redis || keys.length === 0) return
  try {
    await redis.del(keys)
  } catch {
    /* ignore */
  }
}

export async function redisIncr(key: string, ttlSeconds: number) {
  const redis = await connect()
  if (!redis) return null
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, ttlSeconds)
    return n
  } catch {
    return null
  }
}

export async function redisPing() {
  if (!resolveRedisUrl()) return 'disabled'
  const redis = await connect()
  if (!redis) return 'down'
  try {
    return await redis.ping()
  } catch {
    return 'down'
  }
}

const FAIL_WINDOW = 120

export async function loginLocked(email: string) {
  const until = await redisGet(`login:lock:${email}`)
  if (!until) return null
  const ms = Number(until)
  if (!ms || ms < Date.now()) {
    await redisDel(`login:lock:${email}`)
    return null
  }
  return Math.ceil((ms - Date.now()) / 1000)
}

export async function recordLoginFailure(email: string) {
  const n = await redisIncr(`login:fail:${email}`, FAIL_WINDOW)
  if (n != null && n >= 5) {
    await redisSet(`login:lock:${email}`, String(Date.now() + FAIL_WINDOW * 1000), FAIL_WINDOW)
    await redisDel(`login:fail:${email}`)
    return { locked: true as const, wait: FAIL_WINDOW }
  }
  return { locked: false as const, wait: 0 }
}

export async function clearLoginFailures(email: string) {
  await redisDel(`login:fail:${email}`, `login:lock:${email}`)
}

export const BOOTSTRAP_CACHE_KEY = 'cache:bootstrap'
export const SESSION_CACHE_PREFIX = 'session:'
