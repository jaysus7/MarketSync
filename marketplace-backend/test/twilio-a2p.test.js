import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { twilioA2pConfigured, startDealerA2p, advanceDealerA2p } from '../providers/twilio-a2p.js'

const integrations = readFileSync(new URL('../routes/integrations.js', import.meta.url), 'utf8')

function withEnv(vars, fn) {
  const prev = {}
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k] }
  return Promise.resolve(fn()).finally(() => { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k] } })
}

// Records each Twilio call and replies with a fabricated SID/status.
function mockFetch(calls, statusByPath = {}) {
  const prev = global.fetch
  global.fetch = async (url, opts) => {
    const u = String(url)
    calls.push({ url: u, method: opts?.method || 'GET' })
    let body = { sid: 'SID' + calls.length }
    for (const [frag, extra] of Object.entries(statusByPath)) if (u.includes(frag)) body = { ...body, ...extra }
    return { ok: true, status: 200, json: async () => body }
  }
  return () => { global.fetch = prev }
}

test('twilioA2pConfigured is false without master creds + ISV primary profile — nothing runs, nothing breaks', async () => {
  await withEnv({ TWILIO_MASTER_SID: undefined, TWILIO_MASTER_TOKEN: undefined, TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_ISV_PRIMARY_PROFILE_SID: undefined }, async () => {
    assert.equal(twilioA2pConfigured(), false)
    const r = await startDealerA2p({ profile: { legal_name: 'X', tax_id: '1' } })
    assert.deepEqual(r, { configured: false, state: null }, 'unconfigured start is a no-op, not a throw')
  })
})

test('creds without the ISV primary profile SID are still not configured (the ISV approval is the gate)', async () => {
  await withEnv({ TWILIO_MASTER_SID: 'ACx', TWILIO_MASTER_TOKEN: 'tok', TWILIO_ISV_PRIMARY_PROFILE_SID: undefined }, async () => {
    assert.equal(twilioA2pConfigured(), false)
  })
})

test('when configured, startDealerA2p creates the secondary profile, attaches business + rep + ISV profile, evaluates and submits', async () => {
  const calls = []
  const restore = mockFetch(calls)
  try {
    await withEnv({ TWILIO_MASTER_SID: 'ACx', TWILIO_MASTER_TOKEN: 'tok', TWILIO_ISV_PRIMARY_PROFILE_SID: 'BUprimary' }, async () => {
      const r = await startDealerA2p({ profile: { legal_name: 'Welland Ford', tax_id: '12-3456789', email: 'gm@welland.example', phone: '+19050001111', contact_name: 'Jay Massie', country: 'CA' }, messagingServiceSid: 'MGx' })
      assert.equal(r.configured, true)
      assert.equal(r.state.status, 'in_review')
      assert.equal(r.state.messaging_service_sid, 'MGx')
      assert.ok(r.state.customer_profile_sid)
    })
    const urls = calls.map(c => c.url)
    assert.ok(urls.some(u => u.includes('/CustomerProfiles') && !u.includes('EntityAssignments') && !u.includes('Evaluations')), 'creates a customer profile')
    assert.equal(urls.filter(u => /\/EndUsers$/.test(u)).length, 2, 'creates business + representative end users')
    assert.ok(urls.some(u => u.includes('/EntityAssignments')), 'assigns entities')
    assert.ok(urls.some(u => u.includes('/Evaluations')), 'evaluates the profile')
    // The ISV primary profile SID is one of the objects assigned to the bundle.
    assert.ok(calls.some(c => c.method === 'POST' && c.url.includes('EntityAssignments')), 'entity assignment POSTed')
  } finally { restore() }
})

test('advanceDealerA2p registers the Brand only once the Customer Profile is approved', async () => {
  const calls = []
  // CustomerProfiles GET reports approved; TrustProducts GET reports approved; Brand GET reports APPROVED.
  const restore = mockFetch(calls, { '/CustomerProfiles/': { status: 'twilio-approved' }, '/TrustProducts/': { status: 'twilio-approved' }, '/a2p/BrandRegistrations/': { status: 'APPROVED' }, '/Compliance/Usa2p': { campaign_status: 'VERIFIED' } })
  try {
    await withEnv({ TWILIO_MASTER_SID: 'ACx', TWILIO_MASTER_TOKEN: 'tok', TWILIO_ISV_PRIMARY_PROFILE_SID: 'BUprimary' }, async () => {
      const state = { customer_profile_sid: 'BUx', messaging_service_sid: 'MGx', a2p_trust_bundle_sid: null, brand_sid: null, campaign_sid: null, status: 'in_review' }
      const next = await advanceDealerA2p(state, { profile: { legal_name: 'Welland Ford', company_type: 'private' } })
      assert.ok(next.a2p_trust_bundle_sid, 'creates the A2P trust bundle')
      assert.ok(next.brand_sid, 'registers the brand once the profile is approved')
      assert.ok(next.campaign_sid, 'registers the campaign once the brand is approved')
      assert.equal(next.status, 'active')
    })
    assert.ok(calls.some(c => c.url.includes('/a2p/BrandRegistrations')), 'brand registration called')
    assert.ok(calls.some(c => c.url.includes('/Compliance/Usa2p')), 'campaign registration called')
  } finally { restore() }
})

test('the a2p route drives the real ISV registration, prefills from the dealership record, and exposes a refresh endpoint', () => {
  // Imports the provider and calls it.
  assert.match(integrations, /import \{ twilioA2pConfigured, startDealerA2p, advanceDealerA2p \} from '\.\.\/providers\/twilio-a2p\.js'/)
  const handler = integrations.match(/app\.post\('\/integrations\/twilio\/a2p',[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(handler, 'a2p submit handler exists')
  assert.match(handler, /from\('dealerships'\)/, 'prefills the non-secret fields from the dealership record')
  assert.match(handler, /startDealerA2p\(/, 'kicks off the real registration')
  assert.match(handler, /a2p_registration/, 'persists the registration SIDs/state')
  // The status/advance endpoint.
  assert.match(integrations, /app\.post\('\/integrations\/twilio\/a2p\/refresh'/)
  assert.match(integrations, /advanceDealerA2p\(/)
})
