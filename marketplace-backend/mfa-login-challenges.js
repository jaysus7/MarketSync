import { randomBytes, createHmac } from 'node:crypto'

// Supabase returns a real access token after password verification. Never send
// that token to a client that still needs to complete MFA: it could otherwise
// call authenticated API routes directly and bypass the MFA screen. Keep the
// session server-side briefly and issue an opaque, one-purpose challenge token.
const challenges = new Map()
const TTL_MS = 5 * 60 * 1000

function pruneExpired() {
  const now = Date.now()
  for (const [token, entry] of challenges) {
    if (entry.expiresAt <= now) challenges.delete(token)
  }
}

export function createMfaLoginChallenge(session) {
  pruneExpired()
  const token = randomBytes(32).toString('base64url')
  challenges.set(token, { ...session, expiresAt: Date.now() + TTL_MS })
  return token
}

export function getMfaLoginChallenge(token) {
  const entry = challenges.get(String(token || ''))
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) challenges.delete(String(token || ''))
    return null
  }
  return entry
}

export function consumeMfaLoginChallenge(token) {
  const entry = getMfaLoginChallenge(token)
  if (entry) challenges.delete(String(token || ''))
  return entry
}

// ── 30-Day Trusted Device MFA Trust System ──────────────────────────────────
const TRUST_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.APP_SECRET || 'marketsync-trusted-device-secret-2026'
const TRUST_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function createTrustedDeviceToken(userId) {
  if (!userId) return null
  const expiresAt = Date.now() + TRUST_TTL_MS
  const payload = `${userId}:${expiresAt}`
  const signature = createHmac('sha256', TRUST_SECRET).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ u: userId, exp: expiresAt, sig: signature })).toString('base64url')
}

export function verifyTrustedDeviceToken(token, userId) {
  if (!token || !userId) return false
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    if (!raw.u || !raw.exp || !raw.sig) return false
    if (raw.u !== userId) return false
    if (Number(raw.exp) < Date.now()) return false
    const expectedPayload = `${raw.u}:${raw.exp}`
    const expectedSig = createHmac('sha256', TRUST_SECRET).update(expectedPayload).digest('hex')
    return raw.sig === expectedSig
  } catch (e) {
    return false
  }
}

