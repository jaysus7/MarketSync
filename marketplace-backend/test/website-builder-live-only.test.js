import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const builder = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part17.js'), 'utf8')
const site = readFileSync(path.join(FRONTEND, 'site.html'), 'utf8')

// ── One builder, not two ─────────────────────────────────────────────────────
// A second "classic" form-stack editor used to sit behind a localStorage flag, so
// two people on the same account could be looking at completely different editors
// depending on what their browser had cached — and only the live canvas shows the
// real published site while you edit it.
test('the classic builder is gone: no mode flag, no second editor branch', () => {
  assert.doesNotMatch(builder, /__builderMode/,
    'the classic/live mode variable must not come back — there is one builder')
  assert.doesNotMatch(builder, /localStorage\.getItem\(\s*'ms_builder_mode'\s*\)/,
    'nothing may read the old builder-mode flag')
  assert.match(builder, /localStorage\.removeItem\('ms_builder_mode'\)/,
    'clear the stale flag so nobody stays pinned to an editor that no longer exists')
})

test('the Builder tab renders the live canvas unconditionally', () => {
  assert.match(builder, /if \(__wsTab === 'builder'\) \{\s*\n\s*body\.className[^\n]*\n\s*renderLiveBuilder\(body\);/,
    'the builder tab must go straight to renderLiveBuilder with no mode check')
})

// setBuilderMode is still exported: cached dashboard bundles and stale markup call
// it, and an undefined function there throws and leaves the builder half-rendered.
test('setBuilderMode survives as a no-op shim that re-renders the one builder', () => {
  assert.match(builder, /function setBuilderMode\(\)\s*\{/, 'shim must take no mode argument')
  assert.match(builder, /window\.setBuilderMode = setBuilderMode/)
})

// The classic editor owned #ws-palette-container / #ws-insert-hint / #ws-sections.
// Removing it orphaned the handlers that targeted them, which is how the block
// library's category pills and search box came to do nothing in the live builder.
test('no live-builder handler still targets classic-only DOM', () => {
  assert.doesNotMatch(builder, /getElementById\('ws-palette-container'\)/,
    'the palette now lives in the left dock drawer, not a classic-only container')
  assert.match(builder, /id="ws-palette"/, 'the palette needs a stable id the handlers can find')
  assert.match(builder, /id="ws-insert-hint"/, 'the insert hint must exist in the live palette')
})

// A search box that re-renders itself on every keystroke loses focus and the caret
// after each character typed.
test('palette search repaints only the results grid, so the input keeps focus', () => {
  assert.match(builder, /function renderWsPaletteCards\(\)/)
  assert.match(builder, /id="ws-palette-grid"/)
  const fn = builder.slice(builder.indexOf('function setWsPaletteSearch('), builder.indexOf('function setWsPaletteSearch(') + 260)
  assert.match(fn, /getElementById\('ws-palette-grid'\)/,
    'typing must update the card grid, never the whole palette (the input is inside it)')
})

// ── Click any element, edit that element ─────────────────────────────────────
// Selecting the section and leaving the dealer at the top of a long inspector to
// hunt for the matching control is the difference between "works" and "fiddly".
test('the canvas reports which element was clicked, not just which section', () => {
  assert.match(site, /function fx\(k\)\{ return PREVIEW\?` data-ms-field="\$\{k\}"`:''; \}/,
    'fx() tags an element with the setting it renders — preview only')
  assert.match(site, /const fieldEl=e\.target\.closest\('\[data-ms-field\]'\);/)
  assert.match(site, /post\(\{type:'ms-preview-click',index,field\}\)/,
    'the click message must carry the field alongside the section index')
})

test('fx() emits nothing on the published site, so public markup is unchanged', () => {
  // The whole mechanism hangs off PREVIEW; a bare data-ms-field literal in the
  // renderers would ship the editor plumbing to real visitors.
  assert.doesNotMatch(site, /<[a-z0-9]+ data-ms-field="/i,
    'data-ms-field must only ever come from fx(), which is gated on PREVIEW')
})

test('the hero photo is clickable even though the headline block sits on top of it', () => {
  // The photo layer is absolutely positioned BEHIND the copy, so almost every point
  // in the hero hits the content wrapper. Tagging the section itself makes the
  // fallback "change this photo"; closest() still resolves headline/subheadline/
  // button first when one of those is actually hit.
  assert.match(site, /<section class="relative brand2-bg text-white"\$\{fx\('image'\)\}>/,
    'the hero section itself must carry the image field as the fall-through target')
  assert.match(site, /<h1\$\{fx\('headline'\)\}/)
  assert.match(site, /<p\$\{fx\('subheadline'\)\}/)
})

test('clicking an element jumps to that control, and an image opens the picker', () => {
  assert.match(builder, /function selectWsSection\(idx, field\)/)
  assert.match(builder, /if \(field\) focusWsField\(nextIdx, field\)/)
  const fn = builder.slice(builder.indexOf('function focusWsField('), builder.indexOf('function focusWsField(') + 900)
  assert.match(fn, /if \(type === 'image'\) \{[\s\S]*openWsPhotoPicker/,
    '"click the hero image" can only reasonably mean "change this photo"')
  assert.match(fn, /data-ws-field=/, 'text fields are located by the inspector anchor')
  assert.match(builder, /data-ws-field="\$\{key\}"/, 'wsField must emit that anchor')
})

// ── Every page opens with a hero image ───────────────────────────────────────
// psHero only ever set a gradient `bg`, so a site had at most one real photograph
// (Home) and every other page opened on a bare colour wash.
test('psHero ships a real photograph, deterministically', () => {
  assert.match(builder, /const psHero = \([^)]*\) => __psec\('hero', \{[^}]*image: wsHeroPhoto\(h\)/,
    'every hero preset must carry an image')
  const fn = builder.slice(builder.indexOf('function wsHeroPhoto('), builder.indexOf('function wsHeroPhoto(') + 600)
  assert.doesNotMatch(fn, /Math\.random/,
    're-rendering the same preset must not reshuffle the imagery under the dealer')
  assert.match(fn, /replace\('w=900', 'w=1600'\)/,
    'a hero is full-bleed; the library default visibly softens across a desktop hero')
})

test('a brand-new page starts with a hero, from either entry point', () => {
  assert.match(builder, /blank: \{ label: 'Blank page', page: \{[^}]*sections: \[psHero\(/,
    'the Blank preset must still open with a hero')
  assert.match(builder, /function addSitePage\(\)[\s\S]{0,400}?sections: \[psHero\(/,
    'a page added from the Pages list must open with a hero too')
})

test('existing sites backfill a hero on every page that has none', () => {
  const fn = builder.slice(
    builder.indexOf('function ensureEditableWebsiteSections()'),
    builder.indexOf('window.ensureEditableWebsiteSections'))
  assert.match(fn, /templateBuiltinSections\(\)/,
    'the built-in pages (Inventory, Financing, Trade, Team, Contact, Build) shipped with sections: [] and so had no hero')
  assert.match(fn, /for \(const \[k\] of BUILTIN_META\)/)
  assert.match(fn, /for \(const p of \(__sitePages \|\| \[\]\)\)/,
    'dealer-authored pages created before pages carried a hero need one too')
  assert.match(fn, /if \(seeded\) window\.__wsHasUnsavedChanges = true/,
    'seeding is a draft change the dealer still has to save')
})
