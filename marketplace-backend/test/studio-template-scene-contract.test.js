// Studio template regression gate (P0).
//
// Object-count on its own is a false positive — the diagnostic pass proved
// a template can report "15 objects, all visible, opacity 1" while
// rendering pure white. This scanner walks every entry in
// STUDIO_TEMPLATES_CATALOG and asserts structural properties that would
// have caught that exact bug at build time:
//
//   1. every scene has at least 3 elements (a real design, not a stub)
//   2. every element declares position (x/y or left/top) and size (width/height)
//   3. no element has zero-or-negative size
//   4. NO element covers the full canvas with a near-white fill at
//      opacity > 0 (the "invisible white rect on top of the stack" antipattern)
//   5. z-ordering is consistent — no duplicate ids within a template
//   6. text objects have non-empty text
//   7. image objects have a src
//   8. every element sits inside the canvas bounds (small overflow tolerated)
//
// Reads the source directly and walks the elements arrays with a small
// JS-in-VM parser so it doesn't depend on window/document/fabric being
// available. Every failure names the template and the offending element.

import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const src = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')

// Extract the STUDIO_TEMPLATES_CATALOG literal — it's a top-level const
// object with individual template blocks. We slice from the opening brace
// to the matching close-brace by counting braces, then evaluate the
// literal in a VM sandbox that only knows how to build a plain object.
function extractCatalog() {
  const marker = 'const STUDIO_TEMPLATES_CATALOG = {'
  const start = src.indexOf(marker)
  assert.ok(start > 0, 'STUDIO_TEMPLATES_CATALOG must be defined')
  let i = start + marker.length - 1  // position on the '{'
  let depth = 0, inStr = false, strCh = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === strCh) inStr = false
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { i++; break } }
  }
  const literal = src.slice(start + marker.length - 1, i)
  // Evaluate the literal in a VM with no globals. Template values are
  // pure data — no function calls needed.
  const ctx = vm.createContext({})
  return vm.runInContext(`(${literal})`, ctx)
}

const catalog = extractCatalog()
const templateKeys = Object.keys(catalog)

test('catalog is not empty and every entry has a template_key + scene', () => {
  assert.ok(templateKeys.length >= 5, `expected at least 5 seed templates, got ${templateKeys.length}`)
  for (const key of templateKeys) {
    const t = catalog[key]
    assert.equal(t.template_key, key, `${key}: template_key mismatch`)
    assert.ok(t.scene && typeof t.scene === 'object', `${key}: missing scene`)
  }
})

// White/near-white fill matcher — covers #fff, #ffffff, white, rgb/rgba
// close to 255,255,255. Used for the "invisible cover rect" antipattern.
const NEAR_WHITE = (fill) => {
  if (!fill || typeof fill !== 'string') return false
  const s = fill.trim().toLowerCase()
  if (s === 'white') return true
  if (/^#([f]{3}|[f]{6})$/.test(s)) return true
  if (/^#([e-f][0-9a-f]){3}$/.test(s)) return true
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return Number(m[1]) >= 235 && Number(m[2]) >= 235 && Number(m[3]) >= 235
  return false
}

function walkElements(t) {
  // Templates use either scene.elements or scene.pages[].objects.
  if (Array.isArray(t.scene.elements)) return t.scene.elements
  if (Array.isArray(t.scene.pages)) return t.scene.pages.flatMap(p => p.objects || p.elements || [])
  return []
}

test('every template has a real design (>= 3 elements)', () => {
  for (const key of templateKeys) {
    const els = walkElements(catalog[key])
    assert.ok(els.length >= 3, `${key}: only ${els.length} elements — templates below 3 are stubs, not designs`)
  }
})

test('every element declares position + non-zero size', () => {
  for (const key of templateKeys) {
    const els = walkElements(catalog[key])
    els.forEach((el, i) => {
      const x = el.x ?? el.left
      const y = el.y ?? el.top
      const w = el.width, h = el.height
      // Text can omit explicit width (auto-fit), everything else must have both.
      assert.notEqual(x, undefined, `${key}.elements[${i}] (${el.type}): missing x/left`)
      assert.notEqual(y, undefined, `${key}.elements[${i}] (${el.type}): missing y/top`)
      if (el.type !== 'text') {
        assert.ok(typeof w === 'number' && w > 0, `${key}.elements[${i}] (${el.type}): width must be a positive number, got ${w}`)
        assert.ok(typeof h === 'number' && h > 0, `${key}.elements[${i}] (${el.type}): height must be a positive number, got ${h}`)
      }
    })
  }
})

test('no element covers the full canvas with a near-white fill at opacity > 0', () => {
  // The exact antipattern the Raw Canvas Mode diagnostic was designed to
  // catch: a full-artboard rect on top of the stack that paints nothing
  // visible but blocks every object beneath it.
  for (const key of templateKeys) {
    const t = catalog[key]
    const canvasW = t.scene.width || t.width || 1080
    const canvasH = t.scene.height || t.height || 1080
    const els = walkElements(t)
    els.forEach((el, i) => {
      if (el.type !== 'shape') return
      const x = el.x ?? el.left ?? 0
      const y = el.y ?? el.top ?? 0
      const w = el.width || 0, h = el.height || 0
      const op = el.opacity ?? 1
      if (x <= 0 && y <= 0 && w >= canvasW && h >= canvasH && op > 0 && NEAR_WHITE(el.fill)) {
        assert.fail(`${key}.elements[${i}] (${el.type}) fills the whole ${canvasW}×${canvasH} canvas at opacity ${op} with near-white fill ${el.fill}. This is the "invisible cover rect" bug — move it to scene.background.color instead.`)
      }
    })
  }
})

test('element ids are unique within a template', () => {
  for (const key of templateKeys) {
    const els = walkElements(catalog[key])
    const ids = els.map(el => el.id).filter(Boolean)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    assert.equal(dupes.length, 0, `${key}: duplicate element ids: ${dupes.join(', ')}`)
  }
})

test('text objects carry non-empty text', () => {
  for (const key of templateKeys) {
    walkElements(catalog[key]).forEach((el, i) => {
      if (el.type !== 'text') return
      assert.ok(el.text && String(el.text).trim().length > 0, `${key}.elements[${i}] text is empty`)
    })
  }
})

test('image objects carry a src OR resolve at render (vehicle-image)', () => {
  for (const key of templateKeys) {
    walkElements(catalog[key]).forEach((el, i) => {
      if (el.type === 'image') {
        assert.ok(el.src && String(el.src).trim().length > 0, `${key}.elements[${i}] image is missing src`)
      }
      // vehicle-image resolves from the bound vehicle at render — a null
      // src is fine as long as the type is vehicle-image.
    })
  }
})

test('every element sits inside the canvas bounds (100px overflow tolerance)', () => {
  // Catches templates that were authored at the wrong document size —
  // a 1080×1080 template with an element at x=1600 renders off-canvas
  // and looks blank.
  const TOLERANCE = 100
  for (const key of templateKeys) {
    const t = catalog[key]
    const canvasW = t.scene.width || t.width || 1080
    const canvasH = t.scene.height || t.height || 1080
    walkElements(t).forEach((el, i) => {
      const x = el.x ?? el.left ?? 0
      const y = el.y ?? el.top ?? 0
      assert.ok(x <= canvasW + TOLERANCE, `${key}.elements[${i}] x=${x} is beyond canvas width ${canvasW} (+${TOLERANCE}px tolerance)`)
      assert.ok(y <= canvasH + TOLERANCE, `${key}.elements[${i}] y=${y} is beyond canvas height ${canvasH} (+${TOLERANCE}px tolerance)`)
      assert.ok(x >= -TOLERANCE, `${key}.elements[${i}] x=${x} is beyond canvas left edge`)
      assert.ok(y >= -TOLERANCE, `${key}.elements[${i}] y=${y} is beyond canvas top edge`)
    })
  }
})
