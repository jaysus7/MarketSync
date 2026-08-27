import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { agingBucket } from '../routes/accounting-ar-ap.js'

// Phase 5 PR 5.2 — Accounts Receivable, Accounts Payable and the Accounting workspace.
//
// The rules everything here rests on:
//   * AR and AP are DERIVED from the posted ledger. Neither is a second ledger, and
//     neither may be a frontend-only balance.
//   * Contracts in Transit is a LENDER receivable and is reported separately from
//     customer AR. Conflating them is the exact defect PR 5.2 corrected in the ledger.
//   * Only posted journals count (PR 5.1).

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const arap = strip(read(BE, 'routes/accounting-ar-ap.js'))
const exp = strip(read(BE, 'routes/expenses.js'))
const expRaw = read(BE, 'routes/expenses.js')
const eng = strip(read(BE, 'routes/accounting-engine.js'))
const apRules = read(BE, 'migrations/2026-08-10-phase5-ap-rules.sql')
const ws = strip(read(FE, 'js/modules/accounting-workspace.js') + '\n' + read(FE, 'js/modules/accounting-views.js'))
const registry = read(FE, 'js/modules/workspace-registry.js')
const part2 = read(FE, 'js/modules/dashboard-part2.js')
const html = read(FE, 'dashboard.html')

// ── Aging is real arithmetic ─────────────────────────────────────────────────

test('aging buckets are derived from actual age', () => {
  assert.equal(agingBucket(0), 'current')
  assert.equal(agingBucket(1), '1-30')
  assert.equal(agingBucket(30), '1-30')
  assert.equal(agingBucket(31), '31-60')
  assert.equal(agingBucket(60), '31-60')
  assert.equal(agingBucket(61), '61-90')
  assert.equal(agingBucket(90), '61-90')
  assert.equal(agingBucket(91), '90+')
  assert.equal(agingBucket(null), 'unknown', 'an unknown date must not silently read as current')
})

test('aging is never persisted as source truth', () => {
  // A stored bucket is wrong the day after it is written.
  assert.doesNotMatch(arap, /insert into.*aging|from\('ar_aging'\)|aging_bucket:/i)
  assert.match(arap, /export function agingBucket/, 'it must be derived on read')
})

// ── AR is ledger-grounded ────────────────────────────────────────────────────

test('receivables come from posted journal lines, not a status flag', () => {
  const fn = arap.match(/export async function receivables[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'receivables must exist')
  assert.match(fn, /postedLinesFor\(dealershipId, 'accounts_receivable'\)/)
  // Payments applied come from the canonical payment primitive.
  assert.match(fn, /from\('payment_allocations'\)/)
  assert.doesNotMatch(fn, /\.eq\('paid', true\)|paid: true/, 'AR must not read a paid flag')
})

test('only posted journals count toward any balance', () => {
  const helper = arap.match(/async function postedLinesFor[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(helper, /\.eq\('posted', true\)/, 'drafts are not financial truth')
  // Nothing may read journal_lines without going through the single read helper.
  const directReads = [...arap.matchAll(/from\('journal_lines'\)/g)].length
  assert.equal(directReads, 1, `journal_lines must be read only inside linesForEntries, saw ${directReads}`)
})

test('Contracts in Transit is reported as a lender receivable, never as customer AR', () => {
  assert.match(arap, /export async function contractsInTransit/)
  const cit = arap.match(/export async function contractsInTransit[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(cit, /postedLinesFor\(dealershipId, 'contracts_in_transit'\)/)
  // And the customer AR derivation must not fold CIT into itself.
  const ar = arap.match(/export async function receivables[\s\S]*?\n\}\n/)?.[0] || ''
  assert.doesNotMatch(ar, /contracts_in_transit/, 'CIT must stay out of customer AR')
  // A negative CIT is the signature of the old defect and must be surfaced.
  assert.match(cit, /balance < 0 \? 'exception'/)
})

test('the AR/AP surface writes no journals', () => {
  for (const forbidden of ['postJournal', 'postByRule', "from('journal_entries').insert", 'accounting_post_journal']) {
    assert.ok(!arap.includes(forbidden), `the read surface must not post: ${forbidden}`)
  }
})

test('applying a payment goes through the canonical allocation, and cannot over-apply', () => {
  const route = arap.match(/app\.post\('\/accounting\/receivables\/:sourceId\/apply'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the apply route must exist')
  assert.match(route, /from\('payment_allocations'\)\.insert/)
  assert.match(route, /payment_id is required/, 'money must exist as a payment before it can be applied')
  assert.match(route, /amount > target\.balance/, 'over-application must be refused')
  assert.doesNotMatch(route, /paid: true/, 'never a bare paid flag')
})

// ── AP reaches the real ledger ───────────────────────────────────────────────

test('an approved bill creates a payable in the double-entry ledger', () => {
  // It previously posted only to the legacy single-sided gl_entries, so no Accounts
  // Payable liability existed anywhere in the trial balance.
  assert.match(exp, /eventName: 'expense\.approved'/, 'approval must emit the business event')
  assert.match(eng, /case 'expense\.approved':/)
  const handler = eng.match(/case 'expense\.approved': \{[\s\S]*?\n    \}/)?.[0] || ''
  assert.match(handler, /account_key: 'accounts_payable', debit: 0, credit: amount/,
    'the credit side is always the payable')
  assert.match(handler, /account_key: p\.account_key, debit: amount/, 'the debit comes from the bill')
})

test('an unclassifiable bill fails loudly instead of guessing an account', () => {
  const handler = eng.match(/case 'expense\.approved': \{[\s\S]*?\n    \}/)?.[0] || ''
  assert.match(handler, /if \(!p\.account_key\)/)
  assert.match(handler, /throw new PostingError/)
  assert.match(handler, /code: 'AC001'/, 'it must use the PR 5.1 unknown-account protection')
  // The mapping itself must be explicit and server-side.
  assert.match(expRaw, /export const EXPENSE_ACCOUNT_KEYS/)
  assert.match(expRaw, /'Other': null/, 'a category that cannot be classified maps to nothing on purpose')
})

test('every expense category has a decided mapping', () => {
  const cats = (expRaw.match(/const CATEGORIES = \[([\s\S]*?)\]/)?.[1] || '')
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.ok(cats.length >= 20, `expected the category list, saw ${cats.length}`)
  const map = expRaw.match(/export const EXPENSE_ACCOUNT_KEYS = \{([\s\S]*?)\n\}/)?.[1] || ''
  for (const c of cats) {
    assert.ok(map.includes(`'${c}'`), `category "${c}" has no decided account mapping`)
  }
})

test('paying a bill clears the payable rather than flipping a flag', () => {
  const route = exp.match(/app\.post\('\/expenses\/:id\/pay'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the pay route must exist')
  assert.match(route, /eventName: 'expense\.paid'/)
  assert.match(route, /cur\.status !== 'approved'/, 'an unapproved bill has no payable to clear')
  assert.match(route, /\.eq\('status', 'approved'\)/, 'and the update must guard against a lost update')
  // Accounting owns the treatment — no ledger logic in the route.
  for (const forbidden of ['postJournal', 'journal_lines', 'accounts_payable']) {
    assert.ok(!route.includes(forbidden), `the pay route must not touch the ledger (${forbidden})`)
  }
  assert.match(apRules, /\(null, 'expense_paid', true/, 'and the rule must exist')
})

test('AP balances are read from the ledger, not from the bill status', () => {
  const fn = arap.match(/export async function payables[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /postedLinesFor\(dealershipId, 'accounts_payable'\)/)
  assert.match(fn, /posted_to_ledger/, 'a bill that never reached the ledger must be visible as such')
  assert.match(fn, /outstanding !== 0 \? 'exception'/, 'status and ledger disagreeing is an exception')
})

// ── Exceptions ───────────────────────────────────────────────────────────────

test('the exception queue covers what the brief asks for', () => {
  const fn = arap.match(/export async function accountingExceptions[\s\S]*?\n\}\n/)?.[0] || ''
  for (const kind of ['posting_failed', 'cit_negative', 'funding_aging', 'ar_overpaid',
                      'ar_overdue', 'ap_needs_approval', 'ap_overdue', 'ap_exception']) {
    assert.ok(fn.includes(`'${kind}'`), `missing exception kind: ${kind}`)
  }
  // A failed posting outranks everything — money moved and the books do not know.
  assert.match(fn, /status', 'failed'/)
  assert.match(fn, /kind: 'posting_failed', severity: 3/)
  // It reuses the existing exception primitive rather than inventing a second one.
  assert.match(fn, /from\('exceptions'\)/)
  // Every item carries the six things the brief requires.
  for (const field of ['kind', 'severity', 'source', 'amount', 'age_days', 'reason', 'owner', 'action']) {
    assert.ok(fn.includes(`${field}:`), `exception items must carry ${field}`)
  }
})

// ── The workspace ────────────────────────────────────────────────────────────

test('Accounting registers on the shared engine shell', () => {
  assert.match(ws, /ENGINES\['accounting-overview'\]\s*=/)
  assert.match(ws, /rootId: 'accounting-overview-root'/)
  for (const prim of ['engKpi', 'engCard', 'engEmpty']) assert.ok(ws.includes(prim), `must reuse ${prim}`)
  assert.doesNotMatch(ws, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
    'must not redefine a shared primitive')
})

test('Today is an exception queue, not a wall of KPIs', () => {
  const tab = ws.match(/overview\(body, d\) \{[\s\S]*?\n    \},/)?.[0] || ''
  assert.match(tab, /Needs attention/)
  assert.match(tab, /accExceptionRow/)
  // My Day now carries the whole day — deal posting, CIT, receivables, payables — as
  // scrollable sections. The rule it still has to obey is that it LEADS with attention:
  // the block above the first section is a short KPI strip and the exception queue, not
  // a wall of numbers.
  const lead = tab.split('engSection(')[0]
  const kpis = (lead.match(/engKpi\(/g) || []).length
  assert.ok(kpis <= 4, `Today should lead with attention, not ${kpis} KPIs`)
  assert.ok(lead.indexOf('Needs attention') > -1, 'the exception queue must be above the sections')
})

test('the workspace computes no financial truth of its own', () => {
  // Every figure must arrive from the server already derived from the posted ledger.
  // Structural markers, not bare words: the UI legitimately TELLS a controller that
  // paying a bill "credits cash", and explaining an effect is not performing it.
  for (const forbidden of ['journal_lines', 'journal_entries', 'postJournal', 'accounting_post_journal',
                           'account_key', 'debit:', 'credit:']) {
    assert.ok(!ws.includes(forbidden), `the workspace must not do ledger work (${forbidden})`)
  }
  assert.doesNotMatch(ws, /age_days > 30 \? '31-60'/, 'buckets must not be recomputed client-side')
})

test('it composes accounting endpoints and introduces none', () => {
  // The Accounting-owned reads, plus the pre-existing endpoints this workspace COMPOSES
  // rather than reimplements — the journal, the bank feed, periods and the Commission
  // Engine's own pay periods and exceptions.
  const KNOWN = ['/accounting/exceptions', '/accounting/receivables', '/accounting/payables',
                 '/accounting/contracts-in-transit', '/accounting/deal-posting',
                 '/accounting/journal', '/accounting/close-checklist', '/accounting/periods',
                 '/plaid/transactions', '/commissions/pay-periods', '/commissions/exceptions',
                 // Settings and Budget hold the real settings and the real budget now,
                 // so they read the endpoints that already store them.
                 '/accounting/settings', '/accounting/budget', '/accounting/accounts',
                 '/plaid/status', '/plaid/config', '/commissions/plans']
  for (const c of [...ws.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
    assert.ok(KNOWN.includes(c), `unexpected read endpoint: ${c}`)
  }
  // Both quoting styles, so a single-quoted write cannot slip past the allowlist.
  const WRITES = ['/expenses/${id}/approve', '/expenses/${expId}/approve', '/expenses/${id}/pay', '/accounting/periods/advance',
                  '/accounting/settings', '/accounting/budget',
                  '/accounting/receivables/${sourceId}/apply',
                  // Manual financial entry — a real, permissioned (accounting.edit) endpoint
                  // the Budget tab composes to record a manual income/expense.
                  '/accounting/entries',
                  '/plaid/link-token', '/plaid/exchange', '/plaid/sync', '/plaid/disconnect']
  for (const w of [...ws.matchAll(/apiSendJson\([`']([^`']+)[`']/g)].map(m => m[1])) {
    assert.ok(WRITES.includes(w), `unexpected write target: ${w}`)
  }
})

test('Deal Posting shows CIT and customer AR as separate figures', () => {
  assert.match(ws, /Contracts in Transit \(Lenders\)/)
  assert.match(ws, /Customer \/ Store AR/)
})

test('Accounting is wired into the shell and leads with Today', () => {
  assert.match(html, /data-page-content="accounting-overview"/)
  assert.match(html, /id="accounting-overview-root"/)
  assert.match(part2, /if \(pageId === 'accounting-overview'\) loadAccountingWorkspace\(\)/)
  assert.match(part2, /'accounting-overview': 'os\.accounting'/, 'must carry an entitlement key')
  const block = registry.match(/\n  accounting: \{[\s\S]*?\n  \},/)?.[0] || ''
  // Lead tab is labelled 'Pulse' product-wide (sales/parts tests require it); it IS the
  // role-aware My Day surface.
  assert.match(block, /\{ page: 'accounting-overview', label: 'Pulse' \}/)
  // The existing rich Accounting page stays reachable — KEEP over REPLACE.
  for (const p of ['accounting', 'commissions']) {
    assert.ok(block.includes(`page: '${p}'`), `existing page "${p}" must stay reachable`)
  }
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('accounting-workspace.js') > pos('dashboard-part26.js'), 'must load after the dashboard parts')
})

// ── Journal, Close, Banking, Payroll (the rest of the department) ────────────

test('the close checklist is derived from real accounting state', () => {
  const fn = arap.match(/export async function closeChecklist[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'closeChecklist must exist')
  // A checklist you can tick regardless of the books is theatre.
  for (const src of ['accounting_event_log', 'exceptions', 'contractsInTransit',
                     'receivables', 'payables', 'commission_exceptions', 'journal_entries']) {
    assert.ok(fn.includes(src), `the checklist must read real state: ${src}`)
  }
  assert.match(fn, /blockers = items\.filter\(i => i\.blocking && i\.status === 'blocked'\)/)
  assert.match(fn, /can_close: blockers\.length === 0/, 'closing must be gated on real blockers')
})

test('only genuinely manual controls are attestations', () => {
  const fn = arap.match(/export async function closeChecklist[\s\S]*?\n\}\n/)?.[0] || ''
  const manual = [...fn.matchAll(/status: 'manual'/g)].length
  assert.equal(manual, 1, `exactly one manual attestation expected, saw ${manual}`)
  // And it must say WHY it cannot be derived, rather than looking like a real result.
  assert.match(fn, /No reconciliation model exists yet/)
  assert.match(fn, /key: 'bank'/)
})

test('the period trial balance counts posted entries only', () => {
  const fn = arap.match(/export async function closeChecklist[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /const postedIds = \(entries \|\| \[\]\)\.filter\(e => e\.posted\)/)
  assert.match(fn, /linesForEntries\(postedIds/)
  assert.match(fn, /item\('drafts'/, 'unposted journals in the period must be a blocker')
})

test('journal_lines still has exactly one read site', () => {
  // Adding the close checklist must not have opened a second path that could forget the
  // posted filter.
  const reads = [...arap.matchAll(/from\('journal_lines'\)/g)].length
  assert.equal(reads, 1, `journal_lines must be read only inside linesForEntries, saw ${reads}`)
  assert.match(arap, /async function linesForEntries/)
})

test('the Journal reports view renders general ledger entries and debits/credits equation', () => {
  assert.match(ws, /accRenderReports/)
  assert.match(ws, /general ledger/i)
})

test('Banking is presented as a feed and statement attestation', () => {
  assert.match(ws, /accRenderBank/)
  assert.match(ws, /accAttestStatement/)
})

test('Money Out reviews payables, expenses, and payroll without client-side commission math', () => {
  assert.match(ws, /accRenderMoneyOut/)
  assert.doesNotMatch(ws, /front_amount|back_amount|spiff_amount|\* rate|plan\./,
    'the workspace must not compute a commission')
})

test('Close view renders period checklist and execution controls', () => {
  assert.match(ws, /accRenderClose/)
  assert.match(ws, /accExecutePeriodClose/)
})

test('advancing a period asks the server and owns nothing itself', () => {
  assert.match(ws, /apiSendJson\('\/accounting\/periods\/advance', 'POST'/)
})
