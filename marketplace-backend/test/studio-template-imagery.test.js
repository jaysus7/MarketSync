import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TEMPLATE_IMAGE_QUERIES, fetchTemplateImageryQuery, templateImageryIsFresh } from '../routes/marketing-studio.js'

const FRONTEND = new URL('../../marketplace-frontend/js/modules/studio/', import.meta.url)

function loadScript(name) {
  const sandbox = {}
  new Function('window', readFileSync(new URL(name, FRONTEND), 'utf8'))(sandbox)
  return sandbox
}

const factory = loadScript('studio-template-factory.js').MS_STUDIO_TEMPLATE_FACTORY
const internals = loadScript('studio-template-factory.js').MS_STUDIO_TEMPLATE_FACTORY_INTERNALS
const imagery = loadScript('studio-template-imagery.js').MS_STUDIO_IMAGERY
const shellSource = readFileSync(new URL('studio-shell.js', FRONTEND), 'utf8')

// Words that make a search term automotive or RV. A term has to contain at
// least one of them, which is what stops "team working together" or "phone and
// social content" from quietly re-entering the template catalogue.
const VEHICLE_WORDS = [
  'car', 'cars', 'vehicle', 'sedan', 'suv', 'truck', 'pickup', 'van', 'auto',
  'dealership', 'showroom', 'driver', 'steering', 'tire', 'charging', 'detailing',
  'rv', 'motorhome', 'trailer', 'camper', 'towed', 'towing', 'fifth'
]
const isVehicleTerm = term => term.toLowerCase().split(/\s+/).some(word => VEHICLE_WORDS.includes(word))

test('every campaign in the catalogue asks for an automotive or RV photo', () => {
  // The rule is enforced at the vocabulary, not by filtering results afterwards.
  // A theme whose photo slot asked for something generic is how a vehicle
  // template ended up showing a field of solar panels.
  assert.ok(internals.THEMES.length >= 20, 'expected a full set of campaign themes')
  for (const theme of internals.THEMES) {
    assert.ok(isVehicleTerm(theme.query), `theme "${theme.id}" searches for "${theme.query}", which names no vehicle`)
    assert.ok(theme.segment === 'auto' || theme.segment === 'rv', `theme "${theme.id}" is segment "${theme.segment}"`)
  }
  const rv = internals.THEMES.filter(theme => theme.segment === 'rv')
  assert.ok(rv.length >= 6, `only ${rv.length} RV campaigns — the catalogue is meant to cover RV dealerships too`)
})

test('the backend warms exactly the terms the templates ask for', () => {
  // The pool is fetched by the backend and consumed by the factory. A term added
  // to one and not the other is invisible: the slot silently falls back to a
  // drawing and nobody notices the photo stopped appearing.
  const wanted = new Set(factory.IMAGE_QUERIES)
  const warmed = new Set(TEMPLATE_IMAGE_QUERIES)
  for (const query of wanted) {
    assert.ok(warmed.has(query), `the factory asks for "${query}" but the backend never warms it`)
  }
  for (const query of warmed) {
    assert.ok(isVehicleTerm(query), `the backend warms "${query}", which names no vehicle`)
  }
})

test('the shell asks for automotive terms too, and pins no photo IDs', () => {
  const queryBlock = shellSource.match(/const STUDIO_DESIGN_SET_QUERIES = \[[\s\S]*?\n\];/)
  assert.ok(queryBlock, 'studio-shell.js must declare STUDIO_DESIGN_SET_QUERIES')
  const queries = new Function(`${queryBlock[0]}; return STUDIO_DESIGN_SET_QUERIES`)()
  assert.ok(queries.length >= 12)
  for (const query of queries) assert.ok(isVehicleTerm(query), `"${query}" names no vehicle`)

  // A hardcoded photo URL inside a template scene is the defect itself: it
  // cannot be checked, cannot be swapped for the dealership's own photography,
  // and nobody can tell what it depicts by reading it.
  const scenes = shellSource.slice(shellSource.indexOf('const STUDIO_TEMPLATES_CATALOG'), shellSource.indexOf('const STUDIO_FORMAT_PURPOSES'))
  assert.equal(scenes.match(/src: 'https?:\/\//g), null, 'a template scene pins a photo by URL instead of asking for a subject')
})

test('a photo slot that cannot be filled still shows a vehicle', () => {
  for (const [query, expected] of [
    ['rv motorhome campsite', 'motorhome'],
    ['travel trailer towed by truck', 'trailer'],
    ['fifth wheel trailer rv park', 'fifth_wheel'],
    ['camper van mountain road', 'camper_van'],
    ['pickup truck towing trailer', 'pickup'],
    ['family suv on highway', 'suv'],
    ['sedan on city street', 'sedan']
  ]) {
    assert.equal(imagery.markFor(query), expected, `"${query}" should be drawn as a ${expected}`)
  }
  // Anything unrecognised is still a vehicle, never a blank or a generic shape.
  assert.ok(imagery.MARKS[imagery.markFor('something we have never seen')], 'an unknown term must still resolve to a vehicle')
})

test('the drawn vehicle is composed for the slot it fills', () => {
  // A drawing whose proportions disagree with its slot gets cropped by
  // object-fit: cover, and on a tall slot that crop magnifies the middle of the
  // artwork until a wheel arch fills the frame.
  const wide = decodeURIComponent(imagery.silhouetteDataUri('sedan on city street', { width: 1200, height: 400 }))
  const tall = decodeURIComponent(imagery.silhouetteDataUri('sedan on city street', { width: 400, height: 1200 }))
  const box = svg => svg.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number)
  const [ww, wh] = box(wide), [tw, th] = box(tall)
  assert.ok(ww / wh > 2.5, `wide slot produced a ${ww}×${wh} drawing`)
  assert.ok(tw / th < 0.5, `tall slot produced a ${tw}×${th} drawing`)
})

test('the drawn vehicle stays visible on light palettes', () => {
  // White ink on a pale ground is an empty box.
  const onLight = decodeURIComponent(imagery.silhouetteDataUri('sedan', { from: '#F5F1E8', to: '#FFFFFF' }))
  const onDark = decodeURIComponent(imagery.silhouetteDataUri('sedan', { from: '#07111F', to: '#0F1E33' }))
  assert.match(onLight, /rgba\(15,23,42/, 'a light ground needs dark ink')
  assert.match(onDark, /rgba\(255,255,255/, 'a dark ground needs light ink')
})

test('a dealership photo beats stock, and stock beats a drawing', () => {
  const slot = () => ({ elements: [{ type: 'vehicle-image', image_query: 'rv motorhome campsite', width: 800, height: 600 }] })
  imagery.resetPool()

  const drawn = imagery.resolveScene(slot(), {})
  assert.match(drawn.elements[0].src, /^data:image\/svg\+xml/, 'with nothing available the slot must draw a vehicle')
  assert.equal(drawn.elements[0].ms_placeholder, true, 'a drawing must be marked so a photo can replace it later')

  imagery.rememberPool('rv motorhome campsite', ['https://images.pexels.com/rv.jpg'])
  const stocked = imagery.resolveScene(slot(), {})
  assert.equal(stocked.elements[0].src, 'https://images.pexels.com/rv.jpg')

  const owned = imagery.resolveScene(slot(), { inventoryPhotos: ['https://cdn.marketsync.ca/unit-9912.jpg'] })
  assert.equal(owned.elements[0].src, 'https://cdn.marketsync.ca/unit-9912.jpg',
    "the dealership's own photography must win")
  imagery.resetPool()
})

test('a drawing is upgraded once real photos arrive', () => {
  // The pool warms after the first paint. Without this, the drawing painted on
  // the first render would be pinned there for the rest of the session.
  imagery.resetPool()
  const scene = { elements: [{ type: 'vehicle-image', image_query: 'sedan on city street', width: 800, height: 600 }] }
  imagery.resolveScene(scene, {})
  assert.equal(scene.elements[0].ms_placeholder, true)
  imagery.rememberPool('sedan on city street', ['https://images.pexels.com/sedan.jpg'])
  imagery.resolveScene(scene, {})
  assert.equal(scene.elements[0].src, 'https://images.pexels.com/sedan.jpg')
  assert.equal(scene.elements[0].ms_placeholder, undefined, 'the placeholder mark must be cleared once a photo lands')
  imagery.resetPool()
})

test('a photo the designer chose is never overwritten', () => {
  const scene = { elements: [{ type: 'vehicle-image', src: 'https://cdn.marketsync.ca/chosen.jpg', image_query: 'sedan on city street', width: 400, height: 300 }] }
  imagery.rememberPool('sedan on city street', ['https://images.pexels.com/other.jpg'])
  imagery.resolveScene(scene, {})
  assert.equal(scene.elements[0].src, 'https://cdn.marketsync.ca/chosen.jpg')
  imagery.resetPool()
})

test('one dead search term does not cost the whole pool', () => {
  // Twenty-four terms are fetched together. If a single upstream failure threw,
  // every template in the product would fall back to a drawing.
  return Promise.all([
    fetchTemplateImageryQuery('rv motorhome campsite', 'key', async () => { throw new Error('upstream down') }),
    fetchTemplateImageryQuery('rv motorhome campsite', 'key', async () => ({ ok: false, status: 429 })),
    fetchTemplateImageryQuery('rv motorhome campsite', 'key', async () => ({ ok: true, json: async () => ({ photos: [{ src: { large2x: 'https://images.pexels.com/a.jpg' } }, { src: {} }] }) }))
  ]).then(([thrown, rejected, ok]) => {
    assert.deepEqual(thrown, [])
    assert.deepEqual(rejected, [])
    assert.deepEqual(ok, ['https://images.pexels.com/a.jpg'], 'a photo with no usable size must be dropped, not passed through as undefined')
  })
})

test('an unwarmed pool is not treated as fresh', () => {
  assert.equal(templateImageryIsFresh(Date.now(), { at: 0, imagery: null }), false)
  assert.equal(templateImageryIsFresh(Date.now(), { at: Date.now(), imagery: {} }), true)
  assert.equal(templateImageryIsFresh(Date.now(), { at: Date.now() - 7 * 60 * 60 * 1000, imagery: {} }), false,
    'a pool older than its lifetime must be refetched')
})
