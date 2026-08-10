/**
 * Studio — the dealership's own marketing media (Phase 6 PR 6.6).
 *
 * `social_posts.media` is jsonb and will accept any URL at all. That is fine for a prototype
 * and wrong for a product: nobody can find last month's photo again, nothing ties an image to
 * the vehicle it shows, and a post can point at a URL that stops resolving next week.
 *
 * This is deliberately a library, not an editor. Creative tooling — templates, overlays, the
 * background swap that already exists for vehicle photos — can be built on top of a place
 * where assets live. It cannot be built on a text box full of links.
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
