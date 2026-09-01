/**
 * Server-rendered <head> metadata for public dealer websites.
 *
 * site.html is a client-rendered shell: title, description, canonical, Open Graph and
 * schema are all injected by JavaScript after load. Anything that does not execute JS -
 * search engines, social unfurlers, and MarketSync's own Discoverability crawler - sees
 * only the static head, which carries the placeholder <title>Inventory</title> and
 * nothing else, identically for every dealership.
 *
 * This module produces that metadata on the server from the same published payload the
 * client renders from, so the two cannot drift. It is deliberately delivery-agnostic:
 * `buildDealerSiteMetadata` feeds a JSON endpoint (for an edge worker to inject) and
 * `renderDealerSiteHead` produces the tag block directly (for an origin that serves the
 * shell itself). Whichever delivery path is chosen, the metadata is computed once, here.
 *
 * It invents nothing. Every value is either configured by the dealer or derived from
 * canonical dealership facts; where neither exists the field is omitted rather than
 * filled with a plausible-looking default.
 */

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

/** Escape for use in an HTML attribute value. */
export function escapeAttribute(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape for use in element text (a <title>). */
export function escapeText(value) {
  return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The public address the site is actually served from. A verified custom domain wins;
 * otherwise the hosted slug URL. Never an internal or preview address.
 */
export function dealerPublicUrl(site = {}, publicSiteOrigin = '') {
  const domain = clean(site.custom_domain).replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (domain && site.custom_domain_verified) return `https://${domain}`
  const slug = clean(site.slug || site.site_slug)
  if (!slug || !publicSiteOrigin) return null
  return `${String(publicSiteOrigin).replace(/\/+$/, '')}/site.html?d=${encodeURIComponent(slug)}`
}

/**
 * Title falls back through dealer-configured SEO, then a factual name+location line.
 * Location is only appended when the dealership actually records one.
 */
function defaultTitle(site = {}) {
  const name = clean(site.name)
  if (!name) return null
  const place = [clean(site.city), clean(site.province)].filter(Boolean).join(', ')
  return place ? `${name} | ${place}` : name
}

export function buildDealerSiteMetadata(site = {}, { publicUrl = null, publicSiteOrigin = '' } = {}) {
  const canonical = publicUrl || dealerPublicUrl(site, publicSiteOrigin)
  const title = clean(site.seo_title) || defaultTitle(site) || null
  const description = clean(site.seo_description) || clean(site.about) || clean(site.discovery_summary) || null
  const image = clean(site.seo_image) || clean(site.hero_banner_url) || clean(site.logo_url) || null
  const keywords = clean(site.seo_keywords) || null

  // Only claim an entity when the facts backing it exist.
  const address = site.address && typeof site.address === 'object' ? site.address : null
  const schema = title
    ? {
        '@context': 'https://schema.org',
        '@type': 'AutoDealer',
        name: clean(site.name) || title,
        ...(canonical ? { url: canonical } : {}),
        ...(image ? { image } : {}),
        ...(clean(site.phone) ? { telephone: clean(site.phone) } : {}),
        ...(description ? { description } : {}),
        ...(address || clean(site.city)
          ? {
              address: {
                '@type': 'PostalAddress',
                ...(clean(address?.street || site.address) ? { streetAddress: clean(address?.street || site.address) } : {}),
                ...(clean(site.city) ? { addressLocality: clean(site.city) } : {}),
                ...(clean(site.province) ? { addressRegion: clean(site.province) } : {}),
                ...(clean(address?.postal_code || site.postal_code) ? { postalCode: clean(address?.postal_code || site.postal_code) } : {})
              }
            }
          : {})
      }
    : null

  return { title, description, canonical, image, keywords, schema }
}

/**
 * Render the metadata as head tags. Only fields that exist are emitted: a missing
 * description must be absent, never an empty tag.
 */
export function renderDealerSiteHead(metadata = {}) {
  const tags = []
  if (metadata.title) {
    tags.push(`<title>${escapeText(metadata.title)}</title>`)
    tags.push(`<meta property="og:title" content="${escapeAttribute(metadata.title)}">`)
  }
  if (metadata.description) {
    tags.push(`<meta name="description" content="${escapeAttribute(metadata.description)}">`)
    tags.push(`<meta property="og:description" content="${escapeAttribute(metadata.description)}">`)
  }
  if (metadata.canonical) {
    tags.push(`<link rel="canonical" href="${escapeAttribute(metadata.canonical)}">`)
    tags.push(`<meta property="og:url" content="${escapeAttribute(metadata.canonical)}">`)
  }
  if (metadata.image) {
    tags.push(`<meta property="og:image" content="${escapeAttribute(metadata.image)}">`)
    tags.push(`<meta name="twitter:card" content="summary_large_image">`)
  }
  if (metadata.keywords) tags.push(`<meta name="keywords" content="${escapeAttribute(metadata.keywords)}">`)
  if (metadata.title) tags.push(`<meta property="og:type" content="website">`)
  if (metadata.schema) {
    // </script> inside JSON would terminate the block early.
    const json = JSON.stringify(metadata.schema).replace(/</g, '\\u003c')
    tags.push(`<script type="application/ld+json">${json}</script>`)
  }
  return tags.join('\n')
}

/**
 * Replace the shell's placeholder head with the rendered metadata. Used by an origin
 * that serves site.html directly; an edge worker would inject the same tag block.
 */
export function injectDealerSiteHead(html, metadata = {}) {
  const rendered = renderDealerSiteHead(metadata)
  if (!rendered) return html
  const withoutPlaceholder = metadata.title ? String(html).replace(/<title>[\s\S]*?<\/title>/i, '') : String(html)
  return withoutPlaceholder.replace(/<\/head>/i, `${rendered}\n</head>`)
}
