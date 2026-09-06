import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const ws = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')

// renderDeptTabbar already carries the rule: "A registered engine already owns the
// department title and primary tabs. Rendering the registry's legacy page tabs above
// it creates two competing headers." The Marketing branch returned before reaching
// that check, so marketing-overview — which registers an engine — rendered the
// studio switcher AND the engine's own tab bar, one on top of the other.
test('the Marketing studio switcher defers to a page that owns an engine tab bar', () => {
  const src = code(part2)
  assert.match(src, /if \(dealerDeptId === 'marketing' && !\(typeof ENGINES !== 'undefined' && ENGINES\[pageId\]\)\)/,
    'the Marketing switcher must not render on a page that has its own engine tabs')

  // It must still render for the marketing pages that have no engine tab bar,
  // which is what keeps a user from being stranded inside one studio.
  const branch = src.slice(src.indexOf("if (dealerDeptId === 'marketing'"))
  assert.match(branch, /aria-label="Marketing Studios"/, 'the switcher itself must survive')
  assert.match(branch, /dept\.pages\.filter\(deptPageAllowed\)/, 'it must still list the department pages')
})

test('every studio the switcher offers is reachable as a marketing engine tab', () => {
  // Hiding the switcher on marketing-overview is only safe because the engine tab
  // bar underneath covers the same destinations.
  const tabOrder = code(ws).match(/get tabOrder\(\)[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(tabOrder, 'the marketing engine must declare its tabs')
  for (const tab of ['studio', 'video-studio', 'website', 'automations', 'campaigns']) {
    assert.ok(tabOrder.includes(`'${tab}'`), `${tab} must stay an engine tab, or the switcher cannot be hidden`)
  }
  const labels = code(ws).match(/tabLabels: \{[\s\S]*?\},/)?.[0] || ''
  assert.match(labels, /studio: 'Design Studio'/)
  assert.match(labels, /overview: 'Pulse'/, 'Pulse exists only here, so the engine tab bar must stay')
})

test('the engine header still does not repeat the page title', () => {
  assert.match(code(ws), /ENGINES\['marketing-overview'\] = \{[\s\S]{0,400}hideTitle: true/)
})
