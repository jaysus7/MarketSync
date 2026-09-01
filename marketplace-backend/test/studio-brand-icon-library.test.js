import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studioShell = readFileSync(
  new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url),
  'utf8'
)

test('Design Studio brand icon library initializes as a unique mapped array', () => {
  const declaration = studioShell.match(/const STUDIO_BRAND_ICON_LIBRARY = (.+);/)
  assert.ok(declaration, 'brand icon library declaration should exist')

  const icons = Function(`return (${declaration[1]})`)()
  assert.ok(Array.isArray(icons))
  assert.ok(icons.length > 100)
  assert.equal(new Set(icons.map((icon) => icon.name)).size, icons.length)
  assert.deepEqual(icons[0], {
    id: 'brand-icon-1',
    name: 'facebook',
    label: 'facebook'
  })
  assert.ok(icons.some((icon) => icon.name === 'pinterest'))
})
