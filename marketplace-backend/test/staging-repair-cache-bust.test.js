import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const loader = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const version = '20260902_staging_repair_v1'
const builderVersion = '20260902_builder_workbench_v1'
const studioDepthVersion = '20260902_studio_depth_v1'

test('every frontend asset edited by the staging repair has the release cache version', () => {
  for (const asset of [
    'js/modules/workspace-registry.js',
    'dashboard.js',
    'js/modules/dashboard-part18.js',
    'js/modules/marketing-workspace.js',
  ]) assert.ok(html.includes(`${asset}?v=${version}`), `${asset} cache version is stale`)

  for (const asset of ['css/ms-liquid-glass.css']) {
    assert.ok(html.includes(`${asset}?v=${builderVersion}`), `${asset} builder cache version is stale`)
  }

  for (const asset of ['css/marketsync-theme.css', 'js/modules/dashboard-part2.js', 'js/modules/dashboard-part17.js']) {
    assert.ok(html.includes(`${asset}?v=${studioDepthVersion}`), `${asset} Studio depth cache version is stale`)
  }

  assert.equal((loader.match(new RegExp(`js/modules/studio/studio-shell\\.js\\?v=${studioDepthVersion}`, 'g')) || []).length, 2)
})
