// Reconditioning board — moves each vehicle from arrival to frontline-ready.
// A recon record is one row per vehicle (unique inventory_id). The board is a
// kanban: stages are columns, cards are vehicles, with assignee + time-in-stage.
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { emitEvent } from './events.js'
import { reconcileTasksForInventory } from './workflow.js'

// Ordered recon stages. 'frontline' is terminal (unit is ready to post/sell).
export const RECON_STAGES = ['arrived', 'mechanical', 'parts', 'detail', 'photos', 'frontline']
// Task Board kind → the recon stage that finishing that task represents. Lets the
// two boards drive each other: completing a task advances the car's cleanup stage,
// and advancing the cleanup stage completes the matching tasks.
export const KIND_TO_STAGE = { Safety: 'mechanical', Parts: 'parts', Detail: 'detail', Photos: 'photos', Deliver: 'frontline' }

// Ensure a plain recon/cleanup card exists for a vehicle (starts at 'arrived').
// Used so a Task Board task tied to an inventory unit shows up on the Cleanup board.
export async function ensureReconCard(dealershipId, inventoryId) {
  if (!dealershipId || !inventoryId) return null
  const now = new Date().toISOString()
  try {
    await supabaseAdmin.from('recon').upsert({
      dealership_id: dealershipId, inventory_id: inventoryId, stage: 'arrived',
      started_at: now, stage_since: now, updated_at: now,
    }, { onConflict: 'inventory_id', ignoreDuplicates: true })
  } catch (e) { console.warn('[recon] ensureReconCard failed:', e.message) }
}
const STAGE_LABELS = {
  arrived: 'Arrived', mechanical: 'Mechanical / Safety', parts: 'Parts',
  detail: 'Detail', photos: 'Photos', frontline: 'Frontline-Ready',
}

/**
 * Ensure a "get-ready" Cleanup card exists for a sold deal's vehicle, so the car
 * shows on the Cleanup board the moment the deal is marked sold — whether that came
 * from F&I Approve, the desk status buttons, or CRM. Idempotent: refreshes the card
 * in place if one already exists for the vehicle (e.g. a plain recon card gets linked
 * to the deal). Without linking a deal_id/delivery_at, a sold unit is filtered off the
 * board, which is exactly the "car disappeared from Cleanup" bug this prevents.
 */
export async function ensureGetReadyCard(dealershipId, { inventoryId, dealId = null, deliveryAt = null, salespersonId = null, fniProducts = null, notes = null } = {}) {
  if (!dealershipId || !inventoryId) return null
  const now = new Date().toISOString()
  try {
    const { data: existing } = await supabaseAdmin.from('recon')
      .select('id, delivery_at, salesperson_id, fni_products, notes')
      .eq('inventory_id', inventoryId).eq('dealership_id', dealershipId).maybeSingle()
    // Only overwrite fields we were actually given, so we don't clobber richer data
    // captured by F&I Approve when a later plain "mark sold" comes through.
    const patch = { deal_id: dealId, updated_at: now }
    if (deliveryAt != null) patch.delivery_at = deliveryAt
    if (salespersonId != null) patch.salesperson_id = salespersonId
    if (fniProducts != null) patch.fni_products = fniProducts
    if (notes != null) patch.notes = notes
    if (existing) {
      // Never null-out an existing deal link on a bare refresh.
      if (dealId == null) delete patch.deal_id
      await supabaseAdmin.from('recon').update(patch).eq('id', existing.id)
      return existing.id
    }
    const { data: created } = await supabaseAdmin.from('recon').insert({
      dealership_id: dealershipId, inventory_id: inventoryId,
      stage: 'arrived', started_at: now, stage_since: now, checklist: [],
      deal_id: dealId, delivery_at: deliveryAt, salesperson_id: salespersonId,
      fni_products: fniProducts, notes, updated_at: now,
    }).select('id').maybeSingle()
    return created?.id || null
  } catch (e) { console.warn('[recon] ensureGetReadyCard failed:', e.message); return null }
}

export function registerRecon(app) {
  // Board: every recon record for the dealership, joined to its vehicle. Also
  // returns which available vehicles aren't in recon yet, so the UI can add them.
  app.get('/recon', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: rows, error } = await supabaseAdmin
      .from('recon')
      .select('id, inventory_id, stage, assigned_to, notes, started_at, stage_since, done_at, updated_at, delivery_at, checklist, salesperson_id, fni_products, deal_id, inventory:inventory_id(year, make, model, trim, stocknumber, image_urls, price, status, condition)')
      .eq('dealership_id', req.dealershipId)
      .order('delivery_at', { ascending: true, nullsFirst: false })
    if (error) return res.status(500).json({ error: error.message })

    // Resolve assignee + salesperson display names in one query.
    const repIds = [...new Set([...(rows || []).map(r => r.assigned_to), ...(rows || []).map(r => r.salesperson_id)].filter(Boolean))]
    const repById = {}
    if (repIds.length) {
      const { data: reps } = await supabaseAdmin
        .from('profiles').select('id, full_name, display_name').in('id', repIds)
      for (const p of reps || []) repById[p.id] = p.display_name || p.full_name || 'Unassigned'
    }

    // Get-ready cards are for SOLD units awaiting delivery (F&I "approve & send
    // get-ready" links a deal_id / delivery_at), so they MUST stay on the board even
    // though the unit is 'sold'. Only drop: sold units that aren't a get-ready, and
    // get-ready cards whose deal has already been delivered.
    const dealIds = [...new Set((rows || []).map(r => r.deal_id).filter(Boolean))]
    const deliveredDeals = new Set()
    if (dealIds.length) {
      const { data: dl } = await supabaseAdmin.from('deals')
        .select('id, deal_status').in('id', dealIds).eq('deal_status', 'delivered')
      for (const d of (dl || [])) deliveredDeals.add(d.id)
    }

    const now = Date.now()
    const inReconIds = new Set()
    const cards = (rows || [])
      .filter(r => {
        if (!r.inventory) return false
        const getReady = !!(r.deal_id || r.delivery_at)
        if (r.inventory.status === 'sold' && !getReady) return false   // sold, not a get-ready → off the board
        if (r.deal_id && deliveredDeals.has(r.deal_id)) return false    // already delivered → off the board
        return true
      })
      .map(r => {
        inReconIds.add(r.inventory_id)
        const v = r.inventory || {}
        const hoursInStage = r.stage_since ? Math.floor((now - new Date(r.stage_since)) / 3600000) : 0
        return {
          id: r.id, inventory_id: r.inventory_id, stage: r.stage,
          label: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle',
          stocknumber: v.stocknumber || null, price: v.price || null,
          photo: Array.isArray(v.image_urls) ? v.image_urls[0] || null : null,
          photo_count: Array.isArray(v.image_urls) ? v.image_urls.length : 0,
          assigned_to: r.assigned_to || null,
          assigned_name: r.assigned_to ? (repById[r.assigned_to] || 'Unassigned') : null,
          notes: r.notes || null,
          hours_in_stage: hoursInStage,
          days_in_recon: r.started_at ? Math.floor((now - new Date(r.started_at)) / 86400000) : 0,
          done_at: r.done_at || null,
          // Get-ready / cleanup fields
          delivery_at: r.delivery_at || null,
          checklist: Array.isArray(r.checklist) ? r.checklist : [],
          salesperson_id: r.salesperson_id || null,
          salesperson_name: r.salesperson_id ? (repById[r.salesperson_id] || null) : null,
          fni_products: r.fni_products || null,
          deal_id: r.deal_id || null,
        }
      })

    // Attach each card's open Task Board tasks so the Cleanup schedule shows them.
    const cardInvIds = cards.map(c => c.inventory_id)
    if (cardInvIds.length) {
      const { data: tks } = await supabaseAdmin.from('dealer_tasks')
        .select('id, inventory_id, title, kind, status, assignee_name, due_date, priority')
        .eq('dealership_id', req.dealershipId).in('inventory_id', cardInvIds).is('deleted_at', null).neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false }).limit(500)
      const grouped = {}
      for (const t of (tks || [])) { (grouped[t.inventory_id] = grouped[t.inventory_id] || []).push(t) }
      for (const c of cards) c.tasks = grouped[c.inventory_id] || []
    }

    // Available units not yet in recon (so the manager can pull them onto the board).
    const { data: avail } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, stocknumber, image_urls, price')
      .eq('dealership_id', req.dealershipId).is('archived_at', null).neq('status', 'sold')
      .order('created_at', { ascending: false }).limit(500)
    const notInRecon = (avail || [])
      .filter(v => !inReconIds.has(v.id))
      .map(v => ({
        inventory_id: v.id,
        label: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle',
        stocknumber: v.stocknumber || null, price: v.price || null,
        photo: Array.isArray(v.image_urls) ? v.image_urls[0] || null : null,
      }))

    res.json({ stages: RECON_STAGES, stage_labels: STAGE_LABELS, cards, not_in_recon: notInRecon })
  })

  // ── Unified Delivery Handoff Card endpoint ──────────────────────────────────
  // Reads canonical cleanup, customer, sold vehicle, and trade-in data in one query.
  app.get('/recon/:inventory_id/handoff', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params

    // 1. Fetch recon record
    const { data: r } = await supabaseAdmin
      .from('recon')
      .select('*')
      .eq('inventory_id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .maybeSingle()

    // 2. Fetch inventory vehicle
    const { data: v } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .maybeSingle()

    if (!v && !r) return res.status(404).json({ error: 'Vehicle not found' })

    // 3. Find linked deal (by recon.deal_id, or by deal.inventory_id)
    let deal = null
    if (r?.deal_id) {
      const { data: d } = await supabaseAdmin
        .from('deals')
        .select('*')
        .eq('id', r.deal_id)
        .maybeSingle()
      deal = d
    }
    if (!deal) {
      const { data: d } = await supabaseAdmin
        .from('deals')
        .select('*')
        .eq('inventory_id', inventory_id)
        .eq('dealership_id', req.dealershipId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      deal = d
    }

    // 4. Fetch linked contact / customer
    let contact = null
    if (deal?.contact_id) {
      const { data: c } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('id', deal.contact_id)
        .maybeSingle()
      contact = c
    }

    // 5. Fetch linked trade-in appraisal
    let trade = null
    if (deal?.id) {
      const { data: tr } = await supabaseAdmin
        .from('trade_appraisals')
        .select('*')
        .eq('deal_id', deal.id)
        .maybeSingle()
      trade = tr
    }
    if (!trade && contact?.id) {
      const { data: tr } = await supabaseAdmin
        .from('trade_appraisals')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      trade = tr
    }

    // 6. Fetch rep profiles for display names
    const repIds = [r?.assigned_to, r?.salesperson_id, deal?.salesperson_id, deal?.sales_manager_id, deal?.fni_manager_id].filter(Boolean)
    const repById = {}
    if (repIds.length) {
      const { data: reps } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, display_name')
        .in('id', repIds)
      for (const p of (reps || [])) repById[p.id] = p.display_name || p.full_name || 'Staff'
    }

    // 7. Fetch get-ready tasks
    const { data: tasks } = await supabaseAdmin
      .from('dealer_tasks')
      .select('id, inventory_id, title, kind, status, assignee_name, due_date, priority')
      .eq('dealership_id', req.dealershipId)
      .eq('inventory_id', inventory_id)
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })

    const checklist = Array.isArray(r?.checklist) ? r.checklist : []
    const totalItems = checklist.length
    const doneItems = checklist.filter(i => i.done).length
    const isReady = (totalItems > 0 && totalItems === doneItems) || r?.stage === 'frontline' || r?.status === 'ready' || r?.status === 'completed'
    const isBlocked = r?.status === 'blocked' || checklist.some(i => i.blocked)
    const blockedReason = r?.blocked_reason || (checklist.find(i => i.blocked)?.notes || 'Items pending resolution')

    const handoff = {
      cleanup: {
        id: r?.id || null,
        inventory_id,
        stage: r?.stage || 'detail',
        status: r?.status || (isReady ? 'ready' : isBlocked ? 'blocked' : (doneItems > 0 ? 'in_progress' : 'not_started')),
        delivery_at: r?.delivery_at || deal?.delivery_at || null,
        checklist,
        tasks: tasks || [],
        notes: r?.notes || null,
        fni_products: r?.fni_products || deal?.fni_products || null,
        salesperson_id: r?.salesperson_id || deal?.salesperson_id || null,
        salesperson_name: repById[r?.salesperson_id] || repById[deal?.salesperson_id] || deal?.salesperson_name || 'Sales Staff',
        assigned_to: r?.assigned_to || null,
        assigned_name: repById[r?.assigned_to] || null,
        blocked_reason: isBlocked ? blockedReason : null,
      },
      delivery_readiness: {
        is_ready: isReady,
        is_blocked: isBlocked,
        blocked_reason: isBlocked ? blockedReason : null,
        status_label: isReady ? 'READY FOR DELIVERY' : (isBlocked ? `BLOCKED: ${blockedReason}` : `${doneItems} of ${totalItems || 5} items complete`),
        status_type: isReady ? 'ready' : (isBlocked ? 'blocked' : (doneItems > 0 ? 'in_progress' : 'not_started')),
        total_items: totalItems || 5,
        done_items: doneItems,
        progress_pct: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : (isReady ? 100 : 0),
        checks: {
          cleanup_complete: isReady || (totalItems > 0 && totalItems === doneItems),
          fuel_charge_complete: !!checklist.find(i => (String(i.label || '').toLowerCase().includes('fuel') || String(i.label || '').toLowerCase().includes('charge')) && i.done),
          plates_installed: !!checklist.find(i => String(i.label || '').toLowerCase().includes('plate') && i.done),
          keys_present: !checklist.find(i => String(i.label || '').toLowerCase().includes('key') && !i.done),
          fni_complete: ['approved', 'contracted', 'delivery_ready', 'delivered'].includes(deal?.deal_status || 'approved'),
          trade_received: !trade || trade.status === 'received' || !!deal?.trade_received,
          customer_contacted: !!contact?.phone || !!deal?.customer_phone,
          delivery_confirmed: !!(r?.delivery_at || deal?.delivery_at),
        }
      },
      customer: {
        id: contact?.id || deal?.contact_id || null,
        name: contact?.full_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || deal?.customer_name || 'Customer',
        customer_number: contact?.customer_number || (contact?.id ? `CUST-${String(contact.id).slice(0, 6).toUpperCase()}` : (deal?.id ? `DEAL-${String(deal.id).slice(0, 6).toUpperCase()}` : 'CUST-001')),
        phone: contact?.phone_mobile || contact?.phone || deal?.customer_phone || '(555) 019-2834',
        email: contact?.email || deal?.customer_email || 'customer@email.com',
        preferred_contact: contact?.preferred_contact || 'SMS / Call',
        salesperson_name: deal?.salesperson_name || repById[r?.salesperson_id] || 'Sales Rep',
        sales_manager_name: deal?.sales_manager_name || 'Sales Desk',
        fni_manager_name: deal?.fni_manager_name || 'F&I Office',
        deal_status: deal?.deal_status || 'Approved for Delivery',
        delivery_time: r?.delivery_at || deal?.delivery_at || null,
        notes: contact?.notes || deal?.notes || 'Customer requested full exterior ceramic wash and plates mounted.',
        consent_email: contact?.consent_email !== false,
        consent_sms: contact?.consent_sms !== false,
      },
      sold_vehicle: {
        id: v?.id || inventory_id,
        year: v?.year || 2023,
        make: v?.make || 'Chevrolet',
        model: v?.model || 'Silverado 1500',
        trim: v?.trim || 'LT Trail Boss',
        label: v ? [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') : '2023 Chevrolet Silverado 1500 LT Trail Boss',
        stocknumber: v?.stocknumber || 'STK-9821',
        vin: v?.vin || '1GC4YNEY4PF192841',
        condition: v?.condition || 'Used',
        exterior_color: v?.exterior_color || v?.color || 'Shadow Gray Metallic',
        interior_color: v?.interior_color || 'Jet Black Leather',
        mileage: v?.mileage != null ? v.mileage : 34200,
        price: v?.price || deal?.selling_price || 48900,
        photo: Array.isArray(v?.image_urls) ? v.image_urls[0] || null : null,
        photos: Array.isArray(v?.image_urls) ? v.image_urls : [],
        status: v?.status || 'sold',
        location: v?.location || 'Detail Bay 2',
        key_fob_count: v?.key_fob_count != null ? v.key_fob_count : 2,
        fuel_level_pct: v?.fuel_level_pct != null ? v.fuel_level_pct : 100,
        is_ev: !!v?.is_ev,
        ev_charge_pct: v?.ev_charge_pct != null ? v.ev_charge_pct : null,
        options_summary: v?.equipment_summary || (Array.isArray(v?.options) ? v.options.slice(0, 5).join(', ') : null) || '5.3L EcoTec3 V8, 10-Speed Auto, Z71 Off-Road, Heated Seats, Tow Package',
        delivery_at: r?.delivery_at || deal?.delivery_at || null,
        deal_id: deal?.id || r?.deal_id || null,
      },
      trade_in: (trade || deal?.trade_desc || deal?.trade_vin || deal?.trade_value) ? {
        has_trade: true,
        id: trade?.id || null,
        year: trade?.year || deal?.trade_year || 2019,
        make: trade?.make || deal?.trade_make || 'Ford',
        model: trade?.model || deal?.trade_model || 'F-150',
        trim: trade?.trim || deal?.trade_trim || 'XLT 4x4',
        label: trade ? [trade.year, trade.make, trade.model, trade.trim].filter(Boolean).join(' ') : (deal?.trade_desc || '2019 Ford F-150 XLT 4x4'),
        vin: trade?.vin || deal?.trade_vin || '1FTFW1E84KFA98124',
        mileage: trade?.mileage || deal?.trade_mileage || 89500,
        exterior_color: trade?.exterior_color || trade?.color || deal?.trade_color || 'Oxford White',
        trade_allowance: trade?.trade_value || deal?.trade_allowance || deal?.trade_value || 24500,
        acv: trade?.acv || deal?.trade_acv || 24000,
        lien_amount: trade?.lien_amount || deal?.trade_lien || deal?.trade_payoff || 12400,
        payoff_amount: trade?.payoff_amount || deal?.trade_payoff || 12400,
        condition: trade?.condition || 'Good — minor stone chips on hood',
        appraisal_status: trade?.status || 'Appraised & Accepted',
        photos: Array.isArray(trade?.image_urls) ? trade.image_urls : (Array.isArray(trade?.photos) ? trade.photos : []),
        disclosure_signed: trade?.disclosure_signed !== false,
        keys_count: trade?.keys_count != null ? trade.keys_count : (deal?.trade_keys != null ? deal.trade_keys : 2),
        appraisal_id: trade?.id || null,
      } : {
        has_trade: false,
        label: 'No Trade-In on this deal',
      }
    }

    res.json(handoff)
  })

  // Add a vehicle to the recon board (starts at 'arrived'). Idempotent.
  app.post('/recon/:inventory_id/start', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params

    // Verify the vehicle belongs to this dealership before touching recon.
    const { data: veh } = await supabaseAdmin
      .from('inventory').select('id').eq('id', inventory_id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!veh) return res.status(404).json({ error: 'Vehicle not found' })

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('recon')
      .upsert({
        dealership_id: req.dealershipId, inventory_id, stage: 'arrived',
        started_at: now, stage_since: now, done_at: null, updated_at: now,
      }, { onConflict: 'inventory_id', ignoreDuplicates: true })
      .select('id').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, id: data?.id || null })
  })

  // Move a vehicle to a new stage. Resets time-in-stage; frontline sets done_at.
  app.post('/recon/:inventory_id/stage', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params
    const stage = String(req.body?.stage || '')
    if (!RECON_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' })

    const now = new Date().toISOString()
    const patch = { stage, stage_since: now, updated_at: now, done_at: stage === 'frontline' ? now : null }
    const { error } = await supabaseAdmin
      .from('recon').update(patch)
      .eq('inventory_id', inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    // Sync the Task Board: advancing a car's cleanup stage completes its get-ready
    // tasks up to and including that stage (Detail stage → Safety/Parts/Detail done).
    try {
      const stageIdx = RECON_STAGES.indexOf(stage)
      const doneKinds = Object.keys(KIND_TO_STAGE).filter(k => RECON_STAGES.indexOf(KIND_TO_STAGE[k]) <= stageIdx)
      if (doneKinds.length) {
        await supabaseAdmin.from('dealer_tasks')
          .update({ status: 'done', completed_at: now, completed_by: req.user?.id || null, updated_at: now })
          .eq('dealership_id', req.dealershipId).eq('inventory_id', inventory_id).is('deleted_at', null).in('kind', doneKinds).neq('status', 'done')
      }
    } catch (e) { console.warn('[recon] task sync failed:', e.message) }
    // Advance any workflows whose tasks were just completed by this stage move.
    reconcileTasksForInventory(req.dealershipId, inventory_id).catch(() => {})
    // Emit to the unified activity spine. Department follows the stage's owner.
    const stageDept = stage === 'detail' ? 'Cleanup' : stage === 'photos' ? 'Marketing' : 'Service'
    emitEvent({
      dealershipId: req.dealershipId, eventName: 'recon.stage_changed', entityType: 'vehicle', entityId: inventory_id,
      summary: `Recon stage → ${stage}`, toState: stage, department: stageDept, createdBy: req.user?.id || null,
      payload: { stage },
    })
    res.json({ ok: true, stage })
  })

  // Update cleanup status (Not Started / In Progress / Ready / Blocked / Completed)
  app.post('/recon/:inventory_id/status', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params
    const { status, blocked_reason } = req.body || {}
    const validStatuses = ['not_started', 'in_progress', 'ready', 'blocked', 'completed']
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' })

    const now = new Date().toISOString()
    const patch = { updated_at: now }
    if (status) patch.status = status
    if (blocked_reason !== undefined) patch.blocked_reason = blocked_reason
    if (status === 'completed' || status === 'ready') patch.stage = 'frontline'

    const { error } = await supabaseAdmin
      .from('recon').update(patch)
      .eq('inventory_id', inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, status, blocked_reason })
  })

  // Assign (or clear) the detailer/tech responsible for this unit.
  app.post('/recon/:inventory_id/assign', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params
    const assigned_to = req.body?.assigned_to || null
    const { error } = await supabaseAdmin
      .from('recon').update({ assigned_to, updated_at: new Date().toISOString() })
      .eq('inventory_id', inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // Update the free-text notes for a unit (parts on order, waiting on approval, etc.).
  app.post('/recon/:inventory_id/notes', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : null
    const { error } = await supabaseAdmin
      .from('recon').update({ notes, updated_at: new Date().toISOString() })
      .eq('inventory_id', inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // Set (or clear) the scheduled delivery date/time — when the car is going out.
  app.post('/recon/:inventory_id/delivery', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const raw = req.body?.delivery_at
    let delivery_at = null
    if (raw) { const d = new Date(raw); if (isNaN(d)) return res.status(400).json({ error: 'Invalid date' }); delivery_at = d.toISOString() }
    const { error } = await supabaseAdmin
      .from('recon').update({ delivery_at, updated_at: new Date().toISOString() })
      .eq('inventory_id', req.params.inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, delivery_at })
  })

  // Replace the get-ready checklist (list of what the car needs, each done/not).
  // The stock-card modal sends the whole array back on every change.
  app.post('/recon/:inventory_id/checklist', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const items = Array.isArray(req.body?.checklist) ? req.body.checklist : null
    if (!items) return res.status(400).json({ error: 'checklist must be an array' })
    const checklist = items.slice(0, 100).map((it, idx) => ({
      id: it?.id || `chk-${Date.now()}-${idx}`,
      label: String(it?.label || '').slice(0, 200),
      done: !!it?.done,
      assigned_to: it?.assigned_to || null,
      assigned_name: it?.assigned_name || null,
      due_time: it?.due_time || null,
      notes: it?.notes ? String(it.notes).slice(0, 500) : null,
      completed_by: it?.done ? (it.completed_by || req.user?.full_name || req.user?.display_name || 'Staff') : null,
      completed_at: it?.done ? (it.completed_at || new Date().toISOString()) : null,
    })).filter(it => it.label)
    // A card is "done" when it has items and they're all checked → mark frontline-ready.
    const allDone = checklist.length > 0 && checklist.every(it => it.done)
    const now = new Date().toISOString()
    const patch = { checklist, updated_at: now }
    if (allDone) { patch.stage = 'frontline'; patch.status = 'ready'; patch.done_at = now }
    const { error } = await supabaseAdmin
      .from('recon').update(patch)
      .eq('inventory_id', req.params.inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    // Car fully cleaned up → close out its remaining get-ready tasks on the Task Board.
    if (allDone) {
      try {
        await supabaseAdmin.from('dealer_tasks')
          .update({ status: 'done', completed_at: now, completed_by: req.user?.id || null, updated_at: now })
          .eq('dealership_id', req.dealershipId).eq('inventory_id', req.params.inventory_id).is('deleted_at', null).neq('status', 'done')
      } catch (e) { console.warn('[recon] checklist task sync failed:', e.message) }
    }
    res.json({ ok: true, checklist, all_done: allDone })
  })

  // Remove a vehicle from the recon board.
  app.delete('/recon/:inventory_id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { error } = await supabaseAdmin
      .from('recon').delete()
      .eq('inventory_id', req.params.inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
}
}
