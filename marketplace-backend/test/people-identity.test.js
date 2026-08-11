import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 7 PR 7.1 — employee identity and its producer.
//
// The defect: `staff_members` held zero rows against seven real logins because nothing ever
// created one. Every People feature answered "No staff profile linked to your account".
//
// Per AGENTS.md A19 these tests answer the producer/consumer check directly — who writes it,
// what stops duplicates, who reads it, and what happens when the producer is missing.

import {
  EMPLOYMENT_STATES, EMPLOYMENT_TRANSITIONS, transitionError, departmentForRole,
} from '../routes/people-identity.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const identity = strip(read('routes/people-identity.js'))
const hr = strip(read('routes/hr.js'))
const profile = strip(read('routes/profile.js'))

// ── The producer exists at the moment a person is hired ─────────────────────

test('inviting a user creates their employment record', () => {
  const invite = profile.match(/app\.post\('\/admin\/users\/invite'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(invite, 'the invite route must exist')
  assert.match(invite, /await ensureStaffMember\(req\.dealershipId, newUser\.user\.id/,
    'a login without an employment record is the broken state this slice ends')
  assert.match(invite, /status: 'invited'/)
})

test('a login that predates the producer is backfilled, not refused', () => {
  const self = hr.match(/async function selfStaffMemberId[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(self, 'the self-resolver must exist')
  assert.match(self, /await ensureStaffMember\(req\.dealershipId, req\.user\.id/)
  // Someone who has been signing in for months is not waiting on an invitation.
  assert.match(self, /status: 'active'/)
})

test('duplicates are prevented by the database, not by a read-then-write', () => {
  assert.match(identity, /duplicate key/i, 'the unique index is the guarantee')
  // Losing the race still satisfies the caller: they wanted an employee to exist.
  const fn = identity.match(/export async function ensureStaffMember[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /raced/, 'a concurrent create re-reads rather than failing')
})

test('the employment record is created against a real dealership and user', () => {
  const fn = identity.match(/export async function ensureStaffMember[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(!dealershipId \|\| !userId\)/)
})

test('the producer satisfies the live staff_members team constraint', () => {
  const fn = identity.match(/export async function ensureStaffMember[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /team: team \|\| resolvedDepartment \|\| 'General'/)
})

test('employment start date is canonical and never inferred from record creation', () => {
  const migration = read('migrations/2026-08-10-phase8-employee-start-date.sql')
  assert.match(migration, /add column if not exists start_date date/)
  assert.match(identity, /start_date: startDate \|\| null/)
  assert.doesNotMatch(identity, /start_date:.*created_at/)
})

test('inviting a pre-existing employee links it instead of duplicating identity', () => {
  const fn = identity.match(/export async function ensureStaffMember[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /\.ilike\('email', email\)/)
  assert.match(fn, /\.is\('user_id', null\)/)
  assert.match(fn, /update\(\{ user_id: userId/)
  const migration = read('migrations/2026-08-10-phase8-employee-start-date.sql')
  assert.match(migration, /staff_members_dealership_uninvited_email_uidx/)
})

test('registration creates the first dealership employee atomically', () => {
  const auth = strip(read('routes/auth.js'))
  const register = auth.match(/app\.post\('\/auth\/register'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(register, /await ensureStaffMember\(createdDealershipId, createdUserId/)
  assert.match(register, /if \(employment\.error\) throw/)
})

test('an invite never survives a failed employment create', () => {
  const invite = profile.match(/app\.post\('\/admin\/users\/invite'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(invite, /if \(staffError\)/)
  assert.match(invite, /auth\.admin\.deleteUser\(newUser\.user\.id\)/)
  assert.doesNotMatch(invite, /if \(staffError\) console\.error/)
})

test('Users & Access returns the canonical linked employee', () => {
  const route = strip(read('routes/profile.js'))
  const team = route.match(/app\.get\('\/dealership\/team'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(team, /from\('staff_members'\)/)
  assert.match(team, /linked_employee: employment/)
  assert.match(team, /account_status/)
})

// ── The lifecycle the database already enforces ─────────────────────────────

test('the states match the constraint the database already had', () => {
  assert.deepEqual(EMPLOYMENT_STATES, ['invited', 'active', 'on_leave', 'suspended', 'terminated'])
})

test('termination is terminal — a rehire is a new record, not an edit', () => {
  assert.deepEqual(EMPLOYMENT_TRANSITIONS.terminated, [])
  const err = transitionError('terminated', 'active')
  assert.ok(err)
  assert.match(err, /cannot be reactivated/)
})

test('illegal moves are refused with a reason a person can read', () => {
  assert.match(transitionError('invited', 'on_leave'), /cannot go from invited to on leave/)
  assert.equal(transitionError('active', 'on_leave'), null)
  assert.equal(transitionError('on_leave', 'active'), null)
  assert.match(transitionError('active', 'active'), /already active/)
  assert.match(transitionError('active', 'retired'), /not an employment status/)
})

test('every legal target is itself a real state', () => {
  for (const [from, targets] of Object.entries(EMPLOYMENT_TRANSITIONS)) {
    assert.ok(EMPLOYMENT_STATES.includes(from), `${from} is not a state`)
    for (const t of targets) assert.ok(EMPLOYMENT_STATES.includes(t), `${from} → ${t} is not a state`)
  }
})

test('every transition is written to history', () => {
  const fn = identity.match(/export async function changeEmploymentStatus[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /await recordStatus\(dealershipId, staffMemberId, staff\.employment_status, toStatus/)
  // And so is the creation, so the record starts with an explanation of itself.
  assert.match(identity, /reason: 'Employment record created'/)
})

test('a status change cannot silently overwrite a concurrent one', () => {
  const fn = identity.match(/export async function changeEmploymentStatus[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /\.eq\('employment_status', staff\.employment_status\)/)
  assert.match(fn, /changed while you were reviewing them/)
})

// ── The thing that would be worse than no button ────────────────────────────

test('termination refuses until offboarding exists', () => {
  const fn = identity.match(/export async function changeEmploymentStatus[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /toStatus === 'terminated' && !allowTerminate/)
  assert.match(fn, /Termination goes through offboarding/)
  // Marking someone terminated while they keep their roles, session and owned work is worse
  // than not offering it — that is the 7.2 stop-gate item.
})

// ── One identity, assembled — never a second copy ───────────────────────────

test('the directory joins the person to their employment rather than copying either', () => {
  const fn = identity.match(/export async function teamDirectory[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('staff_members'\)/)
  assert.match(fn, /from\('profiles'\)/)
  // A login with no employment record is shown and flagged, not hidden.
  assert.match(fn, /linked: false/)
  assert.match(fn, /has_employment: false/)
  assert.match(fn, /account_status/)
  assert.match(fn, /training_status/)
  assert.match(fn, /manager_name/)
  assert.match(identity, /can_sign_in/)
})

test('the role→department map joins two existing vocabularies, it does not add a third', () => {
  assert.equal(departmentForRole('SALES_REP'), 'Sales')
  assert.equal(departmentForRole('ACCOUNTING'), 'Accounting')
  assert.equal(departmentForRole('FNI'), 'F&I')
  assert.equal(departmentForRole('sales_rep'), 'Sales', 'case is not a different role')
  assert.equal(departmentForRole('NOPE'), null, 'an unknown role gets no department, not a guess')
  assert.equal(departmentForRole(null), null)
})

test('permissions stay where they already are', () => {
  // user_roles → role_permissions is the authoritative path and is frozen kernel.
  assert.doesNotMatch(identity, /from\('user_roles'\)|from\('role_permissions'\)/,
    'employment must not become a second permission source')
})

// ── The routes ──────────────────────────────────────────────────────────────

test('creating an employment record refuses a cross-tenant user', () => {
  const route = hr.match(/app\.post\('\/hr\/employees'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the create route must exist')
  assert.match(route, /person\.dealership_id !== req\.dealershipId/)
  assert.match(route, /404/, 'a cross-tenant user is refused the same way a missing one is')
})

test('People routes carry the permissions that already existed', () => {
  assert.match(hr, /app\.get\('\/hr\/team', requireAuth, requirePermission\('staff\.view'\)/)
  assert.match(hr, /app\.post\('\/hr\/employees', requireAuth, requireMfa, requirePermission\('staff\.manage'\)/)
  assert.match(hr, /app\.patch\('\/hr\/employees\/:id\/status', requireAuth, requireMfa, requirePermission\('staff\.lifecycle\.manage'\)/)
})

test('the People module reads through RLS like the rest of hr.js', () => {
  assert.doesNotMatch(hr, /supabaseAdmin\./,
    'hr.js re-checks tenancy in the database on every row; the admin client would bypass that')
})

// ── What a manager should do about it today ─────────────────────────────────

test('a person who can sign in but has no employment record is surfaced', () => {
  const fn = identity.match(/export async function peopleAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /kind: 'employee_record_missing', severity: 2/)
  assert.match(fn, /kind: 'employee_never_activated'/)
  assert.match(fn, /kind: 'onboarding_not_started'/)
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(fn.includes(`${field}:`), `attention items must carry ${field}`)
  }
})
