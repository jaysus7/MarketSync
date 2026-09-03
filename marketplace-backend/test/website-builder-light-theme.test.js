import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const builder = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

function themedNode() {
  const classes = new Set()
  return {
    attributes: new Map(),
    classList: {
      contains: value => classes.has(value),
      toggle(value, force) { force ? classes.add(value) : classes.delete(value) },
    },
    setAttribute(name, value) { this.attributes.set(name, value) },
  }
}

test('Website Builder applies the effective theme to the actual workbench owner', () => {
  const start = builder.indexOf('let __builderTheme')
  const end = builder.indexOf("if (typeof window !== 'undefined' && window.matchMedia)", start)
  assert.ok(start >= 0 && end > start, 'builder theme implementation was not found')

  const studio = themedNode()
  const container = themedNode()
  const root = themedNode()
  const body = themedNode()
  const html = themedNode()
  const context = {
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: () => 'light', setItem() {} },
    document: {
      body,
      documentElement: html,
      getElementById(id) {
        return id === 'page-content-website' ? container : id === 'website-root' ? root : null
      },
      querySelector(selector) { return selector === '.ws-studio-container' ? studio : null },
    },
  }
  vm.runInNewContext(builder.slice(start, end), context)
  context.window.applyBuilderTheme()

  for (const node of [container, root, studio, body, html]) {
    assert.equal(node.attributes.get('data-ws-theme'), 'light')
    assert.equal(node.classList.contains('ws-theme-light'), true)
    assert.equal(node.classList.contains('ws-theme-dark'), false)
  }
})

test('newly rendered Website Builder workbench receives a post-insert theme pass', () => {
  const render = builder.slice(builder.indexOf('function renderLiveBuilder(body)'), builder.indexOf('function wsBlog()'))
  assert.match(render, /body\.innerHTML\s*=\s*`[\s\S]*?`;\s*\/\/ The workbench is inserted[\s\S]*?applyBuilderTheme\(\);\s*renderWsLayersTree\(\);/)
})
