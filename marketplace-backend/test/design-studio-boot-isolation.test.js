import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardPart2 = readFileSync(
  new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url),
  'utf8'
)
const studioShell = readFileSync(
  new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url),
  'utf8'
)

test('Design Studio boots independently from Social Scheduler', () => {
  const studioBranch = dashboardPart2.match(/if \(pageId === 'studio'[\s\S]+?\n  if \(pageId === 'social-scheduler'\)/)?.[0]
  assert.ok(studioBranch, 'Design Studio route branch should exist')
  assert.doesNotMatch(studioBranch, /studio-scheduler\.js/, 'scheduler must not be a Studio boot prerequisite')
  assert.match(studioBranch, /studio-shell\.js\?v=20260905_studio_fixes_v1/)
  assert.match(studioBranch, /catch\(renderMarketSyncStudioBootError\)/)
})

test('Social Scheduler keeps its own lazy-loaded entrypoint', () => {
  const schedulerBranch = dashboardPart2.match(/if \(pageId === 'social-scheduler'\)[\s\S]+?\n  if \(pageId === 'video-studio'\)/)?.[0]
  assert.ok(schedulerBranch, 'Social Scheduler route branch should exist')
  assert.match(schedulerBranch, /studio-scheduler\.js\?v=20260829_pinterest_v1/)
})

test('Studio social icon catalogue does not depend on Set during boot', () => {
  const declaration = studioShell.match(/const STUDIO_BRAND_ICON_LIBRARY = (.+);/)?.[1]
  assert.ok(declaration, 'brand icon declaration should exist')
  assert.doesNotMatch(declaration, /new Set/)
  const icons = Function(`return (${declaration})`)()
  assert.ok(icons.some((icon) => icon.name === 'pinterest'))
  assert.equal(new Set(icons.map((icon) => icon.name)).size, icons.length)
})
