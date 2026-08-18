import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { backendRouteSource } from './helpers/split-source.js'

const passkeys = readFileSync(new URL('../passkeys.js', import.meta.url), 'utf8')
const authRoutes = backendRouteSource('auth')  // routes/auth.js + routes/submodules/auth-*.js

test('passkey login module and routes agree on the { email } / { body } shape', () => {
  assert.match(passkeys, /export async function beginPasskeyLogin\(\{ email \}\)/)
  assert.match(passkeys, /export async function finishPasskeyLogin\(\{ body \}\)/)
  assert.match(authRoutes, /beginPasskeyLogin\(\{ email \}\)/)
  assert.match(authRoutes, /finishPasskeyLogin\(\{ body: req\.body/)
})

test('finish login throws on failure and returns a real session', () => {
  const fn = passkeys.match(/export async function finishPasskeyLogin[\s\S]*?\n\}/)?.[0] || ''
  // Never resolve a failure as success — the browser only checks HTTP status.
  assert.doesNotMatch(fn, /return \{ ok: false/)
  assert.match(fn, /throw new Error\('Unknown passkey\.'\)/)
  assert.match(fn, /throw new Error\('Passkey verification failed\.'\)/)
  // Returns access + refresh tokens for the frontend to store as a session.
  assert.match(fn, /access_token: verified\.session\.access_token/)
  assert.match(fn, /refresh_token: verified\.session\.refresh_token/)
})

test('login session mint is bound to the credential OWNER, not the client-supplied email', () => {
  const fn = passkeys.match(/export async function finishPasskeyLogin[\s\S]*?\n\}/)?.[0] || ''
  // The email used for the mint comes from the account (getUserById), not the body.
  assert.match(fn, /getUserById\(cred\.user_id\)/)
  assert.match(fn, /const ownerEmail = got\?\.user\?\.email/)
  assert.match(fn, /generateLink\(\{ type: 'magiclink', email: ownerEmail \}\)/)
  assert.match(fn, /verifyOtp\(\{ type: 'email', email: ownerEmail/)
})

test('the OTP is verified on a throwaway client, never the shared anon client', () => {
  const fn = passkeys.match(/export async function finishPasskeyLogin[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /const ephemeral = createClient\([\s\S]*?persistSession: false/)
  assert.match(fn, /ephemeral\.auth\.verifyOtp/)
})
