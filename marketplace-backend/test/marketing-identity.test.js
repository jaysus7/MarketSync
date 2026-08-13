import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inferSourceKey } from '../routes/campaigns.js'

// Phase 6 PR 6.1 — Marketing identity.
//
// THE DEFECT: attribution ran on display names. buildMarketingRoi() passed the free-text
// contacts.source through a string normaliser and nothing linked a customer to a campaign
// by ID, so two campaigns on one channel were indistinguishable and renaming a source
// silently re-bucketed history.
//
// Two rules everything here defends:
//   * Attribution is by ID. A legacy free-text source is INFERRED and labelled as such —
//     never silently upgraded to linked.
//   * Marketing consumes financial truth; it does not invent gross.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const camp = strip(read('routes/campaigns.js'))
const mkt = strip(read('routes/marketing.js'))
const migration = read('migrations/2026-08-10-phase6-marketing-identity.sql')

// ── The taxonomy ────────────────────────────────────────────────────────────

test('the source taxonomy covers the canonical list, as data', () => {
  for (const key of ['facebook_ads', 'instagram_ads', 'google_ads', 'facebook_organic',
                     'instagram_organic', 'tiktok', 'youtube', 'linkedin',
                     'facebook_marketplace', 'website', 'organic_search', 'email', 'sms',
                     'referral', 'phone', 'walk_in', 'third_party_lead']) {
    assert.ok(migration.includes(`'${key}'`), `taxonomy is missing ${key}`)
  }
  // Global rows plus dealer additions, one vocabulary.
  assert.match(migration, /create unique index if not exists marketing_sources_key_uk/)
})

test('inference maps legacy strings without pretending to be certain', () => {
  // These are the strings real dealers have typed.
  assert.equal(inferSourceKey('Facebook Marketplace'), 'facebook_marketplace')
  assert.equal(inferSourceKey('FB ad'), 'facebook_ads')
  assert.equal(inferSourceKey('google adwords'), 'google_ads')
  assert.equal(inferSourceKey('Walk-in'), 'walk_in')
  assert.equal(inferSourceKey('AutoTrader'), 'third_party_lead')
  assert.equal(inferSourceKey('referral from Bob'), 'referral')
  // An unmappable string must NOT be forced into a bucket.
  assert.equal(inferSourceKey('some brand new thing'), null)
  assert.equal(inferSourceKey(''), null)
  assert.equal(inferSourceKey(null), null)
})

test('a paid source is distinguishable from an organic one', () => {
  // Cost-per-lead means nothing if organic and paid are the same kind of row.
  assert.match(migration, /'facebook_ads',\s+'Facebook Ads',\s+'Social',\s+true/)
  assert.match(migration, /'facebook_organic',\s+'Facebook Organic',\s+'Social',\s+false/)
})

// ── Campaign identity ───────────────────────────────────────────────────────

test('a provider campaign is an external reference, never the identity', () => {
  assert.match(migration, /create table if not exists public\.campaign_external_refs/)
  // One provider id maps to at most one campaign, so a provider row cannot be
  // double-counted across two campaigns.
  assert.match(migration, /create unique index if not exists campaign_external_refs_uk[\s\S]*?\(dealership_id, provider, external_id\)/)
  const route = camp.match(/app\.post\('\/campaigns\/:id\/external-ref'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /already linked to a campaign/, 'a second claim must be refused, not silently moved')
})

test('the campaign lifecycle is a real graph, not a free-for-all', () => {
  const t = camp.match(/const TRANSITIONS = \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(t, 'transitions must be declared')
  assert.match(t, /completed: \[\]/, 'a completed campaign is terminal')
  assert.match(t, /cancelled: \[\]/, 'a cancelled campaign is terminal')
  const route = camp.match(/app\.post\('\/campaigns\/:id\/status'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /cannot become/, 'an illegal move must be refused')
  assert.match(route, /\.eq\('status', cur\.status\)/, 'and the update must guard against a lost update')
  // Approval records who and when — an approval nobody owns is not an approval.
  assert.match(route, /patch\.approved_by/)
  assert.match(route, /patch\.approved_at/)
})

test('a campaign cannot be created on an invented channel', () => {
  // This is where source drift would start.
  const route = camp.match(/app\.post\('\/campaigns'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /Unknown marketing source/)
  assert.match(route, /valid\.has\(c\)/)
})

test('a campaign scopes inventory rather than copying it', () => {
  // Duplicating vehicle rows into Marketing is how the two drift apart.
  assert.match(migration, /inventory_scope jsonb/)
  assert.doesNotMatch(migration, /create table[\s\S]{0,200}campaign_vehicles/)
})

// ── Attribution and money ───────────────────────────────────────────────────

test('attribution links by ID, alongside the legacy strings', () => {
  assert.match(migration, /alter table public\.contacts add column if not exists campaign_id uuid/)
  assert.match(migration, /alter table public\.leads add column if not exists campaign_id uuid/)
  // The historical strings are the only attribution older rows have — they must survive.
  assert.doesNotMatch(migration, /update public\.contacts set source|drop column .*source/)
})

test('campaign performance counts by campaign_id, never by a source string', () => {
  const fn = camp.match(/export async function campaignPerformance[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'campaignPerformance must exist')
  assert.match(fn, /\.in\('campaign_id', ids\)/)
  // No marketing source string may enter the count. (`journal_entries.source` is the
  // ledger's own column meaning "what produced this entry" — a different word entirely,
  // so the check names the marketing vocabulary rather than the bare token.)
  assert.doesNotMatch(fn, /channelOf|source_key|sold_source|inferSourceKey/,
    'performance must not fall back to string matching')
  const sourceFilters = [...fn.matchAll(/\.eq\('source', '([^']+)'\)/g)].map(m => m[1])
  assert.deepEqual(sourceFilters, ['deal'],
    `the only 'source' filter may be the ledger's, saw ${JSON.stringify(sourceFilters)}`)
})

test('gross comes from the posted ledger, and a missing one is admitted', () => {
  const fn = camp.match(/export async function campaignPerformance[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('journal_entries'\)[\s\S]{0,200}\.eq\('posted', true\)/,
    'only posted journals are financial truth')
  assert.match(fn, /gross_unknown\+\+/, 'a delivery with no posted journal must be counted, not guessed')
  assert.doesNotMatch(fn, /avgGross|DEFAULT_AVG_GROSS|3500/,
    'campaign gross must never be an assumed average')
})

test('ROI uses actual spend and known gross, or reports nothing', () => {
  assert.match(camp, /s\.actual > 0 && p\.gross_known > 0 \? round2\(\(p\.gross - s\.actual\)/,
    'ROI needs real spend AND real gross')
  // Budget must never be mistaken for spend.
  const spendFn = camp.match(/export async function campaignSpend[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(spendFn, /if \(r\.kind === 'budget'\)/, 'budget is tracked separately')
  assert.match(camp, /gross_complete: p\.gross_unknown === 0/,
    'the caller must be told whether the gross figure is complete')
})

test('budget and actual are different rows, and an actual records where it came from', () => {
  assert.match(migration, /marketing_spend_kind_valid check \(kind in \('budget','actual'\)\)/)
  assert.match(migration, /marketing_spend_origin_valid check \(origin in \('manual','imported'\)\)/)
  // The identity must separate them, and stay targetable by an upsert.
  assert.match(migration, /marketing_spend_identity_uk[\s\S]*?\(dealership_id, channel, period, kind, campaign_id\)[\s\S]*?nulls not distinct/)
  const route = camp.match(/app\.post\('\/campaigns\/:id\/spend'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /kind must be 'budget' or 'actual'/)
  assert.match(route, /origin must be 'manual' or 'imported'/)
})

test('the legacy channel ROI stops counting budget as spend, and says what it is', () => {
  const fn = mkt.match(/export async function buildMarketingRoi[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(s\.kind === 'budget'\) continue/, 'budget rows must not be spent money')
  // And it must not present an assumed gross as a measured one.
  assert.match(fn, /basis: 'inferred'/)
  assert.match(fn, /gross_basis: 'assumed_average'/)
  assert.match(fn, /est_roi_pct/, 'an estimated ROI must be named as an estimate')
  assert.doesNotMatch(fn, /\broi_pct:/, 'the unqualified name implied a measured figure')
})

test('the legacy spend upsert still matches the new identity', () => {
  // The Phase 6 index replaced the constraint this upsert used to target; missing that
  // would have broken every channel spend save.
  const route = mkt.match(/app\.put\('\/marketing\/spend'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /onConflict: 'dealership_id,channel,period,kind,campaign_id'/)
  assert.match(route, /kind: 'actual'/, 'a dealer typing what they spent is an actual, not a budget')
})

// ── Tenant isolation ────────────────────────────────────────────────────────

test('every campaign read and write is scoped to the dealership', () => {
  const routes = [...camp.matchAll(/app\.(get|post)\('(\/[^']+)'[\s\S]*?\n  \}\)/g)].map(m => ({ path: m[2], body: m[0] }))
  assert.ok(routes.length >= 6, `expected the campaign routes, saw ${routes.length}`)
  for (const r of routes) {
    assert.match(r.body, /req\.dealershipId/, `${r.path} must scope to the dealership`)
  }
  assert.match(camp, /const canView = requirePermission\('marketing\.view'\)/)
  assert.match(camp, /const canEdit = requirePermission\('marketing\.edit'\)/)
})

test('marketing tables carry row level security', () => {
  for (const t of ['marketing_sources', 'campaigns', 'campaign_external_refs']) {
    assert.match(migration, new RegExp(`alter table public\\.${t} enable row level security`),
      `${t} must have RLS enabled`)
  }
})
