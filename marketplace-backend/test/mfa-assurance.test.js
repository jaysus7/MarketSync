import test from 'node:test'
import assert from 'node:assert/strict'
import { hasAal2 } from '../mfa-assurance.js'

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
