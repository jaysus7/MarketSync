/**
 * Employee identity — the producer the People engine never had (Phase 7 PR 7.1).
 *
 * THE DEFECT this fixes: `staff_members` and its twenty satellite tables have held **zero
 * rows** since they were built, against seven real logins. `routes/hr.js` has no create route.
 * Nothing in registration, invitation or user management ever linked a login to an employment
 * record. So every People feature — onboarding, training, compliance, leave, payroll, assets,
 * time — answered every user with:
 *
 *     "No staff profile linked to your account"
 *
 * which was the correct behaviour for a person who, as far as the database was concerned, did
 * not work here. Sixth instance of the AGENTS.md A19 pattern this build: complete schema,
 * complete routes, no runtime producer.
 *
 * THE MODEL (A19's producer/consumer check, answered explicitly):
 *
 *   `profiles` is the PERSON — their login, and via `user_roles` their permissions. That path
 *   is frozen kernel and this file does not touch it.
 *   `staff_members` is their EMPLOYMENT at this dealership.
 *
 *   Who writes it?      → `ensureStaffMember`, called when a user is invited, and lazily on
 *                          first People read for logins that predate this code.
 *   What prevents dupes? → the database: `staff_members_dealership_user_uidx`, unique on
 *                          (dealership_id, user_id). Already existed; nothing had used it.
 *   Who reads it?        → every `/hr/*` route, through `selfStaffMemberId`.
 *   If the producer fails? → the caller is told. An employee who silently does not exist is
 *                          the bug we are fixing, so this never fails quietly.
 */
import { supabaseAdmin } from '../shared.js'

// The lifecycle the database already enforces (staff_members_employment_status_check).
// Named here so the transition rules and the constraint cannot drift apart.
export const EMPLOYMENT_STATES = ['invited', 'active', 'on_leave', 'suspended', 'terminated']

/**
 * Which moves are legal. `terminated` is deliberately terminal: rehiring is a new employment
 * record, not an edit to the old one, because the old one is the evidence of what happened.
 */
export const EMPLOYMENT_TRANSITIONS = {
  invited: ['active', 'terminated'],
  active: ['on_leave', 'suspended', 'terminated'],
  on_leave: ['active', 'terminated'],
  suspended: ['active', 'terminated'],
  terminated: [],
}

export function transitionError(from, to) {
  if (!EMPLOYMENT_STATES.includes(to)) return `${to} is not an employment status.`
  if (from === to) return `This employee is already ${to.replace(/_/g, ' ')}.`
  if (!EMPLOYMENT_STATES.includes(from)) return `${from} is not an employment status.`
  if (!(EMPLOYMENT_TRANSITIONS[from] || []).includes(to)) {
    return from === 'terminated'
      ? 'A terminated employee cannot be reactivated. Create a new employment record instead.'
      : `An employee cannot go from ${from.replace(/_/g, ' ')} to ${to.replace(/_/g, ' ')}.`
  }
  return null
}

// The legacy role label a login carries → the department an employee works in. Two vocabularies
// that already exist; this is the join, not a third one.
const ROLE_DEPARTMENT = {
  MANAGER: 'Management', SALES_REP: 'Sales', FNI: 'F&I',
  SERVICE: 'Service', ACCOUNTING: 'Accounting', CLEANUP: 'Recon',
}
export const departmentForRole = (role) => ROLE_DEPARTMENT[String(role || '').toUpperCase()] || null

/**
 * THE PRODUCER. Make sure this login has exactly one employment record, and return it.
 *
 * Idempotent by the database, not by a read-then-write: the unique index is what guarantees
 * one employee per login, so two concurrent calls cannot produce two employees. On the losing
 * side of that race we re-read rather than fail — the caller wanted an employee to exist, and
 * one does.
 *
 * `status` defaults to 'invited' for a newly created user and 'active' for a backfill, because
 * a login that has been working here for months is not waiting on an invitation.
 */
export async function ensureStaffMember(dealershipId, userId, {
  name = null, email = null, role = null, department = null, jobTitle = null,
  createdBy = null, status = 'invited',
} = {}) {
  if (!dealershipId || !userId) return { staff: null, created: false, error: 'A dealership and a user are required.' }

  const { data: existing } = await supabaseAdmin.from('staff_members')
    .select('*').eq('dealership_id', dealershipId).eq('user_id', userId).maybeSingle()
  if (existing) return { staff: existing, created: false, error: null }

  const insert = {
    dealership_id: dealershipId,
    user_id: userId,
    name: name || email || 'New employee',
    email: email || null,
    department: department || departmentForRole(role),
    job_title: jobTitle || null,
    employment_status: EMPLOYMENT_STATES.includes(status) ? status : 'invited',
    onboarding_status: 'not_started',
    compliance_status: 'not_started',
    active: status !== 'terminated',
    created_by: createdBy,
  }

  const { data, error } = await supabaseAdmin.from('staff_members').insert(insert).select('*').single()
  if (error) {
    // Lost the race against a concurrent create — the unique index did its job. The employee
    // exists, which is what was asked for.
    if (/duplicate key/i.test(error.message)) {
      const { data: raced } = await supabaseAdmin.from('staff_members')
        .select('*').eq('dealership_id', dealershipId).eq('user_id', userId).maybeSingle()
      if (raced) return { staff: raced, created: false, error: null }
    }
    return { staff: null, created: false, error: error.message }
  }

  await recordStatus(dealershipId, data.id, null, data.employment_status, {
    reason: 'Employment record created', actorId: createdBy,
  })
  return { staff: data, created: true, error: null }
}

async function recordStatus(dealershipId, staffMemberId, from, to, { reason = null, actorId = null } = {}) {
  // Best-effort relative to the employment record itself: the status on staff_members is what
  // every gate reads, so a failure to write history must never leave the status unwritten.
  try {
    const { error } = await supabaseAdmin.from('staff_status_history').insert({
      dealership_id: dealershipId, staff_member_id: staffMemberId,
      from_status: from, to_status: to, reason, changed_by: actorId,
    })
    if (error) console.error('[people] status history not recorded:', error.message)
  } catch (e) { console.error('[people] status history not recorded:', e.message) }
}

/**
 * Move an employee through the lifecycle, with the history written every time.
 *
 * Note what this does NOT do: revoking access. Termination here marks employment ended; the
 * offboarding workflow that revokes roles, invalidates sessions and reassigns owned work is
 * PR 7.2, and until it exists this route refuses to terminate rather than leaving a terminated
 * employee holding live access — which would be worse than not offering the button.
 */
export async function changeEmploymentStatus(dealershipId, staffMemberId, toStatus, {
  actorId = null, reason = null, allowTerminate = false,
} = {}) {
  const { data: staff } = await supabaseAdmin.from('staff_members')
    .select('id, dealership_id, employment_status')
    .eq('id', staffMemberId).eq('dealership_id', dealershipId).maybeSingle()
  if (!staff) return { ok: false, error: 'That employee was not found.' }

  const err = transitionError(staff.employment_status, toStatus)
  if (err) return { ok: false, error: err }

  if (toStatus === 'terminated' && !allowTerminate) {
    return {
      ok: false,
      error: 'Termination goes through offboarding, so access and owned work are handled. That workflow is not available yet.',
    }
  }

  const { data, error } = await supabaseAdmin.from('staff_members').update({
    employment_status: toStatus,
    active: toStatus !== 'terminated',
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  }).eq('id', staffMemberId).eq('dealership_id', dealershipId)
    .eq('employment_status', staff.employment_status)   // nobody moved it while we decided
    .select('*').maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'This employee changed while you were reviewing them.' }

  await recordStatus(dealershipId, staffMemberId, staff.employment_status, toStatus, { reason, actorId })
  return { ok: true, staff: data }
}

/**
 * The employee list, joined to the person. One identity, assembled — never a second copy.
 *
 * A login with no employment record is returned with `linked: false` rather than omitted:
 * hiding them is how the dealership ends up with people who can log in and do not appear in
 * their own team list.
 */
export async function teamDirectory(dealershipId) {
  const [{ data: staff }, { data: people }] = await Promise.all([
    supabaseAdmin.from('staff_members')
      .select('id, user_id, name, email, phone, department, job_title, team, location_name, manager_staff_id, employment_status, onboarding_status, compliance_status, employee_number, created_at')
      .eq('dealership_id', dealershipId).order('name'),
    supabaseAdmin.from('profiles')
      .select('id, full_name, role, department, active')
      .eq('dealership_id', dealershipId),
  ])

  const byUser = new Map()
  for (const s of staff || []) if (s.user_id) byUser.set(s.user_id, s)

  const rows = (staff || []).map(s => {
    const p = s.user_id ? (people || []).find(x => x.id === s.user_id) : null
    return {
      ...s,
      linked: !!s.user_id,
      login_role: p?.role || null,
      can_sign_in: p ? p.active !== false : false,
    }
  })

  // Logins that have no employment record yet — the state this whole slice exists to end.
  for (const p of people || []) {
    if (byUser.has(p.id)) continue
    rows.push({
      id: null, user_id: p.id, name: p.full_name || 'Unnamed user', email: null,
      department: p.department || departmentForRole(p.role), job_title: null,
      employment_status: null, onboarding_status: null, compliance_status: null,
      linked: false, login_role: p.role || null, can_sign_in: p.active !== false,
    })
  }
  return rows
}

/**
 * People attention, in the same shape every other department emits so My Day composes it
 * without special-casing.
 */
export async function peopleAttention(dealershipId) {
  const rows = await teamDirectory(dealershipId).catch(() => [])
  const items = []

  for (const r of rows) {
    if (!r.linked) {
      items.push({
        kind: 'employee_record_missing', severity: 2,
        subject: r.name,
        reason: 'This person can sign in but has no employment record, so onboarding, training and compliance cannot start',
        owner: 'People', action: 'Create employment record', ref: r.user_id,
      })
      continue
    }
    if (r.employment_status === 'invited') {
      items.push({
        kind: 'employee_never_activated', severity: 2,
        subject: r.name,
        reason: 'Invited but never activated — they cannot be scheduled or assigned work',
        owner: 'People', action: 'Activate employee', ref: r.id,
      })
    }
    if (r.employment_status === 'active' && r.onboarding_status === 'not_started') {
      items.push({
        kind: 'onboarding_not_started', severity: 1,
        subject: r.name,
        reason: 'Working here with no onboarding started',
        owner: 'People', action: 'Start onboarding', ref: r.id,
      })
    }
  }
  return items.sort((a, b) => b.severity - a.severity)
}
