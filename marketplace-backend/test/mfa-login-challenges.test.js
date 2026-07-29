import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeMfaLoginChallenge, createMfaLoginChallenge, getMfaLoginChallenge } from '../mfa-login-challenges.js'

test('MFA login challenge token is opaque and retains the session only server-side', () => {
  const token = createMfaLoginChallenge({ accessToken: 'real-access-token', refreshToken: 'real-refresh-token' })
  assert.notEqual(token, 'real-access-token')
  assert.deepEqual(getMfaLoginChallenge(token)?.accessToken, 'real-access-token')
})

test('MFA login challenge can be consumed exactly once', () => {
  const token = createMfaLoginChallenge({ accessToken: 'session' })
  assert.equal(consumeMfaLoginChallenge(token)?.accessToken, 'session')
  assert.equal(getMfaLoginChallenge(token), null)
})
