/**
 * Integration batches E–I inbound + status surface.
 * Browser never supplies provider tokens. Dealership comes from the session.
 * Inbound Meta/Resend idempotency is durable on integration_deliveries.
 */
import { supabaseAdmin } from '../shared.js'
import { decryptJson } from '../crypto-pii.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { googleValidToken } from '../adSpendSync.js'
import {
  rejectClientSecrets,
  queryGscForDealership,
  queryGa4ForDealership,
  uploadAdsConversionForDealership,
  ingestMetaLeadWebhook,
  ingestResendEvent,
  integrationHealthMatrix,
  conversionIdempotencyKey,
  createMemoryCrmStore,
  PLATFORM_DEALERSHIP_ID,
} from '../providers/canonical-integrations.js'
import { verifyLeadAdsSubscription } from '../providers/meta-lead-ads.js'
import { verifyMarketSyncWebhook } from '../providers/webhook-verify.js'

const adsUploadKeysByDealer = new Map()
const fallbackStore = createMemoryCrmStore()

function secretCheck(req, res) {
  const check = rejectClientSecrets(req.body || {})
  if (check.rejected) {
    res.status(400).json({ error: check.reason })
    return false
  }
  return true
}

async function loadSeoConnection(dealershipId) {
  if (!dealershipId || !supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('seo_connections').select('*').eq('dealership_id', dealershipId).maybeSingle()
  if (data?.credentials_enc && !data.credentials) {
    try { data.credentials = decryptJson(data.credentials_enc) } catch { /* keep encrypted */ }
  }
  return data || null
}

async function loadAdsConnection(dealershipId) {
  if (!dealershipId || !supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('ad_connections').select('*').eq('dealership_id', dealershipId).eq('provider', 'google_ads').maybeSingle()
  return data || null
}

async function loadMetaPage(dealershipId) {
  if (!dealershipId || !supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('social_accounts')
    .select('id, dealership_id, provider, external_account_id, status, last_verified_at, last_error, token_expires_at')
    .eq('dealership_id', dealershipId)
    .in('provider', ['facebook', 'meta', 'instagram'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

function supabaseLeadStore() {
  return {
    async findSocialAccountByPageId(pageId) {
      const { data } = await supabaseAdmin.from('social_accounts')
        .select('*')
        .eq('external_account_id', String(pageId))
        .in('provider', ['facebook', 'meta', 'instagram'])
        .neq('status', 'revoked')
        .maybeSingle()
      if (!data) return fallbackStore.findSocialAccountByPageId(pageId)
      if (data.credentials_enc && !data.credentials) {
        try { data.credentials = decryptJson(data.credentials_enc) } catch { data.credentials = {} }
      }
      return data
    },
    async findDelivery({ dealershipId, method, provider, idempotencyKey }) {
      const { data } = await supabaseAdmin.from('integration_deliveries')
        .select('*')
        .eq('dealership_id', dealershipId)
        .eq('method', method)
        .eq('provider', provider || '')
        .contains('payload', { idempotency_key: idempotencyKey })
        .maybeSingle()
      return data || fallbackStore.findDelivery({ dealershipId, method, provider, idempotencyKey })
    },
    async insertDelivery(row) {
      const { data, error } = await supabaseAdmin.from('integration_deliveries').insert({
        dealership_id: row.dealership_id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        method: row.method,
        provider: row.provider,
        status: row.status || 'acked',
        payload: row.payload,
        response: row.payload?.idempotency_key || null,
      }).select('*').single()
      if (error) {
        if (String(error.message || error.code || '').includes('duplicate') || error.code === '23505') {
          const existing = await this.findDelivery({
            dealershipId: row.dealership_id,
            method: row.method,
            provider: row.provider,
            idempotencyKey: row.payload?.idempotency_key,
          })
          return { ...(existing || row), duplicate: true }
        }
        return fallbackStore.insertDelivery(row)
      }
      return data
    },
    async upsertContact(row) {
      if (row.email) {
        const { data: existing } = await supabaseAdmin.from('contacts').select('*').eq('dealership_id', row.dealership_id).ilike('email', row.email).limit(1).maybeSingle()
        if (existing) {
          await supabaseAdmin.from('contacts').update({
            last_activity_at: row.last_activity_at,
            source: existing.source || row.source,
            source_key: existing.source_key || row.source_key,
          }).eq('id', existing.id).eq('dealership_id', row.dealership_id)
          return existing
        }
      }
      const { data, error } = await supabaseAdmin.from('contacts').insert({
        dealership_id: row.dealership_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        source: row.source,
        source_key: row.source_key,
        last_activity_at: row.last_activity_at,
      }).select('*').single()
      if (error || !data) return fallbackStore.upsertContact(row)
      return data
    },
    async insertLead(row) {
      const { data, error } = await supabaseAdmin.from('leads').insert({
        dealership_id: row.dealership_id,
        contact_id: row.contact_id,
        source: row.source,
        source_key: row.source_key,
        status: row.status || 'new',
        comments: row.comments,
      }).select('*').single()
      if (error || !data) return fallbackStore.insertLead(row)
      return data
    },
    async insertConversation(row) {
      const { data, error } = await supabaseAdmin.from('ai_conversations').insert({
        dealership_id: row.dealership_id,
        contact_id: row.contact_id,
        channel: row.channel || 'web',
        status: row.status || 'active',
        department: row.department || 'sales',
        summary: row.summary,
        started_at: row.started_at,
        last_message_at: row.last_message_at,
        last_customer_at: row.last_customer_at,
      }).select('id').single()
      if (error || !data) return fallbackStore.insertConversation(row)
      return data
    },
    async insertEvent(row) {
      const { data, error } = await supabaseAdmin.from('events').insert({
        dealership_id: row.dealership_id,
        event_name: row.type || 'lead.created',
        summary: 'Meta Lead Ad received',
        entity_type: 'customer',
        entity_id: row.contact_id,
        payload: row,
      }).select('id').single()
      if (error || !data) return fallbackStore.insertEvent(row)
      return data
    },
    async insertAttribution(row) {
      return fallbackStore.insertAttribution(row)
    },
  }
}

async function defaultGoogleRefresh(refreshToken) {
  const id = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: 'refresh_token',
    }),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error_description || json.error || `Google refresh HTTP ${r.status}`)
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_at: Date.now() + (Number(json.expires_in) || 3500) * 1000,
  }
}

export async function integrationMatrixForDealership(dealershipId) {
  const [seoConnection, adsConnection, metaPage] = await Promise.all([
    loadSeoConnection(dealershipId),
    loadAdsConnection(dealershipId),
    loadMetaPage(dealershipId),
  ])
  return integrationHealthMatrix({ seoConnection, adsConnection, metaPage })
}

export function integrationMatrix() {
  return integrationHealthMatrix({})
}

export function registerIntegrationBatches(app) {
  app.get('/integrations/meta/lead-ads/webhook', (req, res) => {
    const result = verifyLeadAdsSubscription({
      mode: req.query['hub.mode'],
      token: req.query['hub.verify_token'],
      challenge: req.query['hub.challenge'],
    })
    if (!result.ok) return res.status(403).json({ error: result.reason })
    res.status(200).send(result.challenge)
  })

  app.post('/integrations/meta/lead-ads/webhook', async (req, res) => {
    const raw = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body || {}))
    const parsed = Buffer.isBuffer(req.body) || typeof req.body === 'string'
      ? JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body)
      : (req.body || {})
    const result = await ingestMetaLeadWebhook({
      rawBody: raw,
      signature: req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'],
      parsedBody: parsed,
      store: supabaseLeadStore(),
    })
    if (!result.ok) return res.status(result.statusCode || 401).json({ error: result.error })
    res.status(result.statusCode || 200).json(result)
  })

  app.post('/integrations/resend/events', async (req, res) => {
    const raw = req.rawBody != null
      ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody))
      : (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : null))
    if (raw == null) return res.status(401).json({ error: 'Raw request body required for Resend signature verification.' })
    const result = await ingestResendEvent({ rawBody: raw, headers: req.headers, store: supabaseLeadStore() })
    if (!result.ok) return res.status(result.statusCode || 401).json({ error: result.error })
    res.status(result.statusCode || 200).json(result)
  })

  app.get('/integrations/matrix', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    const matrix = await integrationMatrixForDealership(req.dealershipId)
    res.json({ matrix })
  })

  app.post('/integrations/webhooks/verify', (req, res) => {
    const result = verifyMarketSyncWebhook({
      secret: req.body?.secret,
      body: req.body?.body,
      signature: req.body?.signature || req.headers['x-marketsync-signature'],
    })
    if (!result.ok) return res.status(400).json({ ok: false, error: result.reason })
    res.json({ ok: true })
  })

  app.post('/integrations/google/gsc/query', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!secretCheck(req, res)) return
    const connection = await loadSeoConnection(req.dealershipId)
    const result = await queryGscForDealership({
      connection, startDate: req.body?.start_date, endDate: req.body?.end_date, refreshImpl: defaultGoogleRefresh,
    })
    res.status(result.status === 'measured' ? 200 : 409).json(result)
  })

  app.post('/integrations/google/ga4/query', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!secretCheck(req, res)) return
    const connection = await loadSeoConnection(req.dealershipId)
    const result = await queryGa4ForDealership({
      connection, startDate: req.body?.start_date, endDate: req.body?.end_date, refreshImpl: defaultGoogleRefresh,
    })
    res.status(result.status === 'measured' ? 200 : 409).json(result)
  })

  app.post('/integrations/google/ads/conversions', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!secretCheck(req, res)) return
    const connection = await loadAdsConnection(req.dealershipId)
    const keySet = adsUploadKeysByDealer.get(req.dealershipId) || new Set()
    const refreshImpl = connection
      ? async () => ({ access_token: await googleValidToken(connection) })
      : defaultGoogleRefresh
    const result = await uploadAdsConversionForDealership({
      connection,
      conversion: req.body?.conversion || req.body,
      canonicalEventId: req.body?.event_id || req.body?.deal_id || req.body?.conversion_id,
      priorKeys: keySet,
      refreshImpl,
    })
    if (result.uploaded && result.idempotency_key) {
      keySet.add(result.idempotency_key)
      adsUploadKeysByDealer.set(req.dealershipId, keySet)
      if (connection?.id) {
        await supabaseAdmin.from('ad_connections').update({
          last_error: null,
          last_synced_at: new Date().toISOString(),
        }).eq('id', connection.id).eq('dealership_id', req.dealershipId)
      }
    }
    res.status(result.uploaded || result.idempotent ? 200 : 409).json(result)
  })
}

export { conversionIdempotencyKey, PLATFORM_DEALERSHIP_ID }
