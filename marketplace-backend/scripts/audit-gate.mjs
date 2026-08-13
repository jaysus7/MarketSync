/**
 * The dependency audit gate.
 *
 * Replaces a bare `npm audit --audit-level=high --omit=dev`. It fails on exactly the
 * same thing — any high or critical advisory in production dependencies — with one
 * addition: an advisory may be ACCEPTED, but only in writing, and only until a date.
 *
 * Why this exists rather than lowering the audit level: `--audit-level=critical` would
 * have silenced this advisory and every future high one with it, including a real one.
 * The gate is worth keeping. What was missing was a way to say "we looked at this
 * specific thing, here is why it does not reach us, and here is when we look again" —
 * without that, the only options are ignore everything or downgrade a production
 * dependency to satisfy a lint.
 *
 * Three rules the allowlist obeys, so it cannot quietly become a dumping ground:
 *
 *   1. Every entry needs a REASON. Not "known issue" — why it does not reach this app.
 *   2. Every entry needs a REVIEW DATE. Past it, the gate fails again and somebody
 *      has to look. An accepted risk with no expiry is a forgotten one.
 *   3. An entry that no longer matches anything is itself an error. A stale exception
 *      is a hole nobody is watching, so it has to be deleted when it stops applying.
 *
 *   node scripts/audit-gate.mjs
 */
import { execFileSync } from 'node:child_process'

// ── Accepted advisories ─────────────────────────────────────────────────────
const ACCEPTED = [
  {
    id: 'GHSA-jmr9-qjv8-65gv',
    package: 'extract-zip',
    review_by: '2026-11-30',
    reason:
      'extract-zip is reached only by @puppeteer/browsers when it DOWNLOADS and unzips a ' +
      'Chromium build. This app never downloads one: puppeteerRenderer.js always supplies an ' +
      'explicit executablePath (@sparticuz/chromium in production, a system Chrome path in ' +
      'dev) and throws rather than falling back to a download, so the extraction path is ' +
      'never executed. There is also no patched extract-zip — 2.0.1 is both the latest and ' +
      'the vulnerable version — so the only remediations are downgrading puppeteer-core to ' +
      '19.8.3 or bumping the puppeteer-core / @sparticuz/chromium pair together. The pair ' +
      'bump is the real fix and needs verifying against a deploy, because CI never launches ' +
      'headless Chrome and would not catch a DevTools protocol mismatch.',
  },
]

const FAIL_ON = new Set(['high', 'critical'])

let raw
try {
  raw = execFileSync('npm', ['audit', '--json', '--omit=dev'], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
} catch (e) {
  // npm audit exits non-zero WHEN IT FINDS SOMETHING, which is the normal case here —
  // the JSON is still on stdout. A genuinely broken run has no parseable output, and
  // that is a failure: an audit that did not run is not an audit that passed.
  raw = e.stdout || ''
  if (!raw.trim()) {
    console.error('✗ npm audit produced no output — the audit did not run.')
    console.error(e.stderr || e.message)
    process.exit(1)
  }
}

let report
try { report = JSON.parse(raw) } catch (e) {
  console.error(`✗ Could not parse npm audit output: ${e.message}`)
  process.exit(1)
}

const vulns = Object.values(report.vulnerabilities || {})
const serious = vulns.filter(v => FAIL_ON.has(v.severity))

// An advisory id can appear under several packages (a transitive chain reports each
// link). Collect ids so an acceptance matches the advisory, not one arm of the tree.
const idsFound = new Set()
for (const v of serious) {
  for (const via of v.via || []) {
    if (typeof via === 'object' && via.url) {
      const m = String(via.url).match(/GHSA-[a-z0-9-]+/i)
      if (m) idsFound.add(m[0])
    }
  }
}

const today = new Date().toISOString().slice(0, 10)
const accepted = new Map(ACCEPTED.map(a => [a.id, a]))

// ── Rule 3: an acceptance that matches nothing is an error ──────────────────
const stale = ACCEPTED.filter(a => !idsFound.has(a.id))
// ── Rule 2: an acceptance past its review date stops working ────────────────
const expired = ACCEPTED.filter(a => idsFound.has(a.id) && a.review_by < today)
// ── Rule 1 is enforced below, on shape ──────────────────────────────────────
const malformed = ACCEPTED.filter(a =>
  !a.id || !a.reason || a.reason.length < 60 || !/^\d{4}-\d{2}-\d{2}$/.test(a.review_by || ''))

const unaccepted = serious.filter(v => {
  const ids = (v.via || [])
    .filter(x => typeof x === 'object' && x.url)
    .map(x => (String(x.url).match(/GHSA-[a-z0-9-]+/i) || [])[0])
    .filter(Boolean)
  // Only a DIRECT advisory can be accepted. A package that is vulnerable purely because
  // it depends on an accepted one is covered; anything with its own unaccepted advisory
  // is not.
  if (!ids.length) return true          // vulnerable via a dependency chain only
  return !ids.every(id => accepted.has(id))
})

// Chain links (no advisory of their own) whose parents are all accepted are not failures.
const realFailures = unaccepted.filter(v =>
  (v.via || []).some(x => typeof x === 'object' && x.url))

console.log(`\nDependency audit · ${vulns.length} advisories, ${serious.length} high/critical\n`)

for (const a of ACCEPTED) {
  const state = !idsFound.has(a.id) ? 'NO LONGER PRESENT'
    : a.review_by < today ? 'REVIEW OVERDUE' : `accepted until ${a.review_by}`
  console.log(`  ${a.id} (${a.package}) — ${state}`)
}

let failed = false

if (malformed.length) {
  failed = true
  console.error(`\n✗ ${malformed.length} acceptance(s) are incomplete. Each needs an id, a real reason and a YYYY-MM-DD review_by:`)
  for (const a of malformed) console.error(`    ${a.id || '(no id)'}`)
}

if (expired.length) {
  failed = true
  console.error(`\n✗ ${expired.length} accepted advisory(ies) are past review. Look again and either fix or re-justify:`)
  for (const a of expired) console.error(`    ${a.id} (${a.package}) — review was due ${a.review_by}`)
}

if (stale.length) {
  failed = true
  console.error(`\n✗ ${stale.length} acceptance(s) no longer match any advisory. Delete them — a stale exception is a hole nobody is watching:`)
  for (const a of stale) console.error(`    ${a.id} (${a.package})`)
}

if (realFailures.length) {
  failed = true
  console.error(`\n✗ ${realFailures.length} unaccepted high/critical advisory(ies):`)
  for (const v of realFailures) {
    const detail = (v.via || []).find(x => typeof x === 'object')
    console.error(`    ${v.name} — ${v.severity}${detail?.title ? ` — ${detail.title}` : ''}`)
    if (detail?.url) console.error(`      ${detail.url}`)
  }
  console.error(`\n  Fix it, or accept it in scripts/audit-gate.mjs with a reason and a review date.`)
}

if (failed) { console.error(''); process.exit(1) }

console.log(`\n✓ No unaccepted high or critical advisories.\n`)
process.exit(0)
