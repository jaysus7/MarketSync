import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const staffChat = readFileSync(new URL('../../marketplace-frontend/js/modules/staff-chat-dock.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

test('independent (single-product) programs hide AI chat and team/staff chat, but Facebook Dealer keeps team chat', () => {
  const fn = dashboard.match(/function applyProductNav\(products\) \{[\s\S]*?\nwindow\.applyProductNav = applyProductNav;/)?.[0] || ''
  const block = fn.match(/if \(active\.length === 1\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(block, 'the single-product block must exist')
  // A real dealership team (Facebook Dealer) is the one single-product tier that keeps chat.
  assert.match(block, /active\[0\] !== 'facebook_dealer'/)
  // Both chat systems + the AI dock are removed for every other independent program.
  for (const id of ['ai-dock-btn', 'ai-dock-panel', 'team-chat-dock-panel', 'staff-chat-dock-bar']) {
    assert.match(block, new RegExp(`getElementById\\('${id}'\\)\\?\\.classList\\.add\\('hidden'\\)`), `${id} must be hidden`)
  }
  // The staff-chat dock mounts itself + polls, so it must be told to tear down.
  assert.match(block, /window\.disableStaffChatDock === 'function'\) window\.disableStaffChatDock\(\)/)
})

test('the staff-chat dock refuses to run on independent programs and can be torn down', () => {
  // A guard that reads the resolved product tier, treating exactly-one-product (that
  // isn't facebook_dealer) as "hide", and staying open while the tier is unknown.
  const guard = staffChat.match(/function shouldHideStaffChat\(\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(guard, 'shouldHideStaffChat must exist')
  assert.match(guard, /getAttribute\('data-product'\)/)
  assert.match(guard, /list\.length === 1 && list\[0\] !== 'facebook_dealer'/)

  // Every entry point is guarded so nothing shows, polls, or pops.
  assert.match(staffChat, /function initLauncherUI\(\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  assert.match(staffChat, /async function pollUnread\(\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  assert.match(staffChat, /function triggerIncomingPopup\(msg\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  // Boot bails entirely for independent programs.
  assert.match(staffChat, /DOMContentLoaded', \(\) => \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  // A public teardown applyProductNav can call once the tier is known.
  assert.match(staffChat, /window\.disableStaffChatDock = function \(\) \{[\s\S]*?clearInterval\(pollInterval\)[\s\S]*?staff-chat-dock-bar'\)\?\.classList\.add\('hidden'\)/)
})

test('the single-product settings block also tears down the staff-chat dock (belt-and-suspenders with applyProductNav)', () => {
  assert.match(part2, /getElementById\('staff-chat-dock-bar'\)\?\.classList\.toggle\('hidden', !isFbDealer\)/)
  assert.match(part2, /!isFbDealer && typeof window\.disableStaffChatDock === 'function'\) window\.disableStaffChatDock\(\)/)
})
