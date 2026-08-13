/**
 * Push `academy-curriculum.js` into the database (Phase 7 PR 7.3).
 *
 * The curriculum is checked in so it is reviewable in a diff; the database is what Your Path,
 * assignment and certification actually read. This is the one thing that connects them, and
 * without it every course, requirement and credential in this slice is dead wiring — schema and
 * routes with nothing behind them, which is precisely the defect class AGENTS.md A19 exists for.
 *
 *   node scripts/academy-sync.mjs            # apply
 *   node scripts/academy-sync.mjs --dry-run  # show what would change
 *
 * Idempotent: courses key on (dealership_id, course_key, version_number) with `nulls not
 * distinct`, so re-running updates the global rows rather than growing a second copy.
 *
 * REFUSES TO RUN AGAINST PRODUCTION. Phase 7 migrations are staging-only until 9A convergence,
 * and a curriculum written into production ahead of its schema would be worse than nothing.
 */
import { supabaseAdmin } from '../shared.js'
import { COURSES, CERTIFICATIONS, COURSE_KEYS, ROLE_CURRICULUM } from '../academy-curriculum.js'

const DRY = process.argv.includes('--dry-run')
const url = process.env.SUPABASE_URL || ''
if (!/hpxnjbdiaaoopxeayfen/.test(url)) {
  console.error(`REFUSING TO RUN: SUPABASE_URL is not staging (${url.slice(0, 40)}…).`)
  process.exit(2)
}

const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1) }

// ── A certification that names a course nobody wrote can never be earned ────
// Better to refuse the whole sync than to publish a credential with an unreachable requirement.
for (const cert of CERTIFICATIONS) {
  const missing = cert.courses.filter(k => !COURSE_KEYS.has(k))
  if (missing.length) fail(`${cert.certification_key} requires course(s) that do not exist: ${missing.join(', ')}`)
}
// Every department a curriculum can route somebody to must exist as a course department, or a
// role maps to nothing and that person's path silently comes back empty.
const courseDepartments = new Set(COURSES.map(c => c.department).filter(Boolean))
for (const [role, depts] of Object.entries(ROLE_CURRICULUM)) {
  const missing = depts.filter(d => !courseDepartments.has(d))
  if (missing.length) fail(`role ${role} maps to department(s) with no courses: ${missing.join(', ')}`)
}

console.log(`\nAcademy sync${DRY ? ' (dry run)' : ''} · ${COURSES.length} courses · ${CERTIFICATIONS.length} certifications\n`)

// ── Courses ─────────────────────────────────────────────────────────────────
// `role_keys` stays empty for a department course: `courseAppliesTo` already includes it via the
// person's curricula, and naming roles here would exclude anyone posted to that department under
// a role the map does not mention.
const courseRows = COURSES.map(c => ({
  dealership_id: null,
  course_key: c.course_key,
  version_number: 1,
  title: c.title,
  description: c.description,
  category: c.department ? c.department.toLowerCase().replace(/[^a-z]+/g, '_') : 'general',
  department: c.department,
  level: c.level,
  role_keys: [],
  estimated_minutes: c.estimated_minutes,
  sort: c.sort,
  delivery_type: 'self_guided',
  active: true,
  updated_at: new Date().toISOString(),
}))

const { data: existingCourses } = await supabaseAdmin.from('staff_training_courses')
  .select('id, course_key, title, level').is('dealership_id', null)
const before = new Map((existingCourses || []).map(c => [c.course_key, c]))
console.log(`  global courses already present: ${before.size}`)

if (!DRY) {
  const { error } = await supabaseAdmin.from('staff_training_courses')
    .upsert(courseRows, { onConflict: 'dealership_id,course_key,version_number' })
  if (error) fail(`courses: ${error.message}`)
}
for (const r of courseRows) {
  const was = before.get(r.course_key)
  if (!was) console.log(`  + ${r.course_key} (${r.level})`)
  else if (was.title !== r.title || was.level !== r.level) console.log(`  ~ ${r.course_key} (${was.level} → ${r.level})`)
}

// A global course we no longer ship is deactivated, never deleted: assignments and completion
// history point at it, and destroying somebody's training record to tidy a catalog is not a
// trade this system makes.
const retired = (existingCourses || []).filter(c => !COURSE_KEYS.has(c.course_key))
if (retired.length) {
  console.log(`  retiring ${retired.length} course(s) no longer in the curriculum`)
  if (!DRY) {
    const { error } = await supabaseAdmin.from('staff_training_courses')
      .update({ active: false }).in('id', retired.map(c => c.id))
    if (error) fail(`retire: ${error.message}`)
  }
}

// ── Certifications and their requirements ───────────────────────────────────
for (const cert of CERTIFICATIONS) {
  const row = {
    certification_key: cert.certification_key,
    name: cert.name,
    department: cert.department,
    description: cert.description,
    version_number: 1,
    validity_months: cert.validity_months,
    active: true,
    updated_at: new Date().toISOString(),
  }
  if (DRY) { console.log(`  = ${cert.certification_key} (${cert.courses.length} required)`); continue }

  const { data: saved, error } = await supabaseAdmin.from('academy_certifications')
    .upsert(row, { onConflict: 'certification_key,version_number' }).select('id').single()
  if (error) fail(`${cert.certification_key}: ${error.message}`)

  const reqs = cert.courses.map((course_key, i) => ({
    certification_id: saved.id, course_key, required: true, sort: (i + 1) * 10,
  }))
  const { error: reqErr } = await supabaseAdmin.from('academy_certification_requirements')
    .upsert(reqs, { onConflict: 'certification_id,course_key' })
  if (reqErr) fail(`${cert.certification_key} requirements: ${reqErr.message}`)

  // A requirement dropped from the curriculum must stop gating, or people stay blocked on a
  // course that is no longer part of the credential.
  const { error: delErr } = await supabaseAdmin.from('academy_certification_requirements')
    .delete().eq('certification_id', saved.id)
    .not('course_key', 'in', `(${cert.courses.map(k => `"${k}"`).join(',')})`)
  if (delErr) fail(`${cert.certification_key} prune: ${delErr.message}`)

  console.log(`  = ${cert.certification_key} (${reqs.length} required)`)
}

// ── Prove it landed, rather than trusting that the writes returned ──────────
if (!DRY) {
  const { count: courseCount } = await supabaseAdmin.from('staff_training_courses')
    .select('id', { count: 'exact', head: true }).is('dealership_id', null).eq('active', true)
  const { count: certCount } = await supabaseAdmin.from('academy_certifications')
    .select('id', { count: 'exact', head: true }).eq('active', true)
  const { count: reqCount } = await supabaseAdmin.from('academy_certification_requirements')
    .select('id', { count: 'exact', head: true })

  console.log(`\n  in database: ${courseCount} active global courses, ${certCount} certifications, ${reqCount} requirements`)
  if (courseCount < COURSES.length) fail(`expected at least ${COURSES.length} global courses, found ${courseCount}`)
  if (certCount < CERTIFICATIONS.length) fail(`expected at least ${CERTIFICATIONS.length} certifications, found ${certCount}`)
}

console.log(`\n✓ Academy sync ${DRY ? 'dry run' : 'complete'}\n`)
process.exit(0)
