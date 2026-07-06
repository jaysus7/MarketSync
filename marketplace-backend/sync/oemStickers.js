// ─────────────────────────────────────────────────────────────────────────
// Auto-pull OEM window stickers after a sync/pull. Only fetches AUTHENTIC
// factory stickers (Ford/Lincoln, GM, Stellantis) — it never generates one.
// Vehicles whose brand has no public sticker are simply left for on-demand
// generation. Gated on the VIN Sticker add-on; incremental + capped so it's
// light on the 512MB tier.
// ─────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from '../shared.js'
import { fetchOemWindowStickerPdf } from '../utils/oemWindowSticker.js'

export async function autoFetchOemStickers(dealershipId, { max = 60 } = {}) {
  if (!dealershipId) return { fetched: 0 }
  try {
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('vin_sticker_active').eq('id', dealershipId).maybeSingle()
    if (!dealer?.vin_sticker_active) return { fetched: 0 }

    const { data: rows } = await supabaseAdmin
      .from('inventory')
      .select('id, vin, make, window_sticker_url')
      .eq('dealership_id', dealershipId)
      .eq('status', 'available')
      .is('window_sticker_url', null)
      .limit(max)

    let fetched = 0
    for (const v of rows || []) {
      if (!v.vin) continue
      try {
        const oem = await fetchOemWindowStickerPdf(v)
        if (!oem) continue
        const path = `${dealershipId}/${v.id}/window-sticker.pdf`
        const { error } = await supabaseAdmin.storage.from('vehicle-pdfs')
          .upload(path, oem.buffer, { contentType: 'application/pdf', upsert: true })
        if (error) continue
        const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-pdfs').getPublicUrl(path)
        await supabaseAdmin.from('inventory')
          .update({ window_sticker_url: publicUrl, window_sticker_source: 'oem' })
          .eq('id', v.id)
        fetched++
      } catch { /* skip a brand with no public sticker */ }
    }
    if (fetched) console.log(`[oem-stickers] dealership ${dealershipId}: pulled ${fetched} factory stickers`)
    return { fetched }
  } catch (e) {
    console.warn('[oem-stickers] batch failed (non-fatal):', e.message)
    return { fetched: 0 }
  }
}
