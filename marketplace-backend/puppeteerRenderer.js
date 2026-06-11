// Headless browser renderer for SPA dealer sites that don't expose a static JSON feed.
// Loads the dealer URL in real Chromium, captures every XHR/fetch response, and returns
// the ones that look like inventory data. Used as the last-resort detection path after
// PLATFORM_PROBES fail.
//
// Runs on Render via @sparticuz/chromium (slim Lambda-style Chromium). Locally, falls
// back to whatever Chrome/Chromium is on the host. Cold start ~2-4s, warm ~5-15s.

import puppeteer from 'puppeteer-core'

let cachedBrowser = null
let cachedLaunchPromise = null

async function getChromiumExecutable() {
  // Render / production: use the bundled headless build
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    const chromium = (await import('@sparticuz/chromium')).default
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless
    }
  }
  // Local dev fallback — try a few common paths
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ]
  const fs = await import('fs')
  const exec = candidates.find(p => { try { fs.statSync(p); return true } catch { return false } })
  if (!exec) throw new Error('No local Chrome/Chromium found — set CHROME_PATH or run on Render')
  return {
    executablePath: exec,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  }
}

async function getBrowser() {
  if (cachedBrowser && cachedBrowser.connected !== false) return cachedBrowser
  if (cachedLaunchPromise) return cachedLaunchPromise
  cachedLaunchPromise = (async () => {
    const cfg = await getChromiumExecutable()
    const browser = await puppeteer.launch({
      executablePath: cfg.executablePath,
      args: cfg.args,
      headless: cfg.headless,
      defaultViewport: { width: 1366, height: 900 }
    })
    cachedBrowser = browser
    browser.on('disconnected', () => { cachedBrowser = null })
    return browser
  })()
  try {
    return await cachedLaunchPromise
  } finally {
    cachedLaunchPromise = null
  }
}

// Heuristics for "this XHR is the inventory list"
function looksLikeInventoryUrl(url) {
  const u = url.toLowerCase()
  return /inventory|vehicles?|stock|listings?|catalog/.test(u)
}

function extractVehicleArray(json) {
  if (!json || typeof json !== 'object') return null
  // Direct array of vehicle-shaped objects
  if (Array.isArray(json)) {
    if (json.length && (json[0]?.vin || json[0]?.VIN || json[0]?.stock_id || json[0]?.stockNumber)) {
      return json
    }
    return null
  }
  // Common wrappers: { records: [...] }, { vehicles: [...] }, { inventory: [...] }, etc.
  const candidates = [
    json.records, json.vehicles, json.Vehicles, json.inventory, json.Inventory,
    json.data, json.items, json.results, json.listings
  ]
  for (const c of candidates) {
    if (Array.isArray(c) && c.length && (c[0]?.vin || c[0]?.VIN || c[0]?.stock_id || c[0]?.stockNumber)) {
      return c
    }
  }
  return null
}

// Render a dealer URL, watch every XHR/fetch response, return any that looked like inventory.
// Returns { success, vehicles, source_url, attempts } — attempts is for diagnostics.
export async function renderAndCaptureInventory(dealerUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 45000
  const waitForXhrMs = opts.waitForXhrMs ?? 8000
  const attempts = []
  let page

  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    await page.setRequestInterception(false)

    const captured = []
    page.on('response', async (res) => {
      try {
        const url = res.url()
        const ct = res.headers()['content-type'] || ''
        if (!ct.includes('json')) return
        if (!looksLikeInventoryUrl(url)) return
        const status = res.status()
        if (status < 200 || status >= 300) return

        const text = await res.text().catch(() => null)
        if (!text || text.length < 50) return
        let parsed
        try { parsed = JSON.parse(text) } catch { return }

        const vehicles = extractVehicleArray(parsed)
        attempts.push({ url, vehicleCount: vehicles?.length || 0, status })
        if (vehicles && vehicles.length > 0) {
          captured.push({ url, vehicles })
        }
      } catch {}
    })

    await page.goto(dealerUrl, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch(() => {})

    // Give late-loading inventory XHRs a chance to complete
    await new Promise(r => setTimeout(r, waitForXhrMs))

    // Pick the response with the most vehicles (typically the main inventory list)
    captured.sort((a, b) => b.vehicles.length - a.vehicles.length)
    if (captured.length === 0) {
      return { success: false, error: 'No inventory XHR detected on page', attempts }
    }
    const best = captured[0]
    return {
      success: true,
      source_url: best.url,
      vehicles: best.vehicles,
      sample: best.vehicles.slice(0, 3),
      attempts
    }
  } catch (e) {
    return { success: false, error: e.message, attempts }
  } finally {
    if (page) { try { await page.close() } catch {} }
  }
}

// Map a raw vehicle from any platform to the canonical shape the sync engine expects.
// Field-name heuristics — covers UX Auto (sale_price/stock_id/ext_color), Dealer.com
// (modelYear/finalPrice/stockNumber), generic camelCase, and snake_case.
export function genericMapVehicle(v) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (v[k] != null && v[k] !== '') return v[k]
    }
    return null
  }
  const s3Key = pick('s3_key', 's3Key')
  const imageUrl = pick('image_url', 'imageUrl', 'photo', 'photoUrl')
  return {
    vin: pick('vin', 'VIN', 'Vin'),
    year: pick('year', 'Year', 'modelYear', 'vehicleModelDate'),
    make: pick('make', 'Make', 'manufacturer'),
    model: pick('model', 'Model'),
    trim: pick('trim', 'Trim', 'trimLevel'),
    price: pick('sale_price', 'salePrice', 'price', 'Price', 'finalPrice', 'sellingPrice', 'list_price', 'listPrice', 'retail_price'),
    mileage: pick('mileage', 'Mileage', 'odometer'),
    condition: pick('condition', 'Condition', 'type', 'newOrUsed'),
    stocknumber: pick('stock_id', 'stockNumber', 'StockNumber', 'stock_number', 'stock', 'sku'),
    exteriorcolor: pick('ext_color', 'exteriorColor', 'exterior_color', 'ExteriorColor', 'ExteriorColour', 'color'),
    interiorcolor: pick('int_color', 'interiorColor', 'interior_color', 'vehicleInteriorColor'),
    bodystyle: pick('body_type', 'bodyType', 'body_style', 'bodyStyle'),
    fueltype: pick('fuel_type', 'fuelType'),
    transmission: pick('transmission', 'vehicleTransmission'),
    drivetrain: pick('drivetrain', 'driveTrain', 'drive_train'),
    onweb: v.active !== 'n' && v.active !== false,
    salepending: false,
    image_urls: s3Key
      ? [`https://d3ls4jww1dnhu4.cloudfront.net/${s3Key}`]
      : imageUrl ? [imageUrl]
      : (Array.isArray(v.images) ? v.images : [])
  }
}
