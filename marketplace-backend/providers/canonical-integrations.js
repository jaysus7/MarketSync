/**
 * Canonical tenant-safe integration engine (Batches E–I).
 * Tokens never come from the browser. Inbound webhooks persist idempotency
 * on integration_deliveries (existing ledger), not in-process memory.
 */
import crypto from 'node:crypto'
import { fetchSearchConsole, fetchGa4, googleSuiteConfigured } from './google-suite.js'
import { googleAdsConversionsConfigured, normalizeOfflineConversion, uploadOfflineConversion } from './google-ads-conversions.js'
import { metaAppSecret, normalizeLeadgenWebhook, fetchLeadgenFields } from './meta-lead-ads.js'
import { resendEventsConfigured, resendSendingConfigured, verifyResendSignature, mapResendEvent } from './resend-events.js'

export const PLATFORM_DEALERSHIP_ID = '00000000-0000-0000-0000-000000000000'
export const META_METHOD = 'meta_lead_ads'
export const RESEND_METHOD = 'resend_webhook'

export const HEALTH = {
  NOT_CONNECTED: 'not_connected',
  AUTHORIZATION_REQUIRED: 'authorization_required',
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
  PARTNER_BLOCKED: 'partner_blocked',
  FAILED: 'failed',
}

function envPair(a, b) { return !!(process.env[a] && process.env[b]) }
function googleAdsAppConfigured() {
  return !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && (process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID))
}

export function rejectClientSecrets(body = {}) {
  const banned = ['access_token', 'refresh_token', 'client_secret', 'page_access_token', 'credentials', 'credentials_enc', 'developer_token']
  const found = banned.filter((k) => body[k] != null && body[k] !== '')
  if (found.length) return { rejected: true, reason: `Client may not supply provider secrets: ${found.join(', ')}` }
  return { rejected: false }
}

export function extractStoredGoogleCreds(row = {}) {
  if (row.credentials && typeof row.credentials === 'object') {
    return {
      access_token: row.credentials.access_token || null,
      refresh_token: row.credentials.refresh_token || null,
      expires_at: row.credentials.expires_at || row.token_expires_at || null,
    }
  }
  return {
    access_token: row.access_token || null,
    refresh_token: row.refresh_token || null,
    expires_at: row.token_expires_at || row.expires_at || null,
  }
}

export function tokenNeedsRefresh(creds, now = Date.now()) {
  if (!creds?.access_token) return true
  if (!creds.expires_at) return false
  const exp = typeof creds.expires_at === 'number' ? creds.expires_at : Date.parse(creds.expires_at)
  if (!Number.isFinite(exp)) return false
  return exp - 60_000 <= now
}

export function deterministicUuid(...parts) {
  const h = crypto.createHash('sha256').update(parts.map(String).join('|')).digest()
  h[6] = (h[6] & 0x0f) | 0x40
  h[8] = (h[8] & 0x3f) | 0x80
  const hex = h.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function metaIdempotencyKey(dealershipId, leadgenId) {
  return `meta|${dealershipId}|${leadgenId}`
}

export function resendIdempotencyKey(emailId, type, eventId) {
  return `resend|${eventId || emailId}|${type || 'event'}`
}

export async function ensureGoogleAccessToken({ creds, refreshImpl } = {}) {
  if (!creds?.access_token && !creds?.refresh_token) {
    return { status: HEALTH.NOT_CONNECTED, reason: 'No Google tokens in seo_connections.' }
  }
  if (!tokenNeedsRefresh(creds)) return { status: 'ok', accessToken: creds.access_token, refreshed: false, creds }
  if (!creds.refresh_token) return { status: HEALTH.EXPIRED, reason: 'Google access token expired and no refresh token is stored.' }
  if (typeof refreshImpl !== 'function') {
    return { status: HEALTH.AUTHORIZATION_REQUIRED, reason: 'Token refresh required but no refresh helper provided.' }
  }
  try {
    const next = await refreshImpl(creds.refresh_token)
    if (!next?.access_token) return { status: HEALTH.EXPIRED, reason: 'Google token refresh returned no access token.' }
    return {
      status: 'ok',
      accessToken: next.access_token,
      refreshed: true,
      creds: {
        access_token: next.access_token,
        refresh_token: next.refresh_token || creds.refresh_token,
        expires_at: next.expires_at || Date.now() + 3500 * 1000,
      },
    }
  } catch (err) {
    return { status: HEALTH.EXPIRED, reason: err?.message || 'Google token refresh failed.' }
  }
}

export async function queryGscForDealership({ connection, startDate, endDate, fetchImpl, refreshImpl } = {}) {
  if (!connection) return { status: HEALTH.NOT_CONNECTED, provider: 'google_search_console', reason: 'No seo_connections row for this dealership.' }
  const siteUrl = connection.gsc_site || connection.gsc_property || connection.selected_gsc_site || null
  if (!siteUrl) return { status: HEALTH.BLOCKED, provider: 'google_search_console', reason: 'No Search Console property selected.', last_error: 'missing_gsc_site' }
  const ensured = await ensureGoogleAccessToken({ creds: extractStoredGoogleCreds(connection), refreshImpl })
  if (ensured.status !== 'ok') return { status: ensured.status, provider: 'google_search_console', reason: ensured.reason, property: siteUrl }
  const result = await fetchSearchConsole({ accessToken: ensured.accessToken, siteUrl, startDate, endDate, fetchImpl })
  return { ...result, refreshed: !!ensured.refreshed, selected_property: siteUrl }
}

export async function queryGa4ForDealership({ connection, startDate, endDate, fetchImpl, refreshImpl } = {}) {
  if (!connection) return { status: HEALTH.NOT_CONNECTED, provider: 'google_analytics_4', reason: 'No seo_connections row for this dealership.' }
  const propertyId = connection.ga4_property || connection.ga4_property_id || connection.selected_ga4_property || null
  if (!propertyId) return { status: HEALTH.BLOCKED, provider: 'google_analytics_4', reason: 'No GA4 property selected.', last_error: 'missing_ga4_property' }
  const ensured = await ensureGoogleAccessToken({ creds: extractStoredGoogleCreds(connection), refreshImpl })
  if (ensured.status !== 'ok') return { status: ensured.status, provider: 'google_analytics_4', reason: ensured.reason, property: propertyId }
  const result = await fetchGa4({ accessToken: ensured.accessToken, propertyId, startDate, endDate, fetchImpl })
  return { ...result, refreshed: !!ensured.refreshed, selected_property: propertyId }
}

export function conversionIdempotencyKey({ customerId, conversion } = {}) {
  const row = normalizeOfflineConversion(conversion)
  return crypto.createHash('sha256').update([customerId || '', row.clickId, row.conversionAction, row.conversionDateTime].join('|')).digest('hex')
}

export async function uploadAdsConversionForDealership({
  connection, conversion, canonicalEventId, priorKeys = new Set(), fetchImpl, refreshImpl,
} = {}) {
  if (!connection) return { uploaded: false, status: HEALTH.NOT_CONNECTED, reason: 'No ad_connections row for google_ads.' }
  const customerId = connection.account_id || connection.customer_id || connection.google_customer_id
  const row = normalizeOfflineConversion(conversion)
  if (!row.clickId) return { uploaded: false, status: HEALTH.BLOCKED, reason: 'No gclid/gbraid/wbraid — cannot claim an Ads click.' }
  const key = conversionIdempotencyKey({ customerId, conversion: row })
  if (priorKeys.has(key)) {
    return { uploaded: false, status: 'duplicate', idempotent: true, idempotency_key: key, reason: 'Conversion already uploaded for this click + action.' }
  }
  const ensured = await ensureGoogleAccessToken({ creds: extractStoredGoogleCreds(connection), refreshImpl })
  if (ensured.status !== 'ok') return { uploaded: false, status: ensured.status, reason: ensured.reason }
  const result = await uploadOfflineConversion({ accessToken: ensured.accessToken, customerId, conversion: row, fetchImpl })
  if (result.uploaded) {
    result.idempotency_key = key
    result.canonical_event_id = canonicalEventId || null
    result.customer_id = String(customerId || '').replace(/-/g, '')
    result.evidence = { ...(result.evidence || {}), persisted: true, uploaded_at: new Date().toISOString(), canonical_event_id: canonicalEventId || null }
  }
  return result
}

export function verifyMetaSignature({ rawBody, signature, secret } = {}) {
  const key = secret || metaAppSecret()
  if (!key) return { ok: false, reason: 'META_APP_SECRET is not set.' }
  const header = String(signature || '')
  const hex = header.startsWith('sha256=') ? header.slice(7) : header
  if (!hex) return { ok: false, reason: 'Missing X-Hub-Signature-256.' }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8')
  const expected = crypto.createHmac('sha256', key).update(body).digest('hex')
  const a = Buffer.from(hex)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'Invalid Meta webhook signature.' }
  return { ok: true }
}

export function createMemoryCrmStore(seedDeliveries = []) {
  return {
    socialAccounts: [],
    contacts: [],
    leads: [],
    conversations: [],
    events: [],
    attributions: [],
    emailEvents: [],
    deliveries: seedDeliveries.map((d) => ({ ...d })),
    async findSocialAccountByPageId(pageId) {
      return this.socialAccounts.find((a) => String(a.external_account_id) === String(pageId) && a.status !== 'revoked') || null
    },
    async findDelivery({ dealershipId, method, provider, idempotencyKey }) {
      return this.deliveries.find((d) =>
        d.dealership_id === dealershipId &&
        d.method === method &&
        (d.provider || '') === (provider || '') &&
        d.payload?.idempotency_key === idempotencyKey
      ) || null
    },
    async insertDelivery(row) {
      const existing = await this.findDelivery({
        dealershipId: row.dealership_id,
        method: row.method,
        provider: row.provider,
        idempotencyKey: row.payload?.idempotency_key,
      })
      if (existing) return { ...existing, duplicate: true }
      const created = { id: row.id || crypto.randomUUID(), ...row, duplicate: false }
      this.deliveries.push(created)
      return created
    },
    async upsertContact(row) {
      const existing = this.contacts.find((c) =>
        c.dealership_id === row.dealership_id && (
          (row.email && c.email === row.email) ||
          (row.phone && c.phone === row.phone)
        ))
      if (existing) {
        Object.assign(existing, { last_activity_at: row.last_activity_at, source: existing.source || row.source })
        return existing
      }
      const created = { id: row.id || crypto.randomUUID(), ...row }
      this.contacts.push(created)
      return created
    },
    async insertLead(row) {
      const created = { id: row.id || crypto.randomUUID(), ...row }
      this.leads.push(created)
      return created
    },
    async insertConversation(row) {
      const created = { id: row.id || crypto.randomUUID(), ...row }
      this.conversations.push(created)
      return created
    },
    async insertEvent(row) {
      const created = { id: row.id || crypto.randomUUID(), ...row }
      this.events.push(created)
      return created
    },
    async insertAttribution(row) {
      const created = { id: row.id || crypto.randomUUID(), ...row }
      this.attributions.push(created)
      return created
    },
    snapshotDeliveries() {
      return this.deliveries.map((d) => ({ ...d, payload: { ...d.payload } }))
    },
  }
}

export async function ingestMetaLeadWebhook({
  rawBody, signature, parsedBody, store, fetchImpl, fetchLeadFields = fetchLeadgenFields, now = new Date(),
} = {}) {
  const verified = verifyMetaSignature({ rawBody, signature })
  if (!verified.ok) return { ok: false, statusCode: 401, error: verified.reason }

  const body = parsedBody || (typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : {})
  const incoming = normalizeLeadgenWebhook(body)
  if (!incoming.length) return { ok: true, statusCode: 200, received: true, imported: 0, reason: 'No leadgen_id in payload.' }

  const results = []
  for (const lead of incoming) {
    const account = await store.findSocialAccountByPageId(lead.page_id)
    if (!account) {
      results.push({ leadgen_id: lead.leadgen_id, imported: false, status: HEALTH.NOT_CONNECTED, reason: 'No social_accounts row for this page_id.' })
      continue
    }
    const dealershipId = account.dealership_id
    const idempotencyKey = metaIdempotencyKey(dealershipId, lead.leadgen_id)
    const existing = await store.findDelivery({
      dealershipId, method: META_METHOD, provider: 'meta', idempotencyKey,
    })
    if (existing) {
      results.push({
        leadgen_id: lead.leadgen_id,
        imported: false,
        idempotent: true,
        dealership_id: dealershipId,
        contact_id: existing.payload?.contact_id || existing.entity_id,
        lead_id: existing.payload?.lead_id || null,
        conversation_id: existing.payload?.conversation_id || null,
      })
      continue
    }

    const creds = account.credentials || extractStoredGoogleCreds(account)
    const pageToken = creds.page_access_token || creds.access_token || account.page_access_token || null
    const fetched = await fetchLeadFields({ pageAccessToken: pageToken, leadgenId: lead.leadgen_id, fetchImpl })
    if (!fetched.imported) {
      results.push({ leadgen_id: lead.leadgen_id, dealership_id: dealershipId, ...fetched })
      continue
    }

    const receivedAt = now.toISOString()
    const contact = await store.upsertContact({
      dealership_id: dealershipId,
      full_name: fetched.contact.full_name,
      email: fetched.contact.email,
      phone: fetched.contact.phone,
      source: 'meta_lead_ads',
      source_key: 'meta_lead_ads',
      last_activity_at: receivedAt,
    })
    const opportunity = await store.insertLead({
      dealership_id: dealershipId,
      contact_id: contact.id,
      source: 'meta_lead_ads',
      source_key: 'meta_lead_ads',
      status: 'new',
      comments: `Meta Lead Ads form ${lead.form_id || ''}`.trim(),
    })
    const conversation = await store.insertConversation({
      dealership_id: dealershipId,
      contact_id: contact.id,
      channel: 'web',
      status: 'active',
      department: 'sales',
      summary: 'Inbound Meta Lead Ad',
      started_at: receivedAt,
      last_message_at: receivedAt,
      last_customer_at: receivedAt,
    })
    const attribution = await store.insertAttribution({
      dealership_id: dealershipId,
      contact_id: contact.id,
      lead_id: opportunity.id,
      source: 'meta_lead_ads',
      provider: 'meta',
      page_id: lead.page_id,
      form_id: lead.form_id,
      ad_id: lead.ad_id,
      adgroup_id: lead.adgroup_id,
    })
    await store.insertEvent({
      dealership_id: dealershipId,
      type: 'lead.created',
      source: 'meta_lead_ads',
      contact_id: contact.id,
      lead_id: opportunity.id,
      conversation_id: conversation.id,
      occurred_at: receivedAt,
    })
    const delivery = await store.insertDelivery({
      dealership_id: dealershipId,
      entity_type: 'lead',
      entity_id: opportunity.id,
      method: META_METHOD,
      provider: 'meta',
      status: 'acked',
      payload: {
        idempotency_key: idempotencyKey,
        leadgen_id: String(lead.leadgen_id),
        page_id: lead.page_id,
        contact_id: contact.id,
        lead_id: opportunity.id,
        conversation_id: conversation.id,
        attribution_id: attribution.id,
        received_at: receivedAt,
        speed_to_lead_at: receivedAt,
        evidence: fetched.evidence,
      },
    })
    results.push({
      leadgen_id: lead.leadgen_id,
      imported: !delivery.duplicate,
      idempotent: !!delivery.duplicate,
      dealership_id: dealershipId,
      contact_id: contact.id,
      lead_id: opportunity.id,
      conversation_id: conversation.id,
      attribution_id: attribution.id,
      speed_to_lead_at: receivedAt,
    })
  }
  return { ok: true, statusCode: 200, received: true, imported: results.filter((r) => r.imported).length, results }
}

export async function ingestResendEvent({ rawBody, headers, store } = {}) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '')
  const verified = verifyResendSignature({ payload: raw, headers })
  if (!verified.ok) return { ok: false, statusCode: 401, error: verified.reason }
  let parsed
  try { parsed = JSON.parse(raw || '{}') } catch {
    return { ok: false, statusCode: 400, error: 'Invalid JSON body.' }
  }
  const mapped = mapResendEvent(parsed)
  if (!mapped.accepted) return { ok: true, statusCode: 202, accepted: false, reason: mapped.reason }
  const eventId = headers['svix-id'] || headers['Svix-Id'] || parsed.data?.created_at || mapped.email_id
  const idempotencyKey = resendIdempotencyKey(mapped.email_id, parsed.type, eventId)
  const existing = await store.findDelivery({
    dealershipId: PLATFORM_DEALERSHIP_ID,
    method: RESEND_METHOD,
    provider: 'resend',
    idempotencyKey,
  })
  if (existing) {
    return {
      ok: true, statusCode: 200, accepted: true, idempotent: true,
      status: existing.payload?.status || mapped.status,
      email_id: mapped.email_id,
      evidence: existing.payload?.evidence || mapped.evidence,
    }
  }
  const occurredAt = parsed.created_at || parsed.data?.created_at || new Date().toISOString()
  await store.insertDelivery({
    dealership_id: PLATFORM_DEALERSHIP_ID,
    entity_type: 'email',
    entity_id: deterministicUuid('resend', mapped.email_id),
    method: RESEND_METHOD,
    provider: 'resend',
    status: mapped.status === 'failed' || mapped.status === 'bounced' || mapped.status === 'complained' ? 'failed' : 'acked',
    payload: {
      idempotency_key: idempotencyKey,
      email_id: mapped.email_id,
      event_id: String(eventId),
      type: parsed.type,
      status: mapped.status,
      to: mapped.to,
      occurred_at: occurredAt,
      evidence: mapped.evidence,
    },
  })
  return {
    ok: true, statusCode: 200, accepted: true, idempotent: false,
    status: mapped.status, email_id: mapped.email_id, evidence: mapped.evidence,
  }
}

export function healthFromConnection(connection, { capabilityConfigured, selected } = {}) {
  const capability = { supported: true, server_configured: !!capabilityConfigured }
  if (!capability.server_configured) {
    return { capability, health: HEALTH.NOT_CONNECTED, reason: 'Server app credentials are not configured.' }
  }
  if (!connection) {
    return { capability, health: HEALTH.NOT_CONNECTED, reason: 'No canonical connection row for this dealership.' }
  }
  if (connection.status === 'expired' || (connection.token_expires_at && Date.parse(connection.token_expires_at) < Date.now() && !extractStoredGoogleCreds(connection).refresh_token)) {
    return { capability, health: HEALTH.EXPIRED, last_error: connection.last_error || null, selected }
  }
  if (connection.status === 'revoked' || connection.status === 'disconnected') {
    return { capability, health: HEALTH.AUTHORIZATION_REQUIRED, selected }
  }
  if (connection.last_error && !connection.last_success_at && !connection.last_verified_at) {
    return { capability, health: HEALTH.FAILED, last_error: connection.last_error, selected }
  }
  if (!connection.last_verified_at && !connection.last_success_at) {
    return {
      capability,
      health: HEALTH.AUTHORIZATION_REQUIRED,
      reason: 'Connection row exists but has no verified provider evidence.',
      selected,
      last_verified_at: null,
      last_sync_at: connection.last_synced_at || connection.last_sync_at || null,
      last_success_at: null,
      last_error: connection.last_error || null,
    }
  }
  return {
    capability,
    health: connection.last_error ? HEALTH.DEGRADED : HEALTH.HEALTHY,
    last_verified_at: connection.last_verified_at || null,
    last_sync_at: connection.last_synced_at || connection.last_sync_at || null,
    last_success_at: connection.last_success_at || connection.last_verified_at || null,
    last_error: connection.last_error || null,
    selected,
  }
}

export function integrationHealthMatrix({ seoConnection = null, adsConnection = null, metaPage = null, resendLastEvent = null } = {}) {
  return {
    google_search_console: healthFromConnection(seoConnection, { capabilityConfigured: googleSuiteConfigured('gsc'), selected: seoConnection?.gsc_site || null }),
    google_analytics: healthFromConnection(seoConnection, { capabilityConfigured: googleSuiteConfigured('ga4'), selected: seoConnection?.ga4_property || null }),
    google_ads: healthFromConnection(adsConnection, { capabilityConfigured: googleAdsConversionsConfigured() || googleAdsAppConfigured(), selected: adsConnection?.account_id || null }),
    meta_lead_ads: healthFromConnection(metaPage, {
      capabilityConfigured: !!(process.env.META_APP_SECRET || process.env.META_ADS_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET),
      selected: metaPage?.external_account_id || null,
    }),
    resend: {
      capability: { supported: true, server_configured: resendSendingConfigured() || resendEventsConfigured() },
      health: resendLastEvent ? HEALTH.HEALTHY : (resendEventsConfigured() ? HEALTH.AUTHORIZATION_REQUIRED : HEALTH.NOT_CONNECTED),
      last_success_at: resendLastEvent?.occurred_at || null,
      last_error: null,
    },
    calendar: {
      capability: { supported: true, server_configured: envPair('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET') || envPair('GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET') },
      health: (envPair('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET') || envPair('GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CALENDAR_CLIENT_SECRET')) ? HEALTH.AUTHORIZATION_REQUIRED : HEALTH.NOT_CONNECTED,
    },
    twilio: {
      capability: { supported: true, server_configured: !!(process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_MASTER_SID) },
      health: (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_MASTER_SID) ? HEALTH.AUTHORIZATION_REQUIRED : HEALTH.NOT_CONNECTED,
    },
    accounting: {
      capability: { supported: true, server_configured: envPair('QBO_CLIENT_ID', 'QBO_CLIENT_SECRET') || envPair('XERO_CLIENT_ID', 'XERO_CLIENT_SECRET') },
      health: (envPair('QBO_CLIENT_ID', 'QBO_CLIENT_SECRET') || envPair('XERO_CLIENT_ID', 'XERO_CLIENT_SECRET')) ? HEALTH.AUTHORIZATION_REQUIRED : HEALTH.NOT_CONNECTED,
    },
  }
}

export function assertNoHealthyWithoutEvidence(matrix) {
  for (const [key, row] of Object.entries(matrix || {})) {
    if (row.health === HEALTH.HEALTHY && !row.last_verified_at && !row.last_success_at) {
      throw new Error(`${key} marked healthy without verified evidence`)
    }
  }
  return true
}
