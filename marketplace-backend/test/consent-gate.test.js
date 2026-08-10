import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANNELS } from '../routes/consent.js'

// Phase 6 PR 6.3 — the consent gate.
//
// The rule was already correct. It was written out THREE times in automation.js — the
// dispatch verifier, the birthday sweep and the email sweep — and Phase 6 is about to add
// campaigns, AI follow-up, sales video and social DMs as senders. Three copies is three
// chances for one to drift; the fix is one gate everything calls, not a fourth copy.
//
// Nothing about the decision changes here. What is added is honesty about the BASIS, by
// reading customer_consents — real evidence that nothing had ever read.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const consent = strip(read('routes/consent.js'))
const auto = strip(read('routes/automation.js'))

test('the gate covers the real contact channels', () => {
  assert.deepEqual(CHANNELS, ['email', 'sms', 'phone', 'mail'])
})

// ── The decision is unchanged ───────────────────────────────────────────────

test('the hard stops are exactly the ones automation already applied', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'mayContact must exist')
  assert.match(fn, /if \(c\.opt_out\) return \{ allowed: false/)
  assert.match(fn, /if \(c\.dnc\) return \{ allowed: false/)
  assert.match(fn, /ch === 'sms' && c\.consent_sms === false/)
  assert.match(fn, /ch === 'email' && c\.consent_email === false/)
  // An UNSET flag stays implied consent — the existing default. Tightening it would be a
  // behaviour change nobody asked for, and would silently mute customers.
  assert.doesNotMatch(fn, /consent_sms !== true|consent_email !== true|!c\.consent_email\b/,
    'an unset consent flag must not start blocking')
})

test('a reply pauses automation but does not gag a human', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /c\.automation_paused && !ignorePause/)
  assert.match(fn, /nobody talks over the conversation/)
})

test('consent without a way to reach the customer is not permission to send', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /ch === 'email' && !c\.email/)
  assert.match(fn, /!\(c\.phone_mobile \|\| c\.phone\)/)
})

test('a cross-tenant customer is refused', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /c\.dealership_id !== dealershipId/)
})

// ── The basis is now honest ─────────────────────────────────────────────────

test('express consent is distinguished from implied', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('customer_consents'\)/, 'the evidence record must actually be read')
  assert.match(fn, /basis: 'express'/)
  assert.match(fn, /basis: 'implied'/)
  assert.match(fn, /basis: 'blocked'/)
  // Withdrawn evidence blocks, and an expired record is not live consent.
  assert.match(fn, /status === 'withdrawn' \|\| record\.status === 'denied'/)
  assert.match(fn, /expires_at && new Date\(record\.expires_at\) < new Date\(\)/)
  assert.match(fn, /Express consent has expired/)
})

test('an expired record downgrades the basis rather than silently muting the customer', () => {
  const fn = consent.match(/export async function mayContact[\s\S]*?\n\}\n/)?.[0] || ''
  const expiredBranch = fn.match(/if \(expired\) \{[\s\S]*?\n    \}/)?.[0] || ''
  assert.match(expiredBranch, /allowed: true/, 'lapsed paperwork must not become a silent block')
  assert.match(expiredBranch, /basis: 'implied'/, 'but it must stop counting as express')
})

// ── One gate, adopted everywhere ────────────────────────────────────────────

test('automation no longer decides consent for itself', () => {
  // The three inline copies are gone.
  assert.doesNotMatch(auto, /c\.dnc \|\| c\.opt_out \|\| c\.consent_(sms|email) === false/,
    'the duplicated sweep rule must be gone')
  assert.doesNotMatch(auto, /if \(contact\.opt_out \|\| contact\.dnc\) return \{ action: 'cancel'/,
    'the duplicated dispatch rule must be gone')
  // And each site now calls the gate.
  const calls = [...auto.matchAll(/mayContact\(/g)].length
  assert.ok(calls >= 3, `expected all three senders to call the gate, saw ${calls}`)
})

test('the dispatch verifier still cancels with its established reasons', () => {
  // Downstream code and dashboards read these strings; the gate must not change them.
  const fn = auto.match(/async function verify\(msg, campaign\)[\s\S]*?\n\}\n/)?.[0] || ''
  for (const reason of ['opted_out', 'customer_replied', 'no_sms_consent', 'no_email_consent']) {
    assert.ok(fn.includes(`'${reason}'`), `the cancel reason ${reason} must survive`)
  }
})

test('an inbound STOP reaches both consent models', () => {
  // Writing only the flags would leave the evidence record silent; writing only the record
  // would leave every sender still reading a permissive flag.
  const fn = consent.match(/export async function recordOptOut[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /from\('contacts'\)\.update\(patch\)/)
  assert.match(fn, /from\('customer_consents'\)\.insert/)
  assert.match(fn, /status: 'withdrawn'/)
  assert.match(fn, /patch\.automation_paused = true|automation_paused: true/)
  // And the webhook uses it rather than updating flags by hand.
  assert.match(auto, /recordOptOut\(contact\.dealership_id, contact\.id, \{ channel: 'all', source: 'inbound_webhook' \}\)/)
  assert.doesNotMatch(auto, /update\(\{ opt_out: true, consent_sms: false, automation_paused: true \}\)/,
    'the hand-rolled opt-out update must be gone')
})

test('opting out of one channel does not silently opt out of all', () => {
  const fn = consent.match(/export async function recordOptOut[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(!channel \|\| channel === 'all'\)/)
  assert.match(fn, /else if \(channel === 'sms'\) patch\.consent_sms = false/)
  assert.match(fn, /else if \(channel === 'email'\) patch\.consent_email = false/)
})

// ── Audience checking ───────────────────────────────────────────────────────

test('an audience check reports who was excluded and why', () => {
  const fn = consent.match(/export async function filterContactable[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'filterContactable must exist')
  assert.match(fn, /excluded\.push\(\{ contact_id: id, reason: v\.reason \}\)/,
    'a campaign must be able to say why it is not reaching someone')
  assert.match(fn, /total:/)
})

test('the consent routes are gated on the canonical customer permissions', () => {
  // `crm.*` does not exist in the permission vocabulary; customer.view/edit does.
  assert.match(consent, /requirePermission\('customer\.view'\)/)
  assert.match(consent, /requirePermission\('customer\.edit'\)/)
  const routes = [...consent.matchAll(/app\.(get|post)\('(\/consent[^']*)'[\s\S]*?\n  \}\)/g)]
  assert.ok(routes.length >= 3, `expected the consent routes, saw ${routes.length}`)
  for (const r of routes) {
    assert.match(r[0], /req\.dealershipId/, `${r[2]} must scope to the dealership`)
    assert.match(r[0], /can(View|Edit)/, `${r[2]} must be permission-gated`)
  }
})
