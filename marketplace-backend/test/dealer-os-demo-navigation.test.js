import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { featuresForPlan } from '../plan-catalog.js'

const registry = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const commandCenter = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part11.js', import.meta.url), 'utf8')
const engineShell = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part10.js', import.meta.url), 'utf8')
const demoPanel = readFileSync(new URL('../../marketplace-frontend/js/modules/demo-control-panel.js', import.meta.url), 'utf8')

test('DealerOS keeps its existing workspace registry and applies role and package gates in the renderer', () => {
  assert.match(registry, /const MS_WORKSPACES = \{/)
  for (const label of ['Pulse', 'Sales', 'Inventory', 'Cleanup', 'F&I', 'Service', 'Parts', 'Accounting', 'Marketing', 'HR', 'Academy']) {
    assert.ok(registry.includes(`label: '${label}'`), `DealerOS registry should retain ${label}`)
  }
  assert.match(dashboard, /function deptRoleOk\(spec\)/)
  // Matched whitespace-tolerantly: the gate chain is the contract, not whether the
  // body is written on one line or several.
  assert.match(dashboard.replace(/\s+/g, ' '),
    /function deptPageAllowed\(p\) \{ return !p\.legacy && deptRoleOk\(p\) && deptPageVisible/)
  assert.match(dashboard, /const demoEntitlements = window\.__demoEntitlements/)
})

test('DealerOS Core, Pro and Complete retain their advertised department boundaries', () => {
  const core = new Set(featuresForPlan('dealer-os-core'))
  const pro = new Set(featuresForPlan('dealer-os-pro'))
  const complete = new Set(featuresForPlan('dealer-os-complete'))

  assert.ok(core.has('os.crm') && core.has('os.inventory'))
  assert.ok(!core.has('os.sales') && !core.has('os.service') && !core.has('os.accounting') && !core.has('os.team'))
  assert.ok(pro.has('os.sales') && pro.has('os.service'))
  assert.ok(!pro.has('os.team'), 'Pro must not reveal the HR department')
  assert.ok(!pro.has('os.accounting') && !pro.has('os.automations'))
  assert.ok(complete.has('os.service') && complete.has('os.accounting') && complete.has('os.team'))
  assert.ok(complete.has('os.automations') && complete.has('os.integrations'))
})

test('Core and Pro are operational-only; only Complete carries the MarketSync Digital bundle', async () => {
  const { productsForPlan } = await import('../plan-catalog.js')
  const coreProducts = new Set(productsForPlan('dealer-os-core'))
  const proProducts = new Set(productsForPlan('dealer-os-pro'))
  const completeProducts = new Set(productsForPlan('dealer-os-complete'))
  const digital = productsForPlan('marketsync-digital')
  // Neither Core nor Pro grants ANY MarketSync Digital product.
  for (const product of digital) {
    assert.ok(!coreProducts.has(product), `Core must not include Digital product ${product}`)
    assert.ok(!proProducts.has(product), `Pro must not include Digital product ${product}`)
  }
  // Complete carries the whole Digital bundle, including SEO.
  for (const product of digital) {
    assert.ok(completeProducts.has(product), `Complete must include Digital product ${product}`)
  }
  assert.ok(completeProducts.has('marketsync_seo'), 'Complete includes MarketSync SEO')
})

test('Cleanup follows Complete automations, while messaging and Intelligence remain global capabilities', () => {
  assert.match(dashboard, /inventory: 'os\.inventory', recon: 'os\.automations'/)
  assert.match(dashboard, /academy[\s\S]*ai-inbox[\s\S]*deliberately ABSENT/)
  const assistant = readFileSync(new URL('../routes/submodules/ai-assistant-chat.js', import.meta.url), 'utf8')
  assert.match(assistant, /const entitled = isDealerOS \|\| isMarketSyncDigital/)
  assert.match(assistant, /entitlementPlans\.includes\('marketsync-digital'\)/)
})

test('Executive Pulse departments and persistent rail sections are collapsible', () => {
  assert.match(commandCenter, /function enableExecutivePulseDisclosures\(body\)/)
  assert.match(commandCenter, /querySelectorAll\(':scope > div\.mb-8, :scope > div\.mb-6'\)/)
  assert.match(commandCenter, /enableExecutivePulseDisclosures\(body\)/)
  assert.match(commandCenter, /document\.createElement\('details'\)/)
  assert.match(commandCenter, /document\.createElement\('summary'\)/)
  assert.match(engineShell, /<details open class="group bg-white/)
  assert.match(engineShell, /Expand or collapse \$\{esc\(title\)\}/)
})

test('Demo Control Center preserves exact package id and separate selected-plan entitlements', () => {
  assert.match(demoPanel, /window\.__demoActivePackage = data\.state\.packageId/)
  assert.match(demoPanel, /window\.__demoEntitlements = \{/)
  assert.match(demoPanel, /packageId: data\.activePackage\.id/)
  assert.doesNotMatch(demoPanel, /window\.__access\s*=\s*data\.activePackage/)
})
