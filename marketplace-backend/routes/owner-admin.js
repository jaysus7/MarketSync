/**
 * Owner / Platform admin — the "back office" of MarketSync itself (not a dealership
 * feature). Lets the MarketSync owner see every account + user and manually control
 * access: flip an account's engines on/off, extend/shorten trials, or comp an account
 * to work indefinitely. Owner-gated by a server-managed platform role.
 *
 * Access model recap (why both dealership- AND user-level billing controls exist):
 *  - Normal dealerships bill on the dealerships row (billing_status/trial_ends_at).
 *  - Personal workspaces (is_personal) bill on the PROFILE — the paywall reads the
 *    profile's billing there. So the console exposes both targets.
 *  - Engines/entitlements are always per-dealership columns.
 */
import { supabaseAdmin, sendEmail, emailHealth, resend } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { PRODUCT_KEYS, resolveProducts } from './profile.js'
import { SYSTEM_ROLES, hasSystemRole } from '../authorization.js'
import { audit } from '../audit.js'

const PRODUCT_LABELS = {
  facebook_solo: 'Facebook AutoPoster — Salesperson',
  facebook_dealer: 'Facebook AutoPoster — Dealer',
  marketsync_social: 'Social Scheduler',
  design_studio: 'Design Studio',
  marketsync_video: 'Video',
  marketsync_email: 'Campaigns',
  marketsync_website: 'Dealer Website',
  ai_chatbot: 'AI ChatBot',
  'sales-marketing-suite': 'Sales Marketing Suite',
  'service-marketing-suite': 'Service Marketing Suite',
  'complete-marketing-suite': 'Complete Marketing Suite',
  'marketsync-digital': 'MarketSync Digital',
  dealer_os_core: 'DealerOS Core',
  dealer_os_pro: 'DealerOS Pro',
  dealer_os: 'DealerOS Complete',
}
const HQ_PRODUCT_KEYS = Object.keys(PRODUCT_LABELS)
const isOwner = (req) => hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)

// The engine/entitlement flags the owner can toggle per dealership (column → label).
const ENGINE_FLAGS = [
  { key: 'inv_intel_active', label: 'Inventory Intelligence' },
  { key: 'ai_boost_active', label: 'AI Boost' },
  { key: 'ai_vision_active', label: 'AI Vision' },
  { key: 'ai_chatbot_active', label: 'AI Chatbot' },
  { key: 'vin_sticker_active', label: 'VIN & Sticker' },
  { key: 'cost_tracking_enabled', label: 'Cost Tracking' },
]
const ENGINE_KEYS = new Set(ENGINE_FLAGS.map(f => f.key))
const BILLING_STATUSES = ['TRIALING', 'ACTIVE', 'INACTIVE', 'PAST_DUE']

// Resolve a billing patch from a request body (shared by dealership + user targets).
function billingPatch(b) {
  const patch = {}
  if (b.clear_trial) { patch.billing_status = 'ACTIVE'; patch.trial_ends_at = null; return patch }
  if (b.trial_days != null) {
    const days = Math.max(0, Math.min(3650, Math.trunc(Number(b.trial_days) || 0)))
    patch.trial_ends_at = new Date(Date.now() + days * 86400000).toISOString()
    patch.billing_status = 'TRIALING'
  }
  if (b.billing_status && BILLING_STATUSES.includes(b.billing_status)) patch.billing_status = b.billing_status
  return patch
}

export function registerOwnerAdmin(app) {
  const guard = (req, res) => {
    if (!isOwner(req)) { res.status(403).json({ error: 'Owner access required' }); return false }
    return true
  }

  // ── Email diagnostic (owner) — surfaces WHY email may not be sending ─────────
  // Reports the config (is the key present? which sending domain?) and can fire a
  // real test send so Resend's actual error (e.g. "domain not verified") is visible.
  app.get('/owner/email/health', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const health = emailHealth()
    // Ask Resend (with the backend's OWN key) which domains it can actually send
    // from + their status. If the sending domain isn't here as "verified", the key
    // belongs to a different Resend account/team than where it was verified.
    let domains = null, domains_error = null
    if (resend) {
      try {
        const r = await resend.domains.list()
        const list = r?.data?.data || r?.data || []
        domains = (Array.isArray(list) ? list : []).map(d => ({ name: d.name, status: d.status, region: d.region }))
      } catch (e) { domains_error = e?.message || String(e) }
    }
    const match = domains && health.from_domain ? domains.find(d => d.name === health.from_domain) : null
    res.json({ ...health, domains, domains_error, from_domain_status: match?.status || null })
  })
  app.post('/owner/email/test', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const to = String(req.body?.to || req.user?.email || '').trim()
    if (!to) return res.status(400).json({ error: 'no recipient — pass { to } or have an email on your account' })
    const r = await sendEmail({
      to,
      subject: 'MarketSync email test ✓',
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="margin:0 0 8px">Email is working</h2>
        <p style="color:#334155;line-height:1.6;margin:0">If you're reading this, MarketSync can deliver email — transactional messages, drip follow-ups and alerts will go out.</p>
        <p style="color:#94a3b8;font-size:12px;margin:12px 0 0">Sent ${new Date().toLocaleString('en-US')}</p></div>`,
    })
    res.json({ ...emailHealth(), sent_to: to, ...r })   // always 200; ok/error in the body
  })

  // Every account (dealership) + its users + engine/billing state.
  app.get('/owner/accounts', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const flagCols = ENGINE_FLAGS.map(f => f.key).join(', ')
    const [{ data: dealers }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('dealerships').select(`id, name, is_personal, billing_status, trial_ends_at, plan, created_at, products, ${flagCols}`).order('created_at', { ascending: false }).limit(1000),
      supabaseAdmin.from('profiles').select('id, full_name, role, dealership_id, billing_status, trial_ends_at').limit(5000),
    ])
    const byDealer = {}
    for (const p of profiles || []) { (byDealer[p.dealership_id] = byDealer[p.dealership_id] || []).push(p) }
    const accounts = (dealers || []).map(d => {
      const engines = {}; for (const f of ENGINE_FLAGS) engines[f.key] = !!d[f.key]
      return {
        id: d.id, name: d.name, is_personal: !!d.is_personal, plan: d.plan || null,
        billing_status: d.billing_status || null, trial_ends_at: d.trial_ends_at || null, created_at: d.created_at,
        engines, products: resolveProducts(d),
        users: (byDealer[d.id] || []).map(u => ({ id: u.id, name: u.full_name || '—', role: u.role, billing_status: u.billing_status || null, trial_ends_at: u.trial_ends_at || null })),
      }
    })
    res.json({ engine_flags: ENGINE_FLAGS, billing_statuses: BILLING_STATUSES, product_labels: PRODUCT_LABELS, accounts })
  })

  // Toggle a product entitlement (facebook_solo / facebook_dealer / ai_chatbot /
  // dealer_os) on a dealership — this is what switches their front door.
  app.post('/owner/dealership/:id/products', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const key = String(req.body?.key || '')
    if (!HQ_PRODUCT_KEYS.includes(key) && !PRODUCT_KEYS.includes(key)) return res.status(400).json({ error: 'unknown product key' })
    const active = !!req.body?.active
    const { data: row } = await supabaseAdmin.from('dealerships').select('products').eq('id', req.params.id).maybeSingle()
    const products = (row?.products && typeof row.products === 'object') ? { ...row.products } : {}
    if (active) products[key] = true; else delete products[key]
    const reason = String(req.body?.reason || '').slice(0, 500)
    const { error } = await supabaseAdmin.from('dealerships').update({ products }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    try {
      await supabaseAdmin.from('hq_audit_events').insert({
        actor_id: req.profile?.id || null,
        action: active ? 'product.enabled' : 'product.disabled',
        dealership_id: req.params.id,
        target: key,
        reason: reason || null,
        new_value: active,
      })
    } catch { /* table may not exist yet — entitlement still applied */ }
    res.json({ ok: true, products, key, active, reason: reason || null })
  })

  // Toggle one engine/entitlement flag on a dealership.
  app.post('/owner/dealership/:id/engines', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const key = String(req.body?.key || '')
    if (!ENGINE_KEYS.has(key)) return res.status(400).json({ error: 'unknown engine key' })
    const active = !!req.body?.active
    const patch = { [key]: active }
    // Keep the *_paid mirror in step for the entitlements that have one, so gating +
    // "Paid" badges reflect the manual grant (same columns billing.js flips).
    if (key === 'ai_chatbot_active') patch.ai_chatbot_paid = active
    if (key === 'ai_boost_active') patch.ai_boost_paid = active
    if (key === 'inv_intel_active') patch.inv_intel_paid = active
    const { error } = await supabaseAdmin.from('dealerships').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, key, active })
  })

  // Dealership-level billing (normal accounts).
  app.post('/owner/dealership/:id/billing', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const patch = billingPatch(req.body || {})
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' })
    const { error } = await supabaseAdmin.from('dealerships').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, ...patch })
  })

  // Profile-level billing (personal workspaces + individual comps).
  app.post('/owner/user/:id/billing', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const patch = billingPatch(req.body || {})
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' })
    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    await audit(req, 'hq.user_billing_updated', { after_state: patch, dealership_id: null })
    res.json({ ok: true, ...patch })
  })

  app.post('/owner/dealership/:id/trial', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const days = Math.max(1, Math.min(365, Math.trunc(Number(req.body?.days) || 14)))
    const reason = String(req.body?.reason || '').slice(0, 500)
    if (!reason) return res.status(400).json({ error: 'reason required' })
    const patch = { trial_ends_at: new Date(Date.now() + days * 86400000).toISOString(), billing_status: 'TRIALING' }
    const { error } = await supabaseAdmin.from('dealerships').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    await audit(req, 'hq.trial_extended', { after_state: { ...patch, reason }, dealership_id: req.params.id })
    res.json({ ok: true, ...patch, reason })
  })

  app.get('/owner/audit', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('audit_log')
      .select('id, action, actor_id, actor_email, dealership_id, ip, created_at, meta')
      .like('action', 'hq.%')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      const fallback = await supabaseAdmin.from('audit_log').select('id, action, actor_id, actor_email, dealership_id, ip, created_at, meta').order('created_at', { ascending: false }).limit(100)
      return res.json({ events: fallback.data || [], note: error.message })
    }
    res.json({ events: data || [] })
  })

  app.get('/owner/security', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('security_events')
      .select('id, event_type, user_id, dealership_id, ip, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(150)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ events: data || [] })
  })

  app.get('/owner/flags/:id', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('dealerships').select('id, name, feature_flags').eq('id', req.params.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ id: data?.id, name: data?.name, flags: data?.feature_flags || {} })
  })

  app.post('/owner/flags/:id', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const key = String(req.body?.key || '').slice(0, 80)
    if (!key) return res.status(400).json({ error: 'flag key required' })
    const reason = String(req.body?.reason || '').slice(0, 500)
    if (!reason) return res.status(400).json({ error: 'reason required' })
    const { data: row } = await supabaseAdmin.from('dealerships').select('feature_flags').eq('id', req.params.id).maybeSingle()
    const flags = (row?.feature_flags && typeof row.feature_flags === 'object') ? { ...row.feature_flags } : {}
    flags[key] = !!req.body?.active
    const { error } = await supabaseAdmin.from('dealerships').update({ feature_flags: flags }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    await audit(req, 'hq.feature_flag', { after_state: { key, active: !!req.body?.active, reason }, dealership_id: req.params.id })
    res.json({ ok: true, flags })
  })

  app.post('/owner/support-session', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const dealershipId = String(req.body?.dealership_id || '')
    const reason = String(req.body?.reason || '').slice(0, 500)
    if (!dealershipId || !reason) return res.status(400).json({ error: 'dealership_id and reason required' })
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await audit(req, 'hq.support_session_started', { after_state: { dealership_id: dealershipId, reason, expires_at: expires }, dealership_id: dealershipId })
    res.json({
      ok: true,
      session_id: 'sup_' + Date.now(),
      dealership_id: dealershipId,
      expires_at: expires,
      mode: 'inspect',
      note: 'Inspect-only support session. This does not swap the HQ JWT for a dealer user.',
    })
  })

  app.get('/owner/usage', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data, error } = await supabaseAdmin.from('events')
      .select('dealership_id, event_name, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20000)
    if (error) return res.status(500).json({ error: error.message })
    const byDealer = {}
    const byEvent = {}
    for (const e of data || []) {
      const d = e.dealership_id || 'unknown'
      const ns = String(e.event_name || 'event').split('.')[0]
      byDealer[d] = byDealer[d] || { count: 0, namespaces: {} }
      byDealer[d].count++
      byDealer[d].namespaces[ns] = (byDealer[d].namespaces[ns] || 0) + 1
      byEvent[ns] = (byEvent[ns] || 0) + 1
    }
    const top = Object.entries(byDealer).sort((a,b) => b[1].count - a[1].count).slice(0, 40)
      .map(([id, v]) => ({ dealership_id: id, events_30d: v.count, namespaces: v.namespaces }))
    res.json({ window_days: 30, total_events: (data || []).length, by_namespace: byEvent, top_dealerships: top })
  })

  app.get('/owner/health', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const checks = {}
    const t0 = Date.now()
    try {
      const { error } = await supabaseAdmin.from('dealerships').select('id', { head: true, count: 'exact' }).limit(1)
      checks.supabase = { ok: !error, ms: Date.now() - t0, error: error?.message || null }
    } catch (e) {
      checks.supabase = { ok: false, ms: Date.now() - t0, error: e.message }
    }
    try {
      const { data, error } = await supabaseAdmin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
      checks.profiles = { ok: !error, error: error?.message || null }
    } catch (e) { checks.profiles = { ok: false, error: e.message } }
    checks.stripe_configured = Boolean(process.env.STRIPE_SECRET_KEY)
    checks.env = process.env.NODE_ENV || 'unknown'
    res.json({ ok: Object.values(checks).every(c => c.ok !== false || c === true || typeof c === 'boolean'), checks })
  })

  const DEALEROS_MODULES = [
    'sales.crm','sales.desk','sales.calendar','inventory.manage','inventory.intelligence',
    'service.ros','service.schedule','parts.counter','accounting.ledger','accounting.commissions',
    'marketing.studio','marketing.scheduler','hr.people','admin.settings'
  ]

  app.get('/owner/modules/:id', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('dealerships').select('id, name, products, feature_flags').eq('id', req.params.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    const flags = data?.feature_flags || {}
    const modules = flags.dealer_os_modules && typeof flags.dealer_os_modules === 'object' ? flags.dealer_os_modules : {}
    res.json({ id: data?.id, name: data?.name, catalog: DEALEROS_MODULES, modules, products: data?.products || {} })
  })

  app.post('/owner/modules/:id', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const key = String(req.body?.key || '')
    if (!DEALEROS_MODULES.includes(key)) return res.status(400).json({ error: 'unknown module' })
    const reason = String(req.body?.reason || '').slice(0, 500)
    if (!reason) return res.status(400).json({ error: 'reason required' })
    const { data: row } = await supabaseAdmin.from('dealerships').select('feature_flags').eq('id', req.params.id).maybeSingle()
    const flags = (row?.feature_flags && typeof row.feature_flags === 'object') ? { ...row.feature_flags } : {}
    const modules = { ...(flags.dealer_os_modules || {}) }
    modules[key] = !!req.body?.active
    flags.dealer_os_modules = modules
    const { error } = await supabaseAdmin.from('dealerships').update({ feature_flags: flags }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    await audit(req, 'hq.module_override', { after_state: { key, active: !!req.body?.active, reason }, dealership_id: req.params.id })
    res.json({ ok: true, modules })
  })

  app.post('/owner/user/:id/status', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const active = !!req.body?.active
    const reason = String(req.body?.reason || '').slice(0, 500)
    if (!reason) return res.status(400).json({ error: 'reason required' })
    const { error } = await supabaseAdmin.from('profiles').update({ active }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    await audit(req, active ? 'hq.user_activated' : 'hq.user_deactivated', { after_state: { user_id: req.params.id, reason } })
    res.json({ ok: true, active })
  })

  app.get('/owner/onboarding', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const [{ data: dealers }, { data: profiles }, { data: ints }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, billing_status, products, created_at, stripe_customer_id').limit(2000),
      supabaseAdmin.from('profiles').select('id, dealership_id').limit(8000),
      supabaseAdmin.from('dealer_integrations').select('dealership_id, provider, enabled, status').limit(8000),
    ])
    const usersBy = {}
    for (const p of profiles || []) usersBy[p.dealership_id] = (usersBy[p.dealership_id] || 0) + 1
    const intBy = {}
    for (const i of ints || []) {
      intBy[i.dealership_id] = intBy[i.dealership_id] || []
      intBy[i.dealership_id].push(i)
    }
    const rows = (dealers || []).map(d => {
      const steps = {
        profile: !!d.name,
        users: (usersBy[d.id] || 0) > 0,
        products: Object.values(d.products || {}).some(Boolean),
        billing: !!d.stripe_customer_id || String(d.billing_status || '').toUpperCase() === 'ACTIVE',
        integrations: (intBy[d.id] || []).some(i => i.enabled || i.status === 'connected'),
      }
      const done = Object.values(steps).filter(Boolean).length
      return { id: d.id, name: d.name, status: d.billing_status, created_at: d.created_at, percent: Math.round(done / 5 * 100), steps, users: usersBy[d.id] || 0 }
    }).sort((a, b) => a.percent - b.percent)
    res.json({ accounts: rows })
  })

  app.get('/owner/integrations', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('dealer_integrations')
      .select('dealership_id, provider, enabled, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(2000)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ connections: data || [] })
  })
}
