/**
 * Academy — Your Path, required training, and credentials that mean something (PR 7.3).
 *
 * CURRENT TRUTH this replaces: ~189 courses lived as a static array inside a frontend file.
 * Nothing could assign one, require one, track one or certify against one, and a manager could
 * not see who had done what. Showing all 189 to everybody is not a library, it is a wall.
 *
 * Two rules run through this file.
 *
 *   1. **Required training is deterministic.** It comes from role + department + policy, and
 *      the same person on the same day always gets the same list. AI may *recommend*; it never
 *      decides what is required, because a compliance requirement that changes when a model
 *      changes its mind is not a requirement.
 *
 *   2. **A credential requires the work.** `issueCertification` refuses unless every required
 *      course is actually completed. A certificate issued because somebody opened a page is
 *      worth nothing, and worse, it is a claim the dealership would be making to the public.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { randomToken } from '../security.js'
import { ROLE_CURRICULUM, CERTIFICATIONS } from '../academy-curriculum.js'

// Global catalog rows carry `dealership_id = null`; a dealership may add its own on top.
const COURSE_COLUMNS = 'id, dealership_id, course_key, version_number, title, description, category, department, level, role_keys, estimated_minutes, sort, active'

const catalogFilter = (q, dealershipId) =>
  q.or(`dealership_id.is.null,dealership_id.eq.${dealershipId}`).eq('active', true)

/**
 * Which curricula apply to this person. Role first, then the department their employment says
 * they work in — a SALES_REP posted to Service should see Service's foundations too.
 */
export function curriculaFor({ role = null, department = null } = {}) {
  const out = new Set(ROLE_CURRICULUM[String(role || '').toUpperCase()] || [])
  if (department) out.add(department)
  return [...out]
}

/**
 * Is this course part of this person's path, and at what level?
 *
 * A course with no department is for everyone. A course that names roles is only for those
 * roles — that is how "advanced" material stays out of a new hire's required list.
 */
export function courseAppliesTo(course, { role = null, curricula = [] } = {}) {
  if (!course.active) return false
  const roles = course.role_keys || []
  if (roles.length && !roles.includes(String(role || '').toUpperCase())) return false
  if (!course.department) return true
  return curricula.includes(course.department)
}

/**
 * Your Path — what this person should see, in the order that makes sense to them.
 *
 * `reference` is deliberately NOT included: it is the searchable library, reachable on demand,
 * never the default. That distinction is the whole point of the rebuild.
 */
export function buildPath(courses, assignments, { role, curricula }) {
  const byCourseId = new Map((assignments || []).map(a => [a.course_id, a]))
  const mine = (courses || []).filter(c => courseAppliesTo(c, { role, curricula }))

  const decorate = (c) => {
    const a = byCourseId.get(c.id)
    return {
      id: c.id, course_key: c.course_key, title: c.title, description: c.description,
      department: c.department, level: c.level, estimated_minutes: c.estimated_minutes,
      status: a?.status || 'not_started',
      due_at: a?.due_at || null,
      completed_at: a?.completed_at || null,
      assignment_id: a?.id || null,
      // Overdue is a fact about a date, not a status somebody sets.
      overdue: !!(a && a.due_at && a.status !== 'completed' && a.status !== 'waived' && new Date(a.due_at) < new Date()),
    }
  }

  const at = (lvl) => mine.filter(c => c.level === lvl).map(decorate)
    .sort((x, y) => (x.overdue === y.overdue ? 0 : x.overdue ? -1 : 1))

  const required = at('required')
  return {
    required,
    foundations: at('foundation'),
    advanced: at('advanced'),
    // A number a person can act on, rather than a completion percentage of 189 things.
    outstanding_required: required.filter(r => r.status !== 'completed' && r.status !== 'waived').length,
    overdue_required: required.filter(r => r.overdue).length,
  }
}

/**
 * Assign what this person is required to do, and nothing else.
 *
 * Idempotent by the database: `staff_training_assignment_unique (course_id, staff_member_id)`
 * already existed, so re-running never produces a second copy of the same requirement.
 */
export async function assignRequiredTraining(dealershipId, staffMember, { assignedBy = null, dueInDays = 30 } = {}) {
  const role = staffMember.login_role || null
  const curricula = curriculaFor({ role, department: staffMember.department })

  const { data: courses, error } = await catalogFilter(
    supabaseAdmin.from('staff_training_courses').select(COURSE_COLUMNS), dealershipId,
  ).eq('level', 'required')
  if (error) return { ok: false, error: error.message, assigned: 0 }

  const applicable = (courses || []).filter(c => courseAppliesTo(c, { role, curricula }))
  if (!applicable.length) return { ok: true, assigned: 0, courses: [] }

  const due = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString()
  const rows = applicable.map(c => ({
    dealership_id: dealershipId, course_id: c.id, staff_member_id: staffMember.id,
    assigned_by: assignedBy, due_at: due, status: 'assigned', progress_percent: 0,
  }))

  const { data, error: insErr } = await supabaseAdmin.from('staff_training_assignments')
    .upsert(rows, { onConflict: 'course_id,staff_member_id', ignoreDuplicates: true })
    .select('id')
  if (insErr) return { ok: false, error: insErr.message, assigned: 0 }
  return { ok: true, assigned: (data || []).length, courses: applicable.map(c => c.course_key) }
}

/**
 * Issue a MarketSync credential — only if it was earned.
 *
 * The refusal names what is outstanding. A dealership that wants its people certified has one
 * supported route: have them do the courses.
 */
export async function issueCertification(dealershipId, staffMemberId, certificationKey, { actorId = null } = {}) {
  const { data: cert } = await supabaseAdmin.from('academy_certifications')
    .select('id, certification_key, name, version_number, validity_months, active')
    .eq('certification_key', certificationKey).eq('active', true)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()
  if (!cert) return { ok: false, error: 'That certification does not exist.' }

  const { data: reqs } = await supabaseAdmin.from('academy_certification_requirements')
    .select('course_key, required').eq('certification_id', cert.id)
  const requiredKeys = (reqs || []).filter(r => r.required).map(r => r.course_key)
  if (!requiredKeys.length) {
    // A certification with no requirements would issue to anybody who asked.
    return { ok: false, error: 'That certification has no requirements recorded, so it cannot be issued.' }
  }

  // What has this person actually completed?
  const { data: courses } = await catalogFilter(
    supabaseAdmin.from('staff_training_courses').select('id, course_key'), dealershipId,
  ).in('course_key', requiredKeys)
  const courseIds = (courses || []).map(c => c.id)

  const { data: done } = courseIds.length
    ? await supabaseAdmin.from('staff_training_assignments')
        .select('course_id, status')
        .eq('dealership_id', dealershipId).eq('staff_member_id', staffMemberId)
        .in('course_id', courseIds).eq('status', 'completed')
    : { data: [] }

  const completedIds = new Set((done || []).map(d => d.course_id))
  const keyById = new Map((courses || []).map(c => [c.id, c.course_key]))
  const completedKeys = new Set([...completedIds].map(id => keyById.get(id)))
  const outstanding = requiredKeys.filter(k => !completedKeys.has(k))

  if (outstanding.length) {
    return {
      ok: false, outstanding,
      error: `Not yet earned — ${outstanding.length} required course(s) still outstanding.`,
    }
  }

  const issued = new Date()
  const expires = cert.validity_months
    ? new Date(issued.getFullYear(), issued.getMonth() + cert.validity_months, issued.getDate())
    : null

  // Re-earning renews rather than piling up: one live credential per person per certification,
  // enforced by `staff_certifications_one_active_per_key`.
  const { data: existing } = await supabaseAdmin.from('staff_certifications')
    .select('id, credential_id').eq('dealership_id', dealershipId)
    .eq('staff_member_id', staffMemberId).eq('certification_key', certificationKey)
    .eq('status', 'active').maybeSingle()

  const row = {
    dealership_id: dealershipId, staff_member_id: staffMemberId,
    certification_type: 'marketsync', certification_name: cert.name,
    certification_key: cert.certification_key, certification_version: cert.version_number,
    issuer: 'MarketSync', source: 'marketsync', status: 'active',
    issued_on: issued.toISOString().slice(0, 10),
    expires_on: expires ? expires.toISOString().slice(0, 10) : null,
    verified_by: actorId, verified_at: issued.toISOString(),
    updated_at: issued.toISOString(),
  }

  if (existing) {
    const { data, error } = await supabaseAdmin.from('staff_certifications')
      .update(row).eq('id', existing.id).select('*').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, credential: data, renewed: true }
  }

  // Unguessable, because possession of it is the entire authorisation for the public
  // verification page.
  row.credential_id = `MS-${cert.certification_key.replace(/^ms_certified_/, '').toUpperCase().slice(0, 8)}-${randomToken(9)}`
  row.certificate_number = row.credential_id

  const { data, error } = await supabaseAdmin.from('staff_certifications').insert(row).select('*').single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, credential: data, renewed: false }
}

/**
 * What the public may see about a credential.
 *
 * Deliberately minimal: the holder's name, what they hold, when, and whether it is still
 * valid. No dealership, no employment record, no contact details, no internal ids. A
 * credential link is shared on LinkedIn — it must not become a way to read somebody's HR file.
 */
export function publicCredential(cert, holderName) {
  const expired = cert.expires_on && new Date(cert.expires_on) < new Date()
  return {
    credential_id: cert.credential_id,
    name: cert.certification_name,
    holder: holderName || null,
    issuer: 'MarketSync',
    issued_on: cert.issued_on,
    expires_on: cert.expires_on,
    version: cert.certification_version,
    // "Active" in the database is not the same as "valid today".
    valid: cert.status === 'active' && !expired,
    status: expired ? 'expired' : cert.status,
  }
}

/**
 * Academy attention. Required training only — a recommended course is not something to be
 * nagged about, and treating it as one is how people learn to ignore the queue.
 */
export async function academyAttention(dealershipId) {
  const now = new Date().toISOString()
  const [{ data: overdue }, { data: expiring }] = await Promise.all([
    supabaseAdmin.from('staff_training_assignments')
      .select('id, staff_member_id, due_at, course_id')
      .eq('dealership_id', dealershipId).lt('due_at', now)
      .not('status', 'in', '("completed","waived")').limit(100),
    supabaseAdmin.from('staff_certifications')
      .select('id, staff_member_id, certification_name, expires_on')
      .eq('dealership_id', dealershipId).eq('status', 'active')
      .not('expires_on', 'is', null)
      .lt('expires_on', new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)).limit(100),
  ])

  const items = []
  for (const a of overdue || []) {
    items.push({
      kind: 'training_overdue', severity: 2,
      subject: 'Required training is overdue',
      reason: `Due ${String(a.due_at).slice(0, 10)} and not completed`,
      owner: 'People', action: 'Complete training', ref: a.id,
    })
  }
  for (const c of expiring || []) {
    items.push({
      kind: 'certification_expiring', severity: 2,
      subject: c.certification_name,
      reason: `Expires ${c.expires_on} — renew before it lapses`,
      owner: 'People', action: 'Renew certification', ref: c.id,
    })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerAcademy(app) {
  const canViewSelf = requirePermission('staff.training.self')
  const canViewTeam = requirePermission('staff.training.view')
  const canManage = requirePermission('staff.training.manage')

  /**
   * Your Path. Required, Foundations, Advanced — never the whole library.
   */
  app.get('/academy/my-path', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id, department').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      if (!staff) return res.status(404).json({ error: 'No employment record is linked to your account yet.' })

      const role = req.profile?.role || null
      const curricula = curriculaFor({ role, department: staff.department })
      const [{ data: courses }, { data: assignments }] = await Promise.all([
        catalogFilter(supabaseAdmin.from('staff_training_courses').select(COURSE_COLUMNS), req.dealershipId)
          .neq('level', 'reference').order('sort'),
        supabaseAdmin.from('staff_training_assignments')
          .select('id, course_id, status, due_at, completed_at')
          .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id),
      ])
      res.json({ ...buildPath(courses || [], assignments || [], { role, curricula }), curricula })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * The library. Searchable, paginated, and never rendered by default — 189 courses at once
   * is not a learning experience.
   */
  app.get('/academy/library', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      let q = catalogFilter(supabaseAdmin.from('staff_training_courses').select(COURSE_COLUMNS), req.dealershipId)
      if (req.query.department) q = q.eq('department', String(req.query.department))
      if (req.query.q) q = q.ilike('title', `%${String(req.query.q).slice(0, 60)}%`)
      const { data, error } = await q.order('sort').limit(Math.min(100, Number(req.query.limit) || 50))
      if (error) return res.status(500).json({ error: error.message })
      res.json({ courses: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Every certification, WITH the courses it requires.
   *
   * The requirements ship with the certification deliberately: a screen that shows what you
   * could earn without showing what it costs would read as "Ready" for everything, and then
   * issuing would refuse. The screen and the refusal have to be reasoning from the same fact.
   */
  app.get('/academy/certifications', requireAuth, canViewSelf, async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('academy_certifications')
        .select('id, certification_key, name, department, description, version_number, validity_months')
        .eq('active', true).order('name')
      const certs = data || []
      const { data: reqs } = certs.length
        ? await supabaseAdmin.from('academy_certification_requirements')
            .select('certification_id, course_key, required, sort')
            .in('certification_id', certs.map(c => c.id)).order('sort')
        : { data: [] }

      const byCert = new Map()
      for (const r of reqs || []) {
        if (!r.required) continue
        if (!byCert.has(r.certification_id)) byCert.set(r.certification_id, [])
        byCert.get(r.certification_id).push(r.course_key)
      }
      res.json({ certifications: certs.map(c => ({ ...c, courses: byCert.get(c.id) || [] })) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * The credentials this person holds. Their own record only — a team view is `/academy/team`,
   * which is gated separately.
   */
  app.get('/academy/my-credentials', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      if (!staff) return res.json({ certifications: [] })

      const { data } = await supabaseAdmin.from('staff_certifications')
        .select('certification_key, certification_name, certification_version, credential_id, issued_on, expires_on, status')
        .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id)
        .eq('source', 'marketsync').not('credential_id', 'is', null)
      // `valid` is computed, never stored: "active" in the database is not "valid today".
      const now = new Date()
      res.json({
        certifications: (data || []).map(c => ({
          ...c, valid: c.status === 'active' && !(c.expires_on && new Date(c.expires_on) < now),
        })),
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/academy/team', requireAuth, canViewTeam, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data } = await supabaseAdmin.from('staff_training_assignments')
        .select('id, staff_member_id, course_id, status, due_at, completed_at')
        .eq('dealership_id', req.dealershipId).limit(1000)
      res.json({ assignments: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/academy/attention', requireAuth, canViewTeam, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try { res.json({ items: await academyAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/academy/assign-required/:staffId', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id, department, user_id').eq('id', req.params.staffId).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!staff) return res.status(404).json({ error: 'That employee was not found.' })
      const { data: p } = staff.user_id
        ? await supabaseAdmin.from('profiles').select('role').eq('id', staff.user_id).maybeSingle()
        : { data: null }
      const r = await assignRequiredTraining(req.dealershipId, { ...staff, login_role: p?.role || null }, { assignedBy: req.user.id })
      if (!r.ok) return res.status(500).json({ error: r.error })
      audit(req, 'academy.required_assigned', { after_state: { staff_id: staff.id, assigned: r.assigned } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/academy/certifications/:key/issue', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const staffId = req.body?.staff_member_id
    if (!staffId) return res.status(400).json({ error: 'Which employee is this for?' })
    try {
      const r = await issueCertification(req.dealershipId, staffId, req.params.key, { actorId: req.user.id })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'academy.certification_issued', {
        after_state: { staff_id: staffId, key: req.params.key, credential_id: r.credential.credential_id, renewed: r.renewed },
      })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Public credential verification. No auth: whoever holds the credential id may confirm it —
   * that is what makes it shareable. It exposes the credential and nothing else about the
   * person, because this URL ends up on LinkedIn.
   */
  app.get('/verify/:credentialId', async (req, res) => {
    try {
      const { data: cert } = await supabaseAdmin.from('staff_certifications')
        .select('credential_id, certification_name, certification_version, issued_on, expires_on, status, staff_member_id')
        .eq('credential_id', String(req.params.credentialId)).maybeSingle()
      if (!cert) return res.status(404).json({ error: 'No credential with that id.' })

      const { data: holder } = await supabaseAdmin.from('staff_members')
        .select('name').eq('id', cert.staff_member_id).maybeSingle()
      res.json(publicCredential(cert, holder?.name || null))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
