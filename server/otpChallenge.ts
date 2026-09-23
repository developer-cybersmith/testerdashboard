import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { Person } from '../src/types.ts'
import type { AppSnapshot } from '../src/lib/appSnapshot.ts'
import { redisDel, redisGet, redisSet } from './redis.ts'

const TTL_SECONDS = 300

export type OtpChallenge = {
  purpose: 'login' | 'reset'
  email: string
  authUserId: string | null
  otpHash: string
  accessToken: string
  refreshToken: string
  person: Person
  snapshot: AppSnapshot | null
  attempts: number
}

const memory = new Map<string, { raw: string; exp: number }>()

function key(id: string) {
  return `otp:challenge:${id}`
}

export function newOtpCode() {
  return String(randomInt(100000, 1000000))
}

export function newChallengeId() {
  return randomBytes(24).toString('hex')
}

export function hashOtp(challengeId: string, otp: string) {
  return createHash('sha256').update(`${challengeId}:${otp}`).digest('hex')
}

export function otpMatches(challengeId: string, otp: string, expectedHash: string) {
  const actual = Buffer.from(hashOtp(challengeId, otp))
  const expected = Buffer.from(expectedHash)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export async function saveChallenge(id: string, challenge: OtpChallenge) {
  const raw = JSON.stringify(challenge)
  memory.set(id, { raw, exp: Date.now() + TTL_SECONDS * 1000 })
  await redisSet(key(id), raw, TTL_SECONDS)
}

export async function readChallenge(id: string) {
  const remote = await redisGet(key(id))
  if (remote) return JSON.parse(remote) as OtpChallenge
  const local = memory.get(id)
  if (!local || local.exp < Date.now()) {
    memory.delete(id)
    return null
  }
  return JSON.parse(local.raw) as OtpChallenge
}

export async function deleteChallenge(id: string) {
  memory.delete(id)
  await redisDel(key(id))
}
