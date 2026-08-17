import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const site = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

test('every Design Studio vehicle-photo template ships with a real fallback image', () => {
  // Without a src (or a bound vehicle), fabric-adapter.js's render condition for
  // vehicle-image/image elements — (el.src || currentVehicle?.primary_photo_url) —
  // is false and the whole photo slot renders as nothing: a blank hole in the layout.
  const catalog = studio.match(/const STUDIO_TEMPLATES_CATALOG = \{([\s\S]*?)\n\};/)?.[1] || ''
  const vehicleImageBlocks = [...catalog.matchAll(/\{ id: '[^']+', type: 'vehicle-image'[^}]*\}/g)].map(m => m[0])
  assert.equal(vehicleImageBlocks.length, 6, 'expected 6 named vehicle-photo templates')
  for (const block of vehicleImageBlocks) {
    assert.match(block, /src: 'https:\/\/images\.unsplash\.com\//, `vehicle-image element missing a fallback src: ${block.slice(0, 60)}...`)
  }
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
