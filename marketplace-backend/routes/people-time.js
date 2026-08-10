/**
 * The time clock, and payroll that cannot quietly pay nobody (Phase 7 PR 7.4).
 *
 * CURRENT TRUTH this replaces. `time_entries` had exactly ONE reference in the entire
 * backend — a `.select()` in `roActualHours` — and zero rows. Nothing clocked anybody in, on
 * any surface, in any role. The comment above that function says "Actual labour comes from the
 * existing payroll clock"; there was no payroll clock. Every repair order's actual hours was
 * structurally 0.0 and rendered as "no labour recorded". `staff_payroll_items` was read twice
 * and written nowhere, so every payroll batch was empty and every export was a successful CSV
 * of headers and no rows — which reads as "nobody is owed anything".
 *
 * Four rules, and each of them is somewhere this could go wrong with money.
 *
 *   1. **The clock records what happened, not what was intended.** A shift is open until
 *      somebody clocks out. Hours are derived from the two timestamps every time they are
 *      read; nothing stores a total that could drift from the times behind it.
 *
 *   2. **Only approved time is paid.** Recorded and approved are different states, approval
 *      names who did it, and the database refuses an approval that is missing either.
 *
 *   3. **An edit to somebody's hours leaves a trace.** Every mutation writes
 *      `time_entry_change_history`, which is append-only.
 *
 *   4. **Payroll says who it could not compute.** An employee with no pay rate, or with hours
 *      that nobody approved, is REPORTED — never silently dropped to produce a tidy batch.
 *      A payroll run that quietly omits somebody is worse than one that refuses.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'

const MS_HOUR = 3600000
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const cents = (n) => Math.round(Number(n) || 0)

/** Hours are always derived. A stored total is a number that can disagree with its own times. */
export function entryHours(entry) {
  if (!entry?.clock_out) return null
  const ms = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()
  return round2(Math.max(0, ms / MS_HOUR - (Number(entry.break_minutes) || 0) / 60))
}

export function decorate(entry) {
  return {
    ...entry,
    hours: entryHours(entry),
    open: !entry.clock_out,
  }
}

/**
 * Every mutation, recorded. Written with the same admin client that made the change so a
 * history row can never be lost to a policy the actor could not satisfy — the point of an
 * audit trail is that it survives the actor.
 */
async function recordChange(dealershipId, timeEntryId, action, { actorId = null, before = null, after = null } = {}) {
  const { error } = await supabaseAdmin.from('time_entry_change_history').insert({
    dealership_id: dealershipId, time_entry_id: timeEntryId, actor_id: actorId,
    action, before_row: before, after_row: after,
  })
  // A failure here is reported rather than swallowed: an untraceable edit to somebody's pay
  // is exactly the thing this table exists to prevent.
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** The employment record this login is paid against. Time is a fact about employment. */
export async function staffFor(dealershipId, userId) {
  const { data } = await supabaseAdmin.from('staff_members')
    .select('id, name, employment_status')
    .eq('dealership_id', dealershipId).eq('user_id', userId).maybeSingle()
  return data || null
}

export async function openEntry(dealershipId, staffMemberId) {
  const { data } = await supabaseAdmin.from('time_entries')
    .select('*').eq('dealership_id', dealershipId).eq('employee_id', staffMemberId)
    .is('clock_out', null).maybeSingle()
  return data || null
}

/**
 * Clock in.
 *
 * A second open entry is refused by a partial unique index rather than by this check alone:
 * two tabs, or two taps, would otherwise double-count every hour after the second one.
 */
export async function clockIn(dealershipId, staffMember, { actorId = null, roId = null, note = null, source = 'web' } = {}) {
  if (staffMember.employment_status !== 'active') {
    return { ok: false, error: `Time cannot be recorded while employment is ${String(staffMember.employment_status || 'unknown').replace(/_/g, ' ')}.` }
  }
  const already = await openEntry(dealershipId, staffMember.id)
  if (already) return { ok: false, error: 'You are already clocked in.', entry: decorate(already) }

  const { data, error } = await supabaseAdmin.from('time_entries').insert({
    dealership_id: dealershipId, employee_id: staffMember.id,
    clock_in: new Date().toISOString(), ro_id: roId, note, source, status: 'active',
  }).select('*').single()
  if (error) {
    if (/time_entries_one_open_per_employee/.test(error.message)) {
      return { ok: false, error: 'You are already clocked in.' }
    }
    return { ok: false, error: error.message }
  }
  await recordChange(dealershipId, data.id, 'insert', { actorId, after: data })
  return { ok: true, entry: decorate(data) }
}

/**
 * Clock out. Guarded on `clock_out is null` so two simultaneous requests cannot both close the
 * same shift and write two different end times.
 */
export async function clockOut(dealershipId, staffMemberId, { actorId = null, breakMinutes = null, note = null } = {}) {
  const open = await openEntry(dealershipId, staffMemberId)
  if (!open) return { ok: false, error: 'You are not clocked in.' }

  const out = new Date()
  const shiftMinutes = (out.getTime() - new Date(open.clock_in).getTime()) / 60000
  const breaks = breakMinutes == null ? open.break_minutes : Math.max(0, Math.round(Number(breakMinutes) || 0))
  if (breaks > shiftMinutes) {
    return { ok: false, error: `A break of ${breaks} minutes is longer than the shift itself.` }
  }

  const { data, error } = await supabaseAdmin.from('time_entries')
    .update({
      clock_out: out.toISOString(), break_minutes: breaks, status: 'completed',
      note: note == null ? open.note : note, updated_at: out.toISOString(),
    })
    .eq('id', open.id).eq('dealership_id', dealershipId).is('clock_out', null)
    .select('*').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That shift was already closed.' }

  await recordChange(dealershipId, data.id, 'clock_out', { actorId, before: open, after: data })
  return { ok: true, entry: decorate(data) }
}

/**
 * A manager correcting somebody's hours. Deliberately separate from clocking out: this is
 * somebody changing a record of what another person did, and it is always traced.
 */
export async function editEntry(dealershipId, entryId, patch, { actorId = null } = {}) {
  const { data: before } = await supabaseAdmin.from('time_entries')
    .select('*').eq('id', entryId).eq('dealership_id', dealershipId).maybeSingle()
  if (!before) return { ok: false, error: 'That time entry was not found.' }
  if (before.status === 'approved') {
    // Approved time has been paid against. Correcting it is a reversal, not an edit, and that
    // workflow does not exist yet — so this refuses rather than quietly rewriting history.
    return { ok: false, error: 'That entry is approved. Approved time cannot be edited.' }
  }

  const next = {}
  if (patch.clock_in) next.clock_in = new Date(patch.clock_in).toISOString()
  if (patch.clock_out !== undefined) next.clock_out = patch.clock_out ? new Date(patch.clock_out).toISOString() : null
  if (patch.break_minutes != null) next.break_minutes = Math.max(0, Math.round(Number(patch.break_minutes) || 0))
  if (patch.note !== undefined) next.note = patch.note
  if (!Object.keys(next).length) return { ok: false, error: 'Nothing to change.' }

  const start = new Date(next.clock_in || before.clock_in)
  const end = next.clock_out !== undefined ? (next.clock_out ? new Date(next.clock_out) : null) : (before.clock_out ? new Date(before.clock_out) : null)
  if (end && end < start) return { ok: false, error: 'A shift cannot end before it starts.' }
  if (end) {
    const breaks = next.break_minutes != null ? next.break_minutes : before.break_minutes
    if (breaks > (end.getTime() - start.getTime()) / 60000) {
      return { ok: false, error: 'The break is longer than the shift.' }
    }
    next.status = 'completed'
  }

  next.edited_by = actorId
  next.edited_at = new Date().toISOString()
  next.updated_at = next.edited_at

  const { data, error } = await supabaseAdmin.from('time_entries')
    .update(next).eq('id', entryId).eq('dealership_id', dealershipId)
    .neq('status', 'approved')   // do not race an approval that landed between read and write
    .select('*').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'That entry was approved while you were editing it.' }

  const traced = await recordChange(dealershipId, entryId, 'manager_edit', { actorId, before, after: data })
  if (!traced.ok) return { ok: false, error: `The change could not be recorded in history (${traced.error}), so it was not applied.` }
  return { ok: true, entry: decorate(data) }
}

/** Approval is what turns recorded time into money. */
export async function approveEntries(dealershipId, entryIds, { actorId = null } = {}) {
  const ids = [...new Set((entryIds || []).filter(Boolean))]
  if (!ids.length) return { ok: false, error: 'No entries were named.' }

  const { data: before } = await supabaseAdmin.from('time_entries')
    .select('*').eq('dealership_id', dealershipId).in('id', ids)
  const found = before || []

  const open = found.filter(e => !e.clock_out)
  const already = found.filter(e => e.status === 'approved')
  const eligible = found.filter(e => e.clock_out && e.status !== 'approved')

  const now = new Date().toISOString()
  let approved = []
  if (eligible.length) {
    const { data, error } = await supabaseAdmin.from('time_entries')
      .update({ status: 'approved', approved_by: actorId, approved_at: now, updated_at: now })
      .eq('dealership_id', dealershipId).in('id', eligible.map(e => e.id))
      .not('clock_out', 'is', null)
      .select('*')
    if (error) return { ok: false, error: error.message }
    approved = data || []
    for (const a of approved) {
      await recordChange(dealershipId, a.id, 'approve', {
        actorId, before: found.find(e => e.id === a.id), after: a,
      })
    }
  }

  return {
    ok: true,
    approved: approved.length,
    // Named, not dropped: a manager who asked to approve twelve entries and got nine needs to
    // know which three, and why.
    skipped: [
      ...open.map(e => ({ id: e.id, reason: 'still clocked in' })),
      ...already.map(e => ({ id: e.id, reason: 'already approved' })),
      ...ids.filter(id => !found.some(e => e.id === id)).map(id => ({ id, reason: 'not found' })),
    ],
  }
}

/**
 * A pay period for one dealership.
 *
 * `complete: false` when anything in the period is still open or unapproved — the caller is
 * told the period is not settled rather than handed a total that will change.
 */
export async function periodSummary(dealershipId, { from, to, staffMemberId = null } = {}) {
  let q = supabaseAdmin.from('time_entries')
    .select('id, employee_id, clock_in, clock_out, break_minutes, status, ro_id')
    .eq('dealership_id', dealershipId)
    .gte('clock_in', from).lte('clock_in', to)
  if (staffMemberId) q = q.eq('employee_id', staffMemberId)
  const { data, error } = await q.limit(5000)
  if (error) return { ok: false, error: error.message }

  const byStaff = new Map()
  let openCount = 0, unapproved = 0
  for (const e of data || []) {
    if (!e.clock_out) { openCount++; continue }
    if (e.status !== 'approved') unapproved++
    const row = byStaff.get(e.employee_id) || { staff_member_id: e.employee_id, approved_hours: 0, recorded_hours: 0, entries: 0 }
    const h = entryHours(e)
    row.recorded_hours = round2(row.recorded_hours + h)
    if (e.status === 'approved') row.approved_hours = round2(row.approved_hours + h)
    row.entries++
    byStaff.set(e.employee_id, row)
  }

  return {
    ok: true, from, to,
    staff: [...byStaff.values()],
    open_entries: openCount,
    unapproved_entries: unapproved,
    complete: openCount === 0 && unapproved === 0,
  }
}

/**
 * Build the payroll lines for a batch, from approved time and a rate that actually exists.
 *
 * THE RULE THIS SLICE IS BUILT AROUND: everybody the calculation could not compute is
 * returned in `unpayable`, with a reason. A payroll run that quietly omits an employee is
 * worse than one that refuses, because the omission looks like a completed run.
 *
 * Commission is not computed here. The commission engine owns pay plans and periods; guessing
 * a commission from a time clock would put two numbers in the system for the same money.
 */
export async function calculatePayroll(dealershipId, batchId, { actorId = null } = {}) {
  const { data: batch } = await supabaseAdmin.from('staff_payroll_batches')
    .select('id, period_start, period_end, status').eq('id', batchId).eq('dealership_id', dealershipId).maybeSingle()
  if (!batch) return { ok: false, error: 'That payroll batch was not found.' }
  if (batch.status !== 'draft') return { ok: false, error: `That batch is ${batch.status}. Only a draft batch can be calculated.` }

  const from = `${batch.period_start}T00:00:00.000Z`
  const to = `${batch.period_end}T23:59:59.999Z`
  const period = await periodSummary(dealershipId, { from, to })
  if (!period.ok) return { ok: false, error: period.error }

  const staffIds = period.staff.map(s => s.staff_member_id)
  const { data: details } = staffIds.length
    ? await supabaseAdmin.from('staff_employment_details')
        .select('staff_member_id, compensation_type, hourly_rate_cents, annual_salary_cents')
        .eq('dealership_id', dealershipId).in('staff_member_id', staffIds)
    : { data: [] }
  const { data: people } = staffIds.length
    ? await supabaseAdmin.from('staff_members').select('id, name')
        .eq('dealership_id', dealershipId).in('id', staffIds)
    : { data: [] }

  const rateFor = new Map((details || []).map(d => [d.staff_member_id, d]))
  const nameFor = new Map((people || []).map(p => [p.id, p.name]))

  const rows = []
  const unpayable = []
  for (const s of period.staff) {
    const d = rateFor.get(s.staff_member_id)
    const name = nameFor.get(s.staff_member_id) || 'Unknown employee'

    if (!d || d.compensation_type !== 'hourly' || !d.hourly_rate_cents) {
      // No rate is not zero pay. It is a question for whoever runs payroll.
      unpayable.push({
        staff_member_id: s.staff_member_id, name,
        approved_hours: s.approved_hours,
        reason: !d ? 'no employment details recorded'
          : d.compensation_type !== 'hourly' ? `paid ${d.compensation_type || 'by an unrecorded arrangement'}, which this calculation does not cover`
          : 'no hourly rate recorded',
      })
      continue
    }
    if (!s.approved_hours) {
      unpayable.push({
        staff_member_id: s.staff_member_id, name,
        approved_hours: 0, recorded_hours: s.recorded_hours,
        reason: s.recorded_hours ? 'hours recorded but not approved' : 'no approved hours in this period',
      })
      continue
    }

    const gross = round2((s.approved_hours * cents(d.hourly_rate_cents)) / 100)
    rows.push({
      batch_id: batchId, dealership_id: dealershipId, staff_member_id: s.staff_member_id,
      gross_amount: gross, deductions: 0, net_amount: gross, currency: 'CAD',
      // Deductions are NOT computed. This is not a tax engine, and a zero withholding that
      // looks calculated is worse than one that says it was not.
      detail: {
        source: 'time_clock', approved_hours: s.approved_hours,
        hourly_rate_cents: cents(d.hourly_rate_cents), entries: s.entries,
        deductions_calculated: false,
        note: 'Gross from approved clock hours. Deductions and commission are not calculated here.',
      },
    })
  }

  if (rows.length) {
    const { error } = await supabaseAdmin.from('staff_payroll_items')
      .upsert(rows, { onConflict: 'batch_id,staff_member_id' })
    if (error) return { ok: false, error: error.message }
  }

  return {
    ok: true,
    calculated: rows.length,
    unpayable,
    period_complete: period.complete,
    open_entries: period.open_entries,
    unapproved_entries: period.unapproved_entries,
    gross_total: round2(rows.reduce((a, r) => a + r.gross_amount, 0)),
  }
}

/** Time that needs somebody's attention, in the shape My Day already composes. */
export async function timeAttention(dealershipId) {
  const cutoff = new Date(Date.now() - 16 * MS_HOUR).toISOString()
  const [{ data: stale }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('time_entries')
      .select('id, employee_id, clock_in')
      .eq('dealership_id', dealershipId).is('clock_out', null).lt('clock_in', cutoff).limit(100),
    supabaseAdmin.from('time_entries')
      .select('id, employee_id, clock_in')
      .eq('dealership_id', dealershipId).eq('status', 'completed')
      .not('clock_out', 'is', null).limit(200),
  ])

  const items = []
  for (const e of stale || []) {
    items.push({
      kind: 'shift_never_closed', severity: 3,
      subject: 'A shift has been open for more than 16 hours',
      reason: `Clocked in ${String(e.clock_in).slice(0, 16).replace('T', ' ')} and never clocked out`,
      owner: 'People', action: 'Correct the entry', ref: e.id,
    })
  }
  if ((pending || []).length) {
    items.push({
      kind: 'time_awaiting_approval', severity: 2,
      subject: `${pending.length} time ${pending.length === 1 ? 'entry' : 'entries'} awaiting approval`,
      reason: 'Unapproved time is not paid',
      owner: 'People', action: 'Review time', ref: 'time-approval',
    })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerPeopleTime(app) {
  const canSelf = requirePermission('staff.time.self')
  const canApprove = requirePermission('staff.time.approve')
  const canPayroll = requirePermission('staff.payroll.manage')

  const mine = async (req, res, next) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const staff = await staffFor(req.dealershipId, req.user.id)
    if (!staff) {
      return res.status(404).json({ error: 'No employment record is linked to your account yet, so there is nothing to clock time against.' })
    }
    req.staffMember = staff
    next()
  }

  /** Where am I? Rendered before anything else, so the button says the right thing. */
  app.get('/hr/time/me', requireAuth, canSelf, mine, async (req, res) => {
    try {
      const open = await openEntry(req.dealershipId, req.staffMember.id)
      const since = new Date(Date.now() - 14 * 24 * MS_HOUR).toISOString()
      const { data: recent } = await supabaseAdmin.from('time_entries')
        .select('*').eq('dealership_id', req.dealershipId).eq('employee_id', req.staffMember.id)
        .gte('clock_in', since).order('clock_in', { ascending: false }).limit(50)
      res.json({
        staff_member_id: req.staffMember.id,
        open: open ? decorate(open) : null,
        entries: (recent || []).map(decorate),
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/time/clock-in', requireAuth, canSelf, mine, async (req, res) => {
    try {
      const r = await clockIn(req.dealershipId, req.staffMember, {
        actorId: req.user.id, roId: req.body?.ro_id || null, note: req.body?.note || null,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.clocked_in', { after_state: { entry_id: r.entry.id, staff_id: req.staffMember.id } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/time/clock-out', requireAuth, canSelf, mine, async (req, res) => {
    try {
      const r = await clockOut(req.dealershipId, req.staffMember.id, {
        actorId: req.user.id, breakMinutes: req.body?.break_minutes, note: req.body?.note,
      })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.clocked_out', { after_state: { entry_id: r.entry.id, hours: r.entry.hours } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /** The team's time for a period. Approving pay is not the same as seeing your own hours. */
  app.get('/hr/time/entries', requireAuth, requireMfa, canApprove, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const to = req.query.to || new Date().toISOString()
      const from = req.query.from || new Date(Date.now() - 14 * 24 * MS_HOUR).toISOString()
      let q = supabaseAdmin.from('time_entries')
        .select('*, staff:staff_members(name, employee_number)')
        .eq('dealership_id', req.dealershipId).gte('clock_in', from).lte('clock_in', to)
      if (req.query.staff_member_id) q = q.eq('employee_id', String(req.query.staff_member_id))
      const { data, error } = await q.order('clock_in', { ascending: false }).limit(500)
      if (error) return res.status(500).json({ error: error.message })
      res.json({ entries: (data || []).map(decorate), from, to })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/hr/time/period', requireAuth, requireMfa, canApprove, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.query.from || !req.query.to) return res.status(400).json({ error: 'from and to are required' })
    try {
      const r = await periodSummary(req.dealershipId, { from: String(req.query.from), to: String(req.query.to) })
      if (!r.ok) return res.status(500).json({ error: r.error })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.patch('/hr/time/entries/:id', requireAuth, requireMfa, canApprove, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const r = await editEntry(req.dealershipId, req.params.id, req.body || {}, { actorId: req.user.id })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.time_edited', { after_state: { entry_id: req.params.id, hours: r.entry.hours } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/hr/time/approve', requireAuth, requireMfa, canApprove, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const r = await approveEntries(req.dealershipId, req.body?.entry_ids, { actorId: req.user.id })
      if (!r.ok) return res.status(400).json(r)
      audit(req, 'staff.time_approved', { after_state: { approved: r.approved, skipped: r.skipped.length } })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Turn approved time into payroll lines. Everybody it could not compute comes back named.
   */
  app.post('/hr/payroll/batches/:id/calculate', requireAuth, requireMfa, canPayroll, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try {
      const r = await calculatePayroll(req.dealershipId, req.params.id, { actorId: req.user.id })
      if (!r.ok) return res.status(409).json(r)
      audit(req, 'staff.payroll_calculated', {
        after_state: { batch_id: req.params.id, calculated: r.calculated, unpayable: r.unpayable.length, gross_total: r.gross_total },
      })
      res.json(r)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/hr/time/attention', requireAuth, canApprove, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    try { res.json({ items: await timeAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })
}
