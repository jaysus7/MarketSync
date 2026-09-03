import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')

test('Design Studio header is split into two stacked layers: identity on top, toolbar actions below', () => {
  const identityHeader = studio.match(/<header class="studio-identity-bar h-14 bg-white dark:bg-slate-900[\s\S]*?<\/header>/)?.[0] || ''
  assert.ok(identityHeader, 'the identity header (logo, back button, design name) must exist')
  assert.match(identityHeader, /closeMarketSyncStudio\(\)/)
  assert.doesNotMatch(identityHeader, /zoomStudioIn|saveStudioDesign\(\)|renderStudioDesignAndPublish/,
    'toolbar action buttons must not live in the identity header any more')

  const toolbarLayer = studio.match(/<!-- Toolbar layer -->[\s\S]*?<\/div>\s*<\/div>\s*\n\s*<!-- Main Workspace Body -->/)?.[0] || ''
  assert.ok(toolbarLayer, 'a distinct toolbar layer must exist below the identity header')
  assert.match(toolbarLayer, /zoomStudioIn\(\)/)
  assert.match(toolbarLayer, /saveStudioDesign\(\)/)
  assert.match(toolbarLayer, /renderStudioDesignAndPublish\(\)/)
  assert.match(toolbarLayer, /openStudioScheduler/)
})

test('translucent indigo/blue accents in the toolbar get a solid, readable light-mode pairing', () => {
  // bg-X/20 + text-X-400 (or similar) was designed for a permanently-dark shell —
  // in light mode it renders as pale background + light text, unreadable. These
  // now go solid-indigo-with-white-text for light mode, keeping the original
  // translucent look under dark:.
  assert.match(studio, /bg-indigo-600 text-white dark:bg-indigo-600\/20 dark:text-indigo-300/, 'the Design Studio badge must be readable in light mode')
  assert.match(studio, /id="studio-guides-toggle"[^>]*bg-indigo-600 text-white dark:bg-blue-600\/20/, 'the Guides toggle button must be readable in light mode')
  assert.match(studio, /bg-emerald-600 text-white dark:bg-emerald-500\/20/, 'the SAVED status pill must be readable in light mode')
  assert.match(studio, /id="studio-zoom-display" class="px-2 text-xs font-mono font-bold text-indigo-600 dark:text-sky-400"/, 'the zoom percentage must be readable in light mode')
})
