import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// auth.js is the browser-side shared auth module (classic script), but it also
// module.exports its pure decision helpers so they can be tested here without a DOM.
const require = createRequire(import.meta.url)
const MSAuth = require('../../marketplace-frontend/auth.js')

// Build an unsigned JWT (header.payload.signature) with a given payload. The client
// only reads the payload's exp — the SERVER verifies the signature — so a fake sig is fine.
function jwt(payload) {
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return 'h.' + b64u(payload) + '.s'
}
const nowS = () => Math.floor(Date.now() / 1000)

test('parseJwt decodes the payload and rejects garbage', () => {
  const t = jwt({ sub: 'user-1', exp: nowS() + 3600 })
  assert.equal(MSAuth.parseJwt(t).sub, 'user-1')
  assert.equal(MSAuth.parseJwt('not-a-jwt'), null)
  assert.equal(MSAuth.parseJwt(''), null)
  assert.equal(MSAuth.parseJwt(null), null)
  assert.equal(MSAuth.parseJwt('a.b'), null)   // payload 'b' isn't valid base64 JSON
})

test('isTokenValid — future exp is valid, past exp is not', () => {
  assert.equal(MSAuth.isTokenValid(jwt({ exp: nowS() + 3600 })), true)
  assert.equal(MSAuth.isTokenValid(jwt({ exp: nowS() - 10 })), false)
})

test('isTokenValid — a token expiring within the skew window is treated as expired', () => {
  // EXP_SKEW is 30s; a token with 10s of life left should read as invalid (clock skew).
  assert.equal(MSAuth.isTokenValid(jwt({ exp: nowS() + 10 })), false)
})

test('isTokenValid — missing/no exp is invalid', () => {
  assert.equal(MSAuth.isTokenValid(jwt({ sub: 'x' })), false)
  assert.equal(MSAuth.isTokenValid(''), false)
  assert.equal(MSAuth.isTokenValid(null), false)
})

test('needsRefresh — expired or near-expiry tokens need refresh; healthy ones do not', () => {
  assert.equal(MSAuth.needsRefresh(jwt({ exp: nowS() - 10 })), true)   // expired
  assert.equal(MSAuth.needsRefresh(jwt({ exp: nowS() + 60 })), true)   // <5min → proactive refresh
  assert.equal(MSAuth.needsRefresh(jwt({ exp: nowS() + 3600 })), false) // plenty of life
  assert.equal(MSAuth.needsRefresh('garbage'), true)                   // unknown → try refresh
})

test('resolveDashboardTarget — one adaptive dashboard for every product', () => {
  assert.equal(MSAuth.resolveDashboardTarget({ products: ['facebook'] }), 'dashboard.html')
  assert.equal(MSAuth.resolveDashboardTarget({ products: ['dealer_os'] }), 'dashboard.html')
  assert.equal(MSAuth.resolveDashboardTarget({}), 'dashboard.html')
})

test('stale vs session keys never overlap — cleanup can never nuke the real session', () => {
  for (const k of MSAuth.SESSION_KEYS) {
    assert.ok(!MSAuth.STALE_AUTH_KEYS.includes(k), `${k} must not be in the stale-purge list`)
  }
  // The real session keys are exactly these four.
  assert.deepEqual(MSAuth.SESSION_KEYS, ['token', 'refresh_token', 'user', 'ms_remember_until'])
  // Known legacy fake-auth flags are targeted for purge.
  for (const k of ['isLoggedIn', 'loggedIn', 'authenticated', 'accessToken']) {
    assert.ok(MSAuth.STALE_AUTH_KEYS.includes(k), `${k} should be purged as stale`)
  }
})

test('resolveApiBase — production host by default (no staging in hostname)', () => {
  // In Node there is no `location`, so the resolver falls back to production — which is
  // exactly the safe default for the packaged frontend.
  assert.equal(MSAuth.resolveApiBase(), 'https://vehicle-marketplace-s0e4.onrender.com')
})
