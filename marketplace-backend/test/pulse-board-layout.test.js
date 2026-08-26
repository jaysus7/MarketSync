import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const css = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')

// Pulse briefly collapsed the operations rail into a full-width strip above the
// board, to buy the board the ~26% the 300px rail was taking. That traded one
// problem for a worse one: Reports, Next Actions and Quick Actions are read
// ALONGSIDE the board, not stacked above it. Pulse now uses the same two-column
// shell as every other tab.
//
// Verified by measurement against the real built CSS: at 1440/1280/1024px the
// rail is a 300px column to the right of the board on the same row; at 900px it
// stacks below, which is the intended responsive behaviour.
test('Pulse keeps the operations rail as a right-hand column', () => {
  assert.doesNotMatch(part10, /ms-pulse-wide/,
    'the widening class collapsed the rail column and must not come back')
  assert.doesNotMatch(css, /ms-pulse-wide/,
    'the CSS that collapsed the shell and restyled the rail into a strip must be gone too')
})

// The board itself is still a distinct layout — a grid of glance widgets — even
// though it no longer changes the shell around it.
test('the board grid is still applied on Pulse tabs, and only on Pulse tabs', () => {
  assert.match(part10, /body\.classList\.toggle\('ms-pulse-board', isPulseLayout\)/,
    'the board grid must be toggled on the Pulse condition, not applied unconditionally')
  assert.match(css, /\.ms-pulse-board \{[\s\S]*?display: grid/)
})

// The shell must stay on a semantic class. It previously used the Tailwind
// arbitrary utility xl:grid-cols-[minmax(0,1fr)_300px], which the static build can
// purge — when it did, the rail collapsed at ordinary desktop widths and browser
// zoom levels. That fix is load-bearing and is exactly what delivers the rail the
// test above requires.
test('the engine shell uses a semantic layout class, not a purge-sensitive utility', () => {
  assert.match(part10, /ms-engine-layout--rail/,
    'the two-column shell must be a real CSS class, not a Tailwind arbitrary grid utility')
  assert.doesNotMatch(part10, /xl:grid-cols-\[minmax\(0,1fr\)_300px\]/,
    'the purge-sensitive arbitrary utility must not come back')
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?\.ms-engine-layout--rail \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 300px\s*!important/,
    'every tab, Pulse included, gets the 300px operations rail beside it at desktop widths')
  assert.match(css, /\[data-engine-body\] \+ \[data-engine-rail\]\s*\{[^}]*align-self:\s*start/)
})

// Every real card on a Pulse page carries bg-white/dark:bg-slate-900 and is glassed by
// the `.ms-pulse-board .bg-white` selectors. Adding a bare `details` to that selector
// list also caught the wrappers that are NOT cards — engSection()'s
// `<details class="group mt-7">` (a heading plus content, no padding of its own) and the
// layout wrappers enableExecutivePulseDisclosures() promotes — so each grew a glass box
// with zero padding: the section title sat flush in its top-left corner and the content
// bled to the edges. This is the real cause of the "boxed" look, and it stays fixed
// independently of how wide the board is.
test('the Pulse glass treatment is not applied to every <details>, only to real cards', () => {
  assert.doesNotMatch(css, /\.ms-pulse-board details\b/,
    'a bare `.ms-pulse-board details` selector glasses padding-less section wrappers — target the card classes instead')
  assert.match(css, /\.ms-pulse-board \.bg-white/,
    'real Pulse cards (engCard, department sections) must still get the glass treatment')
})

test('engSection still renders a bare wrapper (the fix above depends on it having no card classes)', () => {
  const engSection = part10.slice(part10.indexOf('function engSection('), part10.indexOf('function engSection(') + 400)
  assert.match(engSection, /<details open class="group mt-7 first:mt-0">/)
  assert.doesNotMatch(engSection, /<details open class="[^"]*bg-white/)
})
