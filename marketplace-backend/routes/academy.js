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
import { randomToken, rateLimit } from '../security.js'
import { ROLE_CURRICULUM, CERTIFICATIONS } from '../academy-curriculum.js'

// Global catalog rows carry `dealership_id = null`; a dealership may add its own on top.
// The department order the course site navigates by. Same list the curriculum uses, so
// a department cannot appear in one and not the other.
const ACADEMY_DEPARTMENTS = ['Sales', 'Inventory', 'F&I', 'Service', 'Parts', 'Accounting', 'Marketing', 'Management']

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

  // ══ The course site ═══════════════════════════════════════════════════════
  // The Academy is its own place (academy.html), so it needs two reads: the whole
  // catalogue organised the way somebody browses it, and one course with its lessons.

  /**
   * The catalogue: every course this person may take, grouped by department and level,
   * each carrying THEIR progress. One read, because the course site is a browse
   * experience and eight round-trips to draw a grid is not one.
   *
   * Gating is real: `courseAppliesTo` decides what belongs to this person's curriculum,
   * and `mine` marks it. Nothing is hidden — seeing that Service has its own track is
   * useful even to a salesperson — but what is THEIRS is distinguished from what exists.
   */
  app.get('/academy/catalog', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id, department').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      const role = req.profile?.role || null
      const curricula = curriculaFor({ role, department: staff?.department })

      const { data: courses, error } = await catalogFilter(
        supabaseAdmin.from('staff_training_courses').select(COURSE_COLUMNS), req.dealershipId,
      ).order('sort')
      if (error) return res.status(500).json({ error: error.message })

      const ids = (courses || []).map(c => c.id)
      // Lesson counts per course, so a card can say "4 lessons" without a second call.
      const { data: lessons } = ids.length
        ? await supabaseAdmin.from('staff_training_lessons')
            .select('course_id, estimated_minutes').in('course_id', ids).eq('active', true)
        : { data: [] }
      const lessonStats = {}
      for (const x of lessons || []) {
        const st = lessonStats[x.course_id] || { count: 0, minutes: 0 }
        st.count++; st.minutes += Number(x.estimated_minutes) || 0
        lessonStats[x.course_id] = st
      }

      // This person's own assignments and lesson progress.
      let assignmentByCourse = {}, doneByCourse = {}
      if (staff) {
        const [{ data: assignments }, { data: progress }] = await Promise.all([
          supabaseAdmin.from('staff_training_assignments')
            .select('id, course_id, status, due_at, completed_at, progress_percent')
            .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id),
          supabaseAdmin.from('staff_training_lesson_progress')
            .select('course_id, lesson_id')
            .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id),
        ])
        assignmentByCourse = Object.fromEntries((assignments || []).map(a => [a.course_id, a]))
        for (const p of progress || []) doneByCourse[p.course_id] = (doneByCourse[p.course_id] || 0) + 1
      }

      const out = (courses || []).map(c => {
        const stats = lessonStats[c.id] || { count: 0, minutes: 0 }
        const a = assignmentByCourse[c.id] || null
        const done = doneByCourse[c.id] || 0
        return {
          ...c,
          lesson_count: stats.count,
          // The course's own estimate is a planning figure; the sum of its lessons is
          // what it will actually take. Prefer the real one when there is one.
          minutes: stats.minutes || c.estimated_minutes || 0,
          mine: courseAppliesTo(c, { role, curricula }),
          assigned: !!a,
          due_at: a?.due_at || null,
          completed_at: a?.completed_at || null,
          lessons_done: done,
          // Derived from lessons actually completed, never from a stored percentage that
          // could disagree with them.
          percent: stats.count ? Math.round((Math.min(done, stats.count) / stats.count) * 100) : 0,
          // A course with no lessons cannot be taken, and the site says so rather than
          // opening an empty page.
          takeable: stats.count > 0,
        }
      })

      res.json({
        courses: out,
        curricula,
        department: staff?.department || null,
        has_employment_record: !!staff,
        // Departments in a fixed order so the site's navigation is stable.
        departments: ACADEMY_DEPARTMENTS,
        levels: ['required', 'foundation', 'advanced', 'reference'],
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * One course, with its lessons IN ORDER and which of them this person has finished.
   */
  app.get('/academy/courses/:key', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: course } = await catalogFilter(
        supabaseAdmin.from('staff_training_courses').select(COURSE_COLUMNS), req.dealershipId,
      ).eq('course_key', String(req.params.key)).limit(1).maybeSingle()
      if (!course) return res.status(404).json({ error: 'No course with that key.' })

      const { data: lessons, error: lErr } = await supabaseAdmin.from('staff_training_lessons')
        .select('id, lesson_key, sort, title, summary, body, kind, estimated_minutes')
        .eq('course_id', course.id).eq('active', true).order('sort')
      if (lErr) return res.status(500).json({ error: lErr.message })

      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()

      let doneIds = new Set(), assignment = null
      if (staff) {
        const [{ data: progress }, { data: a }] = await Promise.all([
          supabaseAdmin.from('staff_training_lesson_progress')
            .select('lesson_id').eq('staff_member_id', staff.id).eq('course_id', course.id),
          supabaseAdmin.from('staff_training_assignments')
            .select('id, status, due_at, completed_at, progress_percent')
            .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id)
            .eq('course_id', course.id).maybeSingle(),
        ])
        doneIds = new Set((progress || []).map(p => p.lesson_id))
        assignment = a || null
      }

      const rows = (lessons || []).map(x => ({ ...x, completed: doneIds.has(x.id) }))
      res.json({
        course,
        lessons: rows,
        assignment,
        has_employment_record: !!staff,
        completed_count: rows.filter(x => x.completed).length,
        // The first lesson they have not finished — what "Continue" should open.
        next_lesson_id: rows.find(x => !x.completed)?.id || null,
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Finish a lesson.
   *
   * Recording completion is idempotent, and it ROLLS UP: the assignment's percentage is
   * recomputed from lessons actually finished, and the assignment is marked complete only
   * when every lesson is. Before this, `/hr/training/complete` let somebody declare a
   * course finished in one call with nothing read — a certification gated on that means
   * nothing at all.
   */
  app.post('/academy/lessons/:id/complete', requireAuth, canViewSelf, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      if (!staff) {
        return res.status(409).json({
          error: 'No employment record is linked to your account yet, so your progress cannot be recorded.',
          hint: 'Somebody with staff.manage has to create one. You can still read the course.',
        })
      }

      const { data: lesson } = await supabaseAdmin.from('staff_training_lessons')
        .select('id, course_id, dealership_id').eq('id', req.params.id).maybeSingle()
      if (!lesson) return res.status(404).json({ error: 'No lesson with that id.' })
      // A dealership's own lesson belongs to that dealership; a global one is everybody's.
      if (lesson.dealership_id && lesson.dealership_id !== req.dealershipId) {
        return res.status(404).json({ error: 'No lesson with that id.' })
      }

      const { error: insErr } = await supabaseAdmin.from('staff_training_lesson_progress')
        .upsert({
          dealership_id: req.dealershipId, staff_member_id: staff.id,
          lesson_id: lesson.id, course_id: lesson.course_id,
        }, { onConflict: 'staff_member_id,lesson_id', ignoreDuplicates: true })
      if (insErr) return res.status(500).json({ error: insErr.message })

      // Recount from the records rather than incrementing something.
      const [{ data: allLessons }, { data: doneRows }] = await Promise.all([
        supabaseAdmin.from('staff_training_lessons')
          .select('id').eq('course_id', lesson.course_id).eq('active', true),
        supabaseAdmin.from('staff_training_lesson_progress')
          .select('lesson_id').eq('staff_member_id', staff.id).eq('course_id', lesson.course_id),
      ])
      const total = (allLessons || []).length
      const doneSet = new Set((doneRows || []).map(r => r.lesson_id))
      const done = (allLessons || []).filter(x => doneSet.has(x.id)).length
      const percent = total ? Math.round((done / total) * 100) : 0
      const finished = total > 0 && done >= total

      // Roll up onto the assignment if this course was assigned to them. A course taken
      // voluntarily has no assignment, and that is fine — the lesson progress is still real.
      let assignment = null
      const { data: existing } = await supabaseAdmin.from('staff_training_assignments')
        .select('id, status, completed_at').eq('dealership_id', req.dealershipId)
        .eq('staff_member_id', staff.id).eq('course_id', lesson.course_id).maybeSingle()
      if (existing) {
        const patch = { progress_percent: percent, updated_at: new Date().toISOString() }
        if (finished) {
          patch.status = 'completed'
          patch.completed_at = existing.completed_at || new Date().toISOString()
        } else if (existing.status !== 'in_progress') {
          patch.status = 'in_progress'
        }
        const { data: updated, error: upErr } = await supabaseAdmin.from('staff_training_assignments')
          .update(patch).eq('id', existing.id).select('id, status, progress_percent, completed_at').maybeSingle()
        // The lesson IS recorded either way; a failed roll-up is reported, not hidden.
        if (upErr) return res.json({ ok: true, done, total, percent, course_completed: finished,
          assignment: null, warning: `Your progress was saved but the assignment could not be updated: ${upErr.message}` })
        assignment = updated
      }

      res.json({ ok: true, done, total, percent, course_completed: finished, assignment })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Public credential verification. No auth: whoever holds the credential id may confirm it —
   * that is what makes it shareable. It exposes the credential and nothing else about the
   * person, because this URL ends up on LinkedIn.
   */
  app.get('/verify/:credentialId', rateLimit('pub-verify-cred', 60, 60000), async (req, res) => {
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

  // ── Contextual Help & Searchable Guides ────────────────────────────────────
  app.get('/guide/contextual', requireAuth, canViewSelf, async (req, res) => {
    const route = String(req.query.context || req.query.page || 'home').toLowerCase()
    try {
      const { data: guides } = await supabaseAdmin.from('academy_guides')
        .select('*').limit(20)
      res.json({ route, guides: guides || [] })
    } catch (e) { res.json({ route, guides: [] }) }
  })

  // ── Video Pipeline Metadata ────────────────────────────────────────────────
  app.get('/academy/videos/:courseKey', requireAuth, canViewSelf, async (req, res) => {
    try {
      const { data: video } = await supabaseAdmin.from('academy_videos')
        .select('*').eq('course_key', req.params.courseKey).order('created_at', { ascending: false }).limit(1).maybeSingle()
      res.json({ video: video || null })
    } catch (e) { res.json({ video: null }) }
  })

  // ── Guided Page Tour Progress ──────────────────────────────────────────────
  app.post('/academy/tours/:pageRoute/finish', requireAuth, canViewSelf, async (req, res) => {
    try {
      const { pageRoute } = req.params
      const version = Number(req.body?.version) || 1
      const state = req.body?.state || 'done'
      await supabaseAdmin.from('academy_tour_progress').upsert({
        user_id: req.user.id,
        page_route: pageRoute,
        tour_version: version,
        status: state,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,page_route' })
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
