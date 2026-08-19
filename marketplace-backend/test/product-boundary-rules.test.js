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

test('AI Intelligence Chat backend requires DealerOS subscription', () => {
  assert.match(aiAssistant, /subProducts\.includes\('dealer_os'\)/)
  assert.match(aiAssistant, /AI Intelligence Chat is a DealerOS capability/)
})

test('Team Messaging backend requires DealerOS or Facebook Dealer subscription', () => {
  assert.match(staffChat, /requireTeamMessaging/)
  assert.match(staffChat, /Team Messaging is a DealerOS feature/)
})

test('Shared header in dashboard.html includes header-demo-switcher-container', () => {
  assert.match(dashboardHtml, /id="header-demo-switcher-container"/)
})

test('demo-control-panel.js mounts Demo button into header-demo-switcher-container', () => {
  assert.match(demoPanelJs, /header-demo-switcher-container/)
  assert.match(demoPanelJs, /badge\.textContent = 'Demo'/)
})
