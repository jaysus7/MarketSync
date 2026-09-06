import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'
import { assetVersion, RELEASE_VERSION } from './helpers/asset-versions.js'

const FRONTEND = new URL('../../marketplace-frontend/', import.meta.url)
const read = path => readFileSync(new URL(path, FRONTEND), 'utf8')

const shell = read('js/modules/studio/studio-shell.js')
const shellCode = stripComments(shell)
const loader = read('js/modules/dashboard-part2.js')
const theme = read('css/marketsync-theme.css')

// Runs the shell's real catalogue-addressing functions against a stand-in
// window carrying the real factory, so the assertions below exercise shipped
// code rather than a restatement of it.
function loadCatalogueAccess() {
  const sandbox = {}
  new Function('window', read('js/modules/studio/studio-template-factory.js'))(sandbox)
  new Function('window', read('js/modules/studio/studio-template-imagery.js'))(sandbox)
  const formats = shell.match(/const STUDIO_SOCIAL_FORMATS = \{[\s\S]*?\n\};/)[0]
  const from = shell.indexOf('function studioTemplateFactory()')
  const to = shell.indexOf('function studioWarmTemplateImagery()')
  assert.ok(from > 0 && to > from, 'studio-shell.js must define the generated-catalogue accessors')
  const body = shell.slice(from, to)
  // The stub carries a hand-written entry so a fallback to one is detectable.
  // With an empty catalogue, "unknown key returns null" and "unknown key
  // silently returns some other design" look identical.
  return new Function('window', `
    const STUDIO_TEMPLATES_CATALOG = { tmpl_spotlight_square: { template_key: 'tmpl_spotlight_square', format_key: 'square', scene: { width: 1080, height: 1080, elements: [] } } };
    ${formats}
    ${body}
    return { studioTemplate, studioGeneratedKey, studioGeneratedDescriptors, studioGeneratedTotal, STUDIO_SOCIAL_FORMATS };
  `)(sandbox)
}

const access = loadCatalogueAccess()

test('a template thumbnail carries its own container-query container', () => {
  // Thumbnail type is sized in `cqw` — a share of the CONTAINER's width — which
  // is the only way one blob of markup renders a 1080px design correctly at any
  // card size. `cqw` with no container above it does not fail loudly: it
  // silently resolves against the viewport. The only rule declaring one was
  // scoped to #ms-studio-master-modal, so thumbnails were right inside the
  // Studio and several times too large on the Marketing tab, where the same
  // cards render with no modal around them — headlines ran straight off their
  // own artboards. Inlining it puts the container where the markup is.
  const markup = shellCode.slice(shellCode.indexOf('function templatePreviewMarkup'))
  const returned = markup.slice(markup.indexOf('return `<div class="studio-template-preview"'))
  assert.match(returned.slice(0, 200), /container-type:inline-size/,
    'templatePreviewMarkup must inline container-type on the preview element')
})

test('the thumbnail stylesheet rule is not scoped to the Studio modal', () => {
  const rule = theme.match(/^[^\n]*\.studio-template-preview \{[^}]*container-type[^}]*\}/m)
  assert.ok(rule, 'marketsync-theme.css must declare a container on .studio-template-preview')
  assert.ok(!rule[0].includes('#ms-studio-master-modal'),
    'scoping the container to the Studio modal leaves the Marketing tab sizing thumbnails against the viewport')
})

test('a generated key addresses one design, including sizes whose names carry digits', () => {
  for (const [key, formatKey, index] of [
    ['auto_square_0', 'square', 0],
    ['auto_story_999', 'story', 999],
    ['auto_display_300x250_17', 'display_300x250', 17],
    ['auto_display_728x90_5', 'display_728x90', 5],
    ['auto_business_card_42', 'business_card', 42]
  ]) {
    const parsed = access.studioGeneratedKey(key)
    assert.ok(parsed, `${key} did not parse`)
    assert.equal(parsed.formatKey, formatKey)
    assert.equal(parsed.index, index)
  }
  for (const bad of ['auto_square', 'auto_not_a_size_3', 'tmpl_spotlight_square', '', null]) {
    assert.equal(access.studioGeneratedKey(bad), null, `${bad} should not resolve to a design`)
  }
})

test('an unknown template key resolves to nothing, not to a different design', () => {
  // Returning a stand-in would open some other design behind the one the user
  // tapped, with no indication anything went wrong.
  assert.equal(access.studioTemplate('auto_square_notanumber'), null)
  assert.equal(access.studioTemplate('made_up_key'), null)
  // A hand-written template is still reachable by its own key — the null above
  // is "this key names nothing", not "lookups are broken".
  assert.equal(access.studioTemplate('tmpl_spotlight_square').template_key, 'tmpl_spotlight_square')
  const real = access.studioTemplate('auto_square_12')
  assert.ok(real && real.scene && real.scene.elements.length, 'a valid key must build a scene')
  assert.equal(real.format_key, 'square')
})

test('listing pages the catalogue instead of building all of it', () => {
  const page = access.studioGeneratedDescriptors('', 'square', 0, 24)
  assert.equal(page.length, 24)
  assert.equal(new Set(page.map(d => d.template_key)).size, 24)
  const second = access.studioGeneratedDescriptors('', 'square', 24, 24)
  assert.equal(second.length, 24)
  assert.equal(page.filter(d => second.some(s => s.template_key === d.template_key)).length, 0,
    'the second page must not repeat the first')
  // Descriptors are the cheap half of a template on purpose: 23,000 scenes
  // cannot be built to paint 48 cards.
  assert.ok(page.every(d => !d.scene), 'listing must not build scenes')
})

test('browsing every size opens on a spread of sizes', () => {
  // Walking one size to exhaustion before starting the next means a thousand
  // square posts before the first story appears.
  const page = access.studioGeneratedDescriptors('', 'all', 0, 24)
  const sizes = new Set(page.map(d => d.format_key))
  assert.ok(sizes.size >= 12, `only ${sizes.size} sizes in the first 24 cards`)
})

test('search reaches designs that are not on the first page', () => {
  const rv = access.studioGeneratedDescriptors('fifth wheel', 'all', 0, 12)
  assert.ok(rv.length >= 6, `only ${rv.length} matches for an RV search`)
  assert.ok(rv.every(d => `${d.name} ${d.keywords}`.toLowerCase().includes('fifth wheel')))
  const none = access.studioGeneratedDescriptors('zzzznotathing', 'all', 0, 12)
  assert.equal(none.length, 0)
})

test('the catalogue offers a thousand designs for every size', () => {
  const factoryPerFormat = 1000
  assert.equal(access.studioGeneratedTotal('square'), factoryPerFormat)
  assert.equal(access.studioGeneratedTotal('all'), Object.keys(access.STUDIO_SOCIAL_FORMATS).length * factoryPerFormat)
  assert.equal(access.studioGeneratedTotal('not_a_size'), 0)
})

test('changing a filter starts the grid again from the first page', () => {
  // Otherwise a search inherits the depth of the browse before it and opens
  // four hundred cards down.
  for (const fn of ['studioFilterHomeTemplates', 'studioFilterHomeDesignSet', 'studioFilterHomeFormat', 'studioResetHomeTemplateFilters']) {
    const at = shellCode.indexOf(`function ${fn}(`)
    assert.ok(at > 0, `${fn} must exist`)
    const body = shellCode.slice(at, shellCode.indexOf('\n', at))
    assert.match(body, /__studioHomeTemplateShown = STUDIO_GENERATED_PAGE/, `${fn} must reset paging`)
  }
})

test('every path that opens a template resolves generated keys', () => {
  // Reading STUDIO_TEMPLATES_CATALOG directly finds only the handful of
  // hand-written scenes, so a generated card would open nothing at all.
  for (const fn of ['async function startStudioTemplate(templateKey) {', 'function previewStudioTemplate(templateKey) {']) {
    const at = shellCode.indexOf(fn)
    assert.ok(at > 0, `${fn} must exist`)
    assert.match(shellCode.slice(at, at + 220), /studioTemplate\(templateKey\)/, `${fn.slice(0, 40)} must go through studioTemplate`)
  }
  const load = shellCode.indexOf('async function loadStudioTemplate(tmplKey) {')
  assert.match(shellCode.slice(load, load + 240), /studioTemplate\(tmplKey\)/)
})

test('the factory and the imagery resolver load before the shell that reads them', () => {
  const factoryAt = loader.indexOf('studio/studio-template-factory.js')
  const imageryAt = loader.indexOf('studio/studio-template-imagery.js')
  const shellAt = loader.indexOf('studio/studio-shell.js?')
  assert.ok(factoryAt > 0 && imageryAt > 0 && shellAt > 0, 'all three must be in the Studio boot chain')
  assert.ok(factoryAt < shellAt && imageryAt < shellAt,
    'studio-shell.js reads the factory at module scope, so it cannot load first')
})

test('the new Studio assets ride the current release cache version', () => {
  // A stale ?v= is invisible: the deploy succeeds, the file is on the server,
  // and every returning browser keeps serving the cached old one.
  for (const asset of ['js/modules/studio/studio-template-factory.js', 'js/modules/studio/studio-template-imagery.js']) {
    const at = loader.indexOf(asset)
    assert.ok(at > 0, `${asset} must be requested by the Studio boot chain`)
    const version = loader.slice(at, at + asset.length + 40).match(/\?v=([A-Za-z0-9_]+)/)
    assert.ok(version, `${asset} must carry a ?v= cache-bust`)
    assert.equal(version[1], RELEASE_VERSION, `${asset} is not on the current release version`)
  }
  assert.equal(assetVersion('css/marketsync-theme.css'), RELEASE_VERSION,
    'the thumbnail container rule ships in the theme, so the theme must be bumped with it')
})
