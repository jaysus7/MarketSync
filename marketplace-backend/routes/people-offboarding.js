/**
 * Offboarding — leaving properly (Phase 7 PR 7.2).
 *
 * What exists today is one line:
 *
 *     await supabaseAdmin.from('profiles').update({ active: false })
 *
 * That single flag does more than it looks like: `requireAuth` re-reads the profile on every
 * request and returns `ACCOUNT_DEACTIVATED`, so a departed person really is locked out
 * immediately, even holding a live token. Access revocation is **not** the gap.
 *
 * What it does not do is everything else:
 *
 *   • Roles are never revoked. `user_roles` survives the departure, so the moment anyone
 *     reactivates the account — to check something, to rehire — every permission comes back
 *     silently and nobody chose that.
 *   • **Owned work is orphaned.** A salesperson leaves and their entire customer book stays
 *     assigned to them. Nobody is following up, and nothing says so. This is the real damage,
 *     and it is invisible precisely because the account looks handled.
 *   • Employment is untouched: `staff_members` never learns the person left.
 *   • There is no reason, no date, no record that offboarding happened at all.
 *
 * So offboarding here is a workflow with an order, and it refuses to finish while the
 * dealership would be left with work nobody owns.
 *
 * WHAT IS NEVER REASSIGNED: `created_by`. Who did a thing is history, and history does not
 * change because someone resigned. Only *live ownership* moves.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { changeEmploymentStatus } from './people-identity.js'

/**
 * The live work this person owns. Each entry is something a customer is waiting on, or a
 * commitment the dealership made — not a historical authorship record.
 */
const OWNERSHIP = [
  {
    key: 'customers', label: 'customers', table: 'contacts', column: 'assigned_rep',
    // A customer is never "done", so there is no open-filter here: the whole book moves.
    openFilter: null,
  },
  {
    key: 'tasks', label: 'open tasks', table: 'crm_tasks', column: 'assigned_to',
    openFilter: (q) => q.eq('done', false),
  },
  {
    key: 'repair_orders_advisor', label: 'open repair orders (advisor)', table: 'repair_orders', column: 'advisor_id',
    openFilter: (q) => q.is('closed_at', null),
  },
  {
    key: 'repair_orders_tech', label: 'open repair orders (technician)', table: 'repair_orders', column: 'technician_id',
    openFilter: (q) => q.is('closed_at', null),
  },
  {
    key: 'campaigns', label: 'campaigns', table: 'campaigns', column: 'owner_id',
    openFilter: (q) => q.is('deleted_at', null),
  },
]

/**
 * What would be left ownerless. Counted before anything is changed, so a manager can see the
 * consequence while it is still a decision.
 */
export async function ownedWork(dealershipId, userId) {
  const items = []
  for (const o of OWNERSHIP) {
    let q = supabaseAdmin.from(o.table).select('id', { count: 'exact', head: true })
      .eq('dealership_id', dealershipId).eq(o.column, userId)
    if (o.openFilter) q = o.openFilter(q)
    const { count, error } = await q
    if (error) {
      // A count we could not take is not a zero. Saying "nothing to reassign" because a query
      // failed is how the book gets orphaned quietly.
      items.push({ key: o.key, label: o.label, count: null, unknown: true, reason: error.message })
      continue
    }
    items.push({ key: o.key, label: o.label, count: count || 0, unknown: false })
  }
  const total = items.reduce((s, i) => s + (i.count || 0), 0)
  const unknown = items.some(i => i.unknown)
  return { items: items.filter(i => i.count !== 0 || i.unknown), total, unknown }
}

/**
 * Move live ownership from one person to another. Returns what actually moved, per kind,
 * because "reassigned" with no numbers is not something a manager can check.
 */
export async function reassignOwnedWork(dealershipId, fromUserId, toUserId) {
  const moved = []
  for (const o of OWNERSHIP) {
    let q = supabaseAdmin.from(o.table).update({ [o.column]: toUserId })
      .eq('dealership_id', dealershipId).eq(o.column, fromUserId)
    if (o.openFilter) q = o.openFilter(q)
    const { data, error } = await q.select('id')
    if (error) return { ok: false, error: `Could not reassign ${o.label}: ${error.message}`, moved }
    if ((data || []).length) moved.push({ key: o.key, label: o.label, count: data.length })
  }
  return { ok: true, moved }
}

/**
 * Take away everything the role grants. Separate from deactivation on purpose: deactivation
 * stops them signing in TODAY, and this stops the permissions coming back if the account is
 * ever reopened.
 */
export async function revokeRoles(dealershipId, userId) {
  const { data, error } = await supabaseAdmin.from('user_roles')
    .delete().eq('dealership_id', dealershipId).eq('user_id', userId).select('role_id')
  if (error) return { ok: false, error: error.message, revoked: [] }
  return { ok: true, revoked: (data || []).map(r => r.role_id) }
}

/**
 * Offboard, in an order that cannot leave the dealership worse off.
 *
 * The refusal is the point: while this person still owns live work and no successor is named,
 * completing would hand the dealership a silently ownerless customer book. It is better to
 * stop and say so.
 */
export async function offboardEmployee(dealershipId, {
  staffMemberId, userId, reason = null, reassignToUserId = null, actorId = null,
}) {
  if (!userId) return { ok: false, error: 'Offboarding needs the person, not just the employment record.' }
  if (userId === actorId) return { ok: false, error: 'You cannot offboard yourself.' }
  if (reassignToUserId && reassignToUserId === userId) {
    return { ok: false, error: 'Work cannot be reassigned to the person leaving.' }
  }

  // 1 — What would be left behind?
  const owned = await ownedWork(dealershipId, userId)
  if (owned.unknown) {
    return { ok: false, error: 'We could not read everything this person owns, so offboarding stopped rather than orphan it.', owned }
  }
  if (owned.total > 0 && !reassignToUserId) {
    return {
      ok: false,
      needs_reassignment: true,
      owned,
      error: `This person still owns ${owned.total} live record(s). Choose who takes them over before offboarding.`,
    }
  }

  // 2 — The successor must be a real, active member of THIS dealership.
  let movedWork = []
  if (reassignToUserId) {
    const { data: successor } = await supabaseAdmin.from('profiles')
      .select('id, dealership_id, active').eq('id', reassignToUserId).maybeSingle()
    if (!successor || successor.dealership_id !== dealershipId) {
      return { ok: false, error: 'That person was not found at this dealership.' }
    }
    if (successor.active === false) {
      return { ok: false, error: 'Work cannot be handed to a deactivated account.' }
    }
    const r = await reassignOwnedWork(dealershipId, userId, reassignToUserId)
    if (!r.ok) return { ok: false, error: r.error }
    movedWork = r.moved
  }

  // 3 — Revoke the roles, so nothing comes back on reactivation.
  const roles = await revokeRoles(dealershipId, userId)
  if (!roles.ok) return { ok: false, error: `Could not revoke roles: ${roles.error}` }

  // 4 — Stop them signing in. requireAuth re-reads this on every request, so it takes effect
  //     immediately for live tokens too.
  const { error: deactErr } = await supabaseAdmin.from('profiles')
    .update({ active: false }).eq('id', userId).eq('dealership_id', dealershipId)
  if (deactErr) return { ok: false, error: `Could not deactivate the account: ${deactErr.message}` }

  // 5 — Record that they left. Last, so a failure earlier never marks someone terminated who
  //     still holds access.
  let employment = null
  if (staffMemberId) {
    const t = await changeEmploymentStatus(dealershipId, staffMemberId, 'terminated', {
      actorId, reason: reason || 'Offboarded', allowTerminate: true,
    })
    if (!t.ok) return { ok: false, error: t.error, partial: true }
    employment = t.staff
    const stamp = `ARCHIVED ${new Date().toISOString().slice(0,10)}: ${reason || 'Offboarded'}`
    await supabaseAdmin.from('staff_members').update({
      notes: [t.staff?.notes, stamp].filter(Boolean).join('\n'),
      updated_by: actorId,
    }).eq('id', staffMemberId).eq('dealership_id', dealershipId)
  }

  return {
    ok: true,
    archived: true,
    deleted: false,
    employment,
    reassigned: movedWork,
    roles_revoked: roles.revoked,
    // History is deliberately untouched: created_by, audit rows, payroll and commission
    // obligations all survive. Someone leaving does not un-happen what they did.
    history_preserved: true,
  }
}

export function registerPeopleOffboarding(app) {
  const canManage = requirePermission('staff.lifecycle.manage')

  /**
   * What this person owns, before anyone decides anything.
   */
  app.get('/hr/employees/:id/owned-work', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id, user_id, name').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!staff) return res.status(404).json({ error: 'That employee was not found.' })
      if (!staff.user_id) return res.json({ owned: { items: [], total: 0, unknown: false }, employee: staff })
      res.json({ owned: await ownedWork(req.dealershipId, staff.user_id), employee: staff })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/employees/:id/offboard', requireAuth, requireMfa, canManage, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const { data: staff } = await supabaseAdmin.from('staff_members')
        .select('id, user_id, name, employment_status')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!staff) return res.status(404).json({ error: 'That employee was not found.' })

      const result = await offboardEmployee(req.dealershipId, {
        staffMemberId: staff.id,
        userId: staff.user_id,
        reason: req.body?.reason || null,
        reassignToUserId: req.body?.reassign_to || null,
        actorId: req.user.id,
      })
      if (!result.ok) {
        // A refusal that names what is in the way, not a bare 400.
        return res.status(result.needs_reassignment ? 409 : 400).json(result)
      }
      audit(req, 'people.employee_offboarded', {
        after_state: {
          id: staff.id, user_id: staff.user_id,
          roles_revoked: result.roles_revoked,
          reassigned: result.reassigned,
          reason: req.body?.reason || null,
        },
      })
      res.json({ ok: true, ...result })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
