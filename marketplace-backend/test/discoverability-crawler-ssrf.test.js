import test from 'node:test'
import assert from 'node:assert/strict'

import { assertSafeUrl } from '../services/discoverabilityCrawlerService.js'

async function rejection(url, options) {
  try {
    await assertSafeUrl(url, options)
    return null
  } catch (error) {
    return error.message
  }
}

// These assertions deliberately avoid live DNS so they cannot flake in CI. Passing
// resolveDns:false stops before the lookup, which is enough to prove how the hostname
// itself was classified.

test('an ordinary public hostname is not classified as a private target', async () => {
  // The regression: isPrivateIp() fails closed for anything that is not a valid IP
  // literal, and it was being handed the raw hostname. That made EVERY domain look
  // private, so the crawler could not reach a single real website.
  for (const host of ['https://marketsync.link/', 'https://www.google.com/', 'https://example.com/', 'https://dealer.example.co.uk/']) {
    const message = await rejection(host, { resolveDns: false })
    assert.doesNotMatch(
      message || '',
      /Private or internal crawl targets are blocked/,
      `${host} must not be classified as a private target`
    )
  }
})

test('a hostname is never trusted without DNS verification', async () => {
  const message = await rejection('https://example.com/', { resolveDns: false })
  assert.match(message || '', /cannot be verified without DNS/)
})

test('literal private and loopback addresses stay blocked', async () => {
  for (const url of [
    'https://127.0.0.1/',
    'https://10.0.0.5/',
    'https://192.168.1.1/',
    'https://172.16.0.1/',
    'https://169.254.169.254/',
    'https://[::1]/'
  ]) {
    assert.match(
      (await rejection(url, { resolveDns: false })) || '',
      /Private or internal crawl targets are blocked/,
      `${url} must remain blocked`
    )
  }
})

test('known internal hostnames stay blocked', async () => {
  for (const url of ['https://localhost/', 'https://metadata.google.internal/', 'https://metadata/']) {
    assert.match(
      (await rejection(url, { resolveDns: false })) || '',
      /Private or internal crawl targets are blocked/,
      `${url} must remain blocked`
    )
  }
})

test('non-http schemes and credentialed URLs stay blocked', async () => {
  assert.match((await rejection('file:///etc/passwd', { resolveDns: false })) || '', /http\(s\)/)
  assert.match((await rejection('https://user:pass@example.com/', { resolveDns: false })) || '', /Credentialed/)
})

test('a public IP literal is allowed without DNS', async () => {
  assert.equal(await rejection('https://8.8.8.8/', { resolveDns: false }), null)
})
