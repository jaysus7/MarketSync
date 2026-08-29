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
