import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const siteRoute = readFileSync(new URL('../routes/site.js', import.meta.url), 'utf8')
const publicRoute = readFileSync(new URL('../routes/submodules/site-public.js', import.meta.url), 'utf8')
const builder = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')
const publicSite = readFileSync(new URL('../../marketplace-frontend/site.html', import.meta.url), 'utf8')

test('website SEO and Discovery share the same persisted semantic fields', () => {
  for (const field of ['discovery_summary', 'discovery_terms', 'discovery_intents', 'discovery_enabled']) {
    assert.match(siteRoute, new RegExp(field), `admin site route must persist ${field}`)
    assert.match(publicRoute, new RegExp(field), `public site payload must expose ${field}`)
    assert.match(builder, new RegExp(field.replace('_', '-')), `builder must expose ${field}`)
  }
  assert.match(siteRoute, /rawBody\.content && typeof rawBody\.content === 'object'/)
})

test('public site lookup selects real dealership columns while reading discovery from branding', () => {
  const selection = publicRoute.match(/const SITE_COLS = '([^']+)'/)?.[1] || ''
  for (const field of ['discovery_summary', 'discovery_terms', 'discovery_intents', 'discovery_enabled']) {
    assert.doesNotMatch(selection, new RegExp(field), `${field} is a branding key, not a dealerships column`)
    assert.match(publicRoute, new RegExp(`b\\.${field}`), `${field} must still be exposed from branding`)
  }
})

test('published sites expose a machine-readable Discovery document', () => {
  assert.match(publicRoute, /app\.get\('\/site\/:slug\/discovery'/)
  assert.match(publicRoute, /type: 'dealership-discovery'/)
  assert.match(publicRoute, /inventory: vehicles/)
  assert.match(publicRoute, /terms: site\.discovery_terms/)
})

test('the public renderer emits canonical and Discovery schema data from its live payload', () => {
  assert.match(publicSite, /function setCanonical\(url\)/)
  assert.match(publicSite, /function applyDiscoverySchema\(s\)/)
  assert.match(publicSite, /'@type':'AutoDealer'/)
  assert.match(publicSite, /'@type':'ItemList'/)
  assert.match(publicSite, /setDiscoveryAlternate\(s\)/)
  assert.match(publicSite, /applyDiscoverySchema\(s\)/)
})
