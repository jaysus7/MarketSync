import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../routes/auth.js', import.meta.url), 'utf8')

test('demo-request is a public, rate-limited lead capture route (no auth required, matching /support)', () => {
  const route = auth.match(/app\.post\('\/public\/demo-request'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.notEqual(route, '', 'the /public/demo-request route should exist')
  assert.match(route, /rateLimit\('demo-request', 5, 60 \* 60 \* 1000, \{ email: true \}\)/)
  assert.doesNotMatch(route, /requireAuth/)
  assert.match(route, /valid email address is required/)
  assert.match(route, /from\('demo_requests'\)\s*\n\s*\.insert\(/)
  assert.match(route, /escapeHtml/)
  assert.match(route, /to: 'admin@marketsync\.link'/)
  assert.match(route, /replyTo: email/)
})

test('demo-request migration locks demo_requests down to platform staff only', () => {
  const sql = readFileSync(new URL('../migrations/2026-08-16-demo-requests.sql', import.meta.url), 'utf8')
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /FORCE ROW LEVEL SECURITY/)
  assert.match(sql, /authz\.is_platform_staff\(\)/)
})
