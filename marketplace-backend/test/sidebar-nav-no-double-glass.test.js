import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

// #dashboard-nav (the 248px sidebar's actual nav element — it carries the literal
// bg-white/dark:bg-slate-900 Tailwind classes) has its own dedicated reset rule
// later in the cascade (background/border/shadow/backdrop-filter all cleared),
// specifically so the ONE glass surface for the whole sidebar column is
// #dept-sidebar and #dashboard-nav renders transparent inside it — see the
// "Sidebar glass consolidation" comment already in this file, written to fix this
// exact class of bug for the legacy #nav-desktop element.
//
// But `.bg-white:not(#studio-artboard-container)` (a class + a :not() whose
// argument is an ID) carries higher CSS specificity than a bare `#dashboard-nav`
// rule, so it kept winning regardless of source order — #dashboard-nav re-painted
// its own competing glass panel (background/blur/shadow) a few pixels inside
// #dept-sidebar's, reading as two stacked nav boxes with a hard seam between them.
// Confirmed visually: a static repro against the real built CSS showed a sharp
// inner white box nested inside the sidebar's own panel; excluding #dashboard-nav
// from the broadened selector (the same pattern already used for the Studio
// artboard) collapses it back to one continuous panel.
test('the broadened Liquid Glass selector excludes #dashboard-nav everywhere it excludes the Studio artboard', () => {
  const studioCount = (css.match(/(?:\.bg-white|\.dark\\:bg-slate-900):not\(#studio-artboard-container\)/g) || []).length
  const dashboardNavCount = (css.match(/(?:\.bg-white|\.dark\\:bg-slate-900):not\(#studio-artboard-container\):not\(#dashboard-nav\)/g) || []).length
  assert.equal(dashboardNavCount, studioCount,
    'every broadened glass selector that excludes the Studio artboard must also exclude #dashboard-nav')
  assert.equal(studioCount, 8)
})

test('the sidebar wrapper keeps its dedicated transparent reset rule so it renders as one continuous panel', () => {
  assert.match(css, /#(?:dept-sidebar|dashboard-nav)\s*\{[^}]*background:\s*transparent\s*!important/,
    'the sidebar wrapper reset that makes it render as a single glass surface must still exist')
})
