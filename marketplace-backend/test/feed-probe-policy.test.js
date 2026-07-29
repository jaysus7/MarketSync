import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeFeedProbeUrl, isSafeHttpUrl } from '../feed-probe-policy.js'

test('feed probing rejects loopback, local, and non-HTTP targets', async () => {
  assert.equal(await isSafeFeedProbeUrl('http://127.0.0.1/inventory.json'), false)
  assert.equal(await isSafeFeedProbeUrl('http://localhost/feed.json'), false)
  assert.equal(await isSafeFeedProbeUrl('file:///etc/passwd'), false)
})

test('the shared remote URL policy rejects private IPv4 addresses', async () => {
  assert.equal(await isSafeHttpUrl('http://10.0.0.1/metadata'), false)
  assert.equal(await isSafeHttpUrl('http://169.254.169.254/latest/meta-data'), false)
  assert.equal(await isSafeHttpUrl('http://192.168.1.10/private'), false)
})
