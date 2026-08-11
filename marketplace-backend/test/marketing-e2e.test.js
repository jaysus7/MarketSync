import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6.10 — Marketing end-to-end.
//
// AGENTS.md A19 asks for the runtime chain to be proven, not the presence of its pieces:
//
//   producer → canonical write/action → database state → consumer/read → user-visible outcome
//
// Phase 6 built five such chains. This file walks each one and asserts the JOIN between the
// links — the place every defect this phase found was actually hiding. Where a link is a pure
// function it is executed; where it is a database contract it is asserted against the applied
// migration, which is the artefact the database was built from.

import { rollUpPostStatus, applyTargetOutcome } from '../routes/social-publish.js'
import { publishToProvider } from '../providers/social-providers.js'
import { watchSummary } from '../routes/sales-video.js'
import { ratingSummary } from '../routes/reputation.js'
import { normalizeItem, MY_DAY_SOURCES } from '../routes/my-day.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const campaigns = strip(read('routes/campaigns.js'))
const sitePublic = strip(read('routes/submodules/site-public.js'))
const consent = strip(read('routes/consent.js'))
const socialPub = strip(read('routes/social-publish.js'))
const mSocial = read('migrations/2026-08-10-phase6-social-publishing.sql')
const mVideo = read('migrations/2026-08-10-phase6-sales-video.sql')
const mIdentity = read('migrations/2026-08-10-phase6-marketing-identity.sql')

// ── Chain 1: a stranger on the website becomes an attributed, contactable customer ──

test('E2E — website form → contact → campaign id → consent → reachable', () => {
  const lead = sitePublic.match(/app\.post\('\/site\/:slug\/lead'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(lead, 'the producer must exist')

  // producer → canonical write: the lead carries the campaign identity, not a display name.
  assert.match(lead, /campaign_id: campaignId, source_key: sourceKey/)
  // …and the columns it writes are real.
  assert.match(mIdentity, /alter table public\.leads add column if not exists campaign_id uuid/)
  assert.match(mIdentity, /alter table public\.contacts add column if not exists campaign_id uuid/)

  // canonical write → consumer: consent is RECORDED, and the gate can read it back.
  assert.match(lead, /await recordConsent\(d\.id, contactId, channels/)
  assert.match(consent, /export async function recordConsent/)
  assert.match(consent, /status: 'granted'/)
  const gate = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(gate, /from\('customer_consents'\)/, 'the gate reads what the form wrote')
  assert.match(gate, /basis: 'express'/, 'and reports the stronger basis it now has')
})

test('E2E — attribution refuses to guess when the link carries no campaign', () => {
  const resolve = campaigns.match(/export async function resolveCampaignForVisit[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(resolve, /UUID_RE\.test\(id\)/)
  assert.match(resolve, /data\.dealership_id !== dealershipId/, 'cross-tenant ids are ignored')
  assert.doesNotMatch(resolve, /ilike\('name'|\.eq\('name'/, 'never a name match — that was the 6.1 defect')
})

// ── Chain 2: a post reaches a customer, or the dealership is told why not ──

test('E2E — approve → due → claim → provider → published, with evidence at every step', async () => {
  // The claim is the database's, and it refuses work that is not ready.
  const claim = mSocial.match(/create or replace function public\.social_claim_due_targets[\s\S]*?\$\$;/)?.[0] || ''
  assert.match(claim, /for update of t skip locked/)
  assert.match(claim, /p\.status in \('scheduled', 'publishing'\)/, 'an unapproved post is never claimed')
  assert.match(claim, /t\.external_post_id is null/, 'a published target is never re-claimed')

  // No adapter configured — which is the real state of this product today.
  const noProvider = await publishToProvider({ account: { provider: 'facebook', status: 'connected', display_name: 'Page' }, body: 'hi' })
  assert.equal(noProvider.ok, false)
  assert.match(noProvider.error, /Nothing was sent/)

  // …and the target write agrees: not published, and it says why.
  const patch = applyTargetOutcome({ attempts: 1 }, noProvider)
  assert.notEqual(patch.status, 'published')
  assert.equal(patch.status, 'failed', 'a missing integration will not fix itself on a retry')

  // The post's status is derived from its targets — the whole chain's user-visible outcome.
  assert.equal(rollUpPostStatus([{ status: 'failed' }]), 'failed')
  assert.equal(rollUpPostStatus([{ status: 'published' }, { status: 'failed' }]), 'partially_published')
})

test('E2E — the failure is visible in the queue, not silent', () => {
  const social = strip(read('routes/social.js'))
  const attention = social.match(/export async function socialAttention[\s\S]*?\n\}\n/)?.[0] || ''
  // The consumer of a stuck post, and of a failed one.
  assert.match(attention, /social_post_stuck/)
  assert.match(attention, /social_publish_failed/)
  // And My Day composes that consumer, so the chain ends somewhere a person looks.
  assert.ok(MY_DAY_SOURCES.some(s => s.key === 'social'))
})

// ── Chain 3: a video is watched, or it merely arrived ──

test('E2E — send → link fetched → played → watched, and the three stay distinct', () => {
  const recompute = mVideo.match(/create or replace function public\.sales_video_recompute[\s\S]*?\$\$;/)?.[0] || ''
  assert.match(recompute, /status = case when v_played is not null then 'watched' else status end/)
  assert.match(mVideo, /create trigger sales_video_events_recompute/, 'the DB is the producer of watch state')

  // The user-visible end of that chain, run for real.
  assert.equal(watchSummary({ status: 'sent' }).engaged, false)
  assert.equal(watchSummary({ status: 'sent', first_opened_at: 'x' }).engaged, false)
  assert.equal(watchSummary({ status: 'watched', first_played_at: 'x', watch_percent: 60, watched_seconds: 36 }).engaged, true)
  assert.match(watchSummary({ status: 'sent', first_opened_at: 'x' }).detail, /email scanner/)
})

// ── Chain 4: a review is asked for, honestly ──

test('E2E — visit → ask → both destinations → rating that hides nothing', () => {
  const rep = strip(read('routes/reputation.js'))
  const ask = rep.match(/app\.post\('\/reputation\/requests'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(ask, /public_url: publicUrl/)
  assert.match(ask, /private_feedback_token: newPrivateToken\(\)/)
  assert.doesNotMatch(rep, /sentiment|expected_rating/i, 'there is no point where sentiment could be consulted')

  const s = ratingSummary([...Array(20).fill({ rating: 5, responded_at: 'x' }), ...Array(5).fill({ rating: 1, responded_at: null })])
  assert.equal(s.detractors, 5)
  assert.match(s.note, /5 of 25 rated 3 or below/, 'the average never hides what is behind it')
})

// ── Chain 5: every department's answer reaches one queue ──

test('E2E — every department with a builder → one day, normalized and permission-gated', () => {
  assert.equal(MY_DAY_SOURCES.length, 15)
  for (const s of MY_DAY_SOURCES) {
    assert.equal(typeof s.load, 'function', `${s.key} must have a live loader, not a name`)
    assert.ok(s.permission, `${s.key} must be permission-gated`)
  }
  // An item from the one source that predates the contract still renders.
  const item = normalizeItem(
    { kind: 'cit_negative', severity: 3, source: 'deal', reason: 'CIT is negative', owner: 'F&I', action: 'Review Deal', ref: 'd1' },
    { key: 'accounting', label: 'Accounting', department: 'Accounting' },
  )
  assert.ok(item.subject.trim())
  assert.equal(item.owner, 'F&I', 'and it is handed to whoever can fix it')
})

// ── The rule the whole phase was written under ──

test('no Phase 6 state claims an external outcome without external evidence', () => {
  // A20. The one that would have caught the defect this phase kept finding.
  assert.match(socialPub, /result\?\.ok && result\.external_post_id/,
    'published requires a provider-created id')
  const patch = applyTargetOutcome({ attempts: 1 }, { ok: true })   // success, no id
  assert.notEqual(patch.status, 'published')
  assert.match(patch.error, /cannot confirm it went live/)
})
