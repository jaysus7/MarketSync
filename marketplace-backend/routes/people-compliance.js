/**
 * Compliance that can tell "nothing is wrong" from "nothing was ever set up" (PR 7.5).
 *
 * CURRENT TRUTH this replaces. `staff_compliance_dashboard_v` is well built and gated in the
 * database. It counts overdue policy acknowledgements, overdue training, expired
 * certifications, expired documents, overdue lifecycle tasks and open safety actions — and
 * EVERY one of those counters read a table with no producer. `staff_policies`,
 * `staff_policy_versions` and `staff_policy_acknowledgements` had zero references anywhere in
 * the codebase. `staff_lifecycle_assignments` had zero references despite 10 seeded templates
 * and 90 template tasks. So a dealership that had published no policy and started no
 * onboarding saw ALL ZEROS, which reads as "everybody is compliant".
 *
 * An absence of records is not evidence of compliance. It is the absence of evidence, and on a
 * compliance surface those two must never render the same way. That is what `coverage()` below
 * exists to say out loud.
 *
 * Two further rules carried from AGENTS.md A20:
 *
 *   • **An acknowledgement is evidence, so it records what was actually acknowledged.** The
 *     policy version's checksum is stored on the acknowledgement. If the text is later edited,
 *     the acknowledgement still names the exact wording the person agreed to — otherwise a
 *     dealership could rewrite a policy and claim everybody had already accepted it.
 *
 *   • **Only the person themselves can acknowledge.** A manager may assign, waive (with a
 *     recorded reason) or chase, and may never acknowledge on somebody's behalf. A signature
 *     somebody else supplied is not a signature.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { LIFECYCLE_TEMPLATES } from '../lifecycle-templates.js'

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

// ── Policies ────────────────────────────────────────────────────────────────

export async function createPolicy(dealershipId, { policyKey, title, category = 'general', summary = null, requiresAcknowledgement = true, reviewIntervalMonths = null, actorId = null }) {
  if (!policyKey || !title) return { ok: false, error: 'A policy needs a key and a title.' }
  const { data, error } = await supabaseAdmin.from('staff_policies').insert({
    dealership_id: dealershipId, policy_key: policyKey, title, category, summary,
    requires_acknowledgement: requiresAcknowledgement,
    review_interval_months: reviewIntervalMonths,
    next_review_on: reviewIntervalMonths ? addDays(reviewIntervalMonths * 30) : null,
    created_by: actorId, updated_by: actorId,
  }).select('*').single()
  if (error) {
    if (/duplicate key/i.test(error.message)) return { ok: false, error: 'A policy with that key already exists here.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, policy: data }
}

/**
 * Publish a version of a policy's text.
 *
 * A version is immutable once published — editing published wording is how an acknowledgement
 * silently becomes a claim about text the person never read. Changing a policy means
 * publishing the next version, which is what `supersedes_version_id` records. That rule is
 * enforced by the pre-existing `protect_staff_policy_version()` trigger, not by this function.
 *
 * The checksum is NOT sent from here: the same trigger computes it on publish and would
 * override anything supplied. Sending a value that gets silently replaced is how two different
 * checksums for one policy end up in circulation, so this reads back what the database stored.
 */
export async function publishPolicyVersion(dealershipId, policyId, { contentText, effectiveOn = null, actorId = null }) {
  if (!contentText || !String(contentText).trim()) {
    return { ok: false, error: 'A policy version needs its text. There is nothing to acknowledge otherwise.' }
  }
  const { data: policy } = await supabaseAdmin.from('staff_policies')
    .select('id').eq('id', policyId).eq('dealership_id', dealershipId).maybeSingle()
  if (!policy) return { ok: false, error: 'That policy was not found.' }

  const { data: latest } = await supabaseAdmin.from('staff_policy_versions')
    .select('id, version_number').eq('dealership_id', dealershipId).eq('policy_id', policyId)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('staff_policy_versions').insert({
    dealership_id: dealershipId, policy_id: policyId,
    version_number: (latest?.version_number || 0) + 1,
    status: 'published', content_format: 'markdown', content_text: contentText,
    effective_on: effectiveOn || today(),
    published_at: now, published_by: actorId,
    supersedes_version_id: latest?.id || null,
    created_by: actorId, updated_by: actorId,
  }).select('*').single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, version: data }
}

/**
 * Assign a published version to people. Idempotent per (version, employee) so re-running
 * chases rather than duplicating.
 */
export async function assignPolicy(dealershipId, versionId, { staffMemberIds = null, dueInDays = 14, actorId = null } = {}) {
  const { data: version } = await supabaseAdmin.from('staff_policy_versions')
    .select('id, policy_id, status').eq('id', versionId).eq('dealership_id', dealershipId).maybeSingle()
  if (!version) return { ok: false, error: 'That policy version was not found.' }
  if (version.status !== 'published') return { ok: false, error: 'A draft version cannot be assigned — publish it first.' }

  let ids = staffMemberIds
  if (!ids || !ids.length) {
    // Everybody currently employed. A terminated employee is not asked to acknowledge.
    const { data: staff } = await supabaseAdmin.from('staff_members')
      .select('id').eq('dealership_id', dealershipId).in('employment_status', ['invited', 'active', 'on_leave'])
    ids = (staff || []).map(s => s.id)
  }
  if (!ids.length) return { ok: true, assigned: 0, note: 'There is nobody employed here to assign it to.' }

  const rows = ids.map(staff_member_id => ({
    dealership_id: dealershipId, policy_version_id: versionId, staff_member_id,
    status: 'assigned', assigned_by: actorId, due_at: new Date(Date.now() + dueInDays * 86400000).toISOString(),
  }))
  const { data, error } = await supabaseAdmin.from('staff_policy_acknowledgements')
    .upsert(rows, { onConflict: 'policy_version_id,staff_member_id', ignoreDuplicates: true }).select('id')
  if (error) return { ok: false, error: error.message }
  return { ok: true, assigned: (data || []).length, targeted: ids.length }
}

/**
 * Acknowledge — the only place a policy becomes evidence.
 *
 * `acknowledged_by_user_id` is the CALLER, never a parameter: a manager cannot acknowledge for
 * somebody else, because a signature somebody else supplied is not a signature. The IP and
 * user agent are recorded because "who agreed, to what text, from where and when" is the whole
 * content of the evidence.
 */
export async function acknowledgePolicy(dealershipId, acknowledgementId, { userId, ip = null, userAgent = null }) {
  const { data: ack } = await supabaseAdmin.from('staff_policy_acknowledgements')
    .select('id, staff_member_id, status, policy_version_id, version:staff_policy_versions(checksum_sha256, status)')
    .eq('id', acknowledgementId).eq('dealership_id', dealershipId).maybeSingle()
  if (!ack) return { ok: false, error: 'That acknowledgement was not found.' }
  if (ack.status === 'acknowledged') return { ok: false, error: 'You have already acknowledged this.' }

  // The checksum of the text being agreed to is captured ON the acknowledgement. Reading it
  // through the version at display time would let a retired or renamed policy change what the
  // evidence appears to say; the database refuses an acknowledgement without it.
  const checksum = ack.version?.checksum_sha256
  if (!checksum) {
    return { ok: false, error: 'That policy version has no published text, so there is nothing to acknowledge.' }
  }

  // The acknowledgement must belong to the person doing it.
  const { data: staff } = await supabaseAdmin.from('staff_members')
    .select('id').eq('dealership_id', dealershipId).eq('user_id', userId).maybeSingle()
  if (!staff || staff.id !== ack.staff_member_id) {
    return { ok: false, error: 'Only the person it was assigned to can acknowledge a policy.' }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('staff_policy_acknowledgements')
    .update({
      status: 'acknowledged', acknowledged_at: now, acknowledged_by_user_id: userId,
      acknowledged_checksum_sha256: checksum,
      acknowledgment_ip: ip, acknowledgment_user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      updated_at: now,
    })
    .eq('id', acknowledgementId).eq('dealership_id', dealershipId).neq('status', 'acknowledged')
    .select('*').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'You have already acknowledged this.' }
  return { ok: true, acknowledgement: data }
}

// ── Onboarding and offboarding checklists ───────────────────────────────────

/**
 * Give a dealership the core templates if it has none.
 *
 * Five dealerships were seeded with these once; every dealership created since has had NO
 * templates at all, so onboarding could never be assigned there — the templates themselves
 * had no producer. Keyed on `system_key` + `task_key`, so re-running corrects wording rather
 * than growing a second copy.
 */
export async function ensureLifecycleTemplates(dealershipId, { actorId = null } = {}) {
  const created = []
  for (const tpl of LIFECYCLE_TEMPLATES) {
    let { data: existing } = await supabaseAdmin.from('staff_lifecycle_templates')
      .select('id').eq('dealership_id', dealershipId).eq('system_key', tpl.system_key).maybeSingle()

    if (!existing) {
      const { data, error } = await supabaseAdmin.from('staff_lifecycle_templates').insert({
        dealership_id: dealershipId, name: tpl.name, lifecycle_type: tpl.lifecycle_type,
        description: tpl.description, system_key: tpl.system_key, is_system_template: true,
        jurisdiction: 'global', active: true, created_by: actorId, updated_by: actorId,
      }).select('id').single()
      if (error) return { ok: false, error: error.message }
      existing = data
      created.push(tpl.system_key)
    }

    const rows = tpl.tasks.map(t => ({
      dealership_id: dealershipId, template_id: existing.id, task_key: t.task_key,
      title: t.title, description: t.description, category: t.category,
      due_offset_days: t.due_offset_days, assignee_type: t.assignee_type,
      required: t.required, sort_order: t.sort_order,
    }))
    const { error: taskErr } = await supabaseAdmin.from('staff_lifecycle_template_tasks')
      .upsert(rows, { onConflict: 'template_id,task_key' })
    if (taskErr) return { ok: false, error: taskErr.message }
  }
  return { ok: true, created }
}

/**
 * Start somebody's onboarding — the remedy PR 7.1's `onboarding_not_started` never had.
 *
 * The tasks are COPIED from the template rather than referenced, so editing the template later
 * cannot rewrite a checklist somebody has already been working through.
 */
export async function startLifecycle(dealershipId, staffMemberId, lifecycleType, { actorId = null, startsOn = null } = {}) {
  const { data: staff } = await supabaseAdmin.from('staff_members')
    .select('id, name').eq('id', staffMemberId).eq('dealership_id', dealershipId).maybeSingle()
  if (!staff) return { ok: false, error: 'That employee was not found.' }

  const { data: open } = await supabaseAdmin.from('staff_lifecycle_assignments')
    .select('id, status').eq('dealership_id', dealershipId).eq('staff_member_id', staffMemberId)
    .eq('lifecycle_type', lifecycleType).neq('status', 'completed').maybeSingle()
  if (open) return { ok: false, error: `${staff.name} already has ${lifecycleType} in progress.`, assignment_id: open.id }

  await ensureLifecycleTemplates(dealershipId, { actorId })

  const { data: template } = await supabaseAdmin.from('staff_lifecycle_templates')
    .select('id, name').eq('dealership_id', dealershipId).eq('lifecycle_type', lifecycleType)
    .eq('active', true).order('is_system_template', { ascending: false }).limit(1).maybeSingle()
  if (!template) return { ok: false, error: `This dealership has no active ${lifecycleType} template.` }

  const { data: tasks } = await supabaseAdmin.from('staff_lifecycle_template_tasks')
    .select('*').eq('template_id', template.id).order('sort_order')
  if (!tasks || !tasks.length) {
    // An assignment with no tasks would report as "onboarding started" and ask for nothing.
    return { ok: false, error: `The ${lifecycleType} template has no tasks, so starting it would ask for nothing.` }
  }

  const start = startsOn || today()
  const { data: assignment, error } = await supabaseAdmin.from('staff_lifecycle_assignments').insert({
    dealership_id: dealershipId, staff_member_id: staffMemberId, template_id: template.id,
    lifecycle_type: lifecycleType, status: 'in_progress', starts_on: start,
    target_completion_on: addDays(Math.max(...tasks.map(t => t.due_offset_days || 0))),
    assigned_by: actorId,
  }).select('*').single()
  if (error) return { ok: false, error: error.message }

  const taskRows = tasks.map(t => ({
    dealership_id: dealershipId, assignment_id: assignment.id, staff_member_id: staffMemberId,
    template_task_id: t.id, title: t.title, description: t.description, category: t.category,
    due_on: addDays(t.due_offset_days || 0), status: 'pending',
    required: t.required, sort_order: t.sort_order,
    assignee_staff_id: t.assignee_type === 'employee' ? staffMemberId : (t.default_assignee_staff_id || null),
  }))
  const { error: taskErr } = await supabaseAdmin.from('staff_lifecycle_tasks').insert(taskRows)
  if (taskErr) {
    // A started lifecycle with no tasks is worse than an unstarted one, so it does not survive.
    await supabaseAdmin.from('staff_lifecycle_assignments').delete().eq('id', assignment.id)
    return { ok: false, error: taskErr.message }
  }

  return { ok: true, assignment, tasks: taskRows.length }
}

export async function completeLifecycleTask(dealershipId, taskId, { actorId = null, blockedReason = null } = {}) {
  const now = new Date().toISOString()
  const patch = blockedReason
    ? { status: 'blocked', blocked_reason: String(blockedReason).slice(0, 500), updated_at: now }
    : { status: 'completed', completed_at: now, completed_by: actorId, blocked_reason: null, updated_at: now }

  const { data, error } = await supabaseAdmin.from('staff_lifecycle_tasks')
    .update(patch).eq('id', taskId).eq('dealership_id', dealershipId).select('*').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That task was not found.' }

  // The assignment completes only when every REQUIRED task is done — an optional task left
  // undone is not a reason to hold somebody's onboarding open.
  const { data: siblings } = await supabaseAdmin.from('staff_lifecycle_tasks')
    .select('status, required').eq('dealership_id', dealershipId).eq('assignment_id', data.assignment_id)
  const outstanding = (siblings || []).filter(s => s.required && s.status !== 'completed').length
  if (!outstanding) {
    await supabaseAdmin.from('staff_lifecycle_assignments')
      .update({ status: 'completed', completed_at: now, completed_by: actorId, updated_at: now })
      .eq('id', data.assignment_id).eq('dealership_id', dealershipId)
  }
  return { ok: true, task: data, outstanding_required: outstanding, assignment_complete: outstanding === 0 }
}

// ── The honesty layer ───────────────────────────────────────────────────────

/**
 * What compliance can actually SEE.
 *
 * Every counter on the compliance dashboard reads a table. If nothing has ever been written to
 * that table, a count of zero means "not measured", not "nothing wrong". This reports the two
 * separately so a screen can never render an absence of records as a clean bill of health.
 */
export async function coverage(dealershipId) {
  const count = async (table, build = (q) => q) => {
    const { count: n, error } = await build(
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId),
    )
    // A failed count is `null`, never 0 — an unreadable table must not read as an empty one.
    return error ? null : (n ?? 0)
  }

  const [staff, publishedVersions, acknowledgements, onboarding, training, documents] = await Promise.all([
    count('staff_members', q => q.in('employment_status', ['invited', 'active', 'on_leave'])),
    count('staff_policy_versions', q => q.eq('status', 'published')),
    count('staff_policy_acknowledgements'),
    count('staff_lifecycle_assignments', q => q.eq('lifecycle_type', 'onboarding')),
    count('staff_training_assignments'),
    count('staff_documents', q => q.is('deleted_at', null)),
  ])

  const area = (key, label, records, note) => ({
    key, label,
    measured: records != null && records > 0,
    records,
    // What a zero on the dashboard means for this area, in words.
    means: records == null ? 'could not be read'
      : records > 0 ? 'measured — a zero here means nothing is outstanding'
      : note,
  })

  const areas = [
    area('policies', 'Policy acknowledgement', publishedVersions,
      'no policy has been published, so nothing has been asked of anybody'),
    area('acknowledgements', 'Acknowledgements on record', acknowledgements,
      'no policy has been assigned to anybody'),
    area('onboarding', 'Onboarding', onboarding,
      'no employee has been taken through onboarding'),
    area('training', 'Required training', training,
      'no training has been assigned'),
    area('documents', 'Employee documents', documents,
      'no employee document has been uploaded'),
  ]

  const unmeasured = areas.filter(a => !a.measured)
  return {
    employees: staff,
    areas,
    // The single fact a compliance screen must not omit.
    fully_measured: unmeasured.length === 0,
    unmeasured: unmeasured.map(a => a.key),
    headline: unmeasured.length === 0
      ? 'Every compliance area has records behind it.'
      : `${unmeasured.length} of ${areas.length} compliance areas have no records at all — a zero in those is an absence of evidence, not evidence of compliance.`,
  }
}

/** Compliance items for My Day. Only things somebody can actually act on. */
export async function complianceAttention(dealershipId) {
  const now = new Date().toISOString()
  const [{ data: overdueAcks }, { data: overdueTasks }, cov] = await Promise.all([
    supabaseAdmin.from('staff_policy_acknowledgements')
      .select('id, staff_member_id, due_at').eq('dealership_id', dealershipId)
      .neq('status', 'acknowledged').neq('status', 'waived').lt('due_at', now).limit(100),
    supabaseAdmin.from('staff_lifecycle_tasks')
      .select('id, title, due_on, status').eq('dealership_id', dealershipId)
      .in('status', ['pending', 'in_progress', 'blocked']).lt('due_on', today()).limit(100),
    coverage(dealershipId),
  ])

  const items = []
  for (const a of overdueAcks || []) {
    items.push({
      kind: 'policy_unacknowledged', severity: 3,
      subject: 'A policy is past its acknowledgement date',
      reason: `Due ${String(a.due_at).slice(0, 10)} and not acknowledged`,
      owner: 'People', action: 'Chase acknowledgement', ref: a.id,
    })
  }
  for (const t of overdueTasks || []) {
    items.push({
      kind: 'onboarding_task_overdue', severity: t.status === 'blocked' ? 3 : 2,
      subject: t.title,
      reason: t.status === 'blocked' ? 'Blocked and past due' : `Due ${t.due_on} and not complete`,
      owner: 'People', action: 'Complete task', ref: t.id,
    })
  }
  // The absence itself is the finding. Without this, a dealership measuring nothing has a
  // permanently clear compliance queue.
  if (cov.unmeasured.length) {
    items.push({
      kind: 'compliance_not_measured', severity: 2,
      subject: 'Compliance is reporting on areas with no records',
      reason: cov.headline,
      owner: 'People', action: 'Set up compliance', ref: 'compliance-coverage',
    })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerPeopleCompliance(app) {
  const canView = requirePermission('staff.compliance.view')
  const canManage = requirePermission('staff.compliance.manage')
  const canPolicyManage = requirePermission('staff.policy.manage')
  const canSelf = requirePermission('staff.documents.self')

  const dealership = (req, res, next) =>
    req.dealershipId ? next() : res.status(400).json({ error: 'No dealership' })

  app.get('/hr/compliance/coverage', requireAuth, canView, dealership, async (req, res) => {
    try { res.json(await coverage(req.dealershipId)) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/hr/compliance/attention', requireAuth, canView, dealership, async (req, res) => {
    try { res.json({ items: await complianceAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Policies ──────────────────────────────────────────────────────────────

  app.get('/hr/policies', requireAuth, requirePermission('staff.policy.view'), dealership, async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('staff_policies')
        .select('*, versions:staff_policy_versions(id, version_number, status, effective_on, published_at, checksum_sha256)')
        .eq('dealership_id', req.dealershipId).eq('active', true).order('title')
      res.json({ policies: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/policies', requireAuth, requireMfa, canPolicyManage, dealership, async (req, res) => {
    try {
      const r = await createPolicy(req.dealershipId, {
        policyKey: req.body?.policy_key, title: req.body?.title,
        category: req.body?.category, summary: req.body?.summary,
        requiresAcknowledgement: req.body?.requires_acknowledgement !== false,
        reviewIntervalMonths: req.body?.review_interval_months || null,
        actorId: req.user.id,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.policy_created', { after_state: { policy_id: r.policy.id, key: r.policy.policy_key } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/policies/:id/versions', requireAuth, requireMfa, canPolicyManage, dealership, async (req, res) => {
    try {
      const r = await publishPolicyVersion(req.dealershipId, req.params.id, {
        contentText: req.body?.content_text, effectiveOn: req.body?.effective_on, actorId: req.user.id,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.policy_version_published', {
        after_state: { policy_id: req.params.id, version: r.version.version_number, checksum: r.version.checksum_sha256 },
      })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/policies/versions/:id/assign', requireAuth, requireMfa, canManage, dealership, async (req, res) => {
    try {
      const r = await assignPolicy(req.dealershipId, req.params.id, {
        staffMemberIds: req.body?.staff_member_ids || null,
        dueInDays: Number(req.body?.due_in_days) || 14, actorId: req.user.id,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.policy_assigned', { after_state: { version_id: req.params.id, assigned: r.assigned } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /** What this person still has to acknowledge, and the text they would be agreeing to. */
  app.get('/hr/policies/mine', requireAuth, canSelf, dealership, async (req, res) => {
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id').eq('dealership_id', req.dealershipId).eq('user_id', req.user.id).maybeSingle()
      if (!staff) return res.json({ acknowledgements: [] })
      const { data } = await supabaseAdmin.from('staff_policy_acknowledgements')
        .select('id, status, due_at, acknowledged_at, version:staff_policy_versions(id, version_number, content_text, effective_on, policy:staff_policies(title, summary, category))')
        .eq('dealership_id', req.dealershipId).eq('staff_member_id', staff.id).order('due_at')
      res.json({ acknowledgements: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/policies/acknowledgements/:id/acknowledge', requireAuth, canSelf, dealership, async (req, res) => {
    try {
      const r = await acknowledgePolicy(req.dealershipId, req.params.id, {
        userId: req.user.id, ip: req.ip || null, userAgent: req.get('user-agent') || null,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.policy_acknowledged', { after_state: { acknowledgement_id: req.params.id } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Onboarding / offboarding checklists ───────────────────────────────────

  app.get('/hr/lifecycle/templates', requireAuth, canView, dealership, async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('staff_lifecycle_templates')
        .select('id, name, lifecycle_type, system_key, active, tasks:staff_lifecycle_template_tasks(id)')
        .eq('dealership_id', req.dealershipId).eq('active', true)
      res.json({
        templates: (data || []).map(t => ({ ...t, task_count: (t.tasks || []).length, tasks: undefined })),
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/lifecycle/start', requireAuth, requireMfa, canManage, dealership, async (req, res) => {
    const type = String(req.body?.lifecycle_type || 'onboarding')
    if (!['onboarding', 'offboarding'].includes(type)) {
      return res.status(400).json({ error: 'lifecycle_type must be onboarding or offboarding.' })
    }
    if (!req.body?.staff_member_id) return res.status(400).json({ error: 'Which employee is this for?' })
    try {
      const r = await startLifecycle(req.dealershipId, req.body.staff_member_id, type, { actorId: req.user.id })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.lifecycle_started', {
        after_state: { staff_id: req.body.staff_member_id, type, assignment_id: r.assignment.id, tasks: r.tasks },
      })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/hr/lifecycle/assignments', requireAuth, canView, dealership, async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('staff_lifecycle_assignments')
        .select('*, tasks:staff_lifecycle_tasks(id, title, status, due_on, required, blocked_reason)')
        .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
      res.json({ assignments: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/lifecycle/tasks/:id/complete', requireAuth, canManage, dealership, async (req, res) => {
    try {
      const r = await completeLifecycleTask(req.dealershipId, req.params.id, {
        actorId: req.user.id, blockedReason: req.body?.blocked_reason || null,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.lifecycle_task_updated', {
        after_state: { task_id: req.params.id, status: r.task.status, outstanding_required: r.outstanding_required },
      })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
