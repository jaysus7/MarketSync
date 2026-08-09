import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// DealerOS core Payment + Allocation. Behaviour was proved against the live staging
// database (9/9, recorded in docs/SESSION_HANDOFF.md); this pins the shape so a later
// change cannot quietly turn it back into a department-local payment table.

const mig = readFileSync(new URL('../migrations/2026-08-09-core-payments-and-allocations.sql', import.meta.url), 'utf8')

test('payment is a CORE primitive, not a department table', () => {
  assert.match(mig, /create table if not exists public\.payments/)
  for (const wrong of ['service_payments', 'deal_payments', 'fni_payments', 'ro_payments']) {
    assert.ok(!mig.includes(`create table if not exists public.${wrong}`), `must not create ${wrong}`)
  }
  // No department key on the payment itself — where money lands is a separate fact.
  const table = mig.match(/create table if not exists public\.payments \([\s\S]*?\n\);/)?.[0] || ''
  for (const leak of ['ro_id', 'repair_order_id', 'deal_id']) {
    assert.ok(!table.includes(leak), `${leak} must not live on the payment — a payment can split`)
  }
})

test('allocation is how money reaches an obligation, and it can split', () => {
  assert.match(mig, /create table if not exists public\.payment_allocations/)
  assert.match(mig, /subject_type text not null check \(subject_type in \('repair_order','deal','contact_credit'\)\)/,
    'the subject mechanism stays small and explicit rather than open polymorphism')
  assert.match(mig, /payment_id uuid not null references public\.payments\(id\)/)
})

test('you cannot apply more money than arrived, even concurrently', () => {
  const fn = mig.match(/create or replace function public\.payment_allocation_guard[\s\S]*?end \$\$;/)?.[0] || ''
  assert.match(fn, /where id = new\.payment_id and dealership_id = new\.dealership_id for update/,
    'the payment must be locked while the remaining balance is decided')
  assert.match(fn, /if v_alloc \+ new\.amount > v_pay\.amount then/)
  assert.match(fn, /Payment not found for this dealership/, 'allocation must be tenant-scoped')
})

test('a webhook retry cannot create a second payment', () => {
  assert.match(mig, /create unique index if not exists payments_processor_ref_uk[\s\S]*?\(dealership_id, processor, processor_reference\)/,
    'the provider reference must be unique per dealership')
  assert.match(mig, /create unique index if not exists payments_idempotency_uk/,
    'callers get their own idempotency key too')
  // Application-level checks are not enough; both are database constraints.
})

test('received money is history — refunds are recorded, not simulated', () => {
  const fn = mig.match(/create or replace function public\.payments_protect[\s\S]*?end \$\$;/)?.[0] || ''
  assert.match(fn, /A received payment cannot be rewritten/)
  for (const frozen of ['amount', 'currency', 'processor_reference']) {
    assert.ok(fn.includes(`new.${frozen} is distinct from old.${frozen}`), `${frozen} must be frozen once received`)
  }
  assert.match(mig, /create trigger payments_nodelete before delete/)
  assert.match(mig, /refunded_amount numeric not null default 0/, 'a refund is its own recorded amount')
})

test('an unapplied payment is what a deposit actually is', () => {
  // Nothing forces a payment to be fully allocated — the remainder IS the deposit,
  // which is why no separate deposits table is needed.
  assert.ok(!mig.includes('create table if not exists public.deposits'),
    'deposits must not become a second payment system')
})

// ── Accounting integration: payment clears AR, and never re-recognises revenue ──

const payRule = readFileSync(new URL('../migrations/2026-08-09-core-payment-received-rule.sql', import.meta.url), 'utf8')
const payments = readFileSync(new URL('../routes/payments.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const acctEngine = readFileSync(new URL('../routes/accounting-engine.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('a payment clears AR and never recognises revenue or tax again', () => {
  const rule = payRule.match(/'payment_received', '\[[\s\S]*?\]'::jsonb/)?.[0] || ''
  assert.match(rule, /"account_key":"cash","side":"debit","source":"amount"/)
  assert.match(rule, /"account_key":"accounts_receivable","side":"credit","source":"applied"/)
  assert.match(rule, /"account_key":"customer_deposits","side":"credit","source":"unapplied"/)
  // The whole point: the invoice recognised revenue and tax. Cash must not do it again.
  for (const forbidden of ['service_revenue', 'parts_revenue', 'tax_collected']) {
    assert.ok(!rule.includes(forbidden), `a payment must never post to ${forbidden}`)
  }
})

test('unapplied money is a deposit liability, not a receivable', () => {
  const fn = payments.match(/export async function publishPaymentReceived[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /const unapplied = round2\(n\(pay\.amount\) - applied\)/,
    'the split must be derived from real allocations, not assumed')
  assert.match(fn, /if \(!pay \|\| pay\.status !== 'received'\) return null/,
    'only money that actually arrived may post')
})

test('one real payment produces one payment and one posting', () => {
  const fn = payments.match(/export async function recordPayment[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(existing\) return \{ payment: existing, created: false \}/,
    'a retry must return the original payment')
  assert.match(fn, /const raced = await findExistingPayment/, 'and must survive losing the unique-index race')
  // The event is emitted only on genuine creation, so a webhook retry posts nothing.
  assert.match(payments, /if \(created\) \{\s*\n\s*await publishPaymentReceived/,
    'a retried payment must not emit a second financial event')
  assert.match(acctEngine, /__reference: p\.ref \|\| e/, 'and the posting itself dedupes on the payment id')
})

test('payments are core — Service does not own them and writes no journal', () => {
  assert.match(acctEngine, /case 'payment\.received':/, 'the canonical event must be routed')
  assert.doesNotMatch(payments, /from\('journal_entries'\)|postByRule/,
    'the payment module records money, Accounting posts it')
  assert.doesNotMatch(payments, /repair_orders|service_/, 'the core payment module must not know about Service')
})
