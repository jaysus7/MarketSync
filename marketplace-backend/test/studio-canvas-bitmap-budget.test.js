import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adapterSource = readFileSync(
  new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url),
  'utf8'
)
const shellSource = readFileSync(
  new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url),
  'utf8'
)

// Run the SHIPPED helpers rather than a copy, so these numbers cannot drift.
function loadBudget(devicePixelRatio) {
  const body = adapterSource.match(
    /const MS_WEBKIT_MAX_BITMAP_PX = [\s\S]+?\nwindow\.msStudioRasterScale = msStudioRasterScale;/
  )?.[0]
  assert.ok(body, 'fabric-adapter.js should define the canvas budget helpers')
  const window = { devicePixelRatio }
  return Function('window', `${body}\nreturn { msStudioSafeRetinaRatio, msStudioRasterScale, MS_MAX_CANVAS_BITMAP_PX };`)(window)
}

// Every format the Studio actually offers, read from the catalogue so a new one
// cannot be added without this budget being checked against it.
function realFormats() {
  const block = shellSource.match(/const STUDIO_SOCIAL_FORMATS = \{[\s\S]*?\n\};/)?.[0]
  assert.ok(block, 'the format catalogue must be readable')
  const formats = Function(`return ${block.replace(/^const STUDIO_SOCIAL_FORMATS = /, '').replace(/;$/, '')}`)()
  const entries = Object.entries(formats).map(([key, f]) => [key, f.w, f.h])
  assert.ok(entries.length > 15, `sanity: expected the full format catalogue, got ${entries.length}`)
  return entries
}

const IOS_MAX_CANVAS_PIXELS = 16_777_216

// The previous version of this test measured ONE canvas against the ceiling. Fabric
// always allocates TWO (lower + upper) and gives every cached object a third kind of
// canvas, so a "passing" 8.3M px budget was really asking for 16.6M px before object
// caches — over the line on its own, which is why story pages went blank. What has to
// fit is the whole page's allocation.
test('no format asks WebKit for more canvas than it will grant, counting the pair', () => {
  const { msStudioSafeRetinaRatio, msStudioRasterScale } = loadBudget(3)
  const over = []
  for (const [key, w, h] of realFormats()) {
    const raster = msStudioRasterScale(w, h)
    const cw = Math.round(w * raster), ch = Math.round(h * raster)
    const ratio = msStudioSafeRetinaRatio(cw, ch)
    const pair = Math.round(cw * ratio) * Math.round(ch * ratio) * 2
    if (pair >= IOS_MAX_CANVAS_PIXELS) {
      over.push(`${key} ${w}x${h}: pair is ${(pair / 1e6).toFixed(1)}M px`)
    }
  }
  assert.deepEqual(over, [],
    `these formats exceed the ceiling before a single object cache:\n  ${over.join('\n  ')}`)
})

test('the print formats are rasterised down, because they do not fit even at 1:1', () => {
  const { msStudioRasterScale, MS_MAX_CANVAS_BITMAP_PX } = loadBudget(3)
  // letterhead / flyer / brochure are 2550x3300 — 8.4M px each, so the pair is
  // 16.8M px at 1:1. They were blank on a phone whatever the retina ratio did.
  assert.ok(msStudioRasterScale(2550, 3300) < 1, 'a 2550x3300 page must raster below 1:1')
  assert.ok(msStudioRasterScale(2550, 3300) >= 0.25, 'and never collapse to nothing')
  // Pages that fit are left completely alone.
  assert.equal(msStudioRasterScale(1080, 1920), 1, 'a story page must not be rasterised')
  assert.equal(msStudioRasterScale(1080, 1080), 1, 'a square page must not be rasterised')
  assert.ok(MS_MAX_CANVAS_BITMAP_PX * 2 < IOS_MAX_CANVAS_PIXELS,
    'the per-canvas budget must leave room for the second canvas AND the object caches')
})

test('the retina ratio never drops below 1, because Fabric would ignore it', () => {
  // getRetinaScaling() is `Math.max(1, fabric.devicePixelRatio)`. A fractional ratio
  // is silently discarded, so shrinking below 1:1 has to go through the raster scale.
  const { msStudioSafeRetinaRatio } = loadBudget(3)
  assert.equal(msStudioSafeRetinaRatio(6000, 6000), 1)
  assert.equal(loadBudget(1).msStudioSafeRetinaRatio(1080, 1080), 1, 'a 1x display stays at 1x')
  assert.ok(msStudioSafeRetinaRatio(1080, 1080) >= 1)
})

test('the bitmap is never sharper than the screen it is shown on', () => {
  const { msStudioSafeRetinaRatio } = loadBudget(3)
  // A 1080px page displayed 302px wide on a 3x phone needs ~906 device pixels.
  // Rendering it at 2x would cost four times the memory for detail nobody can see.
  const shown = msStudioSafeRetinaRatio(1080, 1920, 302)
  const unconstrained = msStudioSafeRetinaRatio(1080, 1920)
  assert.ok(shown <= unconstrained, 'knowing the on-screen size must never raise the ratio')
  assert.ok(Math.round(1080 * shown) >= 906 * 0.9, 'and must still cover the pixels the screen has')
})

test('every place that sizes the Fabric canvas applies the budget first', () => {
  // Fabric reads fabric.devicePixelRatio inside the constructor and inside each
  // setDimensions, so the budget has to be applied immediately before both.
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(this\.currentScene\.width, this\.currentScene\.height\);\s*\n\s*\n?\s*this\.fabricCanvas = new fabric\.Canvas\(/,
    'init() must apply the budget before constructing the canvas'
  )
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(canvasWidth, canvasHeight\);\s*\n\s*this\.fabricCanvas\.setDimensions\(\{ width: canvasWidth, height: canvasHeight \}\)/,
    'renderScene() must apply the budget to the RASTERISED size before resizing'
  )
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(width, height\);\s*\n\s*this\.fabricCanvas\.setDimensions\(\{ width, height \}\)/,
    'resizeCanvas() must apply the budget before resizing'
  )
  assert.equal(
    (adapterSource.match(/setDimensions\(/g) || []).length, 4,
    'a new setDimensions call needs its own budget guard'
  )
})

test('rasterising shrinks the bitmap without moving the document', () => {
  // Fabric's zoom is what makes this safe: the scene keeps its real coordinates,
  // so snapping, selection and the saved JSON are untouched, and export renders
  // server-side from that JSON rather than from this bitmap.
  assert.match(adapterSource, /const raster = msStudioRasterScale\(pageWidth, pageHeight\)/)
  assert.match(adapterSource, /this\.fabricCanvas\.setZoom\(raster\)/,
    'the zoom must compensate for the smaller canvas')
  assert.match(adapterSource, /artboard\.style\.width = `\$\{canvasWidth\}px`/,
    'the artboard box follows the canvas, so the fit zoom lands it at the same on-screen size')
})

test('a bitmap that failed to allocate falls back to 1:1 exactly once', () => {
  assert.match(adapterSource, /verifyBitmapPainted\(pageWidth, pageHeight\)/)
  assert.match(adapterSource, /if \(this\.__retinaFallbackApplied\) return;/)
  assert.match(adapterSource, /this\.__retinaFallbackApplied = true;/)
  assert.match(adapterSource, /window\.fabric\.devicePixelRatio = 1/)
})

test('large objects do not each get their own cache canvas', () => {
  // 15 cached objects added 11.9M px on top of the main pair (measured). Large
  // objects gain least from caching and cost the most.
  assert.match(adapterSource, /function msStudioTrimObjectCaches/)
  assert.match(adapterSource, /obj\.set\('objectCaching', false\)/)
  assert.match(adapterSource, /msStudioTrimObjectCaches\(this\.fabricCanvas\)/)
})

test('the diagnostics panel reports the real backing-store size', () => {
  assert.match(shellSource, /\['bitmap',/)
  assert.match(shellSource, /over iOS cap/)
})
