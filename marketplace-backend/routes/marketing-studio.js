/**
 * Studio — the dealership's own marketing media (Phase 6 PR 6.6).
 *
 * `social_posts.media` is jsonb and will accept any URL at all. That is fine for a prototype
 * and wrong for a product: nobody can find last month's photo again, nothing ties an image to
 * the vehicle it shows, and a post can point at a URL that stops resolving next week.
 *
 * Studio designs render back into this same canonical asset library. Social and Campaigns
 * consume the resulting asset row; Studio does not own a second publishing pipeline.
 *
 * Storage and encoding reuse the vehicle-photo path exactly: same bucket, same WebP encode,
 * same size caps. A second image pipeline would be a second set of bugs.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { toWebp } from './inventory.js'
import multer from 'multer'

const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 10 } })

const ASSET_COLUMNS = 'id, dealership_id, kind, storage_path, public_url, width, height, bytes, title, alt_text, inventory_id, campaign_id, created_by, created_at'
const FORMATS = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1200, 628] }
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
 * The library, newest first. Filterable by the vehicle or campaign an asset belongs to,
 * because "the photos for that Silverado" is how a person actually looks for one.
 */
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
      // Recorded so a composer can warn about an image a network will reject for its shape
      // before it is scheduled, rather than after it fails to publish.
      const sharp = (await import('sharp')).default
      meta = await sharp(webp).metadata()
    } catch (e) {
      return res.status(400).json({ error: 'That file could not be processed as an image: ' + e.message })
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
      // The bytes are already in the bucket; an orphaned object with no row is invisible
      // storage cost forever, so remove it rather than leave it behind.
      await supabaseAdmin.storage.from('vehicle-photos').remove([path])
      return res.status(500).json({ error: error.message })
    }
    audit(req, 'marketing.asset_uploaded', { after_state: { id: data.id, bytes: data.bytes } })
    res.json({ ok: true, asset: data })
  })

  app.post('/marketing/studio/render', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const spec = studioDesignSpec(req.body || {})
    if (!spec.headline) return res.status(400).json({ error: 'A headline is required.' })
    let background = null
    if (req.body?.asset_id) {
      const { data: source } = await supabaseAdmin.from('marketing_assets').select('id, storage_path')
        .eq('id', req.body.asset_id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!source) return res.status(404).json({ error: 'Background asset not found.' })
      const { data, error } = await supabaseAdmin.storage.from('vehicle-photos').download(source.storage_path)
      if (error || !data) return res.status(400).json({ error: 'The background image could not be loaded.' })
      background = Buffer.from(await data.arrayBuffer())
    }
    try {
      const sharp = (await import('sharp')).default
      let canvas = background
        ? sharp(background, { failOn: 'none' }).rotate().resize(spec.width, spec.height, { fit: 'cover' })
        : sharp({ create: { width: spec.width, height: spec.height, channels: 4, background: spec.accentColor } })
      const webp = await canvas.composite([{ input: Buffer.from(studioOverlaySvg(spec)), top: 0, left: 0 }]).webp({ quality: 90 }).toBuffer()
      const path = `${req.dealershipId}/_marketing/design-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`
      const { error: upErr } = await supabaseAdmin.storage.from('vehicle-photos').upload(path, webp, { contentType: 'image/webp', upsert: false })
      if (upErr) return res.status(500).json({ error: 'Render upload failed: ' + upErr.message })
      const { data: pub } = supabaseAdmin.storage.from('vehicle-photos').getPublicUrl(path)
      const { data, error } = await supabaseAdmin.from('marketing_assets').insert({
        dealership_id: req.dealershipId, kind: 'image', storage_path: path, public_url: pub?.publicUrl || '',
        width: spec.width, height: spec.height, bytes: webp.length, title: req.body?.title || spec.headline,
        alt_text: req.body?.alt_text || spec.headline, campaign_id: req.body?.campaign_id || null,
        inventory_id: req.body?.inventory_id || null, created_by: req.user?.id || null,
      }).select(ASSET_COLUMNS).single()
      if (error) { await supabaseAdmin.storage.from('vehicle-photos').remove([path]); return res.status(500).json({ error: error.message }) }
      audit(req, 'marketing.design_rendered', { after_state: { id: data.id, format: spec.format, source_asset_id: req.body?.asset_id || null } })
      res.json({ ok: true, asset: data, design: spec })
    } catch (e) { res.status(400).json({ error: 'The design could not be rendered: ' + e.message }) }
  })

  // Soft delete. A post that already went out still references the image it was published
  // with, so the object stays in storage and only leaves the library.
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
