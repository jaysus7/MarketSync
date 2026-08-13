// Public checkout returns must stay on the MarketSync site or the dealer's
// verified custom domain. Stripe redirects the shopper here after payment, so
// accepting arbitrary URLs would make the successful-payment screen a phishing
// redirect.

function originFor(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

export function safePublicReturnBase({ rawReturn, frontendUrl, siteSlug, customDomain, customDomainVerified }) {
  const fallback = new URL('/site.html', frontendUrl)
  if (siteSlug) fallback.searchParams.set('d', siteSlug)

  const allowedOrigins = new Set([originFor(frontendUrl)].filter(Boolean))
  if (customDomainVerified && customDomain) {
    const host = String(customDomain)
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
    if (host) allowedOrigins.add(`https://${host}`)
  }

  try {
    const candidate = new URL(String(rawReturn || ''))
    if (candidate.protocol === 'https:' && allowedOrigins.has(candidate.origin)) {
      // Discard caller-controlled query/hash values; the server adds the only
      // post-checkout state it needs below. The hosted multi-tenant site needs
      // its matching dealer slug, so retain only that one known-safe parameter.
      const result = new URL(candidate.pathname, candidate.origin)
      if (candidate.origin === originFor(frontendUrl) && siteSlug && candidate.searchParams.get('d') === siteSlug) {
        result.searchParams.set('d', siteSlug)
      }
      return result
    }
  } catch {}
  return fallback
}

export function depositReturnUrl(baseUrl, status) {
  const result = new URL(baseUrl)
  result.searchParams.set('deposit', status)
  return result.toString()
}
