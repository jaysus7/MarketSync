import { randomBytes } from 'node:crypto'

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
