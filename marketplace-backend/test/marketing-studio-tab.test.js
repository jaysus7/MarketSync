import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const MODULES = new URL('../../marketplace-frontend/js/modules/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, MODULES), 'utf8')

const marketing = read('marketing-workspace.js')
const studioShell = read('studio/studio-shell.js')

// Every function the Studio tab's markup calls must actually exist. The tab
// shipped calling mktOpenStudioSizePicker() and mktLoadStudioCreativeHome(),
// neither of which was ever written: both "Create design" buttons were inert
// and the formats panel sat on "Loading…" forever.
test('every mkt* handler the Studio tab calls is defined', () => {
  const called = new Set([...marketing.matchAll(/onclick="(mkt[A-Za-z0-9_]+)\(/g)].map((m) => m[1]))
  called.add('mktLoadStudioCreativeHome')   // called directly, not via onclick
  assert.ok(called.size > 0, 'the Studio tab should wire some handlers')

  for (const fn of called) {
    const defined = new RegExp(`(async\\s+)?function\\s+${fn}\\s*\\(|window\\.${fn}\\s*=`).test(marketing)
    assert.ok(defined, `${fn}() is called from marketing-workspace.js but never defined there`)
  }
})

test('the Studio tab does not stack a second header on the page header', () => {
  const tab = marketing.match(/studio\(body, d\) \{[\s\S]+?\n    \},/)?.[0]
  assert.ok(tab, 'the studio tab renderer should exist')
  // Scan rendered markup only. This tab documents the removed band in an HTML
  // comment, and a comment naming a band is not a band.
  const rendered = tab.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '')
  // marketing-overview already paints a page header + tab strip above this
  // body. A suite band here put a second "Design Studio" header under it.
  assert.doesNotMatch(
    rendered, /mktSuiteBand\(/,
    'the Studio tab must not render a suite band — the engine header is already above it'
  )
  // The action the band carried must survive somewhere on the tab.
  assert.match(marketing, /onclick="mktOpenStudioSizePicker\(\)"/, 'Create design must still be reachable')
})

test('sizes, collections and templates all render from the studio shell', () => {
  // One source of truth: the tab calls the shell's own renderers rather than
  // copying the format list, so the two surfaces cannot drift apart.
  for (const fn of ['renderStudioHomeFormatShortcuts', 'renderStudioHomeDesignSets', 'studioHomeTemplateCards']) {
    assert.match(marketing, new RegExp(`window\\.${fn}`), `the tab should render via ${fn}()`)
    assert.match(studioShell, new RegExp(`function ${fn}\\s*\\(`), `${fn}() should live in the studio shell`)
  }
  // The template grid keeps the shell's ids so the shell's filter handlers keep
  // working when they run from this tab.
  assert.match(marketing, /id="studio-home-template-grid"/)
  assert.match(marketing, /id="studio-home-templates"/)
})

test('the constants the tab reads are exposed on window', () => {
  // studio-shell.js is a classic script, so its top-level `function`
  // declarations are globals automatically — but `const` declarations are not.
  for (const name of ['STUDIO_SOCIAL_FORMATS', 'STUDIO_FORMAT_GROUPS']) {
    assert.match(studioShell, new RegExp(`^const ${name}`, 'm'), `${name} should be declared in the shell`)
    assert.match(studioShell, new RegExp(`window\\.${name}\\s*=\\s*${name}`), `${name} must be exposed for the Marketing tab`)
  }
})

test('the tab loads the studio shell before using it, at the shipped version', () => {
  // studio-shell.js is lazily loaded; on this tab it usually has not been
  // fetched yet, which is why the tab needs wrappers rather than direct calls.
  assert.match(marketing, /function mktEnsureStudioShell/)
  assert.match(marketing, /msLoadScript/)

  // The URLs must match the ones dashboard-part2.js uses exactly: msLoadScript
  // dedupes by src string, so a different cache-bust would fetch the shell a
  // second time and re-run it.
  const loader = read('dashboard-part2.js')
  for (const file of ['fabric-adapter', 'studio-shell']) {
    const url = marketing.match(new RegExp(`js/modules/studio/${file}\\.js\\?v=[A-Za-z0-9_]+`))?.[0]
    assert.ok(url, `the tab should reference ${file}.js with a cache-bust`)
    assert.ok(loader.includes(url), `${url} must match the URL dashboard-part2.js loads, or the shell loads twice`)
  }
})

test('choosing a size opens the full-screen editor, not an in-tab canvas', () => {
  // Product decision: browsing lives in the Marketing dashboard, the canvas
  // editor is full screen. The shell's size cards call startStudioBlankDesign,
  // which opens the modal editor.
  assert.match(studioShell, /function startStudioBlankDesign\(formatKey\)/)
  assert.match(studioShell, /openMarketSyncStudio\(null, \{ formatKey, bypassHome: true/)
})

test('a shell that fails to load says so instead of spinning forever', () => {
  assert.match(marketing, /could not be loaded/i, 'the tab must render an explicit failure state')
  assert.doesNotMatch(
    marketing, /Loading formats, design sets, and matching templates…/,
    'the old permanent placeholder should be gone'
  )
})
