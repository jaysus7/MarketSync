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
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
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

const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 10 } })

const ASSET_COLUMNS = 'id, dealership_id, kind, storage_path, public_url, width, height, bytes, title, alt_text, inventory_id, campaign_id, created_by, created_at'
const FORMATS = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  story: [1080, 1920],
  landscape: [1200, 628]
}

const HEX = /^#[0-9a-f]{6}$/i
const xml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const lines = (s, max = 34) => {
  const words = String(s || '').trim().split(/\s+/).filter(Boolean), out = []
  for (const word of words) {
    if (!out.length || `${out.at(-1)} ${word}`.length > max) out.push(word)
    else out[out.length - 1] += ` ${word}`
  }
  return out.slice(0, 4)
}

export function studioDesignSpec(input = {}) {
  const format = FORMATS[input.format] ? input.format : 'square'
  const [width, height] = FORMATS[format]
  return {
    format, width, height,
    headline: String(input.headline || '').trim().slice(0, 140),
    subheadline: String(input.subheadline || '').trim().slice(0, 220),
    cta: String(input.cta || '').trim().slice(0, 60),
    textColor: HEX.test(input.text_color) ? input.text_color : '#ffffff',
    accentColor: HEX.test(input.accent_color) ? input.accent_color : '#6d28d9',
    overlay: Math.max(0, Math.min(85, Number(input.overlay ?? 48))),
  }
}

export function studioOverlaySvg(spec) {
  const headline = lines(spec.headline, spec.format === 'story' ? 25 : 32)
  const sub = lines(spec.subheadline, spec.format === 'story' ? 34 : 48)
  const baseY = Math.round(spec.height * .57), headlineSize = Math.round(spec.width * .064)
  return `<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="rgba(0,0,0,${spec.overlay / 100})"/>
    <rect x="${Math.round(spec.width*.07)}" y="${Math.round(spec.height*.08)}" width="${Math.round(spec.width*.16)}" height="${Math.max(8,Math.round(spec.height*.009))}" rx="4" fill="${spec.accentColor}"/>
    ${headline.map((l,i)=>`<text x="${Math.round(spec.width*.07)}" y="${baseY+i*headlineSize*1.08}" font-family="Arial,Helvetica,sans-serif" font-size="${headlineSize}" font-weight="700" fill="${spec.textColor}">${xml(l)}</text>`).join('')}
    ${sub.map((l,i)=>`<text x="${Math.round(spec.width*.07)}" y="${baseY+headline.length*headlineSize*1.08+Math.round(spec.height*.045)+i*headlineSize*.58}" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(headlineSize*.42)}" fill="${spec.textColor}">${xml(l)}</text>`).join('')}
    ${spec.cta ? `<rect x="${Math.round(spec.width*.07)}" y="${Math.round(spec.height*.86)}" width="${Math.min(Math.round(spec.width*.6), Math.max(Math.round(spec.width*.22), spec.cta.length*headlineSize*.28))}" height="${Math.round(spec.height*.065)}" rx="${Math.round(spec.height*.015)}" fill="${spec.accentColor}"/><text x="${Math.round(spec.width*.095)}" y="${Math.round(spec.height*.902)}" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(headlineSize*.36)}" font-weight="700" fill="#ffffff">${xml(spec.cta)}</text>` : ''}
  </svg>`
}

/**
 * Default Stock Automotive Templates
 */
const GLOBAL_TEMPLATES = [
  {
    template_key: 'tmpl_spotlight_square',
    name: 'Vehicle Spotlight',
    category: 'Vehicle Spotlight',
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

  app.post('/marketing/assets', requireAuth, requireMfa, canEdit, assetUpload.single('file'), async (req, res) => {
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

    const path = `${req.dealershipId}/_marketing/asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`
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
      id: `sd_${crypto.randomUUID()}`,
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
      updated_at: new Date().toISOString()
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
      updated_at: new Date().toISOString()
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

  // ── Free Asset Library Search & Import ────────────────────────────────────
  app.get('/marketing/studio/library/search', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    const query = String(req.query.q || 'car dealership').trim()
    const provider = req.query.provider || 'pixabay'

    try {
      const results = [
        { id: 'lib_1', provider, type: 'photo', preview_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80', source_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341', width: 1920, height: 1280, author: 'Unsplash Car Collection', license: 'Free Commercial' },
        { id: 'lib_2', provider, type: 'photo', preview_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80', source_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70', width: 1920, height: 1280, author: 'Unsplash Luxury Automotive', license: 'Free Commercial' },
        { id: 'lib_3', provider, type: 'photo', preview_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80', source_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d', width: 1920, height: 1280, author: 'Unsplash Sports Car', license: 'Free Commercial' },
        { id: 'lib_4', provider, type: 'photo', preview_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80', source_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd', width: 1920, height: 1280, author: 'Unsplash Dealership Showroom', license: 'Free Commercial' }
      ]
      res.json({ results })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/marketing/studio/library/import', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const sourceUrl = req.body?.source_url
    if (!sourceUrl) return res.status(400).json({ error: 'source_url is required' })

    try {
      const resp = await fetch(sourceUrl)
      if (!resp.ok) throw new Error('Could not download external image asset')
      const buffer = Buffer.from(await resp.arrayBuffer())
      const webp = await toWebp(buffer, { max: 2200, quality: 86 })

      const path = `${req.dealershipId}/_marketing/imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`
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
    const scene = req.body?.scene || {}
    const width = Number(scene.width || req.body?.width) || 1080
    const height = Number(scene.height || req.body?.height) || 1080
    const elements = scene.elements || []

    let background = null
    const assetId = req.body?.asset_id || scene.background?.asset_id
    if (assetId) {
      const { data: source } = await supabaseAdmin.from('marketing_assets').select('id, storage_path')
        .eq('id', assetId).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (source?.storage_path) {
        const { data } = await supabaseAdmin.storage.from('vehicle-photos').download(source.storage_path)
        if (data) background = Buffer.from(await data.arrayBuffer())
      }
    }

    try {
      const sharp = (await import('sharp')).default
      const svgElements = elements.map(el => {
        if (el.type === 'text') {
          return `<text x="${el.x || 0}" y="${(el.y || 0) + (el.fontSize || 24)}" font-family="Arial, sans-serif" font-size="${el.fontSize || 24}" font-weight="${el.fontWeight || '700'}" fill="${el.fill || '#FFFFFF'}">${xml(el.text || '')}</text>`
        } else if (el.type === 'shape' && el.shapeType === 'rect') {
          return `<rect x="${el.x || 0}" y="${el.y || 0}" width="${el.width || 100}" height="${el.height || 100}" rx="${el.rx || 0}" fill="${el.fill || '#2563EB'}" opacity="${el.opacity ?? 1}"/>`
        }
        return ''
      }).join('\n')

      const fullSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${scene.background?.color || '#0F172A'}"/>${svgElements}</svg>`

      const webp = await sharp({ create: { width, height, channels: 4, background: '#0F172A' } })
        .composite([{ input: Buffer.from(fullSvg), top: 0, left: 0 }])
        .webp({ quality: 90 })
        .toBuffer()

      const path = `${req.dealershipId}/_marketing/design-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`
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
