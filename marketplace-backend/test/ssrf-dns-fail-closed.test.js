import test from 'node:test'
import assert from 'node:assert/strict'
import { isDisallowedIp, validateOutboundUrl, safeOutboundFetch } from '../outbound-http-policy.js'

test('SSRF Protection: Direct loopback, metadata, and private IP URLs are blocked', async () => {
  // localhost
  const localhostCheck = await validateOutboundUrl('http://localhost:3000/api')
  assert.equal(localhostCheck.ok, false)
  assert.equal(localhostCheck.error, 'DISALLOWED_HOST')

  // 127.0.0.1
  const loopbackV4Check = await validateOutboundUrl('http://127.0.0.1/status')
  assert.equal(loopbackV4Check.ok, false)
  assert.equal(loopbackV4Check.error, 'DISALLOWED_IP')

  // ::1
  const loopbackV6Check = await validateOutboundUrl('http://[::1]:8080/metrics')
  assert.equal(loopbackV6Check.ok, false)
  assert.equal(loopbackV6Check.error, 'DISALLOWED_IP')

  // 169.254.169.254 (Cloud metadata)
  const metadataCheck = await validateOutboundUrl('http://169.254.169.254/latest/meta-data/')
  assert.equal(metadataCheck.ok, false)
  assert.ok(['DISALLOWED_IP', 'DISALLOWED_HOST'].includes(metadataCheck.error))
})

test('SSRF Protection: DNS resolution failure (NXDOMAIN / ENOTFOUND) fails closed', async () => {
  // Mock NXDOMAIN DNS lookup failure
  const mockNxDomainLookup = async () => {
    const err = new Error('getaddrinfo ENOTFOUND nxdomain.invalid')
    err.code = 'ENOTFOUND'
    throw err
  }

  const result = await validateOutboundUrl('https://nxdomain.invalid/webhook', {
    dnsLookup: mockNxDomainLookup
  })

  assert.equal(result.ok, false, 'NXDOMAIN must be blocked')
  assert.equal(result.error, 'DNS_LOOKUP_FAILED')
})

test('SSRF Protection: Hostname resolving to zero DNS records fails closed', async () => {
  const mockEmptyLookup = async () => []

  const result = await validateOutboundUrl('https://empty-records.example.com/webhook', {
    dnsLookup: mockEmptyLookup
  })

  assert.equal(result.ok, false, 'Zero DNS records must be blocked')
  assert.equal(result.error, 'DNS_NO_RECORDS')
})

test('SSRF Protection: Hostname resolving to a private IP is blocked', async () => {
  const mockPrivateLookup = async () => [
    { address: '10.0.4.12', family: 4 }
  ]

  const result = await validateOutboundUrl('https://internal-service.example.com/api', {
    dnsLookup: mockPrivateLookup
  })

  assert.equal(result.ok, false, 'Private DNS result must be blocked')
  assert.equal(result.error, 'DISALLOWED_IP')
  assert.equal(result.address, '10.0.4.12')
})

test('SSRF Protection: Hostname resolving to mixed public and private IPs is blocked', async () => {
  const mockMixedLookup = async () => [
    { address: '93.184.216.34', family: 4 }, // public IP
    { address: '127.0.0.1', family: 4 }       // private loopback IP
  ]

  const result = await validateOutboundUrl('https://mixed-resolution.example.com/data', {
    dnsLookup: mockMixedLookup
  })

  assert.equal(result.ok, false, 'Mixed public+private DNS results must be blocked')
  assert.equal(result.error, 'DISALLOWED_IP')
  assert.equal(result.address, '127.0.0.1')
})

test('SSRF Protection: Safe public hostname resolving to public IPs passes validation', async () => {
  const mockPublicLookup = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
  ]

  const result = await validateOutboundUrl('https://safe-public.example.com/feed', {
    dnsLookup: mockPublicLookup
  })

  assert.equal(result.ok, true, 'Safe public URL must pass validation')
  assert.equal(result.hostname, 'safe-public.example.com')
  assert.equal(result.addresses?.length, 2)
})

test('SSRF Protection: safeOutboundFetch rejects redirect hopping to private host', async () => {
  // Mock global fetch to simulate a 302 redirect from public to private IP
  const origFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url, opts) => {
      if (url.includes('initial-public.example.com')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://169.254.169.254/latest/meta-data/' }
        })
      }
      return new Response('ok', { status: 200 })
    }

    const mockLookup = async (host) => {
      if (host === 'initial-public.example.com') {
        return [{ address: '93.184.216.34', family: 4 }]
      }
      return [{ address: '169.254.169.254', family: 4 }]
    }

    await assert.rejects(
      async () => {
        await safeOutboundFetch('https://initial-public.example.com/start', {
          dnsLookup: mockLookup
        })
      },
      /Outbound request blocked by security policy/
    )
  } finally {
    globalThis.fetch = origFetch
  }
})

test('SSRF Protection: Suffixes and cloud metadata variants are rejected', async () => {
  for (const host of [
    'http://server.local',
    'http://app.internal',
    'http://router.lan',
    'http://node.home',
    'http://metadata.google.internal/computeMetadata/v1/'
  ]) {
    const res = await validateOutboundUrl(host)
    assert.equal(res.ok, false, `Must reject ${host}`)
  }
})
