import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Fabric renders the artwork to the LOWER canvas and stacks a transparent UPPER
// canvas over it for selection handles and pointer events. Give that upper layer
// an opaque background and the whole design vanishes behind a blank sheet while
// every other signal still looks healthy: the bitmap has pixels, the object count
// is right, selection works, renderAll() returns clean. It reads exactly like a
// canvas that failed to allocate, which is what sent the last investigation
// chasing WebKit bitmap ceilings.
//
// That is not hypothetical — 5b07ea9 ("flatten stacked artboard/safe-area frames
// into one canvas") added `canvas.upper-canvas` to a `background:#fff !important`
// rule that had previously listed only the lower canvas, and blanked the Design
// Studio artboard on every device for three days.
//
// A background on the LOWER canvas is fine: it paints behind the bitmap and gives
// an empty page its white default. Only the upper layer must stay see-through.

const FRONTEND = new URL('../../marketplace-frontend/', import.meta.url).pathname

function sources() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(js|css)$/.test(full)) out.push(full)
    }
  }
  walk(join(FRONTEND, 'js', 'modules', 'studio'))
  walk(join(FRONTEND, 'css'))
  return out
}

test('nothing paints a background onto fabric\'s upper (interaction) canvas', () => {
  const offenders = []
  for (const file of sources()) {
    // Strip comments first: prose explaining this very rule mentions the upper
    // canvas, and a comment is not a selector.
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ')
    // Every rule body whose selector list mentions the upper canvas.
    for (const m of src.matchAll(/([^{}]*upper-canvas[^{}]*)\{([^{}]*)\}/g)) {
      const [selector, body] = [m[1].replace(/\s+/g, ' ').trim(), m[2]]
      const bg = body.match(/background(?:-color|-image)?\s*:\s*([^;}]+)/)
      if (!bg) continue
      const value = bg[1].trim().replace(/\s*!important\s*$/, '')
      // Explicitly clearing it is the point of the rule, not a violation.
      if (/^(transparent|none|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(value)) continue
      offenders.push(`${file.replace(FRONTEND, '')}: "${selector}" sets background: ${value}`)
    }
  }
  assert.deepEqual(offenders, [],
    `these rules would cover the artwork with an opaque layer:\n  ${offenders.join('\n  ')}`)
})

test('the lower canvas keeps its white default, which is the safe layer to paint', () => {
  const thumbs = readFileSync(join(FRONTEND, 'js/modules/studio/studio-page-thumbs.js'), 'utf8')
  assert.match(thumbs, /canvas\.lower-canvas\{[\s\S]{0,80}background:#fff/,
    'an empty page should still default to white via the lower canvas')
})
