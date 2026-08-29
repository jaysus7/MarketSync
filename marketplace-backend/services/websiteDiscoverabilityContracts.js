// Publish-time contracts for the structured Website Builder.
// This module is deliberately pure so the editor, Discoverability Engine, and
// deployment checks can evaluate the same rules without a database or renderer.

const text = (value) => typeof value === 'string' ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''

function sectionText(section) {
  const values = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    for (const value of Object.values(node.settings || {})) if (typeof value === 'string') values.push(text(value))
    for (const value of Object.values(node.content || {})) if (typeof value === 'string') values.push(text(value))
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child)
  }
  walk(section)
  return values.filter(Boolean).join(' ')
}

function pageList(content = {}) {
  const pages = Array.isArray(content.pages) ? content.pages : []
  const home = {
    id: 'home', title: content.title || 'Home', slug: '',
    seo_title: content.seo_title || '', seo_description: content.seo_description || '',
    sections: Array.isArray(content.sections) ? content.sections : []
  }
  return [home, ...pages.filter(page => page && page !== home)]
}

function issue(page, section, contract, message, severity = 'High', autoFixable = false) {
  return {
    id: `website-contract-${page.slug || 'home'}-${section?.id || 'page'}-${contract}`,
    category: 'Website Builder contract', contract, severity,
    title: message, description: message,
    page: page.title || page.slug || 'Home', affectedUrl: page.slug ? `/${page.slug}` : '/',
    section_id: section?.id || null, autoFixable, status: 'pending'
  }
}

export function auditWebsiteDiscoverabilityContracts(content = {}, dealer = {}) {
  const issues = []
  const pages = pageList(content)
  for (const page of pages) {
    const sections = Array.isArray(page.sections) ? page.sections : []
    const allText = sections.map(sectionText).join(' ')
    const hero = sections.find(section => ['hero', 'split_hero', 'image_hero', 'video_hero', 'inventory_hero', 'promotional_hero'].includes(section?.type))
    const inventory = sections.find(section => ['featured_inventory', 'new_inventory', 'used_inventory', 'vehicle_grid', 'inventory_grid', 'vehicle_carousel'].includes(section?.type))
    const service = sections.find(section => ['service', 'service_cta', 'service_booking', 'service_faq'].includes(section?.type))
    const location = sections.find(section => ['location', 'locations', 'map', 'contact'].includes(section?.type))

    if (!text(page.title)) issues.push(issue(page, null, 'page-title', 'Every published page needs a visible title.', 'High', true))
    if (!text(page.slug) && page !== pages[0]) issues.push(issue(page, null, 'page-slug', 'Every published page needs a stable URL slug.', 'High', true))
    if (!text(page.seo_title)) issues.push(issue(page, null, 'seo-title', 'Add an SEO title before publishing this page.', 'Medium', true))
    if (!text(page.seo_description)) issues.push(issue(page, null, 'seo-description', 'Add a meta description before publishing this page.', 'Medium', true))
    if (!hero && !/\b<h1\b/i.test(sections.map(s => s?.settings?.html || s?.content?.html || '').join(' '))) {
      issues.push(issue(page, null, 'heading-hierarchy', 'Add one hero or primary H1 section so crawlers can identify the page topic.', 'High', false))
    }
    if (inventory && !/\b(inventory|vehicle|shop|cars?|suv|truck)\b/i.test(allText)) {
      issues.push(issue(page, inventory, 'inventory-context', 'Inventory sections need descriptive surrounding copy and crawlable vehicle context.', 'Medium', false))
    }
    if (service && !/\b(service|maintenance|repair|appointment)\b/i.test(allText)) {
      issues.push(issue(page, service, 'service-context', 'Service sections need visible service or appointment context.', 'Medium', false))
    }
    if (location && (!text(dealer.name) || !text(dealer.address) || !text(dealer.phone))) {
      issues.push(issue(page, location, 'local-entity', 'Location/contact sections require canonical dealership name, address, and phone data.', 'High', false))
    }
  }
  const critical = issues.filter(item => item.severity === 'Critical').length
  const high = issues.filter(item => item.severity === 'High').length
  const medium = issues.filter(item => item.severity === 'Medium').length
  return {
    // A clean draft is not proof of a clean public page. Discoverability only
    // reports "optimized" after the published projection exists and can be
    // recrawled by the same renderer used by visitors.
    optimized: dealer.site_published === true && issues.length === 0,
    publicationProof: dealer.site_published === true ? 'published-projection' : 'draft-only',
    score: Math.max(0, 100 - (critical * 30) - (high * 15) - (medium * 5)),
    issues, pagesChecked: pages.length,
    contractsChecked: pages.length * 4,
    scannedAt: new Date().toISOString()
  }
}

export function websitePublishBlockingIssues(result) {
  return (result?.issues || []).filter(issue => issue.severity === 'Critical' || (issue.contract === 'heading-hierarchy' && issue.severity === 'High'))
}

export function auditAutomotiveComponentContracts(content = {}, dealer = {}) {
  const issues = []
  for (const page of pageList(content)) for (const section of Array.isArray(page.sections) ? page.sections : []) {
    const type = section?.type || ''; const settings = { ...(section.settings || {}), ...(section.content || {}) }; const add = (contract, message, severity = 'Medium') => issues.push(issue(page, section, contract, message, severity, false))
    if (['inventory_grid', 'featured_inventory', 'new_inventory', 'used_inventory', 'vehicle_carousel'].includes(type)) {
      if (!settings.vdpUrl && !settings.vehicleLink && !settings.dynamicSource) add('inventory-vdp-link', 'Inventory components must bind each vehicle to a canonical VDP URL.', 'Critical')
      if (!settings.image && !settings.imageField && !settings.dynamicSource) add('inventory-image', 'Inventory components must bind a factual vehicle image.', 'Medium')
    }
    if (['vehicle_detail', 'vdp', 'vehicle'].includes(type)) {
      if (!settings.canonical && !settings.canonicalUrl) add('vdp-canonical', 'Vehicle Detail components require a canonical URL binding.', 'Critical')
      if (!settings.vehicleSchema && !settings.schema && !settings.dynamicSource) add('vdp-schema', 'Vehicle Detail components require a Vehicle/Offer schema binding.', 'Critical')
      if (!settings.vin && !settings.vinField && !settings.dynamicSource) add('vdp-vin', 'Vehicle Detail components require a canonical VIN binding.', 'Critical')
    }
    if (['location', 'locations', 'map', 'contact'].includes(type) && (!text(dealer.name) || !text(dealer.address) || !text(dealer.phone))) add('location-entity', 'Dealer Location components require canonical dealership identity data.', 'High')
    if (['service', 'service_cta', 'service_booking'].includes(type) && !settings.department && !settings.dynamicSource) add('service-department', 'Service components should bind to the canonical service department.', 'Medium')
  }
  return { issues, blockingIssues: issues.filter(item => item.severity === 'Critical'), status: issues.some(item => item.severity === 'Critical') ? 'fail' : issues.length ? 'warn' : 'pass' }
}
