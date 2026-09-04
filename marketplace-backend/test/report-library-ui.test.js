import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../routes/reporting-intelligence.js', import.meta.url), 'utf8')
const reportsUi = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part14.js', import.meta.url), 'utf8')
const intelligenceUi = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part23.js', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const standalone = readFileSync(new URL('../../marketplace-frontend/js/modules/reporting-intelligence-ui.js', import.meta.url), 'utf8')

describe('canonical report library UI', () => {
  it('runs queries and predefined reports from tenant-scoped server data', () => {
    assert.match(route, /loadLiveReportingDataset\(plan, \{ dealershipId: req\.dealershipId, client: req\.supabase \}\)/)
    assert.doesNotMatch(route, /req\.body\?\.dataset/)
    assert.match(route, /\/reporting\/reports\/:id\/run/)
  })

  it('provides all, department, and individual report views in the dashboard', () => {
    assert.match(reportsUi, /\['all', 'All reports'\]/)
    assert.match(reportsUi, /report_department/)
    assert.match(reportsUi, /openSemanticReport/)
    assert.match(reportsUi, /\?report=\$\{encodeURIComponent\(report\.id\)\}/)
    assert.match(reportsUi, /Search by report, metric, department/)
  })

  it('embeds the canonical report catalogue and runner inside Intelligence', () => {
    assert.match(dashboard, /id="ai-dock-reports"/)
    assert.match(intelligenceUi, /apiGetJson\('\/reporting\/reports'/)
    assert.match(intelligenceUi, /reporting\/reports\/\$\{encodeURIComponent\(id\)\}\/run/)
    assert.match(intelligenceUi, /Open full report/)
  })

  it('uses the staging backend for standalone Report Lab on staging', () => {
    assert.match(standalone, /marketsync-staging-backend\.onrender\.com/)
    assert.doesNotMatch(standalone, /dataset: \{\}/)
  })
})
