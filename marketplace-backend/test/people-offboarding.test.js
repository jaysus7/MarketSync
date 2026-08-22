import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 7 PR 7.2 — offboarding.
//
// The stop-gate question was "does a terminated employee retain access?" The honest answer is
// NO: `requireAuth` re-reads the profile every request and refuses `active: false` with
// ACCOUNT_DEACTIVATED, so the one-line removal really did lock people out.
//
// The damage was elsewhere and quieter: roles survived the departure, and the departed
// person's customer book, open tasks and open repair orders stayed assigned to them. Nobody
// follows up on an orphaned book, and nothing says it happened.

import { offboardEmployee } from '../routes/people-offboarding.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const off = strip(read('routes/people-offboarding.js'))
const profile = strip(read('routes/profile.js'))
const middleware = read('middleware.js')

// ── The refusals, run for real ──────────────────────────────────────────────

test('offboarding needs the person, not just the employment record', async () => {
  const r = await offboardEmployee('d1', { staffMemberId: 's1', userId: null })
  assert.equal(r.ok, false)
  assert.match(r.error, /needs the person/)
})

test('nobody can offboard themselves', async () => {
  const r = await offboardEmployee('d1', { staffMemberId: 's1', userId: 'u1', actorId: 'u1' })
  assert.equal(r.ok, false)
  assert.match(r.error, /cannot offboard yourself/)
})

test('work cannot be handed to the person leaving', async () => {
  const r = await offboardEmployee('d1', { staffMemberId: 's1', userId: 'u1', actorId: 'u2', reassignToUserId: 'u1' })
  assert.equal(r.ok, false)
  assert.match(r.error, /cannot be reassigned to the person leaving/)
})

// ── The order that cannot leave the dealership worse off ────────────────────

test('offboarding refuses while live work would be orphaned', () => {
  const fn = off.match(/export async function offboardEmployee[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /owned\.total > 0 && !reassignToUserId/)
  assert.match(fn, /needs_reassignment: true/)
  // The refusal names the consequence rather than being a bare rejection.
  assert.match(fn, /still owns \$\{owned\.total\} live record\(s\)/)
})

test('a count that failed is not treated as zero', () => {
  const fn = off.match(/export async function ownedWork[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /unknown: true/)
  const off2 = off.match(/export async function offboardEmployee[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(off2, /if \(owned\.unknown\)/,
    'saying "nothing to reassign" because a query failed is how a book gets orphaned quietly')
})

test('the successor must be real, active, and at this dealership', () => {
  const fn = off.match(/export async function offboardEmployee[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /successor\.dealership_id !== dealershipId/)
  assert.match(fn, /successor\.active === false/)
})

test('termination is written last, after access is already gone', () => {
  const fn = off.match(/export async function offboardEmployee[\s\S]*?\n\}\n/)?.[0] || ''
  const revoke = fn.indexOf('revokeRoles')
  const deactivate = fn.indexOf("active: false")
  const terminate = fn.indexOf("'terminated'")
  assert.ok(revoke > 0 && deactivate > revoke, 'roles are revoked before deactivation')
  assert.ok(terminate > deactivate,
    'a failure earlier must never mark someone terminated while they still hold access')
})

// ── What must NOT change ────────────────────────────────────────────────────

test('history is never reassigned', () => {
  // Who did a thing does not change because they resigned.
  assert.doesNotMatch(off, /column: 'created_by'/)
  assert.match(off, /history_preserved: true/)
  // Every column the ownership map touches must be a live-assignment column, never authorship.
  const cols = [...off.matchAll(/column: '([a-z_]+)'/g)].map(m => m[1])
  assert.ok(cols.length >= 5)
  for (const c of cols) assert.notEqual(c, 'created_by', 'authorship is history, not ownership')
})

test('only live ownership moves, and each kind is open-filtered', () => {
  const list = off.match(/const OWNERSHIP = \[[\s\S]*?\n\]/)?.[0] || ''
  assert.ok(list, 'the ownership map must exist')
  for (const col of ["'assigned_rep'", "'assigned_to'", "'advisor_id'", "'technician_id'", "'owner_id'"]) {
    assert.ok(list.includes(col), `must cover ${col}`)
  }
  // Closed repair orders and finished tasks stay where they are — reassigning them would
  // rewrite who handled work that is already done.
  assert.match(list, /q\.is\('closed_at', null\)/)
  assert.match(list, /q\.eq\('done', false\)/)
})

test('reassignment reports what actually moved', () => {
  const fn = off.match(/export async function reassignOwnedWork[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /count: data\.length/, '"reassigned" with no numbers is not checkable')
})

// ── Roles, and why revoking them is separate from locking the door ──────────

test('roles are revoked, not just the account deactivated', () => {
  assert.match(off, /export async function revokeRoles/)
  const fn = off.match(/export async function revokeRoles[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('user_roles'\)\s*\n?\s*\.delete\(\)/)
  assert.match(fn, /\.eq\('dealership_id', dealershipId\)/, 'never another tenant\'s grants')
})

test('deactivation actually blocks access — the flag is enforced per request', () => {
  // This is why the one-line removal was not a security hole, only an incomplete one.
  assert.match(middleware, /profile\.active === false.*ACCOUNT_DEACTIVATED/s)
})

// ── The legacy route no longer orphans a book ───────────────────────────────

test('removing a team member now runs the real offboarding', () => {
  const route = profile.match(/app\.delete\('\/admin\/users\/:id'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the route must still exist')
  assert.match(route, /await offboardEmployee\(req\.dealershipId/)
  assert.match(route, /result\.needs_reassignment \? 409 : 400/)
  // The old behaviour, which is what left books ownerless.
  assert.doesNotMatch(route, /from\('profiles'\)\.update\(\{ active: false \}\)/,
    'a bare deactivation is what orphaned the customer book')
})

test('the offboarding routes are permissioned and MFA-gated', () => {
  assert.match(off, /requirePermission\('staff\.lifecycle\.manage'\)/)
  assert.match(off, /app\.post\('\/hr\/employees\/:id\/offboard', requireAuth, requireMfa, canManage/)
  assert.match(off, /app\.get\('\/hr\/employees\/:id\/owned-work', requireAuth, requireMfa, canManage/)
})

test('offboarding refuses a cross-tenant employee', () => {
  const route = off.match(/app\.post\('\/hr\/employees\/:id\/offboard'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(route, /404/)
})
