import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileGraphToCanonical } from '../routes/automation.js'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part18.js', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../routes/automation.js', import.meta.url), 'utf8')

test('Automations Studio exposes the exact six requested tabs', () => {
  assert.match(studio, /\['automations', 'My Automations'\][\s\S]*?\['workflow-templates', 'Templates'\][\s\S]*?\['triggers', 'Triggers'\][\s\S]*?\['actions', 'Actions'\][\s\S]*?\['connectors', 'Integrations'\][\s\S]*?\['history', 'History'\]/)
})

test('the required practical templates all preview in the canonical visual builder', () => {
  for (const name of [
    'New Lead Follow-Up',
    'Missed Appointment',
    'Unsold Lead',
    'Service Reminder',
    'Lease Maturity',
    'Birthday',
    'Review Request',
    'Vehicle Price Drop',
    'New Inventory Match',
    'Equity Opportunity',
  ]) assert.ok(studio.includes(name), `missing template: ${name}`)
  assert.match(studio, /renderAutomationWorkflowTemplatesTab[\s\S]*?Preview &amp; use[\s\S]*?openVisualWorkflowBuilder/)
})

test('My Automations and write actions operate on tenant campaigns', () => {
  const renderer = studio.match(/function renderAutoAutomationsTab[\s\S]*?function renderAutoWorkflowCard/)?.[0] || ''
  assert.match(renderer, /__autoCfg\.campaigns/)
  assert.doesNotMatch(renderer, /ALL_AUTOMATIONS_CATALOG/)
  assert.match(studio, /apiSendJson\(`\/automation\/campaigns\/\$\{found\.id\}`, 'PUT'/)
  assert.match(studio, /apiSendJson\('\/automation\/campaigns', 'POST'/)
  assert.match(studio, /applyAiRewriteWorkflow[\s\S]*?apiSendJson\(`\/automation\/campaigns\/\$\{found\.id\}`, 'PUT'/)
  assert.match(studio, /apiGetJson\(`\/automation\/workflows\/\$\{encodeURIComponent\(wfKey\)\}`\)/)
  assert.match(studio, /apiSendJson\('\/automation\/workflows', 'POST', payload\)/)
  assert.match(studio, /enforce_valid: true/)
})

test('wired trigger templates compile to canonical engine trigger keys', () => {
  const lead = compileGraphToCanonical({ nodes: [
    { id: 't', type: 'trigger_crm_new_lead', category: 'trigger' },
    { id: 'a', type: 'action_send_sms', category: 'action', config: { message_template: 'Hello' } },
  ], edges: [{ id: 'e', source: 't', target: 'a' }] })
  assert.equal(lead.trigger_event, 'internet_lead')
  assert.equal(lead.trigger_available, true)

  const birthday = compileGraphToCanonical({ nodes: [
    { id: 't', type: 'trigger_customer_birthday', category: 'trigger' },
    { id: 'a', type: 'action_send_sms', category: 'action', config: { message_template: 'Happy birthday' } },
  ], edges: [{ id: 'e', source: 't', target: 'a' }] })
  assert.equal(birthday.trigger_event, 'birthday')
  assert.equal(birthday.trigger_available, true)
})

test('unwired template triggers save honestly inactive and history is tenant evidence', () => {
  const priceDrop = compileGraphToCanonical({ nodes: [
    { id: 't', type: 'trigger_inv_price_changed', category: 'trigger' },
    { id: 'a', type: 'action_send_sms', category: 'action', config: { message_template: 'Price changed' } },
  ], edges: [{ id: 'e', source: 't', target: 'a' }] })
  assert.equal(priceDrop.trigger_event, 'inventory_aged')
  assert.equal(priceDrop.trigger_available, false)
  assert.match(routes, /effectiveIsActive = isActive && compiled\.trigger_available/)
  assert.match(routes, /activation_blocked: isActive && !compiled\.trigger_available/)
  assert.match(routes, /b\.is_active === true && !AVAILABLE_TRIGGERS\.has\(before\.trigger_event\)/)
  assert.match(routes, /from\('scheduled_messages'\)[\s\S]*?eq\('dealership_id', req\.dealershipId\)/)
  assert.match(routes, /from\('contacts'\)[\s\S]*?eq\('dealership_id', req\.dealershipId\)/)
  assert.doesNotMatch(routes.match(/app\.get\('\/automation\/workflows\/:key\/runs'[\s\S]*?\n  \}\)/)?.[0] || '', /Alex Morgan|Generate realistic/)
})
