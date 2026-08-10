import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 7 PR 7.3 — Academy.
//
// `buildPath`, `courseAppliesTo`, `curriculaFor` and `publicCredential` are pure, so these run
// the REAL functions over real curriculum data rather than asserting that source text exists.
// Per AGENTS.md A19 that is the difference between proving a capability works and proving code
// was written. The parts that must reach a database — assignment and issuing — are proved
// against staging by the probe recorded in docs/PHASE7_PEOPLE_LAUNCH.md, because CI has no
// Supabase.

import {
  curriculaFor, courseAppliesTo, buildPath, publicCredential,
} from '../routes/academy.js'
import { COURSES, CERTIFICATIONS, COURSE_KEYS, ROLE_CURRICULUM } from '../academy-curriculum.js'

const BE = new URL('../', import.meta.url)
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const academy = strip(readFileSync(new URL('routes/academy.js', BE), 'utf8'))
const migration = readFileSync(new URL('migrations/2026-08-10-phase7-academy.sql', BE), 'utf8')
const server = readFileSync(new URL('server.js', BE), 'utf8')

// The catalog as the database holds it: `id` is what assignments key on.
const catalog = COURSES.map((c, i) => ({
  id: `c${i}`, course_key: c.course_key, title: c.title, description: c.description,
  department: c.department, level: c.level, estimated_minutes: c.estimated_minutes,
  role_keys: [], active: true, sort: c.sort,
}))
const byKey = (k) => catalog.find(c => c.course_key === k)
const pathFor = (role, department, assignments = []) =>
  buildPath(catalog, assignments, { role, curricula: curriculaFor({ role, department }) })

// ── The curriculum is coherent ──────────────────────────────────────────────

test('every certification requirement names a course that exists', () => {
  for (const cert of CERTIFICATIONS) {
    for (const key of cert.courses) {
      assert.ok(COURSE_KEYS.has(key), `${cert.certification_key} requires missing course ${key}`)
    }
  }
})

test('every role maps to departments that have courses', () => {
  const departments = new Set(COURSES.map(c => c.department).filter(Boolean))
  for (const [role, depts] of Object.entries(ROLE_CURRICULUM)) {
    for (const d of depts) assert.ok(departments.has(d), `role ${role} maps to empty department ${d}`)
  }
})

test('course keys are unique', () => {
  assert.equal(COURSE_KEYS.size, COURSES.length)
})

test('every course sits at a level the database will accept', () => {
  const allowed = new Set(['required', 'foundation', 'advanced', 'reference'])
  for (const c of COURSES) assert.ok(allowed.has(c.level), `${c.course_key} has level ${c.level}`)
})

// ── Your Path is what this person needs, not the whole library ──────────────

test('a salesperson gets Sales and the universal courses, and nothing from Service', () => {
  const path = pathFor('SALES_REP', 'Sales')
  const keys = [...path.required, ...path.foundations, ...path.advanced].map(c => c.course_key)
  assert.ok(keys.includes('sales_lead_workflow'))
  assert.ok(keys.includes('ms_getting_started'), 'universal courses apply to everyone')
  assert.ok(!keys.some(k => k.startsWith('svc_')), 'Service material is not this person\'s path')
  assert.ok(!keys.some(k => k.startsWith('acct_')))
})

test('a technician posted to Service gets Service, not Sales', () => {
  const path = pathFor('SERVICE', 'Service')
  const keys = [...path.required, ...path.foundations].map(c => c.course_key)
  assert.ok(keys.includes('svc_ro_workflow'))
  assert.ok(!keys.includes('sales_lead_workflow'))
})

test('the department somebody is posted to is added to their role curriculum', () => {
  // A SALES_REP working the Service drive sees both — employment, not just job title.
  const keys = pathFor('SALES_REP', 'Service').required.map(c => c.course_key)
  assert.ok(keys.includes('sales_lead_workflow'))
  assert.ok(keys.includes('svc_ro_workflow'))
})

test('a role with no curriculum still gets the universal required courses', () => {
  // Nobody falls through to an empty path — "empty success is a failure mode".
  const path = pathFor('SOMETHING_UNMAPPED', null)
  assert.ok(path.required.length > 0)
  assert.deepEqual(path.required.map(c => c.course_key).sort(), ['ms_getting_started', 'ms_privacy_basics'])
})

test('reference material never appears in a path', () => {
  const withReference = [...catalog, {
    id: 'ref1', course_key: 'ref_thing', title: 'Library item', department: 'Sales',
    level: 'reference', role_keys: [], active: true,
  }]
  const path = buildPath(withReference, [], { role: 'SALES_REP', curricula: ['Sales'] })
  const keys = [...path.required, ...path.foundations, ...path.advanced].map(c => c.course_key)
  assert.ok(!keys.includes('ref_thing'), 'the library is searchable, never pushed')
})

test('an inactive course drops out of the path', () => {
  const deactivated = catalog.map(c => c.course_key === 'sales_lead_workflow' ? { ...c, active: false } : c)
  const path = buildPath(deactivated, [], { role: 'SALES_REP', curricula: ['Sales'] })
  assert.ok(!path.required.some(c => c.course_key === 'sales_lead_workflow'))
})

test('a course that names roles reaches only those roles', () => {
  const course = { id: 'x', course_key: 'x', level: 'required', department: null, role_keys: ['MANAGER'], active: true }
  assert.equal(courseAppliesTo(course, { role: 'MANAGER', curricula: [] }), true)
  assert.equal(courseAppliesTo(course, { role: 'SALES_REP', curricula: [] }), false)
})

// ── Status, overdue and the number a person can act on ──────────────────────

test('assignment status flows through, and unassigned reads as not_started', () => {
  const assignments = [{ id: 'a1', course_id: byKey('ms_getting_started').id, status: 'completed', completed_at: '2026-01-01' }]
  const path = pathFor('SALES_REP', 'Sales', assignments)
  const started = path.required.find(c => c.course_key === 'ms_getting_started')
  const other = path.required.find(c => c.course_key === 'sales_lead_workflow')
  assert.equal(started.status, 'completed')
  assert.equal(started.assignment_id, 'a1')
  assert.equal(other.status, 'not_started')
  assert.equal(other.assignment_id, null)
})

test('overdue is derived from the date, not from a status somebody set', () => {
  const past = new Date(Date.now() - 86400000).toISOString()
  const assignments = [{ id: 'a1', course_id: byKey('sales_lead_workflow').id, status: 'assigned', due_at: past }]
  const path = pathFor('SALES_REP', 'Sales', assignments)
  const overdue = path.required.find(c => c.course_key === 'sales_lead_workflow')
  assert.equal(overdue.overdue, true)
  assert.equal(path.overdue_required, 1)
  assert.equal(path.required[0].course_key, 'sales_lead_workflow', 'overdue sorts to the top')
})

test('a completed course past its due date is not overdue', () => {
  const past = new Date(Date.now() - 86400000).toISOString()
  const assignments = [{ id: 'a1', course_id: byKey('sales_lead_workflow').id, status: 'completed', due_at: past, completed_at: past }]
  const path = pathFor('SALES_REP', 'Sales', assignments)
  assert.equal(path.overdue_required, 0)
})

test('outstanding counts what is left, and a waiver counts as settled', () => {
  const before = pathFor('SALES_REP', 'Sales')
  const assignments = [
    { id: 'a1', course_id: byKey('ms_getting_started').id, status: 'completed' },
    { id: 'a2', course_id: byKey('ms_privacy_basics').id, status: 'waived' },
  ]
  const after = pathFor('SALES_REP', 'Sales', assignments)
  assert.equal(after.outstanding_required, before.outstanding_required - 2)
})

// ── A credential requires the work ──────────────────────────────────────────

test('issuing refuses unless every required course is completed', () => {
  // The refusal is the whole point of the certification engine: a credential the dealership
  // publishes must be one it can stand behind.
  assert.match(academy, /outstanding\.length/)
  assert.match(academy, /ok: false, outstanding/)
})

test('a certification with no recorded requirements cannot be issued', () => {
  assert.match(academy, /requiredKeys\.length/)
  assert.match(academy, /no requirements recorded/)
})

test('completion is read from the database, never from the caller', () => {
  // `status = completed` on staff_training_assignments is the only accepted evidence.
  assert.match(academy, /staff_training_assignments[\s\S]{0,400}?eq\('status', 'completed'\)/)
  assert.ok(!/req\.body[\s\S]{0,80}complet/i.test(academy), 'a caller must not be able to claim completion')
})

test('a credential id is unguessable, not sequential', () => {
  assert.match(academy, /randomToken\(/)
  assert.ok(!/Math\.random/.test(academy))
})

// ── What the public may see ─────────────────────────────────────────────────

const CRED = {
  credential_id: 'MS-SALES-abc', certification_name: 'MarketSync Certified Sales Professional',
  certification_version: 1, issued_on: '2026-01-01', expires_on: '2028-01-01', status: 'active',
  staff_member_id: 'staff-1', dealership_id: 'd1', verified_by: 'u1',
}

test('a public credential exposes the credential and nothing about the employee record', () => {
  const pub = publicCredential(CRED, 'Alex Smith')
  assert.equal(pub.holder, 'Alex Smith')
  assert.equal(pub.name, CRED.certification_name)
  assert.equal(pub.valid, true)
  // This URL is shared on LinkedIn. It must not become a way to read somebody's HR file.
  for (const leaked of ['dealership_id', 'staff_member_id', 'verified_by', 'email', 'employee_number']) {
    assert.ok(!(leaked in pub), `public credential leaks ${leaked}`)
  }
  assert.deepEqual(Object.keys(pub).sort(), [
    'credential_id', 'expires_on', 'holder', 'issued_on', 'issuer', 'name', 'status', 'valid', 'version',
  ])
})

test('an expired credential says so, whatever the stored status claims', () => {
  const pub = publicCredential({ ...CRED, expires_on: '2020-01-01' }, 'Alex Smith')
  assert.equal(pub.valid, false)
  assert.equal(pub.status, 'expired')
})

test('a revoked credential is not valid', () => {
  const pub = publicCredential({ ...CRED, status: 'revoked' }, 'Alex Smith')
  assert.equal(pub.valid, false)
})

test('a credential with no expiry stays valid', () => {
  const pub = publicCredential({ ...CRED, expires_on: null }, 'Alex Smith')
  assert.equal(pub.valid, true)
  assert.equal(pub.expires_on, null)
})

// ── Wiring: the routes exist, are reachable, and are gated ──────────────────

test('the Academy is registered on the server', () => {
  // The producer/consumer check. A route module nobody calls is the defect class A19 names.
  assert.match(server, /import \{ registerAcademy \} from '\.\/routes\/academy\.js'/)
  assert.match(server, /^registerAcademy\(app\)/m)
})

test('every Academy route except public verification requires authentication', () => {
  const routes = [...academy.matchAll(/app\.(get|post)\('(\/[^']+)'([^)]*)/g)]
  assert.ok(routes.length >= 8, `expected the Academy routes, found ${routes.length}`)
  for (const [, , path, rest] of routes) {
    if (path.startsWith('/verify/')) {
      assert.ok(!rest.includes('requireAuth'), 'verification is public by design')
      continue
    }
    assert.ok(rest.includes('requireAuth'), `${path} is not authenticated`)
    assert.ok(/requirePermission|can(View|Manage)/.test(rest), `${path} is not permission-gated`)
  }
})

test('issuing a credential and assigning training require MFA', () => {
  assert.match(academy, /app\.post\('\/academy\/certifications\/:key\/issue', requireAuth, requireMfa/)
  assert.match(academy, /app\.post\('\/academy\/assign-required\/:staffId', requireAuth, requireMfa/)
})

test('team views are gated separately from a person seeing their own path', () => {
  assert.match(academy, /canViewSelf = requirePermission\('staff\.training\.self'\)/)
  assert.match(academy, /canViewTeam = requirePermission\('staff\.training\.view'\)/)
  assert.match(academy, /canManage = requirePermission\('staff\.training\.manage'\)/)
  assert.match(academy, /app\.get\('\/academy\/team', requireAuth, canViewTeam/)
})

test('every catalog read is scoped to the global catalog plus this dealership', () => {
  // A missing scope here would show one dealership another's private courses.
  const reads = [...academy.matchAll(/from\('staff_training_courses'\)/g)]
  const scoped = [...academy.matchAll(/catalogFilter\(/g)]
  assert.ok(scoped.length >= reads.length,
    `${reads.length} catalog reads but only ${scoped.length} are tenant-scoped`)
  assert.match(academy, /dealership_id\.is\.null,dealership_id\.eq\.\$\{dealershipId\}/)
})

test('academy attention only nags about required work', () => {
  assert.match(academy, /training_overdue/)
  assert.match(academy, /certification_expiring/)
  assert.ok(!/recommended/i.test(academy.split('academyAttention')[1]?.slice(0, 1200) || ''),
    'a recommended course is not something to be nagged about')
})

// ── The migration keeps the guarantee it replaced ───────────────────────────

test('the global catalog cannot be duplicated', () => {
  assert.match(migration, /nulls not distinct/)
})

test('the composite tenant FK is replaced by a check that still refuses another dealership', () => {
  // Dropping `staff_training_course_same_dealer` is what makes a global course assignable at
  // all; dropping it WITHOUT a replacement would let a dealership assign a rival's private
  // course. Both halves have to stay together.
  assert.match(migration, /drop constraint if exists staff_training_course_same_dealer/)
  assert.match(migration, /staff_training_course_tenant_check/)
  assert.match(migration, /course_dealership is not null and course_dealership <> new\.dealership_id/)
  assert.match(migration, /create trigger staff_training_assignments_tenant/)
})

test('a course cannot change owner after assignments exist', () => {
  assert.match(migration, /staff_training_course_owner_frozen/)
  assert.match(migration, /create trigger staff_training_courses_owner_frozen/)
})

test('one live credential per person per certification, and credential ids are globally unique', () => {
  assert.match(migration, /staff_certifications_one_active_per_key[\s\S]{0,200}status = 'active'/)
  assert.match(migration, /staff_certifications_credential_uk[\s\S]{0,120}credential_id is not null/)
})

// ── My Day integration ──────────────────────────────────────────────────────

test('Academy is a My Day source, gated on training visibility rather than staff.view', async () => {
  const { MY_DAY_SOURCES } = await import('../routes/my-day.js')
  const academySource = MY_DAY_SOURCES.find(s => s.key === 'academy')
  assert.ok(academySource, 'Academy does not reach My Day')
  assert.equal(academySource.permission, 'staff.training.view')
  assert.equal(typeof academySource.load, 'function')
})

// ── The sync script is the producer, and it refuses to run anywhere unsafe ──

test('the sync script refuses to run against anything but staging', () => {
  const sync = readFileSync(new URL('scripts/academy-sync.mjs', BE), 'utf8')
  assert.match(sync, /hpxnjbdiaaoopxeayfen/)
  assert.match(sync, /REFUSING TO RUN/)
})

test('the sync script deactivates retired courses rather than deleting them', () => {
  const sync = readFileSync(new URL('scripts/academy-sync.mjs', BE), 'utf8')
  // Completion history points at those rows. Tidying the catalog must not destroy somebody's
  // training record.
  assert.match(sync, /update\(\{ active: false \}\)/)
  assert.ok(!/from\('staff_training_courses'\)[\s\S]{0,120}\.delete\(\)/.test(sync))
})

test('the sync script verifies what landed instead of trusting that the writes returned', () => {
  const sync = readFileSync(new URL('scripts/academy-sync.mjs', BE), 'utf8')
  assert.match(sync, /count: 'exact', head: true/)
  assert.match(sync, /expected at least \$\{COURSES\.length\} global courses/)
})
