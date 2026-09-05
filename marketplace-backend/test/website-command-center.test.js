// Website command center (Phase B) — Sections 1, 8 + Quick Actions.
//
// Pins the frontend wiring: the marketing-workspace `website` renderer must
// mount the command-center root above the SEO workspace, and the command
// center itself must fetch canonical endpoints only — /dealership/site and
// /dealership/blog. No parallel data model, no mocked numbers.

import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const wk = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')

test('website renderer mounts the command-center root above the SEO root', () => {
  const start = wk.indexOf(`website(body) {`)
  assert.ok(start > 0, 'website renderer must exist')
  const block = wk.slice(start, start + 2000)
  assert.match(block, /id="website-cc-root"/, 'renderer must include #website-cc-root mount')
  assert.match(block, /id="seo-workspace-root"/, 'renderer must keep #seo-workspace-root mount')
  // Command center appears BEFORE the SEO mount — status is the first thing users see.
  assert.ok(block.indexOf('website-cc-root') < block.indexOf('seo-workspace-root'),
    'command center must render above the SEO workspace')
  assert.match(block, /loadWebsiteCommandCenter/, 'renderer must call loadWebsiteCommandCenter()')
})

test('command center only reads canonical endpoints — no invented sources', () => {
  const start = wk.indexOf('async function loadWebsiteCommandCenter')
  assert.ok(start > 0, 'loadWebsiteCommandCenter must be defined')
  const block = wk.slice(start, start + 3500)
  assert.match(block, /apiGetJson\(['"]\/dealership\/site['"]\)/, 'must call /dealership/site')
  assert.match(block, /apiGetJson\(['"]\/dealership\/blog['"]\)/, 'must call /dealership/blog')
  // Phase C additions — real endpoints that already ship.
  assert.match(block, /apiGetJson\(['"]\/leads['"]\)/, 'Phase C must read /leads for website-attributed count')
  assert.match(block, /apiGetJson\(['"]\/integrations\/matrix['"]\)/, 'Phase C must check /integrations/matrix for GA4 state')
  // Phase D — Discoverability snapshot + recommendations. Same engine the
  // existing loadDealerSeo() workspace uses, no duplication.
  assert.match(block, /apiGetJson\(['"]\/discoverability\/overview['"]\)/, 'Phase D must read /discoverability/overview')
  assert.match(block, /apiGetJson\(['"]\/discoverability\/recommendations['"]\)/, 'Phase D must read /discoverability/recommendations')
  // Phase E — AI Customer Agent counts read from the real conversations table.
  assert.match(block, /apiGetJson\(['"]\/ai\/conversations\?limit=200['"]\)/, 'Phase E must read /ai/conversations')
  // GA4 query is lazy — only fires when the matrix says it's connected.
  assert.match(block, /fetch\(`\$\{API\}\/integrations\/google\/ga4\/query`/, 'GA4 query must be a real POST fetch, not a fake')
  // No parallel data endpoints.
  assert.doesNotMatch(block, /apiGetJson\(['"]\/website\//, 'must not call an invented /website/... endpoint')
  assert.doesNotMatch(block, /apiGetJson\(['"]\/hq\//, 'HQ endpoints are not available to dealers')
})

test('Phase C surfaces honest disconnected chips for absent data — no fake metrics', () => {
  const start = wk.indexOf('function renderWebsiteCommandCenter')
  const end = wk.indexOf('window.renderWebsiteCommandCenter', start)
  const block = wk.slice(start, end)
  // Performance section only shows numbers when GA4 is actually connected.
  assert.match(block, /gaConnected/, 'perf gating on real gaConnected flag from /integrations/matrix')
  // Inventory perf is honest — no page-view source exists in the repo yet.
  assert.match(block, /data-website-cc-section="inventory-perf"/, 'Section 4 must exist')
  const invStart = block.indexOf('data-website-cc-section="inventory-perf"')
  const invBlock = block.slice(invStart, invStart + 1200)
  assert.match(invBlock, /Not connected/, 'Section 4 must render an explicit "Not connected" state — no fake VDP/SRP counts')
  // Website leads must come from real CRM data filtered by source === 'website'.
  assert.match(block, /source \|\| ''\)\.toLowerCase\(\) === 'website'/, 'Section 3 must filter CRM leads by source')
  // Phase D · sections 5-6-7 must render the Discoverability sections tagged
  // and deep-link into the full workspace rather than duplicate its UI.
  assert.match(block, /data-website-cc-section="discoverability"/, 'Section 5/6 snapshot must exist')
  assert.match(block, /data-website-cc-section="recommendations"/, 'Section 7 AI recs must exist')
  assert.match(block, /switchPage\(['"]discoverability['"]\)/, 'Snapshot must deep-link to the full Discoverability workspace')
  // Never fabricate a score — every displayed number reads from discRes.
  assert.match(block, /discRes\.compositeScore/, 'Composite score must read from /discoverability/overview response')
  // Phase E · sections 10-13. Integrations reads real health; speed and a11y
  // stay honest until a scanner is wired; AI agent reads real conversations.
  assert.match(block, /data-website-cc-section="integrations"/, 'Section 10 must exist')
  assert.match(block, /data-website-cc-section="speed"/, 'Section 11 must exist')
  assert.match(block, /data-website-cc-section="accessibility"/, 'Section 12 must exist')
  assert.match(block, /data-website-cc-section="ai-agent"/, 'Section 13 must exist')
  // Speed and accessibility must be honest — no fake scores.
  for (const key of ['speed', 'accessibility']) {
    const idx = block.indexOf(`data-website-cc-section="${key}"`)
    const slice = block.slice(idx, idx + 1000)
    assert.match(slice, /Not connected/, `Section for ${key} must render a "Not connected" chip — no fabricated scores`)
  }
  // Integration health reads the real `.health` string, not a fabricated boolean.
  assert.match(block, /google_analytics/, 'Integrations row must use the canonical matrix key google_analytics')
  assert.match(block, /row\?\.health/, 'Integration status must read the real .health field from /integrations/matrix')
})

test('render uses real fields from /dealership/site — no fake metrics', () => {
  const start = wk.indexOf('function renderWebsiteCommandCenter')
  const end = wk.indexOf('window.renderWebsiteCommandCenter', start)
  assert.ok(start > 0 && end > start, 'renderWebsiteCommandCenter must be defined')
  const block = wk.slice(start, end)
  // Every displayed status field must map to a real /dealership/site response
  // key. Bugs here mean we invented UI that has no backend truth.
  for (const key of ['site_slug', 'site_published', 'custom_domain', 'custom_domain_verified', 'revision', 'published_revision', 'content?.pages', 'content?.forms']) {
    assert.match(block, new RegExp(key.replace(/[.?]/g, m => '\\' + m)), `command center must read site.${key}`)
  }
  // Never hard-code a fabricated numeric metric. Phase B ships only counts
  // computed from real /dealership/site + /dealership/blog payloads.
  assert.doesNotMatch(block, /(?<![\w])(?:\d{3,}|1[0-9]|[2-9][0-9])\s*(?:visitors|leads|sessions|views|clicks)/i,
    'Phase B must not seed sample analytics numbers')
})

test('command-center CTAs deep-link to real destinations', () => {
  const start = wk.indexOf('function renderWebsiteCommandCenter')
  const block = wk.slice(start, start + 12000)
  // Every CTA must route to a live handler; no dead buttons.
  assert.match(block, /openWebsiteBuilder\(\)/, 'Edit / Create page must call openWebsiteBuilder')
  assert.match(block, /wsPublicSiteUrl/, 'View live must build a real public URL')
  assert.match(block, /switchPage\(['"]discoverability['"]\)/, 'View discoverability must deep-link the workspace')
  assert.match(block, /openSetupModal\(['"]domain['"]\)/, 'Manage domain must open the domain setup modal')
})
