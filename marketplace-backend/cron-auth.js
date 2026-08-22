import { timingSafeEqual } from 'node:crypto'

// Scheduled jobs can mutate many dealerships at once. They must be disabled
// until a non-empty secret is configured; comparing two empty strings is a
// fail-open security bug. Compare equal-length values in constant time.
export function cronAuthorized(provided, configured = process.env.CRON_SECRET) {
  const expected = String(configured || '').trim()
  const candidate = String(provided || '').trim()
  if (!expected || !candidate) return false
  const expectedBuffer = Buffer.from(expected)
  const candidateBuffer = Buffer.from(candidate)
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer)
}

export function requestHasCronSecret(req) {
  return cronAuthorized(req.headers?.['x-cron-secret'])
}
