/**
 * MarketSync HQ — Executive Pulse, Analytics, and Global Search REST API.
 */
import { requireHqAuth } from '../hq-auth.js'
import { HqAnalyticsPulseService } from '../services/hqAnalyticsPulseService.js'

export function registerHqPulse(app) {
  // ── 1. HQ Executive Pulse Command Center ──
  app.get('/hq/pulse', requireHqAuth, async (req, res) => {
    try {
      const pulse = await HqAnalyticsPulseService.getExecutivePulse()
      res.json(pulse)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 2. Full-Funnel Attribution & Unit Economics ──
  app.get('/hq/pulse/analytics', requireHqAuth, async (req, res) => {
    try {
      const analytics = await HqAnalyticsPulseService.getAttributionAndEconomics()
      res.json(analytics)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 3. Cmd+K Global Search ──
  app.get('/hq/pulse/search', requireHqAuth, async (req, res) => {
    try {
      const { q } = req.query
      const searchResults = await HqAnalyticsPulseService.globalSearch(q || '')
      res.json(searchResults)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
