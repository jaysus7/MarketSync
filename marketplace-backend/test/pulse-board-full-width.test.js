import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const css = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')

// Pulse retains the native engine rail: it is the one compact place for reports,
// next actions, and quick actions on every department dashboard.
test('engineTab keeps the right operations rail beside every Pulse board', () => {
  assert.match(part10, /body\.classList\.toggle\('ms-pulse-board', isPulseLayout\)/)
  assert.match(part10, /body\.parentElement\?\.classList\.remove\('ms-pulse-wide'\)/,
    'legacy full-width strip state must be removed so the rail remains a right column')
})

test('Pulse CSS does not flatten the right rail into a top strip', () => {
  assert.doesNotMatch(css, /\.ms-pulse-wide\s*\{[^}]*grid-template-columns:/,
    'the operations rail must remain in the engine shell second column')
  assert.match(css, /\[data-engine-body\] \+ \[data-engine-rail\]\s*\{[^}]*align-self:\s*start/)
  assert.match(part10, /ms-engine-layout--rail/,
    'the engine shell must use a semantic class rather than a purge-sensitive Tailwind arbitrary grid utility')
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?\.ms-engine-layout--rail\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 300px\s*!important/,
    'the right operations rail must remain beside Pulse at normal desktop widths and browser zoom levels')
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
