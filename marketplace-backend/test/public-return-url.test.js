import test from 'node:test'
import assert from 'node:assert/strict'
import { depositReturnUrl, safePublicReturnBase } from '../public-return-url.js'

const settings = {
  frontendUrl: 'https://marketsync.link',
  siteSlug: 'welland-chev',
  customDomain: 'www.wellandchev.example',
  customDomainVerified: true,
}

test('accepts the hosted site and verified dealer domain as checkout returns', () => {
  assert.equal(
    safePublicReturnBase({ ...settings, rawReturn: 'https://marketsync.link/site.html?d=welland-chev#reserve' }).toString(),
    'https://marketsync.link/site.html?d=welland-chev'
  )
  assert.equal(
    safePublicReturnBase({ ...settings, rawReturn: 'https://www.wellandchev.example/inventory/123?x=1' }).toString(),
    'https://www.wellandchev.example/inventory/123'
  )
})

test('rejects unverified or third-party checkout returns', () => {
  assert.equal(
    safePublicReturnBase({ ...settings, rawReturn: 'https://attacker.example/paid' }).toString(),
    'https://marketsync.link/site.html?d=welland-chev'
  )
  assert.equal(
    safePublicReturnBase({ ...settings, customDomainVerified: false, rawReturn: 'https://www.wellandchev.example/paid' }).toString(),
    'https://marketsync.link/site.html?d=welland-chev'
  )
})

test('adds the payment result without corrupting the hosted site slug', () => {
  const base = safePublicReturnBase({ ...settings, rawReturn: '' })
  assert.equal(depositReturnUrl(base, 'success'), 'https://marketsync.link/site.html?d=welland-chev&deposit=success')
})
