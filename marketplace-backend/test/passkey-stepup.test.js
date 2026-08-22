import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordPasskeyStepUp, hasRecentPasskeyStepUp } from '../passkeys.js'
import { backendRouteSource } from './helpers/split-source.js'

test('a recorded passkey step-up is recognized as recent', () => {
  const userId = 'user-stepup-' + Math.random().toString(36).slice(2)
  assert.equal(hasRecentPasskeyStepUp(userId), false)
  recordPasskeyStepUp(userId)
  assert.equal(hasRecentPasskeyStepUp(userId), true)
})

test('step-up markers are scoped per user', () => {
  const a = 'user-a-' + Math.random().toString(36).slice(2)
  const b = 'user-b-' + Math.random().toString(36).slice(2)
  recordPasskeyStepUp(a)
  assert.equal(hasRecentPasskeyStepUp(a), true)
  assert.equal(hasRecentPasskeyStepUp(b), false)
})

test('a missing/blank user id never counts as stepped up', () => {
  recordPasskeyStepUp(undefined)
  recordPasskeyStepUp('')
  assert.equal(hasRecentPasskeyStepUp(undefined), false)
  assert.equal(hasRecentPasskeyStepUp(''), false)
  assert.equal(hasRecentPasskeyStepUp(null), false)
})

test('requireMfa accepts a recent passkey step-up before hitting Supabase', () => {
  // The middleware short-circuits on a recent biometric step-up so an enrolled
  // user can clear the gate with Face ID / fingerprint instead of a TOTP code.
  const mw = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')
  assert.match(mw, /hasRecentPasskeyStepUp\(req\.user\?\.id\)/)
})

test('step-up routes are registered behind requireAuth', () => {
  // backendRouteSource('auth') concatenates routes/auth.js + routes/submodules/auth-*.js
  const src = backendRouteSource('auth')
  assert.match(src, /app\.post\('\/auth\/passkey\/stepup\/begin', requireAuth/)
  assert.match(src, /app\.post\('\/auth\/passkey\/stepup\/finish', requireAuth/)
})
