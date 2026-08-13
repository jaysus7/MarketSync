// ─────────────────────────────────────────────────────────────────────────────
// MarketSync CRM — VIN Sticker Submodule: PDF Renderer & HTML Template Builder
// ─────────────────────────────────────────────────────────────────────────────
import { fontFaceCss } from '../../utils/brochureFonts.js'
import { withHeadlessGuard } from '../../puppeteerRenderer.js'

const EXTRA_CHROMIUM_ARGS = [
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-extensions',
  '--single-process',
]

export function buildFeatureList(vehicle) {
  const features = []
  if (vehicle.drivetrain) features.push(`${vehicle.drivetrain} Drivetrain`)
  if (vehicle.transmission) features.push(`${vehicle.transmission} Transmission`)
  if (vehicle.fuel_type || vehicle.fueltype) features.push(`${vehicle.fuel_type || vehicle.fueltype} Engine`)
  if (vehicle.exterior_color) features.push(`${vehicle.exterior_color} Exterior`)
  if (vehicle.interior_color) features.push(`${vehicle.interior_color} Interior`)
  if (vehicle.body_style || vehicle.bodystyle) features.push(`${vehicle.body_style || vehicle.bodystyle} Body`)
  if (vehicle.engine) features.push(vehicle.engine)

  const featureKeywords = [
    'heated seats', 'heated steering', 'sunroof', 'moonroof', 'panoramic',
    'navigation', 'backup camera', 'blind spot', 'lane departure', 'adaptive cruise',
    'apple carplay', 'android auto', 'bluetooth', 'remote start', 'keyless entry',
    'leather', 'alloy wheels', 'third row', 'tow package', 'lift kit',
    'power liftgate', 'wireless charging', 'bose', 'harman', '360 camera',
  ]
  if (vehicle.description) {
    const desc = vehicle.description.toLowerCase()
    for (const kw of featureKeywords) {
      if (desc.includes(kw) && !features.some(f => f.toLowerCase().includes(kw))) {
        features.push(kw.replace(/\b\w/g, c => c.toUpperCase()))
      }
    }
  }

  return features.length ? features : ['See dealer for full equipment list']
}

export async function imgToDataUri(url, { maxWidth = 800, quality = 72 } = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    try {
      const sharp = (await import('sharp')).default
      const webp = await sharp(buf)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer()
      return `data:image/webp;base64,${webp.toString('base64')}`
    } catch {
      const mime = res.headers.get('content-type') || 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch { return null }
}

async function _generatePdfImpl(html, { landscape = false, viewportWidth = 860, viewportHeight = 1100, timeoutMs = 90000 } = {}) {
  const puppeteer = (await import('puppeteer-core')).default
  let browser, page
  try {
    const isRender = process.env.NODE_ENV === 'production' || process.env.RENDER
    let launchOpts
    if (isRender) {
      const chromium = (await import('@sparticuz/chromium')).default
      launchOpts = {
        executablePath: await chromium.executablePath(),
        args: [...new Set([...chromium.args, ...EXTRA_CHROMIUM_ARGS])],
        headless: chromium.headless,
      }
    } else {
      const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ]
      const fs = await import('fs')
      const exe = candidates.find(c => fs.existsSync(c)) || 'google-chrome'
      launchOpts = { executablePath: exe, args: ['--no-sandbox'], headless: true }
    }
    browser = await puppeteer.launch(launchOpts)
    page = await browser.newPage()
    await page.setViewport({ width: viewportWidth, height: viewportHeight })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: timeoutMs })
    const pdfBuf = await page.pdf({
      format: 'Letter',
      landscape,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    })
    return Buffer.from(pdfBuf)
  } finally {
    if (page) await page.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }
}

export async function generatePdf(html, opts = {}) {
  const impl = () => _generatePdfImpl(html, opts)
  return withHeadlessGuard(impl, { label: 'pdf-render', onSkip: impl })
}
