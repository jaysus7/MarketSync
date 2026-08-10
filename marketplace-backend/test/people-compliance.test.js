import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 7 PR 7.5 — compliance that can tell "nothing is wrong" from "nothing was set up".
//
// The database rules — published text immutable, one open lifecycle per person, an
// acknowledgement that must record what was read — are proved against staging by the probes
// in docs/PHASE7_PEOPLE_LAUNCH.md, because CI has no Supabase.

import { LIFECYCLE_TEMPLATES, LIFECYCLE_SYSTEM_KEYS } from '../lifecycle-templates.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const src = read('routes/people-compliance.js')
const compliance = strip(src)
const migration = read('migrations/2026-08-10-phase7-compliance.sql')
const hr = strip(read('routes/hr.js'))
const server = read('server.js')

// ── An absence of records is not evidence of compliance ─────────────────────

test('coverage reports which areas have records behind them', () => {
  // The whole point of the slice: a zero on a dashboard whose table has never been written to
  // means "not measured", not "nothing wrong".
  assert.match(compliance, /export async function coverage/)
  assert.match(compliance, /fully_measured: unmeasured\.length === 0/)
  assert.match(compliance, /absence of evidence, not evidence of compliance/)
})

test('a count that FAILS is null, never zero', () => {
  // An unreadable table must not read as an empty one — that is the same defect one level up.
  assert.match(compliance, /return error \? null : \(n \?\? 0\)/)
  assert.match(compliance, /records == null \? 'could not be read'/)
})

test('every counter on the compliance dashboard has a coverage area', () => {
  for (const area of ['policies', 'acknowledgements', 'onboarding', 'training', 'documents']) {
    assert.match(compliance, new RegExp(`area\\('${area}'`), `${area} has no coverage answer`)
  }
})

test('the compliance dashboard ships coverage alongside its counts', () => {
  assert.match(hr, /coverage: await coverage\(req\.dealershipId\)/)
  assert.match(hr, /import \{ coverage \} from '\.\/people-compliance\.js'/)
})

test('an unmeasured dealership is raised in My Day rather than reading as clear', async () => {
  const { MY_DAY_SOURCES } = await import('../routes/my-day.js')
  const source = MY_DAY_SOURCES.find(s => s.key === 'compliance')
  assert.ok(source, 'Compliance does not reach My Day')
  assert.equal(source.permission, 'staff.compliance.view')
  assert.match(compliance, /compliance_not_measured/)
})

// ── An acknowledgement is evidence ──────────────────────────────────────────

test('only the person it was assigned to can acknowledge', () => {
  // A signature somebody else supplied is not a signature.
  assert.match(compliance, /Only the person it was assigned to can acknowledge/)
  assert.match(compliance, /staff\.id !== ack\.staff_member_id/)
})

test('the acknowledging user is the caller, never a parameter', () => {
  const fn = compliance.match(/export async function acknowledgePolicy[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'acknowledgePolicy not found')
  assert.match(fn, /acknowledged_by_user_id: userId/)
  assert.ok(!/staffMemberId|staff_member_id:/.test(fn.split('update({')[1] || ''),
    'the acknowledgement must not let a caller name whose signature it is')
})

test('an acknowledgement records the exact text that was agreed to', () => {
  assert.match(compliance, /acknowledged_checksum_sha256: checksum/)
  assert.match(compliance, /ack\.version\?\.checksum_sha256/)
  // …and the database refuses one without it, so a future writer cannot skip it.
  assert.match(migration, /staff_policy_ack_records_what_was_read[\s\S]{0,200}acknowledged_checksum_sha256 is not null/)
})

test('no second, weaker immutability guard was added beside the working one', () => {
  // `protect_staff_policy_version()` already exists and is stricter than the trigger this
  // migration originally added: published AND retired are fully immutable, and it computes the
  // checksum itself. A duplicate weaker guard is worse than none — the next reader has to work
  // out which is authoritative. This pins the duplicate out.
  // Asserted on the SQL, not on the prose explaining it — a comment can be reworded, and
  // pinning wording is how a test starts failing for reasons nobody cares about.
  const sql = migration.replace(/^\s*--.*$/gm, '')
  assert.ok(!/create trigger staff_policy_versions_immutable/.test(sql))
  assert.ok(!/reject_published_policy_edit/.test(sql), 'the duplicate guard must not be re-added')
  assert.ok(!/create or replace function[\s\S]{0,80}policy_version/i.test(sql),
    'this migration must not define its own policy-version trigger at all')
})

test('the checksum is the database\'s, not the route\'s', () => {
  // The trigger computes it on publish and overrides anything supplied. Sending a value that
  // gets silently replaced is how two different checksums for one policy end up in circulation.
  assert.ok(!/checksum_sha256: sha256\(/.test(compliance), 'the route must not send a checksum')
  assert.ok(!/createHash/.test(compliance))
  assert.ok(!/req\.body\?\.checksum/.test(compliance), 'and a caller certainly must not supply one')
  // It is read back from what the database stored.
  assert.match(compliance, /ack\.version\?\.checksum_sha256/)
})

test('a version with no text cannot be published', () => {
  assert.match(compliance, /There is nothing to acknowledge otherwise/)
})

test('a draft version cannot be assigned', () => {
  assert.match(compliance, /A draft version cannot be assigned/)
})

test('a terminated employee is not asked to acknowledge', () => {
  assert.match(compliance, /in\('employment_status', \['invited', 'active', 'on_leave'\]\)/)
})

test('assigning twice chases rather than duplicating', () => {
  assert.match(compliance, /onConflict: 'policy_version_id,staff_member_id', ignoreDuplicates: true/)
})

// ── Onboarding finally has a producer ───────────────────────────────────────

test('the core templates are checked in, with the keys that make seeding idempotent', () => {
  assert.deepEqual(LIFECYCLE_SYSTEM_KEYS.sort(), ['core_employee_offboarding', 'core_employee_onboarding'])
  for (const tpl of LIFECYCLE_TEMPLATES) {
    assert.ok(tpl.tasks.length >= 9, `${tpl.system_key} has too few tasks to mean anything`)
    const keys = tpl.tasks.map(t => t.task_key)
    assert.equal(new Set(keys).size, keys.length, `${tpl.system_key} has duplicate task keys`)
    for (const t of tpl.tasks) {
      assert.ok(t.title && t.description, `${t.task_key} is missing title or description`)
      assert.ok(['employee', 'manager', 'specific_staff', 'unassigned'].includes(t.assignee_type),
        `${t.task_key} has an assignee_type the database will refuse`)
      assert.ok(t.due_offset_days >= -365 && t.due_offset_days <= 3650, `${t.task_key} due offset out of range`)
    }
  }
})

test('every template has at least one required task', () => {
  // A checklist where nothing is required completes itself the moment it starts.
  for (const tpl of LIFECYCLE_TEMPLATES) {
    assert.ok(tpl.tasks.some(t => t.required), `${tpl.system_key} requires nothing`)
  }
})

test('a dealership with no templates gets them, keyed so re-running corrects rather than duplicates', () => {
  // Five dealerships were seeded once; every dealership created since had none, so onboarding
  // could never be started there — the templates themselves had no producer.
  assert.match(compliance, /export async function ensureLifecycleTemplates/)
  assert.match(compliance, /onConflict: 'template_id,task_key'/)
  assert.match(migration, /staff_lifecycle_templates_system_key_uk/)
  assert.match(migration, /staff_lifecycle_template_tasks_key_uk/)
})

test('starting a lifecycle copies the tasks rather than referencing the template', () => {
  // Editing a template later must not rewrite a checklist somebody is working through.
  const fn = compliance.match(/export async function startLifecycle[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /title: t\.title, description: t\.description/)
  assert.match(fn, /template_task_id: t\.id/, 'and it still records where the task came from')
})

test('an assignment with no tasks is refused, not created', () => {
  // It would report as "onboarding started" and ask for nothing.
  assert.match(compliance, /so starting it would ask for nothing/)
  // And if the task insert fails, the assignment does not survive.
  assert.match(compliance, /from\('staff_lifecycle_assignments'\)\.delete\(\)/)
})

test('one open lifecycle per person per type', () => {
  assert.match(compliance, /already has \$\{lifecycleType\} in progress/)
  assert.match(migration, /staff_lifecycle_one_open_per_type[\s\S]{0,200}status <> 'completed' and status <> 'cancelled'/)
})

test('an assignment completes when its REQUIRED tasks are done', () => {
  // An optional task left undone is not a reason to hold somebody's onboarding open.
  assert.match(compliance, /s\.required && s\.status !== 'completed'/)
  assert.match(compliance, /assignment_complete: outstanding === 0/)
})

test('a blocked task must carry its reason', () => {
  assert.match(compliance, /status: 'blocked', blocked_reason:/)
})

test('a lifecycle assignment cannot name another dealership\'s employee', () => {
  assert.match(migration, /staff_lifecycle_assignments_staff_same_dealer[\s\S]{0,220}references public\.staff_members\(id, dealership_id\)/)
})

// ── Wiring and gating ───────────────────────────────────────────────────────

test('compliance is registered on the server', () => {
  assert.match(server, /import \{ registerPeopleCompliance \} from '\.\/routes\/people-compliance\.js'/)
  assert.match(server, /^registerPeopleCompliance\(app\)/m)
})

test('every compliance route is authenticated and permission-gated', () => {
  const routes = [...compliance.matchAll(/app\.(get|post)\('(\/hr\/[^']+)'([^)]*)/g)]
  assert.ok(routes.length >= 10, `expected the compliance routes, found ${routes.length}`)
  for (const [, , path, rest] of routes) {
    assert.ok(rest.includes('requireAuth'), `${path} is not authenticated`)
    assert.ok(/can(View|Manage|Self|PolicyManage)|requirePermission/.test(rest), `${path} is not permission-gated`)
  }
})

test('authoring a policy or publishing its text requires MFA', () => {
  for (const route of ["/hr/policies", "/hr/policies/:id/versions", "/hr/policies/versions/:id/assign", "/hr/lifecycle/start"]) {
    const m = compliance.match(new RegExp(`app\\.post\\('${route.replace(/[/:]/g, c => '\\' + c)}'([^)]*)`))
    assert.ok(m, `${route} not found`)
    assert.ok(m[1].includes('requireMfa'), `${route} does not require MFA`)
  }
})

test('acknowledging is self-service and does NOT require a manager permission', () => {
  // Requiring staff.compliance.manage to sign your own policy would mean nobody could.
  const m = compliance.match(/app\.post\('\/hr\/policies\/acknowledgements\/:id\/acknowledge'([^)]*)/)
  assert.ok(m, 'the acknowledge route must exist')
  assert.ok(m[1].includes('canSelf'), 'acknowledging must be self-service')
  assert.ok(!/canManage|canPolicyManage/.test(m[1]), 'a manager permission must not gate your own signature')
})

test('a person sees the text they would be agreeing to before they agree', () => {
  assert.match(compliance, /app\.get\('\/hr\/policies\/mine'/)
  assert.match(compliance, /content_text/)
})
