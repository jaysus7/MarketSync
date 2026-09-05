import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const loader = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const version = '20260902_staging_repair_v1'
const builderVersion = '20260903_appraisal_theme_v1'
const studioDepthVersion = '20260903_studio_format_templates_v1'
const previewBootVersion = '20260903_website_light_theme_v1'
const hqIaVersion = '20260905_hq_ia_freeze_v1'

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

  // marketsync-theme.css was bumped again for Design Studio mobile rules.
  assert.ok(html.includes('css/marketsync-theme.css?v=20260905_studio_variants_v1'), 'marketsync-theme.css mobile studio cache version is stale')
  // dashboard-part2.js was rebumped for the HQ IA freeze (Phase 1 finalization).
  assert.ok(html.includes(`js/modules/dashboard-part2.js?v=${hqIaVersion}`), 'dashboard-part2.js HQ IA cache version is stale')

  assert.ok(html.includes(`js/modules/dashboard-part17.js?v=${previewBootVersion}`), 'website preview cache version is stale')

  // studio-shell was rebumped for the Design Studio template + element fixes.
  assert.equal((loader.match(/js\/modules\/studio\/studio-shell\.js\?v=20260905_studio_variants_v1/g) || []).length, 2)
})
