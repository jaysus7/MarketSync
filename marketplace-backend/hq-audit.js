/**
 * MarketSync HQ — Centralized Audit Logging Service.
 *
 * Provides immutable audit logging for corporate operational actions:
 * - Financial postings & reversals
 * - Expense approvals & voids
 * - Receipt uploads & review status transitions
 * - Customer merges & deduplication
 * - Opportunity stage changes
 * - Website content publishing & section mutations
 * - Render deployments & verification outcomes
 * - Sensitive administrative & security actions
 */
import { supabaseAdmin } from './shared.js'

export async function logHqAudit({
  entityType,
  entityId,
  action,
  beforeState = null,
  afterState = null,
  actorId = null,
  actorName = 'System',
  reason = null,
  metadata = {},
  ipAddress = null,
}) {
  try {
    const payload = {
      entity_type: String(entityType || 'unknown').slice(0, 80),
      entity_id: String(entityId || 'none').slice(0, 120),
      action: String(action || 'unknown').slice(0, 80),
      before_state: beforeState && typeof beforeState === 'object' ? beforeState : null,
      after_state: afterState && typeof afterState === 'object' ? afterState : null,
      actor_id: actorId || null,
      actor_name: String(actorName || 'System').slice(0, 160),
      reason: reason ? String(reason).slice(0, 500) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      ip_address: ipAddress ? String(ipAddress).slice(0, 60) : null,
    }

    const { data, error } = await supabaseAdmin.from('hq_audit_log').insert(payload).select('id').maybeSingle()
    if (error) {
      console.warn('[hq-audit] Failed to write audit log entry:', error.message)
      return null
    }
    return data?.id || null
  } catch (err) {
    console.warn('[hq-audit] Unexpected error in logHqAudit:', err.message)
    return null
  }
}

export async function getHqAuditLogs({ entityType = null, entityId = null, action = null, limit = 50, offset = 0 } = {}) {
  try {
    let query = supabaseAdmin
      .from('hq_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) query = query.eq('entity_type', entityType)
    if (entityId) query = query.eq('entity_id', entityId)
    if (action) query = query.eq('action', action)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('[hq-audit] getHqAuditLogs error:', err.message)
    return []
  }
}
