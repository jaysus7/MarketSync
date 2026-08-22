import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.9 — the dealer website, wired to Phase 6 truth.
//
// The website already worked. What it did not do was tell the rest of the system anything:
// PR 6.1 gave leads a campaign_id and a source_key, PR 6.3 built a consent gate that can read
// express consent — and the front door, where nearly every customer actually arrives, wrote
// none of it. Same shape as this phase's other findings: the schema was built, and nothing
// wrote it.

import { inferSourceKey } from '../routes/campaigns.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const site = strip(read('routes/submodules/site-public.js'))
const campaigns = strip(read('routes/campaigns.js'))
const consent = strip(read('routes/consent.js'))

const leadRoute = site.match(/app\.post\('\/site\/:slug\/lead'[\s\S]*?\n  \}\)/)?.[0] || ''

// ── Attribution reaches the front door ──────────────────────────────────────

test('a website lead records the campaign and the source key', () => {
  assert.ok(leadRoute, 'the website lead route must exist')
  assert.match(leadRoute, /campaign_id: campaignId, source_key: sourceKey/,
    'PR 6.1 built these columns and the website never wrote them')
})

test('a campaign is linked by id only, never by matching a name', () => {
  const fn = campaigns.match(/export async function resolveCampaignForVisit[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the resolver must exist')
  assert.match(fn, /UUID_RE\.test\(id\)/)
  // Two campaigns called "Summer Sale" a year apart is exactly the defect 6.1 removed.
  assert.doesNotMatch(fn, /\.eq\('name'|ilike\('name'/, 'name matching would reintroduce the 6.1 defect')
  assert.doesNotMatch(fn, /utm_campaign/)
})

test('a campaign id from another dealership is ignored, not honoured', () => {
  const fn = campaigns.match(/export async function resolveCampaignForVisit[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /data\.dealership_id !== dealershipId/)
  assert.match(fn, /data\.deleted_at/)
})

test('an unrecognised link attributes as inferred rather than guessing', () => {
  // No campaign id means campaign_id stays null and only the source key is written.
  assert.match(leadRoute, /const campaignId = await resolveCampaignForVisit\(d\.id, b\.campaign_id \|\| b\.c\)/)
  assert.match(leadRoute, /inferSourceKey\([^)]*\) \|\| 'website'/)
  // And the taxonomy still classifies the ordinary cases.
  assert.equal(inferSourceKey('Facebook Marketplace'), 'facebook_marketplace')
  assert.equal(inferSourceKey('Website'), 'website')
  assert.equal(inferSourceKey(''), null)
})

test("a later visit cannot overwrite the campaign that earned the customer", () => {
  assert.match(leadRoute, /\.is\('campaign_id', null\)/,
    "a customer's FIRST campaign is the one that earned them")
})

// ── Consent reaches the front door ──────────────────────────────────────────

test('express consent can now be written, not only read', () => {
  assert.match(consent, /export async function recordConsent/)
  const fn = consent.match(/export async function recordConsent[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /status: 'granted'/)
  assert.match(fn, /CONTACT_CHANNELS\.includes\(c\)/, 'only real contact channels are recordable')
})

test('a form submission records the channels the customer actually volunteered', () => {
  assert.match(leadRoute, /email \? 'email' : null, phone \? 'sms' : null, phone \? 'phone' : null/,
    'consent is recorded for what they gave us, not for everything')
  assert.match(leadRoute, /await recordConsent\(d\.id, contactId, channels/)
})

test('the consent record carries evidence, not just a flag', () => {
  const fn = consent.match(/export async function recordConsent[\s\S]*?\n\}\n/)?.[0] || ''
  for (const field of ['ip', 'user_agent', 'evidence', 'captured_at', 'source']) {
    assert.ok(fn.includes(field), `evidence must include ${field}`)
  }
  assert.match(leadRoute, /form_type: String\(b\.form_type \|\| 'inquiry'\)/)
})

test('a malformed IP cannot take the consent record down with it', () => {
  const fn = consent.match(/export async function recordConsent[\s\S]*?\n\}\n/)?.[0] || ''
  // `inet` rejects a bad value and would fail the whole insert.
  assert.match(fn, /test\(String\(ip \|\| ''\)\) \? ip : null/)
})

test('a failed evidence write never costs the dealership the lead', () => {
  const fn = consent.match(/export async function recordConsent[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /try \{/)
  assert.match(fn, /console\.error/)
  assert.doesNotMatch(fn, /throw new Error/, 'losing a lead over an evidence write is the worse outcome')
})

test('attribution failure likewise does not break lead capture', () => {
  assert.match(leadRoute, /catch \(e\) \{ console\.error\('\[site-lead\] attribution not carried to contact/)
})
