/**
 * Dealer Site Head Service
 * Generates SEO metadata and Open Graph tags for dealer sites
 */

export function buildDealerSiteMetadata(site, options = {}) {
  const { publicSiteOrigin } = options

  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : site.slug
      ? `${publicSiteOrigin}/site/${encodeURIComponent(site.slug)}`
      : publicSiteOrigin

  const title = site.seo_title || site.name || 'Dealer Site'
  const description = site.seo_description || site.about || site.tagline || 'Browse our vehicle inventory'
  const image = site.seo_image || site.hero_banner_url || null

  return {
    url: siteUrl,
    title,
    description,
    image,
    name: site.name,
    city: site.city,
    province: site.province,
    phone: site.phone,
    email: site.email,
    address: site.address,
    logo_url: site.logo_url,
    keywords: Array.isArray(site.seo_keywords)
      ? site.seo_keywords.join(', ')
      : site.seo_keywords || '',
  }
}

export function renderDealerSiteHead(metadata) {
  const escapeHtml = (str) => {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const tags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}">`,
  ]

  if (metadata.keywords) {
    tags.push(`<meta name="keywords" content="${escapeHtml(metadata.keywords)}">`)
  }

  if (metadata.phone) {
    tags.push(`<meta name="phone" content="${escapeHtml(metadata.phone)}">`)
  }

  if (metadata.address) {
    tags.push(`<meta name="address" content="${escapeHtml(metadata.address)}">`)
  }

  // Open Graph tags
  tags.push(`<meta property="og:type" content="website">`)
  tags.push(`<meta property="og:url" content="${escapeHtml(metadata.url)}">`)
  tags.push(`<meta property="og:title" content="${escapeHtml(metadata.title)}">`)
  tags.push(`<meta property="og:description" content="${escapeHtml(metadata.description)}">`)

  if (metadata.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(metadata.image)}">`)
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(metadata.title)}">`)
  }

  if (metadata.logo_url) {
    tags.push(`<meta property="og:logo" content="${escapeHtml(metadata.logo_url)}">`)
  }

  // Twitter Card tags
  tags.push(`<meta name="twitter:card" content="summary_large_image">`)
  tags.push(`<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`)
  tags.push(`<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`)

  if (metadata.image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`)
  }

  // Canonical URL
  tags.push(`<link rel="canonical" href="${escapeHtml(metadata.url)}">`)

  // Schema.org markup for LocalBusiness
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': metadata.name,
    'url': metadata.url,
    'description': metadata.description,
  }

  if (metadata.logo_url) schema['logo'] = metadata.logo_url
  if (metadata.phone) schema['telephone'] = metadata.phone
  if (metadata.address) schema['address'] = metadata.address
  if (metadata.image) schema['image'] = metadata.image

  tags.push(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`)

  return tags.join('\n')
}
