/**
 * F&I catalog — the dealership's F&I products and lenders. Products seed the deal
 * desk's F&I menu (with manager-only cost for back-end gross); lenders drive the
 * lender dropdown and the "Lender by Rate" view (cheapest buy rate first).
 *
 * Managers/admins manage the lists; any desk-capable role can read them (product
 * COST is stripped for non-managers so reps never see it).
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { hasPermission, requirePermission } from '../authorization.js'
import { audit } from '../audit.js'

const num = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const str = (v, max = 120) => (v == null ? null : String(v).trim().slice(0, max) || null)

// The catalog is readable at the deal desk, but costs and maintenance are limited
// to a user who can approve F&I deals. Keep the UI capability in sync with the
// route middleware instead of relying on the old legacy-role list.
async function canManageCatalog(req) {
  if (!req.dealershipId || !req.user?.id) return false
  if (req.profile?.system_role === 'platform_owner') return true
  try { return await hasPermission(req, 'deal.approve') }
  catch (error) { console.warn('[fni-catalog] capability check failed:', error.message); return false }
}

export function registerFniCatalog(app) {
  // ── F&I products ────────────────────────────────────────────────────────────
  app.get('/fni/products', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('fni_products')
      .select('id, name, category, cost, retail_default, active, sort_order')
      .eq('dealership_id', req.dealershipId).eq('active', true)
      .order('sort_order', { ascending: true }).order('name', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    // Cost is back-end-gross data — managers only. Reps get the menu + retail.
    const showCost = await canManageCatalog(req)
    const rows = (data || []).map(p => showCost ? p : { ...p, cost: null })
    res.json({ ok: true, products: rows, can_manage: showCost })
  })

  app.post('/fni/products', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const name = str(req.body?.name, 120)
    if (!name) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabaseAdmin.from('fni_products').insert({
      dealership_id: req.dealershipId, name,
      category: str(req.body?.category, 60), cost: num(req.body?.cost),
      retail_default: num(req.body?.retail_default),
      active: req.body?.active !== false, sort_order: num(req.body?.sort_order) || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.product_created', { after_state: data })
    res.json({ ok: true, product: data })
  })

  app.put('/fni/products/:id', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = str(req.body.name, 120)
    if (req.body?.category !== undefined) patch.category = str(req.body.category, 60)
    if (req.body?.cost !== undefined) patch.cost = num(req.body.cost)
    if (req.body?.retail_default !== undefined) patch.retail_default = num(req.body.retail_default)
    if (req.body?.active !== undefined) patch.active = !!req.body.active
    if (req.body?.sort_order !== undefined) patch.sort_order = num(req.body.sort_order) || 0
    const { data: before } = await supabaseAdmin.from('fni_products').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Product not found' })
    const { data, error } = await supabaseAdmin.from('fni_products')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.product_updated', { before_state: before, after_state: data })
    res.json({ ok: true, product: data })
  })

  app.delete('/fni/products/:id', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    // Soft-delete so historical deals keep their product references intact.
    const { data: before } = await supabaseAdmin.from('fni_products').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Product not found' })
    const { data, error } = await supabaseAdmin.from('fni_products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.product_deactivated', { before_state: before, after_state: data })
    res.json({ ok: true })
  })

  // ── Lenders ─────────────────────────────────────────────────────────────────
  // Read is open to any desk-capable role; the "by rate" flag sorts cheapest-first.
  app.get('/fni/lenders', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const byRate = String(req.query.sort || '') === 'rate'
    let q = supabaseAdmin.from('lenders')
      .select('id, name, base_rate, tier, notes, active, sort_order')
      .eq('dealership_id', req.dealershipId).eq('active', true)
    // "Lender by Rate": NULLS LAST so unrated lenders don't masquerade as cheapest.
    if (byRate) q = q.order('base_rate', { ascending: true, nullsFirst: false })
    else q = q.order('sort_order', { ascending: true }).order('name', { ascending: true })
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, lenders: data || [], can_manage: await canManageCatalog(req) })
  })

  app.post('/fni/lenders', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const name = str(req.body?.name, 120)
    if (!name) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabaseAdmin.from('lenders').insert({
      dealership_id: req.dealershipId, name,
      base_rate: num(req.body?.base_rate), tier: str(req.body?.tier, 40),
      notes: str(req.body?.notes, 400),
      active: req.body?.active !== false, sort_order: num(req.body?.sort_order) || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.lender_created', { after_state: data })
    res.json({ ok: true, lender: data })
  })

  app.put('/fni/lenders/:id', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = str(req.body.name, 120)
    if (req.body?.base_rate !== undefined) patch.base_rate = num(req.body.base_rate)
    if (req.body?.tier !== undefined) patch.tier = str(req.body.tier, 40)
    if (req.body?.notes !== undefined) patch.notes = str(req.body.notes, 400)
    if (req.body?.active !== undefined) patch.active = !!req.body.active
    if (req.body?.sort_order !== undefined) patch.sort_order = num(req.body.sort_order) || 0
    const { data: before } = await supabaseAdmin.from('lenders').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Lender not found' })
    const { data, error } = await supabaseAdmin.from('lenders')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.lender_updated', { before_state: before, after_state: data })
    res.json({ ok: true, lender: data })
  })

  app.delete('/fni/lenders/:id', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: before } = await supabaseAdmin.from('lenders').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Lender not found' })
    const { data, error } = await supabaseAdmin.from('lenders')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.lender_deactivated', { before_state: before, after_state: data })
    res.json({ ok: true })
  })
}
