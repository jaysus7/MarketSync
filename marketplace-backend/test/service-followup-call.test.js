import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// "Once an RO is closed, call the customer."
//
// The failure mode this file guards against is the one A19 names: a follow-up that
// exists only as a button on a screen. If the Closed tab draws a "Call customer"
// action and nothing writes a task, then the call happens only when somebody happens
// to open that tab — and the shop believes it has a callback process it does not have.
// So the producer must be the CLOSE itself, server-side.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const eng = strip(read(BE, 'routes/service-engine.js'))
const ws = strip(read(FE, 'js/modules/service-workspace.js'))
const migration = strip(read(BE, 'migrations/2026-08-11-service-close-followup.sql')
  .replace(/^\s*--.*$/gm, ''))

test('closing a repair order is what produces the follow-up call', () => {
  assert.match(eng, /export async function ensureRoFollowUpCall/)
  const close = eng.slice(eng.indexOf('export async function closeRepairOrder'))
  assert.match(close, /await ensureRoFollowUpCall\(dealershipId, ro, \{ userId \}\)/,
    'the close must schedule the call — not the UI that lists closed ROs')
  // The call is written from a real customer on a real RO.
  assert.match(eng, /if \(!ro\?\.contact_id\) return \{ created: false, reason: 'no_customer_on_this_ro' \}/)
  assert.match(eng, /type: 'call'/)
})

test('a follow-up that could not be written never reads as one that was', () => {
  const fn = eng.slice(eng.indexOf('export async function ensureRoFollowUpCall'),
                       eng.indexOf('export async function closeRepairOrder'))
  // Every failure path names itself instead of returning a bare false.
  assert.match(fn, /return \{ created: false, reason: findErr\.message \}/)
  assert.match(fn, /return \{ created: false, reason: error\.message \}/)
  assert.match(fn, /return \{ created: true, task_id: data\.id/)
  // And the outcome reaches the caller rather than being swallowed by the close.
  assert.match(eng, /return \{ \.\.\.ro, status: 'closed'[\s\S]*?follow_up \}/)
  // The advisor is told, including when it did NOT happen.
  assert.match(ws, /Closed, but the follow-up call was NOT scheduled/)
})

test('scheduling the call cannot roll back a financial close', () => {
  const close = eng.slice(eng.indexOf('export async function closeRepairOrder'))
  // It runs after the update + emitEvent, and its rejection is caught.
  assert.ok(close.indexOf('emitEvent(') < close.indexOf('ensureRoFollowUpCall'),
    'the journal event must be emitted before the follow-up is attempted')
  assert.match(close, /ensureRoFollowUpCall\([\s\S]{0,120}?\.catch\(e =>/,
    'a failed task insert must not throw out of the close')
})

test('one open call per repair order, not one per close attempt', () => {
  const fn = eng.slice(eng.indexOf('export async function ensureRoFollowUpCall'),
                       eng.indexOf('export async function closeRepairOrder'))
  assert.match(fn, /\.eq\('repair_order_id', ro\.id\)\.eq\('done', false\)/)
  assert.match(fn, /reason: 'already_scheduled'/)
})

test('the follow-up does not pollute the appointment book', () => {
  // GET /service/appointments selects every crm_tasks row with category='service' and
  // renders it as a booking. A follow-up call filed under that category would appear
  // in the book as an appointment nobody made.
  const fn = eng.slice(eng.indexOf('export async function ensureRoFollowUpCall'),
                       eng.indexOf('export async function closeRepairOrder'))
  assert.match(fn, /category: 'service_followup'/)
  assert.doesNotMatch(fn, /category: 'service'\s*[,}]/)
})

test('the link between task and repair order is a column, not the title text', () => {
  assert.match(migration, /alter table public\.crm_tasks add column if not exists repair_order_id uuid/)
  // Composite FK: tenant isolation, the idiom used across this schema.
  assert.match(migration, /foreign key \(repair_order_id, dealership_id\)\s*references public\.repair_orders \(id, dealership_id\)/)
  assert.match(migration, /unique \(id, dealership_id\)/, 'the composite FK needs its composite target')
  // ON DELETE SET NULL would try to null dealership_id, which is NOT NULL.
  assert.doesNotMatch(migration, /on delete set null/i)
})

test('the Closed list reads the real call state and says when it cannot', () => {
  assert.match(eng, /app\.get\('\/service-engine\/follow-up-calls', requireAuth, canRead/)
  // An unreadable list is an error, not an empty one.
  assert.match(eng, /if \(error\) return res\.status\(500\)\.json\(\{ error: error\.message \}\)/)
  assert.match(ws, /function svcCallFor/)
  assert.match(ws, /if \(d\.followUps == null\) return undefined/,
    'unknown must be distinguishable from "no call on file"')
  assert.match(ws, /Follow-up call unknown/)
  assert.match(ws, /No follow-up call on file/)
})

test('the Service surface completes the call without reaching into CRM', () => {
  // A Service-only dealership has not bought the CRM department (see
  // service-standalone-e2e.test.js), so the workspace completes its own follow-up
  // through a Service route. The underlying row is still an ordinary crm_task and is
  // equally completable from Tasks.
  assert.match(ws, /apiSendJson\(`\/service-engine\/follow-up-calls\/\$\{taskId\}\/complete`, 'POST'/)
  assert.doesNotMatch(ws, /apiSendJson\(`\/crm\//, 'Service must not write through a CRM route')
  assert.match(eng, /app\.post\('\/service-engine\/follow-up-calls\/:id\/complete', requireAuth, canWork/)
  // It completes FOLLOW-UPS, not any task whose id someone happens to hold, and only
  // within the caller's dealership.
  const route = eng.slice(eng.indexOf("app.post('/service-engine/follow-up-calls/:id/complete'"))
    .slice(0, 900)
  assert.match(route, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(route, /\.not\('repair_order_id', 'is', null\)/,
    'the completion must be scoped to rows that are follow-up calls')
  assert.match(ws, /function svcCallbackRow/, 'the callbacks must be workable from My Day')
})
