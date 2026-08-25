import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const css = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')

// A Pulse page is a wall of glance widgets and wants the whole content column.
// renderEngine() gives every engine the same shell with a fixed 300px rail, which
// left the board at ~74% of the width the engine header directly above it spans,
// with dead space beside every department section. On Pulse tabs the rail stops
// being a column and becomes a full-width strip above the board — Reports, Next
// Actions and Quick Actions all stay, they just run across the top.
test('engineTab widens the board on Pulse tabs, and only on Pulse tabs', () => {
  assert.match(part10, /body\.classList\.toggle\('ms-pulse-board', isPulseLayout\)/)
  assert.match(part10, /body\.parentElement\?\.classList\.toggle\('ms-pulse-wide', isPulseLayout\)/,
    'the widen state must be TOGGLED on the same condition as the board, so other tabs keep the rail column')
  assert.doesNotMatch(part10, /classList\.remove\('ms-pulse-wide'\)/,
    'unconditionally removing the class is what pinned Pulse back to the narrow two-column shell')
})

// The shell must stay on a semantic class. It previously used the Tailwind
// arbitrary utility xl:grid-cols-[minmax(0,1fr)_300px], which the static build can
// purge — when it did, the rail collapsed at ordinary desktop widths and browser
// zoom levels. That fix is load-bearing and must survive the widening change.
test('the engine shell uses a semantic layout class, not a purge-sensitive utility', () => {
  assert.match(part10, /ms-engine-layout--rail/,
    'the two-column shell must be a real CSS class, not a Tailwind arbitrary grid utility')
  assert.doesNotMatch(part10, /xl:grid-cols-\[minmax\(0,1fr\)_300px\]/,
    'the purge-sensitive arbitrary utility must not come back')
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?\.ms-engine-layout--rail \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 300px\s*!important/,
    'every non-Pulse tab must still get the 300px operations rail beside it at desktop widths')
  assert.match(css, /\[data-engine-body\] \+ \[data-engine-rail\]\s*\{[^}]*align-self:\s*start/)
})

// The widening rule has to out-rank the rail rule, which carries !important.
// A compound selector wins on specificity without a second !important war, and
// keeps the override scoped to the one state that should get it.
test('the Pulse widening beats the rail rule by specificity, not by shouting louder', () => {
  assert.match(css, /\.ms-engine-layout--rail\.ms-pulse-wide \{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important;\s*\}/,
    'the widening must be a compound selector so it only applies while .ms-pulse-wide is present')
  const railAt = css.indexOf('.ms-engine-layout--rail {')
  const wideAt = css.indexOf('.ms-engine-layout--rail.ms-pulse-wide')
  assert.ok(wideAt > railAt, 'the override must come after the rule it overrides')
})

// The rail is repositioned, never hidden: losing Next Actions and Quick Actions
// would trade one usability problem for a worse one.
test('the rail survives as a horizontal strip above the board', () => {
  const rule = css.match(/\.ms-pulse-wide > \[data-engine-rail\] \{[^}]*\}/)
  assert.ok(rule, '.ms-pulse-wide > [data-engine-rail] must restyle the rail for the single-column shell')
  assert.match(rule[0], /order:\s*-1/, 'the strip belongs above the board, not below it')
  assert.match(rule[0], /position:\s*static\s*!important/,
    'the shell puts xl:sticky on the aside; a strip that follows you down the page is just in the way')
  assert.match(rule[0], /grid-template-columns:\s*repeat\(auto-fit/,
    'the rail sections should sit side by side across the strip')
  assert.doesNotMatch(rule[0], /display:\s*none/,
    'Reports, Next Actions and Quick Actions must remain reachable')
})

// Every real card on a Pulse page carries bg-white/dark:bg-slate-900 and is glassed by
// the `.ms-pulse-board .bg-white` selectors. Adding a bare `details` to that selector
// list also caught the wrappers that are NOT cards — engSection()'s
// `<details class="group mt-7">` (a heading plus content, no padding of its own) and the
// layout wrappers enableExecutivePulseDisclosures() promotes — so each grew a glass box
// with zero padding: the section title sat flush in its top-left corner and the content
// bled to the edges. It also painted over the dark AI panel's own gradient.
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
