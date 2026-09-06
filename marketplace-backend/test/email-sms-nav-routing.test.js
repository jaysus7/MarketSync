import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashPart2Js = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const marketingWorkspaceJs = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')

// The suite nav config declares suiteItem('email-sms', 'Email & SMS', 'chat', { tab: 'campaigns' })
// (marketing-workspace.js), generating onclick="deptGo('email-sms','','campaigns')". But
// switchPage()'s legacy-id remap block unconditionally sets __autoTab = 'overview' for
// 'email-sms'/'email-marketing' — a fallback meant for deep links with no tab info of their
// own (notifications, old bookmarks) — which silently stomped a caller's real request.
// Clicking "Email & SMS" always landed on Automation Builder's Overview launchpad instead
// of its Campaigns tab.
test('deptGo re-applies the requested tab for email-sms/email-marketing after switchPage remaps them into automation-builder', () => {
  // deptGo grew a fourth `studio` parameter when Email/SMS and Automations started
  // sharing one engine; match the signature loosely so a new parameter is not a failure.
  const fn = dashPart2Js.match(/function deptGo\(page, invmode, tab[^)]*\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'deptGo must exist')
  assert.match(fn, /switchPage\(page\);/, 'must call switchPage before re-applying the tab')
  const afterSwitch = fn.slice(fn.indexOf('switchPage(page);'))
  assert.match(afterSwitch, /page === 'email-sms' \|\| page === 'email-marketing'/,
    'must re-apply the tab specifically for the two legacy ids switchPage remaps into automation-builder')
  assert.match(afterSwitch, /__autoTab = tab/, 'must set __autoTab to the caller\'s actual requested tab, not a hardcoded default')
})

// The 'email-sms' engine tab used to build its own header, then borrow the ENTIRE
// automation-builder page-content panel via engMountPage — which carries its own static
// header — nested inside the Marketing engine's own header. Three headers stacked. This
// was reachable live via mktGo()'s default branch (engineTab('marketing-overview','emails')
// -> the 'emails' alias -> this handler), not just a theoretical path.
test('the email-sms engine tab hands off to the real Automation Builder page instead of embedding its page-content panel', () => {
  const tabsBody = marketingWorkspaceJs.slice(
    marketingWorkspaceJs.indexOf("'email-sms'(body) {"),
    marketingWorkspaceJs.indexOf('emails(body, d)')
  )
  assert.ok(tabsBody, 'the email-sms tab handler must exist')
  assert.doesNotMatch(tabsBody, /engMountPage\(mount, 'automation-builder'/,
    'must not borrow automation-builder\'s own-headered page-content panel into this tab')
  assert.match(tabsBody, /switchPage\('email-sms'\)/, 'must hand off via the real router instead')
  // The legacy alias must still forward to this handler so engineTab('marketing-overview','emails')
  // (mktGo()'s default branch) keeps working.
  assert.match(marketingWorkspaceJs, /emails\(body, d\) \{\s*this\['email-sms'\]\(body, d\);/)
})
