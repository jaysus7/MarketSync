import { supabaseAdmin, isPlatformOwner, audit, browserFetch, requireMfa, requirePermission, requireAuth } from '../ai-helpers.js'
import { marketcheckEnabled, marketcheckCompetitorStats, recordUsage } from '../ai-runtime.js'
import { runPhotoVision, scoreVehiclePhotos } from '../../sync/photoVision.js'

export function registerAiCompetitorVisionRoutes(app) {
  // ── AI Vision — photo quality scoring (part of AI Boost) ─────────────────

  async function visionActive(req) {
    if (isPlatformOwner(req)) return true
    const { data } = await supabaseAdmin
      .from('dealerships').select('ai_boost_active').eq('id', req.dealershipId).single()
    return !!data?.ai_boost_active
  }

  // Kick off a background photo scan of the dealership's inventory.
  app.post('/ai/vision/scan', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!await visionActive(req)) {
      return res.status(403).json({ error: 'AI Vision not active' })
    }
    const rescan = req.query.rescan === '1' || req.body?.rescan === true
    const { data: pending } = await supabaseAdmin.from('inventory')
      .select('id, image_urls, photo_checked_at, photo_analysis')
      .eq('dealership_id', req.dealershipId).eq('status', 'available')
      .order('created_at', { ascending: false }).limit(600)
    const todo = (pending || []).filter(r => {
      if (rescan || !r.photo_checked_at) return true
      const cur = Array.isArray(r.image_urls) ? r.image_urls.filter(Boolean).length : 0
      const prev = r.photo_analysis?.photo_count ?? null
      return prev !== cur
    })

    const FIRST_BATCH = 6
    const head = todo.slice(0, FIRST_BATCH)
    await Promise.all(head.map(async row => {
      try {
        const { score, flags, analysis } = await scoreVehiclePhotos(row)
        await supabaseAdmin.from('inventory').update({
          photo_score: score, photo_flags: flags, photo_analysis: analysis,
          photo_checked_at: new Date().toISOString(),
        }).eq('id', row.id)
        if (analysis?.gallery) recordUsage(req.dealershipId, { ai: 1 })
      } catch (e) { console.warn('[ai-vision] first-batch score failed:', e.message) }
    }))

    res.json({ status: 'scanning', total: todo.length, scored_now: head.length })
    if (todo.length > FIRST_BATCH) {
      runPhotoVision(req.dealershipId, { rescan }).catch(e => console.warn('[ai-vision] scan failed:', e.message))
    }
  })

  // Return scored vehicles (worst first) + a summary.
  app.get('/ai/vision/results', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!await visionActive(req)) {
      return res.status(403).json({ error: 'AI Vision not active' })
    }
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, stocknumber, image_urls, photo_score, photo_flags, photo_checked_at')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')
    if (error) return res.status(500).json({ error: error.message })

    const rows = data || []
    const scored = rows.filter(r => r.photo_checked_at)
    const vehicles = scored
      .map(r => ({
        id: r.id,
        label: [r.year, r.make, r.model, r.trim].filter(Boolean).join(' '),
        stocknumber: r.stocknumber || null,
        photo_count: Array.isArray(r.image_urls) ? r.image_urls.length : 0,
        thumb: Array.isArray(r.image_urls) ? r.image_urls[0] : null,
        score: r.photo_score ?? 0,
        flags: r.photo_flags || [],
      }))
      .sort((a, b) => a.score - b.score)

    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.photo_score || 0), 0) / scored.length) : null
    res.json({
      summary: {
        total: rows.length,
        scored: scored.length,
        unscored: rows.length - scored.length,
        avg_score: avg,
        needs_attention: vehicles.filter(v => v.score < 50).length,
        no_photos: vehicles.filter(v => v.photo_count === 0).length,
      },
      vehicles,
    })
  })

  // ── Competitor Monitoring ────────────────────────────────────────────────

  app.get('/ai/competitors', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin
      .from('competitor_dealerships')
      .select('*')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ competitors: data || [] })
  })

  app.post('/ai/competitors', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { name, autotrader_url } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const { data, error } = await supabaseAdmin
      .from('competitor_dealerships')
      .insert({ dealership_id: req.dealershipId, name, autotrader_url: autotrader_url || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ competitor: data })
  })

  app.patch('/ai/competitors/:id', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { autotrader_url } = req.body || {}
    const { data, error } = await supabaseAdmin
      .from('competitor_dealerships')
      .update({ autotrader_url: autotrader_url || null })
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ competitor: data })
  })

  app.delete('/ai/competitors/:id', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: before } = await supabaseAdmin
      .from('competitor_dealerships').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!before) return res.status(404).json({ error: 'Competitor not found' })
    const { error } = await supabaseAdmin
      .from('competitor_dealerships')
      .delete()
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'inventory.competitor_deleted', { before_state: before, after_state: null })
    res.json({ deleted: true })
  })

  app.post('/ai/competitors/scan', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, country')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })

    const _compIsUS = (() => {
      const c = (dealer?.country || '').trim().toUpperCase()
      return c === 'US' || c === 'USA' || c === 'UNITED STATES'
    })()

    const { data: competitors } = await supabaseAdmin
      .from('competitor_dealerships')
      .select('*')
      .eq('dealership_id', req.dealershipId)

    function parseSchemaOrg(html) {
      const prices = []
      let listing_count = null
      const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      let m
      while ((m = scriptRe.exec(html)) !== null) {
        try {
          const blob = JSON.parse(m[1])
          const items = Array.isArray(blob) ? blob : (blob['@graph'] ? blob['@graph'] : [blob])
          for (const item of items) {
            const type = item['@type'] || ''
            if (/Car|Vehicle|Product|Offer/i.test(type)) {
              const price = Number(item?.offers?.price ?? item?.price ?? 0)
              if (price > 1000 && price < 500_000) prices.push(price)
            }
            if (/ItemList/i.test(type) && item.numberOfItems) listing_count = Number(item.numberOfItems)
          }
        } catch {}
      }
      return { prices, listing_count }
    }

    async function tryJsonFeedFallback(origin) {
      const FEED_PATHS = [
        '/api/inventory?format=json&limit=200',
        '/inventory.json',
        '/vehicles.json',
        '/api/vehicles?limit=200',
        '/api/inventory/vehicles?limit=200',
        '/feeds/inventory.json',
      ]
      for (const path of FEED_PATHS) {
        try {
          const r = await browserFetch(origin + path, {
            signal: AbortSignal.timeout(8000),
            headers: { Accept: 'application/json' }
          })
          if (!r.ok) continue
          const ct = r.headers.get('content-type') || ''
          if (!ct.includes('json')) continue
          const data = await r.json()
          const arr = Array.isArray(data) ? data : (data.vehicles ?? data.inventory ?? data.items ?? data.listings ?? data.results ?? [])
          if (!Array.isArray(arr) || !arr.length) continue
          const prices = arr.map(v => Number(v.price ?? v.sellingPrice ?? v.listPrice ?? 0)).filter(p => p > 1000 && p < 500_000)
          if (prices.length) {
            const sorted = [...prices].sort((a, b) => a - b)
            return {
              listing_count: arr.length,
              avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
              min_price: sorted[0],
              max_price: sorted[sorted.length - 1],
              platform: 'JSON feed',
              scanned_at: new Date().toISOString()
            }
          }
        } catch {}
      }
      return null
    }

    async function sitemapCountFallback(origin) {
      if (!origin) return null
      const EXCLUDE = /\/(vlp|srp|showroom|search|buildandprice|build-and-price|blog|category|page|author|tag|about|contact|service|parts|finance|specials|staff|reviews|directions)\/?/i
      const INCLUDE = /\/(vdp|vehicle-details|vehicledetails)\b|\/(new|used|certified|pre-owned)\/[^/]+\/[^/]+|\/(vehicle|vehicles|inventory)\/[^/]*(19|20)\d{2}[-_ ][a-z]|\/(19|20)\d{2}-[a-z][a-z0-9-]+-[a-z0-9]+\/?$|[?&](vehicleid|vin|stock|stk)=/i
      const seen = new Set()
      let sniffedXml = ''
      const tried = new Set()

      const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      const fetchText = async (u, accept) => {
        for (const ua of [null, GOOGLEBOT_UA]) {
          try {
            const headers = { 'Accept': accept }
            if (ua) headers['User-Agent'] = ua
            const r = await browserFetch(u, { signal: AbortSignal.timeout(9000), headers })
            if (r.ok) return await r.text()
          } catch {}
        }
        return null
      }

      const collect = async (u, depth = 0) => {
        if (depth > 3 || seen.size > 8000 || tried.has(u)) return
        tried.add(u)
        const xml = await fetchText(u, 'application/xml, text/xml, */*')
        if (xml == null) return
        sniffedXml += xml.slice(0, 4000)
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1].trim().replace(/&amp;/g, '&'))
        if (/<sitemapindex/i.test(xml)) {
          const invChildren = locs.filter(c => /inventory|vehicle|listing|vdp|used|new|certified/i.test(c))
          for (const child of invChildren.slice(0, 15)) await collect(child, depth + 1)
          if (seen.size === 0) {
            for (const child of locs.slice(0, 8)) await collect(child, depth + 1)
          }
          return
        }
        for (const loc of locs) {
          if (INCLUDE.test(loc) && !EXCLUDE.test(loc)) seen.add(loc)
        }
      }

      const sitemapUrls = []
      const robotsTxt = await fetchText(origin + '/robots.txt', 'text/plain, */*')
      if (robotsTxt) {
        for (const m of robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)/gim)) sitemapUrls.push(m[1].trim())
      }

      const candidates = [
        ...sitemapUrls,
        origin + '/inventory-listing-sitemap.xml', origin + '/vehicles-sitemap.xml',
        origin + '/inventory-sitemap.xml', origin + '/inventory_sitemap.xml',
        origin + '/sitemap_index.xml', origin + '/sitemap.xml', origin + '/sitemap-index.xml',
        origin + '/sitemap/sitemap.xml', origin + '/sitemap/index.xml',
        origin + '/vehicle-sitemap.xml', origin + '/used-inventory-sitemap.xml',
        origin + '/new-inventory-sitemap.xml', origin + '/sitemapindex.xml',
      ]
      for (const url of candidates) {
        await collect(url)
        if (seen.size > 0) break
      }
      if (seen.size === 0) return null

      const sample = [...seen].slice(0, 50).join(' ') + ' ' + sniffedXml
      let platform = 'Sitemap'
      if (/edealer|\/vdp\//i.test(sample)) platform = 'eDealer'
      else if (/dealer\.com|dealerdotcom/i.test(sample)) platform = 'Dealer.com'
      else if (/dealerinspire/i.test(sample)) platform = 'Dealer Inspire'
      else if (/convertus/i.test(sample)) platform = 'Convertus'
      else if (/vinsolutions|dealersocket/i.test(sample)) platform = 'DealerSocket'
      else if (/wp-|wordpress|admin-ajax/i.test(sample)) platform = 'WordPress'
      return {
        listing_count: seen.size,
        avg_price: null, min_price: null, max_price: null,
        platform,
        method: 'sitemap',
        scanned_at: new Date().toISOString()
      }
    }

    async function scrapeInventoryUrl(url) {
      let sitemapOrigin = ''
      try { sitemapOrigin = new URL(url).origin } catch {}

      try {
        const { detectFeedPlatform } = await import('../../sync/platforms.js')
        const probe = await detectFeedPlatform(url)
        if (probe.success) {
          const vehicles = probe.sample_vehicles || []
          const prices = vehicles.map(v => Number(v.price)).filter(p => p > 1000 && p < 500000)
          const sorted = [...prices].sort((a, b) => a - b)
          const avg_price = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
          return {
            listing_count: probe.vehicle_count ?? null,
            avg_price,
            min_price: sorted[0] ?? null,
            max_price: sorted[sorted.length - 1] ?? null,
            platform: probe.platform_label ?? probe.platform,
            scanned_at: new Date().toISOString()
          }
        }
      } catch {}

      if (!/autotrader\.|cargurus\./i.test(url)) {
        const sm = await sitemapCountFallback(sitemapOrigin)
        if (sm) return sm
      }

      if (/cargurus\.com/i.test(url)) {
        try {
          const sellerIdMatch = url.match(/[?&]sellerId=(\d+)/) || url.match(/\/d_(\d+)(?:[/?#]|$)/) || url.match(/d_(\d+)/)
          if (sellerIdMatch) {
            const sellerId = sellerIdMatch[1]
            const apiUrl = `https://www.cargurus.com/Cars/inventorylisting/ajaxFetchSubsetInventoryListing.action?zip=00000&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePageModel&distance=100&sortType=PRICE&sellerTypes=D&listingTypes=ALL&sellerId=${sellerId}&maxResults=100`
            const r = await browserFetch(apiUrl, {
              signal: AbortSignal.timeout(15000),
              headers: { 'Accept': 'application/json', 'Referer': 'https://www.cargurus.com/' }
            })
            if (r.ok) {
              const data = await r.json()
              const listings = data?.listings ?? data?.listingResults ?? []
              const total = data?.totalListings ?? data?.totalCount ?? listings.length
              const prices = listings.map(l => Number(l.price ?? l.listingPrice ?? 0)).filter(p => p > 1000 && p < 500000)
              if (total > 0 || prices.length > 0) {
                const sorted = [...prices].sort((a, b) => a - b)
                return {
                  listing_count: total || prices.length,
                  avg_price: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
                  min_price: sorted[0] ?? null,
                  max_price: sorted[sorted.length - 1] ?? null,
                  platform: 'CarGurus',
                  top_models: [...new Set(listings.slice(0, 20).map(l => [l.year, l.makeName, l.modelName].filter(Boolean).join(' ')).filter(Boolean))].slice(0, 5),
                  scanned_at: new Date().toISOString()
                }
              }
            }
          }
          const cgRes = await browserFetch(url, { signal: AbortSignal.timeout(15000), headers: { 'Referer': 'https://www.google.com/' } })
          if (cgRes.ok) {
            const html = await cgRes.text()
            const cgDataMatch = html.match(/window\.cargurus\s*=\s*(\{[\s\S]{0,200000}\});?\s*<\/script>/i)
              || html.match(/window\["cargurus"\]\s*=\s*(\{[\s\S]{0,200000}\});?\s*<\/script>/i)
            if (cgDataMatch) {
              try {
                const cgData = JSON.parse(cgDataMatch[1])
                const tot = cgData?.viewData?.totalListings ?? cgData?.totalListings ?? null
                const listings2 = cgData?.viewData?.listings ?? cgData?.listings ?? []
                const prices2 = listings2.map(l => Number(l.price ?? 0)).filter(p => p > 1000 && p < 500000)
                if (tot || prices2.length) {
                  const sorted = [...prices2].sort((a, b) => a - b)
                  return {
                    listing_count: tot ?? prices2.length,
                    avg_price: prices2.length ? Math.round(prices2.reduce((a, b) => a + b, 0) / prices2.length) : null,
                    min_price: sorted[0] ?? null,
                    max_price: sorted[sorted.length - 1] ?? null,
                    platform: 'CarGurus',
                    scanned_at: new Date().toISOString()
                  }
                }
              } catch {}
            }
            const countMatch = html.match(/"totalListings"\s*:\s*(\d+)/)
              || html.match(/"numListings"\s*:\s*(\d+)/)
              || html.match(/(\d{1,4})\s+(?:new\s+[&+]\s+used\s+)?(?:vehicles?|listings?|cars?)\s+for\s+sale/i)
            if (countMatch) {
              return {
                listing_count: parseInt(countMatch[1]),
                avg_price: null, min_price: null, max_price: null,
                platform: 'CarGurus',
                scanned_at: new Date().toISOString()
              }
            }
          }
        } catch (e) {
          console.error('[CarGurus scrape]', e.message)
        }
      }

      let fetchUrl = url
      if (/autotrader\.ca/i.test(url)) {
        try {
          const u = new URL(url)
          u.searchParams.set('rcp', '100')
          u.searchParams.set('rcs', '0')
          u.searchParams.set('srt', '35')
          fetchUrl = u.toString()
        } catch {}
      }

      let res
      try {
        res = await browserFetch(fetchUrl, { signal: AbortSignal.timeout(15000) })
      } catch (fetchErr) {
        const sm = await sitemapCountFallback(sitemapOrigin)
        if (sm) return sm
        throw fetchErr
      }

      if (res.status === 403 || res.status === 401 || res.status === 429) {
        let origin = ''
        try { origin = new URL(url).origin } catch {}

        if (origin) {
          const feedResult = await tryJsonFeedFallback(origin)
          if (feedResult) return feedResult
        }

        const inventoryPaths = ['/inventory/new', '/inventory', '/new-vehicles', '/used-vehicles', '/vehicles']
        for (const path of inventoryPaths) {
          try {
            const r2 = await browserFetch(origin + path, { signal: AbortSignal.timeout(12000) })
            if (!r2.ok) continue
            const html2 = await r2.text()
            const { prices: sp, listing_count: slc } = parseSchemaOrg(html2)
            if (sp.length || slc) {
              const sorted = [...sp].sort((a, b) => a - b)
              return {
                listing_count: slc ?? sp.length,
                avg_price: sp.length ? Math.round(sp.reduce((a, b) => a + b, 0) / sp.length) : null,
                min_price: sorted[0] ?? null,
                max_price: sorted[sorted.length - 1] ?? null,
                platform: 'Schema.org JSON-LD',
                scanned_at: new Date().toISOString()
              }
            }
          } catch {}
        }

        try {
          const { fetchViaBrowser } = await import('../../puppeteerRenderer.js')
          const r = await fetchViaBrowser(url, { timeoutMs: 15000 })
          if (r.ok && r.body) {
            const { prices: sp, listing_count: slc } = parseSchemaOrg(r.body)
            if (sp.length || slc) {
              const sorted = [...sp].sort((a, b) => a - b)
              return {
                listing_count: slc ?? sp.length,
                avg_price: sp.length ? Math.round(sp.reduce((a, b) => a + b, 0) / sp.length) : null,
                min_price: sorted[0] ?? null,
                max_price: sorted[sorted.length - 1] ?? null,
                platform: 'Schema.org (browser)',
                scanned_at: new Date().toISOString()
              }
            }
            const ndMatch = r.body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
            if (ndMatch) {
              try {
                const nd = JSON.parse(ndMatch[1])
                const tot = findTotal(nd)
                const raw = extractListings(nd)
                const bp = raw.map(l => Number(l?.price?.value ?? l?.price ?? 0)).filter(p => p > 1000 && p < 500_000)
                if (tot || bp.length) {
                  const sorted = [...bp].sort((a, b) => a - b)
                  return {
                    listing_count: tot ?? bp.length,
                    avg_price: bp.length ? Math.round(bp.reduce((a, b) => a + b, 0) / bp.length) : null,
                    min_price: sorted[0] ?? null,
                    max_price: sorted[sorted.length - 1] ?? null,
                    platform: 'browser render',
                    scanned_at: new Date().toISOString()
                  }
                }
              } catch {}
            }
          }
        } catch {}

        const sm = await sitemapCountFallback(origin)
        if (sm) return sm

        throw new Error(`HTTP ${res.status} — site is blocking automated scans`)
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()

      let listing_count = null
      let prices = []

      function extractListings(obj, depth = 0) {
        if (depth > 8 || !obj || typeof obj !== 'object') return []
        if (Array.isArray(obj) && obj.length > 0) {
          const s = obj[0]
          if (s && (s.price !== undefined || s.pricingDetail !== undefined || s.listPrice !== undefined)) return obj
        }
        for (const v of Object.values(obj)) {
          const found = extractListings(v, depth + 1)
          if (found.length) return found
        }
        return []
      }

      function findTotal(obj, depth = 0) {
        if (depth > 6 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null
        for (const [k, v] of Object.entries(obj)) {
          if (/^(totalCount|totalResults|totalListings|numFound|total_count|count)$/i.test(k) && typeof v === 'number' && v > 0) return v
          if (typeof v === 'object') {
            const r = findTotal(v, depth + 1)
            if (r) return r
          }
        }
        return null
      }

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (nextDataMatch) {
        try {
          const nd = JSON.parse(nextDataMatch[1])
          const total = findTotal(nd)
          if (total) listing_count = total
          const raw = extractListings(nd)
          for (const l of raw) {
            const p = Number(l?.price?.value ?? l?.price ?? l?.pricingDetail?.price ?? l?.listPrice ?? 0)
            if (p > 1000 && p < 500000) prices.push(p)
          }
        } catch {}
      }

      if (!listing_count || !prices.length) {
        const atStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.{0,80000}?\});?\s*<\/script>/s)
        if (atStateMatch) {
          try {
            const state = JSON.parse(atStateMatch[1])
            if (!listing_count) listing_count = findTotal(state)
            if (!prices.length) {
              const raw = extractListings(state)
              for (const l of raw) {
                const p = Number(l?.price?.value ?? l?.price ?? l?.pricingDetail?.price ?? l?.listPrice ?? 0)
                if (p > 1000 && p < 500000) prices.push(p)
              }
            }
          } catch {}
        }
      }

      if (!listing_count) {
        const countMatch = html.match(/"totalResults"\s*:\s*(\d+)/)
          || html.match(/"totalCount"\s*:\s*(\d+)/)
          || html.match(/"numFound"\s*:\s*(\d+)/)
          || html.match(/"total"\s*:\s*(\d+)/)
        if (countMatch) listing_count = parseInt(countMatch[1])
      }

      if (!listing_count) {
        const textMatch = html.match(/\b(\d{1,4})\s+(?:new\s+[&+]\s+used\s+)?(?:vehicles?|listings?|results?|cars?)\b/i)
        if (textMatch) listing_count = parseInt(textMatch[1])
      }

      if (!prices.length) {
        const priceMatches = [...html.matchAll(/"(?:price|sellingPrice|listPrice|salePrice)"\s*:\s*"?(\d{4,6})"?/g)]
        prices = priceMatches.map(m => parseInt(m[1])).filter(p => p > 1000 && p < 500000)
      }

      if (!listing_count && !prices.length) {
        const sm = await sitemapCountFallback(sitemapOrigin)
        if (sm) return sm
        throw new Error('no_inventory_data')
      }

      const sorted = [...prices].sort((a, b) => a - b)
      const avg_price = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
      return {
        listing_count: listing_count ?? (prices.length || null),
        avg_price,
        min_price: sorted[0] ?? null,
        max_price: sorted[sorted.length - 1] ?? null,
        scanned_at: new Date().toISOString()
      }
    }

    const compList = competitors || []
    res.json({ status: 'scanning', total: compList.length })

    const PER_SITE_MS = 40000
    const scanOne = async (comp) => {
      if (!comp.autotrader_url) {
        return { error: 'No URL configured', scanned_at: new Date().toISOString() }
      }
      if (marketcheckEnabled()) {
        try {
          const mc = await marketcheckCompetitorStats({ url: comp.autotrader_url, isUS: _compIsUS })
          recordUsage(req.dealershipId, { marketcheck: 1 })
          if (mc) return mc
        } catch {}
      }
      try {
        return await Promise.race([
          scrapeInventoryUrl(comp.autotrader_url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timed_out')), PER_SITE_MS)),
        ])
      } catch (err) {
        let msg
        if (err.message === 'timed_out') {
          msg = 'Timed out reading this site. It may be heavily bot-protected — try their CarGurus or AutoTrader dealer page URL instead.'
        } else if (err.message === 'no_inventory_data') {
          msg = 'No inventory data found at this URL. Try the dealership\'s inventory page or their AutoTrader dealer URL (autotrader.ca/dealers/…).'
        } else if (/403|401|429|blocking/i.test(err.message)) {
          msg = 'Site is blocking automated scans (WAF/bot protection). Try their CarGurus or AutoTrader dealer page URL instead.'
        } else {
          msg = `Scan failed: ${err.message}`
        }
        return { error: msg, scanned_at: new Date().toISOString() }
      }
    }

    ;(async () => {
      await Promise.allSettled(compList.map(async (comp) => {
        const scanResult = await scanOne(comp)
        await supabaseAdmin
          .from('competitor_dealerships')
          .update({ last_scan_result: scanResult, last_scanned_at: new Date().toISOString() })
          .eq('id', comp.id)
      }))
    })().catch(e => console.error('[competitor scan background]', e.message))
  })
}
