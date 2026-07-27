/**
 * F&I catalog — the dealership's F&I products and lenders. Products seed the deal
 * desk's F&I menu (with manager-only cost for back-end gross); lenders drive the
 * lender dropdown and the "Lender by Rate" view (cheapest buy rate first).
 *
 * Managers/admins manage the lists; any desk-capable role can read them (product
 * COST is stripped for non-managers so reps never see it).
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const num = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const str = (v, max = 120) => (v == null ? null : String(v).trim().slice(0, max) || null)

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
    const showCost = isMgr(req)
    const rows = (data || []).map(p => showCost ? p : { ...p, cost: null })
    res.json({ ok: true, products: rows, can_manage: isMgr(req) })
  })

  app.post('/fni/products', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const name = str(req.body?.name, 120)
    if (!name) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabaseAdmin.from('fni_products').insert({
      dealership_id: req.dealershipId, name,
      category: str(req.body?.category, 60), cost: num(req.body?.cost),
      retail_default: num(req.body?.retail_default),
      active: req.body?.active !== false, sort_order: num(req.body?.sort_order) || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, product: data })
  })

  app.put('/fni/products/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = str(req.body.name, 120)
    if (req.body?.category !== undefined) patch.category = str(req.body.category, 60)
    if (req.body?.cost !== undefined) patch.cost = num(req.body.cost)
    if (req.body?.retail_default !== undefined) patch.retail_default = num(req.body.retail_default)
    if (req.body?.active !== undefined) patch.active = !!req.body.active
    if (req.body?.sort_order !== undefined) patch.sort_order = num(req.body.sort_order) || 0
    const { data, error } = await supabaseAdmin.from('fni_products')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, product: data })
  })

  app.delete('/fni/products/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    // Soft-delete so historical deals keep their product references intact.
    const { error } = await supabaseAdmin.from('fni_products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
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
    res.json({ ok: true, lenders: data || [], can_manage: isMgr(req) })
  })

  app.post('/fni/lenders', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const name = str(req.body?.name, 120)
    if (!name) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabaseAdmin.from('lenders').insert({
      dealership_id: req.dealershipId, name,
      base_rate: num(req.body?.base_rate), tier: str(req.body?.tier, 40),
      notes: str(req.body?.notes, 400),
      active: req.body?.active !== false, sort_order: num(req.body?.sort_order) || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, lender: data })
  })

  app.put('/fni/lenders/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = str(req.body.name, 120)
    if (req.body?.base_rate !== undefined) patch.base_rate = num(req.body.base_rate)
    if (req.body?.tier !== undefined) patch.tier = str(req.body.tier, 40)
    if (req.body?.notes !== undefined) patch.notes = str(req.body.notes, 400)
    if (req.body?.active !== undefined) patch.active = !!req.body.active
    if (req.body?.sort_order !== undefined) patch.sort_order = num(req.body.sort_order) || 0
    const { data, error } = await supabaseAdmin.from('lenders')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, lender: data })
  })

  app.delete('/fni/lenders/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { error } = await supabaseAdmin.from('lenders')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
}
