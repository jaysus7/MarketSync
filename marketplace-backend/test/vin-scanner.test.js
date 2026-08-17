import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part3.js', import.meta.url), 'utf8')

test('the native BarcodeDetector path falls back to ZXing instead of scanning forever with no feedback', () => {
  // Native BarcodeDetector's real-device support for 1D barcodes (Code 39 / Code
  // 128 — what a VIN door-jamb/window-sticker barcode actually is) is inconsistent:
  // it can run with the camera live and no error while never detecting anything,
  // which reads as "the camera opens and nothing happens." There must be a timeout
  // that hands off to the ZXing fallback instead of looping forever.
  assert.match(source, /NATIVE_TIMEOUT_MS/)
  const nativeBlock = source.match(/if \('BarcodeDetector' in window\) \{[\s\S]*?\n {2}\}\n\n {2}startZXing\(\);/)?.[0] || ''
  assert.ok(nativeBlock, "the native BarcodeDetector branch must exist and fall through to startZXing()")
  assert.match(nativeBlock, /Date\.now\(\) - startedAt > NATIVE_TIMEOUT_MS/)
  assert.match(nativeBlock, /startZXing\(\)/, 'timing out must hand off to the ZXing fallback, not just stop')
})

test('the ZXing fallback is reusable — both the direct path (no BarcodeDetector) and the native-timeout path call it', () => {
  const startZXingDef = source.match(/const startZXing = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] || ''
  assert.ok(startZXingDef, 'startZXing must be defined once, before the native branch, so both paths can call it')
  assert.match(startZXingDef, /BrowserMultiFormatReader/)
  assert.match(startZXingDef, /decodeFromConstraints/)
})
