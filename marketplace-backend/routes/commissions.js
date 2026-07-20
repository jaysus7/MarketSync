/**
 * Commission engine — Phase 1 of the accounting platform.
 *
 * Dealers build named commission PLANS (percentage of gross, a flat amount, or the
 * greater of the two — with an optional pack and F&I share and volume bonuses).
 * A plan is assigned per rep (or a store default). Every time a deal is saved, the
 * engine recomputes that deal's commission from the rep's plan and the deal + F&I
 * numbers, stores a detailed line in `deal_commissions`, and writes the front/back
 * totals back onto the deal (so the existing reports/leaderboard stay in sync).
 *
 * Lifecycle (per the dealer's choice): earned on FUNDED.
 *   pending      — deal saved / sold / delivered, commission accrued but not yet earned
 *   earned       — deal marked funded/paid (Mark funded) → counts toward payout
 *   paid         — paid out on payroll
 *   clawed_back  — deal unwound, or a repair/chargeback logged, with a reason
 *
 * Reps see their own commission (earnings, status, clawback reasons + bonuses) on
 * their dashboard; managers see the whole team. Money never lies about cost: front
 * gross uses the internally-tracked vehicle cost and is never shown to customers.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100
const monthStart = (d) => { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)) }
const monthEnd = (d) => { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)) }

// Merge a per-deal override on top of the plan config (per-vehicle customization).
function mergeConfig(plan, override) {
  const base = plan || {}
  if (!override || typeof override !== 'object') return base
  return {
    ...base,
    front: { ...(base.front || {}), ...(override.front || {}) },
    back: { ...(base.back || {}), ...(override.back || {}) },
    spiff_per_deal: override.spiff_per_deal != null ? override.spiff_per_deal : base.spiff_per_deal,
    bonuses: base.bonuses || [],
  }
}

// The core calc. Front: percent of (gross − pack), a flat amount, or the greater of
// the two. Back (F&I): percent of the F&I product revenue, or a flat amount.
export function computeCommission(deal, planConfig, override) {
  const cfg = mergeConfig(planConfig, override)
  const front = cfg.front || {}
  const back = cfg.back || {}
  const price = n(deal.selling_price)
  const hasCost = deal.cost != null && n(deal.cost) > 0
  const pack = n(front.pack)
  const frontGross = hasCost ? Math.max(0, price - n(deal.cost) - pack) : null
  const pct = frontGross != null ? frontGross * (n(front.percent) / 100) : 0
  const flat = n(front.flat)
  const method = front.method || 'greater'
  let frontAmt
  if (method === 'flat') frontAmt = flat
  else if (method === 'percent') frontAmt = frontGross != null ? pct : flat   // no cost → fall back to the flat/mini
  else frontAmt = Math.max(pct, flat)                                          // 'greater'

  const fniItems = Array.isArray(deal.fni_items) ? deal.fni_items : []
  const fniGross = fniItems.reduce((s, x) => s + n(x?.price), 0)
  const backAmt = (back.method === 'flat') ? n(back.flat) : fniGross * (n(back.percent) / 100)

  const spiff = n(cfg.spiff_per_deal)
  return {
    front_amount: round2(frontAmt),
    back_amount: round2(backAmt),
    spiff_amount: round2(spiff),
    total: round2(frontAmt + backAmt + spiff),
    breakdown: {
      front_gross: frontGross, fni_gross: round2(fniGross), pack,
      front_method: method, front_percent: n(front.percent), front_flat: flat,
      back_method: back.method || 'percent', back_percent: n(back.percent), back_flat: n(back.flat),
      cost_known: hasCost,
    },
  }
}

// Resolve the plan that applies to a deal's rep: the rep's assigned plan, else the
// store default. Returns { id, config } or null when the store has no plan yet.
async function planForDeal(dealershipId, repId) {
  if (repId) {
    const { data: rep } = await supabaseAdmin.from('profiles').select('commission_plan_id').eq('id', repId).maybeSingle()
    if (rep?.commission_plan_id) {
      const { data: p } = await supabaseAdmin.from('commission_plans').select('id, config, active').eq('id', rep.commission_plan_id).eq('dealership_id', dealershipId).maybeSingle()
      if (p && p.active) return { id: p.id, config: p.config || {} }
    }
  }
  const { data: def } = await supabaseAdmin.from('commission_plans').select('id, config').eq('dealership_id', dealershipId).eq('is_default', true).eq('active', true).maybeSingle()
  return def ? { id: def.id, config: def.config || {} } : null
}

// Recompute + persist a deal's commission. Called after every deal save and on
// status changes. No-ops (leaves any manual figures alone) until the store has a
// plan. Never resurrects a clawed-back line.
export async function recomputeDealCommission(dealershipId, dealId) {
  const { data: deal } = await supabaseAdmin.from('deals')
    .select('id, created_by, selling_price, cost, fni_items, commission_override, deal_status, sold_at, delivered_at, funded_at')
    .eq('id', dealId).eq('dealership_id', dealershipId).maybeSingle()
  if (!deal) return null
  const plan = await planForDeal(dealershipId, deal.created_by)
  if (!plan) return null   // no plan configured → leave manual commission values untouched
  const calc = computeCommission(deal, plan.config, deal.commission_override)
  const period = (deal.delivered_at || deal.sold_at || new Date().toISOString()).slice(0, 10)

  const { data: existing } = await supabaseAdmin.from('deal_commissions').select('id, status').eq('deal_id', dealId).maybeSingle()
  if (existing?.status === 'clawed_back') return calc   // don't recompute a reversed deal
  const row = {
    dealership_id: dealershipId, deal_id: dealId, rep_id: deal.created_by || null, plan_id: plan.id,
    front_amount: calc.front_amount, back_amount: calc.back_amount, spiff_amount: calc.spiff_amount,
    total: calc.total, breakdown: calc.breakdown, period, updated_at: new Date().toISOString(),
  }
  if (existing) await supabaseAdmin.from('deal_commissions').update(row).eq('id', existing.id)
  else await supabaseAdmin.from('deal_commissions').insert({ ...row, status: 'pending' })

  // Keep the deal's denormalised commission fields in sync so existing reports,
  // the leaderboard and the AI all reflect the computed numbers.
  await supabaseAdmin.from('deals').update({ vehicle_commission: calc.front_amount, fni_commission: calc.back_amount }).eq('id', dealId)
  return calc
}

// Reverse a deal's commission with a reason (unwind / repair / chargeback).
export async function clawbackDealCommission(dealershipId, dealId, reason) {
  await supabaseAdmin.from('deal_commissions')
    .update({ status: 'clawed_back', reason: String(reason || 'Reversed').slice(0, 300), updated_at: new Date().toISOString() })
    .eq('deal_id', dealId).eq('dealership_id', dealershipId)
}

// Volume bonus from a plan's tiers, given the rep's period units + gross. Pays the
// single highest tier met per basis (units, gross), summed across bases.
function volumeBonus(planConfig, units, gross) {
  const rules = Array.isArray(planConfig?.bonuses) ? planConfig.bonuses : []
  let byUnits = 0, byGross = 0
  for (const r of rules) {
    const thr = n(r.threshold), amt = n(r.amount)
    if (r.basis === 'gross') { if (gross >= thr && amt > byGross) byGross = amt }
    else { if (units >= thr && amt > byUnits) byUnits = amt }
  }
  return round2(byUnits + byGross)
}

// Build a commission summary for one rep over a month (default = current month).
async function repSummary(dealershipId, repId, monthISO) {
  const base = monthISO ? new Date(monthISO + '-01T00:00:00Z') : new Date()
  const from = monthStart(base).toISOString().slice(0, 10)
  const to = monthEnd(base).toISOString().slice(0, 10)
  const [{ data: lines }, { data: adjs }, { data: rep }] = await Promise.all([
    supabaseAdmin.from('deal_commissions').select('*').eq('dealership_id', dealershipId).eq('rep_id', repId).gte('period', from).lt('period', to),
    supabaseAdmin.from('commission_adjustments').select('*').eq('dealership_id', dealershipId).eq('rep_id', repId).gte('period', from).lt('period', to),
    supabaseAdmin.from('profiles').select('id, full_name, display_name, commission_plan_id').eq('id', repId).maybeSingle(),
  ])
  const rows = lines || []
  // Attach deal + customer labels.
  const dealIds = rows.map(r => r.deal_id).filter(Boolean)
  let deals = []
  if (dealIds.length) {
    const { data: dd } = await supabaseAdmin.from('deals').select('id, deal_number, contact_id, selling_price, deal_status').in('id', dealIds)
    deals = dd || []
  }
  const contactIds = deals.map(d => d.contact_id).filter(Boolean)
  let contacts = []
  if (contactIds.length) {
    const { data: cc } = await supabaseAdmin.from('contacts').select('id, full_name').in('id', contactIds)
    contacts = cc || []
  }
  const dealById = Object.fromEntries(deals.map(d => [d.id, d]))
  const custById = Object.fromEntries(contacts.map(c => [c.id, c.full_name]))
  const items = rows.map(r => {
    const d = dealById[r.deal_id] || {}
    return {
      deal_id: r.deal_id, deal_number: d.deal_number || null,
      customer: custById[d.contact_id] || null, selling_price: d.selling_price != null ? Number(d.selling_price) : null,
      front: Number(r.front_amount), back: Number(r.back_amount), spiff: Number(r.spiff_amount), total: Number(r.total),
      status: r.status, reason: r.reason || null, period: r.period,
    }
  }).sort((a, b) => (b.period || '').localeCompare(a.period || ''))

  const active = items.filter(i => i.status !== 'clawed_back')
  const units = active.length
  const gross = round2(active.reduce((s, i) => s + (i.selling_price || 0), 0))
  const plan = rep?.commission_plan_id
    ? (await supabaseAdmin.from('commission_plans').select('config').eq('id', rep.commission_plan_id).maybeSingle()).data?.config
    : (await supabaseAdmin.from('commission_plans').select('config').eq('dealership_id', dealershipId).eq('is_default', true).maybeSingle()).data?.config
  const bonus = volumeBonus(plan, units, gross)

  const sum = (pred) => round2(items.filter(pred).reduce((s, i) => s + i.total, 0))
  const adjTotal = round2((adjs || []).reduce((s, a) => s + Number(a.amount), 0))
  return {
    rep_id: repId, rep_name: rep?.display_name || rep?.full_name || 'Rep',
    month: from.slice(0, 7),
    units, gross,
    pending: sum(i => i.status === 'pending'),
    earned: sum(i => i.status === 'earned'),
    paid: sum(i => i.status === 'paid'),
    clawed_back: sum(i => i.status === 'clawed_back'),
    volume_bonus: bonus,
    adjustments: (adjs || []).map(a => ({ type: a.type, amount: Number(a.amount), reason: a.reason || null, deal_id: a.deal_id, date: a.period })),
    adjustments_total: adjTotal,
    // "Take-home so far" = earned + paid deals + net adjustments + volume bonus.
    total: round2(sum(i => i.status === 'earned' || i.status === 'paid') + adjTotal + bonus),
    deals: items,
  }
}

export function registerCommissions(app) {
  // ── Plans (managers) ────────────────────────────────────────────────────────
  app.get('/commissions/plans', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const [{ data: plans }, { data: reps }] = await Promise.all([
      supabaseAdmin.from('commission_plans').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: true }),
      supabaseAdmin.from('profiles').select('id, full_name, display_name, role, commission_plan_id').eq('dealership_id', req.dealershipId),
    ])
    res.json({ ok: true, plans: plans || [], reps: (reps || []).filter(r => r.role !== 'CUSTOMER') })
  })

  app.post('/commissions/plans', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const name = String(req.body?.name || '').trim().slice(0, 80)
    if (!name) return res.status(400).json({ error: 'Name required' })
    const isDefault = !!req.body?.is_default
    if (isDefault) await supabaseAdmin.from('commission_plans').update({ is_default: false }).eq('dealership_id', req.dealershipId)
    const { data, error } = await supabaseAdmin.from('commission_plans').insert({
      dealership_id: req.dealershipId, name, active: req.body?.active !== false, is_default: isDefault,
      config: req.body?.config && typeof req.body.config === 'object' ? req.body.config : {},
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, plan: data })
  })

  app.put('/commissions/plans/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim().slice(0, 80)
    if (req.body?.active !== undefined) patch.active = !!req.body.active
    if (req.body?.config !== undefined && typeof req.body.config === 'object') patch.config = req.body.config
    if (req.body?.is_default === true) { await supabaseAdmin.from('commission_plans').update({ is_default: false }).eq('dealership_id', req.dealershipId); patch.is_default = true }
    else if (req.body?.is_default === false) patch.is_default = false
    const { data, error } = await supabaseAdmin.from('commission_plans').update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, plan: data })
  })

  app.delete('/commissions/plans/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    await supabaseAdmin.from('profiles').update({ commission_plan_id: null }).eq('dealership_id', req.dealershipId).eq('commission_plan_id', req.params.id)
    await supabaseAdmin.from('commission_plans').delete().eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    res.json({ ok: true })
  })

  // Assign a plan to a rep (or clear it to fall back to the default).
  app.put('/commissions/assign', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const repId = String(req.body?.rep_id || '')
    const planId = req.body?.plan_id || null
    if (!repId) return res.status(400).json({ error: 'rep_id required' })
    await supabaseAdmin.from('profiles').update({ commission_plan_id: planId }).eq('id', repId).eq('dealership_id', req.dealershipId)
    res.json({ ok: true })
  })

  // Manual bonus / spiff / clawback / adjustment on a rep (managers).
  app.post('/commissions/adjust', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const repId = String(req.body?.rep_id || '')
    const type = String(req.body?.type || '').toLowerCase()
    if (!repId || !['bonus', 'spiff', 'clawback', 'adjustment'].includes(type)) return res.status(400).json({ error: 'rep_id and a valid type required' })
    let amount = round2(req.body?.amount)
    if (type === 'clawback' && amount > 0) amount = -amount   // clawbacks are deductions
    const { data, error } = await supabaseAdmin.from('commission_adjustments').insert({
      dealership_id: req.dealershipId, rep_id: repId, deal_id: req.body?.deal_id || null, type, amount,
      reason: String(req.body?.reason || '').slice(0, 300) || null, created_by: req.user?.id || null,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, adjustment: data })
  })

  // Mark a deal funded/paid → its commission becomes "earned".
  app.post('/commissions/mark-funded', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const dealId = String(req.body?.deal_id || '')
    if (!dealId) return res.status(400).json({ error: 'deal_id required' })
    const funded = req.body?.funded !== false
    await supabaseAdmin.from('deals').update({ funded_at: funded ? new Date().toISOString() : null }).eq('id', dealId).eq('dealership_id', req.dealershipId)
    // pending → earned on funding; earned → pending if un-funded. Never touches paid/clawed_back.
    await supabaseAdmin.from('deal_commissions')
      .update({ status: funded ? 'earned' : 'pending', updated_at: new Date().toISOString() })
      .eq('deal_id', dealId).eq('dealership_id', req.dealershipId).in('status', funded ? ['pending'] : ['earned'])
    res.json({ ok: true, funded })
  })

  // Mark earned commissions paid (payroll run). Optional rep_id + month scope.
  app.post('/commissions/mark-paid', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    let q = supabaseAdmin.from('deal_commissions').update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('dealership_id', req.dealershipId).eq('status', 'earned')
    if (req.body?.rep_id) q = q.eq('rep_id', String(req.body.rep_id))
    if (req.body?.month) { const b = new Date(req.body.month + '-01T00:00:00Z'); q = q.gte('period', monthStart(b).toISOString().slice(0, 10)).lt('period', monthEnd(b).toISOString().slice(0, 10)) }
    const { error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // Manual clawback on a specific deal (repair came back, chargeback, unwound).
  app.post('/commissions/clawback', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const dealId = String(req.body?.deal_id || '')
    if (!dealId) return res.status(400).json({ error: 'deal_id required' })
    await clawbackDealCommission(req.dealershipId, dealId, req.body?.reason || 'Reversed')
    res.json({ ok: true })
  })

  // ── The caller's own commission (any rep) ────────────────────────────────────
  app.get('/commissions/mine', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.user?.id) return res.status(400).json({ error: 'No user' })
    res.json({ ok: true, ...(await repSummary(req.dealershipId, req.user.id, req.query.month || null)) })
  })

  // A specific rep (managers).
  app.get('/commissions/rep/:repId', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    res.json({ ok: true, ...(await repSummary(req.dealershipId, req.params.repId, req.query.month || null)) })
  })

  // Whole-team rollup for a month (managers).
  app.get('/commissions/team', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const month = req.query.month || null
    const base = month ? new Date(month + '-01T00:00:00Z') : new Date()
    const from = monthStart(base).toISOString().slice(0, 10)
    const to = monthEnd(base).toISOString().slice(0, 10)
    // Reps who have any commission activity this month, plus everyone with a plan.
    const { data: lines } = await supabaseAdmin.from('deal_commissions').select('rep_id').eq('dealership_id', req.dealershipId).gte('period', from).lt('period', to)
    const repIds = new Set((lines || []).map(l => l.rep_id).filter(Boolean))
    const { data: reps } = await supabaseAdmin.from('profiles').select('id, role').eq('dealership_id', req.dealershipId)
    for (const r of (reps || [])) if (['SALES', 'DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(r.role)) repIds.add(r.id)
    const summaries = []
    for (const id of repIds) summaries.push(await repSummary(req.dealershipId, id, month))
    summaries.sort((a, b) => b.total - a.total)
    const totals = summaries.reduce((t, s) => ({
      units: t.units + s.units, pending: round2(t.pending + s.pending), earned: round2(t.earned + s.earned),
      paid: round2(t.paid + s.paid), clawed_back: round2(t.clawed_back + s.clawed_back),
      bonus: round2(t.bonus + s.volume_bonus), total: round2(t.total + s.total),
    }), { units: 0, pending: 0, earned: 0, paid: 0, clawed_back: 0, bonus: 0, total: 0 })
    res.json({ ok: true, month: from.slice(0, 7), reps: summaries, totals })
  })
}
