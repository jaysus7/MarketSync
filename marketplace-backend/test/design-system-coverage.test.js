import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO = fileURLToPath(new URL('../..', import.meta.url))
const FRONTEND = path.join(REPO, 'marketplace-frontend')
const doc = readFileSync(path.join(REPO, 'docs', 'DESIGN_SYSTEM_ROLLOUT.md'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')
const registry = readFileSync(path.join(FRONTEND, 'js', 'modules', 'workspace-registry.js'), 'utf8')
const dashboard = readFileSync(path.join(FRONTEND, 'dashboard.html'), 'utf8')

// The scope of this work is "every Pulse, every page, every dashboard, every
// role". The predictable failure mode is improving the screens that are easy to
// find and calling the system applied. These tests keep the coverage tables
// honest: a surface cannot be added to the product without appearing in the doc,
// so "not done yet" stays visible instead of becoming "forgotten".

const pulseEngines = (() => {
  const block = part10.slice(part10.indexOf('const pulseEngines = ['))
  return [...block.slice(0, block.indexOf(']')).matchAll(/'([\w-]+)'/g)].map(m => m[1])
})()

test('every Pulse engine appears in the coverage table', () => {
  assert.ok(pulseEngines.length >= 9, `expected the Pulse engine list, got ${pulseEngines.length}`)
  const table = doc.slice(doc.indexOf('## Pulse coverage'), doc.indexOf('## Phases'))
  for (const id of pulseEngines) {
    assert.ok(table.includes(`\`${id}\``),
      `Pulse engine "${id}" is not in the coverage table — a new Pulse must be tracked, not silently skipped`)
  }
})

test('the coverage table lists no Pulse that does not exist', () => {
  const table = doc.slice(doc.indexOf('## Pulse coverage'), doc.indexOf('## Phases'))
  for (const m of table.matchAll(/\| `([\w-]+)`/g)) {
    assert.ok(pulseEngines.includes(m[1]),
      `the table claims coverage for "${m[1]}", which is not a registered Pulse engine`)
  }
})

// A count that has drifted is worse than no count: it invites planning against a
// surface area that no longer exists.
test('the surface inventory matches what is actually in the repo', () => {
  const stated = (label) => {
    const row = doc.match(new RegExp(`\\| ${label} \\| (\\d+) \\|`))
    assert.ok(row, `the inventory must state "${label}"`)
    return Number(row[1])
  }
  const actual = {
    'Pulse engines': pulseEngines.length,
    'Dashboard page containers': new Set(
      [...dashboard.matchAll(/data-page-content="([^"]+)"/g)].map(m => m[1])).size,
    'Public HTML pages': readdirSync(FRONTEND).filter(f => f.endsWith('.html')).length,
    'Roles with distinct navigation': (() => {
      const block = registry.slice(registry.indexOf('MS_ROLE_MOBILE_NAV'))
      return new Set([...block.slice(0, block.indexOf('\n}')).matchAll(/^\s{2}([A-Z_]{3,}):/gm)]
        .map(m => m[1])).size
    })(),
  }
  for (const [label, count] of Object.entries(actual)) {
    assert.equal(stated(label), count,
      `the doc says ${stated(label)} ${label} but the repo has ${count} — refresh the inventory`)
  }
})

// Every role listed must be a real one, or a "covered all roles" claim is empty.
test('the roles named in the doc are roles the registry actually has', () => {
  const roleLine = doc.match(/Roles: ([^.]+)\./)
  assert.ok(roleLine, 'the doc must name the roles it claims to cover')
  let named = 0
  for (const m of roleLine[1].matchAll(/`([A-Z_]+)`/g)) {
    assert.ok(registry.includes(m[1]),
      `the doc claims role "${m[1]}" but the workspace registry does not define it`)
    named++
  }
  assert.ok(named >= 8, `expected every distinct-nav role to be named, found ${named}`)
})

// The invariants section is what stops each session re-deriving the same fixes.
// Losing it is how a settled decision gets quietly reversed.
test('the settled invariants survive', () => {
  const inv = doc.slice(doc.indexOf('## Invariants established'))
  for (const phrase of [
    'Glass is opt-in',
    '300px right-hand operations rail',
    'Media queries add no specificity',
    'Never invent an identity',
    'cascade order',
  ]) {
    assert.ok(inv.includes(phrase), `the invariant "${phrase}" must stay recorded`)
  }
})

// The per-department rule is the whole reason phase 4 is eight audits and not one
// copy-paste. It is the thing most likely to be skipped under time pressure.
test('the doc states that each department Pulse has its own priorities', () => {
  assert.match(doc, /Each department's Pulse has its own important information/,
    'the Dealership Pulse is not a template for the other eight')
  assert.match(doc, /own audit/, 'each Pulse needs its own audit of what comes first')
})
