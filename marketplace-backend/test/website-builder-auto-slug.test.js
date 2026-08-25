import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const site = readFileSync(new URL('../routes/site.js', import.meta.url), 'utf8')
const dashboardPart17 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

// The visual Live Builder refuses to render at all without a site_slug
// (dashboard-part17.js's renderLiveBuilder, gated on __siteCfg.site_slug). Previously
// the only place a slug was ever auto-assigned was on first publish, so any dealership
// that hadn't published yet — including every fresh demo/new signup — hit a dead-end
// "name your site address first" screen and could never try the builder at all.
test('renderLiveBuilder still requires a site_slug before rendering', () => {
  assert.match(dashboardPart17, /const slug = __siteCfg\?\.site_slug;\s*\n\s*if \(!slug\)/)
})

test('GET /dealership/site auto-assigns a slug when one is missing, before the Live Builder gate can ever see it', () => {
  const getHandler = site.slice(site.indexOf("app.get('/dealership/site'"), site.indexOf("app.put('/dealership/site'"))
  assert.match(getHandler, /if \(!d\.site_slug\) d\.site_slug = await autoAssignSlug\(req\.dealershipId, d\.name\)/)
})

test('auto-assigned slugs stay unpublished — nothing becomes publicly reachable just by having a slug', () => {
  // autoAssignSlug only ever writes site_slug, never site_published.
  const helper = site.slice(site.indexOf('async function autoAssignSlug'), site.indexOf('async function autoAssignSlug') + 800)
  assert.doesNotMatch(helper, /site_published/)
  assert.match(helper, /\.update\(\{ site_slug: slug \}\)/)
})

test('auto-assigned slugs are deduplicated against existing dealerships, same as the publish-time assignment', () => {
  const helper = site.slice(site.indexOf('async function autoAssignSlug'), site.indexOf('async function autoAssignSlug') + 800)
  assert.match(helper, /\.ilike\('site_slug', slug\)\.neq\('id', dealershipId\)/)
})
