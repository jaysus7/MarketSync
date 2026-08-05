import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FEATURES_BY_PRODUCT } from '../plan-catalog.js'

const catalogUrl = new URL('../../marketplace-frontend/training/catalog.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'))
const lessons = catalog.lessons || []

test('training foundation ships the complete first recording batch', () => {
  assert.equal(lessons.length, 15)
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

