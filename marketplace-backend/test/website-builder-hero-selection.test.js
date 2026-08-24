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
  assert.match(dashboard, /dashboard-part17\.js\?v=20260824_seo_default_builder_v1/)
})
