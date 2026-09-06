import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const src = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-context-toolbar.js', import.meta.url), 'utf8')
const code = stripComments(src)
const css = src.match(/style\.textContent = `([\s\S]*?)`;/)?.[1] || ''

test('the context sheet follows the app theme instead of forcing dark', () => {
  // It was hardcoded `background:#0f172a;color:#fff` inside an editor that is light
  // by default, so every panel opened as a black slab over a white workspace.
  const sheet = css.match(/#studio-context-sheet\{[^}]*\}/)?.[0] || ''
  assert.ok(sheet, 'the sheet must be styled')
  assert.match(sheet, /background:#fff/, 'the default sheet must be light')
  assert.match(css, /\.dark #studio-context-sheet\{[^}]*background:#0f172a/,
    'dark must be scoped to .dark, not applied to both themes')
  for (const rule of ['.dark #studio-context-sheet label', '.dark #studio-context-sheet input']) {
    assert.ok(css.includes(rule), `${rule} needs a dark counterpart, or text goes invisible`)
  }
})

test('Fill offers a colour grid, not just a drag bar', () => {
  assert.match(code, /function colorSheetHtml/)
  assert.match(code, /const STUDIO_FILL_NEUTRALS = \[/)
  assert.match(code, /const STUDIO_FILL_COLOURS = \[/)

  // Read the shipped palettes rather than counting by eye.
  const grab = (name) => {
    const body = code.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'))?.[1] || ''
    return body.split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean)
  }
  const neutrals = grab('STUDIO_FILL_NEUTRALS')
  const colours = grab('STUDIO_FILL_COLOURS')
  assert.equal(neutrals.length, 8, 'the neutrals row should fill the 8-column grid exactly')
  assert.equal(colours.length % 8, 0, 'the colour grid should not leave a ragged last row')
  assert.ok(colours.length >= 32, `a grid worth tapping needs real choice, got ${colours.length}`)
  for (const hex of neutrals.concat(colours)) {
    assert.match(hex, /^#[0-9A-F]{6}$/, `${hex} must be a full uppercase hex so selection matching works`)
  }
  assert.equal(new Set(colours).size, colours.length, 'no duplicate swatches')

  // The native picker stays for an exact value.
  assert.match(code, /id="studio-fill-custom"/)
})

test('tapping a swatch applies it and shows which one is active', () => {
  assert.match(code, /function applyFill/)
  assert.match(code, /studioSetObjectStyle\('color', hex\)/, 'a swatch must set the fill')
  assert.match(code, /aria-pressed/, 'the active swatch must be marked, not just outlined')
  assert.match(code, /studio-fill-chip/, 'the current colour must be shown back to the user')
  // Delegated, so re-rendering the sheet cannot leave dead swatches behind.
  assert.match(code, /document\.addEventListener\('click'[\s\S]*?data-studio-fill/)
})
