import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../routes/marketing-studio.js', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../supabase/migrations/20260830124350_design_studio_project_folders.sql', import.meta.url), 'utf8')

test('Studio folders extend canonical designs without creating duplicate project records', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.studio_project_folders/)
  assert.match(migration, /ALTER TABLE public\.studio_designs\s+ADD COLUMN IF NOT EXISTS folder_id/)
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS public\.studio_projects/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /dealership_id = authz\.current_dealership_id\(\)/)
})

test('project folder APIs are tenant-scoped and validate drag/drop destinations', () => {
  for (const endpoint of [
    "app.get('/marketing/studio/folders'",
    "app.post('/marketing/studio/folders'",
    "app.put('/marketing/studio/folders/:id'",
    "app.delete('/marketing/studio/folders/:id'",
  ]) assert.ok(route.includes(endpoint), endpoint)
  const folderRoutes = route.match(/\/marketing\/studio\/folders[\s\S]+?\/\/ ── Studio Designs CRUD/)?.[0] || ''
  assert.match(folderRoutes, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(route, /Choose a valid project folder\./)
  assert.match(route, /folder_id: req\.body\?\.folder_id/)
})

test('Design Studio landing page shows projects and the connected asset library', () => {
  for (const label of ['My projects', 'My assets / library', 'New folder', 'New design']) assert.ok(workspace.includes(label), label)
  assert.match(workspace, /apiGetJson\('\/marketing\/studio\/designs'\)/)
  assert.match(workspace, /apiGetJson\('\/marketing\/studio\/folders'\)/)
  assert.match(workspace, /apiGetJson\('\/marketing\/assets'\)/)
  assert.match(workspace, /mktRenderStudioProjectLibrary/)
  assert.match(workspace, /mktRenderStudioAssets/)
})

test('saved designs can be dragged into folders or back to Unfiled', () => {
  assert.match(workspace, /draggable="true"/)
  assert.match(workspace, /mktStartStudioProjectDrag/)
  assert.match(workspace, /mktDropStudioProject/)
  assert.match(workspace, /folder_id: targetFolderId/)
  assert.match(workspace, /Moved to Unfiled/)
})

test('asset uploads keep images and videos in the canonical media endpoints', () => {
  assert.match(workspace, /\^video\\\/\/\.test\(file\.type/)
  assert.match(workspace, /'\/marketing\/assets\/video'/)
  assert.match(workspace, /'\/marketing\/assets'/)
  assert.match(workspace, /fd\.append\('title', file\.name\)/)
})
