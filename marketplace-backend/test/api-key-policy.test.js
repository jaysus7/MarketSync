import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_API_SCOPES, keyIsExpired, requestedExpiry, requestedScopes } from '../api-key-policy.js'

test('API keys default to the documented least-privilege scopes', () => {
  assert.deepEqual(requestedScopes(), DEFAULT_API_SCOPES)
})

test('API keys reject unknown and empty scopes', () => {
  assert.equal(requestedScopes(['read', 'admin']), null)
  assert.equal(requestedScopes([]), null)
  assert.equal(requestedScopes('read'), null)
})

test('API keys normalize and de-duplicate valid scopes', () => {
  assert.deepEqual(requestedScopes([' READ ', 'leads', 'read']), ['read', 'leads'])
})

test('API key expiry accepts only a future date within one year', () => {
  const now = Date.UTC(2026, 6, 29)
  assert.equal(requestedExpiry('2026-07-29T00:00:00.000Z', now).error, 'expires_at must be a future date within one year')
  assert.equal(requestedExpiry('2028-01-01T00:00:00.000Z', now).error, 'expires_at must be a future date within one year')
  assert.equal(requestedExpiry('2026-08-01T00:00:00.000Z', now).value, '2026-08-01T00:00:00.000Z')
})

test('API key expiry treats the exact expiry time as expired', () => {
  const now = Date.UTC(2026, 6, 29)
  assert.equal(keyIsExpired('2026-07-29T00:00:00.000Z', now), true)
  assert.equal(keyIsExpired('2026-07-30T00:00:00.000Z', now), false)
})
