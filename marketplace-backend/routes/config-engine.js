/**
 * Configuration Engine (kernel component).
 *
 * Every engine reads dealer-specific behavior through getConfig() instead of
 * hardcoding it, so a dealer can be configured without a developer. Resolution is
 * dealer-override → global default → caller fallback.
 *
 * v1 covers generic key/value config (lead sources, deal types, vehicle statuses,
 * notification rules, AI personality, required forms, branding, …) in dealer_config,
 * PLUS a catalog that surfaces the already-structured config-as-data domains
 * (accounting_rules, workflow_templates, commission_plans, state_ownership) so there
 * is one place to see everything a dealer can tune. Those structured domains keep
 * their own editors; this unifies discovery + the simple keys.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'

// In-process cache (per dealer+key) with a short TTL — config is read on hot paths.
const _cache = new Map()
const TTL_MS = 60 * 1000
const ckey = (d, k) => `${d || 'global'}::${k}`

/**
 * Read a config value: dealer override → global default → fallback.
 * @returns the stored JSON value, or `fallback` if neither row exists.
 */
export async function getConfig(dealershipId, key, fallback = null) {
  const cacheKey = ckey(dealershipId, key)
  const hit = _cache.get(cacheKey)
  if (hit && hit.exp > Date.now()) return hit.val
  let val = fallback
  try {
    const { data } = await supabaseAdmin.from('dealer_config').select('dealership_id, value')
      .or(`dealership_id.eq.${dealershipId},dealership_id.is.null`).eq('key', key)
    if (data?.length) {
      const own = data.find(r => r.dealership_id === dealershipId)
      const def = data.find(r => !r.dealership_id)
      val = (own ? own.value : def ? def.value : fallback)
    }
  } catch (e) { console.warn('[config] getConfig failed:', e.message) }
  _cache.set(cacheKey, { val, exp: Date.now() + TTL_MS })
  return val
}

/** Write a dealer's config value (upsert) + audit. Invalidates the cache. */
export async function setConfig(dealershipId, key, value, req = null) {
  const row = { dealership_id: dealershipId, key, value, updated_by: req?.user?.id || null, updated_at: new Date().toISOString() }
  const { error } = await supabaseAdmin.from('dealer_config').upsert(row, { onConflict: 'dealership_id,key' })
  if (error) throw new Error(error.message)
  _cache.delete(ckey(dealershipId, key))
  if (req) audit(req, 'config.updated', { key }).catch(() => {})
  return true
}

// The structured config-as-data domains (own editors) surfaced in the catalog.
const STRUCTURED_DOMAINS = [
  { key: 'accounting_rules', table: 'accounting_rules', label: 'Accounting posting rules', editor: 'accounting' },
  { key: 'workflow_templates', table: 'workflow_templates', label: 'Workflow templates', editor: 'operations' },
  { key: 'commission_plans', table: 'commission_plans', label: 'Commission plans', editor: 'commissions' },
  { key: 'state_ownership', table: 'state_ownership', label: 'Department ownership', editor: 'operations' },
]

export function registerConfigEngine(app) {
  // The generic configuration store can hold integration endpoints, notification
  // rules, and other dealer-wide controls. Use a dedicated RBAC permission and
  // MFA for both reads and writes rather than trusting the legacy profile role.
  // Catalog — everything a dealer can configure, in one place.
  app.get('/config', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    // Merge global defaults + this dealer's overrides into one view per key.
    const { data: rows } = await supabaseAdmin.from('dealer_config').select('*')
      .or(`dealership_id.eq.${req.dealershipId},dealership_id.is.null`)
    const merged = {}
    for (const r of rows || []) {
      const cur = merged[r.key]
      // dealer override wins over global default
      if (!cur || (r.dealership_id && !cur.dealership_id)) merged[r.key] = r
    }
    const keys = Object.values(merged).map(r => ({ key: r.key, value: r.value, customized: !!r.dealership_id, updated_at: r.updated_at }))
    // Structured domains with counts (dealer-specific or global).
    const structured = []
    for (const d of STRUCTURED_DOMAINS) {
      let q = supabaseAdmin.from(d.table).select('id', { count: 'exact', head: true })
      // these tables use dealership_id null for global defaults
      const { count } = await q.or(`dealership_id.eq.${req.dealershipId},dealership_id.is.null`)
      structured.push({ ...d, count: count || 0 })
    }
    res.json({ keys, structured })
  })

  app.get('/config/:key', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const value = await getConfig(req.dealershipId, req.params.key, null)
    if (value === null) return res.status(404).json({ error: 'not set' })
    res.json({ key: req.params.key, value })
  })

  app.put('/config/:key', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    try {
      await setConfig(req.dealershipId, req.params.key, req.body?.value ?? {}, req)
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Reset a dealer's override for a key (fall back to the global default).
  app.delete('/config/:key', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    await supabaseAdmin.from('dealer_config').delete().eq('dealership_id', req.dealershipId).eq('key', req.params.key)
    _cache.delete(ckey(req.dealershipId, req.params.key))
    audit(req, 'config.reset', { key: req.params.key }).catch(() => {})
    res.json({ ok: true })
  })
}
