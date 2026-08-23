import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const part10 = read('../../marketplace-frontend/js/modules/dashboard-part10.js')
const part14 = read('../../marketplace-frontend/js/modules/dashboard-part14.js')
const dashboardHtml = read('../../marketplace-frontend/dashboard.html')
const serviceWs = read('../../marketplace-frontend/js/modules/service-workspace.js')
const marketingWs = read('../../marketplace-frontend/js/modules/marketing-workspace.js')
const salesWs = read('../../marketplace-frontend/js/modules/sales-workspace.js')
const fniWs = read('../../marketplace-frontend/js/modules/fni-workspace.js')
const inventoryWs = read('../../marketplace-frontend/js/modules/inventory-workspace.js')
const staffChatDock = read('../../marketplace-frontend/js/modules/staff-chat-dock.js')
const staffChatRoute = read('../routes/staff-chat.js')

// ── The right rail carries department Reports, not Team Messages ──────────────
test('engineRail renders a Reports section and no Team Messages section', () => {
  const fn = part10.match(/function engineRail\(eng, d\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'engineRail must exist')
  assert.match(fn, /const msg = sec\('Reports', 'chart', reportsInner\)/,
    'the rail leads with a Reports section')
  assert.doesNotMatch(fn, /sec\('Team Messages'/,
    'Team Messages no longer lives on the rail — it moved to the floating bubble')
  // Falls back to a department-named link when the engine declares no reports.
  assert.match(fn, /const reportItems = \(eng\.reports && eng\.reports\.length\)/)
})

test('the Reports rail is specific to the department you are in via openDeptReport deep links', () => {
  assert.match(part14, /function openDeptReport\(key\)/, 'openDeptReport helper exists')
  assert.match(part14, /window\.openDeptReport = openDeptReport/, 'exposed on window for rail onclick')
  // openDeptReport must land on the reports page and then focus the deep tab.
  const fn = part14.match(/function openDeptReport\(key\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /switchPage\('reports'\)/)
  assert.match(fn, /reportsTab\(key\)/)
  // Each major department wires a report deep link.
  assert.match(serviceWs, /reports:\s*\[[\s\S]*?openDeptReport\('service'\)/)
  assert.match(marketingWs, /reports:\s*\[[\s\S]*?openDeptReport\('marketing'\)/)
  assert.match(salesWs, /reports:\s*\[[\s\S]*?openDeptReport\('sales'\)/)
  assert.match(fniWs, /reports:\s*\[[\s\S]*?openDeptReport\('fni'\)/)
  assert.match(inventoryWs, /reports:\s*\[[\s\S]*?openDeptReport\(/)
})

test('the report-rail Team Messages trigger button is gone from dashboard.html', () => {
  assert.doesNotMatch(dashboardHtml, /data-report="messages"/,
    'the reports rail must not carry a Team Messages trigger any more')
})

// ── Service keeps its tab headers for management roles ────────────────────────
test('Service management roles always get the full desk tabs, not the single tech view', () => {
  const fn = serviceWs.match(/const svcIsTechnician = \(\) => \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(fn, 'svcIsTechnician must exist')
  assert.match(fn, /\['DEALER_ADMIN', 'OWNER', 'MANAGER'\]\.includes\(role\)\) return false/,
    'management roles are never treated as technicians')
  assert.match(fn, /canDo\('service\.manage_workflow'\)/,
    'non-management still keys off the desk permission')
})

// ── Marketing keeps its tab headers in DealerOS ──────────────────────────────
test('Marketing suppresses its engine tab bar only for standalone suites, not DealerOS', () => {
  assert.match(marketingWs, /get hideTabBar\(\)\s*\{[\s\S]*?getActiveMarketingSuite\(\)/,
    'hideTabBar is a getter gated on an active marketing suite')
  assert.doesNotMatch(marketingWs, /hideTabBar:\s*true/,
    'never unconditionally hidden — that left Marketing with no tabs in DealerOS')
})

// ── Team chat loads for entitled / demo dealerships ──────────────────────────
test('requireTeamMessaging admits demo dealerships and DealerOS/Facebook entitlements', () => {
  const fn = staffChatRoute.match(/async function requireTeamMessaging\([\s\S]*?\n\}/)?.[0]
    || staffChatRoute.match(/const requireTeamMessaging = async[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'requireTeamMessaging must exist')
  assert.match(fn, /isDemoDealershipId/, 'demo dealerships get team messaging')
  assert.match(fn, /hasProductAccessReq/, 'entitled products get team messaging')
})

test('the staff-chat bubble surfaces an error instead of stalling on "Loading team…"', () => {
  assert.match(staffChatDock, /function renderDirectoryError\(/,
    'a directory error renderer exists')
  assert.match(staffChatDock, /staff-chat-directory-list/,
    'it targets the directory list container')
})
