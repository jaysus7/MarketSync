import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.7 — Sales video messaging.
//
// One claim runs through everything here: fetching a link is not watching a video. Outlook
// Safe Links, Gmail's proxy and SMS previewers fetch a URL the moment it is delivered. If
// those counted as views, a rep would be told "your customer watched it twice" about someone
// who never opened it — and reps act on that.

import { watchSummary, shareLinkState } from '../routes/sales-video.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const migration = read('migrations/2026-08-10-phase6-sales-video.sql')
const route = strip(read('routes/sales-video.js'))
const watchPage = read('../marketplace-frontend/watch.html')

// ── A fetch is not a view ───────────────────────────────────────────────────

test('a link that was only fetched is never reported as watched', () => {
  const s = watchSummary({ status: 'sent', first_opened_at: '2026-08-10T12:00:00Z', first_played_at: null })
  assert.equal(s.engaged, false)
  assert.notEqual(s.label, 'Watched')
  // And the rep is told WHY it is not a view, rather than being left to guess.
  assert.match(s.detail, /often an email scanner, not the customer/)
})

test('only a real play counts as watched', () => {
  const s = watchSummary({ status: 'watched', first_opened_at: 'x', first_played_at: 'y', watch_percent: 42, watched_seconds: 25, play_count: 1 })
  assert.equal(s.engaged, true)
  assert.match(s.detail, /42%/)
})

test('watching it through is distinguished from starting it', () => {
  const most = watchSummary({ status: 'watched', first_played_at: 'y', watch_percent: 90, watched_seconds: 54 })
  const bit = watchSummary({ status: 'watched', first_played_at: 'y', watch_percent: 8, watched_seconds: 5 })
  assert.equal(most.label, 'Watched it all')
  assert.equal(bit.label, 'Watched')
  assert.equal(bit.engaged, true, 'a short watch is still a human being')
})

test('an unsent video is not described as delivered', () => {
  assert.equal(watchSummary({ status: 'ready' }).label, 'Not sent')
  assert.equal(watchSummary({ status: 'sent' }).label, 'Sent')
})

test('the database refuses to call a fetched link a view', () => {
  const fn = migration.match(/create or replace function public\.sales_video_recompute[\s\S]*?\$\$;/)?.[0] || ''
  assert.ok(fn, 'the recompute function must exist')
  assert.match(fn, /status = case when v_played is not null then 'watched' else status end/,
    "only a play moves a video to 'watched'")
  // The furthest point reached, not the sum of pings.
  assert.match(fn, /max\(position_seconds\) filter \(where kind in \('progress', 'completed'\)\)/,
    'a customer who scrubs back has not watched twice as much video')
})

test('the summary is recomputed by the database on every event', () => {
  assert.match(migration, /create trigger sales_video_events_recompute[\s\S]*?after insert on public\.sales_video_events/)
  // A UI maintaining its own counters would drift, and drift always favours looking busy.
  assert.doesNotMatch(route, /watched_seconds:\s*[^,\n}]*\+/, 'the route must not compute watch totals itself')
})

test('link_opened cannot be claimed by a client', () => {
  const ev = route.match(/app\.post\('\/v\/:token\/event'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(ev, 'the event route must exist')
  assert.match(ev, /\['play_started', 'progress', 'completed', 'replied'\]\.includes\(kind\)/)
  assert.doesNotMatch(ev, /'link_opened'.*includes|includes.*'link_opened'/,
    'a fetch is recorded server-side only, or anything could claim one')
})

test('the watch page only reports playback the browser actually performed', () => {
  assert.match(watchPage, /addEventListener\('play'/)
  assert.match(watchPage, /send\('play_started'/)
  // Forward-only progress: scrubbing back must not inflate the number.
  assert.match(watchPage, /if \(t > last\)/)
})

// ── Sending is a contact, so it goes through the one gate ───────────────────

test('sending a video calls the consent gate like every other sender', () => {
  const send = route.match(/app\.post\('\/sales-videos\/:id\/send'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(send, 'the send route must exist')
  assert.match(send, /await mayContact\(req\.dealershipId, video\.contact_id, channel\)/)
  assert.match(send, /if \(!consent\.allowed\) return res\.status\(403\)/,
    'an opted-out customer is not reachable just because the message came from Sales')
  // What was true at the moment we sent is the thing that matters later.
  assert.match(send, /consent_basis: consent\.basis/)
})

test('a video with no customer cannot be sent', () => {
  const send = route.match(/app\.post\('\/sales-videos\/:id\/send'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(send, /Attach this video to a customer before sending it/)
})

test('Sales owns this, so it is gated on the customer permissions', () => {
  assert.match(route, /requirePermission\('customer\.view'\)/)
  assert.match(route, /requirePermission\('customer\.edit'\)/)
  assert.doesNotMatch(route, /requirePermission\('marketing\./,
    'a rep sending a walkaround is not doing marketing work')
})

// ── The public link ─────────────────────────────────────────────────────────

test('a share link expires, and expiry is enforced on read', () => {
  const past = { expires_at: '2020-01-01T00:00:00Z' }
  assert.equal(shareLinkState(past).ok, false)
  assert.match(shareLinkState(past).reason, /expired/)
  assert.equal(shareLinkState({ expires_at: null }).ok, true)
  assert.equal(shareLinkState({ deleted_at: 'x' }).ok, false)
  assert.equal(shareLinkState(null).ok, false)
})

test('the public payload carries no customer record', () => {
  const pub = route.match(/app\.get\('\/v\/:token'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(pub, 'the public read route must exist')
  // A leaked link must not become a way to read someone's CRM entry.
  assert.doesNotMatch(pub, /contact_id|from\('contacts'\)/, 'the customer is never in the response')
  assert.match(pub, /\.split\(' '\)\[0\]/, "the rep's first name only")
  assert.match(pub, /kind: 'link_opened'/, 'a page load is recorded as a fetch, nothing more')
})

test('the share token is unguessable and unique', () => {
  assert.match(route, /crypto\.randomBytes\(18\)/)
  assert.match(migration, /create unique index if not exists sales_videos_share_token_uk/)
  // The row id is never what a customer receives.
  assert.match(route, /\.eq\('share_token', req\.params\.token\)/)
})

test('the watch page is not indexable', () => {
  assert.match(watchPage, /<meta name="robots" content="noindex,nofollow">/)
})

// ── What a rep should do today ──────────────────────────────────────────────

test('a watched video becomes an opportunity, an ignored one becomes a nudge', () => {
  const fn = route.match(/export async function salesVideoAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the attention builder must exist')
  assert.match(fn, /kind: 'sales_video_watched', severity: 1/, 'someone watching is an opportunity')
  assert.match(fn, /kind: 'sales_video_unopened', severity: 2/)
  assert.match(fn, /owner: 'Sales'/)
  // The nudge is only for videos that were never played — not merely never fetched.
  assert.match(fn, /\.eq\('status', 'sent'\)/)
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(fn.includes(`${field}:`), `attention items must carry ${field}`)
  }
})

// ── Storage hygiene ─────────────────────────────────────────────────────────

test('a failed video row does not leave orphaned bytes in the bucket', () => {
  const up = route.match(/app\.post\('\/sales-videos'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(up, /storage\.from\('sales-videos'\)\.remove\(\[path\]\)/)
  assert.match(up, /that file is not a video/i)
})

test('videos are tenant-scoped and soft-deletable', () => {
  assert.match(route, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(migration, /alter table public\.sales_videos enable row level security/)
  assert.match(migration, /alter table public\.sales_video_events enable row level security/)
})
