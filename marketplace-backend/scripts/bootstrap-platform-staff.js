/**
 * Create the internal MarketSync workspace profiles after their Supabase Auth
 * accounts have been invited/created. This is intentionally limited to staging
 * and is idempotent: it never touches customer/dealer accounts.
 *
 * Required environment variables:
 *   PLATFORM_BOOTSTRAP_ENV=staging
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional (the defaults are the initial MarketSync team accounts):
 *   PLATFORM_OWNER_EMAIL=marketsynccanada@gmail.com
 *   PLATFORM_SALES_EMAIL=sales@marketsync.com
 */
import { supabaseAdmin } from '../shared.js'

const environment = process.env.PLATFORM_BOOTSTRAP_ENV
if (environment !== 'staging') {
  throw new Error('Refusing to provision platform staff: set PLATFORM_BOOTSTRAP_ENV=staging explicitly.')
}

const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL || 'marketsynccanada@gmail.com').trim().toLowerCase()
const salesEmail = (process.env.PLATFORM_SALES_EMAIL || 'sales@marketsync.com').trim().toLowerCase()
const HQ_NAME = 'MarketSync HQ'

const log = (...parts) => console.log('[bootstrap-platform-staff]', ...parts)

async function findAuthUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = (data?.users || []).find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user
    if ((data?.users || []).length < 1000) break
  }
  throw new Error(`No Supabase Auth user exists for ${email}. Create or invite that account first.`)
}

async function ensureHqDealership() {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('dealerships').select('id').eq('name', HQ_NAME).maybeSingle()
  if (findError) throw findError
  if (existing) return existing.id

  const { data, error } = await supabaseAdmin.from('dealerships').insert({
    name: HQ_NAME,
    website_url: 'https://marketsync.com',
    billing_status: 'ACTIVE',
    full_access_until: new Date('2126-01-01T00:00:00.000Z').toISOString(),
    ai_boost_active: true,
    inv_intel_active: true,
  }).select('id').single()
  if (error) throw error
  return data.id
}

async function ensureProfile({ user, dealershipId, fullName, legacyRole, accountRole, systemRole, saasRole, dealerRole }) {
  const profile = {
    id: user.id,
    dealership_id: dealershipId,
    full_name: fullName,
    role: legacyRole,
    account_role: accountRole,
    price_tier: 'DEALER',
    system_role: systemRole,
    saas_role: saasRole,
    active: true,
  }
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' })
  if (profileError) throw profileError

  const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
    user_id: user.id,
    dealership_id: dealershipId,
    role_id: dealerRole,
  }, { onConflict: 'user_id,role_id,dealership_id' })
  if (roleError) throw roleError
}

async function main() {
  const owner = await findAuthUser(ownerEmail)
  const dealershipId = await ensureHqDealership()

  await ensureProfile({
    user: owner, dealershipId, fullName: 'MarketSync HQ',
    legacyRole: 'OWNER', accountRole: 'dealer_admin',
    systemRole: 'platform_owner', saasRole: 'owner', dealerRole: 'dealer_owner',
  })
  log('provisioned staging platform owner:', ownerEmail)

  try {
    const sales = await findAuthUser(salesEmail)
    await ensureProfile({
      user: sales, dealershipId, fullName: 'MarketSync Sales',
      legacyRole: 'SALES_REP', accountRole: 'sales_rep',
      systemRole: 'platform_admin', saasRole: 'sales', dealerRole: 'salesperson',
    })
    log('provisioned staging platform sales:', salesEmail)
  } catch (error) {
    log(`sales account skipped: ${error.message || error}`)
  }

  log('noreply@marketsync.com is deliberately not a dashboard account; configure it as the Resend sender instead.')
}

main().catch((error) => {
  console.error('[bootstrap-platform-staff] failed:', error.message || error)
  process.exitCode = 1
})
