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

const PRODUCT_LABELS = { facebook_solo: 'Facebook Solo', facebook_dealer: 'Facebook Dealer', ai_chatbot: 'AI Chatbot', dealer_os: 'DealerOS' }
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
    if (!PRODUCT_KEYS.includes(key)) return res.status(400).json({ error: 'unknown product key' })
    const active = !!req.body?.active
    const { data: row } = await supabaseAdmin.from('dealerships').select('products').eq('id', req.params.id).maybeSingle()
    const products = (row?.products && typeof row.products === 'object') ? { ...row.products } : {}
    if (active) products[key] = true; else delete products[key]
    const { error } = await supabaseAdmin.from('dealerships').update({ products }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, products: resolveProducts({ products }) })
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
    res.json({ ok: true, ...patch })
  })
}
