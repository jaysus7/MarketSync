import test from 'node:test'
import assert from 'node:assert/strict'
import { cronAuthorized } from '../cron-auth.js'

test('cron authentication fails closed when no secret is configured', () => {
  assert.equal(cronAuthorized('', ''), false)
  assert.equal(cronAuthorized(undefined, undefined), false)
})

test('cron authentication requires an exact non-empty secret', () => {
  assert.equal(cronAuthorized('correct-secret', 'correct-secret'), true)
  assert.equal(cronAuthorized('wrong-secret', 'correct-secret'), false)
  assert.equal(cronAuthorized('', 'correct-secret'), false)
})
