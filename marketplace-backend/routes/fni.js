// FNI Deals worklist. Pushed/pending deals live here until delivery. The F&I
// manager works each deal (credit app + products), hits Approve to capture the
// get-ready details — which creates the Cleanup card and emails the teams — then
// marks Delivered, which closes the deal out and drops it off the list.
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { sendEmail } from '../securityAlerts.js'
import { ensureGetReadyCard } from './recon.js'
import { emitWebhook } from '../webhooks.js'
import { emitEvent } from './events.js'
import { notifyDealDelivered } from '../notifications.js'
import { dealSettlement } from './dashboard.js'

const FNI_NOTIFICATION_ROLES = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI']
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function registerFni(app) {
  // Worklist: every deal that isn't delivered yet, newest first.
  app.get('/fni/deals', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: deals, error } = await supabaseAdmin.from('deals')
      .select('id, deal_number, contact_id, inventory_id, deal_status, delivery_date, delivery_time, fni_products, notes, approved_at, created_by, created_at, selling_price')
      .eq('dealership_id', req.dealershipId)
      .neq('deal_status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return res.status(500).json({ error: error.message })

    const contactIds = [...new Set((deals || []).map(d => d.contact_id).filter(Boolean))]
    const invIds = [...new Set((deals || []).map(d => d.inventory_id).filter(Boolean))]
    const repIds = [...new Set((deals || []).map(d => d.created_by).filter(Boolean))]
    const [contacts, inv, reps, dealer] = await Promise.all([
      contactIds.length ? supabaseAdmin.from('contacts').select('id, full_name, first_name, last_name, dl_number, dl_expiry').in('id', contactIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabaseAdmin.from('inventory').select('id, year, make, model, trim, stocknumber').in('id', invIds) : Promise.resolve({ data: [] }),
      repIds.length ? supabaseAdmin.from('profiles').select('id, full_name, display_name').in('id', repIds) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('dealerships').select('cleanup_notify_emails').eq('id', req.dealershipId).maybeSingle(),
    ])
    const cById = Object.fromEntries((contacts.data || []).map(c => [c.id, {
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—',
      dl_number: c.dl_number || null,
      dl_expiry: c.dl_expiry || null,
    }]))
    const iById = Object.fromEntries((inv.data || []).map(v => [v.id, { label: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle', stock: v.stocknumber }]))
    const rById = Object.fromEntries((reps.data || []).map(r => [r.id, r.display_name || r.full_name || '—']))

    const rows = (deals || []).map(d => ({
      id: d.id, deal_number: d.deal_number || null, deal_status: d.deal_status || null,
      customer: d.contact_id ? (cById[d.contact_id]?.name || '—') : '—',
      dl_number: d.contact_id ? (cById[d.contact_id]?.dl_number || null) : null,
      dl_expiry: d.contact_id ? (cById[d.contact_id]?.dl_expiry || null) : null,
      vehicle: d.inventory_id ? (iById[d.inventory_id]?.label || 'Vehicle') : 'Vehicle',
      stocknumber: d.inventory_id ? (iById[d.inventory_id]?.stock || null) : null,
      salesperson: d.created_by ? (rById[d.created_by] || null) : null,
      delivery_date: d.delivery_date || null, delivery_time: d.delivery_time || null,
      fni_products: d.fni_products || null, notes: d.notes || null,
      approved_at: d.approved_at || null, selling_price: d.selling_price || null,
      contact_id: d.contact_id || null, inventory_id: d.inventory_id || null,
    }))
    res.json({ deals: rows, cleanup_notify_emails: dealer.data?.cleanup_notify_emails || '' })
  })

  // Deep F&I performance report over a time window (7/30/90/365 days). Deals are
  // cohorted by created_at. F&I gross is the sum of each deal's fni_items prices
  // (the products the F&I office sold); penetration is which products attach and
  // how often. Everything is computed in-process from one bulk fetch + one name
  // lookup so the endpoint stays a couple of round-trips regardless of volume.
  app.get('/fni/reports', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const allowed = [7, 30, 90, 365]
    let days = parseInt(req.query.days, 10)
    if (!allowed.includes(days)) days = 30
    const since = new Date(Date.now() - days * 86400000)
    const sinceIso = since.toISOString()

    const { data: deals, error } = await supabaseAdmin.from('deals')
      .select('id, deal_status, created_by, fni_manager, fni_items, addons, fni_products, fni_commission, selling_price, created_at, approved_at, credit_app_at, delivered_at, sold_at')
      .eq('dealership_id', req.dealershipId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(4000)
    if (error) return res.status(500).json({ error: error.message })
    const list = deals || []

    // Resolve salesperson (created_by) display names in one query.
    const repIds = [...new Set(list.map(d => d.created_by).filter(Boolean))]
    const { data: reps } = repIds.length
      ? await supabaseAdmin.from('profiles').select('id, full_name, display_name').in('id', repIds)
      : { data: [] }
    const rById = Object.fromEntries((reps || []).map(r => [r.id, r.display_name || r.full_name || '—']))

    const num = (v) => {
      if (typeof v === 'number') return isFinite(v) ? v : 0
      const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''))
      return isFinite(n) ? n : 0
    }
    // Products + their $ for a deal. fni_items is [{name, price}]; addons may carry
    // priced F&I add-ons too. fni_products is a free-text fallback (name only, $0)
    // used only when a deal has no structured items.
    const dealProducts = (d) => {
      const out = []
      const scan = (arr) => {
        for (const it of (Array.isArray(arr) ? arr : [])) {
          if (it == null) continue
          const name = String((typeof it === 'object' ? (it.name ?? it.label ?? it.product ?? it.type) : it) || '').trim()
          if (!name) continue
          const price = typeof it === 'object' ? num(it.price ?? it.amount ?? it.cost ?? it.total) : 0
          out.push({ name, price })
        }
      }
      scan(d.fni_items)
      scan(d.addons)
      if (!out.length && typeof d.fni_products === 'string' && d.fni_products.trim()) {
        for (const nm of d.fni_products.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)) out.push({ name: nm, price: 0 })
      }
      return out
    }
    const gross = (d) => dealProducts(d).reduce((s, p) => s + p.price, 0)
    const isUnit = (d) => d.deal_status === 'sold' || d.deal_status === 'delivered'
    const round2 = (n) => Math.round(n * 100) / 100

    // Status counts.
    const statuses = ['working', 'pending_credit', 'sold', 'delivered']
    const byStatus = Object.fromEntries(statuses.map(s => [s, 0]))
    for (const d of list) if (d.deal_status in byStatus) byStatus[d.deal_status]++
    const deliveredCount = byStatus.delivered
    const unitCount = list.filter(isUnit).length

    // Totals + PVR (per-vehicle-retail = F&I gross ÷ sold/delivered units).
    let totalGross = 0, totalCommission = 0, dealsWithProduct = 0
    for (const d of list) {
      totalGross += gross(d)
      totalCommission += num(d.fni_commission)
      if (dealProducts(d).length) dealsWithProduct++
    }
    const dealCount = list.length
    const pvr = unitCount ? totalGross / unitCount : 0
    const avgGross = dealCount ? totalGross / dealCount : 0

    // Product penetration: attach rate + $ per product, ranked.
    const prodMap = new Map()
    for (const d of list) {
      const seen = new Set()
      for (const p of dealProducts(d)) {
        const key = p.name
        let e = prodMap.get(key)
        if (!e) { e = { product: key, deals: 0, total: 0 }; prodMap.set(key, e) }
        e.total += p.price
        if (!seen.has(key)) { e.deals++; seen.add(key) } // count each deal once per product
      }
    }
    const products = [...prodMap.values()]
      .map(e => ({ product: e.product, deals: e.deals, penetration: dealCount ? round2((e.deals / dealCount) * 100) : 0, total: round2(e.total), avg: e.deals ? round2(e.total / e.deals) : 0 }))
      .sort((a, b) => b.deals - a.deals || b.total - a.total)
      .slice(0, 30)

    // Per-salesperson (created_by) and per-F&I-manager (fni_manager) breakdowns.
    const groupBy = (keyFn, labelFn) => {
      const m = new Map()
      for (const d of list) {
        const key = keyFn(d)
        if (key == null || key === '') continue
        let e = m.get(key)
        if (!e) { e = { key, deals: 0, units: 0, gross: 0, withProduct: 0 }; m.set(key, e) }
        e.deals++
        if (isUnit(d)) e.units++
        e.gross += gross(d)
        if (dealProducts(d).length) e.withProduct++
      }
      return [...m.values()]
        .map(e => ({
          name: labelFn(e.key), deals: e.deals, units: e.units,
          gross: round2(e.gross),
          pvr: e.units ? round2(e.gross / e.units) : 0,
          avg_gross: e.deals ? round2(e.gross / e.deals) : 0,
          attach_rate: e.deals ? round2((e.withProduct / e.deals) * 100) : 0,
        }))
        .sort((a, b) => b.gross - a.gross)
    }
    const perSalesperson = groupBy(d => d.created_by, k => rById[k] || '—')
    const perFniManager = groupBy(d => (typeof d.fni_manager === 'string' ? d.fni_manager.trim() : d.fni_manager), k => String(k))

    // Delivery turnaround (days) on delivered deals with the relevant timestamps.
    const dayDiffs = { approve: [], credit: [] }
    for (const d of list) {
      if (d.deal_status !== 'delivered' || !d.delivered_at) continue
      const del = new Date(d.delivered_at).getTime()
      if (d.approved_at) { const a = new Date(d.approved_at).getTime(); if (isFinite(a) && del >= a) dayDiffs.approve.push((del - a) / 86400000) }
      if (d.credit_app_at) { const c = new Date(d.credit_app_at).getTime(); if (isFinite(c) && del >= c) dayDiffs.credit.push((del - c) / 86400000) }
    }
    const avg = (arr) => arr.length ? round2(arr.reduce((s, n) => s + n, 0) / arr.length) : null
    const turnaround = {
      approved_to_delivered_days: avg(dayDiffs.approve),
      approved_to_delivered_n: dayDiffs.approve.length,
      credit_to_delivered_days: avg(dayDiffs.credit),
      credit_to_delivered_n: dayDiffs.credit.length,
    }

    // Weekly trend (Monday-anchored buckets) of deal count + F&I gross.
    const weekKey = (iso) => {
      const dt = new Date(iso)
      const day = (dt.getUTCDay() + 6) % 7 // 0 = Monday
      const monday = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() - day))
      return monday.toISOString().slice(0, 10)
    }
    const weekMap = new Map()
    for (const d of list) {
      if (!d.created_at) continue
      const wk = weekKey(d.created_at)
      let e = weekMap.get(wk)
      if (!e) { e = { week: wk, deals: 0, gross: 0, units: 0 }; weekMap.set(wk, e) }
      e.deals++
      e.gross += gross(d)
      if (isUnit(d)) e.units++
    }
    const weekly = [...weekMap.values()].map(e => ({ ...e, gross: round2(e.gross) })).sort((a, b) => a.week.localeCompare(b.week))

    res.json({
      days, since: sinceIso,
      deal_count: dealCount,
      unit_count: unitCount,
      delivered_count: deliveredCount,
      by_status: byStatus,
      total_gross: round2(totalGross),
      total_commission: round2(totalCommission),
      pvr: round2(pvr),
      avg_gross: round2(avgGross),
      deals_with_product: dealsWithProduct,
      overall_attach_rate: dealCount ? round2((dealsWithProduct / dealCount) * 100) : 0,
      products,
      per_salesperson: perSalesperson,
      per_fni_manager: perFniManager,
      turnaround,
      weekly,
    })
  })

  // Approve → save get-ready details, create/refresh the Cleanup card, email teams.
  app.post('/fni/deals/:id/approve', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const b = req.body || {}
    const { data: deal } = await supabaseAdmin.from('deals')
      .select('id, inventory_id, contact_id, created_by, deal_number')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'Deal not found' })

    const now = new Date().toISOString()
    const delivery_date = b.delivery_date || null
    const delivery_time = b.delivery_time || null
    const fni_products = typeof b.fni_products === 'string' ? b.fni_products.slice(0, 2000) : null
    const notes = typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null

    // The approve dialog can attach a stocked vehicle for deals that were desked
    // without one — required for the car to reach Cleanup. Validate it's ours.
    let invId = deal.inventory_id || null
    const pickedInv = typeof b.inventory_id === 'string' ? b.inventory_id.trim() : ''
    if (pickedInv && pickedInv !== invId) {
      const { data: veh } = await supabaseAdmin.from('inventory')
        .select('id').eq('id', pickedInv).eq('dealership_id', req.dealershipId).maybeSingle()
      if (veh) invId = veh.id
    }

    await supabaseAdmin.from('deals')
      .update({ delivery_date, delivery_time, fni_products, notes, approved_at: now, updated_at: now,
        ...(invId && invId !== deal.inventory_id ? { inventory_id: invId } : {}) })
      .eq('id', deal.id).eq('dealership_id', req.dealershipId)

    // Combine date + time into the Cleanup card's delivery timestamp.
    let delivery_at = null
    if (delivery_date) { const d = new Date(`${delivery_date}T${delivery_time || '09:00'}`); if (!isNaN(d)) delivery_at = d.toISOString() }

    // Create or refresh the Cleanup (recon) card for the vehicle.
    if (invId) {
      await ensureGetReadyCard(req.dealershipId, {
        inventoryId: invId, dealId: deal.id, deliveryAt: delivery_at,
        salespersonId: deal.created_by || null, fniProducts: fni_products, notes,
      })
    }

    audit(req, 'deal.approved', {
      deal_id: deal.id,
      after_state: { delivery_date, delivery_time, fni_products, inventory_id: invId },
    })

    // Best-effort notification email to managers + salesperson + cleanup/service.
    sendGetReadyEmails(req.dealershipId, deal, { delivery_date, delivery_time, fni_products, notes })
      .catch(e => console.warn('[fni] get-ready email failed:', e.message))

    // `cleanup` tells the UI whether a Cleanup/get-ready card was actually created —
    // it can only happen when the deal is linked to a stocked vehicle.
    res.json({ ok: true, approved_at: now, cleanup: !!invId })
  })

  // ── Funding queue ──────────────────────────────────────────────────────────
  // Real funding state on the canonical deal (funding_status / funding_submitted_at
  // / funded_at) — not inferred from "delivered". One read for the whole queue,
  // joined to the SELECTED lender decision so the UI needs no second round-trip.
  app.get('/fni/funding', requireAuth, requireMfa, requirePermission('accounting.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      const { data: deals, error } = await supabaseAdmin.from('deals')
        .select('id, deal_number, contact_id, inventory_id, deal_status, selling_price, delivered_at, funding_status, funding_submitted_at, funded_at')
        .eq('dealership_id', req.dealershipId)
        .or('funding_status.not.is.null,deal_status.eq.delivered')
        .order('delivered_at', { ascending: true, nullsFirst: false })
      if (error) throw error
      const ids = (deals || []).map(d => d.id)
      const { data: decisions } = ids.length
        ? await supabaseAdmin.from('deal_lender_decisions')
            .select('deal_id, lender_id, decision, rate, term_months, approved_amount, conditions, approval_expires_on, submitted_at, selected')
            .eq('dealership_id', req.dealershipId).in('deal_id', ids).eq('selected', true)
        : { data: [] }
      const byDeal = {}
      for (const d of decisions || []) byDeal[d.deal_id] = d
      const now = Date.now()
      res.json({
        deals: (deals || []).map(d => ({
          ...d,
          // Deals delivered before funding was tracked read as `pending`, not as a
          // fabricated state — funding_status stays null in the database.
          funding_state: d.funding_status || (d.deal_status === 'delivered' ? 'pending' : 'not_required'),
          selected_decision: byDeal[d.id] || null,
          days_in_funding: d.funding_submitted_at
            ? Math.floor((now - new Date(d.funding_submitted_at).getTime()) / 864e5) : null,
        })),
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Advance a deal's funding state. This is the ONLY producer of `funding.received`.
  //
  // Idempotency (brief §2/§5): the event fires only on the transition INTO `funded`
  // from something else. Re-saving an already-funded deal is a no-op, and unrelated
  // lender edits never touch this path. Defence in depth — the Accounting Engine's
  // postJournal() also dedupes on (dealership_id, source, reference, event_name), so
  // even a duplicate emit yields exactly one journal.
  const FUNDING_STATES = ['not_required', 'pending', 'submitted', 'conditions', 'funded', 'exception']
  app.put('/fni/deals/:id/funding', requireAuth, requireMfa, requirePermission('accounting.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const next = String(req.body?.funding_status || '').trim()
    if (!FUNDING_STATES.includes(next)) return res.status(400).json({ error: `funding_status must be one of ${FUNDING_STATES.join(', ')}` })
    try {
      const { data: deal } = await supabaseAdmin.from('deals')
        .select('id, funding_status, funded_at, funding_submitted_at, selling_price')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!deal) return res.status(404).json({ error: 'Deal not found' })

      const wasFunded = deal.funding_status === 'funded'
      const now = new Date().toISOString()
      const patch = { funding_status: next, updated_at: now }
      if (next === 'submitted' && !deal.funding_submitted_at) patch.funding_submitted_at = now
      if (next === 'funded' && !wasFunded) patch.funded_at = now

      const { error } = await supabaseAdmin.from('deals').update(patch)
        .eq('id', deal.id).eq('dealership_id', req.dealershipId)
      if (error) throw error

      // The transition — not the save — is the business event.
      if (next === 'funded' && !wasFunded) {
        const { data: sel } = await supabaseAdmin.from('deal_lender_decisions')
          .select('lender_id').eq('deal_id', deal.id).eq('selected', true).maybeSingle()
        // The SAME figure delivery debited to Contracts in Transit, from the one Deal
        // Engine derivation — so funding clears CIT to exactly zero. Falling back to
        // selling_price here (as this once did) would leave a permanent CIT residue,
        // because delivery never debited selling_price.
        const settlement = await dealSettlement(req.dealershipId, deal.id)
        const amount = Number(settlement?.cit ?? 0)
        // Accounting owns the ledger: it clears Contracts in Transit from this event.
        // No journal logic here (kernel contract §1/§4).
        emitEvent({
          dealershipId: req.dealershipId, eventName: 'funding.received', entityType: 'deal', entityId: deal.id,
          summary: `Funding received on deal ${deal.id}`, department: 'fni',
          payload: { deal_id: deal.id, amount, lender_id: sel?.lender_id || null, ref: deal.id },
          createdBy: req.user?.id || null,
        })
        audit(req, 'fni.funding_received', { deal_id: deal.id, amount })
      }
      res.json({ ok: true, funding_status: next, funded_at: patch.funded_at || deal.funded_at || null })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Lender decisions (one deal → many lender answers) ──────────────────────
  app.get('/fni/deals/:id/lender-decisions', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      const { data, error } = await supabaseAdmin.from('deal_lender_decisions')
        .select('*').eq('dealership_id', req.dealershipId).eq('deal_id', req.params.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      res.json({ decisions: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/fni/deals/:id/lender-decisions', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const b = req.body || {}
    try {
      const { data: deal } = await supabaseAdmin.from('deals').select('id')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!deal) return res.status(404).json({ error: 'Deal not found' })
      // The decision references the deal and the lender only — customer, vehicle and
      // deal figures are never copied here.
      const { data, error } = await supabaseAdmin.from('deal_lender_decisions').insert([{
        dealership_id: req.dealershipId, deal_id: deal.id, lender_id: b.lender_id || null,
        submission_status: b.submission_status || 'draft', submitted_at: b.submitted_at || null,
        responded_at: b.responded_at || null, decision: b.decision || null,
        rate: b.rate ?? null, term_months: b.term_months ?? null, approved_amount: b.approved_amount ?? null,
        conditions: b.conditions || null, approval_expires_on: b.approval_expires_on || null,
        notes: b.notes || null, created_by: req.user?.id || null, updated_by: req.user?.id || null,
      }]).select().single()
      if (error) throw error
      audit(req, 'fni.lender_decision_created', { deal_id: deal.id, decision_id: data.id, lender_id: data.lender_id })
      res.json({ decision: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Select the winning decision. Only one may be selected per deal — a partial unique
  // index enforces that in the database, so a concurrent write cannot produce two.
  app.put('/fni/deals/:dealId/lender-decisions/:id/select', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      await supabaseAdmin.from('deal_lender_decisions').update({ selected: false, updated_by: req.user?.id || null })
        .eq('dealership_id', req.dealershipId).eq('deal_id', req.params.dealId).eq('selected', true)
      const { data, error } = await supabaseAdmin.from('deal_lender_decisions')
        .update({ selected: true, updated_at: new Date().toISOString(), updated_by: req.user?.id || null })
        .eq('dealership_id', req.dealershipId).eq('deal_id', req.params.dealId).eq('id', req.params.id)
        .select().maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Decision not found' })
      audit(req, 'fni.lender_decision_selected', { deal_id: req.params.dealId, decision_id: data.id, lender_id: data.lender_id })
      res.json({ decision: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Delivered → deal delivered, vehicle sold, customer marked delivered; off the list.
  app.post('/fni/deals/:id/delivered', requireAuth, requireMfa, requirePermission('deal.finalize'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: deal } = await supabaseAdmin.from('deals')
      .select('id, deal_number, inventory_id, contact_id, created_by').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'Deal not found' })
    const now = new Date().toISOString()
    await supabaseAdmin.from('deals').update({ deal_status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', deal.id).eq('dealership_id', req.dealershipId)
    if (deal.inventory_id) await supabaseAdmin.from('inventory').update({ status: 'sold', sold_at: now })
      .eq('id', deal.inventory_id).eq('dealership_id', req.dealershipId)
    if (deal.contact_id) await supabaseAdmin.from('contacts').update({ status: 'delivered', updated_at: now })
      .eq('id', deal.contact_id).eq('dealership_id', req.dealershipId)
    emitWebhook(req.dealershipId, 'deal.delivered', { deal_id: deal.id, contact_id: deal.contact_id || null, inventory_id: deal.inventory_id || null, at: now })
    // Same "sold & delivered" alert the Delivery queue raises — this is the other
    // path a car can reach delivered through, so it must notify identically.
    await notifyDealDelivered({ dealershipId: req.dealershipId, deal })
    // Emit to the spine so every engine reacts uniformly: the Accounting Engine posts
    // the delivery journal, the Commission Engine calculates, and the Integration Engine
    // syncs to external books. No direct cross-engine calls (kernel contract §3/§4).
    emitEvent({
      dealershipId: req.dealershipId, eventName: 'deal.status_changed', entityType: 'deal', entityId: deal.id,
      summary: 'Deal marked delivered', toState: 'delivered', department: 'F&I', createdBy: req.user?.id || null,
      payload: { contact_id: deal.contact_id || null, inventory_id: deal.inventory_id || null, action: 'fni_delivered' },
    })
    audit(req, 'deal.delivered', {
      deal_id: deal.id,
      after_state: { deal_status: 'delivered', delivered_at: now, inventory_id: deal.inventory_id || null },
    })
    res.json({ ok: true })
  })

  // Cleanup/service notification recipients (external addresses, comma/newline sep).
  app.put('/fni/settings', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const emails = typeof req.body?.cleanup_notify_emails === 'string' ? req.body.cleanup_notify_emails.slice(0, 1000) : ''
    const { data: before } = await supabaseAdmin.from('dealerships').select('cleanup_notify_emails').eq('id', req.dealershipId).maybeSingle()
    const { error } = await supabaseAdmin.from('dealerships').update({ cleanup_notify_emails: emails }).eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'fni.cleanup_notification_settings_updated', { before_state: before, after_state: { cleanup_notify_emails: emails } })
    res.json({ ok: true })
  })
}

// Email the get-ready request to managers + the salesperson + the configured
// cleanup/service addresses. Staff emails come from profiles.business_email.
async function sendGetReadyEmails(dealershipId, deal, info) {
  const { data: dealer } = await supabaseAdmin.from('dealerships')
    .select('name, cleanup_notify_emails').eq('id', dealershipId).maybeSingle()
  const { data: mgrs } = await supabaseAdmin.from('profiles')
    .select('business_email').eq('dealership_id', dealershipId).in('role', FNI_NOTIFICATION_ROLES)
  const recips = new Set()
  for (const m of (mgrs || [])) if (m.business_email) recips.add(m.business_email.trim())
  if (deal.created_by) {
    const { data: sp } = await supabaseAdmin.from('profiles').select('business_email').eq('id', deal.created_by).maybeSingle()
    if (sp?.business_email) recips.add(sp.business_email.trim())
  }
  for (const e of String(dealer?.cleanup_notify_emails || '').split(/[,\n;]+/).map(s => s.trim()).filter(Boolean)) recips.add(e)
  if (!recips.size) return

  let vehLabel = 'Vehicle', custLabel = ''
  if (deal.inventory_id) {
    const { data: v } = await supabaseAdmin.from('inventory').select('year, make, model, trim, stocknumber').eq('id', deal.inventory_id).maybeSingle()
    if (v) vehLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') + (v.stocknumber ? ` (#${v.stocknumber})` : '')
  }
  if (deal.contact_id) {
    const { data: c } = await supabaseAdmin.from('contacts').select('full_name').eq('id', deal.contact_id).maybeSingle()
    custLabel = c?.full_name || ''
  }
  const when = info.delivery_date ? `${info.delivery_date}${info.delivery_time ? ' at ' + info.delivery_time : ''}` : 'TBD'
  const subject = `Get ready: ${vehLabel} — delivery ${when}`
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <h2 style="margin:0 0 10px">Get-ready request</h2>
    <p style="margin:0 0 10px"><b>Vehicle:</b> ${esc(vehLabel)}<br>
    ${custLabel ? `<b>Customer:</b> ${esc(custLabel)}<br>` : ''}
    <b>Delivery:</b> ${esc(when)}<br>
    ${deal.deal_number ? `<b>Deal #:</b> ${esc(String(deal.deal_number))}<br>` : ''}</p>
    ${info.fni_products ? `<p style="margin:0 0 10px"><b>F&amp;I products to install:</b><br>${esc(info.fni_products).replace(/\n/g, '<br>')}</p>` : ''}
    ${info.notes ? `<p style="margin:0 0 10px"><b>Special notes:</b><br>${esc(info.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <p style="color:#666;font-size:12px;margin-top:16px">${esc(dealer?.name || 'Dealership')} · sent by MarketSync</p>
  </div>`
  const text = `Get-ready request\nVehicle: ${vehLabel}\n${custLabel ? 'Customer: ' + custLabel + '\n' : ''}Delivery: ${when}\n${deal.deal_number ? 'Deal #: ' + deal.deal_number + '\n' : ''}${info.fni_products ? 'F&I products: ' + info.fni_products + '\n' : ''}${info.notes ? 'Notes: ' + info.notes + '\n' : ''}`
  await sendEmail({ to: [...recips].join(','), subject, html, text })
}
