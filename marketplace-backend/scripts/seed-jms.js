/**
 * Seed the internal MarketSync workspace — "JMS Automotive" (sales@marketsync.link).
 *
 * This is a normal dealer account that MarketSync's own team uses to track dealer
 * leads — it piggybacks on the existing app (same tables/UI) and has NO connection
 * to real dealership customers. Each seeded "customer" is a dealership prospect and
 * each "deal" is a MarketSync package sale, so the founder can work leads in the CRM
 * and desk them like any other deal.
 *
 * Idempotent: safe to run repeatedly. It finds-or-creates the auth user, the
 * dealership, the owner profile, and each contact/deal (matched by email).
 *
 * Run from marketplace-backend/ with the service-role env loaded:
 *     node scripts/seed-jms.js
 * Optional: SEED_JMS_PASSWORD=... to set the login password (default below).
 */
import { supabaseAdmin } from '../shared.js'

const EMAIL = 'sales@marketsync.link'
const PASSWORD = process.env.SEED_JMS_PASSWORD || 'MarketSync!Demo2026'
const DEALER_NAME = 'JMS Automotive'
const OWNER_NAME = 'JMS Automotive — Sales'

const log = (...a) => console.log('[seed-jms]', ...a)

// ── 1. Auth user ────────────────────────────────────────────────────────────
async function ensureUser() {
  // listUsers is paginated; search a couple of pages for our email.
  for (let page = 1; page <= 5; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    const hit = (data?.users || []).find(u => (u.email || '').toLowerCase() === EMAIL)
    if (hit) { log('user exists:', hit.id); return hit.id }
    if (!data || (data.users || []).length < 1000) break
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: OWNER_NAME },
  })
  if (error) throw error
  log('created user:', data.user.id, '(password:', PASSWORD + ')')
  return data.user.id
}

// ── 2. Dealership ───────────────────────────────────────────────────────────
async function ensureDealership() {
  const { data: found } = await supabaseAdmin.from('dealerships')
    .select('id').eq('name', DEALER_NAME).maybeSingle()
  if (found) { log('dealership exists:', found.id); return found.id }
  const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin.from('dealerships').insert({
    name: DEALER_NAME,
    website_url: 'https://marketsync.link',
    billing_status: 'ACTIVE',
    full_access_until: farFuture,   // internal account: keep everything unlocked
    ai_boost_active: true,
    inv_intel_active: true,
  }).select().single()
  if (error) throw error
  log('created dealership:', data.id)
  return data.id
}

// ── 3. Owner profile ────────────────────────────────────────────────────────
async function ensureProfile(userId, dealershipId) {
  const { data: found } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (found) {
    await supabaseAdmin.from('profiles').update({ dealership_id: dealershipId }).eq('id', userId)
    log('profile exists (linked to dealership)')
    return
  }
  const { error } = await supabaseAdmin.from('profiles').insert({
    id: userId, dealership_id: dealershipId, full_name: OWNER_NAME,
    role: 'DEALER_ADMIN', account_role: 'dealer_admin', price_tier: 'DEALER',
    registration_id: 'MS-001',
  })
  if (error) throw error
  log('created owner profile')
}

// ── 4. Customers (dealership prospects) + 5. Deals (MarketSync packages) ──────
// status: uncontacted | contacted | appointment | sold | fni | turnover | delivered | followup | lost
// deal_status: working | pending_credit | cash | sold | delivered
const RECORDS = [
  { first: 'Rob',    last: 'Mensah',  email: 'rob@northgateauto.example',    phone: '(416) 555-0142',
    company: 'Northgate Auto Group', source: 'MarketSync website', status: 'appointment',
    note: 'Demo booked. 140-unit rooftop, wants website + inventory intelligence.',
    pkg: 'Growth', price: 6588, deal_status: 'working', num: 1000 },
  { first: 'Lisa',   last: 'Tran',    email: 'lisa@summitmotors.example',    phone: '(604) 555-0173',
    company: 'Summit Motors', source: 'Referral', status: 'contacted',
    note: 'Independent used lot. Comparing us vs vAuto. Sent pricing.',
    pkg: 'Starter', price: 3588, deal_status: 'pending_credit', num: 1001 },
  { first: 'Darnell',last: 'Price',   email: 'darnell@coastlinecars.example',phone: '(902) 555-0119',
    company: 'Coastline Cars', source: 'Facebook Marketplace', status: 'appointment',
    note: 'Second demo scheduled. Interested in Facebook auto-poster + CRM.',
    pkg: 'Pro', price: 9588, deal_status: 'working', num: 1002 },
  { first: 'Priya',  last: 'Kapoor',  email: 'priya@meadowridgeauto.example',phone: '(780) 555-0188',
    company: 'Meadow Ridge Auto', source: 'MarketSync website', status: 'sold',
    note: 'Signed! Onboarding in progress — Growth package, 3 seats.',
    pkg: 'Growth', price: 6588, deal_status: 'sold', num: 1003 },
  { first: 'Frank',  last: 'Bianchi', email: 'frank@bianchiusedcars.example',phone: '(514) 555-0164',
    company: 'Bianchi Used Cars', source: 'Trade show', status: 'uncontacted',
    note: 'New lead from AutoShow. Small lot, price-sensitive — start with Starter.',
    pkg: 'Starter', price: 3588, deal_status: 'working', num: 1004 },
]

async function ensureContactAndDeal(dealershipId, ownerId, r) {
  // Contact (match by email within dealership)
  let { data: contact } = await supabaseAdmin.from('contacts')
    .select('id').eq('dealership_id', dealershipId).ilike('email', r.email).maybeSingle()
  if (!contact) {
    const { data, error } = await supabaseAdmin.from('contacts').insert({
      dealership_id: dealershipId,
      full_name: `${r.first} ${r.last}`,
      first_name: r.first, last_name: r.last,
      email: r.email, phone: r.phone, phone_mobile: r.phone,
      source: r.source, status: r.status,
      notes: `${r.company} · ${r.note}`,
      consent_email: false,
      customer_number: r.num,
      interest_vehicle: { package: r.pkg, company: r.company },
    }).select('id').single()
    if (error) throw error
    contact = data
    log('created contact:', r.first, r.last, `(${r.company})`)
  } else {
    log('contact exists:', r.email)
  }
  // Deal (one per contact — matched by contact_id)
  const { data: deal } = await supabaseAdmin.from('deals')
    .select('id').eq('dealership_id', dealershipId).eq('contact_id', contact.id).maybeSingle()
  if (!deal) {
    const { error } = await supabaseAdmin.from('deals').insert({
      dealership_id: dealershipId, contact_id: contact.id, created_by: ownerId,
      deal_number: r.num, deal_status: r.deal_status, deal_type: 'subscription',
      selling_price: r.price, total_price: r.price, payment: Math.round(r.price / 12),
      term: 12, payment_freq: 'monthly',
      notes: `MarketSync ${r.pkg} package — ${r.company}`,
      vehicle: { package: r.pkg, company: r.company, annual: r.price },
    })
    if (error) throw error
    log('created deal #', r.num, `(${r.pkg}, ${r.deal_status})`)
  } else {
    log('deal exists for', r.email)
  }
}

async function main() {
  log('seeding internal MarketSync workspace …')
  const userId = await ensureUser()
  const dealershipId = await ensureDealership()
  await ensureProfile(userId, dealershipId)
  for (const r of RECORDS) await ensureContactAndDeal(dealershipId, userId, r)
  log('done. Login:', EMAIL, '/ password:', PASSWORD)
  log('Dealership:', DEALER_NAME, '(' + dealershipId + ') — 5 customers, 5 deals.')
}

main().then(() => process.exit(0)).catch(e => { console.error('[seed-jms] FAILED:', e.message); process.exit(1) })
