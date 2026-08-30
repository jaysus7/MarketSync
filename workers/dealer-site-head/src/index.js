/**
 * Dealer site <head> injector.
 *
 * The public dealer site is a client-rendered shell: title, description, canonical,
 * Open Graph and schema are all written by JavaScript after load. Anything that does
 * not execute JS — search engines, social unfurlers, and MarketSync's own
 * Discoverability crawler — receives only the static head, which carries the
 * placeholder <title>Inventory</title> and nothing else, identically for every
 * dealership.
 *
 * This worker streams the real metadata into that head as the page is served. The
 * metadata itself is computed by the backend, from the same published payload the
 * client renders from, so the two cannot drift and the edge holds no business logic.
 *
 * Two rules govern everything below:
 *
 *   1. It is never allowed to break a page. Every failure path — lookup miss, slow or
 *      unreachable API, malformed response — returns the origin response untouched.
 *      A dealership's website loading without ideal metadata is a bad day; a
 *      dealership's website not loading is an outage.
 *
 *   2. It serves the same HTML to everyone. There is no user-agent branching and no
 *      bot-only path, because showing crawlers something visitors do not get is
 *      cloaking, and search engines penalise it.
 */

// A slow metadata lookup must not hold up the page. The endpoint is cached at the
// edge, so this budget is only ever spent on a cold miss.
const METADATA_TIMEOUT_MS = 800

// The backend caches this response for 5 minutes; mirror that at the edge so a
// dealership's pages share one lookup.
const METADATA_CACHE_TTL_S = 300

/**
 * Which dealership, if any, this request is for.
 *
 * The hosted form carries the slug in `?d=`; a connected custom domain carries no
 * slug at all and is resolved by hostname. Anything else — an asset, an API call, the
 * marketing site — is not a dealer page and must be left alone.
 */
export function resolveLookup(url, { publicSiteHost = null } = {}) {
  const path = url.pathname
  const slug = url.searchParams.get('d')

  // Never touch anything that is not the site shell itself.
  const isShellPath = path === '/' || path === '/index.html' || path === '/site.html'
  if (!isShellPath) return null

  if (slug) {
    const clean = String(slug).trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(clean)) return null
    return { by: 'slug', value: clean }
  }

  // On the hosted origin a shell request without a slug identifies no dealership.
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (publicSiteHost && host === String(publicSiteHost).toLowerCase().replace(/^www\./, '')) return null
  if (!host || !host.includes('.')) return null
  return { by: 'host', value: host }
}

/** Only HTML documents can carry a head worth rewriting. */
export function isHtmlResponse(response) {
  const type = response.headers.get('content-type') || ''
  return /text\/html|application\/xhtml\+xml/i.test(type)
}

export function metadataUrl(apiOrigin, lookup) {
  const base = String(apiOrigin).replace(/\/+$/, '')
  return lookup.by === 'slug'
    ? `${base}/site/${encodeURIComponent(lookup.value)}/head-metadata`
    : `${base}/site-head-metadata?host=${encodeURIComponent(lookup.value)}`
}

async function fetchMetadata(apiOrigin, lookup) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS)
  try {
    const response = await fetch(metadataUrl(apiOrigin, lookup), {
      signal: controller.signal,
      cf: { cacheTtl: METADATA_CACHE_TTL_S, cacheEverything: true },
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const body = await response.json()
    return body && typeof body.head_html === 'string' && body.head_html.trim() ? body : null
  } catch {
    // Timeout, DNS, non-JSON — all the same answer: serve the page as it came.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Drop the shell's placeholder title and append the real tags. The rewrite streams, so
 * it does not buffer the document or delay the first byte.
 */
export function injectHead(response, headHtml) {
  return new HTMLRewriter()
    .on('head > title', {
      element(element) {
        element.remove()
      },
    })
    .on('head', {
      element(element) {
        element.append(headHtml, { html: true })
      },
    })
    .transform(response)
}

export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request)

    try {
      // Only GET documents. A HEAD, POST or redirect has no head to rewrite.
      if (request.method !== 'GET' || !isHtmlResponse(response)) return response

      const lookup = resolveLookup(new URL(request.url), { publicSiteHost: env.PUBLIC_SITE_HOST })
      if (!lookup) return response

      const apiOrigin = env.API_ORIGIN
      if (!apiOrigin) return response

      const metadata = await fetchMetadata(apiOrigin, lookup)
      if (!metadata) return response

      return injectHead(response, metadata.head_html)
    } catch {
      // The origin response is already in hand; nothing this worker does is worth
      // failing a dealership's homepage over.
      return response
    }
  },
}
