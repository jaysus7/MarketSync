/**
 * MarketSync HQ — Centralized Authorization & Security Guard.
 *
 * All MarketSync HQ backend endpoints operate on corporate data (CRM, Website CMS,
 * Discovery Engine, General Ledger, Invoices, Receipts, Expenses, Staff Commissions).
 *
 * This middleware strictly enforces server-side authentication and platform authority:
 * - PLATFORM_OWNER: full unrestricted corporate authority
 * - PLATFORM_ADMIN: corporate operations authority
 */
import { hasSystemRole, SYSTEM_ROLES } from './authorization.js'

export function isHqUser(req) {
  if (!req.user || !req.profile) return false
  return (
    hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER, SYSTEM_ROLES.PLATFORM_ADMIN) ||
    req.profile.system_role === 'platform_owner' ||
    req.profile.system_role === 'platform_admin' ||
    req.profile.is_marketsync_owner === true
  )
}

export function isHqOwner(req) {
  if (!req.user || !req.profile) return false
  return (
    hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER) ||
    req.profile.system_role === 'platform_owner' ||
    req.profile.is_marketsync_owner === true
  )
}

export function requireHqAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (!isHqUser(req)) {
    return res.status(403).json({ error: 'MarketSync HQ platform access required' })
  }
  next()
}

export function requireHqOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (!isHqOwner(req)) {
    return res.status(403).json({ error: 'MarketSync HQ Owner authority required' })
  }
  next()
}

export function requireHqPermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if (isHqOwner(req)) return next()
    if (!isHqUser(req)) return res.status(403).json({ error: 'MarketSync HQ platform access required' })

    // Fine-grained permission checks for platform admins can be extended here
    next()
  }
}
