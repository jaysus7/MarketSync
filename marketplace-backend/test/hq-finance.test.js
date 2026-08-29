import test from 'node:test'
import assert from 'node:assert/strict'
import {
  postHqJournal,
  reverseHqJournal,
  postApprovedExpense,
  getRevenueMetrics,
} from '../services/hqFinanceService.js'
import { supabaseAdmin } from '../shared.js'

test('Phase 4 & 5 Corporate Finance: Double-Entry Ledger and Revenue Metrics', async () => {
  const store = {
    chart: [
      { id: 'c-1000', code: '1000', name: 'Cash / Bank', category: 'asset' },
      { id: 'c-1050', code: '1050', name: 'Stripe Clearing Account', category: 'asset' },
      { id: 'c-1600', code: '1600', name: 'Sales Tax Paid / ITCs', category: 'asset' },
      { id: 'c-2000', code: '2000', name: 'Accounts Payable', category: 'liability' },
      { id: 'c-4000', code: '4000', name: 'Subscription Revenue', category: 'revenue' },
      { id: 'c-6400', code: '6400', name: 'Software & SaaS Tools', category: 'expense' },
    ],
    journals: [],
    lines: [],
    expenses: [],
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
            return { data: null }
          },
          maybeSingle: async () => ({ data: null }),
        }),
        order: () => ({
          range: async () => ({ data: [] }),
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
          return resolve({ data: [], error: null })
        },
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, entry_number: store.journals.length + 1, ...payload }
            if (table === 'hq_journal_entries') store.journals.push(row)
            if (table === 'hq_expenses') store.expenses.push(row)
            if (table === 'hq_audit_log') store.audit.push(row)
            return { data: row, error: null }
          },
          maybeSingle: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, entry_number: store.journals.length + 1, ...payload }
            if (table === 'hq_journal_entries') store.journals.push(row)
            if (table === 'hq_expenses') store.expenses.push(row)
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
          return {
            select: () => ({
              single: async () => ({ data: { id: val, ...payload }, error: null }),
            }),
            then: (resolve) => resolve({ data: null, error: null }),
          }
        },
      }),
    }
  }

  try {
    // 1. Verify Unbalanced Journal is REFUSED
    await assert.rejects(
      async () => {
        await postHqJournal({
          description: 'Unbalanced payment test',
          lines: [
            { accountCode: '1050', debit: 1000, credit: 0 },
            { accountCode: '4000', debit: 0, credit: 900 }, // Off by $100
          ],
        })
      },
      /Unbalanced journal entry/
    )

    // 2. Verify Balanced Journal is POSTED
    const journalResult = await postHqJournal({
      description: 'Stripe SaaS Subscription - Dealership X',
      source: 'stripe_subscription',
      lines: [
        { accountCode: '1050', debit: 1999, credit: 0, description: 'Stripe clearing' },
        { accountCode: '4000', debit: 0, credit: 1999, description: 'SaaS Pro Revenue' },
      ],
    })
    assert.ok(journalResult.success, 'Balanced journal must post successfully')
    assert.equal(journalResult.total, 1999)

    // 3. Verify Reversal
    const reversal = await reverseHqJournal({
      journalEntryId: journalResult.journalEntryId,
      reason: 'Customer billing dispute resolved with refund',
    })
    assert.ok(reversal.success, 'Reversal must create opposing journal')
    const original = store.journals.find(j => j.id === journalResult.journalEntryId)
    assert.equal(original.status, 'reversed')

    // 4. Verify Approved Expense Posting
    const mockExpense = {
      id: 'exp-123',
      vendor_name: 'GitHub Inc',
      account_code: '6400',
      description: 'Monthly Developer Subscription',
      subtotal: 100,
      tax_total: 13,
      total: 113,
      payment_method: 'credit_card',
      status: 'approved',
    }
    store.expenses.push(mockExpense)

    const expPosting = await postApprovedExpense({ expenseId: 'exp-123' })
    assert.ok(expPosting.success, 'Expense must post balanced debits and credits')
    assert.equal(expPosting.total, 113)
    assert.equal(mockExpense.status, 'posted')

    // 5. Verify Live Revenue Metrics Derivation
    const metrics = await getRevenueMetrics()
    assert.equal(metrics.mrr, 2998)
    assert.equal(metrics.arr, 35976)
  } finally {
    supabaseAdmin.from = originalFrom
  }
})
