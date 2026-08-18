import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { backendRouteSource } from './helpers/split-source.js'

const passkeys = readFileSync(new URL('../passkeys.js', import.meta.url), 'utf8')
// backendRouteSource('auth') concatenates routes/auth.js + routes/submodules/auth-*.js,
// which is where the passkey register/finish routes actually live.
const authRoutes = backendRouteSource('auth')

test('passkey registration module and routes agree on the { user } / { user, body } shape', () => {
  // Module side — the signatures the routes actually call.
  assert.match(passkeys, /export async function beginPasskeyRegistration\(\{ user \}\)/)
  assert.match(passkeys, /export async function finishPasskeyRegistration\(\{ user, body \}\)/)
  // Route side.
  assert.match(authRoutes, /beginPasskeyRegistration\(\{ user: req\.user/)
  assert.match(authRoutes, /finishPasskeyRegistration\(\{ user: req\.user, body:/)
})

test('finish registration reports failures by throwing (the route only trusts HTTP status)', () => {
  const fn = passkeys.match(/export async function finishPasskeyRegistration[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /throw new Error\(`?'?Registration challenge expired/)
  assert.match(fn, /throw new Error\('Registration verification failed/)
  // Must not silently resolve a failure — the browser treats HTTP 200 as success.
  assert.doesNotMatch(fn, /return \{ ok: false/)
  assert.match(fn, /return \{ ok: true, passkey: \{ credential_id: id \} \}/)
})
