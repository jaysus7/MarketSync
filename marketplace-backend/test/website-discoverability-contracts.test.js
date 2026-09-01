import test from 'node:test'
import assert from 'node:assert/strict'
import { auditWebsiteDiscoverabilityContracts, websitePublishBlockingIssues } from '../services/websiteDiscoverabilityContracts.js'

test('website builder contracts pass a complete dealership page', () => {
  const result = auditWebsiteDiscoverabilityContracts({
    title: 'Home', seo_title: 'North Motors | New and Used Vehicles', seo_description: 'Shop vehicles and service at North Motors.',
    sections: [
      { id: 'hero', type: 'hero', settings: { headline: 'Find your next vehicle' } },
      { id: 'inventory', type: 'featured_inventory', settings: { title: 'Shop inventory' } },
      { id: 'contact', type: 'contact', settings: { title: 'Visit North Motors' } }
    ]
  }, { name: 'North Motors', address: '1 Main Street', phone: '555-0100', site_published: true })
  assert.equal(result.optimized, true)
  assert.equal(result.issues.length, 0)
  assert.equal(websitePublishBlockingIssues(result).length, 0)
})

test('contracts identify publish-blocking heading failures separately from safe metadata fixes', () => {
  const result = auditWebsiteDiscoverabilityContracts({ title: 'Home', sections: [{ id: 'copy', type: 'text', settings: { body: 'Welcome to our dealership.' } }] })
  assert.ok(result.issues.some(issue => issue.contract === 'heading-hierarchy'))
  assert.ok(result.issues.some(issue => issue.contract === 'seo-title' && issue.autoFixable))
  assert.ok(websitePublishBlockingIssues(result).some(issue => issue.contract === 'heading-hierarchy'))
})

test('inventory, service, and local entity contracts use structured section types', () => {
  const result = auditWebsiteDiscoverabilityContracts({ title: 'Service', seo_title: 'Service', seo_description: 'Service', sections: [
    { id: 'hero', type: 'hero', settings: { headline: 'Welcome' } },
    { id: 'inv', type: 'vehicle_grid', settings: { title: 'Browse' } },
    { id: 'svc', type: 'service_cta', settings: { title: 'Book now' } },
    { id: 'loc', type: 'location', settings: { title: 'Visit us' } }
  ] }, { name: 'North Motors' })
  assert.ok(result.issues.some(issue => issue.contract === 'inventory-context'))
  assert.ok(result.issues.some(issue => issue.contract === 'service-context'))
  assert.ok(result.issues.some(issue => issue.contract === 'local-entity'))
})
