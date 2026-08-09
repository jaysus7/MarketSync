import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 4 (PR 4.1) — Fixed Ops foundation.
//   * the appointment query bug (Stage 4A finding B1)
//   * the Service permission split: read / work / close / reopen
//   * canonical customer-owned vehicles, and the rejection of the inventory shortcut
//   * an idempotent appointment → check-in → ONE repair order transition
//   * Ready as a real timestamped state that is not Close
//
// Assertions run against COMMENT-STRIPPED source: these files legitimately describe
// the boundaries they must not cross, and prose is not proof of behaviour.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const svcRaw = read('routes/service.js')
const engRaw = read('routes/service-engine.js')
const svc = strip(svcRaw)
const eng = strip(engRaw)
const migration = read('migrations/2026-08-09-stage4b1-service-foundation.sql')

// ── 1. The appointment bug ───────────────────────────────────────────────────

test('the service appointment query no longer selects a phantom column silently', () => {
  const q = svc.match(/from\('crm_tasks'\)\s*\n?\s*\.select\([^)]*\)[\s\S]{0,400}?limit\(2000\)/)?.[0] || ''
  assert.ok(q, 'the appointment list query must still exist')
  // The column the code always wanted now exists in the schema, and is selected.
  assert.match(migration, /alter table public\.crm_tasks add column if not exists status text/,
    'the fix is the column the code expects, not a second appointment system')
  assert.match(q, /status/, 'status is selected')
  // The real defect was swallowing the error, which made a broken query look like an
  // empty appointment book. A failure must now surface.
  assert.match(svc, /const \{ data: rows, error \} = await q/, 'the query error must be captured')
  assert.match(svc, /if \(error\) return res\.status\(500\)/, 'a query failure must be reported, not rendered as "no appointments"')
})

test('Service appointments remain crm_tasks — no parallel appointment table', () => {
  assert.doesNotMatch(migration, /create table[\s\S]{0,40}service_appointments/i,
    'the bug must not be fixed by inventing a second appointment model')
  assert.match(svc, /\.eq\('category', 'service'\)/, 'service appointments stay category=service crm_tasks')
})

test('appointment status is derived for rows that predate the column', () => {
  assert.match(svc, /APPT_STATES\.includes\(t\.status\) \? t\.status : \(t\.done \? 'converted' : 'scheduled'\)/,
    'an older appointment with no status must be derived, never guessed as blank')
})

// ── 2. RBAC ──────────────────────────────────────────────────────────────────

test('Service permissions are split into read / work / close / reopen', () => {
  for (const [name, perm] of [['canRead', 'service.view'], ['canWork', 'service.write_repair_order'],
                              ['canClose', 'service.close_repair_order'], ['canReopen', 'service.reopen_repair_order']]) {
    assert.ok(eng.includes(`const ${name} = requirePermission('${perm}')`), `${name} must map to ${perm}`)
  }
  assert.match(migration, /insert into public\.permissions[\s\S]{0,200}service\.close_repair_order/,
    'the close permission must actually exist')
})

test('closing a repair order is a distinct privileged act, not ordinary shop work', () => {
  assert.match(eng, /app\.post\('\/service-engine\/ros\/:id\/close', requireAuth, canClose/,
    'close must require the close permission')
  // The technician grant is the point: a technician may work, and may not close.
  const grants = migration.match(/insert into public\.role_permissions[\s\S]*?service\.close_repair_order[\s\S]*?;/)?.[0] || ''
  assert.ok(grants, 'the close permission must be granted to somebody')
  assert.ok(!/technician/.test(grants), 'a technician must NOT be able to close a repair order')
  for (const role of ['dealer_owner', 'service_manager', 'general_manager']) {
    assert.ok(grants.includes(role), `${role} must be able to close a repair order`)
  }
})

test('reading the shop no longer requires permission to change it', () => {
  for (const route of ["app.get('/service-engine/ros', requireAuth, canRead",
                       "app.get('/service-engine/ros/:id', requireAuth, canRead",
                       "app.get('/service-engine/summary', requireAuth, canRead",
                       "app.get('/service-engine/parts', requireAuth, canRead"]) {
    assert.ok(eng.includes(route), `read route must use canRead: ${route}`)
  }
  // A general manager held service.view and could not act on the shop they run.
  assert.match(migration, /values \('general_manager', 'service\.write_repair_order'\)/)
})

test('reopen is wired, controlled and audited — not a silent edit', () => {
  assert.match(eng, /app\.post\('\/service-engine\/ros\/:id\/reopen-request', requireAuth, canWork/)
  assert.match(eng, /app\.post\('\/service-engine\/reopen-requests\/:id\/approve', requireAuth, requireMfa, canReopen/,
    'approving a reopen undoes a financial record and must be MFA-gated')
  assert.match(eng, /from\('repair_order_reopen_requests'\)/, 'the existing reopen table must be used, not a new one')
  assert.match(eng, /requested_by: userId/)
  assert.match(eng, /reviewed_by: userId, reviewed_at: now, executed_at: now/, 'requester and approver are recorded separately')
  assert.match(eng, /if \(reqRow\.status !== 'requested'\) return reqRow/, 'approval must be idempotent')
  assert.match(eng, /eventName: 'service\.ro_reopened'/, 'a reopen must reach the timeline')
})

// ── 3. Customer-owned vehicles ───────────────────────────────────────────────

test('customer vehicles are canonical and are NOT dealer inventory', () => {
  assert.match(migration, /create table if not exists public\.customer_vehicles/)
  assert.match(migration, /alter table public\.customer_vehicles enable row level security/)
  // The rejected shortcut: Service must never write a customer car into dealer stock.
  assert.doesNotMatch(eng, /from\('inventory'\)\s*\.insert|insert\(\{[^}]*dealership_id[^}]*\}\)[\s\S]{0,40}from\('inventory'\)/,
    'Service must never insert into dealer inventory')
})

test('the same VIN resolves to the same vehicle instead of a new one each visit', () => {
  assert.match(migration, /create unique index if not exists customer_vehicles_dealer_vin_uk[\s\S]*?\(dealership_id, upper\(vin\)\)/,
    'one vehicle per VIN per dealership, enforced by the database')
  assert.match(migration, /where vin is not null and length\(btrim\(vin\)\) > 0/,
    'the constraint must be partial — a VIN is not always known')
  const fn = eng.match(/export async function findOrCreateCustomerVehicle[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'a resolver must exist')
  assert.match(fn, /if \(VIN\) \{[\s\S]{0,300}?if \(existing\) return patchExisting\(existing\)/,
    'a known VIN must return the existing record')
  assert.match(fn, /const \{ data: raced \}[\s\S]{0,200}?ilike\('vin', VIN\)/,
    'losing the unique-index race must re-read the winner, not retry the insert')
})

test('a vehicle sold here keeps its thread back to the inventory unit', () => {
  const fn = eng.match(/export async function findOrCreateCustomerVehicle[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('inventory'\)\.select\('id, year, make, model, trim'\)/,
    'a returning VIN we once stocked must be recognised')
  assert.match(fn, /origin_inventory_id: origin/, 'the link back to the former stock unit must be stored')
  // Continuity must not rewrite the sale: the inventory row is read, never updated.
  assert.doesNotMatch(fn, /from\('inventory'\)\.update/, 'the inventory record must not be made to look unsold')
})

test('vehicle facts are filled in, never overwritten, and mileage only goes up', () => {
  const fn = eng.match(/const patchExisting = async \(row\) => \{[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(fn, /if \(odo != null && \(row\.current_odometer == null \|\| odo > row\.current_odometer\)\)/,
    'a lower odometer reading is a typo, not a rollback')
  assert.match(fn, /if \(v != null && v !== '' && !row\[k\]\) patch\[k\] = v/,
    'known vehicle facts must not be overwritten by a thinner later record')
})

// ── 4. Check-in ──────────────────────────────────────────────────────────────

test('check-in creates exactly one repair order, enforced by the database', () => {
  assert.match(migration, /create unique index if not exists repair_orders_appointment_uk[\s\S]*?\(appointment_task_id\)/,
    'one appointment → one RO must be a database constraint')
  const fn = eng.match(/export async function checkInAppointment[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the check-in transition must exist')
  assert.match(fn, /if \(existing\) return \{ ro: existing, created: false \}/,
    'a repeated check-in must return the same RO')
  assert.match(fn, /catch \(e\) \{[\s\S]{0,300}?if \(raced\) return \{ ro: raced, created: false \}/,
    'a concurrent check-in must resolve to the winner’s RO, never a second one')
  assert.match(svc, /app\.post\('\/service\/appointments\/:id\/check-in', requireAuth, requirePermission\('service\.write_repair_order'\)/)
})

test('check-in carries the customer, the vehicle and the concern forward', () => {
  const fn = eng.match(/export async function checkInAppointment[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /contactId: task\.contact_id/, 'the same canonical customer continues')
  assert.match(fn, /customerVehicleId: vehicle\?\.id \|\| null/, 'the canonical vehicle is attached to the RO')
  assert.match(fn, /String\(complaint \|\| task\.service_type \|\| task\.title \|\| ''\)/,
    'the customer’s stated reason becomes the RO concern')
  assert.match(fn, /status: 'converted', arrived_at:/, 'the appointment records that it converted')
  assert.match(fn, /eventName: 'service\.checked_in'/, 'arrival must reach the shared timeline')
  assert.doesNotMatch(fn, /findOrCreateContact/, 'check-in must not create a second customer record')
})

test('Service works without Sales — an RO needs no deal', () => {
  assert.match(svc, /findOrCreateContact\(\{ dealershipId: req\.dealershipId/,
    'a service-only walk-in becomes a normal contact')
  for (const salesOnly of ['deals', 'deal_id']) {
    assert.ok(!new RegExp(`from\\('${salesOnly}'\\)`).test(eng), `Service must not require ${salesOnly}`)
  }
})

// ── 5. Ready ≠ Closed ────────────────────────────────────────────────────────

test('Ready is a real timestamped state and is not Close', () => {
  assert.match(migration, /alter table public\.repair_orders add column if not exists ready_at timestamptz/)
  const fn = eng.match(/export async function setRoStatus[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /if \(toStatus === 'ready' && !ro\.ready_at\) patch\.ready_at = now/,
    'ready is stamped once, on the genuine transition in')
  assert.match(fn, /if \(toStatus === 'closed'\) return closeRepairOrder/,
    'close remains its own transition, reached through its own permission')
})

// ── 5b. The database owns the state machine ──────────────────────────────────

test('the engine speaks the database vocabulary and does not re-implement its graph', () => {
  // repair_orders_status_valid fixes the vocabulary; the repair_orders_state_machine
  // trigger fixes the legal edges. The engine used to write `open`, `awaiting_parts`
  // and `canceled` — none of which the constraint accepts — so opening a repair order
  // failed outright and staging held zero of them.
  const list = eng.match(/const RO_STATUSES = \[[\s\S]*?\]/)?.[0] || ''
  assert.ok(list, 'the engine must declare the status vocabulary it shares with the database')
  for (const s of ['appointment', 'checked_in', 'inspection', 'estimate_sent', 'customer_approved',
                   'customer_declined', 'parts_ordered', 'in_progress', 'quality_check', 'ready',
                   'delivered', 'closed']) {
    assert.ok(list.includes(`'${s}'`), `the vocabulary must include the database state ${s}`)
  }
  for (const gone of ['open', 'awaiting_parts', 'canceled']) {
    assert.ok(!new RegExp(`'${gone}'`).test(list), `${gone} is not a state this database accepts`)
  }
  assert.match(eng, /const openStatus = RO_STATUSES\.includes\(status\) \? status : 'checked_in'/,
    'a new repair order must start in a state the database recognises')
  assert.doesNotMatch(eng, /status: 'open'/, "the engine must never insert the rejected 'open' state")
})

test('reopen follows the only edge the graph allows out of closed', () => {
  const fn = eng.match(/export async function approveRoReopen[\s\S]*?\n\}/)?.[0] || ''
  // controls.state_transitions has exactly one edge from `closed`: closed -> in_progress,
  // requiring service.reopen_repair_order AND a reason.
  assert.match(fn, /status: 'in_progress', closed_at: null/, 'reopen must land on in_progress')
  assert.match(fn, /state_change_reason: `reopened: \$\{reqRow\.reason\}`/,
    'that edge requires a reason — the database refuses it otherwise')
})

test('every status change now says who moved it and why', () => {
  const fn = eng.match(/export async function setRoStatus[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /state_changed_at: now, state_changed_by: userId, state_change_reason: reason/,
    'the audit columns that existed but were never written must now be written')
})

// ── 6. Nothing canonical was duplicated ──────────────────────────────────────

test('PR 4.1 adds no second canonical record', () => {
  for (const forbidden of ['service_customers', 'service_vehicles', 'ro_jobs', 'service_appointments', 'service_timeline']) {
    assert.ok(!migration.includes(forbidden), `must not create ${forbidden}`)
    assert.ok(!eng.includes(forbidden), `must not reference ${forbidden}`)
  }
  // Accounting stays where it belongs: PR 4.1 changes no financial behaviour.
  assert.doesNotMatch(eng, /journal_entries|postByRule|accounts_receivable/,
    'PR 4.1 must not touch accounting — that is a later, separately approved change')
})
