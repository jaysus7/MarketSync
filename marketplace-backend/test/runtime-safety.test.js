import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PERMISSIONS, PERMISSION_SET } from '../permissions-catalog.js'

// Two classes of bug that pass every existing gate and then fail in production.
//
// Both were found by checking Phase 6 code against the real database rather than by any
// test — which is the point of this file. `npm test`, `check:routes` and `check:startup` all
// stayed green while a route denied everyone and another threw a TypeError.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const routeFiles = readdirSync(new URL('routes/', BE)).filter(f => f.endsWith('.js'))
const sources = routeFiles.map(f => ({ file: `routes/${f}`, src: read(`routes/${f}`) }))
  .concat([{ file: 'server.js', src: read('server.js') }])

// ── 1. Inventing a permission denies everyone, silently ─────────────────────

test('every permission named in a route exists in the vocabulary', () => {
  // requirePermission('marketing.view') when that row does not exist does not error — it
  // denies every user, forever, with no signal anywhere. It happened twice in Phase 6.
  const offenders = []
  for (const { file, src } of sources) {
    for (const m of src.matchAll(/(?:requirePermission|hasPermission)\(\s*(?:req,\s*)?'([^']+)'/g)) {
      if (!PERMISSION_SET.has(m[1])) offenders.push(`${file}: ${m[1]}`)
    }
  }
  assert.deepEqual(offenders, [],
    `these permissions are used but do not exist (add the migration AND permissions-catalog.js):\n  ${offenders.join('\n  ')}`)
})

test('the catalog is a plausible mirror of the vocabulary', () => {
  assert.ok(PERMISSIONS.length >= 55, `the catalog looks truncated (${PERMISSIONS.length})`)
  assert.equal(PERMISSIONS.length, PERMISSION_SET.size, 'the catalog has duplicates')
  const sorted = [...PERMISSIONS].sort()
  assert.deepEqual(PERMISSIONS, sorted, 'keep the catalog sorted so diffs stay readable')
  for (const p of PERMISSIONS) {
    assert.match(p, /^[a-z_]+(\.[a-z_]+)+$/, `"${p}" does not look like a permission id`)
  }
  // The two that did not exist and cost real time. Named so nobody re-invents them.
  assert.ok(!PERMISSION_SET.has('crm.view'), 'crm.* is not the vocabulary — it is customer.*')
  assert.ok(PERMISSION_SET.has('customer.view'))
})

// ── 2. A supabase builder is a thenable, not a Promise ──────────────────────

test('no query builder is treated as a full promise', () => {
  // PostgrestBuilder implements `then` but NOT `catch` or `finally`. `await q.catch(...)`
  // throws "catch is not a function" the first time that line runs — which, in the case
  // this caught, was the inbound SMS STOP handler.
  // NOTE the exclusion: `builder.then(fn).catch(fn)` is SAFE, because calling .then()
  // produces a real Promise which does have .catch. Only .catch directly ON the builder
  // is the hazard. Flagging the safe form would train people to ignore this test.
  const offenders = []
  // `[^;\n]` matters: without excluding newlines the match runs past the end of one
  // statement and pairs a builder with a `.catch` belonging to a real async call further
  // down — which is how this first reported createNotification(...).catch() as a fault.
  const BUILDER_END = /\.(maybeSingle|single|select|insert|update|upsert|delete|rpc)\([^;\n]{0,200}?\)\s*\.(catch|finally)\(/g
  for (const { file, src } of sources) {
    for (const m of src.matchAll(BUILDER_END)) {
      const line = src.slice(Math.max(0, m.index - 160), m.index + 40)
      if (!/supabaseAdmin|supabase\b/.test(line)) continue          // not a supabase chain
      if (/\.then\(/.test(m[0])) continue                           // .then() already made it a Promise
      offenders.push(`${file}: …${m[0].slice(0, 60)}`)
    }
  }
  assert.deepEqual(offenders, [],
    `a supabase query builder has no .catch/.finally — use try/catch or check the returned error:\n  ${offenders.join('\n  ')}`)
})

// ── 3. Upsert conflict targets must be real, and namable ────────────────────

test('no upsert this repo owns targets an expression index', () => {
  // PostgREST names an ON CONFLICT target by COLUMNS. A unique index built on an
  // expression — coalesce(campaign_id, …) — cannot be named, and the upsert fails at
  // runtime with "no unique or exclusion constraint matching". Phase 6 hit this and the
  // index was rebuilt with NULLS NOT DISTINCT instead.
  const migrations = readdirSync(new URL('migrations/', BE)).filter(f => f.endsWith('.sql'))
  const targeted = new Set()
  for (const { src } of sources) {
    for (const m of src.matchAll(/onConflict:\s*'([^']+)'/g)) targeted.add(m[1])
  }
  assert.ok(targeted.size >= 3, `expected upserts to be present, saw ${targeted.size}`)

  const allSql = migrations.map(f => read(`migrations/${f}`)).join('\n')

  // Only the targets whose index THIS repo creates are checkable. Most tables predate the
  // migrations folder, and asserting about an index we cannot see would fail for the wrong
  // reason. These three are Phase 6's, and are exactly where the expression-index trap was.
  const OURS = [
    'dealership_id,channel,period,kind,campaign_id',
    'dealership_id,provider,external_account_id',
    'social_account_id,user_id',
  ]
  for (const cols of OURS) {
    assert.ok(targeted.has(cols), `expected an upsert targeting '${cols}'`)
    const list = cols.split(',').map(s => s.trim())
    const pattern = new RegExp(`unique index[\\s\\S]{0,200}?\\(\\s*${list.join(',\\s*')}\\s*\\)`, 'i')
    const found = pattern.exec(allSql)
    assert.ok(found, `onConflict '${cols}' has no matching plain-column unique index in migrations/`)
    assert.doesNotMatch(found[0], /coalesce\(/i,
      `the index behind '${cols}' uses an expression, which PostgREST cannot name as a conflict target`)
  }
})
