import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONVERSATION_CHANNELS, CONVERSATION_STATUSES } from '../routes/conversations.js'

// Phase 6 PR 6.4 — one customer conversation, whatever channel it arrives on.
//
// The failure this prevents: a shopper asks about a Silverado on the website, gives their
// number, then texts "are you open at 2?" — and the dealership sees two unrelated threads,
// so whoever answers has half the story and the customer repeats themselves.
//
// `ai_conversations` already carried contact_id AND visitor_token, so identification was
// possible. What was missing was what happens when an identified customer already has a
// conversation open: setting contact_id would produce two live threads for one person.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const conv = strip(read('routes/conversations.js'))
const migration = read('migrations/2026-08-10-phase6-conversation-continuity.sql')

// ── The vocabulary ──────────────────────────────────────────────────────────

test('the channel and status vocabularies are small and deliberate', () => {
  assert.deepEqual(CONVERSATION_CHANNELS, ['web', 'sms', 'email', 'phone'])
  assert.deepEqual(CONVERSATION_STATUSES,
    ['active', 'waiting_customer', 'waiting_dealer', 'handoff', 'closed', 'merged'])
  // 'active' is the column default and 'handoff' is what the AI runtime already writes.
  // Widening beats renaming: a rename would silently orphan every existing writer.
  assert.match(migration, /check \(status in \('active','waiting_customer','waiting_dealer','handoff','closed','merged'\)\)/)
})

// ── Continuity is enforced, not merely intended ─────────────────────────────

test('a customer cannot have two open conversations in one department', () => {
  // This is what makes continuity real. Without it a second thread appears the moment the
  // customer switches channel, and nothing stops it.
  assert.match(migration, /create unique index if not exists ai_conversations_one_open_per_contact/)
  assert.match(migration, /\(dealership_id, contact_id, coalesce\(department, 'sales'\)\)/)
  assert.match(migration, /where contact_id is not null and status not in \('closed','merged'\)/)
})

test('an anonymous visitor is exempt, and a finished conversation frees the slot', () => {
  // A visitor has no contact to be one of; and a closed conversation must not block a
  // genuinely new one months later.
  const idx = migration.match(/create unique index if not exists ai_conversations_one_open_per_contact[\s\S]*?;/)?.[0] || ''
  assert.match(idx, /contact_id is not null/)
  assert.match(idx, /status not in \('closed','merged'\)/)
})

test('resolution prefers the identified customer over a device token', () => {
  // The same person on a new phone is still the same person.
  const fn = conv.match(/export async function resolveConversation[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'resolveConversation must exist')
  const byContact = fn.indexOf('if (contactId)')
  const byToken = fn.indexOf('if (visitorToken)')
  assert.ok(byContact > 0 && byContact < byToken, 'contact resolution must come first')
  // And following the customer to their new channel is the point.
  assert.match(fn, /byContact\.channel !== ch/)
})

test('identification merges rather than creating a second live thread', () => {
  const fn = conv.match(/export async function identifyConversation[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'identifyConversation must exist')
  assert.match(fn, /if \(!existing\)/, 'with no existing conversation it simply attaches the contact')
  assert.match(fn, /return mergeConversations\(dealershipId, existing\.id, convo\.id\)/,
    'with one, the two must become one')
  assert.match(fn, /order\('started_at', \{ ascending: true \}\)/,
    'the older conversation is the survivor — it carries more of the story')
})

test('a merge moves the transcript and destroys nothing', () => {
  const fn = conv.match(/export async function mergeConversations[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('ai_messages'\)\.update\(\{ conversation_id: winnerId \}\)/)
  assert.match(fn, /status: 'merged', merged_into: winnerId/,
    'the loser points at the winner rather than being deleted')
  assert.doesNotMatch(fn, /from\('ai_(messages|conversations)'\)\.delete\(\)/,
    'a transcript is evidence of what was said to a customer')
  // Ordering matters: the loser must stop being open before the winner is touched, or the
  // one-open-per-contact index refuses the update while two open rows name one customer.
  const loserMark = fn.indexOf("status: 'merged'")
  const winnerUpdate = fn.indexOf('.update(patch).eq(\'id\', winnerId)')
  assert.ok(loserMark > 0 && winnerUpdate > loserMark, 'mark the loser before updating the winner')
  assert.match(fn, /cannot be merged into itself/)
})

// ── Who is waiting on whom ──────────────────────────────────────────────────

test('the waiting state is derived from who spoke last, not asked for', () => {
  const fn = conv.match(/export async function recordMessage[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /patch\.status = fromCustomer \? 'waiting_dealer' : 'waiting_customer'/)
  assert.match(fn, /fromCustomer = role === 'user'/)
})

test('a human takeover is not undone by the next message', () => {
  const fn = conv.match(/export async function recordMessage[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /convo\.status !== 'handoff'/,
    'taking over is deliberate; the next reply must not silently return it to the assistant')
  assert.match(fn, /convo\.status !== 'closed'/)
})

test('a retried provider webhook does not append the same message twice', () => {
  assert.match(migration, /create unique index if not exists ai_messages_external_uk[\s\S]*?\(dealership_id, channel, external_id\)/)
  const fn = conv.match(/export async function recordMessage[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /duplicate/i)
  assert.match(fn, /return \{ recorded: false, duplicate: true \}/,
    'a duplicate is a normal outcome, not an error')
})

test('each message records the channel it arrived on', () => {
  // Without it a merged conversation is one undifferentiated wall of text and nobody can
  // tell what the customer saw where.
  assert.match(migration, /alter table public\.ai_messages add column if not exists channel text/)
})

// ── The handoff brief ───────────────────────────────────────────────────────

test('a person taking over gets everything needed to not ask twice', () => {
  const fn = conv.match(/export async function handoffBrief[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'handoffBrief must exist')
  for (const field of ['transcript', 'summary', 'sentiment', 'lead_score', 'lead_type', 'channels_used', 'contact']) {
    assert.ok(fn.includes(field), `the brief must carry ${field}`)
  }
  // It must end in a direction, not just context.
  assert.match(fn, /next_action:/)
})

test('the brief says which channels may actually be replied on', () => {
  const fn = conv.match(/export async function handoffBrief[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /mayContact\(dealershipId, convo\.contact_id, ch/,
    'consent is decided by the one gate, here too')
  // ignorePause: a human deliberately replying is exactly the case the automation freeze
  // exists to protect, not something it should block.
  assert.match(fn, /ignorePause: true/)
  assert.match(fn, /reachable/)
})

test('takeover and release are explicit, and a finished conversation refuses both', () => {
  const t = conv.match(/export async function takeOver[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(t, /that conversation is finished/)
  assert.match(t, /status: 'handoff', takeover_by: userId/)
  const release = conv.match(/app\.post\('\/conversations\/:id\/release'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(release, /\.eq\('status', 'handoff'\)/, 'releasing must guard against a lost update')
  assert.match(release, /not in human takeover/)
})

// ── Events and attention ────────────────────────────────────────────────────

test('the meaningful moments emit events, and the noisy ones do not', () => {
  for (const e of ['conversation.identified', 'conversation.merged', 'conversation.human_takeover']) {
    assert.ok(conv.includes(`'${e}'`), `missing event: ${e}`)
  }
  // Every message must NOT be an event — that floods the timeline and hides the moments
  // that matter.
  const rec = conv.match(/export async function recordMessage[\s\S]*?\n\}\n/)?.[0] || ''
  assert.doesNotMatch(rec, /emitEvent\(/, 'a single message is not a timeline event')
})

test('waiting conversations surface as attention with a real next action', () => {
  // The builder, not the route: Marketing's My Day composes these directly.
  const route = conv.match(/export async function conversationAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(route, 'the attention builder must exist')
  assert.match(conv, /app\.get\('\/conversations\/attention'/, 'and still be reachable over HTTP')
  assert.match(route, /conversation_waiting_dealer/)
  assert.match(route, /conversation_human_takeover/)
  assert.match(route, /Reply to the customer/)
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(route.includes(`${field}:`), `attention items must carry ${field}`)
  }
  // Waiting longer is more urgent — an hour-old unanswered customer outranks a fresh one.
  assert.match(route, /waited \?\? 0\) > 60 \? 3 : 2/)
})

// ── Scoping ─────────────────────────────────────────────────────────────────

test('every conversation route is dealership-scoped and permission-gated', () => {
  const routes = [...conv.matchAll(/app\.(get|post)\('(\/conversations[^']*)'[\s\S]*?\n  \}\)/g)]
  assert.ok(routes.length >= 5, `expected the conversation routes, saw ${routes.length}`)
  for (const r of routes) {
    assert.match(r[0], /req\.dealershipId/, `${r[2]} must scope to the dealership`)
    assert.match(r[0], /can(View|Edit)/, `${r[2]} must be permission-gated`)
  }
  assert.match(conv, /requirePermission\('customer\.view'\)/)
  assert.match(conv, /requirePermission\('customer\.edit'\)/)
})
