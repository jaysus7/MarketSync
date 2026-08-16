/**
 * Accounting — Accounts Receivable and Accounts Payable operating truth (PR 5.2).
 *
 * Both are DERIVED, never a second ledger. AR comes from posted journal lines against
 * Accounts Receivable, attributed to the canonical source that raised them and netted by
 * the payments allocated to that source. AP comes from the canonical expense records that
 * produced the payable, with balances read from the same posted ledger.
 *
 * Two rules run through everything here:
 *   • Only POSTED journals count. A draft has passed no balance check and its lines are
 *     still mutable — it is not financial truth (PR 5.1).
 *   • Contracts in Transit is a LENDER receivable and is reported separately. Presenting
 *     it as customer AR is the exact defect PR 5.2 corrected in the ledger; repeating it
 *     in the read layer would put it straight back.
 *
 * Nothing here writes a journal. Money moves through the canonical payment primitive and
 * the accounting engine's rules.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100
const daysSince = (d) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5)) : null)

// Standard dealership aging. Derived on read from real dates — never persisted, because a
// stored bucket is wrong the day after it is written.
export function agingBucket(days) {
  if (days == null) return 'unknown'
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

// The ONE place journal_lines is read. Everything else goes through it, so the posted
// filter can never be forgotten at a call site — callers pass ids they have already
// restricted to posted entries.
async function linesForEntries(entryIds, columns, accountId = null) {
  if (!entryIds?.length) return []
  let q = supabaseAdmin.from('journal_lines').select(columns).in('journal_entry_id', entryIds)
  if (accountId) q = q.eq('account_id', accountId)
  const { data } = await q.limit(50000)
  return data || []
}

// Posted lines against one account, with their entry context. The `posted` filter is the
// whole reason this helper exists rather than reading journal_lines directly.
async function postedLinesFor(dealershipId, systemKey) {
  const { data: acct } = await supabaseAdmin.from('gl_accounts')
    .select('id').eq('dealership_id', dealershipId).eq('system_key', systemKey).maybeSingle()
  if (!acct?.id) return []

  // Posted entries only — the `posted` filter is the whole reason this helper exists.
  const { data: entries } = await supabaseAdmin.from('journal_entries')
    .select('id, entry_date, source, event_name, reference, posted, dealership_id')
    .eq('dealership_id', dealershipId)
    .eq('posted', true)
    .limit(5000)
  const entryById = new Map((entries || []).map(e => [e.id, e]))
  const postedIds = [...entryById.keys()]
  if (!postedIds.length) return []

  // journal_lines is read ONLY through linesForEntries, so the posted restriction (the
  // ids passed here are already posted) can never be bypassed at a call site.
  const lines = await linesForEntries(postedIds,
    'debit, credit, memo, ref_deal_id, ref_contact_id, ref_vendor_id, journal_entry_id, account_id', acct.id)

  return lines.map(l => ({
    debit: l.debit, credit: l.credit, memo: l.memo,
    ref_deal_id: l.ref_deal_id, ref_contact_id: l.ref_contact_id, ref_vendor_id: l.ref_vendor_id,
    journal_entry_id: l.journal_entry_id,
    entry: entryById.get(l.journal_entry_id),
  })).filter(l => l.entry)
}

// ── Accounts Receivable ─────────────────────────────────────────────────────
// One receivable per canonical source (a deal, a repair order). The ledger says how much
// was raised; payment allocations against that same subject say how much came in.
export async function receivables(dealershipId) {
  const lines = await postedLinesFor(dealershipId, 'accounts_receivable')
  if (!lines.length) return []

  // Group by the source that raised it. `reference` is the canonical source id the
  // posting was keyed to, which is what payment allocations point at too.
  const bySource = {}
  for (const l of lines) {
    const key = l.entry.reference || l.journal_entry_id
    const g = (bySource[key] ||= {
      source_id: key, source: l.entry.source, event_name: l.entry.event_name,
      raised: 0, credited: 0, opened_at: l.entry.entry_date,
      deal_id: l.ref_deal_id || null, contact_id: l.ref_contact_id || null, memo: l.memo || null,
    })
    g.raised += n(l.debit)
    g.credited += n(l.credit)                    // reversals / direct credits
    if (l.entry.entry_date < g.opened_at) g.opened_at = l.entry.entry_date
    g.deal_id ||= l.ref_deal_id || null
    g.contact_id ||= l.ref_contact_id || null
  }

  // What has actually been paid against each source, through the canonical payment
  // primitive — not a status flag on the source record.
  const { data: allocs } = await supabaseAdmin.from('payment_allocations')
    .select('subject_type, subject_id, amount').eq('dealership_id', dealershipId).limit(20000)
  const paidBySubject = {}
  for (const a of allocs || []) paidBySubject[a.subject_id] = round2((paidBySubject[a.subject_id] || 0) + n(a.amount))

  const out = []
  for (const g of Object.values(bySource)) {
    const raised = round2(g.raised)
    const applied = round2(g.credited + (paidBySubject[g.source_id] || 0))
    const balance = round2(raised - applied)
    if (raised === 0 && balance === 0) continue
    const age = daysSince(g.opened_at)
    out.push({
      source_id: g.source_id, source: g.source, event_name: g.event_name,
      deal_id: g.deal_id, contact_id: g.contact_id, memo: g.memo,
      opened_at: g.opened_at, age_days: age, bucket: agingBucket(age),
      original: raised, applied, balance,
      status: balance === 0 ? 'settled'
            : balance < 0 ? 'overpaid'
            : applied > 0 ? 'partial'
            : age != null && age > 30 ? 'overdue' : 'current',
    })
  }
  return out.sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))
}

// Contracts in Transit — a LENDER receivable, deliberately kept out of customer AR.
export async function contractsInTransit(dealershipId) {
  const lines = await postedLinesFor(dealershipId, 'contracts_in_transit')
  const byDeal = {}
  for (const l of lines) {
    const key = l.ref_deal_id || l.entry.reference || l.journal_entry_id
    const g = (byDeal[key] ||= { deal_id: l.ref_deal_id || null, source_id: key, debited: 0, credited: 0, delivered_at: l.entry.entry_date })
    g.debited += n(l.debit); g.credited += n(l.credit)
    if (l.entry.entry_date < g.delivered_at) g.delivered_at = l.entry.entry_date
  }
  const rows = []
  for (const g of Object.values(byDeal)) {
    const balance = round2(g.debited - g.credited)
    const age = daysSince(g.delivered_at)
    rows.push({
      ...g, debited: round2(g.debited), credited: round2(g.credited), balance,
      age_days: age, bucket: agingBucket(age),
      // A negative CIT is the signature of the pre-PR-5.2 defect: funding credited an
      // account delivery never debited. It must never reappear.
      state: balance === 0 ? 'cleared' : balance < 0 ? 'exception' : age != null && age > 21 ? 'aging' : 'awaiting_funding',
    })
  }
  return rows.sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0))
}

// ── Accounts Payable ────────────────────────────────────────────────────────
// The canonical expense records, with the ledger's payable balance beside them.
export async function payables(dealershipId) {
  const { data: exps } = await supabaseAdmin.from('expenses')
    .select('id, expense_date, amount, tax, subtotal, category, department, vendor, vendor_id, status, approved_at, approved_by, posted, notes')
    .eq('dealership_id', dealershipId).is('deleted_at', null)
    .in('status', ['draft', 'submitted', 'approved', 'paid', 'rejected'])
    .order('expense_date', { ascending: false }).limit(2000)

  // What the ledger actually carries per bill, so the queue cannot drift from the books.
  const apLines = await postedLinesFor(dealershipId, 'accounts_payable')
  const ledgerByRef = {}
  for (const l of apLines) {
    const ref = l.entry.reference
    if (!ref) continue
    const g = (ledgerByRef[ref] ||= { credited: 0, debited: 0 })
    g.credited += n(l.credit); g.debited += n(l.debit)
  }

  return (exps || []).map(e => {
    const led = ledgerByRef[e.id] || { credited: 0, debited: 0 }
    const outstanding = round2(led.credited - led.debited)
    const age = daysSince(e.approved_at || e.expense_date)
    return {
      id: e.id, vendor: e.vendor || null, vendor_id: e.vendor_id || null,
      reference: e.notes ? String(e.notes).slice(0, 60) : null,
      amount: round2(e.amount), tax: round2(e.tax), subtotal: round2(e.subtotal),
      date: e.expense_date, department: e.department || null, category: e.category || null,
      status: e.status, approved_at: e.approved_at || null, approved_by: e.approved_by || null,
      // Ledger truth, not a status flag.
      posted_to_ledger: led.credited > 0,
      outstanding, age_days: age, bucket: agingBucket(age),
      view: e.status === 'draft' || e.status === 'submitted' ? 'needs_review'
          : e.status === 'approved' && outstanding > 0 ? 'due'
          : e.status === 'paid' && outstanding === 0 ? 'paid'
          : e.status === 'rejected' ? 'exception'
          : outstanding !== 0 ? 'exception' : 'approved',
    }
  })
}

// ── Exceptions — what Accounting has to look at ─────────────────────────────
export async function accountingExceptions(dealershipId) {
  const [ar, cit, ap, failed, raised] = await Promise.all([
    receivables(dealershipId),
    contractsInTransit(dealershipId),
    payables(dealershipId),
    supabaseAdmin.from('accounting_event_log').select('id, event_name, error, processed_at, event_id')
      .eq('dealership_id', dealershipId).eq('status', 'failed').order('processed_at', { ascending: false }).limit(50),
    supabaseAdmin.from('exceptions').select('id, kind, entity_type, entity_id, description, severity, created_at')
      .eq('dealership_id', dealershipId).eq('department', 'Accounting').eq('status', 'open')
      .order('created_at', { ascending: false }).limit(50),
  ])

  const items = []
  const add = (o) => items.push(o)

  // A transaction that never reached the books outranks everything else here.
  for (const f of failed.data || []) {
    add({ kind: 'posting_failed', severity: 3, source: f.event_name, amount: null,
          age_days: daysSince(f.processed_at), reason: f.error || 'Posting was refused',
          owner: 'Accounting', action: 'Resolve Exception', ref: f.event_id || f.id })
  }
  for (const x of raised.data || []) {
    add({ kind: x.kind, severity: x.severity === 'high' ? 3 : 2, source: x.entity_type, amount: null,
          age_days: daysSince(x.created_at), reason: x.description || x.kind,
          owner: 'Accounting', action: 'Resolve Exception', ref: x.entity_id })
  }
  for (const c of cit.filter(c => c.state === 'exception')) {
    add({ kind: 'cit_negative', severity: 3, source: 'deal', amount: c.balance,
          age_days: c.age_days, reason: 'Contracts in Transit is negative — funding credited more than delivery debited',
          owner: 'F&I', action: 'Review Deal', ref: c.deal_id || c.source_id })
  }
  for (const c of cit.filter(c => c.state === 'aging')) {
    add({ kind: 'funding_aging', severity: 2, source: 'deal', amount: c.balance,
          age_days: c.age_days, reason: `Delivered ${c.age_days} days ago and still not funded`,
          owner: 'F&I', action: 'Review Deal', ref: c.deal_id || c.source_id })
  }
  for (const r of ar.filter(r => r.status === 'overpaid')) {
    add({ kind: 'ar_overpaid', severity: 2, source: r.source, amount: r.balance,
          age_days: r.age_days, reason: 'More has been applied than was ever billed',
          owner: 'Accounting', action: 'Apply Payment', ref: r.source_id })
  }
  for (const r of ar.filter(r => r.balance > 0 && (r.age_days ?? 0) > 60)) {
    add({ kind: 'ar_overdue', severity: 2, source: r.source, amount: r.balance,
          age_days: r.age_days, reason: `Outstanding ${r.age_days} days`,
          owner: 'Accounting', action: 'Apply Payment', ref: r.source_id })
  }
  for (const b of ap.filter(b => b.view === 'needs_review')) {
    add({ kind: 'ap_needs_approval', severity: 1, source: 'expense', amount: b.amount,
          age_days: b.age_days, reason: `${b.vendor || 'Vendor'} bill awaiting approval`,
          owner: 'Accounting', action: 'Approve Expense', ref: b.id })
  }
  for (const b of ap.filter(b => b.view === 'due' && (b.age_days ?? 0) > 30)) {
    add({ kind: 'ap_overdue', severity: 2, source: 'expense', amount: b.outstanding,
          age_days: b.age_days, reason: `${b.vendor || 'Vendor'} unpaid ${b.age_days} days`,
          owner: 'Accounting', action: 'Approve Expense', ref: b.id })
  }
  for (const b of ap.filter(b => b.view === 'exception')) {
    add({ kind: 'ap_exception', severity: 2, source: 'expense', amount: b.outstanding,
          age_days: b.age_days, reason: 'Bill status and ledger balance disagree',
          owner: 'Accounting', action: 'Resolve Exception', ref: b.id })
  }

  return items.sort((a, b) => (b.severity - a.severity) || ((b.age_days ?? 0) - (a.age_days ?? 0)))
}

// ── Period close ────────────────────────────────────────────────────────────
// What actually prevents this period from closing. Every item below is DERIVED from
// real accounting state — a checklist you can tick regardless of the books is theatre,
// and the brief is explicit that manual attestation belongs only to genuinely manual
// controls. Bank reconciliation is the one such item today, and it says so.
export async function closeChecklist(dealershipId, period) {
  const p = /^\d{4}-\d{2}$/.test(String(period || '')) ? period : new Date().toISOString().slice(0, 7)
  const from = `${p}-01`
  const [y, m] = p.split('-').map(Number)
  const to = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`

  const [{ data: periodRow }, { data: failures }, exceptions, cit, ar, ap,
         { data: commExc }, { data: entries }] = await Promise.all([
    supabaseAdmin.from('accounting_periods').select('*').eq('dealership_id', dealershipId).eq('period', p).maybeSingle(),
    supabaseAdmin.from('accounting_event_log').select('id').eq('dealership_id', dealershipId).eq('status', 'failed').limit(500),
    supabaseAdmin.from('exceptions').select('id').eq('dealership_id', dealershipId).eq('department', 'Accounting').eq('status', 'open').limit(500),
    contractsInTransit(dealershipId),
    receivables(dealershipId),
    payables(dealershipId),
    supabaseAdmin.from('commission_exceptions').select('id').eq('dealership_id', dealershipId).eq('status', 'open').limit(500),
    supabaseAdmin.from('journal_entries').select('id, posted').eq('dealership_id', dealershipId)
      .gte('entry_date', from).lt('entry_date', to).limit(20000),
  ])

  const drafts = (entries || []).filter(e => !e.posted).length
  const openExc = (exceptions?.data || exceptions || []).length ?? 0

  // Trial balance for the period, posted only.
  const postedIds = (entries || []).filter(e => e.posted).map(e => e.id)
  let tbDr = 0, tbCr = 0
  for (const l of await linesForEntries(postedIds, 'debit, credit')) { tbDr += n(l.debit); tbCr += n(l.credit) }

  const item = (key, label, blocking, ok, detail) => ({ key, label, blocking, status: ok ? 'clear' : 'blocked', detail })
  const items = [
    item('events', 'All operational events reached the books', true,
      !(failures || []).length, `${(failures || []).length} posting failure(s)`),
    item('drafts', 'No unposted journals in the period', true,
      drafts === 0, `${drafts} draft journal(s)`),
    item('exceptions', 'Accounting exceptions resolved', true,
      openExc === 0, `${openExc} open exception(s)`),
    item('cit', 'Contracts in Transit reviewed', true,
      !cit.some(c => c.balance < 0), `${cit.filter(c => c.balance < 0).length} negative, ${cit.filter(c => c.balance > 0).length} awaiting funding`),
    item('ar', 'Receivables reviewed', false,
      !ar.some(r => r.status === 'overpaid'), `${ar.filter(r => r.balance > 0).length} open, ${ar.filter(r => r.status === 'overpaid').length} overpaid`),
    item('ap', 'Payables reviewed', false,
      !ap.some(b => b.view === 'needs_review' || b.view === 'exception'),
      `${ap.filter(b => b.view === 'needs_review').length} awaiting approval, ${ap.filter(b => b.view === 'exception').length} exception(s)`),
    item('commissions', 'Commission exceptions resolved', false,
      !(commExc || []).length, `${(commExc || []).length} open commission exception(s)`),
    item('balanced', 'Trial balance balances', true,
      round2(tbDr) === round2(tbCr), `debits ${round2(tbDr)} vs credits ${round2(tbCr)}`),
    // The one genuinely manual control: there is no reconciliation model to derive from.
    { key: 'bank', label: 'Bank reconciled', blocking: false, status: 'manual',
      detail: 'No reconciliation model exists yet — this is an attestation, not a derived result.' },
  ]

  const blockers = items.filter(i => i.blocking && i.status === 'blocked')
  return {
    period: p, status: periodRow?.status || 'open',
    locked: ['closed', 'locked'].includes(periodRow?.status),
    items, blockers: blockers.length, can_close: blockers.length === 0,
    trial_balance: { debit: round2(tbDr), credit: round2(tbCr), balanced: round2(tbDr) === round2(tbCr) },
  }
}

export function registerAccountingArAp(app) {
  const canView = requirePermission('accounting.view')
  const canEdit = requirePermission('accounting.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  app.get('/accounting/receivables', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const rows = await receivables(req.dealershipId)
      const buckets = {}
      for (const r of rows) if (r.balance > 0) buckets[r.bucket] = round2((buckets[r.bucket] || 0) + r.balance)
      res.json({ receivables: rows, aging: buckets, total: round2(rows.reduce((s, r) => s + r.balance, 0)) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/accounting/contracts-in-transit', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const rows = await contractsInTransit(req.dealershipId)
      res.json({ contracts: rows, total: round2(rows.reduce((s, r) => s + r.balance, 0)) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/accounting/payables', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const rows = await payables(req.dealershipId)
      const buckets = {}
      for (const r of rows) if (r.outstanding > 0) buckets[r.bucket] = round2((buckets[r.bucket] || 0) + r.outstanding)
      res.json({ payables: rows, aging: buckets, total: round2(rows.reduce((s, r) => s + r.outstanding, 0)) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/accounting/exceptions', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ exceptions: await accountingExceptions(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Deal posting — has this business transaction reached the books correctly?
  // Derived from the accounting event log and the ledger; no second posting state.
  app.get('/accounting/deal-posting', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: deals } = await supabaseAdmin.from('deals')
        .select('id, deal_number, contact_id, inventory_id, deal_type, deal_status, selling_price, delivered_at, funding_status, funded_at, finance_company')
        .eq('dealership_id', req.dealershipId).is('deleted_at', null)
        .eq('deal_status', 'delivered').order('delivered_at', { ascending: false }).limit(300)
      if (!deals?.length) return res.json({ deals: [] })

      const ids = deals.map(d => d.id)
      const { data: entries } = await supabaseAdmin.from('journal_entries')
        .select('id, reference, event_name, posted, entry_date')
        .eq('dealership_id', req.dealershipId).eq('source', 'deal').in('reference', ids)
      const journalByDeal = Object.fromEntries((entries || []).filter(e => e.posted).map(e => [e.reference, e]))
      const { data: failures } = await supabaseAdmin.from('accounting_event_log')
        .select('event_name, status, error, processed_at').eq('dealership_id', req.dealershipId)
        .eq('status', 'failed').limit(200)

      const cit = Object.fromEntries((await contractsInTransit(req.dealershipId)).map(c => [c.deal_id || c.source_id, c]))
      const ar = Object.fromEntries((await receivables(req.dealershipId)).map(r => [r.source_id, r]))

      res.json({
        deals: deals.map(d => {
          const journal = journalByDeal[d.id] || null
          const c = cit[d.id] || null
          return {
            deal_id: d.id, deal_number: d.deal_number, contact_id: d.contact_id, inventory_id: d.inventory_id,
            deal_type: d.deal_type || null, lender: d.finance_company || null,
            delivered_at: d.delivered_at, funding_status: d.funding_status || null, funded_at: d.funded_at || null,
            journal_entry_id: journal?.id || null,
            cit_balance: c?.balance ?? 0, cit_state: c?.state || null,
            customer_ar: ar[d.id]?.balance ?? 0,
            // Posting state comes from the ledger, not a second persisted flag.
            posting_state: journal ? (c && c.balance < 0 ? 'exception' : 'posted')
                                   : (failures || []).length ? 'exception' : 'pending',
          }
        }),
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/accounting/close-checklist', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json(await closeChecklist(req.dealershipId, req.query?.period)) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Apply a payment to a receivable through the canonical primitive. This route does not
  // move money itself — it records the allocation, and the payment engine posts it.
  app.post('/accounting/receivables/:sourceId/apply', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const amount = round2(req.body?.amount)
    const paymentId = req.body?.payment_id
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be greater than zero' })
    if (!paymentId) return res.status(400).json({ error: 'payment_id is required — record the payment first' })
    try {
      const rows = await receivables(req.dealershipId)
      const target = rows.find(r => r.source_id === req.params.sourceId)
      if (!target) return res.status(404).json({ error: 'receivable not found' })
      // Over-application is refused rather than silently creating a negative receivable.
      if (amount > target.balance) {
        return res.status(409).json({ error: `Only ${target.balance.toFixed(2)} is outstanding on this receivable.` })
      }
      const { data, error } = await supabaseAdmin.from('payment_allocations').insert({
        dealership_id: req.dealershipId, payment_id: paymentId,
        subject_type: target.source, subject_id: target.source_id,
        amount, created_by: req.user?.id || null,
      }).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      res.json({ ok: true, allocation: data, remaining: round2(target.balance - amount) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
