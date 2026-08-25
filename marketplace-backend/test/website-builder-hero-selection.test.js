import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const builderPath = path.resolve(here, '../../marketplace-frontend/js/modules/dashboard-part17.js')
const dashboardPath = path.resolve(here, '../../marketplace-frontend/dashboard.html')
const builder = fs.readFileSync(builderPath, 'utf8')
const dashboard = fs.readFileSync(dashboardPath, 'utf8')

test('Website Builder opens with the first editable section selected', () => {
  assert.match(builder, /function selectFirstEditableWsSection\(\)/)
  assert.match(builder, /__wsSelectedSecIdx = \(__siteSections \|\| \[\]\)\.length \? 0 : null/)
  assert.match(builder, /function openWebsiteBuilder\(\) \{[\s\S]*?selectFirstEditableWsSection\(\)/)
  assert.match(builder, /function wsSetTarget\(v\) \{[\s\S]*?selectFirstEditableWsSection\(\)/)
})

test('Hero has canonical editable fields and the dashboard loads the fixed builder asset', () => {
  assert.match(builder, /hero:\s*\{ label: 'Hero', fields: \[\['bg','Background style','herobg'\]/)
  assert.match(builder, /\['headline','Headline','text'\]/)
  assert.match(builder, /\['subheadline','Subheadline','text'\]/)
  assert.match(builder, /\['image','Or upload a photo','image'\]/)
  // This used to pin one exact version literal, which meant every legitimate builder
  // change broke this test and the "fix" was to paste in the new string — a check
  // that only ever passes because you updated it is not a check. What actually
  // matters is that the asset is cache-busted at all (a dated version), so a browser
  // holding a stale dashboard-part17.js picks the new one up.
  const v = dashboard.match(/dashboard-part17\.js\?v=([\w]+)/)
  assert.ok(v, 'dashboard.html must load dashboard-part17.js with a ?v= cache-bust')
  assert.match(v[1], /^\d{8}_\w+$/, `builder cache-bust should be a dated version, got "${v[1]}"`)
})
