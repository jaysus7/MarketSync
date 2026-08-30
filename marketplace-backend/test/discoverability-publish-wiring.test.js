import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const siteRoute = readFileSync(new URL('../routes/site.js', import.meta.url), 'utf8')
const publicSiteHtml = readFileSync(new URL('../../marketplace-frontend/site.html', import.meta.url), 'utf8')

test('publishing a dealer website creates Discoverability validation work', () => {
  // Batch 8 requires publish to automatically queue validation. Before this, nothing
  // called the orchestration, so a publish never produced anything to recrawl.
  assert.match(siteRoute, /import \{ orchestratePublishValidation \} from '\.\.\/services\/discoverabilityValidationService\.js'/)
  assert.match(siteRoute, /await orchestratePublishValidation\(\{/)
})

test('publish queues validation against the public URL, not an internal one', () => {
  assert.match(siteRoute, /function dealerPublicSiteUrl/)
  assert.match(siteRoute, /affectedUrls: \[publicUrl\]/)
  // A verified custom domain wins; otherwise the hosted public slug URL is used.
  assert.match(siteRoute, /site\.custom_domain_verified/)
  assert.match(siteRoute, /PUBLIC_SITE_ORIGIN/)
})

test('queuing validation never blocks a dealership from publishing', () => {
  // A dealership without Discoverability configured must still be able to publish.
  const block = siteRoute.slice(siteRoute.indexOf('await orchestratePublishValidation'))
  assert.match(block.slice(0, 600), /catch \(validationError\)/)
})

test('a publish no longer certifies itself as verified', () => {
  // The deployment record used to be written with status verified and
  // "Database-backed public site state confirmed" at publish time, having looked at
  // nothing. A database write is not evidence the public site changed.
  assert.doesNotMatch(siteRoute, /Database-backed public site state confirmed/)
  assert.match(siteRoute, /Published — awaiting public validation/)
})

test('the public dealer site exposes no crawlable metadata (known blocker)', () => {
  // site.html is a client-rendered SPA: title, description, canonical and schema are
  // all injected by JavaScript after load. Crawlers that do not execute JS - including
  // MarketSync's own crawler and search engines - see only this static head.
  //
  // This test documents the blocker rather than asserting desired behaviour: while it
  // holds, public metadata validation cannot pass for a dealer site, and Verified 100
  // is unreachable for one. Server-side rendering (or prerendering for crawlers) is the
  // prerequisite. If this test starts failing because real metadata now ships in the
  // static HTML, that is the fix landing - update the expectations here.
  const head = publicSiteHtml.slice(0, publicSiteHtml.indexOf('</head>'))
  assert.match(head, /<title>Inventory<\/title>/, 'static head still carries the generic placeholder title')
  assert.equal(/<link[^>]+rel=["']canonical["']/i.test(head), false, 'no server-rendered canonical')
  assert.equal(/<meta[^>]+name=["']description["']/i.test(head), false, 'no server-rendered meta description')
  // The metadata exists only as runtime DOM mutation.
  assert.match(publicSiteHtml, /document\.title\s*=/)
})

test('a rollback is not complete until publicly verified', () => {
  // Batch 8: restoring a revision and republishing is not a finished rollback. The
  // rollback deployment used to be written as verified in the same statement that
  // created it.
  assert.match(siteRoute, /trigger_type: 'rollback', status: 'published_pending_validation'/)
  assert.match(siteRoute, /Rolled back — awaiting public verification/)
  const block = siteRoute.slice(siteRoute.indexOf("trigger_type: 'rollback'"))
  assert.match(block.slice(0, 1600), /await orchestratePublishValidation\(\{/)
})
