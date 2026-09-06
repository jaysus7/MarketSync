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

// Pull the real helper out of the adapter source and run it, so the budget
// numbers below are the shipped ones rather than a copy that can drift.
function loadSafeRetinaRatio(devicePixelRatio) {
  const body = adapterSource.match(
    /const MS_MAX_CANVAS_BITMAP_PX = [\s\S]+?\nwindow\.msStudioSafeRetinaRatio = msStudioSafeRetinaRatio;/
  )?.[0]
  assert.ok(body, 'fabric-adapter.js should define the canvas bitmap budget helper')
  const window = { devicePixelRatio }
  return Function('window', `${body}\nreturn msStudioSafeRetinaRatio;`)(window)
}

const IOS_MAX_CANVAS_PIXELS = 16_777_216

test('a 1080x1920 story page stays inside the iOS canvas bitmap ceiling on a 3x phone', () => {
  const safeRatio = loadSafeRetinaRatio(3)
  const ratio = safeRatio(1080, 1920)
  const bitmapPixels = Math.round(1080 * ratio) * Math.round(1920 * ratio)
  // Unfixed, Fabric asked for 3240x5760 = 18.7M pixels, which WebKit refuses
  // silently: canvas in the DOM, objects reported, nothing painted.
  assert.ok(ratio < 3, `story ratio should be capped below the raw 3x device ratio, got ${ratio}`)
  assert.ok(
    bitmapPixels < IOS_MAX_CANVAS_PIXELS,
    `story bitmap ${bitmapPixels} px must stay under the ${IOS_MAX_CANVAS_PIXELS} px iOS ceiling`
  )
})

test('square and portrait pages keep a retina bitmap instead of dropping to 1:1', () => {
  const safeRatio = loadSafeRetinaRatio(3)
  assert.ok(safeRatio(1080, 1080) > 2, 'a square page should still render above 2x')
  assert.ok(safeRatio(1080, 1350) > 1.5, 'a portrait page should still render above 1.5x')
})

test('the budget never upscales past the real device ratio and never goes below 1', () => {
  assert.equal(loadSafeRetinaRatio(1)(1080, 1080), 1, 'a 1x display must stay at 1x')
  assert.equal(loadSafeRetinaRatio(2)(1080, 1080), 2, 'a 2x display must stay at 2x when it fits')
  assert.equal(loadSafeRetinaRatio(3)(6000, 6000), 1, 'an oversized page floors at 1:1, never below')
})

test('every place that sizes the Fabric canvas applies the budget first', () => {
  // Fabric reads fabric.devicePixelRatio at construction and at each
  // setDimensions, so the budget has to be applied immediately before both.
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(this\.currentScene\.width, this\.currentScene\.height\);\s*\n\s*\n?\s*this\.fabricCanvas = new fabric\.Canvas\(/,
    'init() must apply the budget before constructing the canvas'
  )
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(pageWidth, pageHeight\);\s*\n\s*this\.fabricCanvas\.setDimensions\(\{ width: pageWidth, height: pageHeight \}\)/,
    'renderScene() must apply the budget before resizing to the page'
  )
  assert.match(
    adapterSource,
    /msStudioApplyRetinaBudget\(width, height\);\s*\n\s*this\.fabricCanvas\.setDimensions\(\{ width, height \}\)/,
    'resizeCanvas() must apply the budget before resizing'
  )
  // Three sizing calls plus the 1:1 fallback inside verifyBitmapPainted,
  // which sets fabric.devicePixelRatio = 1 itself. A fourth sizing call
  // added later needs its own guard, so this count is deliberately exact.
  assert.equal(
    (adapterSource.match(/setDimensions\(/g) || []).length,
    4,
    'a new setDimensions call needs its own budget guard'
  )
})

test('a bitmap that failed to allocate falls back to 1:1 exactly once', () => {
  assert.match(adapterSource, /verifyBitmapPainted\(pageWidth, pageHeight\)/)
  assert.match(adapterSource, /if \(this\.__retinaFallbackApplied\) return;/)
  assert.match(adapterSource, /this\.__retinaFallbackApplied = true;/)
  assert.match(adapterSource, /window\.fabric\.devicePixelRatio = 1/)
})

test('the diagnostics panel reports the real backing-store size', () => {
  assert.match(shellSource, /\['bitmap',/)
  assert.match(shellSource, /over iOS cap/)
})
