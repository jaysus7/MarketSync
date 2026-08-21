import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getPlan, productsForPlan, featuresForPlan } from '../plan-catalog.js'
import { PRODUCTS, PRODUCT_ROUTES } from '../access-policy.js'

const read = rel => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
const publicConfig = read('marketplace-frontend/js/public-config.js')
const pricing = read('marketplace-frontend/pricing.html')
const registration = read('marketplace-frontend/register.html')
const dashboard = read('marketplace-frontend/dashboard.js')
const migration = read('marketplace-backend/migrations/2026-08-20-identity-verify-product.sql')
const engineUi = read('marketplace-frontend/js/modules/dashboard-part10.js')
const crmUi = read('marketplace-frontend/js/modules/dashboard-part4.js')
const identityRoute = read('marketplace-backend/routes/identity.js')
const crmRoute = read('marketplace-backend/routes/crm.js')

test('Identity Verify is canonical, standalone, and included only in current DealerOS Complete', () => {
  assert.equal(getPlan('identity-verify')?.monthly, 299)
  assert.deepEqual(productsForPlan('identity-verify'), ['marketsync_identity'])
  assert.deepEqual(featuresForPlan('identity-verify'), ['identity.verify', 'identity.reports', 'identity.settings'])
  assert.ok(productsForPlan('dealer-os-complete').includes('marketsync_identity'))
  assert.ok(!productsForPlan('dealer-os-core').includes('marketsync_identity'))
  assert.ok(!productsForPlan('dealer-os-pro').includes('marketsync_identity'))
  assert.ok(PRODUCTS.includes('marketsync_identity'))
  assert.equal(PRODUCT_ROUTES.marketsync_identity, '/identity-verify')
})

test('public catalog, pricing, registration and restricted product navigation agree', () => {
  assert.match(publicConfig, /id: 'identity-verify'[\s\S]*?price: 299/)
  assert.match(pricing, /MarketSync Identity Verify[\s\S]*?\$299/)
  assert.match(registration, /'identity-verify': \{ name: 'MarketSync Identity Verify', price: '\$299 \/ month \+ usage'/)
  assert.match(dashboard, /marketsync_identity: \['crm', 'command'\]/)
  assert.match(dashboard, /marketsync_identity: 'crm'/)
})

test('tracked migration provisions product, features, standalone plan and Complete bundle', () => {
  assert.match(migration, /'marketsync_identity', 'MarketSync Identity Verify'/)
  assert.match(migration, /'identity-verify', 'marketsync_identity'.*29900/)
  assert.match(migration, /'dealer-os-complete', 'marketsync_identity'/)
  for (const feature of ['identity.verify', 'identity.reports', 'identity.settings']) assert.ok(migration.includes(feature))
})

test('shared DealerOS cards and sections use native accessible disclosure controls', () => {
  assert.match(engineUi, /function engCard[\s\S]*?<details open class="group/)
  assert.match(engineUi, /function engSection[\s\S]*?<details open class="group/)
  assert.match(engineUi, /<summary class="list-none cursor-pointer/)
})

test('standalone Identity Verify renders CRM directly instead of recursively routing through DealerOS Sales', () => {
  const loader = crmUi.match(/async function loadCrmPage\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(loader, 'loadCrmPage must exist')
  assert.match(loader, /isIdentityVerifyWorkspace\(\)/)
  assert.match(loader, /if \(!identityOnly && typeof switchPage/)
  assert.match(loader, /await crmLoadContacts\(body\)/)
})

test('standalone Identity Verify has a tenant-scoped scan dashboard backed by canonical customer and credit records', () => {
  assert.match(identityRoute, /app\.get\('\/identity\/dashboard', requireAuth, requireMfa, hasIdentityProduct, requirePermission\('identity\.view'\)/)
  assert.match(identityRoute, /from\('identity_verifications'\)[\s\S]*?\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(identityRoute, /hasPermission\(req, 'fni\.credit_application\.view'\)/)
  assert.match(identityRoute, /document_photo: null/)
  assert.match(crmUi, /function loadIdentityVerifyDashboard\(\)/)
  assert.match(crmUi, /apiGetJson\('\/identity\/dashboard'\)/)
  assert.match(crmUi, /Scan ID \/ add customer/)
  assert.match(crmUi, /Vehicle fit/)
  assert.match(crmUi, /identity_intake: typeof isIdentityVerifyWorkspace/)
  assert.match(crmRoute, /if \(b\.identity_intake === true\)/)
  assert.match(crmRoute, /customer\.identity_intake_matched/)
  assert.match(crmRoute, /existing\[key\] == null \|\| existing\[key\] === ''/)
})
