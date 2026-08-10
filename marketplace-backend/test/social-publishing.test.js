import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.6 — Studio and social publishing.
//
// The decisions in this slice are pure functions on purpose, so these tests run the real
// logic rather than assert that some source text exists. What is being defended is one
// claim: MarketSync never tells a dealership a post is live unless a provider gave us an id
// for something it created.

import {
  applyTargetOutcome, rollUpPostStatus, nextBackoffSeconds, MAX_PUBLISH_ATTEMPTS,
} from '../routes/social-publish.js'
import {
  publishToProvider, registerSocialProvider, __resetSocialProviders,
  socialProviderConfigured, configuredSocialProviders,
  PROVIDER_NOT_CONFIGURED, PROVIDER_NO_CREDENTIALS, PROVIDER_NO_EVIDENCE, PROVIDER_THREW,
} from '../providers/social-providers.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const migration = read('migrations/2026-08-10-phase6-social-publishing.sql')
const dispatcher = strip(read('routes/social-publish.js'))
const studio = strip(read('routes/marketing-studio.js'))
const social = strip(read('routes/social.js'))

const CONNECTED = { id: 'a1', provider: 'facebook', display_name: 'Main Page', status: 'connected' }

test.afterEach(() => __resetSocialProviders())

// ── Nothing is ever called published without evidence ───────────────────────

test('with no integration connected, publishing fails and says nothing was sent', async () => {
  const r = await publishToProvider({ account: CONNECTED, body: 'hi' })
  assert.equal(r.ok, false)
  assert.equal(r.code, PROVIDER_NOT_CONFIGURED)
  assert.equal(r.retryable, false, 'a missing integration will not fix itself on a retry')
  assert.match(r.error, /Nothing was sent/)
})

test('a provider that reports success but returns no id is NOT published', async () => {
  registerSocialProvider('facebook', { publish: async () => ({}) })
  const r = await publishToProvider({ account: CONNECTED, body: 'hi' })
  assert.equal(r.ok, false)
  assert.equal(r.code, PROVIDER_NO_EVIDENCE)

  // And the target write agrees — this is the exact path that would otherwise let a post be
  // marked live on our own authority.
  const patch = applyTargetOutcome({ attempts: 1 }, r)
  assert.notEqual(patch.status, 'published')
  assert.equal(patch.external_post_id, undefined)
})

test('a success claimed with no id is still refused at the write', () => {
  // Belt and braces: even if some future adapter path returned ok:true without an id,
  // applyTargetOutcome must not write "published".
  const patch = applyTargetOutcome({ attempts: 1 }, { ok: true })
  assert.notEqual(patch.status, 'published')
  assert.match(patch.error, /cannot confirm it went live/)
})

test('a real id is what makes a post published', async () => {
  registerSocialProvider('facebook', { publish: async () => ({ external_post_id: '17841_999' }) })
  const r = await publishToProvider({ account: CONNECTED, body: 'hi' })
  assert.equal(r.ok, true)
  assert.equal(r.external_post_id, '17841_999')

  const patch = applyTargetOutcome({ attempts: 1 }, r)
  assert.equal(patch.status, 'published')
  assert.equal(patch.external_post_id, '17841_999')
  assert.ok(patch.published_at, 'a publication has a time it happened')
  assert.equal(patch.error, null)
  assert.equal(patch.claimed_at, null, 'the claim is released')
})

test('a disconnected account is refused before any call is attempted', async () => {
  let called = false
  registerSocialProvider('facebook', { publish: async () => { called = true; return { external_post_id: 'x' } } })
  const r = await publishToProvider({ account: { ...CONNECTED, status: 'expired' }, body: 'hi' })
  assert.equal(r.ok, false)
  assert.equal(r.code, PROVIDER_NO_CREDENTIALS)
  assert.equal(called, false, 'we do not call a provider with credentials we know are dead')
  assert.match(r.error, /Reconnect/)
})

test('an adapter that throws becomes an outcome, never an exception', async () => {
  registerSocialProvider('facebook', { publish: async () => { throw new Error('rate limited') } })
  const r = await publishToProvider({ account: CONNECTED, body: 'hi' })
  assert.equal(r.ok, false)
  assert.equal(r.code, PROVIDER_THREW)
  assert.match(r.error, /rate limited/)
  // A target with no outcome is a post whose fate nobody records.
  assert.ok(applyTargetOutcome({ attempts: 1 }, r).status)
})

// ── Retry means retry, and then it means tell someone ───────────────────────

test('a retryable failure goes back to pending with a later retry time', () => {
  const now = new Date('2026-08-10T12:00:00Z')
  const patch = applyTargetOutcome({ attempts: 1 }, { ok: false, retryable: true, error: 'timeout' }, now)
  assert.equal(patch.status, 'pending')
  assert.ok(new Date(patch.next_attempt_at) > now, 'it waits before trying again')
  assert.equal(patch.claimed_at, null, 'the lease is released so another run can take it')
})

test('a permanent failure is failed immediately, not retried forever', () => {
  const patch = applyTargetOutcome({ attempts: 1 }, { ok: false, retryable: false, error: 'no integration' })
  assert.equal(patch.status, 'failed')
  assert.equal(patch.next_attempt_at, null)
})

test('retries stop after the cap so the queue stays readable', () => {
  const patch = applyTargetOutcome({ attempts: MAX_PUBLISH_ATTEMPTS }, { ok: false, retryable: true, error: 'timeout' })
  assert.equal(patch.status, 'failed', 'a queue that retries forever is a queue nobody reads')
})

test('backoff escalates and is capped', () => {
  const seq = [1, 2, 3, 4, 5, 9].map(nextBackoffSeconds)
  for (let i = 1; i < 5; i++) assert.ok(seq[i] > seq[i - 1], 'each wait is longer than the last')
  assert.equal(seq[5], seq[4], 'and it stops growing rather than reaching days')
})

// ── A post's status is derived from its targets, in one place ───────────────

test('a post that reached some accounts and not others is partially published', () => {
  assert.equal(rollUpPostStatus([{ status: 'published' }, { status: 'failed' }]), 'partially_published')
})

test('all published is published; all failed is failed', () => {
  assert.equal(rollUpPostStatus([{ status: 'published' }, { status: 'published' }]), 'published')
  assert.equal(rollUpPostStatus([{ status: 'failed' }, { status: 'failed' }]), 'failed')
})

test('a post is publishing while any target is still in flight', () => {
  assert.equal(rollUpPostStatus([{ status: 'published' }, { status: 'pending' }]), 'publishing')
  assert.equal(rollUpPostStatus([{ status: 'publishing' }]), 'publishing')
})

test('a skipped target does not make a post partial, and cannot make one published alone', () => {
  // Skipped is a deliberate non-send — a grant withdrawn between scheduling and publishing.
  assert.equal(rollUpPostStatus([{ status: 'published' }, { status: 'skipped' }]), 'published')
  assert.equal(rollUpPostStatus([{ status: 'skipped' }, { status: 'skipped' }]), 'failed')
})

test('a post with no targets is never published', () => {
  assert.equal(rollUpPostStatus([]), 'failed')
})

// ── The claim belongs to the database ───────────────────────────────────────

test('due work is claimed with skip locked, not read-then-write', () => {
  assert.match(migration, /for update of t skip locked/,
    'two workers must take disjoint work, or a customer sees the same post twice')
  assert.match(dispatcher, /rpc\('social_claim_due_targets'/)
  // The dispatcher must not invent its own idea of what is due.
  assert.doesNotMatch(dispatcher, /from\('social_post_targets'\)[\s\S]{0,120}\.eq\('status', 'pending'\)/,
    'the dispatcher must not select due work itself')
})

test('the claim refuses work that is not actually ready', () => {
  const fn = migration.match(/create or replace function public\.social_claim_due_targets[\s\S]*?\$\$;/)?.[0] || ''
  assert.ok(fn, 'the claim function must exist')
  assert.match(fn, /p\.status in \('scheduled', 'publishing'\)/,
    "a post awaiting approval is never claimed — 'needs_approval' is not in the list")
  assert.match(fn, /coalesce\(p\.scheduled_for, now\(\)\) <= now\(\)/, 'the future is not due yet')
  assert.match(fn, /t\.external_post_id is null/, 'never re-publish what a provider already accepted')
  assert.match(fn, /claimed_at < now\(\) - make_interval/, 'a dead worker must not strand the row forever')
})

test('the database refuses to record the same provider post twice', () => {
  assert.match(migration, /create unique index if not exists social_post_targets_external_uk[\s\S]*?\(social_account_id, external_post_id\)/)
})

test('the cron entry point is behind the shared secret, not open', () => {
  const route = dispatcher.match(/app\.post\('\/cron\/social-publish'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the scheduler entry point must exist')
  assert.match(route, /requestHasCronSecret\(req\)/, 'reuse the existing guard, do not write a second one')
  assert.match(route, /403/)
})

// ── Authorization is re-checked at the moment it matters ────────────────────

test('publish-now re-checks the grant instead of trusting compose time', () => {
  const route = dispatcher.match(/app\.post\('\/social\/posts\/:id\/publish'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the publish-now route must exist')
  assert.match(route, /canActOnAccount\(req, t\.social_account_id, 'publish'\)/,
    'a grant can be withdrawn between scheduling and publishing')
  // A withdrawn permission is not a breakage.
  assert.match(route, /status: 'skipped'/)
  assert.match(route, /awaiting approval/, 'an unapproved post cannot be pushed out by hand either')
  assert.match(route, /already been published/)
})

test('publish-now cannot double-post by racing the scheduler', () => {
  const route = dispatcher.match(/app\.post\('\/social\/posts\/:id\/publish'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /\.is\('external_post_id', null\)/,
    'the manual claim carries the same guard as the worker claim')
  assert.match(route, /\.in\('status', \['pending', 'failed'\]\)/)
})

// ── The silence this slice removes ──────────────────────────────────────────

test('a post whose time passed without publishing is surfaced, not left silent', () => {
  const fn = social.match(/export async function socialAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /social_post_stuck/)
  assert.match(fn, /\.eq\('status', 'scheduled'\)[\s\S]{0,120}\.lt\('scheduled_for', stuckBefore\)/,
    'stuck means scheduled, past due, and still not moved')
  assert.match(fn, /severity: 3/)
})

// ── Studio ──────────────────────────────────────────────────────────────────

test('Studio reuses the existing image pipeline rather than growing a second one', () => {
  assert.match(studio, /import \{ toWebp \} from '\.\/inventory\.js'/)
  assert.match(studio, /storage\.from\('vehicle-photos'\)\s*\.upload/)
  assert.doesNotMatch(studio, /function toWebp/, 'a second image pipeline is a second set of bugs')
})

test('a failed asset row does not leave orphaned bytes in the bucket', () => {
  const route = studio.match(/app\.post\('\/marketing\/assets'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /storage\.from\('vehicle-photos'\)\.remove\(\[path\]\)/,
    'an object with no row is invisible storage cost forever')
})

test('deleting an asset is soft, because published posts still reference it', () => {
  const route = studio.match(/app\.delete\('\/marketing\/assets\/:id'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /deleted_at/)
  assert.doesNotMatch(route, /\.delete\(\)/, 'a post that already went out still shows that image')
})

test('the asset library is tenant-scoped on every read', () => {
  assert.match(studio, /\.eq\('dealership_id', dealershipId\)/)
  assert.match(migration, /create table if not exists public\.marketing_assets[\s\S]*?dealership_id uuid not null references public\.dealerships/)
  assert.match(migration, /alter table public\.marketing_assets enable row level security/)
})

// ── Registry hygiene ────────────────────────────────────────────────────────

test('no provider adapter ships in this slice, and the code says so', () => {
  assert.deepEqual(configuredSocialProviders(), [],
    'this slice builds the pipeline; each network is its own integration')
  assert.equal(socialProviderConfigured('facebook'), false)
})

test('an adapter must supply a publish function to register at all', () => {
  assert.throws(() => registerSocialProvider('facebook', {}), /publish\(\) function/)
})
