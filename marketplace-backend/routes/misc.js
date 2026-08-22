import { rateLimit } from '../security.js'
import { safeOutboundFetch } from '../outbound-http-policy.js'

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB

export function registerRoutes(app) {
  app.get('/proxy-image', rateLimit('proxy-image', 60, 60 * 1000), async (req, res) => {
    const { url } = req.query
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'No URL provided' })

    try {
      const response = await safeOutboundFetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketSync-Proxy/1.0)' },
        timeout: 10000,
        maxRedirects: 3
      })

      if (!response.ok) {
        return res.status(response.status).json({ error: `Remote server responded with ${response.status}` })
      }

      const rawContentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!ALLOWED_IMAGE_MIMES.has(rawContentType)) {
        return res.status(400).json({ error: 'Remote resource is not an allowed image format' })
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
      if (contentLength > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: 'Image exceeds maximum allowed size (10MB)' })
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: 'Image exceeds maximum allowed size (10MB)' })
      }

      res.set({
        'Content-Type': rawContentType,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      })
      res.send(Buffer.from(buffer))
    } catch (e) {
      res.status(400).json({ error: e.message || 'Failed to fetch image' })
    }
  })
}

