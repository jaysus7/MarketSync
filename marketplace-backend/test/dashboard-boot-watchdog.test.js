/**
 * Dashboard boot watchdog — mobile users can't see a blank screen.
 *
 * Regression the watchdog catches: a mobile boot silently failing when
 * the initial-page resolver depended on profileContext that hadn't
 * loaded yet, leaving the shell with header + mobile quick-row but
 * nothing in <main>. The watchdog fills the void with a loading
 * spinner, and after 8s replaces it with a real error+retry card so
 * the visitor always has an action to take.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = await readFile(
  new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8'
)

test('boot watchdog renders a spinner + loading message inside <main>', () => {
  assert.match(html, /id="ms-boot-watchdog"/,
    'watchdog root element must exist')
  assert.match(html, /Loading MarketSync…/,
    'watchdog must show a visible loading message during boot')
  // Spinner CSS is inline so it works with a cold stylesheet cache.
  assert.match(html, /@keyframes ms-boot-spin/,
    'spinner keyframes must ship inline')
})

test('watchdog hides itself the moment any page-content renders', () => {
  assert.match(html, /MutationObserver/,
    'watchdog must observe DOM mutations to detect first render')
  assert.match(html, /\[data-page-content\]:not\(\.hidden\)/,
    'watchdog must look for the standard page-content selector')
  assert.match(html, /observer\.disconnect\(\)/,
    'watchdog must stop observing once rendered')
})

test('after 8 seconds of nothing, watchdog surfaces a real error + reload action', () => {
  // Blank-screen regression fallback: rather than leaving the visitor
  // staring at a spinner forever, swap to a card with a Reload button.
  assert.match(html, /setTimeout\(function\(\)\{[\s\S]*?\},\s*8000\)/,
    'watchdog must include an 8s failure timer')
  assert.match(html, /Something.s stuck loading/,
    'failure state must have a human error title')
  assert.match(html, /onclick="location\.reload\(\)"/,
    'failure state must offer a Reload button')
  assert.match(html, /Settings . Safari . Clear History and Website Data/,
    'failure state must guide iOS users to clear cache')
})
