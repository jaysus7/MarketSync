import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Stage 3 financial-safety guards.
//
// The Accounting Engine already handled `funding.received`, `trade.received` and
// `vehicle.acquired` but nothing emitted them, so funding never cleared Contracts in
// Transit (docs/STAGE3_INVENTORY_FNI_AUDIT.md §6.1). These tests pin the properties
// that make enabling a producer safe: the event fires on the TRANSITION only, it is
// idempotent at two independent layers, and no ledger logic leaks into the route.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')

const fni = read('routes/fni.js')
const acct = read('routes/accounting-engine.js')
const migration = read('migrations/2026-08-09-funding-and-lender-decisions.sql')

test('accounting posting is idempotent on (dealership, source, reference, event)', () => {
  // This is the safety net that makes a duplicate emit harmless. If this dedupe is
  // ever removed, every producer below becomes unsafe.
  //
  // Phase 5 PR 5.1 moved the guarantee from application code into the database: the old
  // select-then-insert let two concurrent deliveries of the same event both pass the
  // check. The unique index is now what a race actually hits, so that is what this pins.
  const ledger = read('migrations/2026-08-10-phase5-ledger-integrity.sql')
  assert.match(ledger, /create unique index if not exists journal_entries_source_identity_uk[\s\S]*?\(dealership_id, source, reference, event_name\)/,
    'the source identity must be unique in the database')
  assert.match(ledger, /exception when unique_violation then/,
    'losing the race must return the existing entry, never insert a second')
  assert.match(acct, /rpc\('accounting_post_journal'/,
    'postJournal must go through the atomic posting function that owns the dedupe')
})

test('funding.received fires only on the transition into funded', () => {
  const route = fni.match(/app\.put\('\/fni\/deals\/:id\/funding'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the funding endpoint must exist')
  // Guarded by the PREVIOUS state, so re-saving an already-funded deal emits nothing.
  assert.match(route, /const wasFunded = deal\.funding_status === 'funded'/)
  assert.match(route, /if \(next === 'funded' && !wasFunded\)/, 'emit must be guarded on the transition')
  assert.match(route, /eventName: 'funding\.received'/)
  // funded_at is stamped once, on the same guarded transition.
  assert.match(route, /if \(next === 'funded' && !wasFunded\) patch\.funded_at = now/)
})

test('the funding route contains no ledger logic', () => {
  const route = fni.match(/app\.put\('\/fni\/deals\/:id\/funding'[\s\S]*?\n  \}\)/)?.[0] || ''
  for (const forbidden of ['journal_entries', 'postJournal', 'postByRule', 'contracts_in_transit', 'debit', 'credit_account']) {
    assert.ok(!route.includes(forbidden), `funding route must not touch the ledger (${forbidden})`)
  }
  // Accounting stays the owner of the Contracts-in-Transit clearing rule.
  assert.match(acct, /case 'funding\.received':/)
  assert.match(acct, /contracts_in_transit/)
})

test('funding_status is a small closed vocabulary, enforced in the database', () => {
  assert.match(fni, /const FUNDING_STATES = \['not_required', 'pending', 'submitted', 'conditions', 'funded', 'exception'\]/)
  assert.match(migration, /deals_funding_status_chk/)
  assert.match(migration, /'not_required','pending','submitted','conditions','funded','exception'/)
})

test('deals did not become a lender-response table', () => {
  // Only three small columns on the canonical deal…
  const added = [...migration.matchAll(/alter table public\.deals add column if not exists (\w+)/g)].map(m => m[1])
  assert.deepEqual(added.sort(), ['funded_at', 'funding_status', 'funding_submitted_at'])
  // …and the per-lender answer lives in its own one-to-many table.
  assert.match(migration, /create table if not exists public\.deal_lender_decisions/)
  for (const col of ['deal_id', 'lender_id', 'submission_status', 'submitted_at', 'responded_at',
                     'decision', 'rate', 'term_months', 'approved_amount', 'conditions',
                     'approval_expires_on', 'selected', 'dealership_id']) {
    assert.ok(migration.includes(col), `lender decision must record ${col}`)
  }
})

test('lender decisions do not duplicate customer, vehicle or deal data', () => {
  const table = migration.match(/create table if not exists public\.deal_lender_decisions[\s\S]*?\n\);/)?.[0] || ''
  for (const forbidden of ['contact_id', 'customer_name', 'inventory_id', 'vin', 'selling_price', 'stocknumber']) {
    assert.ok(!table.includes(forbidden), `lender decision must not copy ${forbidden} — reference the deal instead`)
  }
})

test('only one lender decision can be selected per deal — enforced by the database', () => {
  assert.match(migration, /create unique index if not exists dld_one_selected_per_deal\s*\n\s*on public\.deal_lender_decisions\(deal_id\) where selected/,
    'a partial unique index must make two selected decisions impossible')
  // The route also clears the previous selection, but the index is the real guarantee.
  assert.match(fni, /lender-decisions\/:id\/select/)
})

test('lender decision table is tenant + permission scoped', () => {
  assert.match(migration, /alter table public\.deal_lender_decisions enable row level security/)
  for (const p of ['dld_select', 'dld_insert', 'dld_update', 'dld_delete']) {
    assert.ok(migration.includes(p), `RLS policy ${p} must exist`)
  }
  // Finance terms are not readable by Sales — the F&I authority gates reads.
  assert.match(migration, /dld_select[\s\S]*?authz\.has_permission\(dealership_id,'deal\.approve'\)/)
})

test('funding endpoints are MFA + permission gated', () => {
  assert.match(fni, /app\.get\('\/fni\/funding', requireAuth, requireMfa, requirePermission\('accounting\.view'\)/)
  assert.match(fni, /app\.put\('\/fni\/deals\/:id\/funding', requireAuth, requireMfa, requirePermission\('accounting\.edit'\)/)
  assert.match(fni, /app\.post\('\/fni\/deals\/:id\/lender-decisions', requireAuth, requireMfa, requirePermission\('deal\.approve'\)/)
})

test('the funding queue reads real state, not an inference from delivered', () => {
  const route = fni.match(/app\.get\('\/fni\/funding'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /funding_status, funding_submitted_at, funded_at/, 'the queue must read persisted funding state')
  assert.match(route, /days_in_funding/, 'aging must come from funding_submitted_at')
  assert.match(route, /selected_decision/, 'the queue must expose the selected lender decision')
  // Legacy deals delivered before funding was tracked must not be given a fake state.
  assert.match(route, /d\.funding_status \|\| \(d\.deal_status === 'delivered' \? 'pending' : 'not_required'\)/)
})

test('no historical replay or backfill is performed', () => {
  // Going-forward correctness only — historical reconciliation is a separate decision
  // (brief §6). Nothing may mass-emit or mass-post over existing rows.
  for (const forbidden of ['backfill', 'replayAll', 'forEach(d => emitEvent']) {
    assert.ok(!fni.includes(forbidden), `must not ${forbidden}`)
  }
  assert.ok(!migration.toLowerCase().includes('insert into public.journal_entries'),
    'the migration must not create journal entries')
})
