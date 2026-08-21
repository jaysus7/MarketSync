import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePersonaInquiry, normalizeStripeSession, identityAttention } from '../routes/identity.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const migration = read('migrations/2026-08-11-phase8-identity-trust.sql')
const route = read('routes/identity.js')

test('Persona approval without report evidence is Manual Review, never a fabricated match', () => {
  const result = normalizePersonaInquiry({ data: { id: 'inq_1', attributes: { status: 'approved', 'name-first': 'Alex' } } })
  assert.equal(result.decision, 'manual_review')
  assert.equal(result.document_result, 'unknown')
  assert.equal(result.liveness_result, 'unknown')
  assert.equal(result.face_match_score, null)
  assert.ok(!('selfie_matched' in result))
})

test('Stripe verified normalizes configured checks but never invents a numeric score', () => {
  const result = normalizeStripeSession({ id: 'vs_1', status: 'verified', verified_outputs: { first_name: 'Alex', last_name: 'Lee' } })
  assert.equal(result.decision, 'verified')
  assert.equal(result.document_result, 'passed')
  assert.equal(result.liveness_result, 'passed')
  assert.equal(result.live_face_result, 'passed')
  assert.equal(result.face_match_score, null)
})

test('identity is one purpose-scoped canonical record with a structural tenant boundary', () => {
  assert.match(migration, /create table if not exists public\.identity_verifications/)
  assert.match(migration, /purpose text not null check/)
  assert.match(migration, /foreign key \(contact_id, dealership_id\) references public\.contacts\(id, dealership_id\)/)
  assert.match(migration, /face_match_score numeric\(5,2\).*between 0 and 100/)
  assert.match(migration, /decision in \('pending','processing','verified','manual_review','failed','expired','cancelled'\)/)
})

test('runtime writes verification state only to the canonical domain', () => {
  assert.match(route, /from\('identity_verifications'\)\.insert/)
  assert.match(route, /from\('identity_verifications'\)\.update/)
  assert.doesNotMatch(route, /from\('contacts'\)\.update\([\s\S]{0,200}id_verification/)
})

test('manual review preserves the machine decision and requires actor, reason and audit', () => {
  assert.match(route, /app\.post\('\/identity\/:id\/review'/)
  assert.match(route, /reviewed_by: req\.user\?\.id/)
  assert.match(route, /review_reason: reason/)
  assert.match(route, /before_state: \{ decision: current\.decision \}/)
  assert.match(route, /after_state: \{ decision, reason \}/)
  assert.match(route, /decision === 'verified'.*document_result === 'unknown'.*liveness_result === 'unknown'/s,
    'unknown provider evidence must never be promoted through ordinary review')
})

test('override is separately permissioned, preserves machine truth and requires a reason', () => {
  const block = route.match(/app\.post\('\/identity\/:id\/override'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(block, /requirePermission\('identity\.override'\)/)
  assert.match(block, /reason\.length < 10/)
  const update = block.match(/\.update\(\{[\s\S]*?\}\)\.eq/)?.[0] || ''
  assert.doesNotMatch(update, /machine_decision\s*:/)
  assert.match(block, /override_reason: reason/)
  assert.match(block, /customer\.identity_verification_overridden/)
})

test('MarketSync Native is explicit about being unavailable', () => {
  assert.match(route, /native: \{ available: false/)
  assert.doesNotMatch(route, /provider:\s*['"]marketsync_native['"][\s\S]{0,300}decision:\s*['"]verified['"]/)
})

test('identity attention is a reference to the canonical verification, not a copied task', async () => {
  const originalFrom = (await import('../shared.js')).supabaseAdmin.from
  const rows = [{ id: 'v1', contact_id: 'c1', purpose: 'delivery', provider: 'persona', decision: 'manual_review', requested_at: '2026-08-11T00:00:00Z', contacts: { full_name: 'Alex Lee' } }]
  const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: async () => ({ data: rows, error: null }) }
  ;(await import('../shared.js')).supabaseAdmin.from = () => chain
  try {
    const [item] = await identityAttention('d1')
    assert.equal(item.source_type, 'identity_verification')
    assert.equal(item.source_id, 'v1')
    assert.equal(item.attention_type, 'approval')
    assert.equal(item.action, 'Review Identity')
  } finally { (await import('../shared.js')).supabaseAdmin.from = originalFrom }
})

test('manual review queue is tenant-scoped and permission-gated', () => {
  assert.match(route, /app\.get\('\/identity\/reviews', requireAuth, requireMfa, hasIdentityProduct, requirePermission\('identity\.review'\)/)
  assert.match(route, /from\('identity_verifications'\)[\s\S]*?\.eq\('dealership_id', req\.dealershipId\)\.eq\('decision', 'manual_review'\)/)
})

test('every identity operation requires the sold product as well as role permission', () => {
  assert.match(route, /const hasIdentityProduct = requireProduct\('marketsync_identity'\)/)
  for (const permission of ['integrations.manage', 'identity.request', 'identity.view', 'identity.review', 'identity.override']) {
    assert.match(route, new RegExp(`hasIdentityProduct, requirePermission\\('${permission.replace('.', '\\.')}'\\)`))
  }
})

test('customer verification fails closed unless reviewed active video liveness is enabled', () => {
  assert.match(route, /PERSONA_ACTIVE_VIDEO_LIVENESS === 'true'/)
  assert.match(route, /if \(!capabilities\.active_video_liveness\)/)
  assert.match(route, /code: 'ACTIVE_VIDEO_LIVENESS_REQUIRED'/)
})

test('customer embeds name the intended foreign key when two relationships exist', () => {
  const embeds = [...route.matchAll(/contacts!identity_verifications_contact_id_fkey\(full_name\)/g)]
  assert.equal(embeds.length, 2, 'attention and review queue must both avoid an ambiguous PostgREST embed')
  assert.doesNotMatch(route, /contacts\(full_name\)/)
})

test('Management approvals renders canonical identity evidence and acts on the review route', () => {
  const ui = read(' ../marketplace-frontend/js/modules/dashboard-part11.js'.trim())
  assert.match(ui, /apiGetJson\('\/identity\/reviews'\)/)
  assert.match(ui, /cmdIdentityReviewCard/)
  assert.match(ui, /apiSendJson\(`\/identity\/\$\{id\}\/review`/)
  assert.match(ui, /machine_decision/)
  assert.match(ui, /evidence_reference/)
})
