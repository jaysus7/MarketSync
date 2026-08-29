/**
 * MarketSync HQ — Corporate Finance & General Ledger REST API.
 */
import { supabaseAdmin } from '../shared.js'
import { requireHqAuth, requireHqOwner } from '../hq-auth.js'
import { logHqAudit } from '../hq-audit.js'
import {
  postHqJournal,
  reverseHqJournal,
  postApprovedExpense,
  getRevenueMetrics,
} from '../services/hqFinanceService.js'

export function registerHqFinance(app) {
  // ── 1. Finance Overview & Live MRR/ARR ──
  app.get('/hq/finance/overview', requireHqAuth, async (req, res) => {
    try {
      const metrics = await getRevenueMetrics()
      res.json(metrics)
    } catch (err) {
      console.error('[hq-finance] Error fetching overview metrics:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  // ── 2. Chart of Accounts ──
  app.get('/hq/finance/chart-of-accounts', requireHqAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('hq_chart_of_accounts')
        .select('*')
        .order('code', { ascending: true })

      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 3. General Ledger Journal Entries ──
  app.get('/hq/finance/journal-entries', requireHqAuth, async (req, res) => {
    try {
      const { status, source, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin
        .from('hq_journal_entries')
        .select('*, hq_journal_lines(*)')
        .order('entry_number', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1)

      if (status) query = query.eq('status', status)
      if (source) query = query.eq('source', source)

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/journal-entries', requireHqAuth, async (req, res) => {
    try {
      const { entry_date, source, description, lines, reason } = req.body
      const result = await postHqJournal({
        entryDate: entry_date,
        source: source || 'manual_income',
        description,
        lines,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
        reason,
      })
      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/hq/finance/journal-entries/:id/reverse', requireHqAuth, async (req, res) => {
    try {
      const { id } = req.params
      const { reason } = req.body
      const result = await reverseHqJournal({
        journalEntryId: id,
        reason: reason || 'Manual reversal',
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 4. Expenses Management ──
  app.get('/hq/finance/expenses', requireHqAuth, async (req, res) => {
    try {
      const { status, vendor_id, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin
        .from('hq_expenses')
        .select('*, hq_vendors(id, name), hq_receipts(id, storage_path, original_filename)')
        .order('expense_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1)

      if (status) query = query.eq('status', status)
      if (vendor_id) query = query.eq('vendor_id', vendor_id)

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/expenses', requireHqAuth, async (req, res) => {
    try {
      const { vendor_name, vendor_id, account_code, description, subtotal, tax_total, total, currency, payment_method, expense_date } = req.body
      if (!vendor_name || !description) return res.status(400).json({ error: 'vendor_name and description are required' })

      const sub = Number(subtotal) || 0
      const tax = Number(tax_total) || 0
      const tot = Number(total) || (sub + tax)

      const { data, error } = await supabaseAdmin
        .from('hq_expenses')
        .insert({
          vendor_name,
          vendor_id: vendor_id || null,
          account_code: account_code || '6400',
          description,
          subtotal: sub,
          tax_total: tax,
          total: tot,
          currency: currency || 'USD',
          payment_method: payment_method || 'credit_card',
          expense_date: expense_date || new Date().toISOString().slice(0, 10),
          status: 'draft',
          created_by: req.user?.id || null,
        })
        .select('*')
        .single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/hq/finance/expenses/:id/approve', requireHqAuth, async (req, res) => {
    try {
      const { id } = req.params
      const journalResult = await postApprovedExpense({
        expenseId: id,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })
      res.json({ success: true, journal: journalResult })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 5. Vendors Directory ──
  app.get('/hq/finance/vendors', requireHqAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('hq_vendors')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/vendors', requireHqAuth, async (req, res) => {
    try {
      const { name, category, website, contact_email, payment_terms, default_account_code, tax_id, notes } = req.body
      if (!name) return res.status(400).json({ error: 'Vendor name is required' })

      const { data, error } = await supabaseAdmin
        .from('hq_vendors')
        .insert({
          name: name.trim(),
          category: category || 'software',
          website,
          contact_email,
          payment_terms: payment_terms || 'due_on_receipt',
          default_account_code: default_account_code || '6400',
          tax_id,
          notes,
        })
        .select('*')
        .single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 6. Budgets vs Actuals ──
  app.get('/hq/finance/budgets/vs-actual', requireHqAuth, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear()
      const [budgetsRes, entriesRes] = await Promise.all([
        supabaseAdmin.from('hq_budgets').select('*, hq_budget_lines(*)').eq('period_year', year),
        supabaseAdmin.from('hq_journal_entries').select('*, hq_journal_lines(*)').eq('status', 'posted').like('entry_date', `${year}-%`),
      ])

      const budgets = budgetsRes.data || []
      const entries = entriesRes.data || []

      // Aggregate actuals by account code
      const actualsByAccount = {}
      for (const entry of entries) {
        for (const line of (entry.hq_journal_lines || [])) {
          const code = line.account_code
          const debit = Number(line.debit) || 0
          actualsByAccount[code] = (actualsByAccount[code] || 0) + debit
        }
      }

      res.json({
        year,
        budgets,
        actualsByAccount,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 7. Operational Profit & Loss (P&L) ──
  app.get('/hq/finance/pnl', requireHqAuth, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear()
      const { data: entries, error } = await supabaseAdmin
        .from('hq_journal_entries')
        .select('*, hq_journal_lines(*)')
        .eq('status', 'posted')
        .like('entry_date', `${year}-%`)

      if (error) throw error

      const revenueByAccount = {}
      const cogsByAccount = {}
      const opexByAccount = {}
      let totalRevenue = 0
      let totalCogs = 0
      let totalOpex = 0

      for (const entry of (entries || [])) {
        for (const line of (entry.hq_journal_lines || [])) {
          const code = String(line.account_code || '')
          const debit = Number(line.debit) || 0
          const credit = Number(line.credit) || 0

          if (code.startsWith('4')) {
            const netRev = credit - debit
            revenueByAccount[code] = (revenueByAccount[code] || 0) + netRev
            totalRevenue += netRev
          } else if (code.startsWith('5')) {
            const netCogs = debit - credit
            cogsByAccount[code] = (cogsByAccount[code] || 0) + netCogs
            totalCogs += netCogs
          } else if (code.startsWith('6')) {
            const netOpex = debit - credit
            opexByAccount[code] = (opexByAccount[code] || 0) + netOpex
            totalOpex += netOpex
          }
        }
      }

      const grossProfit = totalRevenue - totalCogs
      const netIncome = grossProfit - totalOpex

      res.json({
        year,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        totalOpex: Math.round(totalOpex * 100) / 100,
        netIncome: Math.round(netIncome * 100) / 100,
        revenueByAccount,
        cogsByAccount,
        opexByAccount,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 8. Receipts OCR & Human Review ──
  app.get('/hq/finance/receipts', requireHqAuth, async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin.from('hq_receipts').select('*').order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1)
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/receipts/review', requireHqAuth, async (req, res) => {
    try {
      const {
        receipt_id,
        vendor_name,
        vendor_id,
        account_code,
        description,
        subtotal,
        tax_total,
        total,
        currency,
        payment_method,
        expense_date,
      } = req.body

      const { ReceiptExtractionService } = await import('../services/receiptExtractionService.js')
      const expense = await ReceiptExtractionService.reviewAndCreateExpense({
        receiptId: receipt_id,
        vendorName: vendor_name,
        vendorId: vendor_id,
        accountCode: account_code,
        description,
        subtotal,
        taxTotal: tax_total,
        total,
        currency,
        paymentMethod: payment_method,
        expenseDate: expense_date,
        reviewerId: req.user?.id,
        reviewerName: req.profile?.full_name || 'HQ Operator',
      })

      res.status(201).json({ success: true, expense })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 9. Recurring Expenses ──
  app.get('/hq/finance/recurring-expenses', requireHqAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('hq_recurring_expenses')
        .select('*, hq_vendors(id, name)')
        .order('next_due_date', { ascending: true })

      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/recurring-expenses', requireHqAuth, async (req, res) => {
    try {
      const { vendor_id, account_code, description, amount, frequency, next_due_date } = req.body
      if (!description || !amount || !next_due_date) {
        return res.status(400).json({ error: 'description, amount, and next_due_date are required' })
      }

      const { data, error } = await supabaseAdmin.from('hq_recurring_expenses').insert({
        vendor_id: vendor_id || null,
        account_code: account_code || '6400',
        description,
        amount: Number(amount) || 0,
        frequency: frequency || 'monthly',
        next_due_date,
        is_active: true,
      }).select('*').single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 10. Financial Forecast Scenarios (Base, Conservative, Growth) ──
  app.get('/hq/finance/forecast', requireHqAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('hq_financial_forecasts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/forecast', requireHqAuth, async (req, res) => {
    try {
      const { scenario_name, forecast_start_date, forecast_end_date, assumptions, projected_mrr, projected_cash, projected_pnl } = req.body
      if (!scenario_name || !forecast_start_date || !forecast_end_date) {
        return res.status(400).json({ error: 'scenario_name, forecast_start_date, and forecast_end_date are required' })
      }

      const { data, error } = await supabaseAdmin.from('hq_financial_forecasts').insert({
        scenario_name,
        forecast_start_date,
        forecast_end_date,
        assumptions: assumptions || {},
        projected_mrr: projected_mrr || [],
        projected_cash: projected_cash || [],
        projected_pnl: projected_pnl || [],
        created_by: req.user?.id || null,
      }).select('*').single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 11. Staff Commission Plans & Calculation ──
  app.get('/hq/finance/commission-plans', requireHqAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('hq_commission_plans').select('*').order('created_at', { ascending: false })
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/commission-plans', requireHqAuth, async (req, res) => {
    try {
      const { name, version = 1, effective_from, rules } = req.body
      if (!name || !effective_from) return res.status(400).json({ error: 'name and effective_from are required' })

      const { data, error } = await supabaseAdmin.from('hq_commission_plans').insert({
        name,
        version: Number(version) || 1,
        effective_from,
        rules: rules || [],
        is_active: true,
      }).select('*').single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.get('/hq/finance/commissions', requireHqAuth, async (req, res) => {
    try {
      const { status, staff_id } = req.query
      let query = supabaseAdmin.from('hq_staff_commissions').select('*, hq_opportunities(id, name), hq_companies(id, name)').order('accrued_date', { ascending: false })
      if (status) query = query.eq('status', status)
      if (staff_id) query = query.eq('staff_id', staff_id)
      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/finance/commissions/:id/approve', requireHqAuth, async (req, res) => {
    try {
      const { id } = req.params
      const { approveStaffCommission } = await import('../services/hqCommissionService.js')
      const comm = await approveStaffCommission({
        commissionId: id,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })
      res.json({ success: true, commission: comm })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/hq/finance/payouts', requireHqAuth, async (req, res) => {
    try {
      const { recipient_type, recipient_id, recipient_name, commission_ids, payout_method, payout_reference } = req.body
      if (!recipient_id || !recipient_name || !commission_ids?.length) {
        return res.status(400).json({ error: 'recipient_id, recipient_name, and commission_ids are required' })
      }

      const { processCommissionPayout } = await import('../services/hqCommissionService.js')
      const result = await processCommissionPayout({
        recipientType: recipient_type || 'staff',
        recipientId: recipient_id,
        recipientName: recipient_name,
        commissionIds: commission_ids,
        payoutMethod: payout_method || 'direct_deposit',
        payoutReference: payout_reference,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })

      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}
