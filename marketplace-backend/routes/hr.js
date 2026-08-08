/**
 * People / HR engine — real data, gated end to end.
 *
 * This module was previously a shell over non-existent `hr_*` tables that returned
 * fabricated employees, leave and payroll (e.g. `sin_ssn_last4 || '1234'`, hard-coded
 * $32,450 payroll batches). It now reads and writes the real `staff_*` schema and the
 * `staff_payroll_*` tables introduced in 2026-08-07-people-engine.sql.
 *
 * Authorization is layered:
 *   1. server.js mounts `app.use('/hr', requireAuth, requireFeature('os.people'))`, so
 *      the whole surface is gated on the People/HR product feature (Growth+ plans).
 *   2. Every route re-declares requireAuth and adds requirePermission (RBAC) — and
 *      requireMfa for compensation and payroll (financial + PII).
 *   3. All dealer-facing reads/writes go through `req.supabase` (the caller's JWT), so
 *      RLS re-checks tenant + permission on every row. `.eq('dealership_id', …)` filters
 *      are defence-in-depth, not the only guard.
 */
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { toCsv } from '../payroll-export.js'

// Resolve the caller's own staff_members row id (for self-service actions). Uses the
// RLS-scoped client: `staff_members` SELECT is allowed for any dealership member, so a
// caller can always find their own row, and never another tenant's.
async function selfStaffMemberId(req) {
  const { data } = await req.supabase
    .from('staff_members')
    .select('id')
    .eq('dealership_id', req.dealershipId)
    .eq('user_id', req.user.id)
    .maybeSingle()
  return data?.id || null
}

export function registerHR(app) {
  // ── Employee directory ────────────────────────────────────────────────────
  app.get('/hr/employees', requireAuth, requirePermission('staff.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_directory_v')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .order('name')
      if (error) throw error
      res.json({ employees: data || [] })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/hr/employees/:id', requireAuth, requirePermission('staff.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_profile_overview_v')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .eq('id', req.params.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Employee not found' })
      res.json({ employee: data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // Compensation is sensitive PII — MFA + a dedicated permission on top of the feature gate.
  app.get('/hr/employees/:id/employment', requireAuth, requireMfa, requirePermission('staff.compensation.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_employment_details')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .eq('staff_member_id', req.params.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Employment record not found' })
      res.json({ employment: data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Leave / time-off ──────────────────────────────────────────────────────
  // Gate on staff.leave.self (granted to every non-platform role). RLS scopes the
  // rows: employees see their own requests, managers (staff.manage) see the store's.
  app.get('/hr/leave-requests', requireAuth, requirePermission('staff.leave.self'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_leave_requests')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .order('created_at', { ascending: false })
      if (error) throw error
      res.json({ requests: data || [] })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/hr/leave-requests', requireAuth, requirePermission('staff.leave.self'), async (req, res) => {
    try {
      const staffMemberId = await selfStaffMemberId(req)
      if (!staffMemberId) return res.status(400).json({ error: 'No staff profile linked to your account' })
      const { leave_type, start_date, end_date, starts_on, ends_on, hours, requested_hours, notes, employee_note } = req.body || {}
      const payload = {
        dealership_id: req.dealershipId,
        staff_member_id: staffMemberId,
        leave_type: leave_type || 'vacation',
        starts_on: starts_on || start_date || null,
        ends_on: ends_on || end_date || null,
        requested_hours: requested_hours ?? hours ?? null,
        employee_note: employee_note || notes || null,
        status: 'pending',
      }
      if (!payload.starts_on || !payload.ends_on) return res.status(400).json({ error: 'starts_on and ends_on are required' })
      const { data, error } = await req.supabase
        .from('staff_leave_requests')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      res.json({ request: data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // Approving / denying is a manager action → MFA + staff.manage.
  app.post('/hr/leave-requests/:id/decision', requireAuth, requireMfa, requirePermission('staff.manage'), async (req, res) => {
    try {
      const { decision, review_note } = req.body || {}
      if (!['approved', 'denied'].includes(decision)) return res.status(400).json({ error: "decision must be 'approved' or 'denied'" })
      const { data, error } = await req.supabase
        .from('staff_leave_requests')
        .update({
          status: decision,
          review_note: review_note || null,
          reviewed_by: await selfStaffMemberId(req),
          reviewed_at: new Date().toISOString(),
        })
        .eq('dealership_id', req.dealershipId)
        .eq('id', req.params.id)
        .select()
        .single()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Leave request not found' })
      await audit(req, 'staff.leave_request_reviewed', { leave_request_id: data.id, decision })
      res.json({ request: data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Training ──────────────────────────────────────────────────────────────
  app.get('/hr/training/assignments', requireAuth, requirePermission('staff.training.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_training_assignments')
        .select('*, course:staff_training_courses(id, title, category, passing_score)')
        .eq('dealership_id', req.dealershipId)
        .order('due_at', { ascending: true })
      if (error) throw error
      res.json({ assignments: data || [] })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // Employees complete their OWN assigned training (RLS enforces is_staff_self).
  app.post('/hr/training/complete', requireAuth, requirePermission('staff.training.self'), async (req, res) => {
    try {
      const staffMemberId = await selfStaffMemberId(req)
      if (!staffMemberId) return res.status(400).json({ error: 'No staff profile linked to your account' })
      const { assignment_id, course_id, score } = req.body || {}
      let query = req.supabase
        .from('staff_training_assignments')
        .update({
          status: 'completed',
          progress_percent: 100,
          score: score ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('dealership_id', req.dealershipId)
        .eq('staff_member_id', staffMemberId)
      if (assignment_id) query = query.eq('id', assignment_id)
      else if (course_id) query = query.eq('course_id', course_id)
      else return res.status(400).json({ error: 'assignment_id or course_id is required' })

      const { data, error } = await query.select().maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'No matching training assignment for you' })
      res.json({ assignment: data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Compliance dashboard ──────────────────────────────────────────────────
  app.get('/hr/compliance', requireAuth, requirePermission('staff.compliance.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_compliance_dashboard_v')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .order('name')
      if (error) throw error
      res.json({ rows: data || [] })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── HR documents ──────────────────────────────────────────────────────────
  // Gate on staff.documents.self; RLS returns the caller's own visible documents,
  // or the whole store's to compliance/user managers.
  app.get('/hr/documents', requireAuth, requirePermission('staff.documents.self'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_documents')
        .select('id, staff_member_id, document_type, title, status, expires_on, employee_visible, created_at')
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      res.json({ documents: data || [] })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Payroll (financial + PII → MFA on every route) ────────────────────────
  app.get('/hr/payroll/batches', requireAuth, requireMfa, requirePermission('staff.payroll.view'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_payroll_batches')
        .select('*, items:staff_payroll_items(gross_amount, deductions, net_amount, detail)')
        .eq('dealership_id', req.dealershipId)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Aggregate real item totals up onto each batch (no fabricated figures).
      const batches = (data || []).map(b => {
        const items = b.items || []
        const num = v => Number(v) || 0
        const gross = items.reduce((s, i) => s + num(i.gross_amount), 0)
        const deductions = items.reduce((s, i) => s + num(i.deductions), 0)
        const net = items.reduce((s, i) => s + num(i.net_amount), 0)
        const commissions = items.reduce((s, i) => s + num(i.detail?.commission), 0)
        const { items: _drop, ...batch } = b
        return {
          ...batch,
          batch_number: 'PAY-' + (b.period_start || b.id),
          staff_count: items.length,
          gross_wages: gross,
          commissions,
          tax_withheld: deductions,
          net_payroll: net,
        }
      })
      res.json({ batches })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // Create a real draft batch for a pay period. No auto-computed money — items are
  // added deliberately; totals are always derived from real items on read.
  const createBatch = async (req, res) => {
    try {
      const { period_start, period_end, notes } = req.body || {}
      if (!period_start || !period_end) return res.status(400).json({ error: 'period_start and period_end are required' })
      const { data, error } = await req.supabase
        .from('staff_payroll_batches')
        .insert([{
          dealership_id: req.dealershipId,
          period_start,
          period_end,
          notes: notes || null,
          status: 'draft',
          created_by: req.user.id,
          updated_by: req.user.id,
        }])
        .select()
        .single()
      if (error) throw error
      await audit(req, 'staff.payroll_batch_created', { batch_id: data.id, period_start, period_end })
      res.json({ batch: { ...data, batch_number: 'PAY-' + data.period_start, staff_count: 0, gross_wages: 0, commissions: 0, tax_withheld: 0, net_payroll: 0 } })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  }
  app.post('/hr/payroll/batches', requireAuth, requireMfa, requirePermission('staff.payroll.manage'), createBatch)
  // Frontend-compatible alias (was the fabricated "generate" endpoint).
  app.post('/hr/payroll/batches/generate', requireAuth, requireMfa, requirePermission('staff.payroll.manage'), createBatch)

  app.get('/hr/payroll/batches/:id/export', requireAuth, requireMfa, requirePermission('staff.payroll.export'), async (req, res) => {
    try {
      const { data, error } = await req.supabase
        .from('staff_payroll_items')
        .select('staff_member_id, gross_amount, deductions, net_amount, currency, staff:staff_members(name, employee_number)')
        .eq('dealership_id', req.dealershipId)
        .eq('batch_id', req.params.id)
      if (error) throw error
      const columns = [
        { key: 'employee', header: 'Employee' },
        { key: 'employee_number', header: 'Employee #' },
        { key: 'gross_amount', header: 'Gross' },
        { key: 'deductions', header: 'Deductions' },
        { key: 'net_amount', header: 'Net' },
        { key: 'currency', header: 'Currency' },
      ]
      const rows = (data || []).map(i => ({
        employee: i.staff?.name || '',
        employee_number: i.staff?.employee_number || '',
        gross_amount: i.gross_amount,
        deductions: i.deductions,
        net_amount: i.net_amount,
        currency: i.currency,
      }))
      await audit(req, 'staff.payroll_exported', { batch_id: req.params.id, rows: rows.length })
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="payroll-${req.params.id}.csv"`)
      res.send(toCsv(columns, rows))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
}
