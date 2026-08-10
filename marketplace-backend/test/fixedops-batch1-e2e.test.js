import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 4 Batch 1 — the end-to-end Service workflow, pinned.
//
// The behaviour itself was proved against the live staging database as one continuous
// fixture (recorded in docs/SESSION_HANDOFF.md). What this file guards is that the
// PIECES the fixture depends on stay wired together: a future refactor that quietly
// removes a link in the chain fails here rather than in a dealership.
//
// Deliberately NOT a re-run of steps 1–5's own assertions. Only the seams.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const eng = strip(read('routes/service-engine.js'))
const svc = strip(read('routes/service.js'))

test('the whole path exists, end to end, as one chain of real transitions', () => {
  // check-in → estimate → authorize → assign → parts → work → QC/ready.
  const links = [
    /export async function checkInAppointment/,          // arrival
    /export async function createEstimate/,              // price it
    /export async function presentEstimate/,             // show the customer
    /export async function recordAuthorization/,         // their decision, as evidence
    /export async function authorizationCoverage/,       // is the CURRENT work covered
    /export async function assignLine/,                  // dispatch
    /export async function requestPart/,                 // demand
    /export async function reservePart/,                 // promise the unit
    /export async function issuePart/,                   // move the stock, once
    /export async function setLineProgress/,             // start / block / complete
    /export async function transitionRepairOrder/,       // every RO state change
  ]
  for (const link of links) assert.match(eng, link, `the workflow is missing a link: ${link}`)
  assert.match(svc, /app\.post\('\/service\/appointments\/:id\/check-in'/, 'the path must start at a real check-in')
})

test('every RO state change in the workflow goes through the one entry point', () => {
  // The failure this catches: a new feature writing status directly and skipping the
  // database's transition graph, its permissions and its reason requirements.
  const directWrites = eng.match(/from\('repair_orders'\)\.update\(\{[^}]*status:/g) || []
  // Only the transition helper, close and reopen may set status — each audited.
  assert.ok(directWrites.length <= 3,
    `status is written directly in ${directWrites.length} places; it belongs in transitionRepairOrder`)
  assert.match(eng, /export const setRoStatus = transitionRepairOrder/)
})

test('stock only ever moves through the single hardened path', () => {
  // Nothing in Service may write a balance itself — not close, not issue, not returns.
  assert.doesNotMatch(eng, /from\('parts'\)\.update\(\{[^}]*qty_on_hand/,
    'qty_on_hand must never be written from application code')
  for (const viaRpc of [/rpc\('service_move_stock'/, /rpc\('service_reserve_part'/, /rpc\('service_issue_part'/]) {
    assert.match(eng, viaRpc, `stock work must go through the database function: ${viaRpc}`)
  }
})

test('the workflow never lets Service invent a second canonical record', () => {
  for (const dup of ['service_customers', 'service_vehicles', 'ro_jobs', 'service_appointments',
                     'service_parts', 'service_payments', 'service_journal']) {
    assert.doesNotMatch(eng, new RegExp(`from\\('${dup}'\\)`), `Service must not own a ${dup} table`)
  }
})
