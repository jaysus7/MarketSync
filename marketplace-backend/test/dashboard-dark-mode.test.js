import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const FRONTEND = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FRONTEND), 'utf8')

const academyFix = read('js/modules/academy-theme-fix.js')
const dashboardHtml = read('dashboard.html')
const companionLoader = read('js/modules/website-mobile-layout.js')

// The defect this pins. academy-theme-fix.js is loaded by the ALWAYS-ON
// dashboard companion loader, not by an Academy page. It used to run
//
//     if (ms-theme !== 'dark') document.documentElement.classList.remove('dark')
//
// at load, which stripped dark mode off <html> for the ENTIRE dashboard --
// MarketSync HQ included -- on every single boot. Nothing restored it: the
// inline bootstrap in dashboard.html only toggles `dark` on a
// prefers-color-scheme CHANGE event, never again on load. And the opt-out it
// checked is written only by training.js, a different page, so a dashboard
// user could never have set it. Dark mode was dead app-wide.
test('academy-theme-fix is loaded on every dashboard boot, not only on Academy', () => {
  assert.match(
    companionLoader, /academy-theme-fix\.js/,
    'the always-on companion loader still loads this module, so anything it does to <html> is global'
  )
  const htmlFiles = readdirSync(FRONTEND).filter((f) => f.endsWith('.html'))
  const loadedByAPage = htmlFiles.filter((f) => read(f).includes('academy-theme-fix'))
  assert.deepEqual(
    loadedByAPage, [],
    'no standalone page loads this module, so it only ever runs inside the dashboard SPA'
  )
})

test('the global dark class is never stripped at load', () => {
  // Scan executable code only. This file documents the old bug in a comment,
  // and a comment describing a strip is not a strip.
  const code = academyFix.replace(/^\s*\/\/.*$/gm, '')

  const strips = [...code.matchAll(/classList\.remove\(\s*['"]dark['"]\s*\)/g)]
  assert.ok(strips.length > 0, 'Academy still needs its light treatment while it is on screen')

  for (const m of strips) {
    // Every strip must be guarded by the on-screen check rather than running
    // at module scope, which is what made it global.
    assert.match(
      code.slice(Math.max(0, m.index - 400), m.index), /academyOnScreen\(\)/,
      'a dark-class strip must be guarded by academyOnScreen()'
    )
  }

  // And the guard must be a real branch, not a comment: the strip sits after
  // syncAcademyTheme is opened and before the module's IIFE closes.
  const syncAt = code.indexOf('function syncAcademyTheme')
  assert.ok(syncAt > 0, 'syncAcademyTheme should exist')
  for (const m of strips) {
    assert.ok(m.index > syncAt, 'classList.remove("dark") must live inside syncAcademyTheme, not above it')
  }
})

test('leaving Academy restores the theme it took away', () => {
  assert.match(academyFix, /msAcademyLight/, 'the module must record that IT dimmed the theme')
  assert.match(academyFix, /function restoreTheme/, 'and must be able to put it back')
  assert.match(
    academyFix, /delete root\.dataset\.msAcademyLight;\s*\n\s*restoreTheme\(\)/,
    'restoring must clear the marker and re-apply the real theme'
  )
  // Restoration has to consult the OS, which is the dashboard's only theme
  // source today -- not hardcode light.
  assert.match(academyFix, /prefers-color-scheme: dark/)
})

test('academyOnScreen treats the SPA hidden class as not-on-screen', () => {
  // Every dashboard page container is toggled with `.hidden`; a check that only
  // looked for element presence would think Academy is always on screen and
  // would keep dark mode permanently off.
  assert.match(dashboardHtml, /data-page-content="academy" class="page-content hidden/)
  assert.match(academyFix, /classList\.contains\('hidden'\)/)
})

test('no other dashboard module strips the dark class', () => {
  const modules = readdirSync(new URL('js/modules/', FRONTEND)).filter((f) => f.endsWith('.js'))
  const offenders = modules.filter((f) => {
    if (f === 'academy-theme-fix.js') return false
    return /documentElement\.classList\.remove\([^)]*['"]dark['"]/.test(read(`js/modules/${f}`))
  })
  assert.deepEqual(offenders, [], 'only the Academy light treatment may touch the global dark class')
})
