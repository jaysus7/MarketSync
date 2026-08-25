import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const staffChat = readFileSync(new URL('../../marketplace-frontend/js/modules/staff-chat-dock.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

test('independent programs hide chat, while Facebook Dealer and full DealerOS keep Team Chat', () => {
  const fn = dashboard.match(/function applyProductNav\(products\) \{[\s\S]*?\nwindow\.applyProductNav = applyProductNav;/)?.[0] || ''
  assert.match(fn, /const isIndependentSingleProduct = active\.length === 1 && active\[0\] !== 'dealer_os'/)
  const block = fn.match(/if \(isIndependentSingleProduct\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(block, 'the single-product block must exist')
  // A real dealership team (Facebook Dealer) is the one single-product tier that keeps chat.
  assert.match(block, /active\[0\] !== 'facebook_dealer'/)
  // Both chat systems + the AI dock are removed for every other independent program.
  for (const id of ['ai-dock-btn', 'ai-dock-panel', 'team-chat-dock-panel', 'staff-chat-dock-bar']) {
    assert.match(block, new RegExp(`getElementById\\('${id}'\\)\\?\\.classList\\.add\\('hidden'\\)`), `${id} must be hidden`)
  }
  // The staff-chat dock mounts itself + polls, so it must be told to tear down.
  assert.match(block, /window\.disableStaffChatDock === 'function'\) window\.disableStaffChatDock\(\)/)
  assert.match(fn, /if \(products\.dealer_os\) \{[\s\S]*?window\.__teamChatAllowed = true;[\s\S]*?window\.enableStaffChatDock/,
    'the reachable DealerOS branch must restore Team Chat before returning')
})

test('the staff-chat dock refuses to run on independent programs and can be torn down', () => {
  // A guard that reads the resolved product tier, treating exactly-one-product (that
  // isn't facebook_dealer) as "hide", and staying open while the tier is unknown.
  const guard = staffChat.match(/function shouldHideStaffChat\(\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(guard, 'shouldHideStaffChat must exist')
  assert.match(guard, /getAttribute\('data-product'\)/)
  assert.match(guard, /list\.length === 1 && !\['facebook_dealer', 'dealer_os'\]\.includes\(list\[0\]\)/)
  assert.ok(guard.indexOf('const accessProducts') < guard.indexOf('window.isSingleProductWorkspace'),
    'canonical DealerOS access must be checked before provisional workspace classification')
  assert.match(guard, /if \(hasDealerOs \|\| hasFbDealer\) return false;/,
    'DealerOS and dealership Facebook access must explicitly keep Team Chat visible')

  // Every entry point is guarded so nothing shows, polls, or pops.
  assert.match(staffChat, /function initLauncherUI\(\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  assert.match(staffChat, /async function pollUnread\(\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  assert.match(staffChat, /function triggerIncomingPopup\(msg\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  // Boot runs through the shared guarded starter so DealerOS can restore the dock
  // after entitlements resolve without mounting it for independent products.
  assert.match(staffChat, /function startStaffChatDock\(\) \{\s*\n\s*if \(shouldHideStaffChat\(\)\) return;/)
  assert.match(staffChat, /DOMContentLoaded', \(\) => \{\s*\n\s*startStaffChatDock\(\);/)
  // A public teardown applyProductNav can call once the tier is known.
  assert.match(staffChat, /window\.disableStaffChatDock = function \(\) \{[\s\S]*?clearInterval\(pollInterval\)[\s\S]*?staff-chat-dock-bar'\)\?\.classList\.add\('hidden'\)/)
  assert.match(staffChat, /window\.enableStaffChatDock = function \(\) \{[\s\S]*?startStaffChatDock\(\)/,
    'full DealerOS must be able to restore Team Chat after entitlement resolution')
  assert.match(staffChat, /if \(window\.__teamChatAllowed === true\) return false;/,
    'resolved DealerOS access must override any stale provisional disabled state')
})

test('the single-product settings block also tears down the staff-chat dock (belt-and-suspenders with applyProductNav)', () => {
  assert.match(part2, /getElementById\('staff-chat-dock-bar'\)\?\.classList\.toggle\('hidden', !isFbDealer\)/)
  assert.match(part2, /!isFbDealer && typeof window\.disableStaffChatDock === 'function'\) window\.disableStaffChatDock\(\)/)
})
