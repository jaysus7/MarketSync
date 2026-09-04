import { supabaseAdmin } from '../shared.js'

export function selectSiteInventory(rows, mode = 'auto') {
  const all = Array.isArray(rows) ? rows : []
  const isMarketplace = v => ['marketplace', 'marketplace_feed'].includes(String(v.source || '').toLowerCase())
  const marketplace = all.filter(isMarketplace)
  const dealer = all.filter(v => !isMarketplace(v))
  if (mode === 'marketplace') return marketplace.length ? marketplace : all
  if (mode === 'dealer') return dealer.length ? dealer : all
  if (mode === 'merged') return all
  return dealer.length ? dealer : (marketplace.length ? marketplace : all)
}

export async function loadPublicInventory(dealershipId) {
  const cols = 'id, year, make, model, trim, price, mileage, condition, exterior_color, interior_color, drivetrain, fuel_type, transmission, engine, body_style, doors, stocknumber, vin, image_urls, description, carfax_url, window_sticker_url, brochure_url, recalls, vin_data, sales_pitch, specs_manual, status, source, created_at'
  let q = await supabaseAdmin.from('inventory').select(cols).eq('dealership_id', dealershipId).is('archived_at', null).order('created_at', { ascending: false }).limit(600)
  if (q.error || !(q.data || []).length) {
    q = await supabaseAdmin.from('inventory').select(cols).eq('dealership_id', dealershipId).order('created_at', { ascending: false }).limit(600)
  }
  const hide = new Set(['sold', 'delivered', 'archived'])
  return (q.data || []).filter(v => !hide.has(String(v.status || '').toLowerCase()))
}
