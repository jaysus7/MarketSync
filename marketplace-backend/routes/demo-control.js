/**
 * Demo Control Center — lets the ONE dedicated demo login switch which package it
 * subscribes to, which role it's acting as, and toggle presentation mode, all without
 * logging out.
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

// The dealer_group the demo dealership was attached to, purely so the "Group Admin"
// demo role has a real group to render (routes/groups.js's overview composes one card
// per store in profile.group_id — an admin with no group would just see an empty
// rollup). See migrations/history: 'MarketSync Demo Group', one store attached.
const DEMO_GROUP_ID = 'a0000000-0000-4000-a000-0000000000d3'

// Demo role -> real RBAC role_id (public.roles) + the profiles.role/account_role pairing
// that matches how this app actually provisions real accounts today. profiles.role is
// ONLY EVER 'DEALER_ADMIN', 'SALES_REP', or 'DEALER_GROUP' in real data — fine-grained
// access comes entirely from user_roles -> role_permissions, not from profiles.role.
// accountRole: 'dealer_admin' is what grants the implicit "every dealership permission"
// bypass in authorization.js's permissionLookup() (it checks account_role, not role), so
// group_admin and dealer_admin both get full access; group_admin's profileRole of
// 'DEALER_GROUP' additionally satisfies isGroupAdmin() in routes/groups.js for the
// cross-dealership group rollup.
//
// `independent` is the Facebook-only persona: switching to it also provisions the
// autoposter-salesperson plan (product: 'facebook' only — see plan-catalog.js), so the
// nav actually narrows to just Facebook + the leaderboard instead of only relabeling
// the role while leaving the full bundle's nav in place.
const DEMO_ROLES = {
  group_admin: { roleId: 'dealer_owner', label: 'Group Admin', profileRole: 'DEALER_GROUP', accountRole: 'dealer_admin', groupId: DEMO_GROUP_ID },
  dealer_admin: { roleId: 'dealer_owner', label: 'Dealer Admin', profileRole: 'DEALER_ADMIN', accountRole: 'dealer_admin' },
  sales_role: { roleId: 'salesperson', label: 'Sales Role', profileRole: 'SALES_REP', accountRole: 'sales_rep' },
  independent: { roleId: 'salesperson', label: 'Independent (Facebook only)', profileRole: 'SALES_REP', accountRole: 'sales_rep', packageId: 'autoposter-salesperson' },
}

const DEFAULT_STATE = { packageId: 'dealer-os-complete', roleKey: 'dealer_admin', presentationMode: false }

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
        .update({ role: role.profileRole, account_role: role.accountRole, group_id: role.groupId || null }).eq('id', req.user.id)
      if (profileError) throw profileError
      let state = { ...(await getConfig(req.dealershipId, CONTROL_KEY, DEFAULT_STATE)), roleKey }
      if (role.packageId) {
        await provisionPlan({ dealershipId: req.dealershipId, planId: role.packageId, status: 'active' })
        state = { ...state, packageId: role.packageId }
      }
      await setConfig(req.dealershipId, CONTROL_KEY, state, req)
      audit(req, 'demo.control_role_switched', { demo_dealership_id: req.dealershipId, role: roleKey })
      res.json({ ok: true, state })
    } catch (error) {
      console.error('[demo-control] role switch failed:', error.message)
      res.status(500).json({ error: 'Could not switch role.' })
    }
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
