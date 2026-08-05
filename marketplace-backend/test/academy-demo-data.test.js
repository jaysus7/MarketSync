import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ACADEMY_DEMO_VERSION, ACADEMY_DEMO_WIPE_TABLES, academyDemoEntityId, demoLessonsForAccess, loadAcademyDemoLessons } from '../academy-demo-data.js'
import { featuresForPlan, productsForPlan } from '../plan-catalog.js'

test('Academy demo manifest covers every one of the 272 courses', async () => {
  const lessons = await loadAcademyDemoLessons()
  assert.equal(lessons.length, 272)
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, 272)
  assert.equal(ACADEMY_DEMO_VERSION, '2026.08.05-dedicated-accounts-v1')
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
  for (const table of ['contacts', 'inventory', 'listings', 'deals', 'events', 'repair_orders', 'parts', 'ai_conversations', 'commission_plans']) {
    assert.ok(ACADEMY_DEMO_WIPE_TABLES.includes(table), `${table} demo data should reset`)
  }
})

test('dedicated demo accounts replace the old HQ workspace switch', async () => {
  const [dashboard, middleware, route] = await Promise.all([
    readFile(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../middleware.js', import.meta.url), 'utf8'),
    readFile(new URL('../routes/demo.js', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(dashboard, /X-Act-Demo|setDashMode\(|ms_dash_mode/)
  assert.doesNotMatch(middleware, /x-act-demo|resolveDemoDealership|bustDemoDealerCache/)
  assert.match(dashboard, /apiSendJson\('\/demo\/seed-all'/)
  assert.match(dashboard, /data-demo-account/)
  assert.match(route, /app\.post\('\/demo\/seed-all'/)
  assert.match(route, /row\.id !== req\.dealershipId/)
  assert.match(route, /productsForPlan/)
  assert.doesNotMatch(route, /from\('subscriptions'\)\.upsert|plan_id:\s*'os_pro'/)
  assert.match(route, /seedAcademyDemoData/)
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
})
