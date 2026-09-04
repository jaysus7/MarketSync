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
const part23 = read('../../marketplace-frontend/js/modules/dashboard-part23.js')
const staffChatRoute = read('../routes/staff-chat.js')

// ── The right rail carries department reports and operational actions ────────
test('engineRail renders Reports, Next Actions and Quick Actions, with no Team Messages section', () => {
  const fn = part10.match(/function engineRail\(eng, d\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'engineRail must exist')
  assert.match(fn, /return sec\('Reports', 'chart', reportsHtml\) \+ sec\('Next Actions', 'check', naHtml\) \+ sec\('Quick Actions', 'bolt', qa\)/,
    'the rail must keep Reports, Next Actions and Quick Actions together')
  assert.doesNotMatch(fn, /sec\('Team Messages'/,
    'Team Messages no longer lives on the rail — it moved to the floating bubble')
})

test('the Reports rail is specific to the department you are in via openDeptReport deep links', () => {
  assert.match(part14, /function openDeptReport\(key\)/, 'openDeptReport helper exists')
  assert.match(part14, /window\.openDeptReport = openDeptReport/, 'exposed on window for rail onclick')
  // openDeptReport must land on the reports page and select the matching
  // department in the one canonical semantic catalogue.
  const fn = part14.match(/function openDeptReport\(key\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /switchPage\('reports'\)/)
  assert.match(fn, /REPORT_DEPT_FROM_LEGACY\[key\]/)
  assert.match(fn, /reportingSetUrl/)
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

test('the obsolete floating icon report rail is permanently hidden', () => {
  assert.match(dashboardHtml, /id="report-rail"[^>]*aria-hidden="true"/)
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

test('Marketing tab order includes the Digital surfaces (Website, Design Studio, Video, AI ChatBot) when entitled', () => {
  const order = marketingWs.match(/get tabOrder\(\)\s*\{[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(order, 'tabOrder getter must exist')
  // Each Digital surface is appended to the order, gated by its product entitlement.
  assert.match(order, /base\.push\('studio'\)/, 'Design Studio tab must be in the order')
  assert.match(order, /base\.push\('video-studio'\)/, 'Video Studio tab must be in the order')
  assert.match(order, /base\.push\('chatbot'\)/, 'AI ChatBot tab must be in the order')
  assert.match(order, /base\.push\('website'\)/, 'Website tab must be in the order')
  assert.match(order, /website\.builder|os\.website/, 'Website tab is gated on a website entitlement')
  // The handlers and labels for those tabs exist, so they can actually render.
  for (const t of ['studio', "'video-studio'", 'chatbot', 'website']) {
    assert.match(marketingWs, new RegExp(`${t.replace(/[-']/g, m => '\\' + m)}\\(body`), `handler for ${t} must exist`)
  }
  assert.match(marketingWs, /website: 'Website'/, 'Website tab label must exist')
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

test('the assistant is always named Intelligence', () => {
  const fn = part23.match(/function applyAssistantName\([^)]*\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /__aiAssistantName = 'Intelligence'/)
  assert.doesNotMatch(fn, /name \|\||name\.trim/)
})
