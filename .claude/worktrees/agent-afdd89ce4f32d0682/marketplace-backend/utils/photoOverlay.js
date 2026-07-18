// ─────────────────────────────────────────────────────────────────────────
// Photo overlays — stamps the dealer's phone number (and optional logo) onto
// listing photos so every shared image is branded and shows how to call.
//
// Uses sharp (already a dependency): downloads each photo, composites a
// semi-transparent bar with the phone number, and drops the logo in a corner.
// Branded copies are cached on the inventory row (branded_image_urls) so we
// only regenerate when the source photos change.
// ─────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from '../shared.js'

const MAX_PHOTOS = 12
const MAX_WIDTH = 1600

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

async function fetchBuffer(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return null
    return Buffer.from(await r.arrayBuffer())
  } catch { return null }
}

// Composite the phone bar + logo onto a single image buffer.
async function brandOne(sharp, srcBuf, { phone, logoBuf, position }) {
  let img = sharp(srcBuf, { failOn: 'none' }).rotate() // respect EXIF orientation
  const meta = await img.metadata()
  let width = meta.width || MAX_WIDTH
  if (width > MAX_WIDTH) { img = img.resize({ width: MAX_WIDTH }); width = MAX_WIDTH }
  const base = await img.jpeg({ quality: 88 }).toBuffer()
  const m2 = await sharp(base).metadata()
  const W = m2.width, H = m2.height

  const composites = []

  // Phone bar (skip if no phone configured).
  if (phone) {
    const barH = Math.round(H * 0.11)
    const fontSize = Math.round(barH * 0.5)
    const pad = Math.round(barH * 0.4)
    const y = position === 'top' ? 0 : H - barH
    const textY = y + Math.round(barH * 0.66)
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${y}" width="${W}" height="${barH}" fill="rgba(0,0,0,0.55)"/>
      <text x="${pad}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">📞 ${esc(phone)}</text>
    </svg>`
    composites.push({ input: Buffer.from(svg), top: 0, left: 0 })
  }

  // Logo in the opposite corner from the bar.
  if (logoBuf) {
    try {
      const logoH = Math.round(H * 0.12)
      const logo = await sharp(logoBuf, { failOn: 'none' })
        .resize({ height: logoH, withoutEnlargement: true })
        .png().toBuffer()
      const lm = await sharp(logo).metadata()
      const pad = Math.round(H * 0.03)
      const top = position === 'top' ? H - (lm.height || logoH) - pad : pad
      const left = W - (lm.width || logoH) - pad
      composites.push({ input: logo, top: Math.max(0, top), left: Math.max(0, left) })
    } catch { /* logo optional */ }
  }

  if (!composites.length) return base
  return sharp(base).composite(composites).jpeg({ quality: 88 }).toBuffer()
}

/**
 * Generate + cache branded photos for a vehicle. Returns the branded URLs.
 * Idempotent: if branded_image_urls already match the current photo count and
 * `force` is false, returns the cached set.
 *
 * @param {object} vehicle  inventory row (id, image_urls, branded_image_urls)
 * @param {object} dealer   dealership row (id, branding)
 * @param {object} [opts]   { force }
 */
export async function brandVehiclePhotos(vehicle, dealer, { force = false } = {}) {
  const branding = dealer?.branding || {}
  if (!branding.overlay_enabled) return null

  const srcUrls = (Array.isArray(vehicle.image_urls) ? vehicle.image_urls : []).filter(Boolean).slice(0, MAX_PHOTOS)
  if (!srcUrls.length) return null

  // Cached and still matching → reuse.
  const cached = Array.isArray(vehicle.branded_image_urls) ? vehicle.branded_image_urls : []
  if (!force && cached.length === srcUrls.length) return cached

  let sharp
  try { sharp = (await import('sharp')).default } catch { return null }

  const phone = branding.overlay_phone || branding.phone || null
  const position = branding.overlay_position === 'top' ? 'top' : 'bottom'
  const logoBuf = branding.overlay_logo === false ? null : (branding.logo_url ? await fetchBuffer(branding.logo_url) : null)

  const out = []
  for (let i = 0; i < srcUrls.length; i++) {
    const src = await fetchBuffer(srcUrls[i])
    if (!src) continue
    try {
      const branded = await brandOne(sharp, src, { phone, logoBuf, position })
      const path = `${dealer.id}/branded/${vehicle.id}/${i}.jpg`
      const { error } = await supabaseAdmin.storage.from('vehicle-pdfs')
        .upload(path, branded, { contentType: 'image/jpeg', upsert: true })
      if (error) continue
      const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-pdfs').getPublicUrl(path)
      out.push(publicUrl)
    } catch { /* skip a bad image */ }
  }
  if (!out.length) return null

  await supabaseAdmin.from('inventory')
    .update({ branded_image_urls: out, branded_at: new Date().toISOString() })
    .eq('id', vehicle.id)
  return out
}

/**
 * Batch: brand every available vehicle that has photos but no branded set yet.
 * Gated on the dealership having overlays enabled. Fire-and-forget after sync.
 */
export async function brandDealershipPhotos(dealershipId, { max = 100 } = {}) {
  if (!dealershipId) return { branded: 0 }
  try {
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('id, branding').eq('id', dealershipId).maybeSingle()
    if (!dealer?.branding?.overlay_enabled) return { branded: 0 }

    const { data: rows } = await supabaseAdmin
      .from('inventory')
      .select('id, image_urls, branded_image_urls')
      .eq('dealership_id', dealershipId)
      .eq('status', 'available')
      .is('branded_image_urls', null)
      .limit(max)

    let branded = 0
    for (const v of rows || []) {
      if (!Array.isArray(v.image_urls) || !v.image_urls.length) continue
      const urls = await brandVehiclePhotos(v, dealer)
      if (urls) branded++
    }
    if (branded) console.log(`[photo-overlay] dealership ${dealershipId}: branded ${branded} vehicles`)
    return { branded }
  } catch (e) {
    console.warn('[photo-overlay] batch failed (non-fatal):', e.message)
    return { branded: 0 }
  }
}
