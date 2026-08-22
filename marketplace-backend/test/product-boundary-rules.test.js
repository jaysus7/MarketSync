import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const agentsMd = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8')
const aiAssistant = readFileSync(new URL('../routes/submodules/ai-assistant-chat.js', import.meta.url), 'utf8')
const staffChat = readFileSync(new URL('../routes/staff-chat.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const demoPanelJs = readFileSync(new URL('../../marketplace-frontend/js/modules/demo-control-panel.js', import.meta.url), 'utf8')

test('AGENTS.md contains the authoritative MarketSync Product Boundary Rules', () => {
  assert.match(agentsMd, /## A21\. MarketSync Product Boundary Rules/)
  assert.match(agentsMd, /AI ChatBot is a standalone product\. AI Intelligence Chat is a DealerOS capability/)
  assert.match(agentsMd, /Team Messaging is a DealerOS\/internal collaboration capability/)
  assert.match(agentsMd, /Demo-mode access must never be used as evidence of customer entitlement/)
  assert.match(agentsMd, /Product access must always be determined by canonical backend entitlements/)
})

test('AI Intelligence Chat backend requires DealerOS or MarketSync Digital', () => {
  assert.match(aiAssistant, /subProducts\.includes\('dealer_os'\)/)
  assert.match(aiAssistant, /entitlementPlans\.includes\('marketsync-digital'\)/)
  assert.match(aiAssistant, /AI Intelligence Chat is included with DealerOS and MarketSync Digital/)
})

test('Team Messaging backend requires DealerOS or Facebook Dealer subscription', () => {
  assert.match(staffChat, /requireTeamMessaging/)
  assert.match(staffChat, /Team Messaging is a DealerOS feature/)
})

test('Shared header in dashboard.html includes header-demo-switcher-container', () => {
  assert.match(dashboardHtml, /id="header-demo-switcher-container"/)
})

test('demo-control-panel.js keeps the Demo button reachable as a fixed overlay, not buried in product chrome', () => {
  assert.match(demoPanelJs, /badge\.textContent = 'Demo'/)
  // Must mount on <body> (the fixed, top-of-everything #demo-mode-badge overlay), never
  // inside the collapsible header — single-product/full-screen surfaces hide the header,
  // which would strand the operator with no way to switch back.
  assert.match(demoPanelJs, /document\.body\.appendChild\(badge\)/)
  assert.doesNotMatch(demoPanelJs, /header-demo-switcher-container/)
})
