// Centralized audit log — SOC 2 Type II evidence trail.
//
// Every privileged action (auth events, role changes, data mutations by admins,
// billing changes, team management) is appended here. Rows are immutable once
// written (no UPDATE/DELETE on audit_log). The table also has an RLS policy that
// allows only the service role to insert, preventing tampering from the app layer.
//
// Usage:
//   import { audit } from '../audit.js'
//   await audit(req, 'user.login', { method: 'password' })
//
// The helper is fire-and-forget safe: failures are logged but never throw — an
// audit failure must never break the underlying operation.

import { supabaseAdmin } from './shared.js'
import { getClientIp } from './security.js'

// Export routes accept the purpose in either query string (CSV downloads) or
// request body (POST exports). A missing legacy-client value is explicit in the
// audit trail rather than silently looking like it was provided.
export function exportReason(req) {
  const value = req?.query?.reason ?? req?.body?.reason ?? ''
  return String(value).trim().slice(0, 300) || 'not_provided'
}

export async function audit(req, action, meta = {}) {
  try {
    const { before_state = null, after_state = null, ...metadata } = meta || {}
    const entry = {
      action,
      actor_id: req?.user?.id || null,
      actor_email: req?.user?.email || null,
      dealership_id: req?.dealershipId || null,
      ip: req ? getClientIp(req) : null,
      user_agent: req?.headers?.['user-agent']?.slice(0, 500) || null,
      meta: Object.keys(meta || {}).length ? meta : null,
      created_at: new Date().toISOString()
    }
    // Keep the existing application audit log, and mirror it into the immutable
    // security-event record required for incident investigation. `before_state`
    // and `after_state` are optional and intentionally separated from metadata.
    const securityEvent = {
      event_type: action,
      user_id: entry.actor_id,
      dealership_id: entry.dealership_id,
      ip: entry.ip,
      user_agent: entry.user_agent,
      metadata: Object.keys(metadata).length ? metadata : null,
      before_state,
      after_state,
      created_at: entry.created_at,
    }
    const [auditResult, securityResult] = await Promise.all([
      supabaseAdmin.from('audit_log').insert(entry),
      supabaseAdmin.from('security_events').insert(securityEvent),
    ])
    if (auditResult.error) console.warn('[audit] insert failed:', auditResult.error.message, '— action:', action)
    if (securityResult.error) console.warn('[security-events] insert failed:', securityResult.error.message, '— action:', action)
  } catch (e) {
    console.warn('[audit] unexpected error:', e.message, '— action:', action)
  }
}

// Well-known action constants — use these instead of raw strings so grepping for
// audit events is reliable and typos are caught at import time.
export const AuditAction = Object.freeze({
  // Auth
  USER_LOGIN:             'user.login',
  USER_LOGIN_FAILED:      'user.login_failed',
  USER_LOGOUT:            'user.logout',
  USER_REGISTER:          'user.register',
  PASSWORD_RESET_REQUEST: 'user.password_reset_request',
  PASSWORD_RESET_DONE:    'user.password_reset_done',
  PASSWORD_CHANGED:       'user.password_changed',
  MFA_ENROLLED:           'user.mfa_enrolled',
  MFA_DISABLED:           'user.mfa_disabled',
  MFA_RECOVERY_CODES_REGENERATED: 'user.mfa_recovery_codes_regenerated',
  MFA_CHALLENGE_PASSED:   'user.mfa_challenge_passed',
  MFA_CHALLENGE_FAILED:   'user.mfa_challenge_failed',
  PASSKEY_REGISTERED:     'user.passkey_registered',
  PASSKEY_DELETED:        'user.passkey_deleted',
  SESSIONS_REVOKED:       'user.sessions_revoked',

  // Team management (admin actions)
  TEAM_MEMBER_INVITED:    'team.member_invited',
  TEAM_MEMBER_REMOVED:    'team.member_removed',
  TEAM_MEMBER_PROFILE_UPDATED: 'team.member_profile_updated',
  TEAM_MEMBER_PASSWORD_RESET: 'team.member_password_reset',
  TEAM_MEMBER_TEAM_UPDATED: 'team.member_team_updated',
  PERMISSION_CHANGED:     'permission.changed',

  // Profile
  PROFILE_UPDATED:        'profile.updated',
  AVATAR_UPLOADED:        'profile.avatar_uploaded',

  // Billing
  SUBSCRIPTION_CREATED:   'billing.subscription_created',
  SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',
  SUBSCRIPTION_UPDATED:   'billing.subscription_updated',

  // Inventory / listings
  INVENTORY_SYNC:         'inventory.sync',
  LISTING_CREATED:        'listing.created',
  LISTING_SOLD:           'listing.sold',
  LISTING_DELETED:        'listing.deleted',

  // E-signature
  ESIGN_SENT:             'esign.sent',

  // Deal-cost visibility & AI/config changes (sensitive dealership settings)
  CONFIG_UPDATED:         'config.updated',
  COST_VISIBILITY_CHANGED:'config.cost_visibility_changed',

  // Data exports (who pulled the customer/inventory book)
  LEADS_EXPORTED:         'leads.exported',
  INVENTORY_EXPORTED:     'inventory.exported',
  EXPENSES_EXPORTED:      'expenses.exported',
  CREDIT_APPLICATION_EXPORTED: 'credit_application.exported',
  NEWSLETTER_EXPORTED:    'newsletter.exported',

  // Admin / system
  ADMIN_DATA_EXPORT:      'admin.data_export',
  API_KEY_CREATED:        'api_key.created',
  API_KEY_REVOKED:        'api_key.revoked',
})
