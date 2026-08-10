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
  const fn = eng.match(/export async function transitionRepairOrder[\s\S]*?\n\}/)?.[0] || ''
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
  const fn = eng.match(/export async function transitionRepairOrder[\s\S]*?\n\}/)?.[0] || ''
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

// ── 7. State reconciliation (PR 4.2a) ────────────────────────────────────────

const fe = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part12.js', import.meta.url), 'utf8')
const stage0 = readFileSync(new URL('../../docs/SERVICE_PARTS_ENGINE_STAGE0.md', import.meta.url), 'utf8')

test('one central application entry point moves a repair order', () => {
  assert.match(eng, /export async function transitionRepairOrder\(dealershipId, roId, toStatus/,
    'transitions must go through one helper, not scattered status writes')
  assert.match(eng, /export const setRoStatus = transitionRepairOrder/, 'the old name must keep working')
  // It must NOT become a second state machine — the graph stays in the database.
  const fn = eng.match(/export async function transitionRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.doesNotMatch(fn, /LEGAL_TRANSITIONS|TRANSITION_MAP|from === '.*' && to === '/,
    'the engine must not carry a JavaScript copy of the transition graph')
  assert.match(fn, /if \(error\) throw new Error\(transitionError\(error, ro\.status, toStatus\)\)/,
    'a refused edge must surface as a usable message, not a raw 23514')
})

test('legal next moves are read from the database, not hardcoded', () => {
  assert.match(eng, /schema\('controls'\)\.from\('state_transitions'\)/,
    'allowed transitions must come from the same table the trigger consults')
  assert.match(eng, /app\.get\('\/service-engine\/ros\/:id\/transitions', requireAuth, canRead/)
  assert.match(fe, /apiGetJson\(`\/service-engine\/ros\/\$\{id\}\/transitions`\)/,
    'the UI must ask the backend which moves are legal')
})

test('close follows the canonical path and cannot be reached from anywhere', () => {
  assert.match(eng, /const RO_CLOSABLE_FROM = \['delivered', 'customer_declined'\]/,
    'closed is legal only from delivered or customer_declined')
  const fn = eng.match(/export async function closeRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /if \(!RO_CLOSABLE_FROM\.includes\(ro\.status\)\)/,
    'closing from an active state must be refused before any stock or journal work')
  assert.match(fn, /if \(ro\.status === 'closed'\) return ro/, 'close must stay idempotent')
})

test('the frontend speaks canonical states and offers business actions', () => {
  const list = fe.match(/const SVC_STATUSES = \[[\s\S]*?\];/)?.[0] || ''
  for (const s of ['appointment', 'checked_in', 'estimate_sent', 'customer_approved', 'parts_ordered', 'quality_check', 'delivered']) {
    assert.ok(list.includes(`'${s}'`), `the UI must know the canonical state ${s}`)
  }
  for (const gone of ["'open'", "'awaiting_parts'", "'canceled'"]) {
    assert.ok(!list.includes(gone), `${gone} is not a repair-order state`)
  }
  // Friendly wording is fine; the persisted value must stay canonical.
  assert.match(fe, /parts_ordered: 'Waiting for Parts'/, 'label may be friendly')
  assert.match(fe, /SVC_ACTION_LABEL/, 'actions must be phrased as what the advisor is doing')
  assert.doesNotMatch(fe, /id="svc-ro-status"/, 'the free status dropdown must be gone')
  assert.doesNotMatch(fe, /\bsvcSetStatus\b/, 'the removed status mutator must have no caller or export left behind')
})

test('the Stage 0 state machine is marked superseded rather than left as truth', () => {
  assert.match(stage0, /SUPERSEDED — this section was never true/)
  assert.match(stage0, /STAGE4_SERVICE_PARTS_AUDIT\.md` §32/)
})

// ── 8. Atomic stock (Batch 1, step 1) ────────────────────────────────────────

const stockMig = read('migrations/2026-08-09-stage4b-atomic-stock.sql')

test('stock moves atomically in the database, not read-modify-write in Node', () => {
  const fn = eng.match(/async function moveStock[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'moveStock must still exist')
  assert.match(fn, /supabaseAdmin\.rpc\('service_move_stock'/, 'the movement must happen in one database call')
  // The exact race that was there before: read the balance, add in JS, write it back.
  assert.doesNotMatch(fn, /qty_on_hand:\s*newQty|n\(part\.qty_on_hand\)\s*\+/,
    'the balance must never be computed in Node and written back')
  assert.match(stockMig, /for update/, 'the part row must be locked for the duration')
  assert.match(stockMig, /if v_new < 0 then[\s\S]{0,200}?Insufficient stock/,
    'the sufficiency check must happen inside the lock')
})

test('stock can never go negative, and a retry moves nothing twice', () => {
  assert.match(stockMig, /check \(qty_on_hand >= 0 and qty_reserved >= 0\)/,
    'negative stock must be impossible at the table level')
  assert.match(stockMig, /create unique index if not exists part_txns_idempotency_uk/,
    'the ledger must dedupe on an idempotency key')
  assert.match(stockMig, /where idempotency_key is not null/,
    'the key is optional — the index must be partial')
  const fn = eng.match(/async function moveStock[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /p_idempotency_key: idempotencyKey/, 'callers must be able to supply a key')
})

test('a duplicate movement emits no second event', () => {
  // An event is a claim that something happened. A no-op retry must not make one.
  for (const f of ['receiveParts', 'adjustPart', 'consumePart']) {
    const fn = eng.match(new RegExp(`export async function ${f}[\\s\\S]*?\\n\\}`))?.[0] || ''
    assert.match(fn, /if \(!r\.duplicate\)\s*\{?\s*(emitEvent|\n)/, `${f} must not emit on a deduped retry`)
  }
})

test('closing an RO cannot draw the same part twice', () => {
  assert.match(eng, /idempotencyKey: `ro-close:\$\{roId\}:\$\{l\.id\}`/,
    'each RO line consumes under a stable key, so a retried close is a no-op')
})

test('reserved quantity exists so availability can be derived, not guessed', () => {
  assert.match(stockMig, /add column if not exists qty_reserved numeric not null default 0/)
  // Availability is on_hand - reserved. It must never be a frontend calculation.
  assert.doesNotMatch(fe, /qty_on_hand\s*-\s*.*reserved/, 'availability must not be computed in the UI')
})

// ── 9. Versioned estimates (Batch 1, step 2) ─────────────────────────────────

const estMig = read('migrations/2026-08-09-stage4b-ro-estimates.sql')

test('a presented estimate is frozen by the database, not by convention', () => {
  assert.match(estMig, /create trigger ro_estimates_freeze before update/,
    'immutability must be a trigger, not an application habit')
  assert.match(estMig, /if old\.presented_at is not null then/, 'freezing starts at presentation')
  assert.match(estMig, /create trigger ro_estimates_nodelete before delete/,
    'presented evidence must survive deletion attempts')
  for (const col of ['lines_snapshot', 'total', 'tax', 'subtotal', 'discount']) {
    assert.ok(estMig.includes(`new.${col} is distinct from old.${col}`), `${col} must be frozen`)
  }
})

test('estimate versions are assigned by the database and are monotonic', () => {
  assert.match(estMig, /create trigger ro_estimates_version before insert/)
  assert.match(estMig, /select coalesce\(max\(version\), 0\) \+ 1 into new\.version/,
    'the next version comes from the database, so concurrent writers cannot collide')
  assert.match(estMig, /create unique index if not exists ro_estimates_ro_version_uk/)
  assert.match(eng, /version: 0,\s*\/\/ replaced by the DB trigger/,
    'callers must never choose a version number')
})

test('an estimate snapshots the live RO rather than pointing at it', () => {
  const fn = eng.match(/export async function createEstimate[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /lines_snapshot: lines \|\| \[\]/, 'the lines as shown must be captured')
  assert.match(fn, /subtotal, tax: totals\.tax, total: totals\.total/, 'the money as shown must be captured')
  // recomputeRoTotals keeps updating the LIVE RO; it must never reach into a snapshot.
  const rt = eng.match(/async function recomputeRoTotals[\s\S]*?\n\}/)?.[0] || ''
  assert.doesNotMatch(rt, /ro_estimates/, 'live totals must never touch a historical estimate')
})

test('presenting is idempotent and moves the RO honestly', () => {
  const fn = eng.match(/export async function presentEstimate[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /if \(est\.presented_at\) return est/, 're-presenting must be a no-op')
  assert.match(fn, /\.is\('presented_at', null\)/, 'the update must only win once')
  assert.match(fn, /eventName: 'service\.estimate_presented'/, 'presentation must reach the timeline')
})

test('estimate_sent cannot be claimed without a presented estimate', () => {
  const fn = eng.match(/export async function transitionRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /toStatus === 'estimate_sent' && !\(await latestPresentedEstimate\(dealershipId, roId\)\)/,
    'the state asserts the customer was shown something — refuse it when they were not')
})

// ── 10. Authorization evidence + derived coverage (Batch 1, step 3) ──────────

const authMig = read('migrations/2026-08-09-stage4b-ro-authorizations.sql')

test('authorization is permanent evidence — never edited, never deleted', () => {
  assert.match(authMig, /create trigger ro_auth_freeze before update or delete/,
    'both edit and delete must be refused at the database')
  assert.match(authMig, /immutable evidence/)
  // The failure mode this prevents: "invalidating" v1 by rewriting or removing it.
  assert.doesNotMatch(eng, /from\('ro_authorizations'\)\.(update|delete)/,
    'nothing may update or delete an authorization, including superseding code')
})

test('coverage is derived from the latest presented estimate, not stored', () => {
  const fn = eng.match(/export async function authorizationCoverage[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'coverage must be a derivation')
  assert.match(fn, /const estimate = await latestPresentedEstimate\(dealershipId, roId\)/,
    'coverage is answered against what the customer was actually shown')
  assert.match(fn, /\.eq\('estimate_id', estimate\.id\)/,
    'a decision only counts for the exact version it was made against')
  assert.match(fn, /covered: auth\.decision === 'approved'/)
  // Derivation must not write anything.
  assert.doesNotMatch(fn, /\.insert\(|\.update\(|\.delete\(/, 'answering the question must not change it')
  // And no stored flag may shadow it.
  assert.doesNotMatch(authMig, /is_authorized|authorization_status|covered boolean/,
    'coverage must never become a column someone can set by hand')
})

test('a newer estimate leaves the old approval as history that no longer covers', () => {
  const fn = eng.match(/export async function transitionRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /toStatus === 'customer_approved' \|\| toStatus === 'customer_declined'/)
  assert.match(fn, /if \(cover\.decision !== want\) throw new Error/,
    'after v2 is presented, v1 approval must not let the RO claim customer_approved')
})

test('evidence is bound to the right estimate, RO and dealership', () => {
  assert.match(authMig, /v_est\.ro_id is distinct from new\.ro_id or v_est\.dealership_id is distinct from new\.dealership_id/,
    'cross-RO and cross-tenant evidence must be refused')
  assert.match(authMig, /v_est\.presented_at is null/,
    'you cannot authorize an estimate the customer was never shown')
  assert.match(authMig, /decision = 'declined' and nullif\(btrim\(coalesce\(new\.decline_reason,''\)\),''\) is null/,
    'a decline must record why')
})

test('a retried authorization submission records one decision', () => {
  assert.match(authMig, /create unique index if not exists ro_auth_idempotency_uk/)
  const fn = eng.match(/export async function recordAuthorization[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(prior\) return prior/, 'a retry returns the original decision')
})

test('authorization reuses shared primitives rather than new infrastructure', () => {
  // contacts for identity, esign_requests for signature, no second signing system.
  assert.match(authMig, /contact_id uuid/)
  assert.match(authMig, /esign_request_id uuid/)
  for (const dup of ['service_signatures', 'service_consents', 'ro_customers']) {
    assert.ok(!authMig.includes(dup), `must not create ${dup}`)
  }
})

// ── 11. Technician workflow (Batch 1, step 4) ────────────────────────────────

const techMig = read('migrations/2026-08-09-stage4b-technician-workflow.sql')

test('the job is the RO line — no second job model', () => {
  assert.doesNotMatch(techMig, /create table[\s\S]{0,60}ro_jobs/i, 'must not create a parallel job table')
  for (const col of ['concern', 'cause', 'correction', 'op_code', 'pay_type', 'recommended',
                     'line_status', 'started_at', 'completed_at', 'blocked_reason', 'hours_actual']) {
    assert.ok(techMig.includes(`add column if not exists ${col}`), `ro_lines must carry ${col}`)
  }
})

test('concern, cause and correction are separate fields, so diagnosis cannot erase the customer', () => {
  const fn = eng.match(/export async function setLineProgress[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(cause != null\) patch\.cause/)
  assert.match(fn, /if \(correction != null\) patch\.correction/)
  assert.doesNotMatch(fn, /patch\.concern/, 'the technician path must never write over the concern')
})

test('a blocked job must say what it is waiting for', () => {
  assert.match(techMig, /check \(line_status <> 'blocked' or nullif\(btrim\(coalesce\(blocked_reason,''\)\),''\) is not null\)/,
    'the database must refuse a blocker with no reason')
  const fn = eng.match(/export async function setLineProgress[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /Say what the job is waiting for/)
})

test('advisor and technician actions are separated on the server', () => {
  assert.match(techMig, /insert into public\.permissions[\s\S]{0,200}service\.manage_workflow/)
  const grants = techMig.match(/insert into public\.role_permissions[\s\S]*?service\.manage_workflow[\s\S]*?;/)?.[0] || ''
  assert.ok(!/technician/.test(grants), 'a technician must not hold desk permission')
  // Desk work: estimates, authorization, assignment.
  for (const route of ["app.post('/service-engine/ros/:id/estimates', requireAuth, canDesk",
                       "app.post('/service-engine/estimates/:id/present', requireAuth, canDesk",
                       "app.post('/service-engine/ros/:id/authorizations', requireAuth, canDesk",
                       "app.post('/service-engine/lines/:id/assign', requireAuth, canDesk"]) {
    assert.ok(eng.includes(route), `must be desk-gated: ${route}`)
  }
  // The shop-floor action is a single route whose verb is validated server-side.
  assert.match(eng, /app\.post\('\/service-engine\/lines\/:id\/progress', requireAuth, canWork/)
  assert.match(eng, /if \(!\['start', 'block', 'resume', 'complete', 'qc'\]\.includes\(action\)\)/)
})

test('a technician may only work the job assigned to them', () => {
  const fn = eng.match(/async function assertLineActor[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /hasPermission\(req, 'service\.manage_workflow'\)/, 'desk staff may act on any job')
  assert.match(fn, /if \(line\.tech_id && line\.tech_id === req\.user\?\.id\) return/,
    'otherwise the job must actually be theirs')
  assert.match(fn, /That job is not assigned to you/)
  // And it is enforced where the action happens, not only in the UI.
  assert.match(eng, /await assertLineActor\(req\.dealershipId, req\.params\.id, req\)/)
})

test('completing jobs never closes the repair order', () => {
  const fn = eng.match(/export async function setLineProgress[\s\S]*?\n\}\n/)?.[0] || ''
  assert.doesNotMatch(fn, /closeRepairOrder|transitionRepairOrder|status: 'closed'/,
    'finishing work is not the financial act of closing')
})

test('actual labour reuses the existing time clock', () => {
  const fn = eng.match(/export async function roActualHours[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /from\('time_entries'\)/, 'no second time system')
  assert.match(fn, /\.eq\('ro_id', roId\)/, 'the clock already carries ro_id — use it')
})

// ── 12. Parts demand, reservation and issue (Batch 1, step 5) ───────────────

const partsMig = read('migrations/2026-08-09-stage4b-part-requests.sql')

test('demand is its own record, separate from stock', () => {
  assert.match(partsMig, /create table if not exists public\.part_requests/)
  for (const col of ['ro_id', 'ro_line_id', 'part_id', 'qty_requested', 'qty_reserved', 'qty_issued', 'status']) {
    assert.ok(partsMig.includes(col), `a request must carry ${col}`)
  }
  // A request is not a movement: creating one must never touch stock.
  const fn = eng.match(/export async function requestPart[\s\S]*?\n\}\n/)?.[0] || ''
  assert.doesNotMatch(fn, /service_move_stock|moveStock|qty_on_hand/, 'requesting a part must not move stock')
})

test('reservation is atomic and cannot oversell the last unit', () => {
  assert.match(partsMig, /v_avail := coalesce\(v_part\.qty_on_hand,0\) - coalesce\(v_part\.qty_reserved,0\)/,
    'reserve against available, not on-hand')
  assert.match(partsMig, /where id = v_req\.part_id and dealership_id = p_dealership[\s\S]{0,40}?for update/,
    'the part row must be locked while availability is decided')
  assert.match(partsMig, /greatest\(v_avail, 0\)/, 'you cannot reserve more than is available')
  assert.match(partsMig, /constraint part_requests_not_over_reserved check \(qty_reserved <= qty_requested\)/)
})

test('a short reserve is backordered, not an error', () => {
  assert.match(partsMig, /when v_req\.qty_reserved >= v_req\.qty_requested then 'reserved' else 'backordered'/,
    'partial availability is a real business state')
})

test('issue goes THROUGH the hardened stock path, never around it', () => {
  assert.match(partsMig, /select \* into v_mv from public\.service_move_stock\(/,
    'issuing must reuse the step-1 movement, so the ledger and idempotency are the same')
  // The failure this prevents: a second code path writing balances directly.
  const issueFn = partsMig.match(/create or replace function public\.service_issue_part[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.doesNotMatch(issueFn, /set qty_on_hand\s*=/, 'issue must never write qty_on_hand itself')
  assert.match(partsMig, /constraint part_requests_not_over_issued check \(qty_issued <= qty_requested\)/)
})

test('availability is server truth, derived from on-hand minus reserved', () => {
  const fn = eng.match(/export async function partsAvailability[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /qty_available: round2\(n\(p\.qty_on_hand\) - n\(p\.qty_reserved\)\)/)
  assert.doesNotMatch(fe, /qty_available\s*=/, 'the UI must not compute availability itself')
})

test('parts stays extractable — Service asks, it does not own the stock model', () => {
  // Everything Service does to stock goes through the shared functions, so Parts can
  // later own them without unpicking Service.
  assert.match(eng, /supabaseAdmin\.rpc\('service_reserve_part'/)
  assert.match(eng, /supabaseAdmin\.rpc\('service_issue_part'/)
  for (const dup of ['service_parts', 'service_inventory', 'ro_parts_stock']) {
    assert.ok(!partsMig.includes(dup), `must not create a second inventory model (${dup})`)
  }
})

// ── 13. Service accounting corrections (Batch 2) ─────────────────────────────

const acctMig = read('migrations/2026-08-09-stage4b-service-tax-and-parts-receipt-accounting.sql')
const acct = strip(read('routes/accounting-engine.js'))

test('tax is a liability, and AR is billed at what the customer actually owes', () => {
  const rule = acctMig.match(/'service_closed', '\[[\s\S]*?\]'::jsonb/)?.[0] || ''
  assert.match(rule, /"account_key":"accounts_receivable","side":"debit","source":"total"/,
    'AR must be debited with the tax-inclusive total, not the subtotal')
  assert.match(rule, /"account_key":"service_revenue","side":"credit","source":"revenue"/,
    'revenue stays pre-tax')
  assert.match(rule, /"account_key":"tax_collected","side":"credit","source":"tax"/,
    'collected tax must be credited to the liability, never left inside revenue')
  // Balanced: debits total+cost, credits revenue+tax+cost, and total = revenue + tax.
})

test('closing an RO publishes the numbers that rule needs', () => {
  const fn = eng.match(/export async function closeRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /tax: round2\(totals\.tax\), total: round2\(totals\.total\)/,
    'the event must carry tax and the tax-inclusive total')
  assert.match(acct, /tax: n\(p\.tax\), total: n\(p\.total\) \|\| round2\(n\(p\.revenue\) \+ n\(p\.tax\)\)/,
    'and the consumer must read them, falling back to revenue+tax rather than dropping tax')
})

test('a parts receipt capitalizes inventory instead of leaving it negative', () => {
  const rule = acctMig.match(/'parts_received', '\[[\s\S]*?\]'::jsonb/)?.[0] || ''
  assert.match(rule, /"account_key":"parts_inventory","side":"debit","source":"amount"/)
  assert.match(rule, /"account_key":"accounts_payable","side":"credit","source":"amount"/)
  assert.match(acct, /case 'parts\.received':/, 'the event must actually be routed to the rule')
  const fn = eng.match(/export async function receiveParts[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /amount: round2\(Math\.abs\(n\(qty\)\) \* unit\)/, 'a receipt must carry its value')
})

test('financial posting stays idempotent on replay', () => {
  // postByRule dedupes on (dealership, source, reference, event); the reference must be
  // the ledger row, so replaying an event posts one journal entry, not another one.
  assert.match(eng, /ref: r\.txnId/, 'a receipt must reference its stock ledger row')
  assert.match(acct, /__reference: p\.ref \|\| p\.txn_id \|\| e/)
  const fn = eng.match(/export async function receiveParts[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /if \(!r\.duplicate\) \{/, 'a deduped receipt must not emit a second financial event')
})

test('Service produces financial events but owns no ledger', () => {
  assert.doesNotMatch(eng, /from\('journal_entries'\)|from\('journal_lines'\)|from\('gl_accounts'\)/,
    'Service must never write the ledger itself')
  assert.doesNotMatch(eng, /postByRule|ACCOUNT_DEFS/, 'posting belongs to the accounting engine')
})

// ── 14. Invoice read + explicit financial disposition (Batch 2) ──────────────

const dispMig = read('migrations/2026-08-09-stage4b-ro-financial-disposition.sql')

test('one read answers charged / paid / remaining', () => {
  const fn = eng.match(/export async function roFinancials[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the advisor needs a single financial read')
  for (const field of ['subtotal', 'tax:', 'total', 'paid', 'balance', 'payments', 'allocations']) {
    assert.ok(fn.includes(field), `the invoice read must expose ${field}`)
  }
  // Totals come from the RO, money from the core Payment primitive — no second truth.
  assert.match(fn, /paymentsForSubject\(dealershipId, 'repair_order', roId\)/)
  assert.doesNotMatch(fn, /from\('ro_estimates'\)/,
    'estimates are what was PROPOSED — they must not be confused with what is owed')
})

test('closing states the money outcome instead of implying it', () => {
  assert.match(dispMig, /check \(status <> 'closed' or financial_disposition is not null\)/,
    'the database must refuse a close with an implicit balance')
  assert.match(dispMig, /'paid_in_full','partial_ar','ar','warranty','internal','goodwill'/,
    'warranty and internal work settle differently — they are real outcomes too')
  const fn = eng.match(/export async function closeRepairOrder[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /const problem = dispositionError\(disposition, balance\)/)
  assert.match(fn, /financial_disposition: disposition, closed_balance: balance/,
    'what was owed at close must be recorded, not recomputed later')
})

test('a zero balance is not required to close, but honesty is', () => {
  const fn = eng.match(/function dispositionError[\s\S]*?\n\}/)?.[0] || ''
  // Carrying AR is legitimate; claiming paid-in-full with money outstanding is not.
  assert.match(fn, /disposition === 'paid_in_full' && !paidInFull/,
    'you cannot call it paid in full while a balance remains')
  assert.match(fn, /disposition === 'ar' && balance <= 0/,
    'and you cannot carry AR that does not exist')
})
