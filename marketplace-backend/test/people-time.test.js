import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 7 PR 7.4 — the time clock, and payroll that names who it could not pay.
//
// `entryHours`, `decorate` and the payroll shaping are pure, so these run the real functions.
// The database rules — one open shift, tenant-scoped employee, append-only history — are
// proved against staging by the probes recorded in docs/PHASE7_PEOPLE_LAUNCH.md, because CI
// has no Supabase.

import { entryHours, decorate } from '../routes/people-time.js'
import { isKnownPermission } from '../permissions-catalog.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const timeSrc = read('routes/people-time.js')
const time = strip(timeSrc)
const migration = read('migrations/2026-08-10-phase7-time.sql')
const hr = strip(read('routes/hr.js'))
const service = strip(read('routes/service-engine.js'))
const server = read('server.js')

// ── Hours are derived, every time ───────────────────────────────────────────

const at = (h, m = 0) => new Date(Date.UTC(2026, 7, 10, h, m)).toISOString()

test('an open shift has no hours yet, rather than zero hours', () => {
  // Zero and "not finished" are different facts. Reporting an open shift as 0.0 is how a
  // day's work disappears from a payroll period.
  assert.equal(entryHours({ clock_in: at(9), clock_out: null }), null)
  assert.equal(decorate({ clock_in: at(9), clock_out: null }).open, true)
  assert.equal(decorate({ clock_in: at(9), clock_out: null }).hours, null)
})

test('hours come from the two timestamps, minus the break', () => {
  assert.equal(entryHours({ clock_in: at(9), clock_out: at(17), break_minutes: 0 }), 8)
  assert.equal(entryHours({ clock_in: at(9), clock_out: at(17), break_minutes: 30 }), 7.5)
  assert.equal(entryHours({ clock_in: at(9), clock_out: at(9, 45), break_minutes: 0 }), 0.75)
})

test('hours never go negative', () => {
  assert.equal(entryHours({ clock_in: at(9), clock_out: at(9, 10), break_minutes: 600 }), 0)
})

test('no total is stored anywhere — it is always recomputed', () => {
  // A stored total is a number that can disagree with the times behind it.
  assert.ok(!/hours:\s*\w+\s*,?\s*$/m.test(time.replace(/hours: entryHours\(entry\)/g, '')))
  assert.match(time, /hours: entryHours\(entry\)/)
  assert.ok(!/total_hours|hours_total/.test(time), 'hours must not be persisted')
})

// ── Clocking in and out ─────────────────────────────────────────────────────

test('a second open shift is refused by the database, not only by a check', () => {
  // Two tabs or two taps would otherwise double-count every hour after the second one.
  assert.match(migration, /create unique index if not exists time_entries_one_open_per_employee[\s\S]{0,160}where clock_out is null/)
  assert.match(time, /time_entries_one_open_per_employee/, 'the route must translate that violation into a person-readable refusal')
})

test('clocking out cannot close a shift twice', () => {
  assert.match(time, /\.is\('clock_out', null\)[\s\S]{0,120}select/)
  assert.match(time, /That shift was already closed/)
})

test('time cannot be recorded against employment that is not active', () => {
  assert.match(time, /employment_status !== 'active'/)
})

test('a break longer than the shift is refused in the route and in the database', () => {
  assert.match(time, /longer than the shift/)
  assert.match(migration, /time_entries_break_within_shift[\s\S]{0,200}break_minutes <=/)
})

// ── Approval is what turns time into money ──────────────────────────────────

test('an approval must name who approved it, and only a finished shift', () => {
  assert.match(migration, /time_entries_approval_complete[\s\S]{0,220}approved_by is not null and approved_at is not null/)
  assert.match(migration, /status <> 'approved' or \(clock_out is not null/)
})

test('approval reports what it skipped, and why', () => {
  // A manager who approves twelve entries and gets nine needs to know which three.
  assert.match(time, /skipped: \[/)
  assert.match(time, /still clocked in/)
  assert.match(time, /already approved/)
  assert.match(time, /not found/)
})

test('approved time cannot be edited', () => {
  assert.match(time, /Approved time cannot be edited/)
  assert.match(time, /\.neq\('status', 'approved'\)/, 'and the write must not race an approval that landed mid-edit')
})

test('an edit that cannot be recorded in history is not applied', () => {
  // The trail is the point. An untraceable change to somebody's pay is the thing this
  // table exists to prevent, so failing to write it fails the edit.
  assert.match(time, /if \(!traced\.ok\) return \{ ok: false/)
})

test('the change history is append-only and tenant-scoped', () => {
  assert.match(migration, /Time entry change history is append-only/)
  assert.match(migration, /create trigger time_entry_change_history_append_only[\s\S]{0,160}before update or delete/)
  assert.match(migration, /time_entry_change_history_entry_same_dealer/)
})

test('every mutation writes history', () => {
  for (const action of ['insert', 'clock_out', 'manager_edit', 'approve']) {
    assert.match(time, new RegExp(`recordChange\\([^)]*'${action}'`),
      `${action} does not write to the change history`)
  }
})

// ── Whose time is this ──────────────────────────────────────────────────────

test('a time entry names an employment record, scoped to one dealership', () => {
  // `employee_id` carried NO foreign key at all — any uuid was accepted, including another
  // dealership's employee, on the record that decides what somebody gets paid.
  assert.match(migration, /time_entries_employee_same_dealer[\s\S]{0,220}references public\.staff_members\(id, dealership_id\)/)
  assert.match(migration, /foreign key \(employee_id, dealership_id\)/)
})

test('the clock resolves the caller to their own employment record', () => {
  assert.match(time, /export async function staffFor/)
  assert.match(time, /\.eq\('user_id', userId\)/)
  // A login with no employment record is told so, not handed somebody else's clock.
  assert.match(time, /No employment record is linked to your account yet/)
})

// ── Payroll names who it could not pay ──────────────────────────────────────

test('an employee with no rate is reported, never silently dropped', () => {
  // A payroll run that quietly omits somebody looks like a completed run.
  assert.match(time, /unpayable\.push/)
  assert.match(time, /no employment details recorded/)
  assert.match(time, /no hourly rate recorded/)
  assert.match(time, /hours recorded but not approved/)
})

test('only approved hours are paid', () => {
  assert.match(time, /if \(!s\.approved_hours\)/)
  assert.match(time, /approved_hours: s\.approved_hours/)
})

test('deductions are not fabricated', () => {
  // A zero withholding that looks calculated is worse than one that says it was not.
  assert.match(time, /deductions_calculated: false/)
  assert.match(time, /deductions: 0/)
})

test('commission is not guessed from the clock', () => {
  // The commission engine owns pay plans and periods; a second number for the same money is
  // how two screens start disagreeing about what somebody earned.
  assert.ok(!/commission_plan|calculateCommission|commission:/.test(time.replace(/Commission is not computed[\s\S]*?\n/, '')))
})

test('recalculating a batch corrects the line rather than paying twice', () => {
  assert.match(time, /onConflict: 'batch_id,staff_member_id'/)
  assert.match(migration, /create unique index if not exists staff_payroll_items_one_per_staff_per_batch/)
})

test('only a draft batch can be calculated', () => {
  assert.match(time, /Only a draft batch can be calculated/)
})

test('a period that is not settled says so', () => {
  assert.match(time, /complete: openCount === 0 && unapproved === 0/)
  assert.match(time, /period_complete: period\.complete/)
})

// ── The two silent zeros this slice removes ─────────────────────────────────

test('an empty payroll export is refused', () => {
  // Until this slice nothing wrote staff_payroll_items, so the export returned 200 and a CSV
  // of headers with no rows — a successful export that reads as "nobody is owed anything".
  assert.match(hr, /if \(!rows\.length\)[\s\S]{0,200}status\(409\)/)
  assert.match(hr, /nothing to export/)
  assert.match(hr, /batches\/:id\/calculate/, 'and it must say how to fix it')
})

test('actual repair-order hours distinguish "none recorded" from zero', () => {
  // This returned a bare 0.0 for every repair order in existence, which reads as "this job
  // took no time" rather than "nobody has clocked against it".
  assert.match(service, /recorded: entries\.length > 0/)
  assert.match(service, /open_entries: entries\.length - closed\.length/)
  const route = service.match(/actual-hours'[\s\S]{0,200}?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the actual-hours route must exist')
  assert.ok(!/\{ hours: await roActualHours/.test(route), 'the route must ship the whole answer, not just the number')
})

test('Service still has no second time system', () => {
  const fn = service.match(/export async function roActualHours[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /from\('time_entries'\)/)
  assert.match(fn, /\.eq\('ro_id', roId\)/)
})

// ── Wiring and gating ───────────────────────────────────────────────────────

test('the clock is registered on the server', () => {
  assert.match(server, /import \{ registerPeopleTime \} from '\.\/routes\/people-time\.js'/)
  assert.match(server, /^registerPeopleTime\(app\)/m)
})

test('clocking your own time is a different permission from approving anybody else\'s', () => {
  assert.ok(isKnownPermission('staff.time.self'))
  assert.ok(isKnownPermission('staff.time.approve'))
  assert.match(time, /canSelf = requirePermission\('staff\.time\.self'\)/)
  assert.match(time, /canApprove = requirePermission\('staff\.time\.approve'\)/)
  assert.match(time, /canPayroll = requirePermission\('staff\.payroll\.manage'\)/)
})

test('self-service routes never expose another employee\'s hours', () => {
  const selfRoutes = [...time.matchAll(/app\.(get|post)\('(\/hr\/time\/(?:me|clock-in|clock-out))'([^)]*)/g)]
  assert.equal(selfRoutes.length, 3, 'expected the three self-service routes')
  for (const [, , path, rest] of selfRoutes) {
    assert.ok(rest.includes('canSelf'), `${path} is not gated on staff.time.self`)
    assert.ok(rest.includes('mine'), `${path} does not scope to the caller's own employment record`)
    assert.ok(!rest.includes('canApprove'), `${path} must not require an approver's permission`)
  }
})

test('everything that changes somebody else\'s hours or pay requires MFA', () => {
  for (const route of ['/hr/time/entries', '/hr/time/period', '/hr/time/approve', '/hr/payroll/batches/:id/calculate']) {
    const m = time.match(new RegExp(`app\\.(get|post|patch)\\('${route.replace(/[/:]/g, m => '\\' + m)}'([^)]*)`))
    assert.ok(m, `${route} not found`)
    assert.ok(m[2].includes('requireMfa'), `${route} does not require MFA`)
  }
  assert.match(time, /app\.patch\('\/hr\/time\/entries\/:id', requireAuth, requireMfa, canApprove/)
})

test('Time is a My Day source gated on the permission that decides pay', async () => {
  const { MY_DAY_SOURCES } = await import('../routes/my-day.js')
  const source = MY_DAY_SOURCES.find(s => s.key === 'time')
  assert.ok(source, 'Time does not reach My Day')
  assert.equal(source.permission, 'staff.time.approve')
  assert.equal(typeof source.load, 'function')
})

test('a shift left open overnight is raised as attention', () => {
  assert.match(time, /shift_never_closed/)
  assert.match(time, /time_awaiting_approval/)
  assert.match(time, /Unapproved time is not paid/)
})
