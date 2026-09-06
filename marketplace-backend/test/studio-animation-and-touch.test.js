import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const toolbar = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-context-toolbar.js', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const code = (src) => stripComments(src)

// An animation is an EXPORT property. The editor used to run a permanent
// requestAnimationFrame loop that wrote straight onto the real object — left, top,
// angle, opacity, scaleX, scaleY — keeping the untouched values only in a
// non-persisted __animationBase. Saving mid-cycle therefore baked whatever frame it
// was on into the scene, so a "float" element crept further up on every save.
test('no perpetual animation loop remains', () => {
  for (const [name, src] of [['fabric-adapter', adapter], ['studio-context-toolbar', toolbar]]) {
    assert.ok(!/startAnimationLoop/.test(code(src)), `${name} must not keep an endless animation loop`)
    assert.ok(!/__animationBase/.test(code(src)), `${name} must not stash base values on the object`)
  }
  // There was a SECOND loop in the toolbar for slide/rise/shake/wiggle/pop.
  assert.ok(!/__msExtraMotion/.test(code(toolbar)), 'the toolbar must not run its own parallel loop')
  assert.match(code(adapter), /animation\.type === 'wiggle'/, 'every motion type now plays through the one previewer')
})

test('applying an animation previews it once and restores every value', () => {
  const fn = code(adapter).match(/previewAnimation\(object, \{ loop = false \} = \{\}\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'previewAnimation must exist')
  assert.match(fn, /if \(!loop && elapsed >= duration\) \{ restore\(\); return; \}/,
    'a preview must end itself rather than run forever')
  assert.match(fn, /object\.set\(base\)/, 'it must restore the values it started with')
  assert.match(code(adapter), /stopAnimationPreview\(\)/, 'a running preview must be cancellable')

  const setter = code(adapter).match(/setSelectedAnimation\(type = 'none', duration = 1600\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(setter, /this\.stopAnimationPreview\(\)/,
    'changing the animation must cancel a running preview, or its frame gets saved')
  assert.match(setter, /this\.previewAnimation\(object\)/, 'the choice must be shown once')
  assert.match(setter, /animation: \{ type, duration/, 'and persisted for export')
})

// Fabric draws selection handles in canvas pixels; the artboard is then CSS-scaled
// to fit the phone. At the 21-38% fit zoom a default 13px corner reaches the screen
// at 3-5px, which is why the corners could not be grabbed.
test('selection handles stay a finger-sized target at any zoom', () => {
  const fn = code(adapter).match(/applyControlSizing\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'applyControlSizing must exist')
  assert.match(fn, /Number\(window\.__studioZoomLevel\)/, 'sizing must follow the artboard zoom')
  assert.match(fn, /cornerSize: corner/)
  assert.match(fn, /touchCornerSize: touch/, 'fabric needs the larger touch target too')
  // Dividing by the zoom is the whole point — multiplying would shrink them further.
  assert.match(fn, /const corner = Math\.round\(\d+ \/ zoom\)/)
  assert.match(fn, /const touch = Math\.round\(\d+ \/ zoom\)/)
  // And it has to re-run when the zoom changes, not only on first render.
  assert.match(code(shell), /window\.__studioAdapter\.applyControlSizing\(\)/,
    'changing zoom must re-size the handles')
  assert.match(code(adapter), /this\.applyControlSizing\(\)/, 'and a render must apply them')
})

test('two fingers scale AND rotate the selected object', () => {
  // Fabric's stock build ignores multi-touch, so a pinch or twist previously did
  // nothing. One gesture carries both: the distance between the fingers drives
  // scale, the angle between them drives rotation.
  const fn = code(adapter).match(/bindTouchGestures\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'bindTouchGestures must exist')
  assert.match(fn, /event\.touches\.length !== 2/, 'it must only act on a two-finger gesture')
  assert.match(fn, /Math\.hypot/, 'scale comes from the distance between the fingers')
  assert.match(fn, /Math\.atan2/, 'rotation comes from the angle between them')
  assert.match(fn, /\{ passive: false \}/, 'the listener must be able to preventDefault')
  assert.match(fn, /event\.preventDefault\(\)/, 'or the page pinch-zooms instead of the object')
  assert.match(fn, /left: start\.left, top: start\.top/, 'scaling must not walk the object across the page')
  assert.match(fn, /this\.saveHistory\(\)/, 'a gesture must be undoable')
  assert.match(fn, /el\.__msPinchBound/, 'binding must happen once, not per render')

  // Each half is applied from its OWN starting value, so scale and rotation
  // cannot drift into each other over a long gesture.
  assert.match(fn, /start\.scaleX \* factor/)
  assert.match(fn, /start\.angle \+ \(bearing\(event\.touches\) - start\.bearing\)/)

  // A lock opts out of only its own half: lockRotation still pinches.
  assert.match(fn, /canScale: !object\.lockScalingX && !object\.lockScalingY/)
  assert.match(fn, /canRotate: !object\.lockRotation/)
  assert.match(fn, /if \(start\.canScale\)/)
  assert.match(fn, /if \(start\.canRotate\)/)
  assert.match(fn, /if \(!start\.canScale && !start\.canRotate\)/,
    'an object locked both ways must not capture the gesture at all')
})

test('the rotation handle is finger-sized too', () => {
  // applyControlSizing sets fabric.Object.prototype, which covers mtr (the
  // rotation control) along with the corners — otherwise rotating by handle stays
  // as impossible as resizing was.
  const fn = code(adapter).match(/applyControlSizing\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(fn, /Object\.assign\(fabric\.Object\.prototype, style\)/,
    'sizing must apply to every control, not just existing objects')
  assert.match(fn, /getObjects\(\)\.forEach/, 'and to objects already on the canvas')
})
