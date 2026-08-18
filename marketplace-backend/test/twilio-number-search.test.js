import test from 'node:test'
import assert from 'node:assert/strict'
import { searchNumbers } from '../providers/twilio-provision.js'

// searchNumbers must let a rep find a LOCAL number by province/state + city, not
// just a bare area code — that's the "search by region and city" ask. It maps to
// Twilio's InRegion (2-letter province/state) + InLocality (city) query params.
function withFetch(capture, fn) {
  const prev = global.fetch
  global.fetch = async (url) => { capture.url = String(url); return { ok: true, status: 200, json: async () => ({ available_phone_numbers: [{ phone_number: '+19051234567', friendly_name: '(905) 123-4567', locality: 'Welland', region: 'ON' }] }) } }
  return Promise.resolve(fn()).finally(() => { global.fetch = prev })
}

function withCreds(fn) {
  const p = { TWILIO_MASTER_SID: process.env.TWILIO_MASTER_SID, TWILIO_MASTER_TOKEN: process.env.TWILIO_MASTER_TOKEN }
  process.env.TWILIO_MASTER_SID = 'ACtest'; process.env.TWILIO_MASTER_TOKEN = 'tok'
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(p)) { if (p[k] === undefined) delete process.env[k]; else process.env[k] = p[k] }
  })
}

test('searchNumbers sends InRegion + InLocality (province/state + city) to Twilio', async () => {
  const cap = {}
  await withCreds(() => withFetch(cap, () => searchNumbers({ country: 'CA', region: 'on', city: 'Welland', areaCode: '905' })))
  const q = new URL(cap.url).searchParams
  assert.equal(q.get('InRegion'), 'ON', 'region is upper-cased into InRegion')
  assert.equal(q.get('InLocality'), 'Welland')
  assert.equal(q.get('AreaCode'), '905')
  assert.equal(q.get('SmsEnabled'), 'true')
  assert.match(cap.url, /AvailablePhoneNumbers\/CA\/Local\.json/)
})

test('searchNumbers omits region/city params when not provided (area-code-only still works)', async () => {
  const cap = {}
  const rows = await withCreds(() => withFetch(cap, () => searchNumbers({ country: 'US', areaCode: '416' })))
  const q = new URL(cap.url).searchParams
  assert.equal(q.get('InRegion'), null)
  assert.equal(q.get('InLocality'), null)
  assert.equal(q.get('AreaCode'), '416')
  assert.equal(rows[0].number, '+19051234567')
})
