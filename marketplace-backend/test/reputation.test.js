import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.8 — Reputation.
//
// These tests exist mostly to keep ONE thing from ever being added: review gating. The
// standard dealer feature asks the customer how they feel, then sends happy ones to Google
// and routes unhappy ones to a private form. It manufactures a rating that is not true.
// Most of what follows asserts the ABSENCE of that path, deliberately, because a future
// change that adds it back would look like a helpful feature request.

import { ratingSummary } from '../routes/reputation.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// SQL comments are stripped for the same reason JS ones are: this file's header explains the
// no-gating decision in prose, and a test must assert on the structure, not the explanation.
const migration = read('migrations/2026-08-10-phase6-reputation.sql')
const migrationSql = migration.replace(/^\s*--.*$/gm, '')
const route = strip(read('routes/reputation.js'))

// ── No review gating, structurally ──────────────────────────────────────────

test('nothing in the ask path consults how the customer feels', () => {
  for (const forbidden of [/sentiment/i, /expected_rating/i, /how_was_your/i, /\bhappy\b/i, /satisfaction_score/i]) {
    assert.doesNotMatch(route, forbidden,
      'a sentiment check before asking is review gating, whatever it is named')
  }
  // And the schema gives it nowhere to live.
  assert.doesNotMatch(migrationSql, /sentiment|expected_rating|satisfaction/i)
})

test('the public link and the private route always go out together', () => {
  const post = route.match(/app\.post\('\/reputation\/requests'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(post, 'the ask route must exist')
  assert.match(post, /public_url: publicUrl/)
  assert.match(post, /private_feedback_token: newPrivateToken\(\)/)
  // Neither is conditional on anything about the customer.
  assert.doesNotMatch(post, /private_feedback_token:[^,\n]*\?/, 'the private route is never conditional')
  assert.doesNotMatch(post, /public_url:[^,\n]*rating/, 'the public link is never withheld')
})

test('an ask must follow an actual visit', () => {
  const post = route.match(/app\.post\('\/reputation\/requests'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(post, /\['vehicle_delivered', 'service_closed', 'manual'\]\.includes/)
  assert.match(post, /must name the visit it follows/)
  assert.match(migration, /check \(source in \('vehicle_delivered', 'service_closed', 'manual'\)\)/)
})

test('a suppression without a written reason is refused by the database', () => {
  assert.match(migration, /review_requests_suppression_needs_reason[\s\S]*?status <> 'suppressed' or \(suppressed_reason is not null and length\(btrim\(suppressed_reason\)\) > 0\)/,
    'an exclusion nobody has to justify is a gate wearing a different hat')
  const sup = route.match(/app\.post\('\/reputation\/requests\/:id\/suppress'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(sup, /Say why this customer should not be asked/)
  // And it cannot be used to retroactively hide an ask that already went out.
  assert.match(sup, /\.eq\('status', 'pending'\)/)
})

test('eligibility is about consent and timing, never the expected rating', () => {
  const fn = route.match(/export async function askEligibility[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the eligibility function must exist')
  assert.match(fn, /await mayContact\(dealershipId, contactId, channel\)/)
  assert.match(fn, /ASK_COOLDOWN_DAYS/)
  assert.doesNotMatch(fn, /rating|sentiment|score/i,
    'this is where a gate would live, so it is checked for the absence of one')
})

// ── Not nagging is part of being honest ─────────────────────────────────────

test('the same customer cannot be asked twice about one visit', () => {
  assert.match(migration, /create unique index if not exists review_requests_once_per_event[\s\S]*?\(dealership_id, contact_id, source, source_id\)/)
  const post = route.match(/app\.post\('\/reputation\/requests'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(post, /already been asked about this visit/)
})

test('asking with no review link to send is refused rather than sent broken', () => {
  const post = route.match(/app\.post\('\/reputation\/requests'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(post, /if \(!publicUrl\)/)
  assert.match(post, /Set your public review link/)
})

// ── A review is somebody else's statement ───────────────────────────────────

test('the dealership can reply to a review but never edit one', () => {
  const respond = route.match(/app\.post\('\/reputation\/reviews\/:id\/respond'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(respond, 'the reply route must exist')
  for (const owned of ['response_body', 'responded_at', 'responded_by']) {
    assert.ok(respond.includes(owned), `a reply writes ${owned}`)
  }
  // `response_body:` legitimately contains "body:", so match the column name on its own.
  for (const theirs of [/(?<![_\w])rating:/, /(?<![_\w])body:/, /(?<![_\w])author_name:/]) {
    assert.doesNotMatch(respond, theirs, `a reply must not write ${theirs}`)
  }
})

test('the same external review cannot be imported twice', () => {
  assert.match(migration, /create unique index if not exists reviews_external_uk[\s\S]*?\(dealership_id, source, external_id\)/)
})

// ── The number, said plainly ────────────────────────────────────────────────

test('the average never hides the low reviews behind it', () => {
  const s = ratingSummary([
    ...Array(50).fill({ rating: 5, responded_at: 'x' }),
    ...Array(12).fill({ rating: 1, responded_at: null }),
  ])
  assert.equal(s.count, 62)
  assert.equal(s.detractors, 12)
  assert.match(s.note, /12 of 62 rated 3 or below/)
  assert.equal(s.unanswered, 12)
})

test('a clean record says so rather than inventing a worry', () => {
  const s = ratingSummary([{ rating: 5, responded_at: 'x' }, { rating: 4, responded_at: 'x' }])
  assert.equal(s.detractors, 0)
  assert.equal(s.average, 4.5)
  assert.match(s.note, /No reviews at 3 or below/)
})

test('no reviews is not a zero rating', () => {
  const s = ratingSummary([])
  assert.equal(s.average, null, 'an average of nothing is not 0 stars')
  assert.equal(s.count, 0)
})

test('an unrated review still counts as needing a reply', () => {
  const s = ratingSummary([{ rating: null, responded_at: null }, { rating: 5, responded_at: 'x' }])
  assert.equal(s.count, 1, 'only rated reviews form the average')
  assert.equal(s.unanswered, 1)
})

// ── What to do today ────────────────────────────────────────────────────────

test('an unanswered low review outranks an unanswered good one', () => {
  const fn = route.match(/export async function reputationAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the attention builder must exist')
  assert.match(fn, /kind: low \? 'review_negative_unanswered' : 'review_unanswered'/)
  assert.match(fn, /severity: low \? 3 : 1/)
  assert.match(fn, /\.is\('responded_at', null\)/)
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(fn.includes(`${field}:`), `attention items must carry ${field}`)
  }
})

test('reputation data is tenant-scoped', () => {
  assert.match(route, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(migration, /alter table public\.reviews enable row level security/)
  assert.match(migration, /alter table public\.review_requests enable row level security/)
})
