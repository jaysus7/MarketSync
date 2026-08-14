/**
 * The employee dossier — one person, everything on record about them.
 *
 * HR's Staff list opens a person and has to answer, in one place: what have they
 * completed, what have they signed, what are they certified in, where do they stand,
 * what is outstanding, and what can HR do about it.
 *
 * THE RULE THIS FILE OBEYS (AGENTS.md A19): every section is a real record read from
 * the table that owns it. Nothing here derives a fact another engine owns, and nothing
 * invents one. A section that could NOT be read says so — `null` with a stated reason —
 * because an employee who looks like they have completed no training and an employee
 * whose training could not be loaded must never render the same way. That distinction
 * is the whole point: HR acts on this screen.
 *
 * AND THE ONE IT REFUSES TO BREAK: there is no opaque employee score here. The Phase 7
 * brief forbids it and it deserves forbidding — a number nobody can explain becomes a
 * reason to fire somebody. `recommendations` are derived, and each one carries the
 * COUNT and the RECORD it came from, so a manager can check the machine's work.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission, hasPermission } from '../authorization.js'
import { audit } from '../audit.js'
import { issuePasswordReset } from './auth.js'

// A section that failed. Never an empty array — see the file header.
const unread = (why) => ({ items: null, unavailable: why })
const readOk = (items) => ({ items: items || [], unavailable: null })

async function section(label, fn) {
  try {
    const { data, error } = await fn()
    if (error) return unread(`${label} could not be read: ${error.message}`)
    return readOk(data)
  } catch (e) {
    return unread(`${label} could not be read: ${e?.message || e}`)
  }
}

// ── Where this person stands ────────────────────────────────────────────────
// Two boards, and they measure different things, so they are never merged into one
// "rank". /dealership/leaderboard is the store's own board (deals, appraisals, sold
// contacts); /leaderboard/global is the Facebook AutoPoster board (listings posted and
// sold). A rep can be first on one and absent from the other, and that is information.
async function standing(dealershipId, userId) {
  if (!userId) {
    return { internal: null, autoposter: null,
      unavailable: 'This employee has no login linked, so no board can be keyed to them.' }
  }
  const out = { internal: null, autoposter: null, unavailable: null }

  try {
    const { data: contacts } = await supabaseAdmin.from('contacts')
      .select('assigned_to, status').eq('dealership_id', dealershipId)
      .in('status', ['sold', 'fni', 'delivered']).limit(5000)
    const tally = new Map()
    for (const c of contacts || []) {
      if (!c.assigned_to) continue
      tally.set(c.assigned_to, (tally.get(c.assigned_to) || 0) + 1)
    }
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
    const idx = ranked.findIndex(([id]) => id === userId)
    out.internal = {
      sold: tally.get(userId) || 0,
      rank: idx >= 0 ? idx + 1 : null,
      of: ranked.length,
      // Rank null with sold 0 means "on the board with nothing yet", not "unknown".
      note: idx >= 0 ? null : 'No won customers attributed to them in this dealership yet.',
    }
  } catch (e) { out.internal = null; out.unavailable = `Internal standing could not be read: ${e.message}` }

  try {
    const { data: listings } = await supabaseAdmin.from('listings')
      .select('posted_by, status').limit(20000)
    const tally = new Map()
    for (const l of listings || []) {
      if (!l.posted_by) continue
      const t = tally.get(l.posted_by) || { posted: 0, sold: 0 }
      t.posted++; if (l.status === 'sold') t.sold++
      tally.set(l.posted_by, t)
    }
    const pts = (t) => t.posted * 100 + t.sold * 500
    const ranked = [...tally.entries()].sort((a, b) => pts(b[1]) - pts(a[1]))
    const idx = ranked.findIndex(([id]) => id === userId)
    const mine = tally.get(userId) || { posted: 0, sold: 0 }
    out.autoposter = {
      posted: mine.posted, sold: mine.sold, points: pts(mine),
      rank: idx >= 0 ? idx + 1 : null, of: ranked.length,
      note: idx >= 0 ? null : 'They have posted nothing to Facebook Marketplace.',
    }
  } catch (e) {
    out.autoposter = null
    out.unavailable = [out.unavailable, `AutoPoster standing could not be read: ${e.message}`].filter(Boolean).join(' ')
  }

  return out
}

// ── Recommendations ─────────────────────────────────────────────────────────
// Derived, explainable, and only ever from a record that exists. Each carries `basis`:
// the fact it was computed from. If HR disagrees with a recommendation they can go and
// look at the same rows. A section that could not be read produces NO recommendation —
// silence beats "nothing outstanding" when the truth is "we could not check".
function recommend(d) {
  const out = []
  const add = (severity, headline, why, basis, action) =>
    out.push({ severity, headline, why, basis, action })

  const overdueTraining = d.training.items?.filter(t => t.overdue) ?? null
  if (overdueTraining?.length) {
    add(3, 'Overdue training', `${overdueTraining.length} required course${overdueTraining.length === 1 ? '' : 's'} past due.`,
      overdueTraining.slice(0, 5).map(t => t.title).join(', '),
      'Sit down with them and set a date. Nothing else on this list matters as much as safety training that has lapsed.')
  }

  const openTraining = d.training.items?.filter(t => !t.completed_at && !t.overdue) ?? null
  if (openTraining?.length) {
    add(1, 'Training in progress', `${openTraining.length} course${openTraining.length === 1 ? '' : 's'} assigned and not finished.`,
      openTraining.slice(0, 5).map(t => t.title).join(', '), 'On track — no action needed yet.')
  }

  const unsigned = d.policies.items?.filter(p => p.status !== 'acknowledged' && !p.waived_at) ?? null
  if (unsigned?.length) {
    add(3, 'Unsigned policies', `${unsigned.length} document${unsigned.length === 1 ? '' : 's'} still unsigned.`,
      unsigned.slice(0, 5).map(p => p.title).join(', '),
      'An unsigned policy is an unenforceable one. Get these acknowledged before anything else is asked of them.')
  }

  const expired = d.certifications.items?.filter(c => c.expires_on && new Date(c.expires_on) < new Date()) ?? null
  if (expired?.length) {
    add(3, 'Expired certification', `${expired.length} certification${expired.length === 1 ? '' : 's'} has lapsed.`,
      expired.slice(0, 5).map(c => c.certification_name || c.certification_key).join(', '),
      'Re-issue, or stop assigning them work that depends on it.')
  }

  const blocked = d.lifecycle.items?.filter(t => t.status === 'blocked') ?? null
  if (blocked?.length) {
    add(2, 'Onboarding is stuck', `${blocked.length} onboarding task${blocked.length === 1 ? '' : 's'} blocked.`,
      blocked.slice(0, 5).map(t => `${t.title}${t.blocked_reason ? ` (${t.blocked_reason})` : ''}`).join(', '),
      'Somebody has to unblock these — an onboarding that never finishes is one nobody completed.')
  }

  // Standing is context, never a verdict. It is offered as something to look at, and it
  // is deliberately NOT phrased as underperformance: this file does not know their
  // territory, their hours, or what they were asked to do.
  if (d.standing.internal && d.standing.internal.rank == null && d.standing.autoposter?.posted === 0) {
    add(1, 'No recorded activity on either board',
      'No won customers and nothing posted to Facebook Marketplace.',
      'Internal board and AutoPoster board both empty for this login.',
      'Worth a conversation about what they are being given, before it is read as performance.')
  }

  if (!out.length) {
    const anyUnread = ['training', 'policies', 'certifications', 'lifecycle'].some(k => d[k].items == null)
    add(1, anyUnread ? 'Nothing outstanding in what could be read' : 'Nothing outstanding',
      anyUnread
        ? 'Some sections could not be loaded, so this is not a clean bill of health.'
        : 'Training, policies, certifications and onboarding are all clear.',
      anyUnread ? 'See the unavailable sections above.' : 'All four record sets checked.',
      anyUnread ? 'Reload before treating this as complete.' : 'No action needed.')
  }
  return out.sort((a, b) => b.severity - a.severity)
}

export function registerPeopleDossier(app) {
  const canView = requirePermission('staff.view')
  const canManage = requirePermission('staff.manage')

  // ── The whole record for one person ───────────────────────────────────────
  app.get('/hr/employees/:id/dossier', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const out = await assemble(req, req.params.id, { self: false })
    if (out.error) return res.status(out.code).json({ error: out.error })
    res.json({ dossier: out.dossier })
  })

  // ── Your own record ───────────────────────────────────────────────────────
  // The same assembly, scoped to the caller and filtered to what an employee is
  // allowed to see of their own file. It needs no manager permission — this is the
  // person's own employment record, their own certificates and the contracts they
  // themselves signed.
  //
  // The one difference that matters: documents are filtered to `employee_visible`.
  // HR files things about a person that the person is not entitled to read, and that
  // flag is the existing switch for it. Recommendations are dropped entirely — an
  // action list written for a manager is not something to hand somebody about
  // themselves.
  app.get('/hr/me', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: staff } = await supabaseAdmin.from('staff_members')
      .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
    if (!staff) {
      return res.status(404).json({
        error: 'No employment record is linked to your account yet.',
        hint: 'Somebody with staff.manage has to create one before your training, certificates and documents can be shown here.',
      })
    }
    const out = await assemble(req, staff.id, { self: true })
    if (out.error) return res.status(out.code).json({ error: out.error })
    delete out.dossier.recommendations
    res.json({ dossier: out.dossier })
  })

  // ── Download a document ───────────────────────────────────────────────────
  // A short-lived signed URL, minted per request. The file is never public and the
  // link cannot be shared usefully for long.
  //
  // Two different callers, two different rules: an employee may download their own
  // documents and only the ones marked visible to them; somebody with staff.view may
  // download any document in their dealership. Both are checked against the ROW, not
  // against what the caller claims.
  app.get('/hr/documents/:id/download', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: doc, error } = await supabaseAdmin.from('staff_documents')
      .select('id, staff_member_id, title, document_type, storage_bucket, storage_path, employee_visible, deleted_at, quarantine_status')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!doc || doc.deleted_at) return res.status(404).json({ error: 'Document not found' })
    // A file still being scanned is not a file to hand out.
    if (doc.quarantine_status && doc.quarantine_status !== 'clean') {
      return res.status(409).json({ error: 'That document is still being scanned and cannot be downloaded yet.' })
    }
    if (!doc.storage_bucket || !doc.storage_path) {
      return res.status(409).json({ error: 'That document has no file attached to it.' })
    }

    let mayRead = false
    try { mayRead = await hasPermission(req, 'staff.view') } catch { mayRead = false }
    if (!mayRead) {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      const isMine = staff && staff.id === doc.staff_member_id
      if (!isMine) return res.status(403).json({ error: 'That is not your document.' })
      if (doc.employee_visible === false) {
        return res.status(403).json({ error: 'That document is on your file but is not shared with you. Ask HR.' })
      }
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(doc.storage_bucket).createSignedUrl(doc.storage_path, 120)
    if (sErr || !signed?.signedUrl) {
      return res.status(502).json({ error: `The download link could not be created: ${sErr?.message || 'unknown'}` })
    }
    audit(req, 'hr.document_downloaded', { after_state: { document_id: doc.id, staff_member_id: doc.staff_member_id } })
    res.json({ ok: true, url: signed.signedUrl, expires_in_seconds: 120, title: doc.title || doc.document_type })
  })

  // The assembly both of the above share. `self` narrows documents to what the
  // employee is allowed to see of their own file.
  async function assemble(req, staffId, { self = false } = {}) {
    let person = null, pErr = null
    const res1 = await supabaseAdmin
      .from('staff_profile_overview_v').select('*')
      .eq('dealership_id', req.dealershipId).eq('id', staffId).maybeSingle()
    if (!res1.error && res1.data) {
      person = res1.data
    } else {
      const res2 = await supabaseAdmin
        .from('staff_members').select('*')
        .eq('dealership_id', req.dealershipId).eq('id', staffId).maybeSingle()
      if (res2.error) return { error: res2.error.message, code: 500 }
      person = res2.data
    }
    if (!person) return { error: 'Employee not found', code: 404 }

    const [training, certifications, policies, documents, lifecycle] = await Promise.all([
      section('Training', async () => {
        const r = await supabaseAdmin.from('staff_training_assignments')
          .select('id, course_id, status, due_at, completed_at, score, progress_percent, verification_status')
          .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId)
        if (r.error || !r.data?.length) return r
        const ids = [...new Set(r.data.map(a => a.course_id).filter(Boolean))]
        const { data: courses } = await supabaseAdmin.from('staff_training_courses')
          .select('id, title, category, department, level').in('id', ids)
        const byId = Object.fromEntries((courses || []).map(c => [c.id, c]))
        const now = Date.now()
        return { data: r.data.map(a => ({
          ...a,
          title: byId[a.course_id]?.title || 'Course',
          category: byId[a.course_id]?.category || null,
          overdue: !a.completed_at && !!a.due_at && new Date(a.due_at).getTime() < now,
        })), error: null }
      }),
      section('Certifications', () => supabaseAdmin.from('staff_certifications')
        .select('id, certification_key, certification_name, certification_type, issuer, certificate_number, issued_on, expires_on, status, credential_id, source')
        .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId).order('issued_on', { ascending: false })),
      section('Signed policies', async () => {
        const r = await supabaseAdmin.from('staff_policy_acknowledgements')
          .select('id, policy_version_id, status, assigned_at, due_at, acknowledged_at, waived_at, waiver_reason, acknowledged_checksum_sha256')
          .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId)
        if (r.error || !r.data?.length) return r
        const vIds = [...new Set(r.data.map(a => a.policy_version_id).filter(Boolean))]
        const { data: versions } = await supabaseAdmin.from('staff_policy_versions')
          .select('id, policy_id, version_number, effective_on').in('id', vIds)
        const pIds = [...new Set((versions || []).map(v => v.policy_id).filter(Boolean))]
        const { data: pols } = await supabaseAdmin.from('staff_policies')
          .select('id, title, category, policy_key').in('id', pIds)
        const vById = Object.fromEntries((versions || []).map(v => [v.id, v]))
        const pById = Object.fromEntries((pols || []).map(p => [p.id, p]))
        return { data: r.data.map(a => {
          const v = vById[a.policy_version_id]
          const p = v ? pById[v.policy_id] : null
          return { ...a, title: p?.title || 'Policy', category: p?.category || null, version_number: v?.version_number ?? null }
        }), error: null }
      }),
      // Only documents HR may see. `employee_visible` governs the EMPLOYEE's view of
      // their own file, not HR's, so it is deliberately not filtered here.
      section('Documents', () => {
        let q = supabaseAdmin.from('staff_documents')
          .select('id, document_type, title, status, expires_on, employee_visible, created_at')
          .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId)
          .is('deleted_at', null).order('created_at', { ascending: false })
        if (self) q = q.eq('employee_visible', true)
        return q
      }),
      section('Onboarding', () => supabaseAdmin.from('staff_lifecycle_tasks')
        .select('id, title, category, status, due_on, required, blocked_reason, completed_at')
        .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId).order('sort_order')),
    ])

    const stand = await standing(req.dealershipId, person.user_id)

    // Compensation is separate PII behind its own permission AND MFA. When the caller
    // does not hold it the field is WITHHELD and says so — an empty compensation panel
    // would read as "this person is not paid".
    let employment = null, employmentWithheld = null
    let maySeePay = false
    try { maySeePay = await hasPermission(req, 'staff.compensation.view') } catch { maySeePay = false }
    if (!maySeePay) employmentWithheld = 'Compensation needs the staff.compensation.view permission.'
    else if (!req.mfaVerified) employmentWithheld = 'Compensation needs a verified MFA session.'
    else {
      const { data, error } = await supabaseAdmin.from('staff_employment_details').select('*')
        .eq('dealership_id', req.dealershipId).eq('staff_member_id', staffId).maybeSingle()
      if (error) employmentWithheld = `Compensation could not be read: ${error.message}`
      else employment = data || null
    }

    const dossier = {
      person, training, certifications, policies, documents, lifecycle,
      standing: stand, employment, employment_withheld: employmentWithheld,
    }
    dossier.recommendations = recommend(dossier)
    // Everything the screen could not see, in one place, so it can say so once.
    dossier.unavailable = [training, certifications, policies, documents, lifecycle]
      .map(x => x.unavailable).concat(stand.unavailable).filter(Boolean)

    return { dossier }
  }

  // ── Edit an employee after onboarding ─────────────────────────────────────
  // Creating an employee was possible; correcting one was not, so a typo at hire time
  // was permanent. Identity-shaped fields only — status goes through the lifecycle
  // route, compensation through its own, and neither is settable here.
  const EDITABLE = ['name', 'email', 'phone', 'team', 'department', 'job_title',
                    'location_name', 'employee_number', 'manager_staff_id', 'start_date', 'notes']

  app.patch('/hr/employees/:id', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const patch = {}
    for (const k of EDITABLE) {
      if (b[k] === undefined) continue
      patch[k] = typeof b[k] === 'string' ? (b[k].trim() || null) : b[k]
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' })
    if (patch.name === null) return res.status(400).json({ error: 'An employee needs a name.' })

    // A manager must be somebody in THIS dealership, and never the person themselves.
    if (patch.manager_staff_id) {
      if (patch.manager_staff_id === req.params.id) return res.status(400).json({ error: 'Somebody cannot manage themselves.' })
      const { data: mgr } = await supabaseAdmin.from('staff_members').select('id')
        .eq('id', patch.manager_staff_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!mgr) return res.status(400).json({ error: 'That manager is not in this dealership.' })
    }

    const { data: before } = await supabaseAdmin.from('staff_members').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Employee not found' })

    patch.updated_at = new Date().toISOString()
    patch.updated_by = req.user?.id || null
    const { data, error } = await supabaseAdmin.from('staff_members').update(patch)
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('*').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })

    audit(req, 'hr.employee_updated', { before_state: before, after_state: data })
    res.json({ ok: true, employee: data })
  })

  // ── Send this employee a password reset ───────────────────────────────────
  // Reuses the SAME one-shot hashed-token flow as /auth/forgot-password. It does not
  // set a password and it never reveals one: HR triggers the email, the employee
  // chooses the password. An admin who could type a colleague's new password could
  // then sign in as them, and every action would be logged as theirs.
  app.post('/hr/employees/:id/password-reset', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: person } = await supabaseAdmin.from('staff_members')
      .select('id, name, email, user_id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!person) return res.status(404).json({ error: 'Employee not found' })
    if (!person.user_id) {
      return res.status(409).json({ error: 'This employee has no login yet, so there is no password to reset.' })
    }

    // The address on the LOGIN, not the one typed on the employee record — resetting to
    // an address somebody edited into the HR record would be an account-takeover path.
    const { data: authUser, error: auErr } = await supabaseAdmin.auth.admin.getUserById(person.user_id)
    if (auErr || !authUser?.user?.email) {
      return res.status(409).json({ error: 'Could not read the login for this employee, so no reset was sent.' })
    }

    const result = await issuePasswordReset({ userId: person.user_id, email: authUser.user.email, req })
    audit(req, 'hr.password_reset_sent', {
      after_state: { staff_member_id: person.id, user_id: person.user_id, sent: result.sent, reason: result.reason || null },
    })
    if (!result.sent) {
      return res.status(502).json({ error: `The reset email was not sent: ${result.reason}. Nothing was changed.` })
    }
    res.json({ ok: true, sent_to: authUser.user.email })
  })
}
