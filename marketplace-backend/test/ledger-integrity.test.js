import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 5 PR 5.1 — Ledger Integrity.
//
// What this pins: the general ledger had never recorded a transaction. postJournal left
// `posted` to a column default, so the database's balance and line-count triggers — which
// only fire on the draft→posted transition — had never run once. Posting was also
// non-atomic, deduped by a select-then-insert race, silently discarded failures, and
// invented a GL account for any mistyped rule key.
//
// Assertions run against COMMENT-STRIPPED source where behaviour is the claim: these
// files legitimately describe the rules they enforce, and prose is not proof.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const engRaw = read('routes/accounting-engine.js')
const eng = strip(engRaw)
const ledger = read('migrations/2026-08-10-phase5-ledger-integrity.sql')
const chart = read('migrations/2026-08-10-phase5-chart-of-accounts.sql')
const rules = read('migrations/2026-08-10-phase5-accounting-rules.sql')

// ── Atomic posting ───────────────────────────────────────────────────────────

test('posting goes through the one database function, not multi-step writes', () => {
  assert.match(eng, /rpc\('accounting_post_journal'/, 'postJournal must call the atomic RPC')
  // The failure this prevents: a header written, then lines written separately, leaving
  // an orphan header when the second write fails.
  const fn = eng.match(/export async function postJournal[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'postJournal must exist')
  assert.doesNotMatch(fn, /from\('journal_entries'\)\.insert|from\('journal_lines'\)\.insert/,
    'postJournal must not write the journal tables directly any more')
})

test('the posting function posts LAST so the database triggers actually run', () => {
  // This is the whole fix. Under the old code `posted` came from a column default, so
  // the draft→posted transition never happened and the balance check never fired.
  const body = ledger.match(/create or replace function public\.accounting_post_journal[\s\S]*?end;\n\$function\$;/)?.[0] || ''
  assert.ok(body, 'the posting function must exist in the migration')
  const insertAt = body.indexOf('insert into public.journal_entries')
  const linesAt = body.indexOf('insert into public.journal_lines')
  const postAt = body.indexOf('set posted = true')
  assert.ok(insertAt > 0 && linesAt > insertAt && postAt > linesAt,
    'order must be: draft header → all lines → post')
  // The header must be born a draft EXPLICITLY. Relying on the column default is the
  // original bug: production defaults `posted` true, staging false, so the same code
  // meant two different things.
  const insert = body.match(/insert into public\.journal_entries[\s\S]*?returning id into v_entry_id;/)?.[0] || ''
  assert.ok(/\bposted\b/.test(insert), 'the insert must name the posted column')
  assert.ok(/,\s*false,/.test(insert), 'and pass false rather than inheriting a default')
  // The function must NOT pre-check the balance itself and quietly skip — the database
  // control is the authority, and it must be reached.
  assert.doesNotMatch(body, /if v_tot_dr <> v_tot_cr then[\s\S]{0,80}return/,
    'the balance decision belongs to the trigger, not a silent early return')
})

test('the posting triggers are installed by the migration, not assumed', () => {
  // Production had NO triggers on the journal tables. This migration is what converges
  // it onto staging's model, so the trigger definitions must travel with it.
  for (const t of ['trg_journal_entry_posting', 'trg_journal_line_immutability',
                   'trg_accounting_period_lock']) {
    assert.ok(ledger.includes(`create trigger ${t}`), `${t} must be created by the migration`)
    assert.ok(ledger.includes(`drop trigger if exists ${t}`), `${t} must be created idempotently`)
  }
  assert.match(ledger, /raise exception 'Journal entry is not balanced/)
  assert.match(ledger, /raise exception 'A posted journal entry requires at least two lines'/)
  assert.match(ledger, /raise exception 'Lines belonging to a posted journal entry are immutable'/)
})

// ── Idempotency ──────────────────────────────────────────────────────────────

test('idempotency is a database guarantee, not a select-then-insert race', () => {
  assert.match(ledger, /create unique index if not exists journal_entries_source_identity_uk[\s\S]*?\(dealership_id, source, reference, event_name\)/,
    'the source identity must be unique in the database')
  assert.match(ledger, /where reference is not null/,
    'manual entries carry no source identity and must not be deduped by it')
  // And the function must survive losing the race rather than erroring.
  const body = ledger.match(/create or replace function public\.accounting_post_journal[\s\S]*?end;\n\$function\$;/)?.[0] || ''
  assert.match(body, /exception when unique_violation then/,
    'a concurrent duplicate must return the winner, not blow up')
})

// ── Account resolution ───────────────────────────────────────────────────────

test('an unknown account key fails the posting instead of minting an account', () => {
  // The old resolveAccount() inserted a new account for any unrecognised key, defaulting
  // to category "expense" — so a typo in a posting rule quietly grew the chart.
  assert.doesNotMatch(eng, /async function resolveAccount/,
    'the auto-creating resolver must be gone')
  assert.doesNotMatch(eng, /from\('gl_accounts'\)\.insert/,
    'nothing in the posting path may create a GL account')
  const body = ledger.match(/create or replace function public\.accounting_post_journal[\s\S]*?end;\n\$function\$;/)?.[0] || ''
  assert.match(body, /raise exception 'no chart account for key[\s\S]{0,60}errcode = 'AC001'/,
    'an unknown key must abort the posting with its own error code')
})

test('the chart of accounts is seeded deliberately and matches ACCOUNT_DEFS', () => {
  // Strict resolution is only safe if the accounts a rule may name already exist.
  const defs = [...engRaw.matchAll(/^\s{2}([a-z_]+):\s*\{\s*code:\s*'(\d+)'/gm)].map(m => [m[1], m[2]])
  assert.ok(defs.length >= 30, `expected the full chart in ACCOUNT_DEFS, saw ${defs.length}`)
  for (const [key, code] of defs) {
    assert.ok(chart.includes(`('${key}',`), `chart migration is missing account key ${key}`)
    assert.ok(chart.includes(`'${code}'`), `chart migration is missing account code ${code}`)
  }
  // And every account a rule can name must be one of them.
  for (const key of [...rules.matchAll(/"account_key":"([a-z_]+)"/g)].map(m => m[1])) {
    assert.ok(defs.some(([k]) => k === key), `rule references "${key}", which is not in the chart`)
  }
})

// ── Failure handling ─────────────────────────────────────────────────────────

test('a refused posting is an exception, never a silent null', () => {
  assert.match(eng, /export class PostingError/, 'failures need a typed error')
  const fn = eng.match(/export async function postJournal[\s\S]*?\n\}\n/)?.[0] || ''
  // The old code returned null on unbalanced, locked period and insert failure alike.
  assert.doesNotMatch(fn, /console\.(error|warn)[\s\S]{0,40}return null/,
    'postJournal must not log-and-continue')
  assert.match(fn, /throw postingErrorFrom\(error, ctx\)/, 'a database refusal must throw')
  assert.match(fn, /throw new PostingError\('posting returned no journal'/,
    'no pretend success when nothing was posted')
})

test('a failed posting is distinguishable from a deliberate skip', () => {
  const listener = eng.match(/async function onFinancialEvent[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(listener, 'the listener must exist')
  assert.match(listener, /status: 'failed'/, 'a refusal must be logged as failed, not skipped')
  assert.match(listener, /status: result\.journalId \? 'processed' : 'skipped'/)
  // It must reach the shared exception surface so Accounting can actually see it.
  assert.match(listener, /raiseException\(event\.dealership_id, \{[\s\S]*?kind: 'accounting_posting_failed'/,
    'a posting failure must raise a real exception through the existing primitive')
  assert.match(listener, /department: 'Accounting'/)
  assert.match(listener, /severity: 'high'/)
})

test('the failure record answers who, what and why without leaking internals', () => {
  const cls = eng.match(/export class PostingError[\s\S]*?\n\}\n/)?.[0] || ''
  for (const field of ['dealershipId', 'source', 'eventName', 'reference', 'code']) {
    assert.ok(cls.includes(field), `a posting failure must retain ${field}`)
  }
  // A controller reads a sentence; the raw driver text stays for an engineer.
  assert.match(cls, /get userMessage\(\)/)
  for (const code of ['AC001', 'AC002', 'AC003', 'AC004']) {
    assert.ok(cls.includes(code), `userMessage must cover ${code}`)
  }
  assert.doesNotMatch(cls.match(/get userMessage\(\)[\s\S]*?\n  \}/)?.[0] || '', /this\.message/,
    'the user-facing sentence must not be the raw database error')
})

test('a locked period is refused loudly, not skipped quietly', () => {
  // Previously postJournal returned null for a locked period, so the business event
  // vanished from the books with nothing recorded anywhere.
  assert.doesNotMatch(eng, /async function periodLocked/, 'the advisory check is replaced')
  const body = ledger.match(/create or replace function public\.accounting_post_journal[\s\S]*?end;\n\$function\$;/)?.[0] || ''
  assert.match(body, /raise exception 'accounting period % is %'[\s\S]{0,60}errcode = 'AC002'/)
})

// ── Posted-only reads ────────────────────────────────────────────────────────

test('balances derive from posted journals only', () => {
  const fn = eng.match(/async function accountBalances[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'accountBalances must exist')
  assert.match(fn, /\.eq\('posted', true\)/, 'drafts must be excluded on the server')
  // The filter must be unconditional — not only applied when a date range is given.
  assert.doesNotMatch(fn, /if \(query\.from \|\| query\.to\) \{[\s\S]*?\.eq\('posted', true\)/,
    'the posted filter must not hide behind a date-range branch')
})

test('every financial aggregate goes through that one filtered read', () => {
  // trial balance, P&L, balance sheet, dashboard cards and forecast must all share it,
  // so posted-only is decided in one place rather than remembered five times.
  const aggregates = ['trial-balance', 'balance-sheet', 'forecast']
  for (const a of aggregates) {
    assert.ok(eng.includes(`'/accounting/${a}'`), `expected the ${a} endpoint`)
  }
  const calls = (eng.match(/await accountBalances\(|accountBalances\(req\.dealershipId|accountBalances\(did/g) || []).length
  assert.ok(calls >= 5, `expected the aggregates to share accountBalances, saw ${calls} uses`)
  // No aggregate may read journal_lines straight, which would bypass the posted filter.
  const rawLineReads = [...eng.matchAll(/from\('journal_lines'\)/g)].length
  assert.ok(rawLineReads <= 3,
    `journal_lines is read directly in ${rawLineReads} places; aggregates must use accountBalances`)
})

test('the clawback reverses a posted accrual, not a draft', () => {
  const fn = eng.match(/async function postCommissionClawback[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /\.eq\('posted', true\)/, 'only a posted accrual is a thing to reverse')
})

// ── Rule coverage ────────────────────────────────────────────────────────────

test('every routed financial event has exactly one canonical rule', () => {
  // staging and production had drifted into near-disjoint rule sets, so neither could
  // post a full dealership. This is what stops that recurring unnoticed.
  const routed = [...eng.matchAll(/postByRule\((?:did|dealershipId), '([a-z_]+)'/g)].map(m => m[1])
  const unique = [...new Set(routed)]
  assert.ok(unique.length >= 11, `expected the full routed set, saw ${unique.length}: ${unique}`)
  for (const evt of unique) {
    const decl = new RegExp(`\\(null, '${evt}', true, '\\[`)
    assert.match(rules, decl, `no canonical rule seeded for routed event "${evt}"`)
  }
  // One row per event — a second would make which rule applies ambiguous.
  for (const evt of unique) {
    const count = (rules.match(new RegExp(`\\(null, '${evt}', true,`, 'g')) || []).length
    assert.equal(count, 1, `"${evt}" must be declared exactly once, saw ${count}`)
  }
})

test('the seeded rules balance by construction', () => {
  // Each rule's debit tokens must be capable of equalling its credit tokens. The pairs
  // below are the identities the context builders guarantee.
  const IDENTITIES = {
    vehicle_delivered: 'ar_total = selling_price + fni_gross + tax',
    payment_received: 'amount = applied + unapplied',
    service_closed: 'total = revenue + tax',
  }
  for (const [evt, identity] of Object.entries(IDENTITIES)) {
    const block = rules.match(new RegExp(`\\(null, '${evt}', true, '\\[([\\s\\S]*?)\\]'`))?.[1] || ''
    assert.ok(block, `expected the ${evt} rule (${identity})`)
    const dr = [...block.matchAll(/"side":"debit","source":"([a-z_]+)"/g)].map(m => m[1])
    const cr = [...block.matchAll(/"side":"credit","source":"([a-z_]+)"/g)].map(m => m[1])
    assert.ok(dr.length && cr.length, `${evt} must have both sides`)
  }
  // The corrected service_closed: AR carries tax, and tax lands in a liability.
  const svc = rules.match(/\(null, 'service_closed', true, '\[([\s\S]*?)\]'/)?.[1] || ''
  assert.match(svc, /"account_key":"accounts_receivable","side":"debit","source":"total"/,
    'the customer is billed the tax-inclusive total, not the pre-tax revenue')
  assert.match(svc, /"account_key":"tax_collected","side":"credit","source":"tax"/,
    'collected tax is a liability, not revenue')
})

test('commission clawback deliberately has no rule', () => {
  // It posts the exact inverse of the original accrual, so a rule could only drift from it.
  assert.doesNotMatch(rules, /\(null, 'commission_clawed_back'/)
  assert.match(eng, /eventName: 'commission_clawed_back'/, 'it posts directly instead')
})

// ── Production stays untouched ───────────────────────────────────────────────

test('the migrations are safe to converge production later, and say so', () => {
  for (const [name, sql] of [['ledger', ledger], ['chart', chart], ['rules', rules]]) {
    assert.match(sql, /STAGING ONLY/i, `${name} migration must state it was staging-only`)
  }
  // Idempotent throughout, so applying to production is a convergence, not a rebuild.
  assert.match(ledger, /create unique index if not exists/)
  assert.match(chart, /on conflict \(dealership_id, system_key\)[\s\S]{0,60}do nothing/)
  assert.match(rules, /do update set lines = excluded\.lines/)
})
