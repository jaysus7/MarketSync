import { supabaseAdmin } from '../shared.js'

const ageDays = value => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : null
const vehicleName = row => [row.year, row.make, row.model, row.trim].filter(Boolean).join(' ') || row.stocknumber || 'Vehicle'

export async function serviceAttention(dealershipId) {
  const [{ data: ros, error: roError }, { data: requests, error: requestError }] = await Promise.all([
    supabaseAdmin.from('repair_orders').select('*').eq('dealership_id', dealershipId).neq('status', 'closed').limit(250),
    supabaseAdmin.from('part_requests').select('*').eq('dealership_id', dealershipId).in('status', ['requested', 'backordered']).limit(250),
  ])
  if (roError) throw roError
  if (requestError) throw requestError
  return serviceAttentionItems(ros || [], requests || [])
}

export function serviceAttentionItems(ros, requests) {
  const blocked = new Set(requests.map(row => row.ro_id || row.repair_order_id).filter(Boolean))
  return ros.flatMap(ro => {
    const subject = ro.ro_number || `Repair order ${ro.id.slice(0, 8)}`
    if (blocked.has(ro.id)) return [{ kind: 'parts_blocker', severity: 3, subject, reason: 'Repair work is waiting for Parts', owner: 'Service', action: 'Review parts blocker', ref: ro.id, age_days: ageDays(ro.updated_at), deep_link: '#/w/service/service-overview' }]
    if (ro.status === 'estimate_sent') return [{ kind: 'authorization_required', severity: 2, subject, reason: 'Customer authorization is still outstanding', owner: 'Service', action: 'Follow up for authorization', ref: ro.id, age_days: ageDays(ro.updated_at), deep_link: '#/w/service/service-overview' }]
    if (ro.status === 'ready') return [{ kind: 'vehicle_ready', severity: 2, subject, reason: 'Vehicle is ready for customer collection', owner: 'Service', action: 'Notify customer', ref: ro.id, age_days: ageDays(ro.ready_at || ro.updated_at), deep_link: '#/w/service/service-overview' }]
    return []
  })
}

export async function partsAttention(dealershipId) {
  const { data, error } = await supabaseAdmin.from('part_requests').select('*')
    .eq('dealership_id', dealershipId).in('status', ['requested', 'backordered', 'reserved']).limit(250)
  if (error) throw error
  return partsAttentionItems(data || [])
}

export function partsAttentionItems(rows) {
  return rows.map(row => ({
    kind: row.status === 'backordered' ? 'parts_shortage' : row.status === 'reserved' ? 'parts_ready_to_issue' : 'parts_request',
    severity: row.status === 'backordered' ? 3 : 2,
    subject: row.part_number || row.description || 'Parts request',
    reason: row.status === 'backordered' ? 'The shop is waiting on unavailable parts' : row.status === 'reserved' ? 'Reserved parts are ready to issue' : 'A repair order needs Parts review',
    owner: 'Parts', action: row.status === 'reserved' ? 'Issue parts' : 'Review request', ref: row.id,
    age_days: ageDays(row.requested_at || row.created_at), deep_link: '#/w/parts/parts-overview',
  }))
}

export async function inventoryAttention(dealershipId) {
  const { data, error } = await supabaseAdmin.from('inventory').select('*')
    .eq('dealership_id', dealershipId).is('archived_at', null).neq('status', 'sold').limit(500)
  if (error) throw error
  return inventoryAttentionItems(data || [])
}

export function inventoryAttentionItems(rows) {
  return rows.flatMap(row => {
    const gaps = []
    if (!(Number(row.price) > 0)) gaps.push('price')
    if (!((row.image_urls || []).length || row.image_url)) gaps.push('photos')
    if (!row.stocknumber) gaps.push('stock number')
    if (!gaps.length) return []
    return [{ kind: 'frontline_not_ready', severity: 2, subject: vehicleName(row), reason: `Missing ${gaps.join(', ')}`, owner: 'Inventory', action: 'Complete merchandising', ref: row.id, age_days: ageDays(row.lot_date || row.created_at), deep_link: '#/w/inventory/inventory-overview' }]
  })
}

export async function fniAttention(dealershipId) {
  const { data, error } = await supabaseAdmin.from('deals').select('*')
    .eq('dealership_id', dealershipId).in('deal_status', ['pending', 'fni', 'delivered']).limit(250)
  if (error) throw error
  return fniAttentionItems(data || [])
}

export function fniAttentionItems(rows) {
  return rows.flatMap(row => {
    const subject = row.buyer_name || row.customer_name || `Deal ${row.id.slice(0, 8)}`
    if (row.deal_status === 'pending') return [{ kind: 'deal_approval', severity: 2, subject, reason: 'Deal is waiting for approval', owner: 'F&I', action: 'Review deal', ref: row.id, age_days: ageDays(row.updated_at), deep_link: '#/w/fni/fni-overview' }]
    if (row.deal_status === 'delivered' && row.funding_status && row.funding_status !== 'funded') return [{ kind: 'funding_outstanding', severity: ageDays(row.delivered_at) >= 3 ? 3 : 2, subject, reason: 'Delivered deal has not been funded', owner: 'F&I', action: 'Resolve funding', ref: row.id, age_days: ageDays(row.delivered_at), deep_link: '#/w/fni/fni-overview' }]
    if (row.deal_status === 'fni') return [{ kind: 'fni_work_required', severity: 2, subject, reason: 'Deal is waiting in F&I', owner: 'F&I', action: 'Continue deal', ref: row.id, age_days: ageDays(row.updated_at), deep_link: '#/w/fni/fni-overview' }]
    return []
  })
}
