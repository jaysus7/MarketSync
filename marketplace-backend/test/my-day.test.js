import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6.10 — My Day, composed across departments.
//
// buildMyDay takes its sources as an argument, so these run the REAL composition against fake
// departments rather than asserting that some source text exists. Per AGENTS.md A19, that is
// the difference between proving a capability works and proving code was written.

import { buildMyDay, normalizeItem, MY_DAY_SOURCES, MY_DAY_GAPS } from '../routes/my-day.js'

const BE = new URL('../', import.meta.url)
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const myDay = strip(readFileSync(new URL('routes/my-day.js', BE), 'utf8'))

// The real permission lookup reads the database, so buildMyDay takes the checker as an
// argument. That seam is why these tests can exercise the actual composition — and why the
// permission behaviour itself can be tested in BOTH directions rather than only failing closed.
const allowing = () => async () => true
const only = (...perms) => async (_req, p) => perms.includes(p)

const src = (key, items, opts = {}) => ({
  key, label: key, department: opts.department || 'Marketing',
  permission: opts.permission || 'always',
  load: opts.throws
    ? async () => { throw new Error(opts.throws) }
    : async () => items,
})

const REQ = { dealershipId: 'd1' }

// ── Composition ─────────────────────────────────────────────────────────────

test('My Day merges every department it is allowed to see', async () => {
  const day = await buildMyDay(REQ, { can: allowing(),
    sources: [
      src('a', [{ kind: 'a1', severity: 3, subject: 'A problem', reason: 'because', owner: 'Marketing', action: 'Fix', ref: '1' }]),
      src('b', [{ kind: 'b1', severity: 2, subject: 'B problem', reason: 'because', owner: 'Sales', action: 'Call', ref: '2' }]),
    ],
  })
  assert.equal(day.total, 2)
  assert.equal(day.needs_attention.length, 2)
  assert.deepEqual(day.sources, ['a', 'b'])
  assert.equal(day.complete, true)
})

test('opportunities are separated from problems, not ranked against them', async () => {
  const day = await buildMyDay(REQ, { can: allowing(),
    sources: [src('a', [
      { kind: 'good', severity: 1, subject: 'Working well', reason: 'do more', action: 'Expand' },
      { kind: 'bad', severity: 3, subject: 'Broken', reason: 'fix it', action: 'Fix' },
    ])],
  })
  assert.equal(day.needs_attention.length, 1)
  assert.equal(day.opportunities.length, 1)
  assert.equal(day.needs_attention[0].kind, 'bad')
  assert.equal(day.opportunities[0].kind, 'good')
})

test('the worst thing is first, and ties break to the oldest', async () => {
  const day = await buildMyDay(REQ, { can: allowing(),
    sources: [src('a', [
      { kind: 'mid', severity: 2, subject: 'Mid', reason: 'r', age_days: 1 },
      { kind: 'worst', severity: 3, subject: 'Worst', reason: 'r', age_days: 0 },
      { kind: 'old-mid', severity: 2, subject: 'Older mid', reason: 'r', age_days: 40 },
    ])],
  })
  assert.deepEqual(day.needs_attention.map(i => i.kind), ['worst', 'old-mid', 'mid'])
})

// ── A failing department must not make the day look calm ────────────────────

test('a source that fails is reported, never silently dropped', async () => {
  const day = await buildMyDay(REQ, { can: allowing(),
    sources: [
      src('accounting', [], { throws: 'connection reset' }),
      src('ok', [{ kind: 'x', severity: 3, subject: 'Real problem', reason: 'r' }]),
    ],
  })
  assert.equal(day.needs_attention.length, 1, 'the healthy department still reports')
  assert.equal(day.failed.length, 1)
  assert.equal(day.failed[0].source, 'accounting')
  assert.match(day.failed[0].reason, /connection reset/)
  assert.equal(day.complete, false, 'a day missing a department is not a complete day')
})

test('an all-quiet day is distinguishable from a broken one', async () => {
  const quiet = await buildMyDay(REQ, { can: allowing(), sources: [src('a', [])] })
  assert.equal(quiet.total, 0)
  assert.equal(quiet.complete, true, 'genuinely nothing to do')

  const broken = await buildMyDay(REQ, { can: allowing(), sources: [src('a', [], { throws: 'boom' })] })
  assert.equal(broken.total, 0)
  assert.equal(broken.complete, false, 'same empty list, completely different meaning')
})

test('the departments with no builder are named, not implied', async () => {
  const day = await buildMyDay(REQ, { can: allowing(), sources: [src('a', [])] })
  // Somebody whose whole job is Service must not be told their day is clear by a queue that
  // was never able to see Service.
  assert.deepEqual(day.not_covered, MY_DAY_GAPS)
  assert.ok(MY_DAY_GAPS.includes('Service'))
  assert.ok(MY_DAY_GAPS.includes('Parts'))
  assert.ok(!MY_DAY_GAPS.includes('People'), 'People emits attention as of 7.1')
})

// ── Normalization ───────────────────────────────────────────────────────────

test('an item with no subject still renders as something a person can read', () => {
  // accountingExceptions predates the attention contract and emits no `subject`.
  const item = normalizeItem(
    { kind: 'posting_failed', severity: 3, source: 'service', reason: 'AC001: no chart account', owner: 'Accounting', action: 'Resolve', ref: 'x' },
    { key: 'accounting', label: 'Accounting', department: 'Accounting' },
  )
  assert.ok(item.subject && item.subject.trim(), 'never a blank row')
  assert.match(item.subject, /service/)
  assert.match(item.subject, /posting failed/)
})

test('an item too empty to mean anything is dropped rather than padded', () => {
  assert.equal(normalizeItem({ kind: '', severity: 3 }, { key: 'a', department: 'D' }), null)
  assert.equal(normalizeItem(null, { key: 'a', department: 'D' }), null)
  assert.equal(normalizeItem('nonsense', { key: 'a', department: 'D' }), null)
})

test('severity is clamped rather than trusted', () => {
  const s = (v) => normalizeItem({ kind: 'k', severity: v, subject: 'S', reason: 'r' }, { key: 'a', department: 'D' }).severity
  assert.equal(s(99), 3)
  assert.equal(s(-5), 1)
  assert.equal(s(undefined), 2, 'an unstated severity is a middling problem, not the worst')
  assert.equal(s('3'), 3)
})

test('the owning department survives composition', () => {
  // A gross gap noticed by Marketing is owned by Accounting, and My Day must not relabel it.
  const item = normalizeItem(
    { kind: 'campaign_gross_incomplete', severity: 2, subject: 'Labour Day', reason: 'r', owner: 'Accounting', action: 'Post' },
    { key: 'campaigns', label: 'Campaigns', department: 'Marketing' },
  )
  assert.equal(item.owner, 'Accounting', 'the department that can fix it owns it')
  assert.equal(item.source, 'campaigns', 'and we still know who noticed')
})

test('an item with no owner falls back to the department that produced it', () => {
  const item = normalizeItem({ kind: 'k', severity: 2, subject: 'S', reason: 'r' }, { key: 'a', label: 'A', department: 'Parts' })
  assert.equal(item.owner, 'Parts')
})

// ── Permission is per source, not per endpoint ──────────────────────────────

test('a source the caller may not see is never loaded', async () => {
  let accountingLoaded = false
  const day = await buildMyDay({ dealershipId: 'd1' }, {
    sources: [{
      key: 'accounting', label: 'Accounting', department: 'Accounting',
      permission: 'accounting.view',
      load: async () => { accountingLoaded = true; return [{ kind: 'x', severity: 3, subject: 'S', reason: 'r' }] },
    }],
  })
  // A bare request resolves no permissions, so the source must be excluded — and crucially
  // its loader must never have run, not merely had its output filtered.
  assert.equal(accountingLoaded, false, 'permission is checked BEFORE the department is queried')
  assert.equal(day.total, 0)
  assert.ok(!day.sources.includes('accounting'))
})

test('a permission lookup that throws is not treated as permission', async () => {
  let loaded = false
  const day = await buildMyDay(REQ, {
    can: async () => { throw new Error('permission service down') },
    sources: [src('accounting', [{ kind: 'x', severity: 3, subject: 'Secret', reason: 'r' }], { permission: 'accounting.view' })],
  })
  assert.equal(day.total, 0, 'failing open on a permission check is how data leaks across departments')
  assert.ok(!day.sources.includes('accounting'))
})

test('each source is gated on its OWN permission', async () => {
  const sources = [
    src('campaigns', [{ kind: 'c', severity: 3, subject: 'Campaign problem', reason: 'r' }], { permission: 'marketing.view' }),
    src('accounting', [{ kind: 'a', severity: 3, subject: 'Accounting problem', reason: 'r' }], { permission: 'accounting.view' }),
  ]
  // A salesperson with marketing.view sees the campaign problem and NOT the accounting one.
  const marketer = await buildMyDay(REQ, { can: only('marketing.view'), sources })
  assert.deepEqual(marketer.needs_attention.map(i => i.subject), ['Campaign problem'])

  // A controller with accounting.view sees the reverse — from the same endpoint.
  const controller = await buildMyDay(REQ, { can: only('accounting.view'), sources })
  assert.deepEqual(controller.needs_attention.map(i => i.subject), ['Accounting problem'])

  // And someone with both sees both.
  const manager = await buildMyDay(REQ, { can: only('marketing.view', 'accounting.view'), sources })
  assert.equal(manager.needs_attention.length, 2)
})

test('the endpoint itself is not gated on one department permission', () => {
  const route = myDay.match(/app\.get\('\/my-day'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the endpoint must exist')
  assert.match(route, /requireAuth, requireMfa/)
  assert.doesNotMatch(route, /requirePermission\(/,
    'a single gate would either leak accounting to a salesperson or hide it from a controller')
})

// ── The registry ────────────────────────────────────────────────────────────

test('every registered source names a real permission and a loader', () => {
  const known = new Set(['marketing.view', 'customer.view', 'accounting.view', 'staff.view'])
  for (const s of MY_DAY_SOURCES) {
    assert.ok(known.has(s.permission), `${s.key} names an unknown permission: ${s.permission}`)
    assert.equal(typeof s.load, 'function', `${s.key} has no loader`)
    assert.ok(s.department && s.label, `${s.key} must carry a department and a label`)
  }
  assert.equal(MY_DAY_SOURCES.length, 7)
})

test('My Day composes the departments rather than deriving anything itself', () => {
  for (const builder of ['campaignAttention', 'socialAttention', 'conversationAttention',
                         'reputationAttention', 'salesVideoAttention', 'accountingExceptions',
                         'peopleAttention']) {
    assert.ok(myDay.includes(builder), `must compose ${builder}`)
  }
  // No local severity, no invented kinds.
  assert.doesNotMatch(myDay, /kind: '(campaign|social|conversation|review|sales_video)_/,
    'My Day must not invent attention kinds')
})

// ── The workspace renders the honesty signals ───────────────────────────────

test('the workspace shows when the day is incomplete rather than looking calm', () => {
  const ws = strip(readFileSync(new URL('../marketplace-frontend/js/modules/marketing-workspace.js', BE), 'utf8'))
  assert.match(ws, /apiGetJson\('\/my-day'\)/, 'the cross-department day is what it reads')
  assert.match(ws, /d\.dayFailed/)
  assert.match(ws, /This day is incomplete/)
  assert.match(ws, /Not covered here yet/, 'departments with no builder are named, not implied')
  // Even the fetch failing must not render a calm morning.
  assert.match(ws, /failed: \[\{ source: 'my-day'/)
})
