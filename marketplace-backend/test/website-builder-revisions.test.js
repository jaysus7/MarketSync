import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('website builder revision foundation is present', () => {
  const migration = read('supabase/migrations/20260829040215_website_builder_revision_state.sql')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS dealer_website_revisions/)
  assert.match(migration, /state TEXT NOT NULL DEFAULT 'draft'/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /dealer_website_media/)
})

test('website builder separates draft and publish actions', () => {
  const route = read('marketplace-backend/routes/site.js')
  const builder = read('marketplace-frontend/js/modules/dashboard-part17.js')
  assert.match(route, /\['draft', 'publish'\]\.includes\(rawBody\.builder_action\)/)
  assert.match(route, /builderAction === 'publish' \? 'published' : 'draft'/)
  assert.match(route, /site_published !== undefined && !\(builderAction === 'draft' && revisionSaved\)/)
  assert.match(builder, /saveWebsite\(this,'draft'\)/)
  assert.match(builder, /saveWebsite\(this,'publish'\)/)
  assert.match(builder, /\/dealership\/site\/revisions/)
  assert.match(route, /auditWebsiteDiscoverabilityContracts\(content, currentSite \|\| \{\}\)/)
  assert.match(route, /WEBSITE_DISCOVERABILITY_CONTRACT_FAILED/)
})

test('website builder exposes scoped media library endpoints', () => {
  const route = read('marketplace-backend/routes/inventory.js')
  const builder = read('marketplace-frontend/js/modules/dashboard-part17.js')
  assert.match(route, /app\.get\('\/dealership\/site-media'/)
  assert.match(route, /eq\('dealership_id', req\.dealershipId\)/)
  assert.match(route, /app\.delete\('\/dealership\/site-media\/:id'/)
  assert.match(builder, /My Media/)
  assert.match(builder, /loadWsMediaLibrary/)
})

test('builder document upgrades nested responsive sections', () => {
  const builder = read('marketplace-frontend/js/modules/dashboard-part17.js')
  const site = read('marketplace-frontend/site.html')
  assert.match(builder, /function normalizeWsSection/)
  assert.match(builder, /children: Array\.isArray\(s\.children\)/)
  assert.match(builder, /responsive: \{ desktop:/)
  assert.match(site, /function sectionTreeHtml/)
  assert.match(site, /data-ms-responsive/)
})
