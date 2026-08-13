import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The dependency audit gate.
//
// This file exists because the gate is the kind of thing that decays. The pressure when
// CI is red is always to make the red go away, and the cheapest way to do that is to
// widen the exception until it covers everything. These tests are what makes that
// require a visible, arguable diff.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const gate = read('scripts/audit-gate.mjs')
const ciRaw = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
// Comments legitimately DISCUSS the command this replaced and the option not taken, so
// assert against what the workflow actually executes rather than what it explains.
const ciRuns = ciRaw.split('\n').filter(l => /^\s*(run:|- run:)/.test(l)).join('\n')
const gateCode = gate.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const pkg = JSON.parse(read('package.json'))

test('the gate is what CI actually runs', () => {
  assert.match(ciRuns, /run: node scripts\/audit-gate\.mjs/)
  // The thing it replaced must be gone — two audit steps means one of them is decoration.
  assert.doesNotMatch(ciRuns, /npm audit --audit-level/)
  assert.equal(pkg.scripts['check:audit'], 'node scripts/audit-gate.mjs')
})

test('the bar is unchanged: high and critical still fail', () => {
  assert.match(gateCode, /const FAIL_ON = new Set\(\['high', 'critical'\]\)/)
  // Lowering the level was the alternative, and it would have silenced every future
  // high advisory along with the accepted one.
  assert.doesNotMatch(gateCode, /audit-level=critical/)
  assert.match(gateCode, /--omit=dev/, 'production dependencies are what ship')
})

test('an audit that did not run is not an audit that passed', () => {
  // npm audit exits non-zero when it FINDS something, so a non-zero exit alone cannot
  // be treated as failure — but empty output means the command genuinely broke, and
  // that must fail rather than sail through as "nothing found".
  assert.match(gate, /if \(!raw\.trim\(\)\)/)
  assert.match(gate, /the audit did not run/)
  assert.match(gate, /Could not parse npm audit output/)
})

// ── The three rules that stop the allowlist becoming a dumping ground ────────
test('every acceptance needs a real reason', () => {
  assert.match(gate, /!a\.reason \|\| a\.reason\.length < 60/)
  for (const a of gate.matchAll(/reason:\s*\n?\s*'([\s\S]*?)',\n  \},/g)) {
    assert.ok(a[1].length > 60, 'an acceptance reason must explain why it does not reach us')
  }
})

test('every acceptance expires', () => {
  assert.match(gate, /!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(a\.review_by \|\| ''\)/)
  assert.match(gate, /a\.review_by < today/)
  assert.match(gate, /REVIEW OVERDUE/)
  // An accepted risk with no expiry is a forgotten one.
  const dates = [...gate.matchAll(/review_by: '(\d{4}-\d{2}-\d{2})'/g)].map(m => m[1])
  assert.ok(dates.length, 'at least one acceptance must carry a date')
  for (const d of dates) {
    assert.ok(d > new Date().toISOString().slice(0, 10), `${d} is already in the past`)
  }
})

test('an acceptance that matches nothing is itself an error', () => {
  // A stale exception is a hole nobody is watching, so it has to be deleted rather
  // than left lying around covering some future advisory by accident.
  assert.match(gate, /const stale = ACCEPTED\.filter\(a => !idsFound\.has\(a\.id\)\)/)
  assert.match(gate, /no longer match any advisory/)
})

test('acceptance is per advisory id, not blanket', () => {
  // Accepting a PACKAGE would cover its next advisory too, sight unseen.
  assert.match(gate, /GHSA-\[a-z0-9-\]\+/i, 'matching is on the advisory id')
  assert.match(gate, /ids\.every\(id => accepted\.has\(id\)\)/)
  assert.doesNotMatch(gate, /accepted\.has\(v\.name\)/, 'a package name must never be the key')
  // And anything with no advisory id of its own cannot be accepted at all.
  assert.match(gate, /if \(!ids\.length\) return true/)
})

test('the accepted advisory is justified by something checkable', () => {
  // The claim is that extract-zip is only reached when @puppeteer/browsers DOWNLOADS a
  // browser, and that this app never does. That has to stay true, so pin the thing that
  // makes it true: an executablePath is always supplied.
  const renderer = read('puppeteerRenderer.js')
  assert.match(renderer, /executablePath: cfg\.executablePath/)
  assert.match(renderer, /No local Chrome\/Chromium found/,
    'it must throw rather than fall back to downloading a browser')
  assert.doesNotMatch(renderer, /puppeteer\.launch\(\{\s*\}\)|browserFetcher|\.download\(/,
    'downloading a browser would make the accepted advisory reachable')
})
