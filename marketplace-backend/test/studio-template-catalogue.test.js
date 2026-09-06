import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The factory is a browser classic script. Evaluating it against a stand-in
// `window` gives the tests the exact code the Studio runs, rather than a copy of
// its rules that could drift from it.
function loadFactory() {
  const sandbox = {}
  const source = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-template-factory.js', import.meta.url), 'utf8')
  new Function('window', source)(sandbox)
  return { factory: sandbox.MS_STUDIO_TEMPLATE_FACTORY, internals: sandbox.MS_STUDIO_TEMPLATE_FACTORY_INTERNALS }
}

function loadFormats() {
  const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
  const block = shell.match(/const STUDIO_SOCIAL_FORMATS = \{[\s\S]*?\n\};/)
  assert.ok(block, 'studio-shell.js must declare STUDIO_SOCIAL_FORMATS')
  return new Function(`${block[0]}; return STUDIO_SOCIAL_FORMATS`)()
}

const { factory, internals } = loadFactory()
const FORMATS = loadFormats()
const FORMAT_ENTRIES = Object.entries(FORMATS)

// Geometry helpers, kept independent of the factory's own so a bug in the
// factory cannot also silence the check that would catch it.
const overlaps = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
const contains = (outer, inner) => outer.x <= inner.x + 0.5 && outer.y <= inner.y + 0.5
  && outer.x + outer.width >= inner.x + inner.width - 0.5 && outer.y + outer.height >= inner.y + inner.height - 0.5

const WEIGHT_WIDTH = { '400': 0.97, '500': 0.99, '600': 1.01, '700': 1.03, '800': 1.05, '900': 1.07 }

function textOverflow(element) {
  const tracking = (element.charSpacing || 0) / 1000
  const weight = WEIGHT_WIDTH[String(element.fontWeight)] || 1
  const units = (element.width / weight) * 0.96 / element.fontSize
  const lines = internals.wrap(internals.expandForMeasure(element.text), units, tracking)
  const widest = lines.reduce((max, line) => Math.max(max, internals.measure(line, tracking)), 0)
  return {
    horizontal: widest - units,
    vertical: lines.length * element.fontSize * (element.lineHeight || 1.1) - element.height
  }
}

// WCAG relative luminance and contrast, computed from the elements actually
// painted underneath a line of type rather than from the palette it came from.
const toRgb = value => {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(value || ''))
  if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  return [128, 128, 128]
}
const composite = (front, back, alpha) => front.map((channel, i) => channel * alpha + back[i] * (1 - alpha))
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function backdropUnder(scene, text) {
  let backdrop = toRgb(scene.background.color)
  for (const element of scene.elements) {
    if (element.z >= text.z) continue
    if (!contains(element, text)) continue
    const alpha = element.opacity == null ? 1 : element.opacity
    // A photograph is an unknown. Mid-grey is the hardest value to put type on,
    // so passing against it means passing against any real photograph.
    backdrop = composite(element.type === 'shape' ? toRgb(element.fill) : [128, 128, 128], backdrop, alpha)
  }
  return backdrop
}

test('every output size offers a thousand distinct designs', () => {
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    const fingerprints = new Set()
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      const scene = factory.scene(formatKey, format, index)
      fingerprints.add(JSON.stringify(scene.elements.map(e => [e.type, e.x, e.y, e.width, e.height, e.fill || '', e.text || '', e.fontSize || 0, e.fontFamily || ''])))
    }
    assert.equal(fingerprints.size, factory.VARIANTS_PER_FORMAT,
      `${formatKey} produced ${fingerprints.size} distinct designs, not ${factory.VARIANTS_PER_FORMAT}`)
  }
})

test('a template key always addresses the same design', () => {
  const [formatKey, format] = FORMAT_ENTRIES[0]
  for (const index of [0, 7, 512, 999]) {
    const first = factory.template(formatKey, format, index)
    const second = factory.template(formatKey, format, index)
    assert.equal(first.template_key, `auto_${formatKey}_${index}`)
    assert.deepEqual(second.scene, first.scene, 'the same key must rebuild the same scene')
    assert.equal(second.name, first.name)
  }
})

test('nothing is drawn outside the artboard', () => {
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      for (const element of factory.scene(formatKey, format, index).elements) {
        assert.ok(element.x >= -1 && element.y >= -1
          && element.x + element.width <= format.w + 1
          && element.y + element.height <= format.h + 1,
          `${formatKey}#${index} "${element.name}" at ${element.x},${element.y} ${element.width}×${element.height} escapes ${format.w}×${format.h}`)
      }
    }
  }
})

test('the fitter always returns a size that fits, in whole pixels', () => {
  // The reported defect: a headline sized for a box it could not fit, rendered
  // clipped mid-word. Text is measured against the value a binding token will
  // become, which is what the factory fits against.
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      for (const element of factory.scene(formatKey, format, index).elements) {
        if (element.type !== 'text') continue
        const over = textOverflow(element)
        assert.ok(over.horizontal <= 0.01, `${formatKey}#${index} "${element.text}" is wider than its ${element.width}px box`)
        assert.ok(over.vertical <= 1, `${formatKey}#${index} "${element.name}" is taller than its ${element.height}px box`)
        // A below-minimum pass once walked down from a fractional floor and
        // shipped fontSize: 13.101529717988264. It happens twice in 23,000
        // designs, so it is only caught by a pass that walks all of them.
        assert.equal(element.fontSize, Math.round(element.fontSize),
          `${formatKey}#${index} "${element.name}" has fontSize ${element.fontSize}`)
      }
    }
  }
})

test('type never collides with other type, or sits on a photo unprotected', () => {
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      const elements = factory.scene(formatKey, format, index).elements
      const texts = elements.filter(e => e.type === 'text')
      const photos = elements.filter(e => e.type === 'vehicle-image')
      for (let a = 0; a < texts.length; a++) {
        for (let b = a + 1; b < texts.length; b++) {
          assert.ok(!overlaps(texts[a], texts[b]), `${formatKey}#${index}: "${texts[a].name}" overlaps "${texts[b].name}"`)
        }
      }
      for (const text of texts) {
        for (const photo of photos) {
          if (!overlaps(text, photo)) continue
          // Type over a photo is a legitimate treatment when something opaque
          // enough is painted between them. Type over raw photography is not.
          const shielded = elements.some(shape => shape.type === 'shape' && shape.z > photo.z && shape.z < text.z
            && (shape.opacity == null ? 1 : shape.opacity) >= 0.55 && contains(shape, text))
          assert.ok(shielded, `${formatKey}#${index}: "${text.name}" sits on "${photo.name}" with no scrim between them`)
        }
      }
    }
  }
})

test('every line of type meets WCAG contrast against what is behind it', () => {
  let checked = 0
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      const scene = factory.scene(formatKey, format, index)
      for (const text of scene.elements.filter(e => e.type === 'text')) {
        const backdrop = backdropUnder(scene, text)
        const ratio = contrast(toRgb(text.fill), backdrop)
        // WCAG large text is >=24px, or >=18.66px bold.
        const large = text.fontSize >= 24 || (text.fontSize >= 19 && Number(text.fontWeight) >= 700)
        const required = large ? 3 : 4.5
        assert.ok(ratio >= required,
          `${formatKey}#${index} "${text.name}" (${text.fontSize}px) is ${ratio.toFixed(2)}:1, below ${required}:1`)
        checked += 1
      }
    }
  }
  assert.ok(checked > 100000, `expected the whole catalogue to be checked, only saw ${checked} lines`)
})

test('the first screenful shows the range, not one corner of it', () => {
  // Variants are addressed by a stride through the combination space. A stride
  // that advances only the fastest-changing field still yields a thousand
  // distinct designs while showing nine of twenty-four palettes on the first
  // page — and the first page is the one people judge the product by.
  const PAGE = 24
  const [formatKey, format] = FORMAT_ENTRIES[0]
  const grounds = new Set(), layouts = new Set(), campaigns = new Set()
  let light = 0
  for (let index = 0; index < PAGE; index++) {
    const scene = factory.scene(formatKey, format, index)
    const descriptor = factory.descriptor(formatKey, format, index)
    grounds.add(scene.background.color)
    layouts.add(descriptor.name.split(' · ')[1])
    campaigns.add(descriptor.name.split(' · ')[0])
    if (luminance(toRgb(scene.background.color)) >= 0.55) light += 1
  }
  assert.ok(grounds.size >= 18, `only ${grounds.size} palettes in the first ${PAGE} designs`)
  assert.ok(layouts.size >= 8, `only ${layouts.size} layouts in the first ${PAGE} designs`)
  assert.ok(campaigns.size >= 8, `only ${campaigns.size} campaigns in the first ${PAGE} designs`)
  assert.ok(light >= 2, `no light designs in the first ${PAGE} — the grid opens as a wall of dark cards`)
})

test('the same index gives a different design in each size', () => {
  // Otherwise browsing "all sizes" is the same campaign repeated twenty-three
  // times down the page.
  const names = FORMAT_ENTRIES.map(([formatKey, format]) => factory.descriptor(formatKey, format, 0).name)
  assert.ok(new Set(names).size >= FORMAT_ENTRIES.length - 2,
    `index 0 gave only ${new Set(names).size} distinct designs across ${FORMAT_ENTRIES.length} sizes`)
})

test('a layout is only used at proportions it was designed for', () => {
  // A leaderboard division stretched over a 1200×630 canvas turns its button
  // into a lozenge half the height of the artboard.
  const leaderboardOnly = ['Compact Bar', 'Compact Bar Reversed', 'Wide Scrim']
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    if (factory.aspectClass(format.w, format.h) === 'ultrawide') continue
    for (let index = 0; index < 200; index++) {
      const layout = factory.descriptor(formatKey, format, index).name.split(' · ')[1]
      assert.ok(!leaderboardOnly.includes(layout), `${formatKey} (${format.w}×${format.h}) was given the ${layout} layout`)
    }
  }
})

test('a scrim over a photograph is always dark', () => {
  // A scrim earns its place by pushing a photograph back so type can sit on it.
  // Taking its colour from the palette means the five light palettes paint a
  // pale wash that hides nothing — the photo still competes with the headline,
  // and the design reads as a mistake even where the contrast maths passes
  // because the type flipped to dark.
  for (const [formatKey, format] of FORMAT_ENTRIES) {
    for (let index = 0; index < factory.VARIANTS_PER_FORMAT; index++) {
      const elements = factory.scene(formatKey, format, index).elements
      const photos = elements.filter(e => e.type === 'vehicle-image')
      if (!photos.length) continue
      for (const shape of elements.filter(e => e.type === 'shape')) {
        const alpha = shape.opacity == null ? 1 : shape.opacity
        // Only partly transparent shapes laid over a photo are scrims; an
        // opaque panel is a panel and may be any colour the palette likes.
        if (alpha >= 1 || alpha < 0.2) continue
        if (!photos.some(photo => photo.z < shape.z && contains(shape, photo))) continue
        assert.ok(luminance(toRgb(shape.fill)) < 0.5,
          `${formatKey}#${index}: "${shape.name}" veils a photograph in ${shape.fill}, which is too light to be a scrim`)
      }
    }
  }
})
