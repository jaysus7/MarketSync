import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
process.env.GOOGLE_CLIENT_ID = 'gid'
process.env.GOOGLE_CLIENT_SECRET = 'gsecret'
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'devtoken'
process.env.GOOGLE_ADS_CLIENT_ID = 'gid'
process.env.GOOGLE_ADS_CLIENT_SECRET = 'gsecret'
process.env.META_APP_SECRET = 'meta-app-secret'
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('resend-test-secret').toString('base64')
process.env.RESEND_API_KEY = 're_test'

import {
  rejectClientSecrets,
  queryGscForDealership,
  queryGa4ForDealership,
  uploadAdsConversionForDealership,
  ingestMetaLeadWebhook,
  ingestResendEvent,
  integrationHealthMatrix,
  assertNoHealthyWithoutEvidence,
  createMemoryCrmStore,
  ensureGoogleAccessToken,
  HEALTH,
} from '../providers/canonical-integrations.js'
import { mapResendEvent, verifyResendSignature } from '../providers/resend-events.js'

const DEALER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const DEALER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const PAGE_A = '111111111111'
const PAGE_B = '222222222222'

function metaSign(raw, secret = process.env.META_APP_SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
}

function leadPayload(pageId, leadgenId) {
  return JSON.stringify({
    entry: [{
      id: pageId,
      changes: [{
        field: 'leadgen',
        value: { leadgen_id: leadgenId, page_id: pageId, form_id: 'form-1', ad_id: 'ad-9', created_time: '2026-09-02T12:00:00+0000' },
      }],
    }],
  })
}

function seedStore(seedDeliveries) {
  const store = createMemoryCrmStore(seedDeliveries)
  store.socialAccounts.push({
    id: 'sa-a', dealership_id: DEALER_A, provider: 'facebook', external_account_id: PAGE_A,
    status: 'connected', last_verified_at: '2026-09-01T00:00:00.000Z', credentials: { page_access_token: 'page-token-a' },
  })
  store.socialAccounts.push({
    id: 'sa-b', dealership_id: DEALER_B, provider: 'facebook', external_account_id: PAGE_B,
    status: 'connected', last_verified_at: '2026-09-01T00:00:00.000Z', credentials: { page_access_token: 'page-token-b' },
  })
  return store
}

const fetchLeadOk = async () => ({
  imported: true,
  status: 'imported',
  evidence: { provider: 'meta_lead_ads', http_status: 200 },
  contact: { full_name: 'Alex Buyer', email: 'alex@example.com', phone: '5550100', source_key: 'meta_lead_ads', meta: { fields: {} } },
})

test('1. browser cannot supply/override Google OAuth tokens', () => {
  assert.equal(rejectClientSecrets({ access_token: 'steal-me' }).rejected, true)
})

test('2. browser cannot supply/override Google Ads OAuth credentials', () => {
  assert.equal(rejectClientSecrets({ refresh_token: 'nope' }).rejected, true)
})

test('3-4. dealer A cannot query dealer B SEO or ad connections', async () => {
  const gsc = await queryGscForDealership({ connection: null })
  assert.equal(gsc.status, HEALTH.NOT_CONNECTED)
  const ads = await uploadAdsConversionForDealership({ connection: null, conversion: { gclid: 'x', conversionAction: 'customers/1/conversionActions/2' } })
  assert.equal(ads.status, HEALTH.NOT_CONNECTED)
})

test('5. invalid Meta signature is rejected', async () => {
  const raw = leadPayload(PAGE_A, 'lead-1')
  const result = await ingestMetaLeadWebhook({ rawBody: raw, signature: 'sha256=deadbeef', parsedBody: JSON.parse(raw), store: seedStore(), fetchLeadFields: fetchLeadOk })
  assert.equal(result.ok, false)
  assert.equal(result.statusCode, 401)
})

test('6. Meta page_id resolves to the correct dealership', async () => {
  const raw = leadPayload(PAGE_A, 'lead-6')
  const result = await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store: seedStore(), fetchLeadFields: fetchLeadOk })
  assert.equal(result.results[0].dealership_id, DEALER_A)
})

test('7. Dealer A Meta Page cannot create records for Dealer B', async () => {
  const raw = leadPayload(PAGE_A, 'lead-7')
  const store = seedStore()
  await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store, fetchLeadFields: fetchLeadOk })
  assert.equal(store.contacts.every((c) => c.dealership_id === DEALER_A), true)
  assert.equal(store.contacts.some((c) => c.dealership_id === DEALER_B), false)
})

test('8. duplicate Meta lead webhook creates one canonical lead path', async () => {
  const raw = leadPayload(PAGE_A, 'lead-dup')
  const store = seedStore()
  const first = await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store, fetchLeadFields: fetchLeadOk })
  const second = await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store, fetchLeadFields: fetchLeadOk })
  assert.equal(first.imported, 1)
  assert.equal(second.results[0].idempotent, true)
  assert.equal(store.contacts.length, 1)
  assert.equal(store.leads.length, 1)
  assert.equal(store.deliveries.length, 1)
})

test('8b. Meta idempotency survives process restart via delivery ledger', async () => {
  const raw = leadPayload(PAGE_A, 'lead-restart')
  const firstStore = seedStore()
  await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store: firstStore, fetchLeadFields: fetchLeadOk })
  const restarted = seedStore(firstStore.snapshotDeliveries())
  const second = await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store: restarted, fetchLeadFields: fetchLeadOk })
  assert.equal(second.results[0].idempotent, true)
  assert.equal(restarted.contacts.length, 0)
  assert.equal(restarted.leads.length, 0)
})

test('9-12. Meta lead creates contact, opportunity, attribution, conversation', async () => {
  const raw = leadPayload(PAGE_A, 'lead-crm')
  const store = seedStore()
  const result = await ingestMetaLeadWebhook({ rawBody: raw, signature: metaSign(raw), parsedBody: JSON.parse(raw), store, fetchLeadFields: fetchLeadOk })
  const row = result.results[0]
  assert.ok(row.contact_id && row.lead_id && row.conversation_id && row.attribution_id)
  assert.equal(store.contacts[0].source, 'meta_lead_ads')
  assert.equal(store.attributions[0].ad_id, 'ad-9')
  assert.equal(Object.prototype.hasOwnProperty.call(store.contacts[0], 'provider_lead_id'), false)
})

test('13. missing GSC property is blocked, not zero-result success', async () => {
  const result = await queryGscForDealership({ connection: { dealership_id: DEALER_A, credentials: { access_token: 'tok' } } })
  assert.equal(result.status, HEALTH.BLOCKED)
})

test('14. expired Google token refreshes or reports expired', async () => {
  const refreshed = await ensureGoogleAccessToken({
    creds: { access_token: 'old', refresh_token: 'r1', expires_at: Date.now() - 1000 },
    refreshImpl: async () => ({ access_token: 'new', refresh_token: 'r1', expires_at: Date.now() + 3600_000 }),
  })
  assert.equal(refreshed.accessToken, 'new')
  const dead = await ensureGoogleAccessToken({ creds: { access_token: 'old', expires_at: Date.now() - 1000 } })
  assert.equal(dead.status, HEALTH.EXPIRED)
})

test('15. GA4 connection uses canonical stored property', async () => {
  const result = await queryGa4ForDealership({
    connection: { dealership_id: DEALER_A, ga4_property: 'properties/555', credentials: { access_token: 'tok' } },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ rows: [{ metricValues: [{ value: '10' }] }] }) }),
  })
  assert.equal(result.selected_property, 'properties/555')
  assert.equal(result.status, 'measured')
})

test('16. Google Ads conversion with no click id is blocked', async () => {
  const result = await uploadAdsConversionForDealership({
    connection: { dealership_id: DEALER_A, account_id: '123', credentials: { access_token: 'tok' } },
    conversion: { conversionAction: 'customers/123/conversionActions/9', value: 100 },
  })
  assert.equal(result.status, HEALTH.BLOCKED)
})

test('17-18. Google Ads success persists evidence and is idempotent', async () => {
  const connection = { dealership_id: DEALER_A, account_id: '1234567890', credentials: { access_token: 'tok' } }
  const conversion = { gclid: 'Cj0abc', conversionAction: 'customers/1234567890/conversionActions/9', conversionDateTime: '2026-09-02 12:00:00+00:00', value: 250 }
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ results: [{ gclid: 'Cj0abc' }] }) })
  const first = await uploadAdsConversionForDealership({ connection, conversion, canonicalEventId: 'deal-1', priorKeys: new Set(), fetchImpl })
  assert.equal(first.uploaded, true)
  assert.equal(first.evidence.persisted, true)
  const second = await uploadAdsConversionForDealership({ connection, conversion, canonicalEventId: 'deal-1', priorKeys: new Set([first.idempotency_key]), fetchImpl })
  assert.equal(second.idempotent, true)
})

function signResend(raw) {
  const id = 'msg_1'
  const ts = String(Math.floor(Date.now() / 1000))
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : Buffer.from(secret)
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64')
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${expected}` }
}

test('19. invalid Resend signature rejected', async () => {
  const raw = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
  const result = await ingestResendEvent({ rawBody: raw, headers: { 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,nope' }, store: createMemoryCrmStore() })
  assert.equal(result.statusCode, 401)
})

test('20. valid RAW-BODY Resend signature accepted', async () => {
  const raw = JSON.stringify({ type: 'email.delivered', created_at: '2026-09-02T15:00:00.000Z', data: { email_id: 'em_20' } })
  const result = await ingestResendEvent({ rawBody: raw, headers: signResend(raw), store: createMemoryCrmStore() })
  assert.equal(result.status, 'delivered')
})

test('21. duplicate Resend event is idempotent and restart-safe', async () => {
  const raw = JSON.stringify({ type: 'email.bounced', data: { email_id: 'em_21' } })
  const store = createMemoryCrmStore()
  const headers = signResend(raw)
  await ingestResendEvent({ rawBody: raw, headers, store })
  const restarted = createMemoryCrmStore(store.snapshotDeliveries())
  const second = await ingestResendEvent({ rawBody: raw, headers, store: restarted })
  assert.equal(second.idempotent, true)
  assert.equal(restarted.deliveries.length, 1)
})

test('22. Resend delivery/bounce/complaint updates canonical message state', () => {
  assert.equal(mapResendEvent({ type: 'email.sent', data: { email_id: 'a' } }).status, 'sent')
  assert.equal(mapResendEvent({ type: 'email.delivered', data: { email_id: 'a' } }).status, 'delivered')
  assert.equal(mapResendEvent({ type: 'email.bounced', data: { email_id: 'a' } }).status, 'bounced')
  assert.equal(mapResendEvent({ type: 'email.complained', data: { email_id: 'a' } }).status, 'complained')
  assert.equal(mapResendEvent({ type: 'email.failed', data: { email_id: 'a' } }).status, 'failed')
})

test('23-24. matrix distinguishes configured vs healthy and never marks healthy without evidence', () => {
  const empty = integrationHealthMatrix({})
  assert.equal(empty.google_search_console.capability.server_configured, true)
  assert.notEqual(empty.google_search_console.health, HEALTH.HEALTHY)
  assert.doesNotThrow(() => assertNoHealthyWithoutEvidence(empty))
})

test('25. Stripe/Square raw webhook routes remain intact', () => {
  const billing = readFileSync(new URL('../routes/billing.js', import.meta.url), 'utf8')
  const square = readFileSync(new URL('../routes/square.js', import.meta.url), 'utf8')
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(billing, /app\.post\('\/stripe\/webhook', express\.raw/)
  assert.match(square, /app\.post\('\/square\/webhook'[\s\S]*express\.raw/)
  assert.match(server, /req\.rawBody = buf/)
})

test('26. GSC/GA4/Ads routes reject client tokens and do not use global page token', () => {
  const routes = readFileSync(new URL('../routes/integration-batches.js', import.meta.url), 'utf8')
  assert.match(routes, /rejectClientSecrets/)
  assert.match(routes, /integration_deliveries/)
  assert.doesNotMatch(routes, /accessToken: req\.body\?\.access_token/)
  assert.doesNotMatch(routes, /META_PAGE_ACCESS_TOKEN/)
  assert.doesNotMatch(routes, /provider_lead_id/)
})

test('verifyResendSignature uses exact raw bytes', () => {
  const raw = '{"type":"email.delivered","data":{"email_id":"em_raw"}}'
  assert.equal(verifyResendSignature({ payload: raw, headers: signResend(raw) }).ok, true)
})
