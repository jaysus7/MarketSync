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

test('the tab loads the studio shell through the one canonical boot chain', () => {
  // studio-shell.js does not stand alone: it needs scene-model, the whole
  // js/design-studio/* set, document-model, studio-store and studio-autosave
  // first. An earlier version of this tab fetched only fabric-adapter +
  // studio-shell, so studio-shell threw while evaluating and the tab reported
  // "Design Studio could not be loaded" every time.
  assert.match(marketing, /function mktEnsureStudioShell/)
  assert.match(marketing, /window\.msLoadDesignStudioShell\(\)/,
    'the tab must delegate to the canonical loader, never assemble its own script list')
  assert.doesNotMatch(marketing, /js\/modules\/studio\/studio-shell\.js\?/,
    'a second copy of the script list here is how this broke; there must be exactly one')

  const loader = read('dashboard-part2.js')
  assert.match(loader, /function msLoadDesignStudioShell/, 'the canonical loader must exist')
  // It has to carry the full prerequisite chain, not just the last two files.
  for (const required of ['scene-model.js', 'design-studio/state/document-schema.js', 'document-model.js', 'studio-autosave.js', 'fabric-adapter.js', 'studio-shell.js']) {
    assert.ok(loader.includes(required), `the canonical loader must load ${required}`)
  }
})

test('the boot chain is defined once, not copied per caller', () => {
  const loader = read('dashboard-part2.js')
  // scene-model.js is the first link in the chain; more than one occurrence
  // means the list has been duplicated again.
  const copies = (loader.match(/js\/modules\/studio\/scene-model\.js/g) || []).length
  assert.equal(copies, 1, 'the Design Studio script list must appear exactly once')
})

test('readiness is probed with a symbol the shell actually defines', () => {
  // window.openMarketSyncStudio is ALWAYS a function — dashboard-part2 assigns
  // ensureOpenMarketSyncStudio to it as a lazy stub — so probing it returns
  // true before anything is loaded and the tab then calls an undefined
  // openStudioSizePicker. Probe a symbol only the real shell defines.
  const fn = marketing.match(/function mktEnsureStudioShell[\s\S]+?\n\}/)?.[0] || ''
  assert.ok(fn, 'mktEnsureStudioShell should exist')
  assert.doesNotMatch(fn, /typeof window\.openMarketSyncStudio === 'function'/,
    'openMarketSyncStudio is a lazy stub and is always defined — probing it short-circuits the load')
  assert.match(fn, /typeof window\.openStudioSizePicker === 'function'/)

  const loader = read('dashboard-part2.js')
  assert.match(loader, /window\.openMarketSyncStudio = window\.ensureOpenMarketSyncStudio/,
    'this test only matters while that stub assignment exists')
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
