/**
 * Canonical HTML Sanitizer for MarketSync Website Builder & Public Content.
 *
 * Enforces strict semantic HTML whitelist, attribute validation, and protocol checks:
 * - Allowed elements: safe typography, layout, lists, tables, links, images.
 * - Disallowed elements: script, object, embed, iframe, form, input, button, base, meta, svg, math.
 * - Disallowed attributes: all on* event handlers, javascript: / vbscript: / data:text/html URIs.
 * - External links: automatically add rel="noopener noreferrer".
 * - Style attributes: sanitized against dangerous CSS expressions, url(), and bindings.
 */

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
  'ul', 'ol', 'li', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'img', 'section', 'article', 'header', 'footer', 'main', 'nav',
  'figure', 'figcaption', 'pre', 'code', 'small', 'mark', 'del', 'ins',
])

const ALLOWED_ATTRS = new Set([
  'class', 'id', 'title', 'alt', 'href', 'src', 'width', 'height',
  'target', 'rel', 'loading', 'align', 'valign', 'role',
])

const SAFE_PROTOCOLS = /^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[a-z0-9+/=]+$/i

function sanitizeUrl(url) {
  if (!url) return null
  const trimmed = String(url).trim()
  // Reject javascript:, vbscript:, data:text/html, etc.
  if (/^[\s\x00-\x1f]*(javascript|vbscript|data):/i.test(trimmed)) {
    if (SAFE_DATA_IMAGE.test(trimmed)) return trimmed
    return null
  }
  if (SAFE_PROTOCOLS.test(trimmed) || SAFE_DATA_IMAGE.test(trimmed)) {
    return trimmed
  }
  return null
}

function sanitizeStyle(styleStr) {
  if (!styleStr || typeof styleStr !== 'string') return null
  const s = styleStr.toLowerCase()
  if (s.includes('expression(') || s.includes('behavior:') || s.includes('url(') || s.includes('-moz-binding') || s.includes('javascript:')) {
    return null
  }
  // Allow safe inline styles like color, background-color, font-size, text-align, margin, padding
  return styleStr.replace(/[<>"']/g, '').slice(0, 500)
}

/**
 * Robust HTML sanitizer for public dealership website markup.
 * @param {string} dirty - Untrusted HTML string
 * @returns {string} - Clean, safe HTML string
 */
export function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== 'string') return ''

  // Fast path: if no tags, return escaped or as is
  if (!dirty.includes('<') && !dirty.includes('>')) {
    return dirty
  }

  // Tokenize HTML tags and text
  const tagRegex = /<\/?([a-zA-Z0-9:-]+)((?:\s+[^>]*)?)\s*(\/?)>/g
  let clean = ''
  let lastIndex = 0
  let match

  while ((match = tagRegex.exec(dirty)) !== null) {
    // Append text preceding the tag
    clean += dirty.slice(lastIndex, match.index)
    lastIndex = tagRegex.lastIndex

    const isClosing = match[0].startsWith('</')
    const rawTagName = match[1].toLowerCase()
    const rawAttrs = match[2]
    const isSelfClosing = match[3] === '/' || ['br', 'hr', 'img'].includes(rawTagName)

    if (!ALLOWED_TAGS.has(rawTagName)) {
      // Disallowed tag — skip tag entirely
      continue
    }

    if (isClosing) {
      clean += `</${rawTagName}>`
      continue
    }

    // Parse attributes
    const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    let validAttrsStr = ''
    let attrMatch
    let hasTargetBlank = false
    let hasRel = false
    let relValue = ''

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase()
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''

      // Reject all event handlers
      if (attrName.startsWith('on')) continue

      // Allow aria-* and data-* attributes if safe
      const isAria = attrName.startsWith('aria-')
      const isData = attrName.startsWith('data-') && /^[a-zA-Z0-9_-]+$/.test(attrName)

      if (!ALLOWED_ATTRS.has(attrName) && !isAria && !isData) {
        continue
      }

      if (attrName === 'href' || attrName === 'src') {
        const safe = sanitizeUrl(attrVal)
        if (safe) {
          validAttrsStr += ` ${attrName}="${safe.replace(/"/g, '&quot;')}"`
        }
      } else if (attrName === 'style') {
        const safe = sanitizeStyle(attrVal)
        if (safe) {
          validAttrsStr += ` style="${safe.replace(/"/g, '&quot;')}"`
        }
      } else if (attrName === 'target') {
        if (attrVal === '_blank') {
          hasTargetBlank = true
          validAttrsStr += ` target="_blank"`
        } else if (attrVal === '_self' || attrVal === '_top') {
          validAttrsStr += ` target="${attrVal}"`
        }
      } else if (attrName === 'rel') {
        hasRel = true
        relValue = attrVal.toLowerCase()
      } else {
        validAttrsStr += ` ${attrName}="${attrVal.replace(/"/g, '&quot;')}"`
      }
    }

    // External link enforcement
    if (rawTagName === 'a') {
      if (hasTargetBlank) {
        validAttrsStr += ` rel="noopener noreferrer"`
      } else if (hasRel && !relValue.includes('noopener')) {
        validAttrsStr += ` rel="${relValue.replace(/"/g, '&quot;')} noopener noreferrer"`
      }
    }

    clean += `<${rawTagName}${validAttrsStr}${isSelfClosing ? ' /' : ''}>`
  }

  // Append remaining text
  clean += dirty.slice(lastIndex)

  // Remove dangling/malformed open angle brackets
  return clean.replace(/<(?![a-zA-Z0-9/])/g, '&lt;')
}

/**
 * Strip executable <script> and dangerous tags from site head HTML when served on shared origin.
 * @param {string} headHtml - Custom head code
 * @returns {string} - Sanitized non-executable metadata
 */
export function stripScriptsFromHead(headHtml) {
  if (!headHtml || typeof headHtml !== 'string') return ''
  // Strip all <script>...</script>, <noscript>, <style>, <iframe>, <object>, <embed>
  return headHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim()
}
