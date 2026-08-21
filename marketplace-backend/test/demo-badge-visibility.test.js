import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')
const videoStudio = readFileSync(new URL('../../marketplace-frontend/js/modules/video-studio.js', import.meta.url), 'utf8')
const demoPanel = readFileSync(new URL('../../marketplace-frontend/js/modules/demo-control-panel.js', import.meta.url), 'utf8')

function zOf(selector) {
  const block = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\{[^}]*\\}`))?.[0] || ''
  return Number((block.match(/z-index:\s*(\d+)/) || [])[1] || 0)
}

test('the DEMO MODE badge sits above every product full-screen modal so it is never buried', () => {
  const badgeZ = zOf('#demo-mode-badge')
  const panelZ = zOf('#demo-control-panel')
  assert.ok(badgeZ > 0 && panelZ > 0, 'badge and panel must set a z-index')
  // Highest z-index used by the Video studio and its sub-modals.
  const modalZs = [...videoStudio.matchAll(/z-\[(\d+)\]/g)].map(m => Number(m[1]))
  const maxModal = Math.max(0, ...modalZs)
  assert.ok(maxModal >= 99999, 'sanity: the video studio uses very high z-index modals')
  assert.ok(badgeZ > maxModal, `demo badge (${badgeZ}) must outrank the top product modal (${maxModal})`)
  assert.ok(panelZ > maxModal, `demo control panel (${panelZ}) must outrank the top product modal (${maxModal})`)
})

test('the demo badge is appended before the control panel is built, so a panel error can never drop it', () => {
  const fn = demoPanel.match(/function buildPanel\(data\) \{[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'buildPanel must exist')
  const badgeAppend = fn.indexOf("appendChild(badge)")
  const panelBuild = fn.indexOf('panel.innerHTML')
  assert.ok(badgeAppend > -1, 'the badge must be appended in buildPanel')
  assert.ok(panelBuild > -1, 'the panel is still built')
  assert.ok(badgeAppend < panelBuild, 'the badge must be appended BEFORE the panel is constructed')
  // And it must not force a single-product demo onto the (nonexistent) Inventory page.
  assert.match(demoPanel, /isSingleProductWorkspace\(\)/)
  assert.match(demoPanel, /isMarketingSuiteDemo/)
  assert.match(demoPanel, /deptGo\('marketing-overview', '', 'overview'\)/,
    'marketing suite demos must load their Pulse engine and overview tab')
  assert.match(demoPanel, /else if \(typeof switchPage === 'function' && !singleProduct\)/,
    'the legacy inventory fallback remains limited to non-suite, non-standalone demos')
})

test('all four marketing suite demo packages use their canonical suite product gate', () => {
  for (const suite of ['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite', 'marketsync-digital']) {
    assert.match(demoPanel, new RegExp(`'${suite.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}'\\s*:\\s*\\{\\s*'${suite.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}'\\s*:\\s*true`),
      `${suite} must not fall through to DealerOS`)
  }
})
