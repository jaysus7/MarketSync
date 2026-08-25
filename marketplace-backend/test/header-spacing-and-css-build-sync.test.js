import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const dashboard = readFileSync(path.join(FRONTEND, 'dashboard.html'), 'utf8')
const builtCss = readFileSync(path.join(FRONTEND, 'css', 'tailwind-built.css'), 'utf8')

// <main>'s pt-* only has to clear the fixed header's own height (~61-68px) — it never
// accounted for the header also carrying the site-wide Liquid Glass box-shadow
// (0 18px 50px), whose visible blur extended well past that gap and read as the page
// content pressing right up against the header ("needs space to breathe from the main
// nav on top"). Bumped from 92/96px to 112/116px so the shadow has room to fall off
// before the first card starts.
test('the dashboard <main> wrapper reserves extra top padding to clear the header\'s glass shadow', () => {
  const mainTag = dashboard.slice(dashboard.indexOf('<main'), dashboard.indexOf('<main') + 400)
  assert.match(mainTag, /pt-\[112px\]/, '<main> should reserve 112px of top padding on mobile')
  assert.match(mainTag, /sm:pt-\[116px\]/, '<main> should reserve 116px of top padding at the sm breakpoint')
})

// Pre-built Tailwind CSS is static: a brand-new arbitrary-value utility class added to
// HTML source (pt-[112px] never existed anywhere before this fix) does NOT exist in
// the checked-in CSS until `npm run build:css` regenerates it — unlike the old Play
// CDN, there's no live JIT scan to silently pick it up. Editing dashboard.html without
// rebuilding left <main> with effectively zero top padding (worse than the original
// bug: real content started rendering underneath/behind the fixed header instead of
// merely close to it). Caught by measuring actual computed layout with Playwright
// against the real built CSS before this test existed; this test pins the built
// output going forward so a future edit that forgets the rebuild step fails loudly
// instead of silently.
test('the new pt-[112px]/sm:pt-[116px] utilities actually exist in the built Tailwind CSS (not just the HTML source)', () => {
  assert.match(builtCss, /\.pt-\\\[112px\\\]\{padding-top:112px\}/,
    'run `npm run build:css` in marketplace-backend — pt-[112px] is missing from the built CSS')
  assert.match(builtCss, /\.sm\\:pt-\\\[116px\\\]\{padding-top:116px\}/,
    'run `npm run build:css` in marketplace-backend — sm:pt-[116px] is missing from the built CSS')
})

// Every page that links tailwind-built.css or tailwind-built-media.css must use the
// SAME cache-bust version — a flat literal was chosen (not per-page) when the CDN
// migration shipped, so a stale version string on any one page silently serves an
// old cached build after the CSS content changes underneath it.
test('every page references the same tailwind-built(-media).css cache-bust version', () => {
  const htmlFiles = readdirSync(FRONTEND).filter((f) => f.endsWith('.html'))
  const versions = new Set()
  for (const f of htmlFiles) {
    const text = readFileSync(path.join(FRONTEND, f), 'utf8')
    for (const m of text.matchAll(/tailwind-built(?:-media)?\.css\?v=([\w]+)/g)) versions.add(m[1])
  }
  assert.equal(versions.size, 1, `expected exactly one cache-bust version across all pages, found: ${[...versions].join(', ')}`)
})
