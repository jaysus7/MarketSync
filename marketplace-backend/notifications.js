/**
 * Shared helper for writing notifications into the notifications table.
 * Import this wherever an event should surface an in-app alert.
 */
import { supabaseAdmin } from './shared.js'

/**
 * Create one notification record.
 *
 * @param {object} opts
 * @param {string} opts.dealershipId
 * @param {string} opts.type        — 'missing_info' | 'aging' | 'price_drift' | 'new_arrival' | 'competitor' | 'billing' | 'weekly_report'
 * @param {string} opts.title       — short headline (≤ 80 chars)
 * @param {string} [opts.body]      — one-sentence detail
 * @param {string} [opts.linkPage]  — canonical dashboard page slug
 * @param {string} [opts.linkFilter] — stock number or filter string to pre-fill
 * @param {string} [opts.linkUrl]   — external URL to open in a new tab (e.g. a PDF)
 */
export const LEGACY_NOTIFICATION_PAGE_MAP = Object.freeze({
  'ai-boost': 'inventory-overview', 'ai-insights': 'command', insights: 'command',
  inventory: 'inventory-overview', fni: 'fni-overview', service: 'service-overview',
  'service-ros': 'service-overview', 'service-appointments': 'service-overview',
  parts: 'parts-overview', accounting: 'accounting-overview', marketing: 'marketing-overview',
  people: 'people-overview', hr: 'people-overview', crm: 'sales', leads: 'sales',
  appointments: 'sales', appraisal: 'inventory-overview', reports: 'command',
  operations: 'command', taskboard: 'command', settings: 'profile',
});

export function canonicalNotificationPage(page) {
  const key = String(page || '').trim();
  return LEGACY_NOTIFICATION_PAGE_MAP[key] || key || null;
}

export async function createNotification({ dealershipId, type, title, body, linkPage, linkFilter, linkUrl, targetUserId }) {
  if (!dealershipId) return
  try {
    await supabaseAdmin.from('notifications').insert({
      dealership_id: dealershipId,
      type,
      title,
      body: body || null,
      link_page: canonicalNotificationPage(linkPage),
      link_filter: linkFilter || null,
      link_url: linkUrl || null,
      target_user_id: targetUserId || null,
    })
  } catch (err) {
    console.error('[notifications] Failed to create notification:', err.message)
  }
}

/**
 * Bulk-insert multiple notifications for the same dealership.
 * Skips silently if rows is empty.
 */
export async function createNotifications(rows) {
  if (!rows?.length) return
  try {
    await supabaseAdmin.from('notifications').insert(rows.map(row => ({
      ...row,
      link_page: canonicalNotificationPage(row.link_page),
    })))
  } catch (err) {
    console.error('[notifications] Bulk insert failed:', err.message)
  }
}


/**
 * "Sold & delivered" alert. Raised when a deal reaches the delivered state, for the
 * salesperson who owns the deal and — when the car was live on Facebook Marketplace —
 * the rep who posted it. The browser extension polls these via GET /listings/fb-alerts
 * and raises a desktop notification, so a rep hears about it without watching the
 * dashboard. Best-effort: a notification failure must never fail the delivery itself.
 *
 * @param {object} opts
 * @param {string} opts.dealershipId
 * @param {object} opts.deal — needs { id, inventory_id, created_by, deal_number? }
 */
export async function notifyDealDelivered({ dealershipId, deal }) {
  if (!dealershipId || !deal) return
  try {
    let label = 'A vehicle'
    if (deal.inventory_id) {
      const { data: v } = await supabaseAdmin.from('inventory')
        .select('year, make, model, trim, stock_number')
        .eq('id', deal.inventory_id).eq('dealership_id', dealershipId).maybeSingle()
      if (v) {
        label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || label
        if (v.stock_number) label += ` (#${v.stock_number})`
      }
    }

    const recipients = new Set()
    if (deal.created_by) recipients.add(deal.created_by)
    if (deal.inventory_id) {
      const { data: listings } = await supabaseAdmin.from('listings')
        .select('posted_by').eq('inventory_id', deal.inventory_id).not('posted_by', 'is', null)
      for (const l of (listings || [])) if (l.posted_by) recipients.add(l.posted_by)
    }
    if (!recipients.size) return

    const dealRef = deal.deal_number ? ` on deal ${deal.deal_number}` : ''
    for (const targetUserId of recipients) {
      await createNotification({
        dealershipId,
        type: 'deal_delivered',
        targetUserId,
        linkPage: 'inventory',
        linkFilter: deal.inventory_id || null,
        title: 'Sold & delivered',
        body: `${label} is sold and has now been delivered to the customer${dealRef}.`,
      })
    }
  } catch (err) {
    console.warn('[notifications] delivered notification failed (non-fatal):', err.message)
  }
}
