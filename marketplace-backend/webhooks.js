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

export const WEBHOOK_EVENTS = [
  'lead.created', 'deal.sold', 'deal.delivered', 'appointment.booked', 'test.ping',
]

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
    const eventId = delivery?.event_id || crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const body = JSON.stringify({ event, event_id: eventId, dealership_id: dealershipId, at: timestamp, data: data || {} })
    const headers = { 'Content-Type': 'application/json', 'X-MarketSync-Event': event, 'X-MarketSync-Event-Id': eventId, 'X-MarketSync-Timestamp': timestamp }
    if (row.credentials_enc) {
      const secret = decryptJson(row.credentials_enc)?.secret
      if (secret) headers['X-MarketSync-Signature'] = 'sha256=' + crypto.createHmac('sha256', String(secret)).update(body).digest('hex')
    }
    try {
      const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) })
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
        const r = await fetch(row.destination_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MarketSync-Event': row.event_name, 'X-MarketSync-Event-Id': row.event_id, 'X-MarketSync-Timestamp': new Date().toISOString() }, body: JSON.stringify({ event: row.event_name, event_id: row.event_id, dealership_id: row.dealership_id, at: new Date().toISOString(), data: row.payload || {} }), signal: AbortSignal.timeout(8000) })
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
