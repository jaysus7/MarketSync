/**
 * Seed / provision admin@marketsync.link as the dedicated demo-showcase login.
 *
 * admin@marketsync.link's own tenant is a dealership named "MarketSync Demo
 * Showcase" — the word "demo" is what routes/demo.js's isDedicatedDemoName()
 * checks, so logging in as admin@marketsync.link lands directly on the Demo
 * Control Center (package/role switcher) rather than a generic dashboard.
 * ("MarketSync Demo" itself is deliberately NOT used — routes/demo.js retires
 * that exact name via RETIRED_HQ_SANDBOXES, so a dealership with that literal
 * name is never treated as a valid demo tenant.)
 *
 * system_role stays 'platform_owner' regardless of which dealership this
 * account belongs to — shared.js's isSaasStaff() and every platform-owner
 * check (seed-all, the MarketSync HQ / saas-command workspace, etc.) reads
 * profiles.system_role, not the dealership_id or its name, so admin@ keeps
 * full platform-staff access on top of being the demo switcher.
 *
 * Safe to run repeatedly: updates password if the user exists, ensures the
 * "MarketSync Demo Showcase" dealership, and upserts the profile. Does not
 * touch sales@marketsync.link / "JMS Automotive" (scripts/seed-jms.js) — that
 * stays MarketSync's own real internal CRM workspace, on purpose never named
 * with "demo" so it's exempt from every demo-control route.
 *
 * After running, log in as admin@marketsync.link and open the Demo Control
 * Center to pick a starting package (this is what actually provisions real
 * entitlements onto the dealership) and, if you want the standard sample
 * contacts/inventory/deals, use its Reset action.
 *
 * Usage:
 *   node scripts/seed-admin.js
 */
import { supabaseAdmin } from '../shared.js'

const EMAIL = 'admin@marketsync.link'
const PASSWORD = process.env.ADMIN_PASSWORD || 'wellandChev1!'
const DEALER_NAME = 'MarketSync Demo Showcase'
const OWNER_NAME = 'MarketSync Admin'

const log = (...a) => console.log('[seed-admin]', ...a)

async function ensureUser() {
  for (let page = 1; page <= 5; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const hit = (data?.users || []).find(u => (u.email || '').toLowerCase() === EMAIL)
    if (hit) {
      log('user exists:', hit.id, '- updating password...')
      const { error } = await supabaseAdmin.auth.admin.updateUserById(hit.id, { password: PASSWORD, email_confirm: true })
      if (error) log('warning updating password:', error.message)
      return hit.id
    }
    if (!data || (data.users || []).length < 1000) break
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: OWNER_NAME },
  })
  if (error) throw error
  log('created admin user:', data.user.id)
  return data.user.id
}

async function ensureDealership() {
  const { data: found } = await supabaseAdmin.from('dealerships')
    .select('id').eq('name', DEALER_NAME).maybeSingle()
  if (found) { log('demo dealership exists:', found.id); return found.id }
  const { data, error } = await supabaseAdmin.from('dealerships').insert({
    name: DEALER_NAME,
    website_url: 'https://marketsync.link',
    billing_status: 'ACTIVE',
  }).select('id').single()
  if (error) throw error
  log('created demo dealership:', data.id)
  return data.id
}

async function ensureProfile(userId, dealershipId) {
  const profile = {
    id: userId,
    dealership_id: dealershipId,
    full_name: OWNER_NAME,
    role: 'DEALER_ADMIN',
    account_role: 'dealer_admin',
    price_tier: 'DEALER',
    system_role: 'platform_owner',
    saas_role: 'owner',
    active: true,
  }
  const { error } = await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' })
  if (error) throw error
  log('upserted profile for user:', userId)
}

async function main() {
  try {
    const userId = await ensureUser()
    const dealershipId = await ensureDealership()
    await ensureProfile(userId, dealershipId)
    log('Successfully provisioned the demo-showcase admin login:')
    log('  Email:', EMAIL)
    log('  Password:', PASSWORD)
    log('  Dealership:', DEALER_NAME, '(' + dealershipId + ')')
    log('Next: log in, open the Demo Control Center, and pick a starting package —')
    log('that provisions the real entitlements. Use its Reset action for sample data.')
  } catch (err) {
    console.error('Error seeding admin user:', err)
  }
}

main()
