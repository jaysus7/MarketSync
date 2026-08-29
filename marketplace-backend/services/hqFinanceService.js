/**
 * MarketSync HQ — Corporate Financial Operating System & Double-Entry Ledger Service.
 *
 * Core Principles:
 * 1. Double-Entry General Ledger: Every transaction enforces ΣDebits = ΣCredits.
 * 2. Immutable Postings: Financial transactions are never hard-deleted.
 *    Corrections are made via reversing entries.
 * 3. Canonical Accounting: Derived directly from posted ledger records.
 */
import { supabaseAdmin } from '../shared.js'
import { logHqAudit } from '../hq-audit.js'

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

// In-memory cache for chart of accounts code -> ID lookup
let chartCache = null
let chartCacheExpiry = 0

async function getChartMap() {
  if (chartCache && Date.now() < chartCacheExpiry) return chartCache
  const { data, error } = await supabaseAdmin.from('hq_chart_of_accounts').select('id, code, name, category, system_key')
  if (error || !data) {
    console.warn('[hq-finance] Could not fetch chart of accounts:', error?.message)
    return {}
  }
  const map = {}
  for (const acct of data) {
    map[acct.code] = acct
    if (acct.system_key) map[acct.system_key] = acct
  }
  chartCache = map
  chartCacheExpiry = Date.now() + 60000 // 1 minute
  return map
}

export async function postHqJournal({
  entryDate = new Date().toISOString().slice(0, 10),
  source,
  sourceId = null,
  description,
  lines = [],
  actorId = null,
  actorName = 'System',
  reason = null,
  metadata = {},
}) {
  if (!lines || !Array.isArray(lines) || lines.length < 2) {
    throw new Error('A journal entry requires at least two lines (one debit and one credit)')
  }

  const chart = await getChartMap()
  let totalDebit = 0
  let totalCredit = 0

  const preparedLines = []
  for (const line of lines) {
    const code = String(line.accountCode || line.account_code || '').trim()
    const debit = round2(n(line.debit))
    const credit = round2(n(line.credit))

    if (!code) throw new Error('Each journal line must specify an accountCode')
    if (debit < 0 || credit < 0) throw new Error('Debit and credit amounts must be non-negative')
    if (debit === 0 && credit === 0) throw new Error('Each journal line must have either a debit or a credit amount')
    if (debit > 0 && credit > 0) throw new Error('A single line cannot have both a debit and a credit amount')

    const acct = chart[code]
    const accountId = acct?.id || line.accountId || line.account_id
    if (!accountId) {
      throw new Error(`Unrecognized account code: ${code}`)
    }

    totalDebit += debit
    totalCredit += credit

    preparedLines.push({
      account_id: accountId,
      account_code: code,
      description: String(line.description || description || '').slice(0, 200),
      debit,
      credit,
    })
  }

  totalDebit = round2(totalDebit)
  totalCredit = round2(totalCredit)

  // Enforce Double-Entry Balance: ΣDebits === ΣCredits
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Unbalanced journal entry: Total Debits ($${totalDebit.toFixed(2)}) must equal Total Credits ($${totalCredit.toFixed(2)})`)
  }

  // 1. Create Journal Entry Header
  const { data: entry, error: entryErr } = await supabaseAdmin.from('hq_journal_entries').insert({
    entry_date: entryDate,
    source: String(source || 'manual_income'),
    source_id: sourceId ? String(sourceId) : null,
    description: String(description || 'Financial posting').slice(0, 300),
    status: 'posted',
    posted_at: new Date().toISOString(),
    posted_by: actorId || null,
    metadata,
  }).select('*').single()

  if (entryErr || !entry) {
    throw new Error(`Failed to create journal entry: ${entryErr?.message || 'unknown error'}`)
  }

  // 2. Create Journal Lines
  const lineRows = preparedLines.map(l => ({ ...l, journal_entry_id: entry.id }))
  const { error: linesErr } = await supabaseAdmin.from('hq_journal_lines').insert(lineRows)
  if (linesErr) {
    // Attempt rollback/void of header if line insert fails
    await supabaseAdmin.from('hq_journal_entries').update({ status: 'voided' }).eq('id', entry.id)
    throw new Error(`Failed to create journal lines: ${linesErr.message}`)
  }

  // 3. Audit Log
  await logHqAudit({
    entityType: 'hq_journal_entry',
    entityId: entry.id,
    action: 'journal_posted',
    afterState: { entry_number: entry.entry_number, total: totalDebit, source, sourceId },
    actorId,
    actorName,
    reason: reason || description,
  })

  return {
    success: true,
    journalEntryId: entry.id,
    entryNumber: entry.entry_number,
    total: totalDebit,
  }
}

export async function reverseHqJournal({ journalEntryId, reason, actorId = null, actorName = 'System' }) {
  const { data: original, error: origErr } = await supabaseAdmin
    .from('hq_journal_entries')
    .select('*, hq_journal_lines(*)')
    .eq('id', journalEntryId)
    .single()

  if (origErr || !original) throw new Error('Original journal entry not found')
  if (original.status === 'reversed') throw new Error('Journal entry has already been reversed')
  if (original.status === 'voided') throw new Error('Cannot reverse a voided journal entry')

  const originalLines = original.hq_journal_lines || []
  if (!originalLines.length) throw new Error('No journal lines found to reverse')

  // Create inverted lines: swap debits and credits
  const reversedLines = originalLines.map(line => ({
    accountCode: line.account_code,
    accountId: line.account_id,
    description: `Reversal of entry #${original.entry_number}: ${line.description || ''}`,
    debit: line.credit,
    credit: line.debit,
  }))

  const reversalResult = await postHqJournal({
    entryDate: new Date().toISOString().slice(0, 10),
    source: 'reversal',
    sourceId: original.id,
    description: `Reversal of entry #${original.entry_number} — ${reason || 'Correction'}`,
    lines: reversedLines,
    actorId,
    actorName,
    reason,
    metadata: { reversed_entry_id: original.id },
  })

  // Mark original as reversed and link reversal
  await supabaseAdmin.from('hq_journal_entries').update({
    status: 'reversed',
    reversal_of_id: reversalResult.journalEntryId,
  }).eq('id', original.id)

  await logHqAudit({
    entityType: 'hq_journal_entry',
    entityId: original.id,
    action: 'journal_reversed',
    afterState: { status: 'reversed', reversal_entry_id: reversalResult.journalEntryId },
    actorId,
    actorName,
    reason: reason || 'Journal reversal',
  })

  return reversalResult
}

export async function postApprovedExpense({ expenseId, actorId = null, actorName = 'HQ Operator' }) {
  const { data: exp, error } = await supabaseAdmin.from('hq_expenses').select('*').eq('id', expenseId).single()
  if (error || !exp) throw new Error('Expense not found')
  if (exp.status === 'posted') throw new Error('Expense is already posted to the ledger')

  const subtotal = round2(n(exp.subtotal))
  const taxTotal = round2(n(exp.tax_total))
  const total = round2(n(exp.total) || (subtotal + taxTotal))
  const accountCode = exp.account_code || '6400' // Default to Software if unspecified

  const lines = []
  // Debit: Expense account
  lines.push({ accountCode, description: `${exp.vendor_name}: ${exp.description}`, debit: subtotal, credit: 0 })

  // Debit: Input Tax Credits (if tax was paid)
  if (taxTotal > 0) {
    lines.push({ accountCode: '1600', description: `Tax Paid / ITCs — ${exp.vendor_name}`, debit: taxTotal, credit: 0 })
  }

  // Credit: Cash / Bank or Accounts Payable
  const creditAccount = exp.payment_method === 'credit_card' || exp.payment_method === 'bank_transfer' ? '1000' : '2000'
  lines.push({ accountCode: creditAccount, description: `Payment/Payable for ${exp.vendor_name}`, debit: 0, credit: total })

  const journal = await postHqJournal({
    entryDate: exp.expense_date || new Date().toISOString().slice(0, 10),
    source: 'expense',
    sourceId: exp.id,
    description: `Expense: ${exp.vendor_name} — ${exp.description}`,
    lines,
    actorId,
    actorName,
  })

  await supabaseAdmin.from('hq_expenses').update({
    status: 'posted',
    approved_by: actorId,
    approved_at: new Date().toISOString(),
    journal_entry_id: journal.journalEntryId,
    updated_at: new Date().toISOString(),
  }).eq('id', expenseId)

  return journal
}

export async function getRevenueMetrics() {
  const [subsRes, entriesRes, expensesRes] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('id, plan, amount, currency, status, current_period_end'),
    supabaseAdmin.from('hq_journal_entries').select('id, entry_date, status, hq_journal_lines(*)').eq('status', 'posted'),
    supabaseAdmin.from('hq_expenses').select('id, expense_date, total, status').eq('status', 'posted'),
  ])

  const subs = subsRes.data || []
  const entries = entriesRes.data || []
  const expenses = expensesRes.data || []

  // Active Subscriptions MRR
  let activeMrr = 0
  const productMix = { complete: 0, pro: 0, core: 0, digital: 0, suites: 0, addons: 0 }

  for (const s of subs) {
    if (s.status === 'active' || s.status === 'trialing') {
      const amt = round2(n(s.amount))
      activeMrr += amt
      const plan = String(s.plan || '').toLowerCase()
      if (plan.includes('pro')) productMix.pro += amt
      else if (plan.includes('core')) productMix.core += amt
      else if (plan.includes('digital')) productMix.digital += amt
      else if (plan.includes('suite')) productMix.suites += amt
      else productMix.complete += amt
    }
  }

  const arr = round2(activeMrr * 12)

  // Ledger Revenue MTD & YTD
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const mtdPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const ytdPrefix = `${currentYear}-`

  let revenueMtd = 0
  let revenueYtd = 0
  let expensesMtd = 0
  let expensesYtd = 0

  for (const entry of entries) {
    const date = entry.entry_date || ''
    const isMtd = date.startsWith(mtdPrefix)
    const isYtd = date.startsWith(ytdPrefix)

    for (const line of (entry.hq_journal_lines || [])) {
      const code = line.account_code
      // Revenue accounts (4000-4999)
      if (code && code.startsWith('4')) {
        const netCredit = round2(n(line.credit) - n(line.debit))
        if (isMtd) revenueMtd += netCredit
        if (isYtd) revenueYtd += netCredit
      }
    }
  }

  for (const exp of expenses) {
    const date = exp.expense_date || ''
    const total = round2(n(exp.total))
    if (date.startsWith(mtdPrefix)) expensesMtd += total
    if (date.startsWith(ytdPrefix)) expensesYtd += total
  }

  return {
    mrr: round2(activeMrr),
    arr,
    revenueMtd: round2(revenueMtd),
    revenueYtd: round2(revenueYtd),
    expensesMtd: round2(expensesMtd),
    expensesYtd: round2(expensesYtd),
    netIncomeMtd: round2(revenueMtd - expensesMtd),
    netIncomeYtd: round2(revenueYtd - expensesYtd),
    productMix,
  }
}
