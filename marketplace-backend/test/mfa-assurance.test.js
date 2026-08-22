import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { hasAal2, mfaStepUpSatisfied } from '../mfa-assurance.js'
import { backendRouteSource } from './helpers/split-source.js'

test('MFA assurance lookup forwards the caller JWT in server-side requests', async () => {
  let receivedToken = null
  const client = {
    auth: {
      mfa: {
        async getAuthenticatorAssuranceLevel(token) {
          receivedToken = token
          return { data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }
        },
      },
    },
  }

  assert.equal(await hasAal2(client, 'verified-aal2-jwt'), true)
  assert.equal(receivedToken, 'verified-aal2-jwt')
})

test('MFA assurance rejects an aal1 session', async () => {
  const client = {
    auth: {
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          return { data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }
        },
      },
    },
  }

  assert.equal(await hasAal2(client, 'aal1-jwt'), false)
})

test('MFA assurance does not fail open when Supabase cannot verify the level', async () => {
  const expected = new Error('auth unavailable')
  const client = {
    auth: {
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          return { data: null, error: expected }
        },
      },
    },
  }

  await assert.rejects(() => hasAal2(client, 'unknown-jwt'), expected)
})

const assuranceClient = (currentLevel, nextLevel, error = null) => ({
  auth: { mfa: { async getAuthenticatorAssuranceLevel() { return { data: error ? null : { currentLevel, nextLevel }, error } } } },
})

test('step-up is satisfied for a completed aal2 session', async () => {
  assert.equal(await mfaStepUpSatisfied(assuranceClient('aal2', 'aal2'), 'jwt'), true)
})

test('step-up is satisfied when the account has no MFA factor enrolled (nextLevel aal1)', async () => {
  // No verified factor → the session can never reach aal2, so it must not be
  // locked out of the whole app.
  assert.equal(await mfaStepUpSatisfied(assuranceClient('aal1', 'aal1'), 'jwt'), true)
})

test('step-up is required when MFA is enrolled but not completed this session', async () => {
  assert.equal(await mfaStepUpSatisfied(assuranceClient('aal1', 'aal2'), 'jwt'), false)
})

test('step-up does not fail open when Supabase cannot verify the level', async () => {
  const expected = new Error('auth unavailable')
  await assert.rejects(() => mfaStepUpSatisfied(assuranceClient(null, null, expected), 'jwt'), expected)
})

test('auth flow supports native phone enrollment and login challenges', async () => {
  const authSource = backendRouteSource('auth')
  for (const route of ['/auth/2fa/phone/enroll', '/auth/2fa/phone/verify-enroll', '/auth/2fa/send-code']) {
    assert.ok(authSource.includes(route), `missing ${route}`)
  }
  assert.match(authSource, /factors\?\.phone/)
  assert.match(authSource, /factorType:\s*'phone'/)
  assert.match(authSource, /challengeId:\s*activeChallengeId/)
})
