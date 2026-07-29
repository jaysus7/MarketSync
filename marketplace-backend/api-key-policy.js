// Pure API-key policy helpers. Keeping these independent of Express/Supabase makes
// the least-privilege rules straightforward to test without a live database.
export const API_SCOPES = new Set(['read', 'leads'])
export const DEFAULT_API_SCOPES = ['read', 'leads']

export function requestedScopes(value) {
  if (value == null) return DEFAULT_API_SCOPES
  if (!Array.isArray(value)) return null
  const normalized = value.map(s => String(s || '').trim().toLowerCase())
  if (normalized.some(s => !API_SCOPES.has(s))) return null
  const scopes = [...new Set(normalized)]
  return scopes.length ? scopes : null
}

export function requestedExpiry(value, now = Date.now()) {
  if (value == null || value === '') return { value: null }
  const expiresAt = new Date(value)
  const max = now + 366 * 24 * 60 * 60 * 1000
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > max) {
    return { error: 'expires_at must be a future date within one year' }
  }
  return { value: expiresAt.toISOString() }
}

export function keyIsExpired(expiresAt, now = Date.now()) {
  return !!expiresAt && new Date(expiresAt).getTime() <= now
}
