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

test('command center only reads canonical endpoints — /dealership/site and /dealership/blog', () => {
  const start = wk.indexOf('async function loadWebsiteCommandCenter')
  assert.ok(start > 0, 'loadWebsiteCommandCenter must be defined')
  const block = wk.slice(start, start + 800)
  assert.match(block, /apiGetJson\(['"]\/dealership\/site['"]\)/, 'must call /dealership/site')
  assert.match(block, /apiGetJson\(['"]\/dealership\/blog['"]\)/, 'must call /dealership/blog')
  // No parallel data endpoints — everything the command center shows must
  // come through the canonical site/blog contract.
  assert.doesNotMatch(block, /apiGetJson\(['"]\/website\//, 'must not call an invented /website/... endpoint')
  assert.doesNotMatch(block, /apiGetJson\(['"]\/hq\//, 'HQ endpoints are not available to dealers')
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
