import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ACADEMY_DEMO_VERSION, ACADEMY_DEMO_WIPE_TABLES, academyDemoEntityId, demoLessonsForAccess, loadAcademyDemoLessons } from '../academy-demo-data.js'
import { featuresForPlan, productsForPlan } from '../plan-catalog.js'

test('Academy demo manifest covers every course in catalog', async () => {
  const lessons = await loadAcademyDemoLessons()
  assert.ok(lessons.length >= 250, 'must load complete training catalog')
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, lessons.length)
  assert.equal(ACADEMY_DEMO_VERSION, '2026.08.11-department-workflows-v3')
})

test('Academy scenario entity IDs are stable unique UUIDs', async () => {
  const lessons = await loadAcademyDemoLessons()
  const ids = lessons.map(lesson => academyDemoEntityId(lesson.id))
  assert.equal(new Set(ids).size, lessons.length)
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(academyDemoEntityId('PF-001'), academyDemoEntityId('PF-001'))
})

test('demo reset clears seeded business data but preserves identity and subscription boundaries', () => {
  const protectedTables = ['dealerships', 'profiles', 'subscriptions', 'organization_memberships', 'user_roles', 'security_events']
  for (const table of protectedTables) assert.ok(!ACADEMY_DEMO_WIPE_TABLES.includes(table), `${table} must never be reset`)
  for (const table of ['contacts', 'inventory', 'listings', 'deals', 'events', 'repair_orders', 'parts', 'ai_conversations', 'commission_plans', 'customer_ownership_tracking']) {
    assert.ok(ACADEMY_DEMO_WIPE_TABLES.includes(table), `${table} demo data should reset`)
  }
})

test('the demo team is canonical employment data, never a frontend-only roster', async () => {
  const route = await readFile(new URL('../routes/demo.js', import.meta.url), 'utf8')
  for (const name of ['Marcus Vance', 'Sarah Jenkins', 'David Miller', 'Elena Rostova']) {
    assert.match(route, new RegExp(name))
  }
  assert.match(route, /from\('staff_members'\)/)
  assert.match(route, /ensureStaffMember\(dealershipId, ownerId/)
  assert.match(route, /from\('staff_status_history'\)/)
})

test('dedicated demo accounts replace the old HQ workspace switch', async () => {
  const [dashboard, middleware, route] = await Promise.all([
    readFile(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../middleware.js', import.meta.url), 'utf8'),
    readFile(new URL('../routes/demo.js', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(middleware, /x-act-demo|resolveDemoDealership|bustDemoDealerCache/)
  assert.match(route, /app\.post\('\/demo\/seed-all'/)
  assert.match(route, /row\.id !== req\.dealershipId/)
  assert.match(route, /productsForPlan/)
  assert.doesNotMatch(route, /from\('subscriptions'\)\.upsert|plan_id:\s*'os_pro'/)
  assert.match(route, /seedAcademyDemoData/)
  assert.match(route, /export async function refreshDedicatedDemoAccounts/)
})

test('server refreshes versioned dedicated demo data after startup', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.match(server, /refreshDedicatedDemoAccounts\(\)/)
  assert.match(server, /startup refresh failed/)
  assert.match(server, /demo_refresh:\s*startupDemoRefresh/)
  assert.match(server, /status:\s*skipped\.length \? 'partial' : 'complete'/)
  assert.match(server, /failures:\s*skipped\.map/)
})

test('demo completion is marked only after every producer succeeds', async () => {
  const source = await readFile(new URL('../academy-demo-data.js', import.meta.url), 'utf8')
  const producer = source.indexOf('const [lessonScenarios, facebookListings, service, ai, business, workflows] = await Promise.all')
  const marker = source.indexOf('await markDemoComplete', producer)
  assert.ok(producer >= 0 && marker > producer)
})

test('demo inventory enters the canonical vehicle lifecycle', async () => {
  const source = await readFile(new URL('../routes/demo.js', import.meta.url), 'utf8')
  assert.match(source, /source: 'manual', status: 'published'/)
  assert.doesNotMatch(source, /source: 'manual', status: 'available'/)
})

test('demo deals cover legal canonical workflow states', async () => {
  const source = await readFile(new URL('../routes/demo.js', import.meta.url), 'utf8')
  for (const state of ['draft', 'quoted', 'deposit_received', 'credit_approved', 'contract_signed', 'delivered']) {
    assert.match(source, new RegExp(`deal_status: '${state}'`))
  }
  assert.doesNotMatch(source, /deal_status: '(?:working|sold)'/)
})

test('lesson scenarios are limited to shared and purchased products', async () => {
  const lessons = await loadAcademyDemoLessons()
  const forPlan = planId => demoLessonsForAccess(lessons, { products: productsForPlan(planId), features: featuresForPlan(planId) })
  const starter = forPlan('os_starter')
  const growth = forPlan('os_growth')
  const pro = forPlan('os_pro')
  const facebook = forPlan('fb_solo')
  const ai = forPlan('ai_standard')
  assert.ok(starter.length > 0 && starter.length < growth.length && growth.length < pro.length)
  assert.ok(facebook.length > 0)
  assert.ok(ai.length > 0)
  for (const lesson of pro) assert.notEqual(lesson.product, 'marketsync_os')
  for (const lesson of starter) assert.ok(!lesson.features?.some(feature => ['os.accounting', 'os.service', 'os.sales'].includes(feature)))
  const source = await readFile(new URL('../academy-demo-data.js', import.meta.url), 'utf8')
  assert.match(source, /products\.has\('facebook'\) \? seedFacebook/)
  assert.match(source, /features\.has\('os\.service'\) \? seedServiceAndParts/)
  assert.match(source, /products\.has\('ai_dealer'\) \? seedAi/)
  assert.match(source, /seed demo equity opportunity/)
})
