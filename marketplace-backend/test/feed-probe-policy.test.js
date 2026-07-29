import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeFeedProbeUrl } from '../feed-probe-policy.js'

test('feed probing rejects loopback, local, and non-HTTP targets', async () => {
  assert.equal(await isSafeFeedProbeUrl('http://127.0.0.1/inventory.json'), false)
  assert.equal(await isSafeFeedProbeUrl('http://localhost/feed.json'), false)
  assert.equal(await isSafeFeedProbeUrl('file:///etc/passwd'), false)
})
