import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rpFrom } from '../passkeys.js'
import { backendRouteSource } from './helpers/split-source.js'

function withEnv(vars, fn) {
  const prev = {}
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k] }
  try { return fn() } finally {
    for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k] }
  }
}

test('rpFrom derives the RP ID + origin from the request origin (no env vars needed)', () => {
  withEnv({ WEBAUTHN_RP_ID: undefined, WEBAUTHN_ORIGIN: undefined }, () => {
    assert.deepEqual(
      rpFrom('https://marketsync-staging-site.onrender.com'),
      { rpID: 'marketsync-staging-site.onrender.com', origin: 'https://marketsync-staging-site.onrender.com' }
    )
    // RP ID is host-only; the origin keeps the scheme (+ port if any).
    assert.deepEqual(rpFrom('http://localhost:3000'), { rpID: 'localhost', origin: 'http://localhost:3000' })
  })
})

test('rpFrom falls back to the marketsync.link defaults when there is no usable origin', () => {
  withEnv({ WEBAUTHN_RP_ID: undefined, WEBAUTHN_ORIGIN: undefined }, () => {
    assert.deepEqual(rpFrom(undefined), { rpID: 'marketsync.link', origin: 'https://marketsync.link' })
    assert.deepEqual(rpFrom('not a url'), { rpID: 'marketsync.link', origin: 'https://marketsync.link' })
  })
})

test('explicit WEBAUTHN_RP_ID + WEBAUTHN_ORIGIN pin the RP and override the request origin', () => {
  withEnv({ WEBAUTHN_RP_ID: 'marketsync.link', WEBAUTHN_ORIGIN: 'https://marketsync.link' }, () => {
    assert.deepEqual(rpFrom('https://anything-else.example.com'), { rpID: 'marketsync.link', origin: 'https://marketsync.link' })
  })
})

test('every passkey ceremony threads the request origin, and every route passes it', () => {
  const passkeys = readFileSync(new URL('../passkeys.js', import.meta.url), 'utf8')
  const derives = passkeys.match(/rpFrom\(reqOrigin\)/g) || []
  assert.ok(derives.length >= 6, `all 6 begin/finish ceremonies must derive rp via rpFrom(reqOrigin); saw ${derives.length}`)
  const routes = backendRouteSource('auth')
  const passes = routes.match(/reqOrigin: req\.headers\.origin/g) || []
  assert.ok(passes.length >= 6, `all 6 passkey routes must pass reqOrigin: req.headers.origin; saw ${passes.length}`)
})
