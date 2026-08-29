import { supabaseAdmin, browserFetch } from '../shared.js'
import { randomBytes } from 'crypto'
import { emitEvent } from './events.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { createNotifications } from '../notifications.js'
import { runInventorySync, syncProgress } from '../sync/engine.js'
import { audit, AuditAction, exportReason } from '../audit.js'
import { requirePermission } from '../authorization.js'
import multer from 'multer'
import sharp from 'sharp'

// Vehicle-photo uploads: in-memory, 12MB/file, up to 30 at once.
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 30 } })

// ── CSV helpers (dependency-free, RFC-4180-ish) ──────────────────────────────
const CSV_COLS = ['vin', 'year', 'make', 'model', 'trim', 'price', 'mileage', 'condition', 'stocknumber', 'exterior_color', 'interior_color', 'transmission', 'fuel_type', 'drivetrain', 'engine', 'body_style', 'doors', 'status', 'description', 'image_urls']
function csvCell(v) { if (v == null) return ''; let s = Array.isArray(v) ? v.join(' | ') : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
function toCsv(rows) {
  const body = rows.map(r => CSV_COLS.map(c => csvCell(c === 'image_urls' ? (Array.isArray(r.image_urls) ? r.image_urls : []) : r[c])).join(',')).join('\n')
  return CSV_COLS.join(',') + '\n' + body + '\n'
}
function parseCsv(text) {
  const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []; let field = '', row = [], inq = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else inq = false } else field += ch; continue }
    if (ch === '"') inq = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = [] }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length && r.some(c => String(c).trim() !== ''))
}

// Compress to WebP for the web — auto-orient from EXIF (phone photos), cap at
// 1920px, quality 82 (visually lossless, ~70-80% smaller than the original JPG).
export async function toWebp(buffer, { max = 1920, quality = 82 } = {}) {
  return sharp(buffer).rotate()
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality }).toBuffer()
}

// AI background swap: cut the vehicle out and drop it on the dealer's branded
// background in one call (remove.bg). Returns a composited buffer, or null if the
// feature isn't configured / the call fails (caller then keeps the original).
async function compositeOnBackground(buffer, bgUrl) {
  const key = process.env.REMOVEBG_API_KEY
  if (!key || !bgUrl) return null
  try {
    const form = new FormData()
    form.append('image_file', new Blob([buffer]), 'vehicle.jpg')
    form.append('bg_image_url', bgUrl)
    form.append('size', 'auto')
    const r = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': key }, body: form, signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) { console.warn('[removebg] HTTP', r.status, (await r.text().catch(() => '')).slice(0, 200)); return null }
    return Buffer.from(await r.arrayBuffer())
  } catch (e) { console.warn('[removebg] failed:', e.message); return null }
}
const numOrNull = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null }
// Dealer-entered specs the VIN decode can't provide (towing, HP, torque, etc.).
// Stored as free-text so the dealer can write units ("9,300 lb", "310 hp @ 5,600 rpm").
const MANUAL_SPEC_KEYS = ['towing_capacity', 'horsepower', 'torque', 'curb_weight', 'payload', 'seating', 'fuel_economy', 'cargo']
function cleanSpecs(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out = {}
  for (const k of MANUAL_SPEC_KEYS) { const s = v[k] == null ? '' : String(v[k]).trim().slice(0, 120); if (s) out[k] = s }
  return Object.keys(out).length ? out : null
}
// Pull the storage object path back out of a public vehicle-photos URL (for deletes).
function photoStoragePath(url) {
  const m = String(url || '').match(/\/vehicle-photos\/(.+)$/)
  return m ? decodeURIComponent(m[1].split('?')[0]) : null
}

// Pull the Carfax report link the dealer already embeds on a listing page (their
// paid Carfax badge). Returns the best-matching absolute carfax URL, or null.
function extractCarfaxLink(html, vin) {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1].replace(/&amp;/g, '&'))
  const carfax = hrefs.filter(u =>
    /carfax/i.test(u) && /^https?:\/\//i.test(u) && !/\.(png|jpe?g|svg|gif|css|js)(\?|#|$)/i.test(u))
  if (!carfax.length) return null
  const vinU = (vin || '').toUpperCase()
  const score = u => (vinU && u.toUpperCase().includes(vinU) ? 10 : 0) + (/vhr|report|vehicle-history/i.test(u) ? 3 : 0)
  return carfax.sort((a, b) => score(b) - score(a))[0]
}

// When a unit's price changes and it's live on Facebook Marketplace, flag the rep
// who posted it — Marketplace listings don't auto-update, so they must edit it.
async function notifyMarketplacePriceChange(dealershipId, vehicle, priorPrice) {
  const { data: listings } = await supabaseAdmin.from('listings')
    .select('posted_by').eq('inventory_id', vehicle.id).eq('status', 'posted').is('deleted_at', null)
  const reps = [...new Set((listings || []).map(l => l.posted_by).filter(Boolean))]
  if (!reps.length) return
  const label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ') || 'A vehicle'
  const money = (n) => (n != null && n !== '') ? '$' + Number(n).toLocaleString('en-US') : '—'
  const dir = (Number(vehicle.price) < Number(priorPrice)) ? 'dropped' : 'changed'
  const rows = reps.map(uid => ({
    dealership_id: dealershipId, type: 'price_drift',
    title: `Price ${dir} — update your Marketplace post`,
    body: `${label} is now ${money(vehicle.price)} (was ${money(priorPrice)}). Update your Facebook Marketplace listing so it matches.`,
    link_page: 'inventory', link_filter: vehicle.stocknumber || null, target_user_id: uid, read: false,
  }))
  await createNotifications(rows)
}

export function registerRoutes(app) {
  // ── Manual inventory: dealers load their own units (source of truth) ────────
  // Managed units are marked source='manual' so the nightly FEED archiver never
  // touches them. This is the "we host your inventory" path — photos + all.

  // Create a vehicle
  app.post('/inventory', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const make = String(b.make || '').trim(), model = String(b.model || '').trim()
    if (!make || !model) return res.status(400).json({ error: 'Make and model are required' })
    const mileage = numOrNull(b.mileage)
    const row = {
      dealership_id: req.dealershipId, source: 'manual', status: 'available',
      vin: b.vin ? String(b.vin).trim().toUpperCase().slice(0, 17) : null,
      year: parseInt(b.year) || null, make, model, trim: (b.trim || '').trim() || null,
      price: numOrNull(b.price), invoice_amount: numOrNull(b.invoice_amount),
      mileage: mileage != null ? Math.round(mileage) : null,
      condition: b.condition || 'used', stocknumber: (b.stocknumber || '').trim() || null,
      exterior_color: b.exterior_color || null, interior_color: b.interior_color || null,
      transmission: b.transmission || null, fuel_type: b.fuel_type || null,
      drivetrain: b.drivetrain || null, engine: b.engine || null, body_style: b.body_style || null,
      doors: numOrNull(b.doors), description: b.description || null,
      sales_pitch: (b.sales_pitch || '').trim() || null,
      specs_manual: cleanSpecs(b.specs_manual),
      // Enriched VIN decode (safety systems, plant, etc.) + recall check, when the
      // Add-vehicle form decoded a VIN — carries into stickers, pitches & recall badges.
      vin_data: (b.vin_data && typeof b.vin_data === 'object') ? b.vin_data : null,
      recalls: Array.isArray(b.recalls) ? b.recalls : null,
      recalls_checked_at: Array.isArray(b.recalls) ? new Date().toISOString() : null,
      image_urls: Array.isArray(b.image_urls) ? b.image_urls : [],
      lot_date: new Date().toISOString(),
    }
    const { data, error } = await req.supabase.from('inventory').insert(row).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, vehicle: data })
  })

  // Edit a vehicle (any owned unit — manual or synced)
  app.put('/inventory/:id', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const patch = {}
    for (const f of ['make', 'model', 'trim', 'condition', 'stocknumber', 'exterior_color', 'interior_color', 'transmission', 'fuel_type', 'drivetrain', 'engine', 'body_style', 'description', 'sales_pitch']) {
      if (b[f] !== undefined) patch[f] = b[f] === '' ? null : b[f]
    }
    if (b.vin !== undefined) patch.vin = b.vin ? String(b.vin).trim().toUpperCase().slice(0, 17) : null
    if (b.year !== undefined) patch.year = parseInt(b.year) || null
    if (b.price !== undefined) patch.price = numOrNull(b.price)
    if (b.invoice_amount !== undefined) patch.invoice_amount = numOrNull(b.invoice_amount)
    if (b.mileage !== undefined) { const m = numOrNull(b.mileage); patch.mileage = m != null ? Math.round(m) : null }
    if (b.doors !== undefined) patch.doors = numOrNull(b.doors)
    if (b.vin_data !== undefined) patch.vin_data = (b.vin_data && typeof b.vin_data === 'object') ? b.vin_data : null
    if (Array.isArray(b.recalls)) { patch.recalls = b.recalls; patch.recalls_checked_at = new Date().toISOString() }
    if (b.specs_manual !== undefined) patch.specs_manual = cleanSpecs(b.specs_manual)
    if (Array.isArray(b.image_urls)) patch.image_urls = b.image_urls
    if (b.status !== undefined && ['available', 'sold', 'pending'].includes(b.status)) {
      patch.status = b.status
      if (b.status === 'available') patch.archived_at = null
    }
    // Grab the prior price + sold state first: price drives the Marketplace flag,
    // and we stamp sold_at only on a real transition into 'sold' (so re-editing a
    // sold unit doesn't reset its days-to-sell).
    let priorPrice = null
    let beforeState = null
    if (b.price !== undefined || b.status !== undefined) {
      const { data: cur } = await req.supabase.from('inventory')
        .select('id, price, status, sold_at, archived_at').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      priorPrice = cur ? cur.price : null
      beforeState = cur
      if (b.status === 'sold' && cur && cur.status !== 'sold' && !cur.sold_at) patch.sold_at = new Date().toISOString()
      if (b.status === 'available') patch.sold_at = null   // relisted → clear
    }
    const { data, error } = await req.supabase.from('inventory')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('*').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Vehicle not found' })
    if (b.price !== undefined && Number(priorPrice) !== Number(data.price)) {
      notifyMarketplacePriceChange(req.dealershipId, data, priorPrice).catch(() => {})
    }
    audit(req, 'inventory.updated', {
      inventory_id: data.id,
      before_state: beforeState,
      after_state: { id: data.id, price: data.price, status: data.status, sold_at: data.sold_at, archived_at: data.archived_at },
    })
    res.json({ ok: true, vehicle: data })
  })

  // Archive a vehicle instead of permanently deleting it. The record, photos,
  // costs, and audit trail remain available for compliance and reconciliation.
  app.delete('/inventory/:id', requireAuth, requirePermission('inventory.delete'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: v } = await req.supabase.from('inventory')
      .select('id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('archived_at', null).maybeSingle()
    if (!v) return res.status(404).json({ error: 'Vehicle not found' })
    const { error } = await req.supabase.from('inventory').update({ archived_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('archived_at', null)
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'inventory.archived', {
      inventory_id: v.id,
      before_state: { id: v.id, archived_at: null },
      after_state: { id: v.id, archived_at: true },
    })
    res.json({ ok: true, archived: true })
  })

  // Upload photos (multipart) → Supabase Storage → append to image_urls
  app.post('/inventory/:id/photos', requireAuth, requirePermission('inventory.edit'), photoUpload.array('photos', 30), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: v } = await req.supabase.from('inventory')
      .select('id, image_urls').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!v) return res.status(404).json({ error: 'Vehicle not found' })
    const files = req.files || []
    if (!files.length) return res.status(400).json({ error: 'No photos uploaded' })

    // Optionally composite every photo onto the dealership's branded background.
    const applyBg = String(req.body?.background || '') === '1' || req.body?.background === true
    let bgUrl = null
    if (applyBg) {
      const { data: d } = await supabaseAdmin.from('dealerships').select('photo_background_url').eq('id', req.dealershipId).maybeSingle()
      bgUrl = d?.photo_background_url || null
    }

    const urls = [...(v.image_urls || [])]
    for (const f of files) {
      let buf = f.buffer
      if (applyBg && bgUrl) {
        const composited = await compositeOnBackground(buf, bgUrl)
        if (composited) buf = composited
      }
      let webp
      try { webp = await toWebp(buf) } catch (e) { console.warn('[inv-photo] webp encode failed:', e.message); webp = f.buffer }
      const path = `${req.dealershipId}/${req.params.id}/${Date.now()}-${randomBytes(6).toString("hex")}.webp`
      const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos')
        .upload(path, webp, { contentType: 'image/webp', upsert: false })
      if (upErr) { console.warn('[inv-photo] upload failed:', upErr.message); continue }
      const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
      urls.push(publicUrl)
    }
    const { data, error } = await req.supabase.from('inventory')
      .update({ image_urls: urls }).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('image_urls').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, image_urls: data.image_urls })
  })

  // Set the full photo order / removal (client sends the desired image_urls array).
  // Any uploaded photo dropped from the list is also deleted from storage.
  app.put('/inventory/:id/photos', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const nextUrls = Array.isArray(req.body?.image_urls) ? req.body.image_urls : null
    if (!nextUrls) return res.status(400).json({ error: 'image_urls array required' })
    const { data: v } = await req.supabase.from('inventory')
      .select('id, image_urls').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!v) return res.status(404).json({ error: 'Vehicle not found' })
    const removed = (v.image_urls || []).filter(u => !nextUrls.includes(u))
    try {
      const paths = removed.map(photoStoragePath).filter(Boolean)
      if (paths.length) await supabaseAdmin.storage.from('vehicle-photos').remove(paths)
    } catch (e) { console.warn('[inv] photo remove failed:', e.message) }
    const { data, error } = await req.supabase.from('inventory')
      .update({ image_urls: nextUrls }).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('image_urls').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, image_urls: data.image_urls })
  })

  // ── Dealership branded photo background (for AI background swap) ────────────
  app.post('/dealership/photo-background', requireAuth, requireMfa, requirePermission('site.manage'), photoUpload.single('background'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })
    let webp
    try { webp = await toWebp(req.file.buffer, { max: 2000, quality: 88 }) } catch (e) { return res.status(500).json({ error: 'Could not process image: ' + e.message }) }
    const path = `${req.dealershipId}/_background/bg-${Date.now()}.webp`
    const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, webp, { contentType: 'image/webp', upsert: false })
    if (upErr) return res.status(500).json({ error: upErr.message })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
    await supabaseAdmin.from('dealerships').update({ photo_background_url: publicUrl }).eq('id', req.dealershipId)
    res.json({ ok: true, url: publicUrl, provider_ready: !!process.env.REMOVEBG_API_KEY })
  })
  app.delete('/dealership/photo-background', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    await supabaseAdmin.from('dealerships').update({ photo_background_url: null }).eq('id', req.dealershipId)
    res.json({ ok: true })
  })

  // Generic site image upload (hero, page images) — separate from the avatar used
  // for gamification. Returns a public WebP URL the site manager can drop anywhere.
  app.post('/dealership/site-image', requireAuth, requireMfa, requirePermission('site.manage'), photoUpload.single('image'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })
    let webp
    try { webp = await toWebp(req.file.buffer, { max: 2200, quality: 85 }) } catch (e) { return res.status(500).json({ error: 'Could not process image: ' + e.message }) }
    const path = `${req.dealershipId}/_site/img-${Date.now()}-${randomBytes(6).toString("hex")}.webp`
    const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, webp, { contentType: 'image/webp', upsert: false })
    if (upErr) return res.status(500).json({ error: upErr.message })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
    // Keep an indexed library record alongside the storage object so the builder
    // can reuse uploaded media without asking dealers to paste URLs around.
    const metadata = await sharp(webp).metadata().catch(() => ({}))
    await supabaseAdmin.from('dealer_website_media').insert({
      dealership_id: req.dealershipId,
      filename: req.file.originalname || `site-image-${Date.now()}.webp`,
      storage_path: path,
      public_url: publicUrl,
      mime_type: 'image/webp',
      file_size_bytes: webp.length,
      width: metadata.width || null,
      height: metadata.height || null,
      created_by: req.user?.id || null,
    }).catch(() => {})
    res.json({ ok: true, url: publicUrl })
  })

  // Private dealership-scoped media index used by the Website Builder library.
  // The underlying bucket object remains governed by Supabase storage policies;
  // these endpoints never expose another dealership's rows.
  app.get('/dealership/site-media', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('dealer_website_media').select('*')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ media: data || [] })
  })
  app.delete('/dealership/site-media/:id', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: media, error: readError } = await supabaseAdmin.from('dealer_website_media').select('id, storage_path')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (readError) return res.status(500).json({ error: readError.message })
    if (!media) return res.status(404).json({ error: 'Media not found' })
    const { error: storageError } = await supabaseAdmin.storage.from('vehicle-photos').remove([media.storage_path])
    if (storageError) return res.status(500).json({ error: storageError.message })
    const { error } = await supabaseAdmin.from('dealer_website_media').delete().eq('id', media.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
  app.patch('/dealership/site-media/:id', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const altText = String(req.body?.alt_text || '').trim().slice(0, 180)
    const { data, error } = await supabaseAdmin.from('dealer_website_media').update({ alt_text: altText || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('id, alt_text, updated_at').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Media not found' })
    res.json({ media: data })
  })

  // Reusable Website Builder sections use the same structured document model
  // as page sections; no arbitrary HTML is stored as a component.
  app.get('/dealership/site-components', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('dealer_website_components').select('id, name, description, section, created_by, created_at, updated_at').eq('dealership_id', req.dealershipId).order('updated_at', { ascending: false }).limit(100)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ components: data || [] })
  })
  app.post('/dealership/site-components', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const name = String(req.body?.name || '').trim().slice(0, 100)
    const section = req.body?.section && typeof req.body.section === 'object' ? req.body.section : null
    if (!name || !section || Array.isArray(section)) return res.status(400).json({ error: 'A component name and structured section are required' })
    const { data, error } = await supabaseAdmin.from('dealer_website_components').insert({ dealership_id: req.dealershipId, name, description: String(req.body?.description || '').trim().slice(0, 300), section, created_by: req.user?.id }).select('id, name, description, section, created_at, updated_at').single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'A component with that name already exists.' : error.message })
    res.status(201).json({ component: data })
  })
  app.patch('/dealership/site-components/:id', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const patch = { updated_at: new Date().toISOString() }
    if (req.body?.name !== undefined) patch.name = String(req.body.name || '').trim().slice(0, 100)
    if (req.body?.description !== undefined) patch.description = String(req.body.description || '').trim().slice(0, 300)
    if (req.body?.section && typeof req.body.section === 'object' && !Array.isArray(req.body.section)) patch.section = req.body.section
    const { data, error } = await supabaseAdmin.from('dealer_website_components').update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select('id, name, description, section, created_at, updated_at').maybeSingle()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'A component with that name already exists.' : error.message })
    if (!data) return res.status(404).json({ error: 'Component not found' })
    res.json({ component: data })
  })
  app.delete('/dealership/site-components/:id', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { error } = await supabaseAdmin.from('dealer_website_components').delete().eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // GET /inventory/:id/carfax — resolve the Carfax report link for a vehicle by
  // scraping the badge off its source listing page (cached after first hit).
  app.get('/inventory/:id/carfax', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    const { data: v } = await req.supabase.from('inventory')
      .select('id, vin, source_url, carfax_url')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!v) return res.status(404).json({ error: 'Not found' })
    if (v.carfax_url) return res.json({ url: v.carfax_url, source: 'cached' })

    let found = null
    if (v.source_url) {
      try {
        const r = await browserFetch(v.source_url)
        if (r.ok) found = extractCarfaxLink(await r.text(), v.vin)
      } catch { /* fall through to fallback */ }
    }
    if (found) {
      // Cache-write side effect of a view-gated read: this route only requires
      // inventory.view, so use supabaseAdmin (RLS UPDATE would demand inventory.edit).
      await supabaseAdmin.from('inventory').update({ carfax_url: found }).eq('id', v.id)
      return res.json({ url: found, source: 'website' })
    }
    // No badge found on the page — fall back to a Carfax Canada VIN search.
    const fallback = v.vin
      ? `https://www.carfax.ca/vehicle-history-reports?vin=${encodeURIComponent(v.vin)}`
      : 'https://www.carfax.ca/'
    res.json({ url: fallback, source: 'fallback' })
  })

  // ── 6. INVENTORY ──
  app.get('/inventory', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    const { data, error } = await req.supabase
      .from('inventory')
      .select('*')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.get('/inventory/all', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    // Show the live lot, plus recently-sold units for 2 weeks (as "sold"), then hide
    // them. Older archived history stays in the DB for analytics until the 1-year purge.
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data, error } = await req.supabase
      .from('inventory')
      .select('id, vin, year, make, model, trim, price, invoice_amount, mileage, condition, exterior_color, interior_color, body_style, fuel_type, drivetrain, transmission, engine, doors, status, archived_at, image_urls, source_url, source, description, stocknumber, created_at, last_synced_at, window_sticker_url, window_sticker_oem_url, window_sticker_gen_url, brochure_url, brochure_oem_url, brochure_gen_url, recalls, recalls_checked_at, vin_data, sales_pitch, sales_pitch_at, specs_manual, awaiting_possession, source_appraisal_id')
      .eq('dealership_id', req.dealershipId)
      // Live units (archived_at IS NULL) OR anything archived within the last 2 weeks.
      .or(`archived_at.is.null,archived_at.gte.${cutoff}`)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    const rows = (data || []).filter(v => {
      // Feed-flagged sold units (archived_at null, status 'sold') only linger 2 weeks too,
      // measured from their last feed appearance.
      if (v.status === 'sold' && !v.archived_at) return v.last_synced_at >= cutoff
      return true
    }).map(v => (v.status === 'archived' ? { ...v, status: 'sold' } : v))  // show archived as Sold
    res.json(rows)
  })

  // ── CSV import / export ─────────────────────────────────────────────────────
  // Registered BEFORE /inventory/:id so "export.csv" isn't swallowed as an :id.
  app.get('/inventory/export.csv', requireAuth, requireMfa, requirePermission('customer.export'), async (req, res) => {
    const { data } = await req.supabase.from('inventory')
      .select(CSV_COLS.filter(c => c !== 'image_urls').join(', ') + ', image_urls')
      .eq('dealership_id', req.dealershipId).is('archived_at', null).order('created_at', { ascending: false })
    audit(req, AuditAction.INVENTORY_EXPORTED, { count: (data || []).length, reason: exportReason(req) })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(toCsv(data || []))
  })

  app.post('/inventory/import', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    const csv = req.body && req.body.csv
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'Provide CSV text as { csv }' })
    const rows = parseCsv(csv)
    if (rows.length < 2) return res.status(400).json({ error: 'No data rows found (need a header row + at least one vehicle).' })
    const header = rows[0].map(h => h.trim().toLowerCase())
    const idx = Object.fromEntries(CSV_COLS.map(c => [c, header.indexOf(c)]))
    if (idx.make < 0 || idx.model < 0) return res.status(400).json({ error: 'CSV needs at least "make" and "model" columns. Export a file first to see the format.' })
    // Include archived rows so a vehicle returning on a later old-site pull is
    // restored into the same canonical record instead of creating a duplicate.
    const { data: existing } = await req.supabase.from('inventory').select('id, vin, stocknumber, archived_at').eq('dealership_id', req.dealershipId)
    const byVin = {}, byStock = {}
    for (const e of (existing || [])) { if (e.vin) byVin[e.vin.toUpperCase()] = e.id; if (e.stocknumber) byStock[String(e.stocknumber).toLowerCase()] = e.id }
    let created = 0, updated = 0, skipped = 0; const errors = []
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r]; const get = c => idx[c] >= 0 ? String(cells[idx[c]] || '').trim() : ''
      const make = get('make'), model = get('model')
      if (!make || !model) { skipped++; continue }
      const vin = (get('vin').toUpperCase().slice(0, 17)) || null
      const mi = numOrNull(get('mileage'))
      const patch = {
        source: 'dealer_import',
        make, model, vin, year: parseInt(get('year')) || null, trim: get('trim') || null,
        price: numOrNull(get('price')), mileage: mi != null ? Math.round(mi) : null,
        condition: get('condition') || 'used', stocknumber: get('stocknumber') || null,
        exterior_color: get('exterior_color') || null, interior_color: get('interior_color') || null,
        transmission: get('transmission') || null, fuel_type: get('fuel_type') || null, drivetrain: get('drivetrain') || null,
        engine: get('engine') || null, body_style: get('body_style') || null, doors: numOrNull(get('doors')),
        status: get('status') || 'available', description: get('description') || null,
        archived_at: null, last_synced_at: new Date().toISOString(),
      }
      const imgs = get('image_urls'); if (imgs) patch.image_urls = imgs.split('|').map(x => x.trim()).filter(Boolean)
      const matchId = (vin && byVin[vin]) || (patch.stocknumber && byStock[patch.stocknumber.toLowerCase()]) || null
      try {
        if (matchId) {
          const { error: updateError } = await req.supabase.from('inventory').update(patch).eq('id', matchId).eq('dealership_id', req.dealershipId)
          if (updateError) throw updateError
          updated++
        }
        else {
          const { data: ins } = await req.supabase.from('inventory').insert({ dealership_id: req.dealershipId, source: 'import', lot_date: new Date().toISOString(), image_urls: [], ...patch }).select('id').single()
          created++
          if (ins) { if (vin) byVin[vin] = ins.id; if (patch.stocknumber) byStock[patch.stocknumber.toLowerCase()] = ins.id }   // dedupe within the same file
        }
      } catch (e) { errors.push(`Row ${r + 1}: ${e.message}`) }
    }
    res.json({ ok: true, created, updated, skipped, errors: errors.slice(0, 20) })
  })

  // ── Canonical NON-TRADE acquisition receipt ────────────────────────────────
  // The business moment a purchased vehicle (auction, wholesale, dealer purchase,
  // dealer trade, manually entered purchase) becomes dealership-controlled. Mirrors
  // the trade path exactly, using the SAME generic possession fields already on
  // inventory — no new table, no second possession model, no lifecycle enum.
  //
  // TRADE EXCLUSION is enforced in the WHERE clause, not the UI: a unit created from
  // a trade appraisal carries `source_appraisal_id`, and its canonical lifecycle is
  // `trade.received` via POST /ai/appraisals/:id/take-possession. Filtering on
  // `source_appraisal_id IS NULL` makes it impossible for one vehicle to emit both
  // acquisition events, even if a client calls the wrong endpoint.
  app.post('/inventory/:id/take-possession', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      const { data: veh } = await supabaseAdmin.from('inventory')
        .select('id, awaiting_possession, possession_at, source_appraisal_id, invoice_amount')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!veh) return res.status(404).json({ error: 'Vehicle not found' })
      if (veh.source_appraisal_id) {
        return res.status(409).json({
          error: 'TRADE_UNIT',
          message: 'This unit came from a trade appraisal — take possession through the appraisal so it records a trade receipt.',
        })
      }
      // Already possessed → idempotent no-op. Ownership timestamps are not touched
      // and no event is emitted.
      if (veh.awaiting_possession === false) {
        return res.json({ ok: true, inventory_id: veh.id, already: true, possession_at: veh.possession_at || null, acquired: false })
      }
      const at = new Date().toISOString()
      // Guarded update + select-back: only rows that ACTUALLY flipped come back, so a
      // concurrent double-call transitions once and emits once.
      const { data: flipped, error } = await supabaseAdmin.from('inventory')
        .update({ awaiting_possession: false, possession_at: at })
        .eq('id', veh.id).eq('dealership_id', req.dealershipId).eq('awaiting_possession', true)
        .is('source_appraisal_id', null)
        .select('id, invoice_amount')
      if (error) return res.status(500).json({ error: error.message })
      if (!flipped || !flipped.length) {
        return res.json({ ok: true, inventory_id: veh.id, already: true, acquired: false })
      }
      audit(req, 'inventory.possession_taken', { inventory_id: veh.id, non_trade: true })
      // Accounting owns the journal, the GL account and the dedupe — this route only
      // reports the business event. entityId is the vehicle, which IS the accounting
      // reference for `vehicle.acquired` (source 'acquisition').
      emitEvent({
        dealershipId: req.dealershipId, eventName: 'vehicle.acquired', entityType: 'vehicle', entityId: veh.id,
        summary: 'Vehicle acquired into inventory', department: 'inventory',
        payload: { inventory_id: veh.id, amount: Number(flipped[0]?.invoice_amount ?? 0), ref: veh.id },
        createdBy: req.user?.id || null,
      })
      res.json({ ok: true, inventory_id: veh.id, possession_at: at, acquired: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/inventory/:id', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    const { data, error } = await req.supabase
      .from('inventory')
      .select('*')
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (error) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  })

  // Lightweight progress poll for the dashboard Sync button. Returns the live
  // percentage/phase of an in-flight sync for the caller's dealership, or idle.
  app.get('/inventory/sync/progress', requireAuth, requirePermission('inventory.view'), (req, res) => {
    if (!req.dealershipId) return res.json({ phase: 'idle', pct: 0 })
    res.json(syncProgress.get(req.dealershipId) || { phase: 'idle', pct: 0 })
  })

  app.post('/inventory/sync', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    const isDemo = req.user?.email === 'sales@marketsync.link' || req.dealershipId === 'demo-dealership'
    if (isDemo) {
      return res.json({
        success: true,
        unique_vehicles: 84,
        available_after_sync: 84,
        duplicates_merged: 0,
        skipped: 0
      })
    }
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated with this account' })
    try {
      const result = await runInventorySync(req.dealershipId)
      if (!result.success) return res.status(400).json(result)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── 11. DIAGNOSTICS ──
  app.get('/debug', requireAuth, async (req, res) => {
    res.json({ user_id: req.user.id, profile: req.profile, dealership_id: req.dealershipId })
  })
}
