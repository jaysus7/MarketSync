/**
 * Service & Parts Engine (kernel engine — see docs/SERVICE_PARTS_ENGINE_STAGE0.md).
 *
 * Repair orders + parts stock as first-class, event-driven objects. The engine OWNS
 * repair_orders / ro_lines / parts / part_txns, exposes read APIs + agent tools, reads
 * its labor/tax/markup from the Configuration Engine, and — on close — EMITS
 * service.closed so the Accounting Engine posts the balanced journal (that rule + the
 * parts/labor accounts already exist). It never posts journals itself.
 *
 * Coexists with the light service.js appointment book: an appointment (a crm_task) is
 * the front door to an RO; opening an RO from one links appointment_task_id.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { emitEvent } from './events.js'
import { getConfig, setConfig } from './config-engine.js'
import { getContact } from './crm.js'
import { registerTool } from './tool-registry.js'
import { raiseException } from './workflow.js'
import { audit } from '../audit.js'

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

const CONFIG_DEFAULT = { labor_rate: 149, tax_rate: 0, shop_supplies_pct: 0, part_markup_pct: 40, ro_prefix: 'RO-' }
async function svcConfig(dealershipId) {
  const c = await getConfig(dealershipId, 'service', {})
  return { ...CONFIG_DEFAULT, ...(c && typeof c === 'object' ? c : {}) }
}

// ── Read APIs (contract §4 — other engines query through these) ───────────────
export async function getRepairOrder(dealershipId, id) {
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('*').eq('id', id).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) return null
  const { data: lines } = await supabaseAdmin.from('ro_lines').select('*').eq('ro_id', id).is('deleted_at', null).order('created_at')
  return { ...ro, lines: lines || [] }
}
export async function listRepairOrders(dealershipId, { status = null, contactId = null, limit = 200 } = {}) {
  let q = supabaseAdmin.from('repair_orders').select('*').eq('dealership_id', dealershipId).order('created_at', { ascending: false }).limit(limit)
  if (status) q = q.eq('status', status)
  if (contactId) q = q.eq('contact_id', contactId)
  const { data } = await q
  return data || []
}
export async function getPart(dealershipId, id) {
  const { data } = await supabaseAdmin.from('parts').select('*').eq('id', id).eq('dealership_id', dealershipId).maybeSingle()
  return data || null
}
export async function searchParts(dealershipId, q, limit = 20) {
  let query = supabaseAdmin.from('parts').select('*').eq('dealership_id', dealershipId).order('part_number').limit(limit)
  if (q) query = query.or(`part_number.ilike.%${q}%,description.ilike.%${q}%`)
  const { data } = await query
  return data || []
}
export async function roSummary(dealershipId, { from = null, to = null } = {}) {
  let q = supabaseAdmin.from('repair_orders').select('status, total, labor_total, parts_total, labor_cost, parts_cost, closed_at').eq('dealership_id', dealershipId)
  if (from) q = q.gte('closed_at', from)
  if (to) q = q.lte('closed_at', to)
  const { data } = await q
  const rows = data || []
  const open = rows.filter(r => r.status !== 'closed' && r.status !== 'canceled').length
  const closed = rows.filter(r => r.status === 'closed')
  const revenue = round2(closed.reduce((s, r) => s + n(r.total), 0))
  const cost = round2(closed.reduce((s, r) => s + n(r.labor_cost) + n(r.parts_cost), 0))
  return { open_ros: open, closed_ros: closed.length, revenue, cost, gross: round2(revenue - cost) }
}

// ── RO totals ─────────────────────────────────────────────────────────────────
async function recomputeRoTotals(dealershipId, roId) {
  const cfg = await svcConfig(dealershipId)
  const { data: lines } = await supabaseAdmin.from('ro_lines').select('*').eq('ro_id', roId).is('deleted_at', null)
  const by = (t) => (lines || []).filter(l => l.line_type === t)
  const sum = (arr, f) => round2(arr.reduce((s, l) => s + n(f(l)), 0))
  const labor_total = sum(by('labor'), l => l.total)
  const parts_total = sum(by('part'), l => l.total)
  const sublet_total = sum(by('sublet'), l => l.total)
  const fee_total = sum(by('fee'), l => l.total)
  const labor_cost = sum(by('labor'), l => n(l.unit_cost) * n(l.qty))
  const parts_cost = sum(by('part'), l => n(l.unit_cost) * n(l.qty))
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('discount').eq('id', roId).maybeSingle()
  const discount = n(ro?.discount)
  const subtotal = round2(labor_total + parts_total + sublet_total + fee_total - discount)
  const tax = round2(subtotal * (n(cfg.tax_rate) / 100))
  const total = round2(subtotal + tax)
  await supabaseAdmin.from('repair_orders').update({
    labor_total, parts_total, sublet_total, fee_total, labor_cost, parts_cost, tax, total, updated_at: new Date().toISOString(),
  }).eq('id', roId).eq('dealership_id', dealershipId)
  return { labor_total, parts_total, sublet_total, fee_total, labor_cost, parts_cost, tax, total }
}

// ── RO lifecycle (write fns emit events) ──────────────────────────────────────
async function nextRoNumber(dealershipId, prefix) {
  const { count } = await supabaseAdmin.from('repair_orders').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId)
  return `${prefix}${String((count || 0) + 1).padStart(5, '0')}`
}

export async function openRepairOrder(dealershipId, { contactId = null, inventoryId = null, vehicleDesc = null, vin = null, odometer = null, advisorId = null, complaint = null, appointmentTaskId = null, createdBy = null } = {}) {
  const cfg = await svcConfig(dealershipId)
  const ro_number = await nextRoNumber(dealershipId, cfg.ro_prefix)
  const { data: ro, error } = await supabaseAdmin.from('repair_orders').insert({
    dealership_id: dealershipId, ro_number, contact_id: contactId, inventory_id: inventoryId,
    vehicle_desc: vehicleDesc, vin, odometer: odometer != null ? Math.trunc(n(odometer)) : null,
    advisor_id: advisorId, complaint, appointment_task_id: appointmentTaskId, status: 'open', created_by: createdBy,
  }).select('*').single()
  if (error) throw new Error(error.message)
  emitEvent({
    dealershipId, eventName: 'service.ro_opened', entityType: 'repair_order', entityId: ro.id,
    summary: `RO ${ro_number} opened`, toState: 'open', department: 'Service', createdBy,
    payload: { ro_number, contact_id: contactId, inventory_id: inventoryId },
  })
  return ro
}

export async function addRoLine(dealershipId, roId, line = {}) {
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('id, status').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status === 'closed' || ro.status === 'canceled') throw new Error('RO is ' + ro.status)
  const cfg = await svcConfig(dealershipId)
  const type = ['labor', 'part', 'sublet', 'fee'].includes(line.line_type) ? line.line_type : 'labor'
  let { part_id = null, description = null, qty = 1, hours = null, rate = null, unit_cost = 0, unit_price = 0 } = line
  qty = n(qty) || 1
  // Part line: pull defaults from the catalog part when present.
  if (type === 'part' && part_id) {
    const part = await getPart(dealershipId, part_id)
    if (part) {
      description = description || part.description || part.part_number
      unit_cost = unit_cost || n(part.cost)
      unit_price = unit_price || (n(part.price) || round2(n(part.cost) * (1 + n(cfg.part_markup_pct) / 100)))
    }
  }
  let total
  if (type === 'labor') {
    const h = n(hours); rate = n(rate) || n(cfg.labor_rate)
    total = h > 0 ? round2(h * rate) : round2(qty * n(unit_price))
  } else {
    total = round2(qty * n(unit_price))
  }
  const { data: inserted, error } = await supabaseAdmin.from('ro_lines').insert({
    dealership_id: dealershipId, ro_id: roId, line_type: type, part_id, description,
    qty, hours: hours != null ? n(hours) : null, rate: rate != null ? n(rate) : null,
    unit_cost: n(unit_cost), unit_price: n(unit_price), total,
  }).select('*').single()
  if (error) throw new Error(error.message)
  await recomputeRoTotals(dealershipId, roId)
  return inserted
}

export async function removeRoLine(dealershipId, roId, lineId, { userId = null } = {}) {
  const { data: before } = await supabaseAdmin.from('ro_lines').select('*')
    .eq('id', lineId).eq('ro_id', roId).eq('dealership_id', dealershipId).is('deleted_at', null).maybeSingle()
  if (!before) throw new Error('repair-order line not found')
  const { data, error } = await supabaseAdmin.from('ro_lines').update({
    deleted_at: new Date().toISOString(), deleted_by: userId,
  }).eq('id', lineId).eq('ro_id', roId).eq('dealership_id', dealershipId).is('deleted_at', null).select().maybeSingle()
  if (error || !data) throw new Error(error?.message || 'could not archive repair-order line')
  await recomputeRoTotals(dealershipId, roId)
  return { before, archived: data }
}

export async function setRoStatus(dealershipId, roId, toStatus, { userId = null } = {}) {
  const valid = ['open', 'in_progress', 'awaiting_parts', 'ready', 'closed', 'canceled']
  if (!valid.includes(toStatus)) throw new Error('invalid status')
  if (toStatus === 'closed') return closeRepairOrder(dealershipId, roId, { userId })
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('status, ro_number').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status === toStatus) return ro
  await supabaseAdmin.from('repair_orders').update({ status: toStatus, updated_at: new Date().toISOString() }).eq('id', roId).eq('dealership_id', dealershipId)
  emitEvent({
    dealershipId, eventName: 'service.ro_status_changed', entityType: 'repair_order', entityId: roId,
    summary: `RO ${ro.ro_number} → ${toStatus}`, fromState: ro.status, toState: toStatus, department: 'Service', createdBy: userId,
    payload: { ro_number: ro.ro_number },
  })
  return { ...ro, status: toStatus }
}

// Close: idempotent. Recompute, draw part stock from inventory, emit service.closed
// (Accounting posts the journal). Guard on already-closed so a bus replay is safe.
export async function closeRepairOrder(dealershipId, roId, { userId = null } = {}) {
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('*').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status === 'closed') return ro   // already closed — no double stock draw / double journal
  const totals = await recomputeRoTotals(dealershipId, roId)

  // Consume parts from stock (immutable ledger + decrement on-hand), once.
  const { data: partLines } = await supabaseAdmin.from('ro_lines').select('*').eq('ro_id', roId).eq('line_type', 'part').is('deleted_at', null)
  for (const l of partLines || []) {
    if (!l.part_id) continue
    await consumePart(dealershipId, l.part_id, n(l.qty), { roId, unitCost: n(l.unit_cost), userId })
  }

  const now = new Date().toISOString()
  await supabaseAdmin.from('repair_orders').update({ status: 'closed', closed_at: now, updated_at: now }).eq('id', roId).eq('dealership_id', dealershipId)
  const revenue = round2(totals.labor_total + totals.parts_total + totals.sublet_total + totals.fee_total - n(ro.discount))
  // `cost` relieves PARTS INVENTORY only (the service_closed rule credits parts_inventory).
  // Labor cost is tech payroll, not inventory COGS, so it is not part of this token.
  const cost = round2(totals.parts_cost)
  emitEvent({
    dealershipId, eventName: 'service.closed', entityType: 'repair_order', entityId: roId,
    summary: `RO ${ro.ro_number} closed — $${revenue.toFixed(2)}`, fromState: ro.status, toState: 'closed',
    department: 'Accounting', createdBy: userId,
    payload: { ro_id: roId, revenue, cost, inventory_id: ro.inventory_id || null, contact_id: ro.contact_id || null },
  })
  return { ...ro, status: 'closed', closed_at: now, total: totals.total }
}

// ── Parts stock (immutable ledger + on-hand) ──────────────────────────────────
export async function upsertPart(dealershipId, { partNumber, description = null, bin = null, cost = 0, price = 0, reorderPoint = 0 }) {
  if (!partNumber) throw new Error('part_number required')
  const { data, error } = await supabaseAdmin.from('parts').upsert({
    dealership_id: dealershipId, part_number: String(partNumber), description, bin,
    cost: n(cost), price: n(price), reorder_point: n(reorderPoint), updated_at: new Date().toISOString(),
  }, { onConflict: 'dealership_id,part_number' }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

async function moveStock(dealershipId, partId, txnType, qty, { unitCost = null, roId = null, reference = null, note = null, userId = null } = {}) {
  const part = await getPart(dealershipId, partId)
  if (!part) throw new Error('part not found')
  await supabaseAdmin.from('part_txns').insert({
    dealership_id: dealershipId, part_id: partId, txn_type: txnType, qty: n(qty),
    unit_cost: unitCost != null ? n(unitCost) : n(part.cost), ro_id: roId, reference, note, created_by: userId,
  })
  const newQty = round2(n(part.qty_on_hand) + n(qty))
  await supabaseAdmin.from('parts').update({ qty_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', partId).eq('dealership_id', dealershipId)
  // Low-stock exception surfaces on the Operations board via the exception engine.
  if (n(qty) < 0 && newQty <= n(part.reorder_point) && n(part.reorder_point) > 0) {
    raiseException(dealershipId, {
      kind: 'low_stock', entityType: 'part', entityId: partId, department: 'Service', severity: 'medium',
      description: `Part ${part.part_number} at/below reorder point (${newQty} ≤ ${part.reorder_point}).`,
    }).catch(() => {})
  }
  return newQty
}

export async function receiveParts(dealershipId, partId, qty, opts = {}) {
  const newQty = await moveStock(dealershipId, partId, 'receive', Math.abs(n(qty)), opts)
  const part = await getPart(dealershipId, partId)
  emitEvent({ dealershipId, eventName: 'parts.received', entityType: 'part', entityId: partId, summary: `Received ${Math.abs(n(qty))} × ${part?.part_number || ''}`, department: 'Service', createdBy: opts.userId || null, payload: { qty: Math.abs(n(qty)), on_hand: newQty } })
  return newQty
}
export async function adjustPart(dealershipId, partId, qty, opts = {}) {
  const newQty = await moveStock(dealershipId, partId, 'adjust', n(qty), opts)
  const part = await getPart(dealershipId, partId)
  emitEvent({ dealershipId, eventName: 'parts.adjusted', entityType: 'part', entityId: partId, summary: `Adjusted ${part?.part_number || ''} by ${n(qty)} → ${newQty}`, department: 'Service', createdBy: opts.userId || null, payload: { qty: n(qty), on_hand: newQty } })
  return newQty
}
export async function consumePart(dealershipId, partId, qty, opts = {}) {
  const newQty = await moveStock(dealershipId, partId, 'consume', -Math.abs(n(qty)), opts)
  const part = await getPart(dealershipId, partId)
  emitEvent({ dealershipId, eventName: 'parts.consumed', entityType: 'part', entityId: partId, summary: `Consumed ${Math.abs(n(qty))} × ${part?.part_number || ''}`, department: 'Service', createdBy: opts.userId || null, payload: { engine: true, qty: Math.abs(n(qty)), on_hand: newQty, ro_id: opts.roId || null } })
  return newQty
}

// ── Agent tools (contract §5 — registered into the shared registry) ────────────
function registerServiceTools() {
  registerTool({
    name: 'check_part_availability', surface: ['sales_chat', 'service'],
    description: "Check the dealership's parts stock by part number or description. Returns matching parts with on-hand quantity and price.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    async handler(a, ctx) {
      const rows = await searchParts(ctx.dealershipId, a.query, 10)
      return rows.map(p => ({ part_number: p.part_number, description: p.description, on_hand: p.qty_on_hand, price: p.price }))
    },
  })
  registerTool({
    name: 'open_repair_order', surface: 'service', audit: true,
    description: 'Open a repair order for a customer/vehicle with a stated complaint.',
    input_schema: { type: 'object', properties: {
      contact_id: { type: 'string' }, inventory_id: { type: 'string' }, vehicle_desc: { type: 'string' },
      vin: { type: 'string' }, odometer: { type: 'number' }, complaint: { type: 'string' },
    } },
    async handler(a, ctx) {
      const ro = await openRepairOrder(ctx.dealershipId, { contactId: a.contact_id || null, inventoryId: a.inventory_id || null, vehicleDesc: a.vehicle_desc || null, vin: a.vin || null, odometer: a.odometer ?? null, complaint: a.complaint || null, createdBy: ctx.userId || null })
      return { ok: true, ro_id: ro.id, ro_number: ro.ro_number }
    },
  })
  registerTool({
    name: 'add_ro_line', surface: 'service', audit: true,
    description: 'Add a labor, part, sublet, or fee line to a repair order.',
    input_schema: { type: 'object', properties: {
      ro_id: { type: 'string' }, line_type: { type: 'string', description: 'labor|part|sublet|fee' },
      part_id: { type: 'string' }, description: { type: 'string' }, qty: { type: 'number' },
      hours: { type: 'number' }, unit_price: { type: 'number' },
    }, required: ['ro_id'] },
    async handler(a, ctx) {
      const line = await addRoLine(ctx.dealershipId, a.ro_id, a)
      return { ok: true, line_id: line.id, total: line.total }
    },
  })
  registerTool({
    name: 'close_repair_order', surface: 'service', audit: true,
    description: 'Close a repair order — finalizes totals, draws parts from stock, and posts it to accounting.',
    input_schema: { type: 'object', properties: { ro_id: { type: 'string' } }, required: ['ro_id'] },
    async handler(a, ctx) {
      const ro = await closeRepairOrder(ctx.dealershipId, a.ro_id, { userId: ctx.userId || null })
      return { ok: true, status: ro.status, total: ro.total }
    },
  })
}

// ── HTTP surface ──────────────────────────────────────────────────────────────
// NOTE (RLS): all repair-order / parts data access lives in the exported engine
// helpers above (getRepairOrder, listRepairOrders, openRepairOrder, addRoLine,
// closeRepairOrder, moveStock, upsertPart, …), which are ALSO called with no request
// context by the AI service tools (registerServiceTools) and the events/workflow
// engines. They therefore stay on supabaseAdmin. The routes below are all tightly
// guarded by requirePermission('service.write_repair_order') (held only by owners /
// service_manager / technician), and the repair_orders/ro_lines/parts/part_txns RLS
// (service.view read, service.write_repair_order write) still applies to any direct
// Data-API access. Follow-up: thread an optional `db` arg through these helpers (as
// done for accountBalances) so route-driven calls run under req.supabase too.
export function registerServiceEngine(app) {
  registerServiceTools()

  const guard = (req, res) => {
    if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false }
    return true
  }

  app.get('/service-engine/ros', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    const rows = await listRepairOrders(req.dealershipId, { status: req.query.status || null, contactId: req.query.contact_id || null })
    res.json({ ros: rows })
  })
  app.get('/service-engine/ros/:id', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    const ro = await getRepairOrder(req.dealershipId, req.params.id)
    if (!ro) return res.status(404).json({ error: 'not found' })
    let customer = null
    if (ro.contact_id) { const c = await getContact(req.dealershipId, ro.contact_id).catch(() => null); customer = c ? { id: c.id, name: c.full_name, phone: c.phone || c.phone_mobile, email: c.email } : null }
    res.json({ ro, customer })
  })
  app.post('/service-engine/ros', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try {
      const b = req.body || {}
      const ro = await openRepairOrder(req.dealershipId, { contactId: b.contact_id || null, inventoryId: b.inventory_id || null, vehicleDesc: b.vehicle_desc || null, vin: b.vin || null, odometer: b.odometer ?? null, advisorId: b.advisor_id || req.user?.id || null, complaint: b.complaint || null, appointmentTaskId: b.appointment_task_id || null, createdBy: req.user?.id || null })
      res.json({ ok: true, ro })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/lines', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, line: await addRoLine(req.dealershipId, req.params.id, req.body || {}) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.delete('/service-engine/ros/:id/lines/:lineId', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try {
      const result = await removeRoLine(req.dealershipId, req.params.id, req.params.lineId, { userId: req.user?.id || null })
      audit(req, 'service.ro_line_archived', { before_state: result.before, after_state: result.archived })
      res.json({ ok: true, archived: true })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/status', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, ro: await setRoStatus(req.dealershipId, req.params.id, String(req.body?.status || ''), { userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/close', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, ro: await closeRepairOrder(req.dealershipId, req.params.id, { userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })

  app.get('/service-engine/parts', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    res.json({ parts: await searchParts(req.dealershipId, req.query.q || null, 200) })
  })
  app.post('/service-engine/parts', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try {
      const b = req.body || {}
      res.json({ ok: true, part: await upsertPart(req.dealershipId, { partNumber: b.part_number, description: b.description, bin: b.bin, cost: b.cost, price: b.price, reorderPoint: b.reorder_point }) })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/parts/:id/receive', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, on_hand: await receiveParts(req.dealershipId, req.params.id, req.body?.qty, { unitCost: req.body?.unit_cost, reference: req.body?.reference, userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/parts/:id/adjust', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, on_hand: await adjustPart(req.dealershipId, req.params.id, req.body?.qty, { note: req.body?.note, userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })

  app.get('/service-engine/summary', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    res.json(await roSummary(req.dealershipId, { from: req.query.from || null, to: req.query.to || null }))
  })

  app.get('/service-engine/config', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ config: await svcConfig(req.dealershipId) })
  })
  app.put('/service-engine/config', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const value = {
      labor_rate: n(b.labor_rate) || CONFIG_DEFAULT.labor_rate,
      tax_rate: n(b.tax_rate), shop_supplies_pct: n(b.shop_supplies_pct),
      part_markup_pct: n(b.part_markup_pct), ro_prefix: String(b.ro_prefix || CONFIG_DEFAULT.ro_prefix).slice(0, 10),
    }
    try { await setConfig(req.dealershipId, 'service', value, req); res.json({ ok: true, config: value }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })
}
