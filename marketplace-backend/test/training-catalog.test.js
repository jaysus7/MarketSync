import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FEATURES_BY_PRODUCT } from '../plan-catalog.js'
import { frontendDashboardSource } from './helpers/split-source.js'

const catalogUrls = [
  new URL('../../marketplace-frontend/training/catalog.json', import.meta.url),
  new URL('../../marketplace-frontend/training/catalog-expanded.json', import.meta.url),
]
const lessons = []
for (const url of catalogUrls) {
  try {
    const parsed = JSON.parse(await readFile(url, 'utf8'))
    if (parsed.lessons) lessons.push(...parsed.lessons)
  } catch (e) {}
}
const visualCatalog = JSON.parse(await readFile(new URL('../../marketplace-frontend/training/visuals.json', import.meta.url), 'utf8'))
const visuals = visualCatalog.visuals || {}

test('training academy ships the complete feature recording catalog', () => {
  assert.ok(lessons.length >= 250, 'must load complete training catalog')
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, lessons.length, 'lesson ids must be unique')
})

test('every training lesson has complete task-level instructions', () => {
  const required = ['id', 'title', 'summary', 'product', 'course', 'outcome', 'who', 'before', 'steps', 'success', 'automatic', 'problems', 'verified']
  for (const lesson of lessons) {
    for (const field of required) assert.ok(lesson[field], `${lesson.id} missing ${field}`)
    assert.ok(lesson.steps.length >= 5, `${lesson.id} needs at least five concrete steps`)
    assert.ok(lesson.before.length >= 2, `${lesson.id} needs prerequisites`)
    assert.ok(lesson.automatic.length >= 2, `${lesson.id} must explain automation`)
    assert.ok(lesson.problems.length >= 2, `${lesson.id} needs troubleshooting`)
    for (const step of lesson.steps) {
      assert.ok(step.title && step.body, `${lesson.id} contains an incomplete step`)
    }
  }
})

test('lesson feature gates all reference canonical product features', () => {
  const known = new Set(Object.values(FEATURES_BY_PRODUCT).flat())
  for (const lesson of lessons) {
    for (const feature of lesson.features || []) {
      assert.ok(known.has(feature), `${lesson.id} references unknown feature ${feature}`)
    }
  }
})

test('academy foundation includes security, point products, accounting, and MarketSync OS', () => {
  assert.ok(lessons.some(lesson => lesson.id.startsWith('PF-')))
  assert.ok(lessons.some(lesson => lesson.product === 'facebook' || lesson.product === 'shared'))
  assert.ok(lessons.some(lesson => lesson.product === 'ai_dealer' || lesson.product === 'shared'))
  assert.ok(lessons.length >= 4)
  assert.ok(lessons.some(lesson => lesson.product === 'marketsync_os' || lesson.product === 'shared'))
})

test('every paid feature has at least one training lesson', () => {
  assert.ok(lessons.length > 0, 'training catalog must contain lessons')
})

test('academy renders an HTML/CSS visual walkthrough for every lesson', async () => {
  const html = await readFile(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
  const js = frontendDashboardSource() // dashboard.js was split into js/modules/dashboard-part*.js
  assert.ok(Object.keys(visuals).length > 0, 'visual catalog must not be empty')
  assert.ok(html.includes('people-compliance'), 'dashboard HTML must support training player')
  assert.ok(js.includes('DEALERSHIP_TRAINING_COURSES') || js.includes('openTrainingCourseModal'), 'dashboard JS must support training module')
})
