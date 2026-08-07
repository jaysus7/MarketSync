/**
 * Employee time clock — sign in / sign out + tracked hours for every employee.
 *
 * Any authenticated employee clocks their OWN time (no special permission). Staff
 * managers (users.manage) see and correct everyone's timesheets. The DB's partial
 * unique index guarantees one open session per employee; the calc lives in the pure,
 * tested time-clock.js. Techs may attach a session to a repair order (ro_id) so shop
 * labor time is captured alongside the service RO.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { sessionMinutes, sessionHours, summarize, findOpenSession, round2 } from '../time-clock.js'
import { toCsv } from '../payroll-export.js'

const dayStartISO = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()

export function registerTimeClock(app) {
  // Where does the caller stand right now: open session (if any) + today's total.
  app.get('/time/status', requireAuth, async (req, res) => {
    if (!req.dealershipId || !req.user?.id) return res.status(400).json({ error: 'No dealership/user' })
    const { data: rows } = await supabaseAdmin.from('time_entries').select('*')
      .eq('dealership_id', req.dealershipId).eq('employee_id', req.user.id)
      .gte('clock_in', dayStartISO()).order('clock_in', { ascending: false })
    const open = findOpenSession(rows || [])
    const now = Date.now()
    const todayMinutes = (rows || []).reduce((s, e) => s + sessionMinutes(e, now), 0)
    res.json({ ok: true, clocked_in: !!open, open_session: open || null, today_minutes: todayMinutes, today_hours: round2(todayMinutes / 60) })
  })

  // Clock IN — start a session. The DB partial-unique index rejects a second open one.
  app.post('/time/clock-in', requireAuth, async (req, res) => {
    if (!req.dealershipId || !req.user?.id) return res.status(400).json({ error: 'No dealership/user' })
    const row = {
      dealership_id: req.dealershipId, employee_id: req.user.id, status: 'active',
      ro_id: req.body?.ro_id || null, note: String(req.body?.note || '').slice(0, 300) || null, source: 'web',
    }
    const { data, error } = await supabaseAdmin.from('time_entries').insert(row).select().single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You are already clocked in.' })
      return res.status(500).json({ error: error.message })
    }
    audit(req, 'time.clock_in', { entity_type: 'time_entry', entity_id: data.id })
    res.json({ ok: true, entry: data })
  })

  // Clock OUT — close the caller's open session (optional break_minutes + note).
  app.post('/time/clock-out', requireAuth, async (req, res) => {
    if (!req.dealershipId || !req.user?.id) return res.status(400).json({ error: 'No dealership/user' })
    const { data: open } = await supabaseAdmin.from('time_entries').select('*')
      .eq('dealership_id', req.dealershipId).eq('employee_id', req.user.id).eq('status', 'active').maybeSingle()
    if (!open) return res.status(409).json({ error: 'You are not clocked in.' })
    const now = new Date().toISOString()
    const patch = { clock_out: now, status: 'completed', updated_at: now }
    if (req.body?.break_minutes != null) patch.break_minutes = Math.max(0, Math.trunc(Number(req.body.break_minutes) || 0))
    if (req.body?.note) patch.note = String(req.body.note).slice(0, 300)
    const { data, error } = await supabaseAdmin.from('time_entries').update(patch).eq('id', open.id).eq('dealership_id', req.dealershipId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'time.clock_out', { entity_type: 'time_entry', entity_id: data.id, after_state: { minutes: sessionMinutes(data) } })
    res.json({ ok: true, entry: data, minutes: sessionMinutes(data), hours: sessionHours(data) })
  })

  // The caller's own entries + summary for a date range (defaults to the last 14 days).
  app.get('/time/mine', requireAuth, async (req, res) => {
    if (!req.dealershipId || !req.user?.id) return res.status(400).json({ error: 'No dealership/user' })
    const from = req.query.from ? String(req.query.from) : new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const to = req.query.to ? String(req.query.to) : new Date().toISOString().slice(0, 10)
    const { data } = await supabaseAdmin.from('time_entries').select('*')
      .eq('dealership_id', req.dealershipId).eq('employee_id', req.user.id)
      .gte('clock_in', from + 'T00:00:00Z').lte('clock_in', to + 'T23:59:59Z').order('clock_in', { ascending: false })
    res.json({ ok: true, entries: data || [], summary: summarize(data || []) })
  })

  // ── Manager: timesheets across all employees ─────────────────────────────────
  async function loadRange(dealershipId, query) {
    const from = query.from ? String(query.from) : new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const to = query.to ? String(query.to) : new Date().toISOString().slice(0, 10)
    let q = supabaseAdmin.from('time_entries').select('*').eq('dealership_id', dealershipId)
      .gte('clock_in', from + 'T00:00:00Z').lte('clock_in', to + 'T23:59:59Z').order('clock_in', { ascending: false }).limit(5000)
    if (query.employee_id) q = q.eq('employee_id', String(query.employee_id))
    const { data } = await q
    return { from, to, entries: data || [] }
  }
  async function employeeNames(dealershipId, ids) {
    if (!ids.length) return {}
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, display_name, email').in('id', ids)
    return Object.fromEntries((data || []).map(p => [p.id, p.display_name || p.full_name || p.email || 'Employee']))
  }

  app.get('/time/timesheets', requireAuth, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { from, to, entries } = await loadRange(req.dealershipId, req.query)
    const s = summarize(entries)
    const ids = Object.keys(s.by_employee)
    const names = await employeeNames(req.dealershipId, ids)
    const rows = ids.map(id => ({ employee_id: id, name: names[id] || 'Employee', minutes: s.by_employee[id].minutes, hours: s.by_employee[id].hours }))
      .sort((a, b) => b.minutes - a.minutes)
    res.json({ ok: true, from, to, total_hours: s.total_hours, employees: rows })
  })

  // Detailed entries (manager), optionally for one employee.
  app.get('/time/entries', requireAuth, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { entries } = await loadRange(req.dealershipId, req.query)
    const names = await employeeNames(req.dealershipId, [...new Set(entries.map(e => e.employee_id))])
    res.json({ ok: true, entries: entries.map(e => ({ ...e, employee_name: names[e.employee_id] || 'Employee', minutes: sessionMinutes(e) })) })
  })

  // Correct or approve an entry (manager). Editing stamps edited_by; approve stamps approver.
  app.post('/time/entries/:id', requireAuth, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: before } = await supabaseAdmin.from('time_entries').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Time entry not found' })
    const now = new Date().toISOString()
    const patch = { updated_at: now, edited_by: req.user?.id || null, edited_at: now }
    const b = req.body || {}
    if (b.clock_in) patch.clock_in = b.clock_in
    if (b.clock_out !== undefined) patch.clock_out = b.clock_out || null
    if (b.break_minutes != null) patch.break_minutes = Math.max(0, Math.trunc(Number(b.break_minutes) || 0))
    if (b.note !== undefined) patch.note = b.note ? String(b.note).slice(0, 300) : null
    if (b.approve) { patch.status = 'approved'; patch.approved_by = req.user?.id || null; patch.approved_at = now }
    else if (b.status && ['active', 'completed', 'approved'].includes(b.status)) patch.status = b.status
    // If a manager sets a clock_out on an active row without a status, mark it completed.
    if (patch.clock_out && before.status === 'active' && !patch.status) patch.status = 'completed'
    const { data, error } = await supabaseAdmin.from('time_entries').update(patch).eq('id', before.id).eq('dealership_id', req.dealershipId).select().single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'That employee already has an open session.' : error.message })
    audit(req, 'time.entry_edited', { entity_type: 'time_entry', entity_id: before.id, before_state: before, after_state: data })
    res.json({ ok: true, entry: data })
  })

  // Timesheet CSV export (manager) — one row per employee for the range.
  app.get('/time/timesheets.csv', requireAuth, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { from, to, entries } = await loadRange(req.dealershipId, req.query)
    const s = summarize(entries)
    const names = await employeeNames(req.dealershipId, Object.keys(s.by_employee))
    const rows = Object.entries(s.by_employee).map(([id, v]) => ({ employee: names[id] || id, employee_id: id, hours: v.hours, minutes: v.minutes, from, to }))
      .sort((a, b) => b.minutes - a.minutes)
    const csv = toCsv([
      { key: 'employee', header: 'Employee' }, { key: 'employee_id', header: 'Employee ID' },
      { key: 'hours', header: 'Hours' }, { key: 'minutes', header: 'Minutes' },
      { key: 'from', header: 'From' }, { key: 'to', header: 'To' },
    ], rows)
    audit(req, 'time.timesheet_exported', { after_state: { from, to, employees: rows.length } })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-${from}_to_${to}.csv"`)
    res.send(csv)
  })

  // Service linkage: total clocked labor time attributed to a repair order.
  app.get('/time/ro/:roId', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data } = await supabaseAdmin.from('time_entries').select('*').eq('dealership_id', req.dealershipId).eq('ro_id', req.params.roId).order('clock_in', { ascending: false })
    const names = await employeeNames(req.dealershipId, [...new Set((data || []).map(e => e.employee_id))])
    const entries = (data || []).map(e => ({ ...e, employee_name: names[e.employee_id] || 'Tech', minutes: sessionMinutes(e) }))
    res.json({ ok: true, entries, summary: summarize(data || []) })
  })
}
