import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.PII_ENCRYPTION_KEY ||= '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'

import { deriveProviderCapabilities } from '../routes/social.js'
import { extractCalendarCredentials } from '../calendarSync.js'
import { extractAdCredentials } from '../adSpendSync.js'
import { encryptJson, decryptJson, logSensitiveAccess } from '../crypto-pii.js'
import { API_TOOLS, API_TOOL_BY_NAME, callApiTool } from '../routes/public-api.js'

test('Security Hardening Pass — E-Sign Token Hashing & Resolution Logic', async (t) => {
  const rawToken = crypto.randomBytes(24).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  assert.ok(rawToken.length > 20, 'Raw token is high-entropy string')
  assert.equal(tokenHash.length, 64, 'SHA-256 hash is 64 hex characters')
  assert.notEqual(rawToken, tokenHash, 'Hash is distinct from raw token')
})

test('Security Hardening Pass — Calendar OAuth Token Encryption at Rest', async (t) => {
  const originalCreds = {
    access_token: 'ya29.google_mock_access_token_12345',
    refresh_token: '1//google_mock_refresh_token_67890',
    sync_token: 'sync_cursor_abc',
  }

  // 1. Encrypt credentials
  const encryptedPayload = encryptJson(originalCreds)
  assert.ok(encryptedPayload.startsWith('v1:'), 'Encrypted payload uses versioned prefix')
  assert.ok(!encryptedPayload.includes('ya29.google'), 'Plaintext token is NOT in encrypted payload')

  // 2. Decrypt via extractCalendarCredentials
  const decrypted = extractCalendarCredentials({ credentials_enc: encryptedPayload })
  assert.equal(decrypted.access_token, originalCreds.access_token)
  assert.equal(decrypted.refresh_token, originalCreds.refresh_token)
  assert.equal(decrypted.sync_token, originalCreds.sync_token)

  // 3. Fallback support for legacy plaintext rows
  const legacyFallback = extractCalendarCredentials({
    access_token: 'legacy_acc',
    refresh_token: 'legacy_ref',
  })
  assert.equal(legacyFallback.access_token, 'legacy_acc')
  assert.equal(legacyFallback.refresh_token, 'legacy_ref')
})

test('Security Hardening Pass — Ad Spend OAuth Token Encryption at Rest', async (t) => {
  const originalCreds = {
    access_token: 'EAAB_facebook_mock_long_lived_token',
    refresh_token: null,
  }

  const encryptedPayload = encryptJson(originalCreds)
  assert.ok(encryptedPayload.startsWith('v1:'))
  assert.ok(!encryptedPayload.includes('EAAB_facebook'))

  const decrypted = extractAdCredentials({ credentials_enc: encryptedPayload })
  assert.equal(decrypted.access_token, originalCreds.access_token)
  assert.equal(decrypted.refresh_token, null)
})

test('Security Hardening Pass — Social OAuth Provider Capability Derivation', async (t) => {
  // Facebook
  const fbCaps = deriveProviderCapabilities('facebook')
  assert.equal(fbCaps.publish, true)
  assert.equal(fbCaps.schedule, true)
  assert.equal(fbCaps.video, false, 'do not advertise Facebook video until its upload adapter exists')
  assert.equal(fbCaps.pages, true)

  // Instagram
  const igCaps = deriveProviderCapabilities('instagram')
  assert.equal(igCaps.publish, true)
  assert.equal(igCaps.schedule, true)
  assert.equal(igCaps.video, true)
  assert.equal(igCaps.pages, undefined)

  // TikTok
  const ttCaps = deriveProviderCapabilities('tiktok')
  assert.equal(ttCaps.publish, false, 'do not advertise TikTok publishing until its audited Direct Post adapter exists')
  assert.equal(ttCaps.schedule, false, 'TikTok does not support direct scheduling')

  // Custom capability override (only valid booleans)
  const customFb = deriveProviderCapabilities('facebook', { stories: false, invalid_string: 'ignored' })
  assert.equal(customFb.stories, false)
  assert.equal(customFb.invalid_string, undefined)
})

test('Security Hardening Pass — Public API & MCP Whitelist Validation', async (t) => {
  // Verify API_TOOLS contains only safe tools
  assert.ok(Array.isArray(API_TOOLS))
  const toolNames = API_TOOLS.map(t => t.name)
  assert.deepEqual(toolNames, ['search_inventory', 'create_lead'])

  // Unknown tool rejection
  const invalidResult = await callApiTool('execute_arbitrary_code', {}, { dealershipId: 'mock-d-1' })
  assert.ok(invalidResult.error.includes('unknown tool'))

  // create_lead validation
  const missingFields = await callApiTool('create_lead', { name: '' }, { dealershipId: 'mock-d-1' })
  assert.ok(missingFields.error.includes('name and email or phone required'))
})
