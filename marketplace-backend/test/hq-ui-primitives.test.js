/**
 * MarketSync HQ shared UI primitives — contract tests.
 *
 * The primitives are the design system's single source of truth for HQ
 * loading/empty/error/forbidden/not-connected states plus KPI + table
 * shells. These tests assert the module exists, exports the canonical
 * globals, ships light + dark tokens, and is wired into dashboard.html.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = await readFile(
  new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8'
)
const js = await readFile(
  new URL('../../marketplace-frontend/js/modules/hq-ui.js', import.meta.url), 'utf8'
)
const css = await readFile(
  new URL('../../marketplace-frontend/css/hq-ui.css', import.meta.url), 'utf8'
)
const workspace = await readFile(
  new URL('../../marketplace-frontend/js/modules/hq-workspace.js', import.meta.url), 'utf8'
)
const part10 = await readFile(
  new URL('../../marketplace-frontend/js/modules/dashboard-part10.js', import.meta.url), 'utf8'
)

test('hq-ui.js exports the canonical HQ primitive globals', () => {
  for (const sym of ['hqLoading', 'hqEmpty', 'hqError', 'hqForbidden',
                      'hqNotConnected', 'hqPageHeader', 'hqPoweredByRibbon',
                      'hqBadge', 'hqKpi', 'hqTable']) {
    assert.match(js, new RegExp(`window\\.${sym}\\s*=`), `${sym} must be exported on window`)
  }
})

test('hqError auto-detects 401/403 and downgrades to hqForbidden', () => {
  // The error primitive must recognize auth failures relayed by the fetch
  // wrapper and render a forbidden state instead of a generic red error —
  // otherwise a signed-in-but-no-role viewer would see a scary "This page
  // could not load" instead of the correct "no access" message.
  assert.match(js, /const auth = \/401\|403\|forbidden\|unauthorized/i,
    'hqError must detect auth failures')
  assert.match(js, /if \(auth\) return hqForbidden/,
    'hqError must delegate to hqForbidden on auth failures')
})

test('hqKpi renders "Not measured" instead of a fake zero for missing values', () => {
  // Fabricated zeros are the exact violation flagged by the finalization
  // brief: "Never silently convert an API error into zero revenue…"
  assert.match(js, /isMissing\s*=\s*value == null \|\| value === ''/,
    'hqKpi must recognise null/undefined/empty as missing')
  assert.match(js, /const display = isMissing \? 'Not measured'/,
    'hqKpi must display "Not measured" for missing values')
})

test('hqTable renders an explicit empty state instead of an empty tbody', () => {
  assert.match(js, /if \(!Array\.isArray\(rows\) \|\| rows\.length === 0\)/,
    'hqTable must short-circuit on empty rows')
  assert.match(js, /return hqEmpty\(\{/,
    'hqTable empty branch must delegate to hqEmpty')
})

test('HQ UI stylesheet is scoped to HQ owner mode so DealerOS is untouched', () => {
  // Every functional selector must be gated by html[data-dash-owner="1"]
  // — DealerOS explicitly must not be re-styled by the HQ design system.
  const rules = css.match(/^html\[data-dash-owner="1"\][^{]*\{/gm) || []
  assert.ok(rules.length >= 12, `expected at least a dozen HQ-scoped rules, got ${rules.length}`)
  // Custom-property definitions are allowed on :root (they only take effect
  // once :root selectors also referring to hq tokens are used) — but no
  // class-based rule may be unscoped.
  const classRules = [...css.matchAll(/^\.hq-[a-z0-9_-]+[^{]*\{/gm)].map(m => m[0])
  assert.equal(classRules.length, 0,
    `no .hq-* class rule may be unscoped from html[data-dash-owner="1"], found: ${classRules.join(', ')}`)
})

test('HQ UI stylesheet ships light AND dark theme tokens', () => {
  assert.match(css, /:root\s*\{[^}]*--hq-brand:/, ':root must define --hq-brand')
  assert.match(css, /\.dark\s*\{[^}]*--hq-surface:/, '.dark must redefine --hq-surface')
})

test('dashboard.html loads hq-ui.css BEFORE any HQ script consumer', () => {
  assert.match(html, /css\/hq-ui\.css\?v=/, 'hq-ui.css must be linked')
  const cssIdx = html.indexOf('css/hq-ui.css')
  const jsIdx = html.indexOf('js/modules/hq-ui.js')
  const wsIdx = html.indexOf('js/modules/hq-workspace.js')
  assert.ok(cssIdx !== -1 && jsIdx !== -1 && wsIdx !== -1,
    'hq-ui.css, hq-ui.js and hq-workspace.js must all be linked')
  assert.ok(jsIdx < wsIdx,
    'hq-ui.js must load before hq-workspace.js so the primitives are defined')
})

test('HQ minimal loaders consume the shared primitives (Phase 5 state handling)', () => {
  // Every loader that used to render an inline error <div> now must use the
  // shared hqError() so 401/403 auto-downgrades and retry buttons work.
  for (const loader of ['loadHqAudit', 'loadHqSecurity', 'loadHqUsage',
                        'loadHqOnboarding', 'loadHqIntegrations', 'loadHqHealth']) {
    const fn = new RegExp(`async function ${loader}\\([\\s\\S]*?^\\}`, 'm')
    const match = workspace.match(fn)
    assert.ok(match, `${loader} must be defined`)
    assert.match(match[0], /hqPageHeader\(/, `${loader} must render hqPageHeader`)
    assert.match(match[0], /hqLoading\(/, `${loader} must render hqLoading during fetch`)
    assert.match(match[0], /hqError\(/, `${loader} must render hqError on failure`)
  }
})

test('Studio and Website Studio carry the Powered by MarketSync ribbon', () => {
  // The user's finalization brief: studios stay inside HQ + DealerOS AND
  // become standalone products, with a "Powered by MarketSync" mark.
  assert.match(part10, /loadSaasStudio[\s\S]*?hqPoweredByRibbon\(\)/,
    'Design Studio must render the Powered by MarketSync ribbon')
  assert.match(part10, /loadSaasWebsite[\s\S]*?hqPoweredByRibbon\(\)/,
    'Website Studio must render the Powered by MarketSync ribbon')
})
