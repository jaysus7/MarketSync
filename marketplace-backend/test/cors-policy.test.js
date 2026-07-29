import test from 'node:test'
import assert from 'node:assert/strict'
import { corsOriginCheck } from '../cors-policy.js'

function check(origin) {
  return new Promise(resolve => {
    corsOriginCheck(origin, (error, allowed) => resolve({ error, allowed }))
  })
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

test('CORS allows MarketSync and explicitly configured application origins', async () => {
  const prior = process.env.CORS_ALLOWED_ORIGINS
  process.env.CORS_ALLOWED_ORIGINS = 'https://marketsync-staging-site.onrender.com/'
  try {
    assert.deepEqual(await check('https://marketsync.link'), { error: null, allowed: true })
    assert.deepEqual(await check('https://marketsync-staging-site.onrender.com'), { error: null, allowed: true })
  } finally {
    restoreEnv('CORS_ALLOWED_ORIGINS', prior)
  }
})

test('CORS requires each Chrome extension origin to be explicitly configured', async () => {
  const prior = process.env.CORS_ALLOWED_EXTENSION_ORIGINS
  process.env.CORS_ALLOWED_EXTENSION_ORIGINS = 'chrome-extension://marketsync-extension-id'
  try {
    assert.deepEqual(await check('chrome-extension://marketsync-extension-id'), { error: null, allowed: true })
    const blocked = await check('chrome-extension://untrusted-extension-id')
    assert.equal(blocked.allowed, false)
    assert.match(blocked.error?.message || '', /^CORS blocked:/)
  } finally {
    restoreEnv('CORS_ALLOWED_EXTENSION_ORIGINS', prior)
  }
})

test('CORS rejects unapproved browser origins', async () => {
  const blocked = await check('https://untrusted.example')
  assert.equal(blocked.allowed, false)
  assert.match(blocked.error?.message || '', /^CORS blocked:/)
})
