/**
 * MarketSync Design Studio Backend Engine
 *
 * Implements:
 *   1. Design CRUD: `GET /marketing/studio/designs`, `POST /marketing/studio/designs`, `PUT /marketing/studio/designs/:id`, `DELETE /marketing/studio/designs/:id`
 *   2. Template CRUD & Stock Automotive Templates: `GET /marketing/studio/templates`
 *   3. Free Asset Library Proxy & Import: `GET /marketing/studio/library/search`, `POST /marketing/studio/library/import`
 *   4. Server Scene Renderer: `POST /marketing/studio/render` (renders full MarketSync scene JSON to WebP in marketing_assets)
 */

import { supabaseAdmin } from '../shared.js'
import { safeOutboundFetch } from '../outbound-http-policy.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission, hasPermission } from '../authorization.js'
import { getCurrentAccessContext, hasFeature } from '../access.js'
import { audit } from '../audit.js'
import { toWebp } from './inventory.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const FALLBACK_FILE = path.resolve('data/studio_designs_fallback.json')

function loadFallbackDesigns() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const raw = fs.readFileSync(FALLBACK_FILE, 'utf8')
      return JSON.parse(raw) || []
    }
  } catch (e) {
    console.error('Error reading studio designs fallback file:', e)
  }
  return []
}

function saveFallbackDesigns(designs) {
  try {
    const dir = path.dirname(FALLBACK_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(designs, null, 2), 'utf8')
  } catch (e) {
    console.error('Error saving studio designs fallback file:', e)
  }
}

function isMissingTableError(e) {
  if (!e) return false
  const msg = (e.message || String(e)).toLowerCase()
  return msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('42p01') || e.code === 'PGRST204'
}

async function createStudioRevision(req, design, scene, changeSummary = 'Saved Studio draft') {
  if (!scene || !design?.id) return null
  const revisionNumber = Number(design.revision_number || 0) + 1
  const { data, error } = await supabaseAdmin.from('studio_design_revisions').insert({
    design_id: design.id,
    dealership_id: req.dealershipId,
    revision_number: revisionNumber,
    name: design.name || 'Untitled Design',
    scene,
    format_key: design.format_key || 'square',
    width: Number(design.width) || 1080,
    height: Number(design.height) || 1080,
    change_summary: String(changeSummary || 'Saved Studio draft').slice(0, 240),
    created_by: req.user?.id || null,
  }).select('*').single()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data
}

const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 10 } })
const studioVideoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } })

const ASSET_COLUMNS = 'id, dealership_id, kind, storage_path, public_url, width, height, bytes, title, alt_text, inventory_id, campaign_id, created_by, created_at'
const FORMATS = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  story: [1080, 1920],
  landscape: [1200, 628]
}

// Pexels authenticates with the raw API key (not a Bearer scheme). Normalizing here
// also recovers safely if an operator pasted "Bearer …" into Render by mistake.
export function pexelsApiKey(value = process.env.PEXELS_API_KEY) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '').trim()
}

export function pexelsSearchEndpoint(mediaType) {
  return mediaType === 'video'
    ? 'https://api.pexels.com/videos/search'
    : 'https://api.pexels.com/v1/search'
}

export function studioGifProviderConfig(provider) {
  const key = provider === 'tenor' ? String(process.env.TENOR_API_KEY || '').trim() : String(process.env.GIPHY_API_KEY || '').trim()
  return provider === 'tenor'
    ? { provider: 'tenor', key, endpoint: 'https://tenor.googleapis.com/v2/search' }
    : { provider: 'giphy', key, endpoint: 'https://api.giphy.com/v1/gifs/search' }
}

const HEX = /^#[0-9a-f]{6}$/i
const xml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))

export function studioDesignSpec(input = {}) {
  const format = FORMATS[input?.format] ? input.format : 'square'
  const [width, height] = FORMATS[format]
  const hex = (v, fallback) => (typeof v === 'string' && HEX.test(v.trim())) ? v.trim().toLowerCase() : fallback
  const overlayNum = Number(input?.overlay)
  const overlay = Number.isFinite(overlayNum) ? Math.max(0, Math.min(100, Math.round(overlayNum))) : 0
  return {
    format, width, height,
    accentColor: hex(input?.accent_color, '#6d28d9'),
    textColor: hex(input?.text_color, '#ffffff'),
    overlay,
    headline: input?.headline == null ? '' : String(input.headline),
    cta: input?.cta == null ? '' : String(input.cta),
  }
}

export function studioOverlaySvg(spec = {}) {
  const s = (spec && spec.width && spec.height) ? spec : studioDesignSpec(spec)
  const scrim = (Math.max(0, Math.min(100, Number(s.overlay) || 0)) / 100).toFixed(3)
  const pad = Math.round(s.width * 0.06)
  const headline = xml(s.headline)
  const cta = xml(s.cta)
  const ctaBlock = cta
    ? `<rect x="${pad}" y="${Math.round(s.height * 0.88)}" width="${Math.round(s.width * 0.55)}" height="${Math.round(s.height * 0.08)}" rx="16" fill="${s.accentColor}"/>`
      + `<text x="${Math.round(s.width * 0.09)}" y="${Math.round(s.height * 0.936)}" font-family="Arial, sans-serif" font-size="${Math.round(s.width * 0.032)}" font-weight="800" fill="${s.textColor}">${cta}</text>`
    : ''
  return `<svg width="${s.width}" height="${s.height}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="100%" height="100%" fill="#000000" opacity="${scrim}"/>`
    + `<text x="${pad}" y="${Math.round(s.height * 0.82)}" font-family="Arial, sans-serif" font-size="${Math.round(s.width * 0.06)}" font-weight="900" fill="${s.textColor}">${headline}</text>`
    + ctaBlock
    + `</svg>`
}

/**
 * Normalizes untrusted Studio input into a safe design spec. Every style field a dealer
 * can supply is validated or clamped here so nothing unsafe reaches the SVG renderer:
 *   - format  → one of the approved social aspect ratios (unknown → square)
 *   - colors  → 6-digit hex (unknown → slate-900 / white)
 *   - numbers → clamped to physically meaningful ranges
 *   - strings → escaped before string-interpolation into XML
 */
export function normalizeStudioSpec(raw = {}) {
  const format = FORMATS[raw.format] ? raw.format : 'square'
  const [w, h] = FORMATS[format]
  const background = HEX.test(raw.background) ? raw.background : '#0f172a'
  const accent = HEX.test(raw.accent) ? raw.accent : '#6366f1'
  const headline = String(raw.headline || '').slice(0, 120)
  const subheadline = String(raw.subheadline || '').slice(0, 160)
  const price = Number(raw.price) > 0 ? Number(raw.price) : null
  const badge = String(raw.badge || '').slice(0, 40)
  const cta = String(raw.cta || '').slice(0, 40)
  const photoUrl = typeof raw.photo_url === 'string' && raw.photo_url.startsWith('https://') ? raw.photo_url : null
  const logoUrl = typeof raw.logo_url === 'string' && raw.logo_url.startsWith('https://') ? raw.logo_url : null

  return { format, width: w, height: h, background, accent, headline, subheadline, price, badge, cta, photo_url: photoUrl, logo_url: logoUrl }
}

export const STOCK_STUDIO_TEMPLATES = [
  {
    template_key: 'tmpl_new_arrival_square',
    name: 'New Arrival Showcase',
    category: 'Inventory',
    format_key: 'square',
    width: 1080,
    height: 1080,
    scene: {
      version: 1,
      width: 1080,
      height: 1080,
      background: { color: '#0F172A' },
      elements: [
        { id: 'el-bg-photo', type: 'vehicle-image', x: 0, y: 0, width: 1080, height: 750, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-grad-overlay', type: 'shape', shapeType: 'rect', x: 0, y: 600, width: 1080, height: 480, fill: '#0F172A', opacity: 0.95, z: 2, name: 'Bottom Panel' },
        { id: 'el-badge', type: 'shape', shapeType: 'rect', x: 50, y: 50, width: 220, height: 50, fill: '#2563EB', rx: 12, opacity: 1, z: 3, name: 'Badge Pill' },
        { id: 'el-badge-txt', type: 'text', x: 75, y: 65, text: 'JUST ARRIVED', fontSize: 18, fontWeight: '800', fill: '#FFFFFF', z: 4, name: 'Badge Text' },
        { id: 'el-title', type: 'text', x: 50, y: 650, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 44, fontWeight: '900', fill: '#F8FAFC', z: 5, name: 'Vehicle Name' },
        { id: 'el-trim', type: 'text', x: 50, y: 715, text: '{{vehicle.trim}} • Stock #{{vehicle.stock_number}}', fontSize: 24, fontWeight: '600', fill: '#94A3B8', z: 6, name: 'Trim & Stock' },
        { id: 'el-price-bg', type: 'shape', shapeType: 'rect', x: 50, y: 780, width: 340, height: 70, fill: '#10B981', rx: 16, opacity: 1, z: 7, name: 'Price Badge' },
        { id: 'el-price-txt', type: 'text', x: 80, y: 800, text: '{{vehicle.price|Call for price}}', fontSize: 32, fontWeight: '900', fill: '#FFFFFF', z: 8, name: 'Price Text' },
        { id: 'el-cta-btn', type: 'shape', shapeType: 'rect', x: 50, y: 920, width: 980, height: 90, fill: '#2563EB', rx: 20, opacity: 1, z: 9, name: 'CTA Button' },
        { id: 'el-cta-txt', type: 'text', x: 420, y: 950, text: 'SCHEDULE TEST DRIVE', fontSize: 24, fontWeight: '800', fill: '#FFFFFF', z: 10, name: 'CTA Text' }
      ]
    }
  },
  {
    template_key: 'tmpl_pricedrop_story',
    name: 'Price Drop Banner',
    category: 'Price Drop',
    format_key: 'story',
    width: 1080,
    height: 1920,
    scene: {
      version: 1,
      width: 1080,
      height: 1920,
      background: { color: '#18181B' },
      elements: [
        { id: 'el-photo', type: 'vehicle-image', x: 0, y: 200, width: 1080, height: 1100, fit: 'cover', opacity: 1, z: 1, name: 'Vehicle Photo' },
        { id: 'el-top-banner', type: 'shape', shapeType: 'rect', x: 0, y: 0, width: 1080, height: 200, fill: '#EF4444', opacity: 1, z: 2, name: 'Price Reduction Banner' },
        { id: 'el-top-txt', type: 'text', x: 280, y: 75, text: 'PRICE REDUCED!', fontSize: 44, fontWeight: '900', fill: '#FFFFFF', z: 3, name: 'Banner Text' },
        { id: 'el-card', type: 'shape', shapeType: 'rect', x: 50, y: 1350, width: 980, height: 480, fill: '#27272A', rx: 32, opacity: 0.95, z: 4, name: 'Card Background' },
        { id: 'el-ymmt', type: 'text', x: 100, y: 1410, text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', fontSize: 48, fontWeight: '900', fill: '#FFFFFF', z: 5, name: 'Vehicle Title' },
        { id: 'el-miles', type: 'text', x: 100, y: 1480, text: 'Mileage: {{vehicle.mileage}} miles', fontSize: 24, fontWeight: '600', fill: '#A1A1AA', z: 6, name: 'Mileage' },
        { id: 'el-price', type: 'text', x: 100, y: 1560, text: 'NOW ONLY: {{vehicle.price}}', fontSize: 40, fontWeight: '900', fill: '#34D399', z: 7, name: 'Special Price' },
        { id: 'el-store', type: 'text', x: 100, y: 1720, text: '{{dealership.name}} • {{dealership.phone}}', fontSize: 22, fontWeight: '700', fill: '#E4E4E7', z: 8, name: 'Store Contact' }
      ]
    }
  }
];

export async function listAssets(dealershipId, { inventoryId = null, campaignId = null, limit = 200 } = {}) {
  let q = supabaseAdmin.from('marketing_assets').select(ASSET_COLUMNS)
    .eq('dealership_id', dealershipId).is('deleted_at', null)
  if (inventoryId) q = q.eq('inventory_id', inventoryId)
  if (campaignId) q = q.eq('campaign_id', campaignId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

export function registerMarketingStudio(app) {
  const canView = requirePermission('marketing.view')
  const canEdit = requirePermission('marketing.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  const requireMediaUploadAccess = async (req, res, next) => {
    if (req.user?.is_platform_staff) return next()
    try {
      const ctx = await getCurrentAccessContext(req)
      const allowed = hasFeature(ctx, 'design.assets') || hasFeature(ctx, 'social.scheduler')
      if (!allowed) {
        return res.status(403).json({ error: 'Active Design Studio or Social Scheduler subscription required.' })
      }
      next()
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── Asset Management ──────────────────────────────────────────────────────
  app.get('/marketing/assets', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      res.json({ assets: await listAssets(req.dealershipId, {
        inventoryId: req.query.inventory_id || null,
        campaignId: req.query.campaign_id || null,
      }) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/marketing/assets', requireAuth, requireMfa, canEdit, requireMediaUploadAccess, assetUpload.single('file'), async (req, res) => {
    if (!guard(req, res)) return
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' })

    let webp, meta
    try {
      webp = await toWebp(req.file.buffer, { max: 2200, quality: 86 })
      const sharp = (await import('sharp')).default
      meta = await sharp(webp).metadata()
    } catch (e) {
      return res.status(400).json({ error: 'File processing error: ' + e.message })
    }

    const path = `${req.dealershipId}/_marketing/asset-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`
    const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos')
      .upload(path, webp, { contentType: 'image/webp', upsert: false })
    if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message })

    const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
    const { data, error } = await supabaseAdmin.from('marketing_assets').insert({
      dealership_id: req.dealershipId,
      kind: 'image',
      storage_path: path,
      public_url: pub?.publicUrl || '',
      width: meta?.width || null, height: meta?.height || null, bytes: webp.length,
      title: req.body?.title || null,
      alt_text: req.body?.alt_text || null,
      inventory_id: req.body?.inventory_id || null,
      campaign_id: req.body?.campaign_id || null,
      created_by: req.user?.id || null,
    }).select(ASSET_COLUMNS).single()

    if (error) {
      await supabaseAdmin.storage.from('vehicle-photos').remove([path])
      return res.status(500).json({ error: error.message })
    }
    audit(req, 'marketing.asset_uploaded', { after_state: { id: data.id, bytes: data.bytes } })
    res.json({ ok: true, asset: data })
  })

  app.post('/marketing/assets/video', requireAuth, requireMfa, canEdit, requireMediaUploadAccess, studioVideoUpload.single('file'), async (req, res) => {
    if (!guard(req, res)) return
    if (!req.file || !/^video\//.test(req.file.mimetype || '')) return res.status(400).json({ error: 'Choose a valid video file.' })
    const ext = (req.file.originalname?.split('.').pop() || req.file.mimetype.split('/')[1] || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 8)
    const storagePath = `${req.dealershipId}/_studio/${Date.now()}-${crypto.randomBytes(9).toString('base64url')}.${ext}`
    const { error: upErr } = await supabaseAdmin.storage.from('sales-videos').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false })
    if (upErr) return res.status(500).json({ error: 'Video upload failed: ' + upErr.message })
    const { data: pub } = supabaseAdmin.storage.from('sales-videos').getPublicUrl(storagePath)
    const { data, error } = await supabaseAdmin.from('marketing_assets').insert({
      dealership_id: req.dealershipId, kind: 'video', storage_path: storagePath,
      public_url: pub?.publicUrl || '', bytes: req.file.size,
      title: String(req.body?.title || req.file.originalname || 'Uploaded video').slice(0, 160),
      created_by: req.user?.id || null
    }).select(ASSET_COLUMNS).single()
    if (error) {
      await supabaseAdmin.storage.from('sales-videos').remove([storagePath])
      return res.status(500).json({ error: error.message })
    }
    audit(req, 'marketing.video_uploaded', { after_state: { id: data.id, bytes: data.bytes } })
    res.json({ ok: true, asset: data })
  })

  // ── Studio Designs CRUD ───────────────────────────────────────────────────
  app.get('/marketing/studio/designs', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('studio_designs')
        .select('*')
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      if (error) {
        if (isMissingTableError(error)) {
          const fallback = loadFallbackDesigns().filter(d => d.dealership_id === req.dealershipId && !d.deleted_at)
          return res.json({ designs: fallback })
        }
        throw error
      }
      res.json({ designs: data || [] })
    } catch (e) {
      if (isMissingTableError(e)) {
        const fallback = loadFallbackDesigns().filter(d => d.dealership_id === req.dealershipId && !d.deleted_at)
        return res.json({ designs: fallback })
      }
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/marketing/studio/designs', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const payload = {
      // Keep the database UUID contract intact so revisions can reference the
      // design. The old sd_ prefix made new designs fall out of the DB path.
      id: crypto.randomUUID(),
      dealership_id: req.dealershipId,
      owner_user_id: req.user?.id,
      ownership: req.body?.ownership || 'dealership',
      name: req.body?.name || 'Untitled Design',
      format_key: req.body?.format_key || 'square',
      width: Number(req.body?.width) || 1080,
      height: Number(req.body?.height) || 1080,
      scene: req.body?.scene || { version: 1, width: 1080, height: 1080, elements: [] },
      vehicle_id: req.body?.vehicle_id || null,
      campaign_id: req.body?.campaign_id || null,
      template_id: req.body?.template_id || null,
      created_by: req.user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      revision_number: 0,
      last_saved_by: req.user?.id || null
    }
    try {
      const { data, error } = await supabaseAdmin.from('studio_designs').insert(payload).select('*').single()
      if (error) {
        if (isMissingTableError(error)) {
          const designs = loadFallbackDesigns()
          designs.unshift(payload)
          saveFallbackDesigns(designs)
          audit(req, 'marketing.studio_design_created', { after_state: { id: payload.id, name: payload.name } })
          return res.json({ ok: true, design: payload })
        }
        throw error
      }
      audit(req, 'marketing.studio_design_created', { after_state: { id: data.id, name: data.name } })
      const revision = await createStudioRevision(req, data, data.scene, 'Created Studio design')
      if (revision) {
        const { data: updated } = await supabaseAdmin.from('studio_designs').update({ revision_number: revision.revision_number, last_saved_by: req.user?.id || null }).eq('id', data.id).eq('dealership_id', req.dealershipId).select('*').single()
        return res.json({ ok: true, design: updated || { ...data, revision_number: revision.revision_number }, revision })
      }
      res.json({ ok: true, design: data })
    } catch (e) {
      if (isMissingTableError(e)) {
        const designs = loadFallbackDesigns()
        designs.unshift(payload)
        saveFallbackDesigns(designs)
        audit(req, 'marketing.studio_design_created', { after_state: { id: payload.id, name: payload.name } })
        return res.json({ ok: true, design: payload })
      }
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/marketing/studio/designs/:id', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('studio_designs')
        .select('*')
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .single()
      if (error) {
        if (isMissingTableError(error)) {
          const found = loadFallbackDesigns().find(d => d.id === req.params.id && d.dealership_id === req.dealershipId && !d.deleted_at)
          if (!found) return res.status(404).json({ error: 'Design not found' })
          return res.json({ design: found })
        }
        return res.status(404).json({ error: 'Design not found' })
      }
      if (!data) return res.status(404).json({ error: 'Design not found' })
      res.json({ design: data })
    } catch (e) {
      if (isMissingTableError(e)) {
        const found = loadFallbackDesigns().find(d => d.id === req.params.id && d.dealership_id === req.dealershipId && !d.deleted_at)
        if (!found) return res.status(404).json({ error: 'Design not found' })
        return res.json({ design: found })
      }
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/marketing/studio/designs/:id/revisions', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('studio_design_revisions')
        .select('id, design_id, revision_number, name, format_key, width, height, change_summary, created_by, created_at')
        .eq('design_id', req.params.id).eq('dealership_id', req.dealershipId)
        .order('revision_number', { ascending: false }).limit(100)
      if (error) {
        if (isMissingTableError(error)) return res.json({ revisions: [] })
        throw error
      }
      res.json({ revisions: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/marketing/studio/designs/:id/status', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const status = String(req.body?.status || '').toLowerCase()
    if (!['draft', 'published', 'archived'].includes(status)) return res.status(400).json({ error: 'status must be draft, published, or archived' })
    try {
      const { data: current, error: findError } = await supabaseAdmin.from('studio_designs').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).single()
      if (findError || !current) return res.status(404).json({ error: 'Design not found' })
      const patch = { status, updated_at: new Date().toISOString(), last_saved_by: req.user?.id || null }
      if (status === 'published') {
        if (!Number(current.revision_number)) {
          const revision = await createStudioRevision(req, current, current.scene, 'Published Studio design')
          if (revision) patch.revision_number = revision.revision_number
        }
        patch.published_revision_number = Number(patch.revision_number || current.revision_number || 0) || null
        patch.published_at = new Date().toISOString()
      }
      const { data, error } = await supabaseAdmin.from('studio_designs').update(patch).eq('id', current.id).eq('dealership_id', req.dealershipId).select('*').single()
      if (error) throw error
      audit(req, `marketing.studio_design_${status}`, { after_state: { id: data.id, status: data.status, revision_number: data.revision_number } })
      res.json({ ok: true, design: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/marketing/studio/designs/:id/revisions/:revisionId/restore', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: design } = await supabaseAdmin.from('studio_designs').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      const { data: revision } = await supabaseAdmin.from('studio_design_revisions').select('*').eq('id', req.params.revisionId).eq('design_id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!design || !revision) return res.status(404).json({ error: 'Design revision not found' })
      const nextRevision = await createStudioRevision(req, { ...design, name: design.name, format_key: revision.format_key, width: revision.width, height: revision.height, revision_number: design.revision_number }, revision.scene, `Restored revision ${revision.revision_number}`)
      const updates = { scene: revision.scene, format_key: revision.format_key, width: revision.width, height: revision.height, revision_number: nextRevision?.revision_number || Number(design.revision_number || 0) + 1, status: 'draft', updated_at: new Date().toISOString(), last_saved_by: req.user?.id || null }
      const { data, error } = await supabaseAdmin.from('studio_designs').update(updates).eq('id', design.id).eq('dealership_id', req.dealershipId).select('*').single()
      if (error) throw error
      audit(req, 'marketing.studio_design_revision_restored', { after_state: { id: data.id, restored_from: revision.id, revision_number: data.revision_number } })
      res.json({ ok: true, design: data, revision: nextRevision })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.put('/marketing/studio/designs/:id', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const updates = {
      name: req.body?.name,
      format_key: req.body?.format_key,
      width: req.body?.width,
      height: req.body?.height,
      scene: req.body?.scene,
      vehicle_id: req.body?.vehicle_id,
      campaign_id: req.body?.campaign_id,
      updated_at: new Date().toISOString(),
      last_saved_by: req.user?.id || null
    }
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k])

    try {
      const { data, error } = await supabaseAdmin.from('studio_designs')
        .update(updates)
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .select('*')
        .single()
      if (error) {
        if (isMissingTableError(error)) {
          const designs = loadFallbackDesigns()
          let idx = designs.findIndex(d => d.id === req.params.id && d.dealership_id === req.dealershipId && !d.deleted_at)
          if (idx === -1) {
            const newDesign = {
              id: req.params.id,
              dealership_id: req.dealershipId,
              owner_user_id: req.user?.id,
              created_at: new Date().toISOString(),
              ...updates
            }
            designs.unshift(newDesign)
            saveFallbackDesigns(designs)
            return res.json({ ok: true, design: newDesign })
          }
          Object.assign(designs[idx], updates)
          saveFallbackDesigns(designs)
          return res.json({ ok: true, design: designs[idx] })
        }
        throw error
      }
      let revision = null
      if (updates.scene) revision = await createStudioRevision(req, data, data.scene, req.body?.change_summary || 'Saved Studio draft')
      if (revision) {
        const { data: withRevision } = await supabaseAdmin.from('studio_designs').update({ revision_number: revision.revision_number, last_saved_by: req.user?.id || null }).eq('id', data.id).eq('dealership_id', req.dealershipId).select('*').single()
        return res.json({ ok: true, design: withRevision || { ...data, revision_number: revision.revision_number }, revision })
      }
      res.json({ ok: true, design: data })
    } catch (e) {
      if (isMissingTableError(e)) {
        const designs = loadFallbackDesigns()
        let idx = designs.findIndex(d => d.id === req.params.id && d.dealership_id === req.dealershipId && !d.deleted_at)
        if (idx === -1) {
          const newDesign = {
            id: req.params.id,
            dealership_id: req.dealershipId,
            owner_user_id: req.user?.id,
            created_at: new Date().toISOString(),
            ...updates
          }
          designs.unshift(newDesign)
          saveFallbackDesigns(designs)
          return res.json({ ok: true, design: newDesign })
        }
        Object.assign(designs[idx], updates)
        saveFallbackDesigns(designs)
        return res.json({ ok: true, design: designs[idx] })
      }
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/marketing/studio/designs/:id', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { error } = await supabaseAdmin.from('studio_designs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
      if (error) {
        if (isMissingTableError(error)) {
          const designs = loadFallbackDesigns()
          const idx = designs.findIndex(d => d.id === req.params.id && d.dealership_id === req.dealershipId)
          if (idx !== -1) {
            designs[idx].deleted_at = new Date().toISOString()
            saveFallbackDesigns(designs)
          }
          return res.json({ ok: true })
        }
        throw error
      }
      res.json({ ok: true })
    } catch (e) {
      if (isMissingTableError(e)) {
        const designs = loadFallbackDesigns()
        const idx = designs.findIndex(d => d.id === req.params.id && d.dealership_id === req.dealershipId)
        if (idx !== -1) {
          designs[idx].deleted_at = new Date().toISOString()
          saveFallbackDesigns(designs)
        }
        return res.json({ ok: true })
      }
      res.status(500).json({ error: e.message })
    }
  })

  // ── Studio Templates ──────────────────────────────────────────────────────
  app.get('/marketing/studio/templates', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('studio_templates')
        .select('*')
        .or(`dealership_id.is.null,dealership_id.eq.${req.dealershipId}`)
        .eq('active', true)
        .order('created_at', { ascending: false })

      const templates = [...(data || []), ...GLOBAL_TEMPLATES]
      res.json({ templates })
    } catch (e) { res.json({ templates: GLOBAL_TEMPLATES }) }
  })

  // ── GIF Search Proxy ─────────────────────────────────────────────────────
  // Provider credentials stay server-side. The Studio only receives normalized
  // preview/source URLs, so keys are never exposed in browser code or markup.
  app.get('/marketing/studio/gifs/search', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    const provider = req.query.provider === 'tenor' ? 'tenor' : 'giphy'
    const query = String(req.query.q || '').trim().slice(0, 120)
    if (!query) return res.status(400).json({ error: 'A GIF search query is required.' })
    const config = studioGifProviderConfig(provider)
    if (!config.key) return res.status(503).json({ error: `${provider === 'giphy' ? 'GIPHY' : 'Tenor'} search is not configured on this environment.`, provider })

    try {
      const params = new URLSearchParams({ q: query, limit: '24' })
      if (provider === 'giphy') {
        params.set('api_key', config.key)
        params.set('rating', 'pg-13')
      } else {
        params.set('key', config.key)
        params.set('client_key', 'marketsync-studio')
        params.set('contentfilter', 'medium')
      }
      const response = await fetch(`${config.endpoint}?${params}`, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = payload?.message || payload?.error || response.statusText || 'provider request failed'
        return res.status(response.status === 429 ? 429 : 502).json({ error: `GIF provider search failed: ${String(detail).slice(0, 180)}`, provider })
      }
      const results = provider === 'giphy'
        ? (payload.data || []).map(item => ({ id: `giphy_${item.id}`, title: item.title || query, preview_url: item.images?.fixed_width?.url || item.images?.original?.url, source_url: item.images?.original?.url || item.images?.fixed_width?.url }))
        : (payload.results || []).map(item => ({ id: `tenor_${item.id}`, title: item.content_description || query, preview_url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || item.media_formats?.mediumgif?.url, source_url: item.media_formats?.gif?.url || item.media_formats?.mediumgif?.url || item.media_formats?.tinygif?.url }))
      res.json({ provider, query, results: results.filter(item => item.preview_url && item.source_url) })
    } catch (e) {
      res.status(502).json({ error: 'GIF provider search could not be reached. Try again shortly.', provider })
    }
  })

  // ── Free Asset Library Search & Import ────────────────────────────────────
  app.get('/marketing/studio/library/search', requireAuth, canView, async (req, res) => {
    if (!guard(req, res)) return
    const query = String(req.query.q || 'car dealership').trim().slice(0, 120)
    const orientation = ['landscape', 'portrait', 'square'].includes(req.query.orientation) ? req.query.orientation : null
    const mediaType = req.query.type === 'video' ? 'video' : 'photo'
    const page = Math.max(1, Math.min(100, Number(req.query.page) || 1))

    try {
      const apiKey = pexelsApiKey()
      if (!apiKey) return res.status(503).json({ error: 'Pexels library is not configured.' })
      const params = new URLSearchParams({ query, per_page: '30', page: String(page) })
      if (orientation) params.set('orientation', orientation)
      const endpoint = pexelsSearchEndpoint(mediaType)
      const response = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      })
      if (!response.ok) {
        const upstream = await response.json().catch(() => ({}))
        const detail = upstream?.error || upstream?.message || response.statusText || 'upstream request failed'
        const status = response.status === 429 ? 429 : 502
        return res.status(status).json({
          error: response.status === 429
            ? 'Pexels request limit reached. Try again shortly.'
            : `Pexels search failed (${response.status}): ${String(detail).slice(0, 180)}`,
          provider: 'pexels', media_type: mediaType
        })
      }
      const data = await response.json()
      const results = mediaType === 'video' ? (data.videos || []).map(video => {
        const files = (video.video_files || []).filter(file => file.link)
        const chosen = files.find(file => file.quality === 'hd' && Number(file.width) <= 1920) || files.find(file => file.quality === 'sd') || files[0]
        return {
          id: `pexels_video_${video.id}`, provider: 'pexels', type: 'video',
          preview_url: video.image, source_url: chosen?.link || null,
          width: chosen?.width || video.width, height: chosen?.height || video.height,
          duration: video.duration || null, author: video.user?.name || 'Pexels creator',
          author_url: video.user?.url || null, attribution_url: video.url || 'https://www.pexels.com/videos/',
          alt: `${query} video`, license: 'Pexels'
        }
      }).filter(video => video.source_url) : (data.photos || []).map(photo => ({
        id: `pexels_${photo.id}`,
        provider: 'pexels', type: 'photo',
        preview_url: photo.src?.medium || photo.src?.small,
        source_url: photo.src?.large2x || photo.src?.large || photo.src?.original,
        width: photo.width, height: photo.height,
        author: photo.photographer || 'Pexels photographer',
        author_url: photo.photographer_url || null,
        attribution_url: photo.url || 'https://www.pexels.com',
        alt: photo.alt || query,
        license: 'Pexels'
      }))
      res.json({ results, page: data.page || page, total_results: data.total_results || results.length, provider_url: 'https://www.pexels.com' })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/marketing/studio/library/import', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const sourceUrl = req.body?.source_url
    if (!sourceUrl) return res.status(400).json({ error: 'source_url is required' })

    try {
      // sourceUrl is user-supplied; fetch it through the SSRF policy so it cannot be
      // aimed at internal hosts or cloud metadata endpoints.
      const resp = await safeOutboundFetch(sourceUrl)
      if (!resp.ok) throw new Error('Could not download external image asset')
      const buffer = Buffer.from(await resp.arrayBuffer())
      const webp = await toWebp(buffer, { max: 2200, quality: 86 })

      const path = `${req.dealershipId}/_marketing/imported-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`
      const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos')
        .upload(path, webp, { contentType: 'image/webp', upsert: false })
      if (upErr) throw upErr

      const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
      const { data, error } = await supabaseAdmin.from('marketing_assets').insert({
        dealership_id: req.dealershipId,
        kind: 'image',
        storage_path: path,
        public_url: pub?.publicUrl || '',
        width: 1920, height: 1080, bytes: webp.length,
        title: req.body?.title || 'Imported Stock Asset',
        created_by: req.user?.id
      }).select(ASSET_COLUMNS).single()

      if (error) throw error
      res.json({ ok: true, asset: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Server Scene Renderer ─────────────────────────────────────────────────
  app.post('/marketing/studio/render', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const spec = studioDesignSpec(req.body || {})
    const scene = req.body?.scene || {}
    const width = Number(scene.width || req.body?.width) || spec.width
    const height = Number(scene.height || req.body?.height) || spec.height
    const elements = scene.elements || []

    try {
      const sharp = (await import('sharp')).default

      // Backgrounds are tenant-scoped canonical assets from marketing_assets, downloaded
      // from OUR storage. A dealer may pick one of THEIR own assets by id; the renderer
      // never fetches an arbitrary URL out of the request body.
      let base
      const bgId = req.body?.background_asset_id || null
      if (bgId) {
        const { data: source, error: srcErr } = await supabaseAdmin.from('marketing_assets')
          .select('id, storage_path')
          .eq('id', bgId)
          .eq('dealership_id', req.dealershipId)
          .is('deleted_at', null)
          .maybeSingle()
        if (srcErr) return res.status(500).json({ error: srcErr.message })
        if (!source) return res.status(404).json({ error: 'Background asset not found for this dealership' })
        const { data: file, error: dlErr } = await supabaseAdmin.storage.from('vehicle-photos').download(source.storage_path)
        if (dlErr || !file) return res.status(404).json({ error: 'Background asset file is unavailable' })
        const bgBuffer = Buffer.from(await file.arrayBuffer())
        base = sharp(bgBuffer).resize(width, height, { fit: 'cover' })
      } else {
        base = sharp({ create: { width, height, channels: 4, background: scene.background?.color || '#0F172A' } })
      }

      const gradientDefs = []
      const svgElements = elements.map((el, elementIndex) => {
        const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
        let fill = HEX.test(String(el.fill || '')) ? el.fill : '#2563EB'
        const gradientColors = Array.isArray(el.gradient?.colors) ? el.gradient.colors.filter(color => HEX.test(String(color))).slice(0, 6) : []
        if (gradientColors.length >= 2) {
          const gradientId = `studio-gradient-${elementIndex}`
          const stops = gradientColors.map((color, index) => `<stop offset="${Math.round(index * 100 / (gradientColors.length - 1))}%" stop-color="${color}"/>`).join('')
          gradientDefs.push(`<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`)
          fill = `url(#${gradientId})`
        }
        const stroke = HEX.test(String(el.stroke || '')) ? el.stroke : fill
        const opacity = Math.max(0, Math.min(1, n(el.opacity, 1)))
        const transform = `rotate(${n(el.rotation)} ${n(el.x) + n(el.width) / 2} ${n(el.y) + n(el.height) / 2})`
        if (el.type === 'text') {
          return `<text x="${n(el.x)}" y="${n(el.y) + n(el.fontSize, 24)}" font-family="Arial, sans-serif" font-size="${n(el.fontSize, 24)}" font-weight="${xml(el.fontWeight || '700')}" fill="${HEX.test(String(el.fill || '')) ? el.fill : '#FFFFFF'}" opacity="${opacity}" transform="${transform}">${xml(el.text || '')}</text>`
        } else if (el.type === 'shape') {
          const x = n(el.x), y = n(el.y), w = n(el.width, 100), h = n(el.height, 100)
          if (el.shapeType === 'rect' || el.shapeType === 'badge') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${n(el.rx)}" fill="${fill}" opacity="${opacity}" transform="${transform}"/>`
          if (el.shapeType === 'circle') return `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" opacity="${opacity}" transform="${transform}"/>`
          if (el.shapeType === 'ellipse') return `<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" opacity="${opacity}" transform="${transform}"/>`
          if (el.shapeType === 'triangle') return `<polygon points="${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}" fill="${fill}" opacity="${opacity}" transform="${transform}"/>`
          if (Array.isArray(el.points) && el.points.length > 2) {
            const points = el.points.slice(0, 80).map(p => `${x + n(p.x)},${y + n(p.y)}`).join(' ')
            return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${n(el.strokeWidth)}" opacity="${opacity}" transform="${transform}"/>`
          }
          if (Array.isArray(el.path)) {
            const d = el.path.slice(0, 500).map(command => Array.isArray(command) ? command.map((part, i) => i === 0 ? String(part).replace(/[^a-z]/gi, '') : n(part)).join(' ') : '').join(' ')
            return `<path d="${xml(d)}" transform="translate(${x} ${y}) rotate(${n(el.rotation)} ${w/2} ${h/2})" fill="${el.fill ? fill : 'none'}" stroke="${stroke}" stroke-width="${Math.max(1, n(el.strokeWidth, 4))}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`
          }
        }
        return ''
      }).join('\n')

      const sceneSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs>${gradientDefs.join('')}</defs>${svgElements}</svg>`
      const overlaySvg = studioOverlaySvg({ ...spec, width, height })

      const webp = await base
        .composite([
          { input: Buffer.from(overlaySvg), top: 0, left: 0 },
          { input: Buffer.from(sceneSvg), top: 0, left: 0 },
        ])
        .webp({ quality: 90 })
        .toBuffer()

      const path = `${req.dealershipId}/_marketing/design-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`
      const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, webp, { contentType: 'image/webp', upsert: false })
      if (upErr) return res.status(500).json({ error: 'Render upload failed: ' + upErr.message })

      const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
      const { data, error } = await supabaseAdmin.from('marketing_assets').insert({
        dealership_id: req.dealershipId, kind: 'image', storage_path: path, public_url: pub?.publicUrl || '',
        width, height, bytes: webp.length, title: req.body?.name || 'Studio Creative',
        inventory_id: req.body?.vehicle_id || null, created_by: req.user?.id || null,
      }).select(ASSET_COLUMNS).single()

      if (error) { await supabaseAdmin.storage.from('vehicle-photos').remove([path]); return res.status(500).json({ error: error.message }) }
      audit(req, 'marketing.design_rendered', { after_state: { id: data.id, width, height } })
      res.json({ ok: true, asset: data })
    } catch (e) { res.status(400).json({ error: 'The design could not be rendered: ' + e.message }) }
  })

  // ── Soft Delete Asset ─────────────────────────────────────────────────────
  app.delete('/marketing/assets/:id', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('marketing_assets')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null)
        .select('id').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Asset not found' })
      audit(req, 'marketing.asset_deleted', { before_state: { id: req.params.id } })
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
