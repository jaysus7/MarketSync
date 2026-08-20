/**
 * Outbound webhooks — the "glue" layer. A dealer configures a URL (Settings →
 * Integrations → Webhooks / Zapier) and MarketSync POSTs signed events to it
 * (lead.created, deal.sold, deal.delivered, …), so they can pipe MarketSync into
 * Zapier / Make / QuickBooks / a spreadsheet / anything — no partner approval needed.
 *
 * Config lives on dealer_integrations(provider='webhook'):
 *   lender_code_map = { url, events: [] }   (non-secret; empty events = all)
 *   credentials_enc = { secret }            (optional HMAC signing secret, encrypted)
 *
 * Fire-and-forget: never throws, short timeout, so it can't slow or break a request.
 */
import crypto from 'node:crypto'
import { supabaseAdmin } from './shared.js'
import { decryptJson } from './crypto-pii.js'
import { requireAuth, requireMfa } from './middleware.js'
import { requirePermission } from './authorization.js'
import { audit } from './audit.js'
import { safeOutboundFetch, validateOutboundUrl } from './outbound-http-policy.js'

export const WEBHOOK_EVENTS = [
  'lead.created', 'deal.sold', 'deal.delivered', 'appointment.booked', 'test.ping',
]

function webhookSignature(secret, body) {
  if (!secret) return null
  return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(body).digest('hex')
}

function webhookHeaders({ event, eventId, timestamp, secret, body }) {
  const headers = {
    'Content-Type': 'application/json',
    'X-MarketSync-Event': event,
    'X-MarketSync-Event-Id': eventId,
    'X-MarketSync-Timestamp': timestamp,
  }
  const signature = webhookSignature(secret, body)
  if (signature) headers['X-MarketSync-Signature'] = signature
  return headers
}

export async function emitWebhook(dealershipId, event, data) {
  try {
    if (!dealershipId || !event) return
    const { data: row } = await supabaseAdmin.from('dealer_integrations')
      .select('enabled, credentials_enc, lender_code_map')
      .eq('dealership_id', dealershipId).eq('provider', 'webhook').maybeSingle()
    if (!row || !row.enabled) return
    const cfg = row.lender_code_map || {}
    const url = cfg.url
    if (!url || !/^https?:\/\//i.test(url)) return
    const events = Array.isArray(cfg.events) ? cfg.events : []
    if (events.length && !events.includes(event)) return   // subscribed to a subset only

    const { data: delivery } = await supabaseAdmin.from('webhook_deliveries').insert({
      dealership_id: dealershipId, event_name: event, destination_url: url, payload: data || {}
    }).select('id, event_id').single()

    const check = await validateOutboundUrl(url)
    if (!check.ok) {
      if (delivery?.id) {
        await supabaseAdmin.from('webhook_deliveries').update({
          status: 'failed', attempts: 1, last_error: `Blocked by security policy: ${check.error}`, next_retry_at: null
        }).eq('id', delivery.id)
      }
      return
    }

    const eventId = delivery?.event_id || crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const body = JSON.stringify({ event, event_id: eventId, dealership_id: dealershipId, at: timestamp, data: data || {} })
    const secret = row.credentials_enc ? decryptJson(row.credentials_enc)?.secret : null
    const headers = webhookHeaders({ event, eventId, timestamp, secret, body })
    try {
      const response = await safeOutboundFetch(url, { method: 'POST', headers, body, timeout: 8000 })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (delivery?.id) await supabaseAdmin.from('webhook_deliveries').update({ status: 'delivered', attempts: 1, response_status: response.status, delivered_at: new Date().toISOString() }).eq('id', delivery.id)
    } catch (error) {
      if (delivery?.id) await supabaseAdmin.from('webhook_deliveries').update({ status: 'failed', attempts: 1, last_error: String(error?.message || error).slice(0, 1000), next_retry_at: new Date(Date.now() + 60_000).toISOString() }).eq('id', delivery.id)
    }
  } catch (e) { console.warn('[webhook] emit failed:', e.message) }
}

export function startWebhookRetryWorker() {
  const run = async () => {
    const now = new Date().toISOString()
    const { data: rows } = await supabaseAdmin.from('webhook_deliveries').select('*')
      .eq('status', 'failed').lte('next_retry_at', now).lt('attempts', 5).limit(25)
    for (const row of rows || []) {
      try {
        const { data: integration, error: integrationError } = await supabaseAdmin
          .from('dealer_integrations')
          .select('enabled, credentials_enc')
          .eq('dealership_id', row.dealership_id)
          .eq('provider', 'webhook')
          .maybeSingle()
        if (integrationError) throw integrationError
        if (!integration?.enabled) throw new Error('Webhook integration is no longer enabled')

        const check = await validateOutboundUrl(row.destination_url)
        if (!check.ok) {
          throw new Error(`Blocked by security policy: ${check.error}`)
        }

        const timestamp = new Date().toISOString()
        const body = JSON.stringify({ event: row.event_name, event_id: row.event_id, dealership_id: row.dealership_id, at: timestamp, data: row.payload || {} })
        const secret = integration.credentials_enc ? decryptJson(integration.credentials_enc)?.secret : null
        const headers = webhookHeaders({ event: row.event_name, eventId: row.event_id, timestamp, secret, body })
        const r = await safeOutboundFetch(row.destination_url, { method: 'POST', headers, body, timeout: 8000 })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await supabaseAdmin.from('webhook_deliveries').update({ status: 'delivered', attempts: row.attempts + 1, response_status: r.status, delivered_at: new Date().toISOString(), next_retry_at: null }).eq('id', row.id)
      } catch (e) {
        const attempts = row.attempts + 1
        await supabaseAdmin.from('webhook_deliveries').update({ attempts, last_error: String(e.message || e).slice(0, 1000), next_retry_at: attempts >= 5 ? null : new Date(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)).toISOString() }).eq('id', row.id)
      }
    }
  }
  run(); const t = setInterval(run, 60_000); t.unref?.(); return t
}

// Dealer-facing delivery history. Payloads can contain customer data, so the
// summary list omits them and the detail/retry operations require MFA.
export function registerWebhookRoutes(app) {
  const canManage = [requireAuth, requirePermission('users.manage')]

  app.get('/webhooks/deliveries', ...canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
    let query = supabaseAdmin.from('webhook_deliveries')
      .select('id, event_id, event_name, destination_url, status, attempts, response_status, last_error, next_retry_at, delivered_at, created_at')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(limit)
    if (req.query.status) query = query.eq('status', String(req.query.status))
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json({ deliveries: data || [] })
  })

  app.get('/webhooks/deliveries/:id', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('webhook_deliveries').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Delivery not found' })
    res.json({ delivery: data })
  })

  app.post('/webhooks/deliveries/:id/retry', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('webhook_deliveries').update({
      status: 'failed', next_retry_at: new Date().toISOString(), last_error: null,
    }).eq('id', req.params.id).eq('dealership_id', req.dealershipId).in('status', ['failed', 'delivered']).select('id').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Delivery not found' })
    audit(req, 'webhook.delivery_retried', { delivery_id: data.id })
    res.json({ ok: true, delivery_id: data.id })
  })
}
