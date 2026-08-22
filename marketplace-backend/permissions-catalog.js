/**
 * The permission vocabulary, as it exists in the database.
 *
 * WHY THIS FILE EXISTS: `requirePermission('x')` for an `x` that is not in the permissions
 * table does not fail loudly — it denies EVERYONE, silently, forever. During Phase 6 that
 * happened twice: `marketing.*` did not exist, and `crm.*` never has (the customer
 * vocabulary is `customer.view` / `customer.edit`). Both would have shipped a department
 * nobody could open, and neither test nor gate would have said a word.
 *
 * `test/permission-vocabulary.test.js` asserts that every permission named anywhere in
 * routes/ appears here, so inventing one is caught in CI rather than in a dealership.
 *
 * KEEPING IT TRUE: when a migration adds a permission, add it here in the same commit. This
 * list is the repo's copy of the vocabulary, not a second source of truth — the database
 * remains authoritative, and the catalog exists so code can be checked against it offline.
 * CI has no database, which is exactly why the check needs a checked-in list.
 */
export const PERMISSIONS = [
  'accounting.edit',
  'accounting.view',
  'api_keys.manage',
  'audit.export',
  'audit.view',
  'billing.manage',
  'customer.edit',
  'customer.export',
  'customer.view',
  'deal.approve',
  'deal.create',
  'deal.finalize',
  'deal.reverse',
  'equity.manage',
  'equity.view',
  'expense.approve',
  'fni.credit_application.edit',
  'fni.credit_application.view',
  'identity.override',
  'identity.request',
  'identity.review',
  'identity.view',
  'integrations.manage',
  'inventory.delete',
  'inventory.edit',
  'inventory.view',
  'lead.assign',
  'lead.create',
  'marketing.approve',
  'marketing.edit',
  'marketing.publish',
  'marketing.view',
  'platform.manage',
  'recon.view',
  'safety.manage',
  'safety.view',
  'service.close_repair_order',
  'service.manage_workflow',
  'service.reopen_repair_order',
  'service.view',
  'service.write_repair_order',
  'settings.manage',
  'site.manage',
  'staff.assets.manage',
  'staff.assets.view',
  'staff.compensation.view',
  'staff.compliance.manage',
  'staff.compliance.view',
  'staff.documents.self',
  'staff.leave.self',
  'staff.lifecycle.manage',
  'staff.manage',
  'staff.payroll.export',
  'staff.payroll.manage',
  'staff.payroll.view',
  'staff.policy.manage',
  'staff.policy.view',
  'staff.time.approve',
  'staff.time.self',
  'staff.training.manage',
  'staff.training.self',
  'staff.training.view',
  'staff.view',
  'users.manage',
]

export const PERMISSION_SET = new Set(PERMISSIONS)
export const isKnownPermission = (id) => PERMISSION_SET.has(String(id || ''))
