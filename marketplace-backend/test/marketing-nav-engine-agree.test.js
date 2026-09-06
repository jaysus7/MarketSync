import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ws = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')
const registry = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')

// Run the SHIPPED tabOrder getter for a given entitlement set.
function tabsFor(features) {
  const body = ws.match(/get tabOrder\(\) \{([\s\S]*?)\n  \},/)?.[1]
  assert.ok(body, 'the marketing engine must declare its tab order')
  global.window = { __access: { features } }
  return Function(body + '\n')()
}

// The nav is a promise. renderEngine resolves an unknown tab by silently falling
// back to order[0] — so a destination the nav offers but the engine does not list
// does not error, it just drops you on Pulse. That is invisible from the code and
// only shows up as "Design Studio opens the wrong header".
test('every marketing destination the nav offers is one the engine can actually open', () => {
  const block = registry.match(/\n  marketing: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(block, 'the marketing registry group must exist')

  // Registry entries that land on the marketing engine as a tab.
  const entries = [...block.matchAll(/\{ page: 'marketing-overview', label: '([^']+)', tab: '([^']+)'[^}]*anyFeature: \[([^\]]+)\]/g)]
    .map(m => ({ label: m[1], tab: m[2], features: m[3].split(',').map(f => f.trim().replace(/'/g, '')) }))
  assert.ok(entries.length > 0, 'sanity: the registry should route at least one tab into this engine')

  const broken = []
  for (const entry of entries) {
    // Each feature that ALONE unlocks the nav link must also unlock the tab.
    for (const feature of entry.features) {
      if (!tabsFor([feature]).includes(entry.tab)) {
        broken.push(`${entry.label}: nav offers it on "${feature}", engine drops tab "${entry.tab}" -> falls back to Pulse`)
      }
    }
  }
  assert.deepEqual(broken, [],
    `the nav promises destinations the engine will not open:\n  ${broken.join('\n  ')}`)
})

test('a dealership on os.marketing alone gets the studios it is sold', () => {
  const tabs = tabsFor(['os.marketing'])
  for (const tab of ['studio', 'video-studio', 'scheduler']) {
    assert.ok(tabs.includes(tab), `os.marketing must unlock "${tab}"`)
  }
  assert.equal(tabs[0], 'overview', 'Pulse still leads')
})

test('a plan without Marketing does not get them', () => {
  // The gate must still gate — widening it to everyone would "fix" the mismatch
  // by giving the studios away.
  const tabs = tabsFor(['os.crm'])
  for (const tab of ['studio', 'video-studio']) {
    assert.ok(!tabs.includes(tab), `"${tab}" must stay behind an entitlement`)
  }
})
