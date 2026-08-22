import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const registry = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')

test('the retired global Insights/Pulse is removed and old links resolve to workspace Pulse', () => {
  assert.match(part2, /querySelector\('\[data-page-content="insights"\]'\)\?\.remove\(\)/)
  assert.match(part2, /if \(pageId === 'insights'\)[\s\S]*?dealerRoleLanding/)
  assert.doesNotMatch(registry, /\{ page: 'insights', label: 'Insights'/)
  assert.doesNotMatch(registry, /MS_MOBILE_NAV_DEFAULT = \['insights'/)
  assert.match(part2, /switchPage\(dealerRoleLanding\(profileContext\?\.role\)\)/)
})
