/**
 * Seed / provision the primary MarketSync HQ Admin account (admin@marketsync.link).
 *
 * Safe to run repeatedly: updates password if user exists, ensures MarketSync HQ
 * dealership, and upserts owner profile with full platform privileges.
 *
 * Usage:
 *   node scripts/seed-admin.js
 */
import { supabaseAdmin } from '../shared.js'

const EMAIL = 'admin@marketsync.link'
const PASSWORD = process.env.ADMIN_PASSWORD || 'wellandChev1!'
const HQ_NAME = 'MarketSync HQ'
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
    .select('id').eq('name', HQ_NAME).maybeSingle()
  if (found) { log('HQ dealership exists:', found.id); return found.id }
  const farFuture = new Date('2126-01-01T00:00:00.000Z').toISOString()
  const { data, error } = await supabaseAdmin.from('dealerships').insert({
    name: HQ_NAME,
    website_url: 'https://marketsync.link',
    billing_status: 'ACTIVE',
    full_access_until: farFuture,
    ai_boost_active: true,
    inv_intel_active: true,
  }).select('id').single()
  if (error) throw error
  log('created HQ dealership:', data.id)
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
  log('upserted HQ profile for user:', userId)
}

async function main() {
  try {
    const userId = await ensureUser()
    const dealershipId = await ensureDealership()
    await ensureProfile(userId, dealershipId)
    log('Successfully provisioned MarketSync HQ Admin login:')
    log('  Email:', EMAIL)
    log('  Password:', PASSWORD)
  } catch (err) {
    console.error('Error seeding admin user:', err)
  }
}

main()
