import { createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

let client: RedisClient | null = null
let connecting: Promise<RedisClient | null> | null = null
let unavailableUntil = 0

async function connect(): Promise<RedisClient | null> {
  if (client?.isOpen) return client
  if (Date.now() < unavailableUntil) return null
  if (connecting) return connecting
  const url = process.env.REDIS_URL
  if (!url) return null
  connecting = (async () => {
    const next = createClient({
      url,
      socket: {
        connectTimeout: 1200,
        reconnectStrategy: false,
      },
    })
    next.on('error', () => {
      /* handled below */
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
  if (!process.env.REDIS_URL) return 'disabled'
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
