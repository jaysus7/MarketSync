import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ws = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part10.js', import.meta.url), 'utf8')

// Comments describing these rules mention the very things being asserted.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')

test('sizes and collections render without waiting on the template network call', () => {
  const fn = code(ws).match(/async function mktLoadStudioCreativeHome\(\)[\s\S]*?\nwindow\.mktLoadStudioCreativeHome/)?.[0] || ''
  assert.ok(fn, 'the creative home loader must exist')

  // Sizes and collections come from in-bundle constants. They used to sit behind
  // `await loadStudioTemplateCatalog()`, so a slow GET /marketing/studio/templates
  // held the whole panel on its "Loading…" placeholder through the retry budget.
  // Anchor on the SIZES markup itself, not on the first host.innerHTML — the
  // first one is the "could not be loaded" branch above, which would make this
  // ordering check pass no matter where the catalogue call sits.
  const sizesPainted = fn.indexOf('mkt-studio-sizes-heading')
  const catalogue = fn.indexOf('loadStudioTemplateCatalog')
  assert.ok(sizesPainted > -1, 'the sizes section must be rendered')
  assert.ok(catalogue > -1, 'the catalogue must still be loaded')
  assert.ok(catalogue > sizesPainted,
    'the template catalogue must load AFTER sizes and collections are on screen, never before')

  // A catalogue failure costs the templates only.
  assert.match(fn, /catch \(_\) \{[\s\S]*?Templates could not be loaded/,
    'a catalogue failure must leave sizes and collections up')
  assert.match(fn, /mktLoadStudioCreativeHome\(\)/, 'a failure must offer a retry')
})

test('the studio panel can never be stranded on its loading placeholder', () => {
  // Every exit has to replace the placeholder: an unhandled rejection anywhere in
  // the chain previously left "Loading sizes, collections and templates…" up for good.
  assert.match(code(ws), /Promise\.resolve\(mktLoadStudioCreativeHome\(\)\)\.catch\(/,
    'the call site must catch, so a throw cannot strand the placeholder')
  const fn = code(ws).match(/async function mktLoadStudioCreativeHome\(\)[\s\S]*?\nwindow\.mktLoadStudioCreativeHome/)?.[0] || ''
  assert.match(fn, /mktEnsureStudioShell\(\)\.catch\(\(\) => false\)/,
    'a shell that fails to load must resolve to false, not reject')
})

test('a stalled shell load times out instead of hanging forever', () => {
  // msLoadScript and msLoadDesignStudioShell both memoise by key. A request that
  // stalls rather than fails leaves a pending promise cached for the life of the
  // page, so every later attempt awaits the SAME stuck promise — a "Loading…"
  // that reopening the tab cannot clear.
  const fn = code(ws).match(/function mktEnsureStudioShell\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the shell loader must exist')
  assert.match(fn, /Promise\.race\(/, 'the wait must be bounded')
  assert.match(fn, /MKT_STUDIO_SHELL_TIMEOUT_MS/, 'the bound must be a named constant')
  // Both the timeout and the failure path must clear the memo, or "retry" is just
  // another await on the stuck promise.
  assert.equal((fn.match(/window\.__msDesignStudioShellPromise = null/g) || []).length, 2,
    'both the timeout and the catch must discard the memoised promise')
  assert.match(fn, /clearTimeout\(timer\)/, 'the timer must not outlive a successful load')
})

test('a page reached from the workspace tabs does not repeat its own title', () => {
  // hideTitle drops the icon/title/subtitle block but keeps the header's actions,
  // which is what separates it from hideHeader.
  assert.match(code(engine), /eng\.hideTitle \? '' :/, 'renderEngine must support hideTitle')
  assert.match(code(engine), /\$\{titleBlock\}/, 'the header must render through the gated block')
  // The card styling is the point: ms-engine-header carries padding, a border, a
  // glass background and min-height:7rem on mobile. Keeping it with the title gone
  // left an empty box holding only Refresh — the very extra header row hideTitle
  // exists to remove. So the class must be dropped, not just the text.
  assert.match(code(engine),
    /eng\.hideTitle \? 'flex items-center justify-end' : 'ms-engine-header flex items-start justify-between'/,
    'a title-less header must drop the card class, not render an empty card')
  // Actions are NOT part of what hideTitle removes.
  const header = code(engine).match(/const titleBlock = [\s\S]*?<\/div>`\) \+ `/)?.[0] || ''
  assert.match(header, /suiteActions/, 'suite actions must survive hideTitle')
  assert.match(header, /Refresh/, 'Refresh must survive hideTitle')

  assert.match(code(ws), /ENGINES\['marketing-overview'\] = \{[\s\S]{0,400}hideTitle: true/,
    'Marketing reaches its pages through the workspace tab strip, so it opts in')
})
