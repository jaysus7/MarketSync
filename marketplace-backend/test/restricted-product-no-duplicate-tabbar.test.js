import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardPart2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

// A restricted single-product workspace (Website, AI, Facebook, etc.) gets its
// destinations listed twice by default: once in the sidebar (renderDeptNav's
// !registry branch, built from restrictedNavPages() when __deptNavBuilt is set),
// and again in the top #dept-tabbar (renderDeptTabbar's standalone-products
// fallback, also built from restrictedNavPages()). Once the sidebar has already
// rendered that flat list, repeating it in the tab strip above the page content is
// a duplicate nav, not a fallback — the exact "headers that are also on the main
// nav" problem this codebase already fixed once for the marketing-suite tab strip
// (see marketing-suite-navigation.test.js). The tab strip should only step in when
// the sidebar hasn't built that flat list.
test('the standalone-product tab strip in renderDeptTabbar only renders when the sidebar has not already built the same flat nav', () => {
  const fnStart = dashboardPart2.indexOf('function renderDeptTabbar')
  const fnBody = dashboardPart2.slice(fnStart, dashboardPart2.indexOf('\nfunction ', fnStart + 1))
  assert.match(
    fnBody,
    /if \(!__deptNavBuilt && restricted && restricted\.length > 1 && \(__productAllowedPages \|\| __fbOnly \|\| __staffAllowedPages \|\| workspaceContext\?\.type === 'website'\)\) \{/,
    'renderDeptTabbar\'s standalone-product tab strip must be gated on !__deptNavBuilt so it never duplicates the sidebar'
  )
})
