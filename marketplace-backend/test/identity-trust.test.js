import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePersonaInquiry, normalizeStripeSession } from '../routes/identity.js'

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
})

test('MarketSync Native is explicit about being unavailable', () => {
  assert.match(route, /native: \{ available: false/)
  assert.doesNotMatch(route, /provider:\s*['"]marketsync_native['"][\s\S]{0,300}decision:\s*['"]verified['"]/)
})
