import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const site = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

test('every Design Studio photo slot is filled before it reaches the canvas', () => {
  // fabric-adapter.js draws a vehicle-image only when (el.src ||
  // currentVehicle?.primary_photo_url) is truthy, so an unfilled slot is not a
  // placeholder — it is a hole where the vehicle should be.
  //
  // This used to be guaranteed by pinning an Unsplash photo ID into every slot.
  // That guarantee came at the cost of the templates showing whatever those
  // opaque IDs happened to point at, which in at least one case was not a
  // vehicle at all. Slots now name an automotive or RV SUBJECT and are filled at
  // open time from the dealership's own photography, the automotive stock pool,
  // or a drawn vehicle — so the slot is still never empty, and what fills it is
  // always a vehicle.
  const catalog = studio.match(/const STUDIO_TEMPLATES_CATALOG = \{([\s\S]*?)\n\};/)?.[1] || ''
  const vehicleImageBlocks = [...catalog.matchAll(/\{ id: '[^']+', type: 'vehicle-image'[^}]*\}/g)].map(m => m[0])
  assert.equal(vehicleImageBlocks.length, 6, 'expected 6 named vehicle-photo templates')
  for (const block of vehicleImageBlocks) {
    assert.doesNotMatch(block, /src: 'https:/, `a photo slot still pins a photo by URL: ${block.slice(0, 70)}...`)
    assert.match(block, /image_query: '[^']+'/, `a photo slot names no subject: ${block.slice(0, 70)}...`)
  }

  // And the open path fills them. Without this the six templates above would
  // open with holes where the pinned photos used to be.
  const open = studio.slice(studio.indexOf('async function loadStudioTemplate(tmplKey) {'))
  const body = open.slice(0, open.indexOf('const boundScene'))
  assert.match(body, /MS_STUDIO_IMAGERY[\s\S]*resolveScene\(scene/,
    'loadStudioTemplate must resolve photo slots before the scene reaches the canvas')
})

test('newly added photo-centric website sections default to a library photo', () => {
  // Hero, Text+image split, and Specials/promo ad are sections where the photo IS the
  // section (unlike two_col's explicitly-optional left/right images) — a blank one
  // reads as broken, not as an intentional text-only layout.
  assert.match(site, /const WS_DEFAULT_IMAGE_TYPES = \{ hero: 'image', text_image: 'image', ad_banner: 'image' \}/)
  const fn = site.match(/function addSection\(type\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /STUDIO_FREE_PHOTOS\[Math\.floor\(Math\.random\(\) \* STUDIO_FREE_PHOTOS\.length\)\]\.url/)
  // two_col's optional images must NOT be forced.
  assert.doesNotMatch(site, /WS_DEFAULT_IMAGE_TYPES = \{[^}]*two_col/)
})
