import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const css = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')

// renderEngine() gives every engine the same shell: a two-column grid whose second
// column is a fixed 300px rail. On a Pulse tab that left the widget board at ~74% of
// the width the engine header directly above it spans (896px of 1216px at a 1512px
// viewport, measured against the real built CSS), with a tall dead column beside every
// department section — "the container being boxed and not full width". The shell is
// built once per engine but the collapse is per tab, so it rides on a class toggled
// from engineTab() next to .ms-pulse-board rather than being baked into the shell.
test('engineTab toggles the full-width class on the engine shell grid alongside ms-pulse-board', () => {
  assert.match(part10, /body\.classList\.toggle\('ms-pulse-board', isPulseLayout\)/)
  assert.match(part10, /body\.parentElement\?\.classList\.toggle\('ms-pulse-wide', isPulseLayout\)/,
    'the pulse board and the full-width shell must be toggled from the same place, on the same condition')
})

test('.ms-pulse-wide collapses the shell to one column and lays the rail out as a strip', () => {
  assert.match(css, /\.ms-pulse-wide\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/,
    'the 300px rail column must be gone so the board spans the full content width')
  const railRule = css.match(/\.ms-pulse-wide > \[data-engine-rail\]\s*\{[^}]*\}/)
  assert.ok(railRule, '.ms-pulse-wide > [data-engine-rail] must restyle the rail for the single-column shell')
  // xl:sticky/xl:top-4 keep the rail pinned as a column; left on, it would float the
  // strip over the board once the grid is one column.
  assert.match(railRule[0], /position:\s*static\s*!important/)
})

// Every real card on a Pulse page carries bg-white/dark:bg-slate-900 and is glassed by
// the `.ms-pulse-board .bg-white` selectors. Adding a bare `details` to that selector
// list also caught the wrappers that are NOT cards — engSection()'s
// `<details class="group mt-7">` (a heading plus content, no padding of its own) and the
// layout wrappers enableExecutivePulseDisclosures() promotes — so each grew a glass box
// with zero padding: the section title sat flush in its top-left corner and the content
// bled to the edges ("the padding on the sections as the titles are not inside nicely").
// It also painted glass straight over the dark AI panel's own gradient.
test('the Pulse glass treatment is not applied to every <details>, only to real cards', () => {
  assert.doesNotMatch(css, /\.ms-pulse-board details\b/,
    'a bare `.ms-pulse-board details` selector glasses padding-less section wrappers — target the card classes instead')
  assert.match(css, /\.ms-pulse-board \.bg-white/,
    'real Pulse cards (engCard, department sections) must still get the glass treatment')
})

// engSection() is the shape the department Pulse pages compose their sections from; it
// deliberately has no chrome, so it must not pick up card styling from the board.
test('engSection still renders a bare wrapper (the fix above depends on it having no card classes)', () => {
  const engSection = part10.slice(part10.indexOf('function engSection('), part10.indexOf('function engSection(') + 400)
  assert.match(engSection, /<details open class="group mt-7 first:mt-0">/)
  assert.doesNotMatch(engSection, /<details open class="[^"]*bg-white/)
})
