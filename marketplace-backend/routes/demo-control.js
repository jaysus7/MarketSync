/**
 * Demo Control Center — lets the ONE dedicated demo login switch which package it
 * subscribes to, which role it's acting as, which scenario is loaded, and toggle
 * presentation mode, all without logging out.
 *
 * Every write here goes through the SAME mechanisms a real account change would use
 * (provisionPlan() for packages, a user_roles row for roles) — there is no separate
 * "demo permission" system. Authorization is tenant-only: ownDedicatedDemoAccount()
 * requires the caller's OWN dealership (server-derived from their session, never
 * client-supplied) to be the flagged demo dealership. There is deliberately no
 * additional role/admin check on top of that — the demo login can switch itself into a
 * non-admin role (Salesperson, Technician, ...) to preview that role's view, and must
 * still be able to reach these controls afterward to switch back. Tenant scoping alone
 * is what the security requirement asks for; stacking an admin-role gate on top would
 * lock the operator out of their own demo mid-presentation.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { audit } from '../audit.js'
import { getPlan } from '../plan-catalog.js'
import { provisionPlan } from '../entitlements.js'
import { getConfig, setConfig } from './config-engine.js'
import { ownDedicatedDemoAccount, seedAccount } from './demo.js'
import { wipeAcademyDemoData } from '../academy-demo-data.js'

const CONTROL_KEY = 'demo_control'

// The current, real, publicly-sold catalog (marketplace-frontend/js/public-config.js) —
// the Product Switcher's options. Every id here resolves through getPlan() AND through
// the DB plans/plan_products tables (see migrations/2026-08-17-current-catalog-db-plans.sql).
const DEMO_PACKAGES = [
  'design-studio', 'autoposter-salesperson', 'social-scheduler', 'autoposter-dealer',
  'video', 'campaigns-email-sms', 'dealer-website', 'ai-chatbot',
  'sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite', 'marketsync-digital',
  'dealer-os-core', 'dealer-os-pro', 'dealer-os-complete',
]

// Demo role -> real RBAC role_id (public.roles) + the profiles.role/account_role pairing
// that matches how this app actually provisions real accounts today (verified against
// live data: profiles.role is ONLY EVER 'DEALER_ADMIN' or 'SALES_REP' — fine-grained
// access comes entirely from user_roles -> role_permissions, not from profiles.role).
// dealer_owner and general_manager are the two roles real accounts pair with the
// implicit "DEALER_ADMIN = every permission" bypass in authorization.js's
// permissionLookup(); every other role here is governed purely by role_permissions for
// its role_id, same as a real account with that role.
//
// service_advisor / parts / marketing are APPROXIMATED onto the closest existing role_id
// (roles table has no dedicated row for them) — flagged with approximated:true. Those
// three will show identical access to their nearest neighbor, not a distinct narrower
// view. Giving them their own realistic view needs new roles + role_permissions rows,
// which is a real RBAC change outside the scope of the demo layer.
const DEMO_ROLES = {
  dealer_principal: { roleId: 'dealer_owner', label: 'Dealer Principal', profileRole: 'DEALER_ADMIN', accountRole: 'dealer_admin' },
  general_manager: { roleId: 'general_manager', label: 'General Manager', profileRole: 'DEALER_ADMIN', accountRole: 'dealer_admin' },
  sales_manager: { roleId: 'sales_manager', label: 'Sales Manager', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  salesperson: { roleId: 'salesperson', label: 'Salesperson', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  bdc: { roleId: 'bdc', label: 'BDC', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  fni: { roleId: 'fni_manager', label: 'F&I', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  service_manager: { roleId: 'service_manager', label: 'Service Manager', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  service_advisor: { roleId: 'service_manager', label: 'Service Advisor', profileRole: 'SALES_REP', accountRole: 'sales_rep', approximated: true },
  technician: { roleId: 'technician', label: 'Technician', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  parts: { roleId: 'technician', label: 'Parts', profileRole: 'SALES_REP', accountRole: 'sales_rep', approximated: true },
  marketing: { roleId: 'sales_manager', label: 'Marketing', profileRole: 'SALES_REP', accountRole: 'sales_rep', approximated: true },
  accounting: { roleId: 'accounting', label: 'Accounting / Admin', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
}

// Scenario data generation is Phase 3 (not yet built) — for now the scenario selection
// is recorded but does not yet change what's seeded. See dealer_config['demo_control'].
const DEMO_SCENARIOS = ['healthy', 'needs_attention', 'busy_sales_day', 'service_department', 'marketing_demo', 'dealer_principal']

const DEFAULT_STATE = { packageId: 'dealer-os-complete', roleKey: 'dealer_principal', scenario: 'healthy', presentationMode: false }

async function requireDemoAccount(req, res, next) {
  const dealership = await ownDedicatedDemoAccount(req)
  if (!dealership) return res.status(403).json({ error: 'Not a dedicated demo account.' })
  req._demoDealership = dealership
  next()
}

export function registerDemoControl(app) {
  app.get('/demo/control', requireAuth, requireDemoAccount, async (req, res) => {
    const state = await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)
    res.json({
      dealership: { id: req._demoDealership.id, name: req._demoDealership.name },
      state,
      packages: DEMO_PACKAGES.map(id => ({ id, label: getPlan(id)?.label, monthly: getPlan(id)?.monthly })),
      roles: Object.entries(DEMO_ROLES).map(([key, r]) => ({ key, label: r.label, approximated: !!r.approximated })),
      scenarios: DEMO_SCENARIOS,
    })
  })

  // Product Switcher — provisions the real plan onto the demo dealership via the same
  // entitlement engine a real upgrade/downgrade uses. Every downstream nav/feature/
  // upgrade-prompt check reacts to this exactly as it would for a paying customer.
  app.put('/demo/control/package', requireAuth, requireDemoAccount, async (req, res) => {
    const packageId = String(req.body?.packageId || '')
    if (!DEMO_PACKAGES.includes(packageId)) return res.status(400).json({ error: 'Unknown package.' })
    try {
      await provisionPlan({ dealershipId: req.dealershipId, planId: packageId, status: 'active' })
      const state = { ...(await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)), packageId }
      await setConfig(req.dealershipId, CONTROL_KEY, state, req)
      audit(req, 'demo.control_package_switched', { demo_dealership_id: req.dealershipId, package: packageId })
      res.json({ ok: true, state })
    } catch (error) {
      console.error('[demo-control] package switch failed:', error.message)
      res.status(500).json({ error: 'Could not switch package.' })
    }
  })

  // Role Switcher — writes the SAME user_roles row a real role assignment would (delete +
  // insert, matching authorization.js's syncDealerRole), plus the profiles.role/account_role
  // pairing real accounts use. Postgres RLS (authz.has_permission) reads the identical
  // user_roles table, so this propagates correctly to both the app-layer RBAC check and
  // every RLS-protected table — no parallel authorization path.
  app.put('/demo/control/role', requireAuth, requireDemoAccount, async (req, res) => {
    const roleKey = String(req.body?.roleKey || '')
    const role = DEMO_ROLES[roleKey]
    if (!role) return res.status(400).json({ error: 'Unknown role.' })
    try {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', req.user.id).eq('dealership_id', req.dealershipId)
      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
        user_id: req.user.id, dealership_id: req.dealershipId, role_id: role.roleId, assigned_by: req.user.id,
      })
      if (roleError) throw roleError
      const { error: profileError } = await supabaseAdmin.from('profiles')
        .update({ role: role.profileRole, account_role: role.accountRole }).eq('id', req.user.id)
      if (profileError) throw profileError
      const state = { ...(await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)), roleKey }
      await setConfig(req.dealershipId, CONTROL_KEY, state, req)
      audit(req, 'demo.control_role_switched', { demo_dealership_id: req.dealershipId, role: roleKey })
      res.json({ ok: true, state })
    } catch (error) {
      console.error('[demo-control] role switch failed:', error.message)
      res.status(500).json({ error: 'Could not switch role.' })
    }
  })

  app.put('/demo/control/scenario', requireAuth, requireDemoAccount, async (req, res) => {
    const scenario = String(req.body?.scenario || '')
    if (!DEMO_SCENARIOS.includes(scenario)) return res.status(400).json({ error: 'Unknown scenario.' })
    const state = { ...(await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)), scenario }
    await setConfig(req.dealershipId, CONTROL_KEY, state, req)
    audit(req, 'demo.control_scenario_set', { demo_dealership_id: req.dealershipId, scenario })
    res.json({ ok: true, state })
  })

  app.put('/demo/control/presentation', requireAuth, requireDemoAccount, async (req, res) => {
    const presentationMode = !!req.body?.presentationMode
    const state = { ...(await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)), presentationMode }
    await setConfig(req.dealershipId, CONTROL_KEY, state, req)
    res.json({ ok: true, state })
  })

  // Reset — same underlying wipe+reseed as /demo/reset (routes/demo.js), but tenant-only
  // gated (see requireDemoAccount above) so it can never lock the operator out after a
  // role switch. Restores the control state to its defaults too.
  app.post('/demo/control/reset', requireAuth, requireDemoAccount, async (req, res) => {
    try {
      await wipeAcademyDemoData(supabaseAdmin, req.dealershipId)
      const summary = await seedAccount({ dealership: req._demoDealership, ownerId: req.user.id, force: true })
      await setConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE, req)
      audit(req, 'demo.control_reset', { demo_dealership_id: req.dealershipId, summary })
      res.json({ ok: true, state: DEFAULT_STATE, summary })
    } catch (error) {
      console.error('[demo-control] reset failed:', error.message)
      res.status(500).json({ error: 'Could not reset the demo.' })
    }
  })
}
