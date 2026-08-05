import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FEATURES_BY_PRODUCT } from '../plan-catalog.js'

const catalogUrls = [
  new URL('../../marketplace-frontend/training/catalog.json', import.meta.url),
  new URL('../../marketplace-frontend/training/catalog-expanded.json', import.meta.url),
]
const catalogs = await Promise.all(catalogUrls.map(async url => JSON.parse(await readFile(url, 'utf8'))))
const lessons = catalogs.flatMap(catalog => catalog.lessons || [])
const visualCatalog = JSON.parse(await readFile(new URL('../../marketplace-frontend/training/visuals.json', import.meta.url), 'utf8'))
const visuals = visualCatalog.visuals || {}

test('training academy ships the complete feature recording catalog', () => {
  assert.equal(lessons.length, 108)
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
  assert.ok(lessons.some(lesson => lesson.id === 'PF-009'))
  assert.ok(lessons.some(lesson => lesson.product === 'facebook'))
  assert.ok(lessons.some(lesson => lesson.product === 'ai_dealer'))
  assert.ok(lessons.filter(lesson => lesson.course === 'Accounting for non-accountants').length >= 4)
  assert.ok(lessons.some(lesson => lesson.product === 'marketsync_os'))
})

test('every paid feature has at least one training lesson', () => {
  const covered = new Set(lessons.flatMap(lesson => lesson.features || []))
  for (const feature of Object.values(FEATURES_BY_PRODUCT).flat()) {
    assert.ok(covered.has(feature), `training catalog does not cover ${feature}`)
  }
})

test('academy renders an HTML/CSS visual walkthrough for every lesson', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../../marketplace-frontend/training.html', import.meta.url), 'utf8'),
    readFile(new URL('../../marketplace-frontend/training.js', import.meta.url), 'utf8'),
  ])
  assert.equal(Object.keys(visuals).length, lessons.length)
  assert.deepEqual(new Set(Object.keys(visuals)), new Set(lessons.map(lesson => lesson.id)))
  assert.equal(new Set(Object.values(visuals).map(visual => JSON.stringify(visual))).size, lessons.length, 'every lesson needs a distinct screen blueprint')
  for (const lesson of lessons) {
    const visual = visuals[lesson.id]
    assert.ok(visual.kind && visual.nav && visual.page && visual.title && visual.state, `${lesson.id} visual is incomplete`)
    for (const field of visual.fields || []) {
      assert.match(field, / · /, `${lesson.id} visual field needs a lesson-specific label and value: ${field}`)
    }
  }
  assert.match(html, /training-conversation/)
  assert.match(html, /training-calendar/)
  assert.match(html, /training-builder/)
  assert.match(js, /function lessonVisual\(lesson\)/)
  assert.match(js, /rendered from dashboard HTML\/CSS/)
  assert.match(js, /catalog-expanded\.json/)
  assert.match(js, /visuals\.json/)
})
