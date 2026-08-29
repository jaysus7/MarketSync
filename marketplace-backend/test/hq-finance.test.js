import test from 'node:test'
import assert from 'node:assert/strict'
import {
  postHqJournal,
  reverseHqJournal,
  postApprovedExpense,
  getRevenueMetrics,
} from '../services/hqFinanceService.js'
import { ReceiptExtractionService } from '../services/receiptExtractionService.js'
import { calculateStaffCommission, approveStaffCommission, processCommissionPayout } from '../services/hqCommissionService.js'
import { supabaseAdmin } from '../shared.js'

test('Phase 4, 5, 6, 7, 8: Double-Entry Ledger, Receipt OCR Review, Budgets & Commissions', async () => {
  const store = {
    chart: [
      { id: 'c-1000', code: '1000', name: 'Cash / Bank', category: 'asset' },
      { id: 'c-1050', code: '1050', name: 'Stripe Clearing Account', category: 'asset' },
      { id: 'c-1600', code: '1600', name: 'Sales Tax Paid / ITCs', category: 'asset' },
      { id: 'c-2000', code: '2000', name: 'Accounts Payable', category: 'liability' },
      { id: 'c-2300', code: '2300', name: 'Affiliate Commissions Payable', category: 'liability' },
      { id: 'c-2400', code: '2400', name: 'Staff Commissions Payable', category: 'liability' },
      { id: 'c-4000', code: '4000', name: 'Subscription Revenue', category: 'revenue' },
      { id: 'c-6100', code: '6100', name: 'Staff Sales Commissions Expense', category: 'expense' },
      { id: 'c-6400', code: '6400', name: 'Software & SaaS Tools', category: 'expense' },
    ],
    journals: [],
    lines: [],
    expenses: [],
    receipts: [],
    commissions: [],
    payouts: [],
    plans: [
      { id: 'p-1', name: 'Standard 2026 Plan', version: 1, rules: [{ product: 'dealer_os_pro', type: 'percentage', rate: 10, mrrMultiple: 1.0 }] },
    ],
    subscriptions: [
      { id: 'sub-1', plan: 'dealer_os_pro', amount: 1999, status: 'active' },
      { id: 'sub-2', plan: 'dealer_os_core', amount: 999, status: 'active' },
    ],
    audit: [],
  }

  const originalFrom = supabaseAdmin.from
  supabaseAdmin.from = (table) => {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          single: async () => {
            if (table === 'hq_journal_entries') {
              const entry = store.journals.find(j => j.id === val)
              if (!entry) return { data: null, error: { message: 'Not found' } }
              const entryLines = store.lines.filter(l => l.journal_entry_id === val)
              return { data: { ...entry, hq_journal_lines: entryLines }, error: null }
            }
            if (table === 'hq_expenses') {
              const exp = store.expenses.find(e => e.id === val)
              return { data: exp || null, error: exp ? null : { message: 'Not found' } }
            }
            if (table === 'hq_receipts') {
              const r = store.receipts.find(x => x.id === val)
              return { data: r || null, error: r ? null : { message: 'Not found' } }
            }
            if (table === 'hq_staff_commissions') {
              const c = store.commissions.find(x => x.id === val)
              return { data: c || null, error: c ? null : { message: 'Not found' } }
            }
            return { data: null }
          },
          maybeSingle: async () => {
            if (table === 'hq_commission_plans') {
              return { data: store.plans[0], error: null }
            }
            return { data: null }
          },
          order: () => ({
            limit: () => ({
              maybeSingle: async () => {
                if (table === 'hq_commission_plans') return { data: store.plans[0], error: null }
                return { data: null, error: null }
              },
            }),
          }),
        }),
        in: (col, vals) => ({
          then: (resolve) => {
            if (table === 'hq_staff_commissions') {
              const matches = store.commissions.filter(c => vals.includes(c.id))
              return resolve({ data: matches, error: null })
            }
            return resolve({ data: [], error: null })
          },
        }),
        order: () => ({
          range: async () => ({ data: [] }),
          limit: () => ({
            maybeSingle: async () => {
              if (table === 'hq_commission_plans') return { data: store.plans[0], error: null }
              return { data: null, error: null }
            },
          }),
        }),
        then: (resolve) => {
          if (table === 'hq_chart_of_accounts') return resolve({ data: store.chart, error: null })
          if (table === 'subscriptions') return resolve({ data: store.subscriptions, error: null })
          if (table === 'hq_journal_entries') {
            const enriched = store.journals.map(j => ({
              ...j,
              hq_journal_lines: store.lines.filter(l => l.journal_entry_id === j.id),
            }))
            return resolve({ data: enriched, error: null })
          }
          if (table === 'hq_expenses') return resolve({ data: store.expenses, error: null })
          if (table === 'hq_receipts') return resolve({ data: store.receipts, error: null })
          return resolve({ data: [], error: null })
        },
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, entry_number: store.journals.length + 1, ...payload }
            if (table === 'hq_journal_entries') store.journals.push(row)
            if (table === 'hq_expenses') store.expenses.push(row)
            if (table === 'hq_receipts') store.receipts.push(row)
            if (table === 'hq_staff_commissions') store.commissions.push(row)
            if (table === 'hq_payouts') store.payouts.push(row)
            if (table === 'hq_audit_log') store.audit.push(row)
            return { data: row, error: null }
          },
          maybeSingle: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, entry_number: store.journals.length + 1, ...payload }
            if (table === 'hq_journal_entries') store.journals.push(row)
            if (table === 'hq_expenses') store.expenses.push(row)
            if (table === 'hq_receipts') store.receipts.push(row)
            if (table === 'hq_staff_commissions') store.commissions.push(row)
            if (table === 'hq_payouts') store.payouts.push(row)
            if (table === 'hq_audit_log') store.audit.push(row)
            return { data: row, error: null }
          },
        }),
        then: (resolve) => {
          if (Array.isArray(payload)) {
            for (const item of payload) {
              store.lines.push({ id: `mock-line-${Math.random()}`, ...item })
            }
          }
          return resolve({ data: payload, error: null })
        },
      }),
      update: (payload) => ({
        eq: (col, val) => {
          if (table === 'hq_journal_entries') {
            const j = store.journals.find(x => x.id === val)
            if (j) Object.assign(j, payload)
          }
          if (table === 'hq_expenses') {
            const e = store.expenses.find(x => x.id === val)
            if (e) Object.assign(e, payload)
          }
          if (table === 'hq_receipts') {
            const r = store.receipts.find(x => x.id === val)
            if (r) Object.assign(r, payload)
          }
          if (table === 'hq_staff_commissions') {
            const c = store.commissions.find(x => x.id === val)
            if (c) Object.assign(c, payload)
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: val, ...payload }, error: null }),
            }),
            then: (resolve) => resolve({ data: null, error: null }),
          }
        },
        in: (col, vals) => {
          if (table === 'hq_staff_commissions') {
            for (const c of store.commissions) {
              if (vals.includes(c.id)) Object.assign(c, payload)
            }
          }
          return {
            then: (resolve) => resolve({ data: null, error: null }),
          }
        },
      }),
    }
  }

  try {
    // 1. Unbalanced journal test
    await assert.rejects(
      async () => {
        await postHqJournal({
          description: 'Unbalanced test',
          lines: [
            { accountCode: '1050', debit: 1000, credit: 0 },
            { accountCode: '4000', debit: 0, credit: 900 },
          ],
        })
      },
      /Unbalanced journal entry/
    )

    // 2. Balanced journal test
    const journalResult = await postHqJournal({
      description: 'Stripe Subscription - Dealership A',
      source: 'stripe_subscription',
      lines: [
        { accountCode: '1050', debit: 1999, credit: 0 },
        { accountCode: '4000', debit: 0, credit: 1999 },
      ],
    })
    assert.ok(journalResult.success)
    assert.equal(journalResult.total, 1999)

    // 3. Reversal test
    const reversal = await reverseHqJournal({
      journalEntryId: journalResult.journalEntryId,
      reason: 'Customer refund',
    })
    assert.ok(reversal.success)
    const original = store.journals.find(j => j.id === journalResult.journalEntryId)
    assert.equal(original.status, 'reversed')

    // 4. Receipt OCR & Human Review Gate test
    const mockReceiptBuffer = Buffer.from('fake-receipt-content')
    const extraction = await ReceiptExtractionService.extract(mockReceiptBuffer, 'image/jpeg', 'github_invoice_august.jpg')
    assert.equal(extraction.vendor, 'GitHub Inc')
    assert.equal(extraction.total, 21.00)
    assert.equal(extraction.suggested_account_code, '6400')

    const mockReceiptRow = { id: 'rec-1', original_filename: 'github.jpg', status: 'extracted' }
    store.receipts.push(mockReceiptRow)

    const draftExpense = await ReceiptExtractionService.reviewAndCreateExpense({
      receiptId: 'rec-1',
      vendorName: 'GitHub Inc',
      accountCode: '6400',
      description: 'Monthly Copilot Subscription',
      subtotal: 21.00,
      taxTotal: 0,
      total: 21.00,
    })
    assert.equal(draftExpense.vendor_name, 'GitHub Inc')
    assert.equal(draftExpense.status, 'pending_approval')
    assert.equal(mockReceiptRow.status, 'reviewed')

    // 5. Approved Expense Post to Ledger
    const expPosting = await postApprovedExpense({ expenseId: draftExpense.id })
    assert.ok(expPosting.success)
    assert.equal(expPosting.total, 21.00)

    // 6. Versioned Commission Calculation & Payout
    const commission = await calculateStaffCommission({
      staffId: 'user-sales-1',
      opportunityId: 'opp-100',
      dealValue: 1999,
      mrrValue: 1999,
      product: 'dealer_os_pro',
    })
    assert.equal(commission.commission_amount, 199.90) // 10% of $1999
    assert.equal(commission.status, 'accrued')

    const approvedComm = await approveStaffCommission({ commissionId: commission.id })
    assert.equal(approvedComm.status, 'approved')

    const payout = await processCommissionPayout({
      recipientType: 'staff',
      recipientId: 'user-sales-1',
      recipientName: 'Alex Mercer',
      commissionIds: [commission.id],
      payoutMethod: 'direct_deposit',
    })
    assert.ok(payout.success)
    assert.equal(payout.payout.amount, 199.90)
    assert.equal(commission.status, 'paid')
  } finally {
    supabaseAdmin.from = originalFrom
  }
})
