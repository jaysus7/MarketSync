import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')

test('addVideo does not set crossOrigin on the video element', () => {
  // Pexels' video CDN doesn't return CORS headers, and this app never reads pixel
  // data back off the canvas client-side (save/publish both send the scene JSON to a
  // backend renderer) — so crossOrigin='anonymous' has no upside and one real
  // downside: the browser rejects the whole load, and the video never plays or
  // renders on the artboard at all. This is what "videos don't go into the canvas"
  // was.
  const fn = adapter.match(/async addVideo\(url, name = 'Video', options = \{\}\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(fn, 'addVideo must exist')
  assert.doesNotMatch(fn, /video\.crossOrigin\s*=/, 'addVideo must not set crossOrigin on the video element')
})

test('photo and video search support Load More pagination', () => {
  assert.match(studio, /function loadMoreStudioPhotos/)
  assert.match(studio, /function loadMoreStudioVideos/)
  // A fresh search resets to page 1; Load More keeps the query and advances the page.
  assert.match(studio, /__studioPhotoPage = 1/)
  assert.match(studio, /__studioVideoPage = 1/)
  assert.match(studio, /const nextPage = __studioPhotoPage \+ 1/)
  assert.match(studio, /const nextPage = __studioVideoPage \+ 1/)
  // Load More appends results rather than replacing the grid.
  assert.match(studio, /target\.insertAdjacentHTML\('beforeend', renderPexelsResults\(results\)\)/)
  assert.match(studio, /target\.insertAdjacentHTML\('beforeend', renderStudioVideoResults\(results\)\)/)
})
