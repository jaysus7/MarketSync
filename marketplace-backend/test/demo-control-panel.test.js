import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../marketplace-frontend/js/modules/demo-control-panel.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

test('the panel only renders after a successful GET /demo/control — visibility is server-decided, not a client flag', () => {
  assert.match(source, /if \(!res\.ok\) return;/)
  assert.doesNotMatch(source, /localStorage\.getItem\('is_?demo/i, 'must not gate visibility on a client-controlled localStorage flag')
})

test('auth uses the real session token from localStorage, not a hardcoded or demo-only credential', () => {
  assert.match(source, /localStorage\.getItem\('token'\)/)
  assert.doesNotMatch(source, /Bearer\s+['"][a-zA-Z0-9._-]{10,}['"]/, 'must not hardcode a bearer token')
})

test('package/role switches reload the page so every module re-reads fresh entitlements', () => {
  for (const fn of ['switchAndReload']) assert.match(source, new RegExp(fn))
  const switchFn = source.match(/async function switchAndReload[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.match(switchFn, /location\.reload\(\)/)
  assert.match(source, /switchAndReload\('\/demo\/control\/package', \{ packageId: e\.target\.value \}\)/)
  assert.match(source, /switchAndReload\('\/demo\/control\/role', \{ roleKey: e\.target\.value \}\)/)
})

test('department switching is instant client-side navigation, no reload, no backend round-trip', () => {
  const handler = source.match(/dcp-department'\)\.addEventListener\('change', \(e\) => \{[\s\S]*?\n {4}\}\);/)?.[0] || ''
  assert.match(handler, /switchPage\(e\.target\.value\)/)
  assert.doesNotMatch(handler, /apiCall|fetch\(/)
})

test('reset requires an explicit confirmation before wiping demo data', () => {
  const handler = source.match(/dcp-reset'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?\n {4}\}\);/)?.[0] || ''
  assert.match(handler, /confirm\(/)
  assert.match(handler, /\/demo\/control\/reset/)
})

test('the panel actually hides when closed — an ID selector setting display cannot silently beat the [hidden] attribute', () => {
  // #demo-control-panel sets its own `display` (needed to lay out its contents),
  // which — as plain author CSS — always wins over the browser's native
  // `[hidden] { display: none }` UA rule regardless of specificity math, because
  // UA-origin rules are the lowest tier of the cascade. Setting panel.hidden via
  // JS (close button, badge toggle, outside click) then does nothing unless a
  // rule for #demo-control-panel[hidden] exists to explicitly hide it again.
  const panelBlockMatch = css.match(/#demo-control-panel\s*\{[^}]*\}/)
  assert.ok(panelBlockMatch, '#demo-control-panel rule must exist')
  assert.match(panelBlockMatch[0], /display:\s*flex/, 'sanity check: the panel sets its own display')
  assert.match(css, /#demo-control-panel\[hidden\]\s*\{\s*display:\s*none;?\s*\}/,
    'a #demo-control-panel[hidden] rule must force display:none, or closing the panel silently does nothing')
})

test('every requested department maps to a real workspace-registry page id', () => {
  const registry = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')
  const deptMatch = source.match(/const DEPARTMENTS = \[([\s\S]*?)\];/)
  assert.ok(deptMatch)
  const pageIds = [...deptMatch[1].matchAll(/page: '([a-z-]+)'/g)].map(m => m[1])
  assert.equal(pageIds.length, 12)
  for (const id of pageIds) assert.ok(registry.includes(`page: '${id}'`), `DEPARTMENTS references a page not in the workspace registry: ${id}`)
})
