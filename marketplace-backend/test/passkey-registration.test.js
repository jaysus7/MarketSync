import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { backendRouteSource } from './helpers/split-source.js'
import {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  recordPasskeyStepUp,
  hasRecentPasskeyStepUp,
  rpFrom
} from '../passkeys.js'
import { requireStrongStepUp, getSessionFingerprint } from '../middleware.js'

const passkeys = readFileSync(new URL('../passkeys.js', import.meta.url), 'utf8')
const authRoutes = backendRouteSource('auth')

test('passkey registration module and routes agree on signatures and step-up middleware', () => {
  assert.match(passkeys, /export async function beginPasskeyRegistration\(\{ user, reqOrigin, sessionFingerprint \}\)/)
  assert.match(passkeys, /export async function finishPasskeyRegistration\(\{ user, body, reqOrigin, sessionFingerprint \}\)/)
  assert.match(authRoutes, /app\.post\('\/auth\/passkey\/register\/begin', requireAuth, requireStrongStepUp/)
  assert.match(authRoutes, /app\.post\('\/auth\/passkey\/register\/finish', requireAuth, requireStrongStepUp/)
})

test('passkey registration enforces userVerification="required" and verifyRegistrationResponse requireUserVerification=true', () => {
  const beginFn = passkeys.match(/export async function beginPasskeyRegistration[\s\S]*?\n\}/)?.[0] || ''
  assert.match(beginFn, /userVerification:\s*'required'/, 'Registration options must specify userVerification: required')

  const finishFn = passkeys.match(/export async function finishPasskeyRegistration[\s\S]*?\n\}/)?.[0] || ''
  assert.match(finishFn, /requireUserVerification:\s*true/, 'Registration verification must require requireUserVerification: true')
})

test('missing step-up: requireStrongStepUp blocks weak un-stepped-up sessions', async () => {
  const req = {
    user: { id: 'test-user-stepup-1' },
    headers: {
      authorization: 'Bearer mock-jwt-token-without-stepup'
    }
  }
  let nextCalled = false
  let statusSent = null
  let jsonSent = null
  const res = {
    status(code) { statusSent = code; return this },
    json(payload) { jsonSent = payload; return this }
  }

  await requireStrongStepUp(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, false, 'weak session without step-up must not proceed')
  assert.equal(statusSent, 403)
  assert.equal(jsonSent?.error, 'STRONG_STEP_UP_REQUIRED')

  // Step up this session
  const fp = getSessionFingerprint(req)
  recordPasskeyStepUp(req.user.id, fp)

  nextCalled = false
  await requireStrongStepUp(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true, 'stepped-up session must proceed')
})

test('wrong user/session: finish registration fails if session or user differs from challenge', async () => {
  const userA = { id: '00000000-0000-0000-0000-000000000001', email: 'alice@example.com' }
  const userB = { id: '00000000-0000-0000-0000-000000000002', email: 'bob@example.com' }
  const sessionA = 'session-fingerprint-aaa'
  const sessionB = 'session-fingerprint-bbb'
  const origin = 'https://marketsync.link'

  const options = await beginPasskeyRegistration({
    user: userA,
    reqOrigin: origin,
    sessionFingerprint: sessionA
  })
  assert.ok(options?.challenge, 'options must include challenge')

  // Attempt finish with userB
  await assert.rejects(
    async () => {
      await finishPasskeyRegistration({
        user: userB,
        body: { response: { id: 'mock-cred' } },
        reqOrigin: origin,
        sessionFingerprint: sessionA
      })
    },
    /Registration challenge expired|User mismatch/
  )

  // Begin again for userA
  await beginPasskeyRegistration({
    user: userA,
    reqOrigin: origin,
    sessionFingerprint: sessionA
  })

  // Attempt finish with different session
  await assert.rejects(
    async () => {
      await finishPasskeyRegistration({
        user: userA,
        body: { response: { id: 'mock-cred' } },
        reqOrigin: origin,
        sessionFingerprint: sessionB
      })
    },
    /Session mismatch/
  )
})

test('wrong origin: finish registration fails if request origin mismatches challenge origin', async () => {
  const user = { id: '00000000-0000-0000-0000-000000000003', email: 'charlie@example.com' }
  const session = 'session-fingerprint-ccc'
  const origin1 = 'https://staging.onrender.com'
  const origin2 = 'https://malicious.origin.com'

  await beginPasskeyRegistration({
    user,
    reqOrigin: origin1,
    sessionFingerprint: session
  })

  await assert.rejects(
    async () => {
      await finishPasskeyRegistration({
        user,
        body: { response: { id: 'mock-cred' } },
        reqOrigin: origin2,
        sessionFingerprint: session
      })
    },
    /Origin mismatch/
  )
})

test('expired or reused challenge: second attempt with consumed challenge fails immediately', async () => {
  const user = { id: '00000000-0000-0000-0000-000000000004', email: 'david@example.com' }
  const session = 'session-fingerprint-ddd'
  const origin = 'https://marketsync.link'

  await beginPasskeyRegistration({
    user,
    reqOrigin: origin,
    sessionFingerprint: session
  })

  // First consumption: will fail verification or throw, but consumes the challenge
  try {
    await finishPasskeyRegistration({
      user,
      body: { response: { id: 'mock-cred', response: { clientDataJSON: 'e30', attestationObject: 'e30' } } },
      reqOrigin: origin,
      sessionFingerprint: session
    })
  } catch (e) {
    // Expected to fail mock verification
  }

  // Second consumption (reused challenge): must throw challenge expired
  await assert.rejects(
    async () => {
      await finishPasskeyRegistration({
        user,
        body: { response: { id: 'mock-cred' } },
        reqOrigin: origin,
        sessionFingerprint: session
      })
    },
    /Registration challenge expired/
  )
})

test('successful biometric/PIN registration requires valid verificationInfo and throws on failure', () => {
  const fn = passkeys.match(/export async function finishPasskeyRegistration[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /throw new Error\(`?'?Registration challenge expired/)
  assert.match(fn, /throw new Error\('Registration verification failed/)
  assert.doesNotMatch(fn, /return \{ ok: false/)
  assert.match(fn, /return \{ ok: true, passkey: \{ credential_id: id \} \}/)
})
