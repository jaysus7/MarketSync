import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const src = () => readFile(new URL('../routes/owner-admin.js', import.meta.url), 'utf8')

test('HQ owner-admin exposes the command-center APIs', async () => {
  const s = await src()
  for (const route of [
    "app.get('/owner/accounts'",
    "app.post('/owner/dealership/:id/products'",
    "app.post('/owner/dealership/:id/trial'",
    "app.get('/owner/audit'",
    "app.get('/owner/security'",
    "app.get('/owner/usage'",
    "app.get('/owner/health'",
    "app.get('/owner/onboarding'",
    "app.get('/owner/integrations'",
    "app.get('/owner/users'",
    "app.post('/owner/user/:id/role'",
    "app.post('/owner/user/:id/status'",
    "app.post('/owner/support-session'",
    "app.get('/owner/modules/:id'",
    "app.get('/owner/billing'",
    "app.get('/owner/billing/:id'",
    "app.post('/owner/billing/:id/portal'",
    "app.post('/owner/billing/:id/cancel'",
    "app.post('/owner/billing/:id/reactivate'",
    "app.post('/owner/billing/:id/plan'",
    "app.post('/owner/billing/:id/stripe-trial'",
    "app.post('/owner/billing/:id/coupon'",
  ]) {
    assert.match(s, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), route)
  }
})

test('HQ owner mutations require a reason and the owner guard', async () => {
  const s = await src()
  assert.match(s, /if \(!isOwner\(req\)\)/)
  assert.match(s, /reason required/)
  assert.match(s, /Inspect-only support session/)
  assert.doesNotMatch(s, /req\.headers\.authorization.*dealer/, 'must not swap dealer JWTs')
})
