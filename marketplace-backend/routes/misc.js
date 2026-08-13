import { isSafeHttpUrl } from '../feed-probe-policy.js'

export function registerRoutes(app) {
  app.get('/proxy-image', async (req, res) => {
    const { url } = req.query
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'No URL provided' })
    if (!(await isSafeHttpUrl(url))) return res.status(400).json({ error: 'Invalid or disallowed URL' })
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketSync-Proxy/1.0)' },
        signal: AbortSignal.timeout(10000)
      })
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) {
        return res.status(400).json({ error: 'Remote resource is not an image' })
      }
      const buffer = await response.arrayBuffer()
      res.set({
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      })
      res.send(Buffer.from(buffer))
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch image' })
    }
  })
}
