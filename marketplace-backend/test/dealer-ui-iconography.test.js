import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = rel => readFileSync(new URL(rel, FE), 'utf8')
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const emoji = /[\p{Extended_Pictographic}]/u

test('canonical Dealer OS workspaces use the product icon system, not emoji UI', () => {
  const workspaces = [
    'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing',
    'academy', 'launch', 'people',
  ]
  for (const name of workspaces) {
    const source = code(read(`js/modules/${name}-workspace.js`))
    assert.doesNotMatch(source, emoji, `${name} workspace contains a hardcoded emoji`)
  }
  assert.doesNotMatch(code(read('js/modules/workspace-registry.js')), emoji)
})

test('the active structured Settings landing contains no emoji decoration', () => {
  const source = read('js/modules/dashboard-part9.js')
  const active = source.match(/function loadConfigHub\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(active, 'structured Settings landing not found')
  assert.doesNotMatch(active, emoji)
})
