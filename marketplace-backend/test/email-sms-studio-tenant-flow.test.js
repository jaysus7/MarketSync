import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerDealerEmailMarketing } from '../routes/dealer-automation.js'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part18.js', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../routes/dealer-automation.js', import.meta.url), 'utf8')

function registerHandlers() {
  const handlers = new Map()
  const app = {}
  for (const method of ['get', 'post', 'patch', 'delete']) {
    app[method] = (path, ...stack) => handlers.set(`${method.toUpperCase()} ${path}`, stack.at(-1))
  }
  registerDealerEmailMarketing(app)
  return handlers
}

function contactsQuery(input) {
  let rows = input.slice()
  const query = {
    select() { return query },
    eq(field, value) { rows = rows.filter(row => row[field] === value); return query },
    is(field, value) { rows = rows.filter(row => row[field] === value); return query },
    in(field, values) { rows = rows.filter(row => values.includes(row[field])); return query },
    overlaps() { return query },
    not(field) { rows = rows.filter(row => row[field] != null); return query },
    limit() { return query },
    then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
  }
  return query
}

test('Email/SMS Studio exposes the exact five tabs on one canonical engine', () => {
  assert.match(studio, /\['campaigns', 'Campaigns'\][\s\S]*?\['templates', 'Templates'\][\s\S]*?\['audiences', 'Audiences'\][\s\S]*?\['automations', 'Automations'\][\s\S]*?\['performance', 'Results'\]/)
  assert.match(studio, /autoStudioMode\(\)/)
  assert.match(studio, /openEmailSmsBuilder/)
  assert.match(studio, /openVisualWorkflowBuilder/)
})

test('primary panels use tenant APIs and measured persisted results', () => {
  const campaigns = studio.match(/async function loadDealerCampaigns[\s\S]*?window\.loadDealerCampaigns = loadDealerCampaigns/)?.[0] || ''
  const audiences = studio.match(/async function loadTenantAudienceCounts[\s\S]*?window\.loadTenantAudienceCounts = loadTenantAudienceCounts/)?.[0] || ''
  const results = studio.match(/function renderTenantResultsTab[\s\S]*?\n\}/)?.[0] || ''
  assert.match(campaigns, /apiGetJson\('\/dealer\/email\/campaigns'\)/)
  assert.match(audiences, /apiSendJson\('\/dealer\/email\/segment-count', 'POST'/)
  assert.match(results, /recipient_count/)
  assert.match(results, /sent_count/)
  assert.match(results, /remain unavailable until those event sources are connected/)
  assert.doesNotMatch(results, /DEMO_CAMPAIGNS|26,880|\$661k/)
})

test('saved templates preview, apply, edit, and persist SMS-enabled content', () => {
  assert.match(studio, /function previewEmailSmsTemplate/)
  assert.match(studio, /function useEmailSmsTemplate/)
  assert.match(studio, /function editEmailSmsTemplate/)
  assert.match(studio, /apiSendJson\(`\/dealer\/email\/templates\/\$\{existingId\}`, 'PATCH'/)
  assert.match(studio, /apiSendJson\('\/dealer\/email\/templates', 'POST'/)
  assert.match(studio, /sms_enabled: smsEnabled/)
  assert.match(studio, /function communicationTemplatePlainText/)
  assert.match(routes, /body = plainTemplateBody\(body\)/)
  assert.match(routes, /sms_enabled: req\.body\?\.sms_enabled === true/)
  assert.match(routes, /Appointment reminder text[\s\S]*sms_enabled: true/)
})

test('segment resolver counts email and SMS consent inside the requesting tenant', async () => {
  const handler = registerHandlers().get('POST /dealer/email/segment-count')
  assert.equal(typeof handler, 'function')
  const rows = [
    { id: '1', dealership_id: 'dealer-a', deleted_at: null, status: 'active', email: 'one@example.com', phone: '', phone_mobile: '5551', consent_email: true, consent_sms: false, opt_out: false, dnc: false },
    { id: '2', dealership_id: 'dealer-a', deleted_at: null, status: 'working', email: '', phone: '5552', phone_mobile: '', consent_email: false, consent_sms: true, opt_out: false, dnc: false },
    { id: '3', dealership_id: 'dealer-a', deleted_at: null, status: 'lost', email: 'lost@example.com', phone: '5553', consent_email: true, consent_sms: true, opt_out: false, dnc: false },
    { id: '4', dealership_id: 'dealer-b', deleted_at: null, status: 'active', email: 'other@example.com', phone: '5554', consent_email: true, consent_sms: true, opt_out: false, dnc: false },
  ]
  const req = {
    dealershipId: 'dealer-a',
    body: { segment: { key: 'active_leads' } },
    supabase: { from: table => { assert.equal(table, 'contacts'); return contactsQuery(rows) } },
  }
  let status = 200
  let payload
  const res = { status(code) { status = code; return res }, json(value) { payload = value; return res } }
  await handler(req, res)
  assert.equal(status, 200)
  assert.equal(payload.matched, 2)
  assert.equal(payload.email_reachable, 1)
  assert.equal(payload.sms_reachable, 1)
  assert.deepEqual(payload.segment.status, ['new', 'open', 'active', 'working', 'contacted'])
})
