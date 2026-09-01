import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

import {
  socialOAuthConfig,
  socialOAuthConfigured,
  signSocialOAuthState,
  verifySocialOAuthState,
  socialOAuthAuthorizeUrl,
  socialOAuthRedirectUri,
  KNOWN_PROVIDERS,
} from '../providers/social-providers.js'
import { deriveProviderCapabilities } from '../routes/social.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

// ── 1. OAuth Configuration & State Signature Security ───────────────────────

test('socialOAuthConfigured correctly reflects environment credentials', () => {
  const origFbId = process.env.FACEBOOK_APP_ID
  const origFbSec = process.env.FACEBOOK_APP_SECRET
  try {
    delete process.env.FACEBOOK_APP_ID
    delete process.env.FACEBOOK_CLIENT_ID
    delete process.env.META_APP_ID
    delete process.env.FACEBOOK_APP_SECRET
    delete process.env.FACEBOOK_CLIENT_SECRET
    delete process.env.META_APP_SECRET

    assert.equal(socialOAuthConfigured('facebook'), false, 'facebook must report unconfigured without env')

    process.env.FACEBOOK_APP_ID = 'test-fb-id-123'
    process.env.FACEBOOK_APP_SECRET = 'test-fb-secret-456'
    assert.equal(socialOAuthConfigured('facebook'), true, 'facebook must report configured with env')
  } finally {
    if (origFbId !== undefined) process.env.FACEBOOK_APP_ID = origFbId; else delete process.env.FACEBOOK_APP_ID
    if (origFbSec !== undefined) process.env.FACEBOOK_APP_SECRET = origFbSec; else delete process.env.FACEBOOK_APP_SECRET
  }
})

test('signed OAuth state cryptographically protects against CSRF and tenant confusion', () => {
  const payload = {
    uid: '00000000-0000-0000-0000-000000000001',
    did: '11111111-1111-1111-1111-111111111111',
    p: 'facebook',
    ownership: 'dealership',
    kind: 'social',
  }

  const state = signSocialOAuthState(payload)
  assert.ok(state && state.includes('.'), 'signed state must include payload and HMAC signature')

  // Verification succeeds on untampered state
  const verified = verifySocialOAuthState(state)
  assert.ok(verified, 'valid state must verify successfully')
  assert.equal(verified.uid, payload.uid)
  assert.equal(verified.did, payload.did)
  assert.equal(verified.p, 'facebook')
  assert.equal(verified.ownership, 'dealership')

  // Tampered payload fails verification
  const [b64, mac] = state.split('.')
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, did: '22222222-2222-2222-2222-222222222222', ts: Date.now() })).toString('base64url')
  assert.equal(verifySocialOAuthState(`${tamperedPayload}.${mac}`), null, 'tampered payload must fail signature verification')

  // Tampered MAC fails
  assert.equal(verifySocialOAuthState(`${b64}.badsignature123`), null, 'tampered MAC must fail verification')

  // Expired state (>15 minutes) fails
  const expiredPayload = { ...payload, ts: Date.now() - (16 * 60 * 1000) }
  const expiredState = signSocialOAuthState(expiredPayload)
  assert.equal(verifySocialOAuthState(expiredState), null, 'expired state must be rejected')
})

test('socialOAuthAuthorizeUrl builds valid provider URLs with state and redirect_uri', () => {
  const origFbId = process.env.FACEBOOK_APP_ID
  const origFbSec = process.env.FACEBOOK_APP_SECRET
  try {
    process.env.FACEBOOK_APP_ID = 'test-fb-id-789'
    process.env.FACEBOOK_APP_SECRET = 'test-fb-secret-abc'

    const state = 'signed-state-mock-token'
    const urlStr = socialOAuthAuthorizeUrl('facebook', state)
    const url = new URL(urlStr)

    assert.equal(url.hostname, 'www.facebook.com')
    assert.equal(url.searchParams.get('client_id'), 'test-fb-id-789')
    assert.equal(url.searchParams.get('state'), state)
    assert.match(url.searchParams.get('redirect_uri'), /\/social\/callback\/facebook/)
    assert.match(url.searchParams.get('scope'), /pages_manage_posts/)
  } finally {
    if (origFbId !== undefined) process.env.FACEBOOK_APP_ID = origFbId; else delete process.env.FACEBOOK_APP_ID
    if (origFbSec !== undefined) process.env.FACEBOOK_APP_SECRET = origFbSec; else delete process.env.FACEBOOK_APP_SECRET
  }
})

// ── 2. Provider Capability Derivation Security ──────────────────────────────

test('capabilities are derived authoritatively and cannot be arbitrarily fabricated', () => {
  const fbCaps = deriveProviderCapabilities('facebook')
  assert.equal(fbCaps.publish, true)
  assert.equal(fbCaps.schedule, true)
  assert.equal(fbCaps.pages, true)

  const tiktokCaps = deriveProviderCapabilities('tiktok')
  assert.equal(tiktokCaps.publish, false, 'do not advertise publishing until a production adapter exists')
  assert.equal(tiktokCaps.schedule, false, 'tiktok does not support scheduling')

  const unknownCaps = deriveProviderCapabilities('unknown')
  assert.equal(unknownCaps.schedule, false)
})

test('OAuth selection is one-time, dealership-scoped, and keeps candidate credentials encrypted', () => {
  const migration = read('../migrations/2026-08-27-social-oauth-connections.sql')
  const social = read('../routes/social.js')
  assert.match(migration, /create table if not exists public\.social_oauth_sessions/)
  assert.match(migration, /dealership_id uuid not null references public\.dealerships/)
  assert.match(migration, /state_hash text not null unique/)
  assert.match(migration, /candidate_credentials_enc text/)
  assert.match(social, /app\.get\('\/social\/oauth\/sessions\/:id'/)
  assert.match(social, /app\.post\('\/social\/oauth\/sessions\/:id\/select'/)
  assert.match(social, /\.eq\('dealership_id', req\.dealershipId\)\.eq\('user_id', req\.user\.id\)/)
  assert.match(social, /status: 'consumed'/)
  assert.match(social, /state_hash: socialOAuthStateHash/)
})

test('provider capabilities expose explicit text/image/video/comment/insight decisions', () => {
  const providers = read('../providers/social-providers.js')
  for (const key of ['can_publish_text', 'can_publish_image', 'can_publish_video', 'can_read_comments', 'can_read_insights']) assert.match(providers, new RegExp(key))
  assert.match(providers, /tiktok: \{ can_publish_text: false, can_publish_image: false, can_publish_video: false/)
  assert.match(providers, /socialOAuthRefreshToken/)
  assert.match(providers, /socialOAuthRevokeToken/)
})

test('disconnect revokes provider access before clearing encrypted credentials', () => {
  const social = read('../routes/social.js')
  const route = social.match(/app\.delete\('\/social\/accounts\/:id'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /socialOAuthRevokeToken/)
  assert.match(route, /credentials_enc: null/)
  assert.match(route, /status: 'revoked'/)
})
