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
import { requireAuth, requireMfa } from '../middleware.js'
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
  const open = rows.filter(r => r.status !== 'closed').length
  const closed = rows.filter(r => r.status === 'closed')
  const revenue = round2(closed.reduce((s, r) => s + n(r.total), 0))
  const cost = round2(closed.reduce((s, r) => s + n(r.labor_cost) + n(r.parts_cost), 0))
  return { open_ros: open, closed_ros: closed.length, revenue, cost, gross: round2(revenue - cost) }
}

// ── Customer-owned vehicles (Phase 4) ─────────────────────────────────────────
// `inventory` is DEALER-OWNED stock. A customer's car is not stock, and putting one
// there would corrupt counts, merchandising, pricing, syndication and the Stage 3
// acquisition model. `customer_vehicles` is the canonical customer-owned vehicle:
// one row per VIN per dealership, reused on every future visit.
export async function getCustomerVehicle(dealershipId, id) {
  const { data } = await supabaseAdmin.from('customer_vehicles').select('*').eq('id', id).eq('dealership_id', dealershipId).maybeSingle()
  return data || null
}
export async function listCustomerVehicles(dealershipId, { contactId = null, vin = null, limit = 100 } = {}) {
  let q = supabaseAdmin.from('customer_vehicles').select('*').eq('dealership_id', dealershipId).order('updated_at', { ascending: false }).limit(limit)
  if (contactId) q = q.eq('contact_id', contactId)
  if (vin) q = q.ilike('vin', String(vin).trim())
  const { data } = await q
  return data || []
}

const cleanVin = (v) => String(v || '').trim().toUpperCase() || null

// Resolve the ONE canonical vehicle for this visit. Never creates a second row for a
// VIN we already know: the same car returning next year resolves to the same record,
// which is what makes per-vehicle service history possible at all.
//
// Sold-vehicle continuity: if this VIN was once our stock, the link back to that
// `inventory` row is kept. The inventory row is NOT altered — it still records that
// the dealer sold the unit; it is never made to pretend the dealer still owns it.
export async function findOrCreateCustomerVehicle(dealershipId, {
  vin = null, contactId = null, year = null, make = null, model = null, trim = null,
  plate = null, color = null, odometer = null, originInventoryId = null,
} = {}) {
  const VIN = cleanVin(vin)
  const odo = odometer != null && Number.isFinite(Number(odometer)) ? Math.trunc(Number(odometer)) : null

  const patchExisting = async (row) => {
    const patch = {}
    // Ownership can move; the vehicle record follows the current customer.
    if (contactId && row.contact_id !== contactId) patch.contact_id = contactId
    // Odometer only ever goes up — a lower reading is a typo, not a rollback.
    if (odo != null && (row.current_odometer == null || odo > row.current_odometer)) patch.current_odometer = odo
    for (const [k, v] of [['year', year], ['make', make], ['model', model], ['trim', trim], ['plate', plate], ['color', color]]) {
      if (v != null && v !== '' && !row[k]) patch[k] = v      // fill blanks, never overwrite known truth
    }
    if (!Object.keys(patch).length) return row
    patch.updated_at = new Date().toISOString()
    const { data } = await supabaseAdmin.from('customer_vehicles').update(patch).eq('id', row.id).eq('dealership_id', dealershipId).select('*').maybeSingle()
    return data || row
  }

  if (VIN) {
    const { data: existing } = await supabaseAdmin.from('customer_vehicles').select('*')
      .eq('dealership_id', dealershipId).ilike('vin', VIN).maybeSingle()
    if (existing) return patchExisting(existing)
  }

  // First time we have seen this car. If it came off our own lot, keep the thread.
  let origin = originInventoryId || null
  if (!origin && VIN) {
    const { data: stock } = await supabaseAdmin.from('inventory').select('id, year, make, model, trim')
      .eq('dealership_id', dealershipId).ilike('vin', VIN).limit(1).maybeSingle()
    if (stock) {
      origin = stock.id
      year = year ?? stock.year; make = make || stock.make; model = model || stock.model; trim = trim || stock.trim
    }
  }

  const { data: created, error } = await supabaseAdmin.from('customer_vehicles').insert({
    dealership_id: dealershipId, contact_id: contactId, vin: VIN, year, make, model, trim,
    plate, color, current_odometer: odo, origin_inventory_id: origin,
  }).select('*').single()
  if (!error) return created

  // Lost a race on the (dealership_id, upper(vin)) unique index — the other writer's
  // row is the canonical one. Re-read it rather than retrying the insert.
  if (VIN) {
    const { data: raced } = await supabaseAdmin.from('customer_vehicles').select('*')
      .eq('dealership_id', dealershipId).ilike('vin', VIN).maybeSingle()
    if (raced) return patchExisting(raced)
  }
  throw new Error(error.message)
}

export const customerVehicleLabel = (v) =>
  [v?.year, v?.make, v?.model, v?.trim].filter(Boolean).join(' ') || v?.plate || v?.vin || 'Vehicle'

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

// `status` starts at a state the database's vocabulary actually contains. The engine
// used to insert 'open', which `repair_orders_status_valid` rejects — so opening a
// repair order failed outright. A unit opened at the drive is `checked_in`; one staged
// from a future booking is `appointment`.
export async function openRepairOrder(dealershipId, { contactId = null, inventoryId = null, customerVehicleId = null, vehicleDesc = null, vin = null, odometer = null, advisorId = null, complaint = null, appointmentTaskId = null, createdBy = null, status = 'checked_in' } = {}) {
  const openStatus = RO_STATUSES.includes(status) ? status : 'checked_in'
  const cfg = await svcConfig(dealershipId)
  const ro_number = await nextRoNumber(dealershipId, cfg.ro_prefix)
  const { data: ro, error } = await supabaseAdmin.from('repair_orders').insert({
    dealership_id: dealershipId, ro_number, contact_id: contactId, inventory_id: inventoryId,
    customer_vehicle_id: customerVehicleId,
    vehicle_desc: vehicleDesc, vin, odometer: odometer != null ? Math.trunc(n(odometer)) : null,
    advisor_id: advisorId, complaint, appointment_task_id: appointmentTaskId, status: openStatus, created_by: createdBy,
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
  if (ro.status === 'closed') throw new Error('RO is closed — reopen it through the controlled reopen flow')
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

// Statuses that mean "the shop is still working on it". Returning to one of these from
// `ready` means the unit was NOT actually finished, so the ready clock is cleared —
// the next genuine Ready stamps a new, honest time.
// ── The repair-order state machine lives in the DATABASE ─────────────────────
// `repair_orders_status_valid` fixes the vocabulary and the trigger
// `repair_orders_state_machine` (controls.enforce_state_transition, driven by
// `controls.state_transitions`) fixes the legal edges, the permission each edge needs
// and whether it needs a reason. This list mirrors the constraint so the API rejects a
// bad status with a clear message instead of a raw 23514 — it does NOT re-implement the
// graph. The database stays authoritative; an illegal transition is refused there.
const RO_STATUSES = [
  'appointment', 'checked_in', 'inspection', 'estimate_sent', 'customer_approved',
  'customer_declined', 'parts_ordered', 'in_progress', 'quality_check', 'ready',
  'delivered', 'closed',
]

// What can this repair order legally do next? Read straight from the table the trigger
// itself consults, so the answer can never drift from what the database will accept.
// The UI asks this instead of carrying its own copy of the graph.
export async function allowedRoTransitions(dealershipId, roId) {
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('id, status').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) return null
  const { data } = await supabaseAdmin.schema('controls').from('state_transitions')
    .select('to_state, required_permission, requires_reason')
    .eq('entity_type', 'repair_order').eq('from_state', ro.status)
  return { status: ro.status, transitions: data || [] }
}

// The database refuses an illegal edge with 23514 and a message an advisor cannot use.
function transitionError(error, from, to) {
  const msg = String(error?.message || '')
  if (/Illegal .* state transition/i.test(msg)) return `A repair order cannot go from ${from} to ${to}.`
  if (/reason is required/i.test(msg)) return `Moving from ${from} to ${to} requires a reason.`
  if (/Permission .* required/i.test(msg)) return `You do not have permission to move a repair order from ${from} to ${to}.`
  return msg || `Could not move the repair order from ${from} to ${to}.`
}

// The ONE application entry point for moving a repair order. Everything -- routes,
// tools, check-in, close, reopen -- goes through here rather than scattering
// `update repair_orders set status` around the codebase. It is deliberately NOT a
// second state machine: it does not decide which edges are legal. It scopes to the
// dealership, carries the reason, lets the database trigger accept or refuse the edge,
// and turns the raw 23514 into something a user can act on.
export async function transitionRepairOrder(dealershipId, roId, toStatus, { userId = null, reason = null } = {}) {
  if (!RO_STATUSES.includes(toStatus)) throw new Error(`invalid repair order status: ${toStatus}`)
  if (toStatus === 'closed') return closeRepairOrder(dealershipId, roId, { userId, reason })
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('status, ro_number, ready_at').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status === toStatus) return ro
  const now = new Date().toISOString()
  const patch = { status: toStatus, updated_at: now, state_changed_at: now, state_changed_by: userId, state_change_reason: reason }
  // Ready is operational completion, and NOT payment, pickup or close. Stamped once on
  // the genuine transition in — re-entering ready never rewrites the original time.
  if (toStatus === 'ready' && !ro.ready_at) patch.ready_at = now
  const { error } = await supabaseAdmin.from('repair_orders').update(patch).eq('id', roId).eq('dealership_id', dealershipId)
  if (error) throw new Error(transitionError(error, ro.status, toStatus))
  emitEvent({
    dealershipId, eventName: 'service.ro_status_changed', entityType: 'repair_order', entityId: roId,
    summary: `RO ${ro.ro_number} → ${toStatus}`, fromState: ro.status, toState: toStatus, department: 'Service', createdBy: userId,
    payload: { ro_number: ro.ro_number, ready_at: patch.ready_at ?? ro.ready_at ?? null },
  })
  return { ...ro, status: toStatus, ready_at: patch.ready_at ?? ro.ready_at ?? null }
}

// Historical name, kept so existing callers keep working. New code calls
// transitionRepairOrder.
export const setRoStatus = transitionRepairOrder

// ── Appointment → check-in → ONE repair order ────────────────────────────────
// The canonical arrival transition. Idempotent by construction: the RO carries
// `appointment_task_id` under a unique index, so a double-click, a retry, or two
// advisors checking the same customer in simultaneously all resolve to the SAME RO.
// Nothing about this relies on the interface remembering anything.
export async function checkInAppointment(dealershipId, taskId, {
  vin = null, odometer = null, customerVehicleId = null, complaint = null,
  year = null, make = null, model = null, trim = null, plate = null,
  advisorId = null, userId = null,
} = {}) {
  const { data: task } = await supabaseAdmin.from('crm_tasks')
    .select('id, contact_id, title, service_type, due_at, status, assigned_to')
    .eq('id', taskId).eq('dealership_id', dealershipId).eq('category', 'service').maybeSingle()
  if (!task) throw new Error('service appointment not found')

  // Already checked in? Return that RO — never a second one.
  const { data: existing } = await supabaseAdmin.from('repair_orders').select('*')
    .eq('dealership_id', dealershipId).eq('appointment_task_id', taskId).maybeSingle()
  if (existing) return { ro: existing, created: false }

  // Resolve the canonical vehicle. An explicit id wins; otherwise the VIN resolves to
  // the car we already know, or creates it once.
  let vehicle = null
  if (customerVehicleId) vehicle = await getCustomerVehicle(dealershipId, customerVehicleId)
  if (!vehicle && (cleanVin(vin) || year || make || model)) {
    vehicle = await findOrCreateCustomerVehicle(dealershipId, {
      vin, contactId: task.contact_id, year, make, model, trim, plate, odometer,
    })
  }

  // The customer's own words carry forward — the appointment reason is the concern.
  const concern = String(complaint || task.service_type || task.title || '').slice(0, 2000) || null

  let ro
  try {
    ro = await openRepairOrder(dealershipId, {
      contactId: task.contact_id, customerVehicleId: vehicle?.id || null,
      vehicleDesc: vehicle ? customerVehicleLabel(vehicle) : null,
      vin: vehicle?.vin || cleanVin(vin), odometer,
      advisorId: advisorId || task.assigned_to || userId || null,
      complaint: concern, appointmentTaskId: taskId, createdBy: userId,
    })
  } catch (e) {
    // Lost the race on repair_orders_appointment_uk — the other caller's RO is the one.
    const { data: raced } = await supabaseAdmin.from('repair_orders').select('*')
      .eq('dealership_id', dealershipId).eq('appointment_task_id', taskId).maybeSingle()
    if (raced) return { ro: raced, created: false }
    throw e
  }

  await supabaseAdmin.from('crm_tasks').update({
    status: 'converted', arrived_at: new Date().toISOString(), done: true, done_at: new Date().toISOString(),
  }).eq('id', taskId).eq('dealership_id', dealershipId)

  emitEvent({
    dealershipId, eventName: 'service.checked_in', entityType: 'repair_order', entityId: ro.id,
    summary: `Checked in — RO ${ro.ro_number}`, toState: 'open', department: 'Service', createdBy: userId,
    payload: { ro_number: ro.ro_number, appointment_task_id: taskId, contact_id: task.contact_id, customer_vehicle_id: vehicle?.id || null },
  })
  return { ro, created: true, vehicle }
}

// ── Controlled reopen ────────────────────────────────────────────────────────
// A closed RO is a financial record. It is not casually editable (addRoLine refuses),
// and until now there was no sanctioned way back either — the table and permission
// existed with no code. Request and approval are separate acts, both audited.
export async function requestRoReopen(dealershipId, roId, { reason, userId = null } = {}) {
  if (!String(reason || '').trim()) throw new Error('a reason is required to reopen a closed repair order')
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('id, status, ro_number').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status !== 'closed') throw new Error('only a closed repair order needs reopening')
  const { data, error } = await supabaseAdmin.from('repair_order_reopen_requests').insert({
    dealership_id: dealershipId, repair_order_id: roId, reason: String(reason).slice(0, 1000),
    status: 'requested', requested_by: userId,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function approveRoReopen(dealershipId, requestId, { userId = null } = {}) {
  const { data: reqRow } = await supabaseAdmin.from('repair_order_reopen_requests').select('*')
    .eq('id', requestId).eq('dealership_id', dealershipId).maybeSingle()
  if (!reqRow) throw new Error('reopen request not found')
  if (reqRow.status !== 'requested') return reqRow            // idempotent — already decided
  const now = new Date().toISOString()
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('id, status, ro_number').eq('id', reqRow.repair_order_id).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  await supabaseAdmin.from('repair_orders').update({
    status: 'in_progress', closed_at: null, updated_at: now,
    state_changed_at: now, state_changed_by: userId, state_change_reason: `reopened: ${reqRow.reason}`,
  }).eq('id', ro.id).eq('dealership_id', dealershipId)
  const { data: updated } = await supabaseAdmin.from('repair_order_reopen_requests').update({
    status: 'approved', reviewed_by: userId, reviewed_at: now, executed_at: now,
  }).eq('id', requestId).eq('dealership_id', dealershipId).select('*').maybeSingle()
  emitEvent({
    dealershipId, eventName: 'service.ro_reopened', entityType: 'repair_order', entityId: ro.id,
    summary: `RO ${ro.ro_number} reopened`, fromState: 'closed', toState: 'in_progress', department: 'Service', createdBy: userId,
    payload: { ro_number: ro.ro_number, request_id: requestId, reason: reqRow.reason },
  })
  return updated || reqRow
}

export async function declineRoReopen(dealershipId, requestId, { userId = null } = {}) {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin.from('repair_order_reopen_requests').update({
    status: 'declined', reviewed_by: userId, reviewed_at: now,
  }).eq('id', requestId).eq('dealership_id', dealershipId).eq('status', 'requested').select('*').maybeSingle()
  return data || null
}

export async function listRoReopenRequests(dealershipId, { status = null, roId = null } = {}) {
  let q = supabaseAdmin.from('repair_order_reopen_requests').select('*').eq('dealership_id', dealershipId).order('requested_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  if (roId) q = q.eq('repair_order_id', roId)
  const { data } = await q
  return data || []
}

// Close: idempotent. Recompute, draw part stock from inventory, emit service.closed
// (Accounting posts the journal). Guard on already-closed so a bus replay is safe.
// Close is the FINANCIAL transition, and it is not a shortcut. controls.state_transitions
// allows `closed` from exactly two places: `delivered` (the customer took the car) and
// `customer_declined` (they took it without the work). Closing from anywhere else used
// to be attempted silently and would be refused by the database; it is now refused here,
// with a message that says what has to happen first.
const RO_CLOSABLE_FROM = ['delivered', 'customer_declined']

export async function closeRepairOrder(dealershipId, roId, { userId = null, reason = null } = {}) {
  const { data: ro } = await supabaseAdmin.from('repair_orders').select('*').eq('id', roId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ro) throw new Error('repair order not found')
  if (ro.status === 'closed') return ro   // already closed — no double stock draw / double journal
  if (!RO_CLOSABLE_FROM.includes(ro.status)) {
    throw new Error(`A repair order cannot be closed from ${ro.status}. Finish the work, mark it Ready, then Delivered — the customer takes the vehicle before the money is booked.`)
  }
  const totals = await recomputeRoTotals(dealershipId, roId)

  // Consume parts from stock (immutable ledger + decrement on-hand), once.
  const { data: partLines } = await supabaseAdmin.from('ro_lines').select('*').eq('ro_id', roId).eq('line_type', 'part').is('deleted_at', null)
  for (const l of partLines || []) {
    if (!l.part_id) continue
    await consumePart(dealershipId, l.part_id, n(l.qty), { roId, unitCost: n(l.unit_cost), userId })
  }

  const now = new Date().toISOString()
  const { error: closeErr } = await supabaseAdmin.from('repair_orders').update({
    status: 'closed', closed_at: now, updated_at: now,
    state_changed_at: now, state_changed_by: userId, state_change_reason: reason,
  }).eq('id', roId).eq('dealership_id', dealershipId)
  if (closeErr) throw new Error(transitionError(closeErr, ro.status, 'closed'))
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
export function registerServiceEngine(app) {
  registerServiceTools()

  const guard = (req, res) => {
    if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false }
    return true
  }

  // ── Permission split (Phase 4) ─────────────────────────────────────────────
  // Reading the shop, working the shop, and resolving the customer's money are three
  // different acts. Before this, every route — reads included — demanded the write
  // permission, so a general manager could not read an RO while a technician could
  // close one and post its journal.
  const canRead = requirePermission('service.view')                    // see the shop
  const canWork = requirePermission('service.write_repair_order')      // work the job
  const canClose = requirePermission('service.close_repair_order')     // FINANCIAL act
  const canReopen = requirePermission('service.reopen_repair_order')   // undo a financial record

  app.get('/service-engine/ros', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    const rows = await listRepairOrders(req.dealershipId, { status: req.query.status || null, contactId: req.query.contact_id || null })
    res.json({ ros: rows })
  })
  app.get('/service-engine/ros/:id', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    const ro = await getRepairOrder(req.dealershipId, req.params.id)
    if (!ro) return res.status(404).json({ error: 'not found' })
    let customer = null
    if (ro.contact_id) { const c = await getContact(req.dealershipId, ro.contact_id).catch(() => null); customer = c ? { id: c.id, name: c.full_name, phone: c.phone || c.phone_mobile, email: c.email } : null }
    res.json({ ro, customer })
  })
  app.post('/service-engine/ros', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const b = req.body || {}
      const ro = await openRepairOrder(req.dealershipId, { contactId: b.contact_id || null, inventoryId: b.inventory_id || null, vehicleDesc: b.vehicle_desc || null, vin: b.vin || null, odometer: b.odometer ?? null, advisorId: b.advisor_id || req.user?.id || null, complaint: b.complaint || null, appointmentTaskId: b.appointment_task_id || null, createdBy: req.user?.id || null })
      res.json({ ok: true, ro })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/lines', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, line: await addRoLine(req.dealershipId, req.params.id, req.body || {}) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.delete('/service-engine/ros/:id/lines/:lineId', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const result = await removeRoLine(req.dealershipId, req.params.id, req.params.lineId, { userId: req.user?.id || null })
      audit(req, 'service.ro_line_archived', { before_state: result.before, after_state: result.archived })
      res.json({ ok: true, archived: true })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/status', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, ro: await transitionRepairOrder(req.dealershipId, req.params.id, String(req.body?.status || ''), { userId: req.user?.id || null, reason: req.body?.reason || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/ros/:id/close', requireAuth, canClose, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, ro: await closeRepairOrder(req.dealershipId, req.params.id, { userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })

  // What this RO can legally do next, straight from controls.state_transitions. The
  // UI renders business actions from this rather than offering a free status dropdown
  // that can propose moves the dealership workflow forbids.
  app.get('/service-engine/ros/:id/transitions', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    const result = await allowedRoTransitions(req.dealershipId, req.params.id)
    if (!result) return res.status(404).json({ error: 'not found' })
    res.json(result)
  })

  // ── Controlled reopen ──────────────────────────────────────────────────────
  // Requesting and approving are separate acts: anyone who works the shop may ask,
  // only a holder of service.reopen_repair_order may actually undo a financial record.
  app.get('/service-engine/reopen-requests', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    res.json({ requests: await listRoReopenRequests(req.dealershipId, { status: req.query.status || null, roId: req.query.ro_id || null }) })
  })
  app.post('/service-engine/ros/:id/reopen-request', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const request = await requestRoReopen(req.dealershipId, req.params.id, { reason: req.body?.reason, userId: req.user?.id || null })
      audit(req, 'service.ro_reopen_requested', { after_state: request })
      res.json({ ok: true, request })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/reopen-requests/:id/approve', requireAuth, requireMfa, canReopen, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const request = await approveRoReopen(req.dealershipId, req.params.id, { userId: req.user?.id || null })
      audit(req, 'service.ro_reopen_approved', { after_state: request })
      res.json({ ok: true, request })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/reopen-requests/:id/decline', requireAuth, canReopen, async (req, res) => {
    if (!guard(req, res)) return
    const request = await declineRoReopen(req.dealershipId, req.params.id, { userId: req.user?.id || null })
    if (!request) return res.status(404).json({ error: 'no pending reopen request' })
    audit(req, 'service.ro_reopen_declined', { after_state: request })
    res.json({ ok: true, request })
  })

  // ── Customer-owned vehicles ────────────────────────────────────────────────
  app.get('/service-engine/customer-vehicles', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    res.json({ vehicles: await listCustomerVehicles(req.dealershipId, { contactId: req.query.contact_id || null, vin: req.query.vin || null }) })
  })
  app.post('/service-engine/customer-vehicles', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const b = req.body || {}
      const vehicle = await findOrCreateCustomerVehicle(req.dealershipId, {
        vin: b.vin, contactId: b.contact_id || null, year: b.year ?? null, make: b.make || null,
        model: b.model || null, trim: b.trim || null, plate: b.plate || null, color: b.color || null,
        odometer: b.odometer ?? null,
      })
      res.json({ ok: true, vehicle })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  app.get('/service-engine/parts', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    res.json({ parts: await searchParts(req.dealershipId, req.query.q || null, 200) })
  })
  app.post('/service-engine/parts', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const b = req.body || {}
      res.json({ ok: true, part: await upsertPart(req.dealershipId, { partNumber: b.part_number, description: b.description, bin: b.bin, cost: b.cost, price: b.price, reorderPoint: b.reorder_point }) })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/parts/:id/receive', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, on_hand: await receiveParts(req.dealershipId, req.params.id, req.body?.qty, { unitCost: req.body?.unit_cost, reference: req.body?.reference, userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/service-engine/parts/:id/adjust', requireAuth, canWork, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ ok: true, on_hand: await adjustPart(req.dealershipId, req.params.id, req.body?.qty, { note: req.body?.note, userId: req.user?.id || null }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })

  app.get('/service-engine/summary', requireAuth, canRead, async (req, res) => {
    if (!guard(req, res)) return
    res.json(await roSummary(req.dealershipId, { from: req.query.from || null, to: req.query.to || null }))
  })

  app.get('/service-engine/config', requireAuth, canRead, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ config: await svcConfig(req.dealershipId) })
  })
  app.put('/service-engine/config', requireAuth, canWork, async (req, res) => {
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
