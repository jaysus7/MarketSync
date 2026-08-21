import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { featuresForPlan } from '../plan-catalog.js'

const registry = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const demoPanel = readFileSync(new URL('../../marketplace-frontend/js/modules/demo-control-panel.js', import.meta.url), 'utf8')

test('DealerOS keeps its existing workspace registry and applies role and package gates in the renderer', () => {
  assert.match(registry, /const MS_WORKSPACES = \{/)
  for (const label of ['Pulse', 'Sales', 'Inventory', 'Cleanup', 'F&I', 'Service', 'Parts', 'Accounting', 'Marketing', 'HR', 'Academy']) {
    assert.ok(registry.includes(`label: '${label}'`), `DealerOS registry should retain ${label}`)
  }
  assert.match(dashboard, /function deptRoleOk\(spec\)/)
  assert.match(dashboard, /function deptPageAllowed\(p\) \{ return !p\.legacy && deptRoleOk\(p\) && deptPageVisible/)
  assert.match(dashboard, /const demoEntitlements = window\.__demoEntitlements/)
})

test('DealerOS Core, Pro and Complete retain their advertised department boundaries', () => {
  const core = new Set(featuresForPlan('dealer-os-core'))
  const pro = new Set(featuresForPlan('dealer-os-pro'))
  const complete = new Set(featuresForPlan('dealer-os-complete'))

  assert.ok(core.has('os.crm') && core.has('os.inventory'))
  assert.ok(!core.has('os.service') && !core.has('os.accounting'))
  assert.ok(pro.has('os.service'))
  assert.ok(!pro.has('os.accounting') && !pro.has('os.automations'))
  assert.ok(complete.has('os.service') && complete.has('os.accounting'))
  assert.ok(complete.has('os.automations') && complete.has('os.integrations'))
})

test('Demo Control Center preserves exact package id and separate selected-plan entitlements', () => {
  assert.match(demoPanel, /window\.__demoActivePackage = data\.state\.packageId/)
  assert.match(demoPanel, /window\.__demoEntitlements = \{/)
  assert.match(demoPanel, /packageId: data\.activePackage\.id/)
  assert.doesNotMatch(demoPanel, /window\.__access\s*=\s*data\.activePackage/)
})
