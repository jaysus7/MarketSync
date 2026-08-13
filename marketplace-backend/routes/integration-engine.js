/**
 * Integration Engine — outbound CRM delivery (Phase 4 of the AI Engine / DealerOS).
 *
 * MarketSync stays the source of truth; this engine syncs a copy of every captured
 * lead OUT to the dealer's CRM via their chosen method, best → worst:
 *   1. api        — direct CRM API (DealerSocket/VinSolutions/Elead/CDK/…) [adapter hook]
 *   2. adf        — ADF/XML lead email (industry standard; almost every CRM ingests it)
 *   3. webhook    — POST to the CRM's inbound hook (existing emitWebhook)
 *   4. extension  — queue the lead for the Chrome extension to autofill
 *
 * It SUBSCRIBES to lead.created (kernel contract — no engine calls it directly), so it
 * covers BOTH manual leads and AI-captured leads with one path. Every delivery is
 * recorded in integration_deliveries and deduped, so a lead is pushed exactly once.
 */
import { supabaseAdmin, resend, EMAIL_FROM } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { onEvent } from './events.js'
import { getConfig, setConfig } from './config-engine.js'
import { getContact } from './crm.js'
import { buildAdf } from './leads.js'
import { emitWebhook } from '../webhooks.js'
import { syncDealToAccounting } from '../providers/accounting.js'

// Resolve the dealer's outbound method. Backward-compatible: if none is set but a
// legacy crm_adf_email exists, default to ADF.
async function resolveMethod(dealershipId) {
  const cfg = await getConfig(dealershipId, 'crm_integration', {})
  let method = cfg?.method && cfg.method !== 'none' ? cfg.method : null
  if (!method) {
    const { data: d } = await supabaseAdmin.from('dealerships').select('crm_adf_email').eq('id', dealershipId).maybeSingle()
    if (d?.crm_adf_email) method = 'adf'
  }
  return { method, cfg }
}

async function record(dealershipId, entityId, entityType, method, patch) {
  try {
    await supabaseAdmin.from('integration_deliveries').upsert(
      { dealership_id: dealershipId, entity_id: entityId, entity_type: entityType, method, updated_at: new Date().toISOString(), ...patch },
      { onConflict: 'dealership_id,entity_id,method' })
  } catch (e) { console.warn('[integration] record failed:', e.message) }
}

// The router. Delivers one lead by the dealer's method; deduped per (entity, method).
export async function pushLead(dealershipId, { entityId, entityType = 'lead', lead, vehicle = null, rep = null }) {
  if (!dealershipId || !entityId) return
  const { method, cfg } = await resolveMethod(dealershipId)
  if (!method) return { skipped: 'no_method' }
  // Dedupe: already delivered/queued for this entity+method?
  const { data: existing } = await supabaseAdmin.from('integration_deliveries')
    .select('id, status').eq('dealership_id', dealershipId).eq('entity_id', entityId).eq('method', method).maybeSingle()
  if (existing) return { skipped: 'already', status: existing.status }

  try {
    if (method === 'adf') {
      const to = cfg?.lead_email || (await supabaseAdmin.from('dealerships').select('name, crm_adf_email').eq('id', dealershipId).maybeSingle()).data?.crm_adf_email
      if (!to || !resend) return await record(dealershipId, entityId, entityType, method, { status: 'failed', error: 'no_lead_email_or_email_provider' })
      const { data: dl } = await supabaseAdmin.from('dealerships').select('name').eq('id', dealershipId).maybeSingle()
      const adf = buildAdf(lead, vehicle, dl?.name, rep)
      await resend.emails.send({
        from: EMAIL_FROM, to,
        subject: `ADF Lead${vehicle ? ' — ' + [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : ''}`,
        text: adf, attachments: [{ filename: 'lead.adf.xml', content: Buffer.from(adf).toString('base64') }],
      })
      if (entityType === 'lead') await supabaseAdmin.from('leads').update({ adf_sent_at: new Date().toISOString(), status: 'sent' }).eq('id', entityId).catch?.(() => {})
      return await record(dealershipId, entityId, entityType, method, { status: 'sent', provider: cfg?.crm || 'ADF', response: to })
    }
    if (method === 'webhook') {
      await emitWebhook(dealershipId, 'lead.created', { lead, vehicle })
      return await record(dealershipId, entityId, entityType, method, { status: 'sent', provider: 'webhook' })
    }
    if (method === 'extension') {
      // Queue for the Chrome extension to poll + autofill in the dealer's CRM UI.
      return await record(dealershipId, entityId, entityType, method, { status: 'queued', provider: cfg?.crm || 'extension', payload: { lead, vehicle } })
    }
    if (method === 'api') {
      // Per-CRM API adapters plug in here. Until an adapter for cfg.crm is wired, the
      // lead is queued (MarketSync remains the source of truth) rather than lost.
      return await record(dealershipId, entityId, entityType, method, { status: 'queued', provider: cfg?.crm || 'api', payload: { lead, vehicle }, error: 'adapter_pending' })
    }
  } catch (e) {
    if (entityType === 'lead') supabaseAdmin.from('leads').update({ adf_error: String(e.message).slice(0, 300) }).eq('id', entityId).then(() => {}, () => {})
    return await record(dealershipId, entityId, entityType, method, { status: 'failed', error: String(e.message).slice(0, 300) })
  }
}

// Subscribe to lead.created — build the lead payload and push. Covers manual + AI leads.
async function onLeadCreated(event) {
  if (event?.event_name !== 'lead.created' || event.payload?.engine) return
  const did = event.dealership_id
  const p = event.payload || {}
  try {
    let entityId, entityType, lead, vehicle = null, rep = null
    if (p.lead_id) {
      entityType = 'lead'; entityId = p.lead_id
      const { data: l } = await supabaseAdmin.from('leads').select('id, name, email, phone, comments, source, inventory_id, created_by').eq('id', p.lead_id).eq('dealership_id', did).maybeSingle()
      if (!l) return
      lead = l
      if (l.inventory_id) { const { data: v } = await supabaseAdmin.from('inventory').select('year, make, model, trim, vin, stocknumber, price').eq('id', l.inventory_id).maybeSingle(); vehicle = v || null }
      if (l.created_by) { const { data: r } = await supabaseAdmin.from('profiles').select('full_name, display_name, phone').eq('id', l.created_by).maybeSingle(); if (r) rep = { name: r.full_name || r.display_name || '', email: '', phone: r.phone || '' } }
    } else {
      // AI-captured lead — no leads row; build from the contact.
      entityType = 'customer'; entityId = event.entity_id
      const c = await getContact(did, event.entity_id)
      if (!c) return
      lead = { name: c.full_name, email: c.email, phone: c.phone || c.phone_mobile, comments: 'Captured by MarketSync AI chat', source: p.source || 'AI Chat' }
    }
    await pushLead(did, { entityId, entityType, lead, vehicle, rep })
  } catch (e) { console.warn('[integration] onLeadCreated failed:', e.message) }
}

// Subscribe to deal delivery — book the sale into the dealer's external accounting
// system (QuickBooks/Xero) if they've connected + opted in. This is outbound
// integration, so it belongs to this engine, not the deal desk. syncDealToAccounting
// is idempotent (deals.accounting_synced_at guards it), so a bus replay is safe.
async function onDealDelivered(event) {
  if (event?.event_name !== 'deal.status_changed' || event.payload?.engine) return
  if (event.to_state !== 'delivered' && event.payload?.to !== 'delivered') return
  try { await syncDealToAccounting(event.dealership_id, event.entity_id) }
  catch (e) { console.warn('[integration] onDealDelivered failed:', e.message) }
}

export function registerIntegrationEngine(app) {
  onEvent(onLeadCreated)     // subscribe the Integration Engine to captured leads
  onEvent(onDealDelivered)   // subscribe to deal delivery → external accounting sync

  // CRM credentials, delivery payloads, and extension queue entries can expose
  // customer data and control outbound data flows. They are therefore limited to
  // MFA-verified integration administrators rather than every signed-in dealer user.
  app.get('/integration/config', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const cfg = await getConfig(req.dealershipId, 'crm_integration', {})
    res.json({ config: cfg })
  })

  app.put('/integration/config', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const b = req.body || {}
    const value = {
      method: ['none', 'api', 'adf', 'webhook', 'extension'].includes(b.method) ? b.method : 'none',
      crm: String(b.crm || 'Other').slice(0, 60),
      lead_email: String(b.lead_email || '').slice(0, 200),
      webhook_url: String(b.webhook_url || '').slice(0, 500),
      api: b.api && typeof b.api === 'object' ? b.api : {},
    }
    try {
      await setConfig(req.dealershipId, 'crm_integration', value, req)
      audit(req, 'integration.crm_configuration_updated', {
        after_state: {
          method: value.method,
          crm: value.crm,
          lead_email_configured: !!value.lead_email,
          webhook_configured: !!value.webhook_url,
          api_configured: Object.keys(value.api).length > 0,
        },
      })
      res.json({ ok: true, config: value })
    }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Delivery log (managers) — proof every lead reached the CRM.
  app.get('/integration/deliveries', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data } = await supabaseAdmin.from('integration_deliveries').select('*')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
    res.json({ deliveries: data || [] })
  })

  // Chrome-extension queue: leads waiting to be autofilled into the dealer's CRM UI.
  app.get('/integration/queue', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data } = await supabaseAdmin.from('integration_deliveries').select('*')
      .eq('dealership_id', req.dealershipId).eq('method', 'extension').eq('status', 'queued').order('created_at').limit(50)
    res.json({ queue: data || [] })
  })

  app.post('/integration/queue/:id/ack', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    await supabaseAdmin.from('integration_deliveries').update({ status: 'acked', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    audit(req, 'integration.delivery_acknowledged', { delivery_id: req.params.id })
    res.json({ ok: true })
  })

  // Manual retry of a failed delivery.
  app.post('/integration/deliveries/:id/retry', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: row } = await supabaseAdmin.from('integration_deliveries').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!row) return res.status(404).json({ error: 'not found' })
    await supabaseAdmin.from('integration_deliveries').delete().eq('id', row.id)   // clear dedupe so pushLead re-runs
    // Re-drive from the source event shape.
    if (row.entity_type === 'lead') await onLeadCreated({ event_name: 'lead.created', dealership_id: req.dealershipId, entity_id: row.entity_id, payload: { lead_id: row.entity_id } })
    else await onLeadCreated({ event_name: 'lead.created', dealership_id: req.dealershipId, entity_id: row.entity_id, payload: {} })
    audit(req, 'integration.delivery_retried', { delivery_id: row.id, entity_id: row.entity_id, entity_type: row.entity_type, method: row.method })
    res.json({ ok: true })
  })
}
