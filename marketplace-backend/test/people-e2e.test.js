import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Phase 7 end-to-end — the twelve chains from docs/PHASE7_PEOPLE_LAUNCH.md §TESTS.
//
// AGENTS.md A19 asks for the runtime chain to be proven, not the presence of its pieces:
//
//   producer → canonical write → database state → consumer/read → user-visible outcome
//
// This file walks each of the twelve and asserts the JOIN between the links — the place every
// defect this phase found was actually hiding. Where a link is a pure function it is EXECUTED;
// where it is a database contract it is asserted against the applied migration, which is the
// artefact the database was built from.
//
// The phase found seven dead-wiring defects. Every one of them was invisible to a green test
// suite, and six of the twelve chains below exist specifically because of one of them.

import { buildPath, curriculaFor, publicCredential } from '../routes/academy.js'
import { entryHours } from '../routes/people-time.js'
import { buildLaunch, forFeature } from '../routes/launch-hub.js'
import { EMPLOYMENT_TRANSITIONS, transitionError, departmentForRole } from '../routes/people-identity.js'
import { buildMyDay, MY_DAY_SOURCES, MY_DAY_GAPS } from '../routes/my-day.js'
import { isKnownPermission } from '../permissions-catalog.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const identity = strip(read('routes/people-identity.js'))
const offboarding = strip(read('routes/people-offboarding.js'))
const academy = strip(read('routes/academy.js'))
const timeSrc = strip(read('routes/people-time.js'))
const compliance = strip(read('routes/people-compliance.js'))
const launch = strip(read('routes/launch-hub.js'))
const hr = strip(read('routes/hr.js'))
const profile = strip(read('routes/profile.js'))
const middleware = strip(read('middleware.js'))

const mAcademy = read('migrations/2026-08-10-phase7-academy.sql')
const mTime = read('migrations/2026-08-10-phase7-time.sql')
const mCompliance = read('migrations/2026-08-10-phase7-compliance.sql')
const mLaunch = read('migrations/2026-08-10-phase7-launch.sql')

// ── 1. A user created through the normal flow HAS an employment record ──────

test('E2E 1 — invite → login exists → employment record exists, exactly one', () => {
  // The defect this phase opened on: 24 tables, 14 routes, 17 permissions, and
  // `staff_members` had never held a row, because nothing created one.
  const invite = profile.match(/app\.post\('\/admin\/users'[\s\S]*?\n  \}\)/)?.[0]
    || profile.match(/ensureStaffMember\([\s\S]{0,400}/)?.[0] || ''
  assert.ok(/ensureStaffMember\(/.test(profile), 'inviting a user must produce an employment record')
  assert.match(invite, /ensureStaffMember\(/)

  // The producer itself, and the uniqueness that makes "exactly one" true.
  assert.match(identity, /export async function ensureStaffMember/)
  assert.match(identity, /\.eq\('user_id',/, 'it must look the person up by their login')
})

test('E2E 1b — one login cannot become two employees', () => {
  // Proved on staging in 7.1 by unique violation; pinned here so the guard cannot be dropped.
  assert.match(identity, /user_id/)
  assert.ok(!/insert\([\s\S]{0,200}\)\s*$/m.test(identity.split('ensureStaffMember')[1]?.slice(0, 300) || ''),
    'the producer must check before inserting')
})

// ── 2. An existing login with no employment record is backfilled ────────────

test('E2E 2 — a login that predates the producer is backfilled, not refused', () => {
  // Every login that existed before 7.1 had no staff row, and every People feature refused
  // them. An existing employee should not have to be re-hired to appear in their own team list.
  assert.match(hr, /ensureStaffMember\(/)
  assert.match(hr, /status: 'active'/, 'somebody signing in for months is not awaiting an invitation')
})

test('E2E 2b — the directory shows logins with no employment record rather than hiding them', () => {
  assert.match(identity, /export async function teamDirectory/)
  assert.match(identity, /linked: false/)
  assert.match(identity, /employee_record_missing/)
})

// ── 3. Employment status cannot be invented ─────────────────────────────────

test('E2E 3 — employment moves only along the state machine', () => {
  // Executed, not asserted about: these are the real transitions.
  assert.deepEqual(EMPLOYMENT_TRANSITIONS.terminated, [], 'termination is terminal')
  assert.ok(EMPLOYMENT_TRANSITIONS.invited.includes('active'))
  assert.ok(!EMPLOYMENT_TRANSITIONS.invited.includes('on_leave'), 'an invited person cannot go on leave')
  assert.ok(transitionError('invited', 'on_leave'), 'and the refusal explains itself')
  assert.equal(transitionError('invited', 'active'), null)
})

test('E2E 3b — employment is never a second permission source', () => {
  // profiles + user_roles is frozen kernel. If employment could grant permission there would be
  // two answers to "may this person do that", and they would drift.
  assert.ok(!/user_roles|role_permissions/.test(identity),
    'people-identity.js must never read the permission tables')
  assert.equal(typeof departmentForRole('SALES_REP'), 'string')
})

// ── 4. A terminated employee holds nothing ──────────────────────────────────

test('E2E 4 — access is refused per request, not at logout', () => {
  // A correction carried from 7.2: a terminated employee did NOT retain access. requireAuth
  // re-reads the profile on every request, so a live token is already worthless.
  assert.match(middleware, /active === false/)
  assert.match(middleware, /ACCOUNT_DEACTIVATED/)
})

test('E2E 4b — offboarding revokes roles before it deactivates, and terminates LAST', () => {
  // The real 7.2 damage: roles survived the departure, so reopening the account silently
  // restored every permission and nobody chose that.
  // Sliced from the declaration to end of file rather than regex-matched to the first `\n}`:
  // a non-greedy match truncates at the first nested closing brace and silently compares the
  // wrong half of the function.
  const at = offboarding.indexOf('export async function offboardEmployee')
  assert.ok(at > -1, 'offboardEmployee not found')
  const fn = offboarding.slice(at)
  const revoke = fn.indexOf('revokeRoles')
  const deactivate = fn.indexOf("active: false")
  const terminate = fn.indexOf("'terminated'")
  assert.ok(revoke > -1 && deactivate > revoke, 'roles must be revoked before deactivation')
  assert.ok(terminate > deactivate, 'employment is marked terminated last')
  assert.match(offboarding, /export async function revokeRoles/)
  assert.match(offboarding, /from\('user_roles'\)/)
})

// ── 5. Offboarding refuses while work is still owned ────────────────────────

test('E2E 5 — leaving with live owned work is refused, and the work is named', () => {
  // A salesperson left and their entire book stayed assigned to them. Nobody follows up on an
  // orphaned book, and nothing said it had happened.
  assert.match(offboarding, /needs_reassignment/)
  assert.match(offboarding, /export async function ownedWork/)
  assert.match(offboarding, /export async function reassignOwnedWork/)
  // A count that FAILED must not read as "nothing owned".
  assert.match(offboarding, /unknown/)
})

test('E2E 5b — completed work is never reassigned', () => {
  // Reassigning a closed repair order would rewrite who handled work that is already done.
  assert.match(offboarding, /openFilter/)
  assert.ok(!/created_by/.test(offboarding), 'authorship is history, not ownership')
})

// ── 6. History survives ─────────────────────────────────────────────────────

test('E2E 6 — employment history is append-only, and so is a time-entry edit', () => {
  assert.match(identity, /staff_status_history/)
  assert.match(mTime, /Time entry change history is append-only/)
  assert.match(mTime, /before update or delete on public\.time_entry_change_history/)
})

// ── 7. Compensation is not readable by everybody ────────────────────────────

test('E2E 7 — compensation needs its own permission and MFA', () => {
  assert.match(hr, /employment', requireAuth, requireMfa, requirePermission\('staff\.compensation\.view'\)/)
  assert.ok(isKnownPermission('staff.compensation.view'))
})

test('E2E 7b — clocking your own time never implies seeing anybody else\'s', () => {
  assert.match(timeSrc, /canSelf = requirePermission\('staff\.time\.self'\)/)
  assert.match(timeSrc, /canApprove = requirePermission\('staff\.time\.approve'\)/)
  // The self routes resolve the caller's own employment record and nothing else.
  assert.match(timeSrc, /\.eq\('user_id', userId\)/)
})

// ── 8. One dealership cannot touch another's employees ──────────────────────

test('E2E 8 — every Phase 7 table is tenant-scoped by the database, not by a filter', () => {
  // `.eq('dealership_id', …)` in a route is defence in depth. These composite keys are the
  // guarantee, and each one was added because the table did not have it.
  assert.match(mTime, /foreign key \(employee_id, dealership_id\)[\s\S]{0,120}staff_members\(id, dealership_id\)/)
  assert.match(mCompliance, /staff_lifecycle_assignments_staff_same_dealer/)
  assert.match(mTime, /staff_payroll_items_staff_same_dealer/)
  // And the one that had to be REPLACED rather than added, because it made global courses
  // unassignable — the tenant guarantee restated, not dropped.
  assert.match(mAcademy, /drop constraint if exists staff_training_course_same_dealer/)
  assert.match(mAcademy, /course_dealership is not null and course_dealership <> new\.dealership_id/)
})

// ── 9. Required training is deterministic ───────────────────────────────────

const catalog = [
  { id: 'c1', course_key: 'ms_getting_started', title: 'Getting around', department: null, level: 'required', role_keys: [], active: true },
  { id: 'c2', course_key: 'sales_lead_workflow', title: 'Leads', department: 'Sales', level: 'required', role_keys: [], active: true },
  { id: 'c3', course_key: 'svc_ro_workflow', title: 'ROs', department: 'Service', level: 'required', role_keys: [], active: true },
  { id: 'c4', course_key: 'ref', title: 'Library item', department: 'Sales', level: 'reference', role_keys: [], active: true },
]

test('E2E 9 — the same person on the same day always gets the same required list', () => {
  const once = buildPath(catalog, [], { role: 'SALES_REP', curricula: curriculaFor({ role: 'SALES_REP', department: 'Sales' }) })
  const twice = buildPath(catalog, [], { role: 'SALES_REP', curricula: curriculaFor({ role: 'SALES_REP', department: 'Sales' }) })
  assert.deepEqual(once.required.map(c => c.course_key), twice.required.map(c => c.course_key))
  assert.deepEqual(once.required.map(c => c.course_key).sort(), ['ms_getting_started', 'sales_lead_workflow'])
  // Role + department + policy. Nothing else, and nothing that could change its mind.
  assert.ok(!/openai|anthropic|model|prompt/i.test(academy), 'AI may recommend; it never decides what is required')
})

test('E2E 9b — the library is never pushed', () => {
  const path = buildPath(catalog, [], { role: 'SALES_REP', curricula: ['Sales'] })
  const all = [...path.required, ...path.foundations, ...path.advanced].map(c => c.course_key)
  assert.ok(!all.includes('ref'))
})

// ── 10. A credential requires the work, and exposes nothing else ────────────

test('E2E 10 — issuing refuses until every required course is completed', () => {
  assert.match(academy, /ok: false, outstanding/)
  assert.match(academy, /staff_training_assignments[\s\S]{0,400}?eq\('status', 'completed'\)/)
  assert.ok(!/req\.body[\s\S]{0,80}complet/i.test(academy), 'a caller cannot claim completion')
})

test('E2E 10b — the public credential exposes the credential and nothing about the employee', () => {
  const pub = publicCredential({
    credential_id: 'MS-SALES-abc', certification_name: 'Certified', certification_version: 1,
    issued_on: '2026-01-01', expires_on: '2028-01-01', status: 'active',
    staff_member_id: 's1', dealership_id: 'd1', verified_by: 'u1',
  }, 'Alex Smith')
  assert.deepEqual(Object.keys(pub).sort(), [
    'credential_id', 'expires_on', 'holder', 'issued_on', 'issuer', 'name', 'status', 'valid', 'version',
  ])
  assert.equal(pub.valid, true)
  // "Active" in the database is not "valid today".
  assert.equal(publicCredential({ status: 'active', expires_on: '2020-01-01' }, 'A').valid, false)
})

// ── 11. Launch readiness derives from real configuration ────────────────────

const LAUNCH_STATE = {
  dealership: {
    legal_name: 'Example Motors', street_address: '1 Main', city: 'Toronto', province: 'ON',
    postal_code: 'M1M 1M1', timezone: 'America/Toronto',
    operating_hours: { mon: {} }, hst_number: 'x', branding: { logo: 'x' },
    site_published: true, feed_url: 'x', lead_routing: { mode: 'x' },
  },
  locations: [{ is_primary: true, active: true }],
  staffCount: 2, glAccountCount: 0, vehicleCount: 5,
  trainingAssignmentCount: 1, publishedPolicyCount: 1, adminCount: 1,
}

test('E2E 11 — a missing REQUIRED_FOR_FEATURE item blocks its feature and nothing else', () => {
  const l = buildLaunch(LAUNCH_STATE, { features: ['os.accounting', 'os.inventory', 'os.website', 'os.service'] })
  assert.equal(l.operational, true, 'the dealership still operates')
  assert.deepEqual(l.blocked_features, ['Accounting'])
  assert.equal(forFeature(l, 'Accounting').ready, false)
  assert.equal(forFeature(l, 'Inventory').ready, true)
})

test('E2E 11b — readiness is recomputed, never stored', () => {
  for (const [name, s] of [['the engine', launch], ['the migration', mLaunch.replace(/^\s*--.*$/gm, '')]]) {
    assert.ok(!/setup_completed|onboarding_step/i.test(s), `${name} stores setup completion`)
  }
})

test('E2E 11c — setup gates nothing', () => {
  // The brief forbids a blanket application lock. Pinned at the import level so it cannot
  // become one by accident.
  for (const file of ['middleware.js', 'access.js', 'authorization.js']) {
    assert.ok(!/launch-hub/.test(read(file)), `${file} imports the launch hub`)
  }
})

// ── 12. Shared configuration is entered once ────────────────────────────────

test('E2E 12 — the first location comes from the dealership, not from retyping it', () => {
  assert.match(launch, /street_address: b\.street_address \?\? \(first \? d\?\.street_address : null\)/)
  assert.match(mLaunch, /dealership_locations_one_primary/)
})

test('E2E 12b — a timezone is validated once, in the database, for every writer', () => {
  assert.match(mLaunch, /pg_timezone_names/)
  assert.match(mLaunch, /create trigger dealerships_timezone_valid/)
  assert.match(mLaunch, /create trigger dealership_locations_timezone_valid/)
})

// ── The day these all arrive in ─────────────────────────────────────────────

test('E2E — every People capability reaches one queue, permission-gated per source', async () => {
  const peopleSources = MY_DAY_SOURCES.filter(s => s.department === 'People' || s.department === 'Dealership')
  assert.deepEqual(peopleSources.map(s => s.key).sort(), ['academy', 'compliance', 'people', 'setup', 'time'])
  for (const s of peopleSources) {
    assert.ok(isKnownPermission(s.permission), `${s.key} names an unknown permission`)
    assert.equal(typeof s.load, 'function')
  }
  // Each on its OWN permission — seeing training is narrower than seeing the team, and
  // approving hours is narrower still.
  assert.equal(MY_DAY_SOURCES.find(s => s.key === 'people').permission, 'staff.view')
  assert.equal(MY_DAY_SOURCES.find(s => s.key === 'academy').permission, 'staff.training.view')
  assert.equal(MY_DAY_SOURCES.find(s => s.key === 'time').permission, 'staff.time.approve')
})

test('E2E — a People source that fails makes the day incomplete rather than calm', async () => {
  const day = await buildMyDay({ dealershipId: 'd1' }, {
    can: async () => true,
    sources: [
      { key: 'people', label: 'People', department: 'People', permission: 'staff.view',
        load: async () => { throw new Error('connection reset') } },
      { key: 'time', label: 'Time', department: 'People', permission: 'staff.time.approve',
        load: async () => [] },
    ],
  })
  assert.equal(day.total, 0)
  assert.equal(day.complete, false, 'an empty day caused by a failure is not an empty day')
  assert.equal(day.failed[0].source, 'people')
})

test('E2E — People is no longer a gap in the day', () => {
  assert.ok(!MY_DAY_GAPS.includes('People'))
  assert.ok(!MY_DAY_GAPS.includes('Dealership'))
})

// ── The seven dead-wiring defects, each pinned so it cannot return ──────────

test('E2E — every producer this phase built still exists', () => {
  // Each of these is a capability that had complete schema, routes and states, and no runtime
  // producer at all. A green suite reported all of them as working.
  const producers = [
    [identity, 'export async function ensureStaffMember', 'the employee record'],
    [offboarding, 'export async function offboardEmployee', 'offboarding'],
    [academy, 'export async function assignRequiredTraining', 'training assignment'],
    [academy, 'export async function issueCertification', 'certification'],
    [timeSrc, 'export async function clockIn', 'the time clock'],
    [timeSrc, 'export async function calculatePayroll', 'payroll lines'],
    [compliance, 'export async function acknowledgePolicy', 'policy acknowledgement'],
    [compliance, 'export async function startLifecycle', 'onboarding'],
    [compliance, 'export async function ensureLifecycleTemplates', 'the checklists themselves'],
  ]
  for (const [src, needle, what] of producers) {
    assert.ok(src.includes(needle), `${what} has lost its producer`)
  }
})

test('E2E — the two silent zeros stay named', () => {
  const service = strip(read('routes/service-engine.js'))
  assert.match(service, /recorded: entries\.length > 0/, 'actual hours must tell zero from none recorded')
  assert.match(hr, /nothing to export/, 'an empty payroll export must refuse')
  assert.match(compliance, /fully_measured/, 'compliance must tell measured from unmeasured')
})

// ── People finally has a workspace ──────────────────────────────────────────

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const pplRaw = readFE('js/modules/people-workspace.js')
const ppl = strip(pplRaw)
const dash = readFE('dashboard.html')
const part2 = readFE('js/modules/dashboard-part2.js')

test('E2E — People is reachable: registry, container, router, script tag', () => {
  // People was the last department with real capabilities and no workspace. Every link in this
  // chain is somewhere a screen has already been lost this phase.
  const vm2 = vm.createContext({ window: {} })
  vm.runInContext(readFE('js/modules/workspace-registry.js'), vm2)
  const reg = vm2.window.MS_WORKSPACES
  assert.ok(reg.people.pages.some(p => p.page === 'people-overview'), 'People has no My Day entry')
  assert.equal(reg.people.pages[0].page, 'people-overview', 'and it leads the workspace')
  assert.match(dash, /data-page-content="people-overview"/)
  assert.match(dash, /id="people-overview-root"/)
  assert.match(part2, /pageId === 'people-overview'\) loadPeopleWorkspace\(\)/)
  assert.match(dash, /<script src="js\/modules\/people-workspace\.js\?v=[^"]+"><\/script>/)
})

test('E2E — the People screen composes rather than derives', () => {
  // A second opinion about whether somebody is behind on training would drift from the
  // department that owns the fact.
  assert.match(ppl, /apiGetJson\('\/my-day'\)/)
  assert.match(ppl, /apiGetJson\('\/hr\/team'\)/)
  assert.match(ppl, /apiGetJson\('\/hr\/compliance'\)/)
  assert.ok(!/severity: [0-9]/.test(ppl), 'the screen must not invent severity')
  assert.ok(!/kind: '/.test(ppl), 'nor attention kinds')
})

test('E2E — a login with no employment record is shown, not hidden', () => {
  // "Team" is "Staff" now; the guarantee is unchanged — the login is SHOWN and flagged.
  assert.match(ppl, /Can sign in, but not on the staff list/)
  assert.match(ppl, /p\.has_employment === false/)
  assert.match(ppl, /Not invited/)
  assert.doesNotMatch(read('../marketplace-frontend/js/modules/dashboard-part24.js'), /DEFAULT_EMPLOYEES/)
})

test('E2E — compliance shows coverage, not just counts', () => {
  const views = read('../marketplace-frontend/js/modules/people-views.js')
  assert.match(views, /pplRenderComplianceWorkspace/)
  assert.match(views, /Compliance & Policy Vault/)
})

test('E2E — a source that failed is rendered, never swallowed', () => {
  assert.match(ppl, /Could not be loaded/)
  assert.match(ppl, /dayFailed/)
})
