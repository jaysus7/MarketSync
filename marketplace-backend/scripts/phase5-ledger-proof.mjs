/**
 * Phase 5 PR 5.1 — live ledger proof against STAGING.
 *
 * The CI suite (test/ledger-integrity.test.js) pins the source and the migrations. This
 * proves the behaviour against a real database: concurrency, and each department's
 * business event actually reaching the books through the real rule → posting path.
 *
 * Not part of `npm test` — CI has no Supabase credentials, and the repo's convention is
 * source-assertion tests. Run deliberately:
 *
 *   node scripts/phase5-ledger-proof.mjs
 *
 * Every journal it writes carries source 'proof' and is DELETED at the end, including
 * unposting first so the immutability trigger allows the cleanup. It never touches real
 * dealership postings, and it never runs against production.
 */
import { supabaseAdmin } from '../shared.js'
import { postJournal, PostingError } from '../routes/accounting-engine.js'

const REF = `proof-${Date.now()}`
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const url = process.env.SUPABASE_URL || ''
if (!/hpxnjbdiaaoopxeayfen/.test(url)) {
  console.error(`REFUSING TO RUN: SUPABASE_URL is not staging (${url.slice(0, 40)}…).`)
  process.exit(2)
}

const { data: dealer } = await supabaseAdmin.from('gl_accounts').select('dealership_id').limit(1).maybeSingle()
const DID = dealer?.dealership_id
if (!DID) { console.error('no dealership with a chart of accounts'); process.exit(2) }
console.log(`\nStaging ledger proof · dealership ${DID}\n`)

const balances = async () => {
  const { data: entries } = await supabaseAdmin.from('journal_entries')
    .select('id').eq('dealership_id', DID).eq('posted', true)
  const ids = (entries || []).map(e => e.id)
  if (!ids.length) return { debit: 0, credit: 0 }
  const { data: lines } = await supabaseAdmin.from('journal_lines')
    .select('debit, credit').in('journal_entry_id', ids)
  return (lines || []).reduce((a, l) => ({
    debit: a.debit + Number(l.debit), credit: a.credit + Number(l.credit),
  }), { debit: 0, credit: 0 })
}

const twoSided = (amt) => ([
  { account_key: 'cash', debit: amt, credit: 0, desc: 'proof dr' },
  { account_key: 'service_revenue', debit: 0, credit: amt, desc: 'proof cr' },
])

// ── 1. A valid journal posts, and moves posted-only balances ────────────────
const before = await balances()
const posted = await postJournal(DID, {
  source: 'proof', eventName: 'proof.valid', reference: `${REF}-valid`,
  entryDate: new Date().toISOString().slice(0, 10), lines: twoSided(250),
})
const after = await balances()
ok('a valid journal posts', posted.created === true && !!posted.id)
ok('posted-only balances moved by exactly the amount',
   Math.round((after.debit - before.debit) * 100) === 25000,
   `Δdebit ${(after.debit - before.debit).toFixed(2)}`)
ok('the posted entry balances', Math.round((after.debit - after.credit) * 100) === Math.round((before.debit - before.credit) * 100))

// ── 2. Concurrency: the database is the final guarantee ─────────────────────
// Sequential first, then genuinely parallel.
await postJournal(DID, { source: 'proof', eventName: 'proof.idem', reference: `${REF}-idem`, lines: twoSided(10) })
const second = await postJournal(DID, { source: 'proof', eventName: 'proof.idem', reference: `${REF}-idem`, lines: twoSided(10) })
ok('the same source identity twice yields one journal', second.duplicate === true && second.created === false)

const racers = await Promise.allSettled(Array.from({ length: 8 }, () =>
  postJournal(DID, { source: 'proof', eventName: 'proof.race', reference: `${REF}-race`, lines: twoSided(33) })))
const fulfilled = racers.filter(r => r.status === 'fulfilled')
const createdCount = fulfilled.filter(r => r.value.created).length
const { count: raceRows } = await supabaseAdmin.from('journal_entries')
  .select('id', { count: 'exact', head: true })
  .eq('dealership_id', DID).eq('reference', `${REF}-race`)
ok('8 concurrent identical postings create exactly one journal',
   raceRows === 1 && createdCount === 1,
   `rows=${raceRows} created=${createdCount} rejected=${racers.length - fulfilled.length}`)

// ── 3. Refusals leave nothing behind ────────────────────────────────────────
const residue = async (ref) => {
  const { count } = await supabaseAdmin.from('journal_entries')
    .select('id', { count: 'exact', head: true }).eq('dealership_id', DID).eq('reference', ref)
  return count || 0
}
for (const [label, ref, lines, wantCode] of [
  ['an unbalanced journal', `${REF}-unbal`,
   [{ account_key: 'cash', debit: 100, credit: 0 }, { account_key: 'service_revenue', debit: 0, credit: 90 }], null],
  ['a single-line journal', `${REF}-single`, [{ account_key: 'cash', debit: 50, credit: 0 }], null],
  ['an unknown account key', `${REF}-badkey`,
   [{ account_key: 'not_a_real_account', debit: 5, credit: 0 }, { account_key: 'cash', debit: 0, credit: 5 }], 'AC001'],
]) {
  let threw = null
  try {
    await postJournal(DID, { source: 'proof', eventName: 'proof.bad', reference: ref, lines })
  } catch (e) { threw = e }
  const left = await residue(ref)
  ok(`${label} is refused with no residue`,
     threw instanceof PostingError && left === 0 && (!wantCode || threw.code === wantCode),
     threw ? `${threw.code} · residue ${left}` : 'DID NOT THROW')
}

// An unknown key must also not have grown the chart.
const { count: acctCount } = await supabaseAdmin.from('gl_accounts')
  .select('id', { count: 'exact', head: true }).eq('dealership_id', DID).eq('system_key', 'not_a_real_account')
ok('a bad account key mints no account', acctCount === 0)

// ── 4. Posted lines are immutable ───────────────────────────────────────────
const { data: aLine } = await supabaseAdmin.from('journal_lines')
  .select('id, debit').eq('journal_entry_id', posted.id).limit(1).maybeSingle()
const { error: mutErr } = await supabaseAdmin.from('journal_lines')
  .update({ debit: Number(aLine.debit) + 1 }).eq('id', aLine.id)
ok('a posted journal line cannot be mutated', !!mutErr, mutErr?.message?.slice(0, 48))

// ── 5. Business events through the REAL rule path ───────────────────────────
// Each department's canonical event, posted by its seeded rule. Amounts are arbitrary;
// what is proved is that the rule resolves, the entry balances and it lands posted.
console.log('\n  Business events (rule → atomic posting → posted journal):')
const EVENTS = [
  ['funding_received',  { amount: 20000 },                                   'F&I'],
  ['vehicle_acquired',  { amount: 15000 },                                   'Inventory'],
  ['trade_received',    { amount: 8000 },                                    'Inventory'],
  ['service_closed',    { revenue: 400, tax: 52, total: 452, cost: 120 },     'Service'],
  ['parts_received',    { amount: 640 },                                     'Parts'],
  ['payment_received',  { amount: 452, applied: 452, unapplied: 0 },          'Payments'],
  ['vehicle_delivered', { ar_total: 33900, selling_price: 30000, fni_gross: 1500, tax: 2400, cost: 24000 }, 'Sales'],
]
const { postByRule } = await import('../routes/accounting-engine.js')
for (const [evt, ctx, dept] of EVENTS) {
  const ref = `${REF}-${evt}`
  let id = null, err = null
  try {
    id = await postByRule(DID, evt, { ...ctx, __source: 'proof', __reference: ref })
  } catch (e) { err = e }
  let balanced = false, lineCount = 0
  if (id) {
    const { data: ls } = await supabaseAdmin.from('journal_lines').select('debit, credit').eq('journal_entry_id', id)
    lineCount = (ls || []).length
    const dr = (ls || []).reduce((s, l) => s + Number(l.debit), 0)
    const cr = (ls || []).reduce((s, l) => s + Number(l.credit), 0)
    balanced = Math.round(dr * 100) === Math.round(cr * 100)
  }
  ok(`${dept}: ${evt}`, !!id && balanced, err ? `${err.code}: ${err.message}` : `${lineCount} lines, balanced=${balanced}`)
}

// Exactly once: replaying the same event returns the same journal.
const replay = await postByRule(DID, 'parts_received', { amount: 640, __source: 'proof', __reference: `${REF}-parts_received` })
const { count: partsRows } = await supabaseAdmin.from('journal_entries')
  .select('id', { count: 'exact', head: true }).eq('dealership_id', DID).eq('reference', `${REF}-parts_received`)
ok('replaying a business event posts exactly once', partsRows === 1 && !!replay, `rows=${partsRows}`)

// ── 6. Trial balance balances on non-empty data ─────────────────────────────
const tb = await balances()
ok('trial balance balances on real posted data',
   Math.round(tb.debit * 100) === Math.round(tb.credit * 100),
   `DR ${tb.debit.toFixed(2)} vs CR ${tb.credit.toFixed(2)}`)

// ── Cleanup ─────────────────────────────────────────────────────────────────
// Unpost first: the immutability trigger correctly refuses to drop a posted entry.
const { data: mine } = await supabaseAdmin.from('journal_entries')
  .select('id').eq('dealership_id', DID).eq('source', 'proof')
const ids = (mine || []).map(e => e.id)
if (ids.length) {
  await supabaseAdmin.from('journal_entries').update({ posted: false }).in('id', ids)
  await supabaseAdmin.from('journal_lines').delete().in('journal_entry_id', ids)
  await supabaseAdmin.from('journal_entries').delete().in('id', ids)
}
const { count: leftOver } = await supabaseAdmin.from('journal_entries')
  .select('id', { count: 'exact', head: true }).eq('dealership_id', DID).eq('source', 'proof')
console.log(`\n  cleanup: removed ${ids.length} proof journals, ${leftOver} remaining`)

const failed = results.filter(r => !r.pass)
console.log(`\n${failed.length ? `LEDGER_PROOF_FAIL (${failed.length}/${results.length})` : `LEDGER_PROOF_PASS (${results.length}/${results.length})`}\n`)
process.exit(failed.length ? 1 : 0)
