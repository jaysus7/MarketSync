/**
 * Tenant-scoped showcase data for the dedicated demo accounts.
 *
 * MarketSync HQ never becomes a dealership and never receives fictional records.
 * Each demo login stays attached to its own dealership_id, and the account's active
 * plan decides which datasets are created. The platform owner can prepare all named
 * demo accounts in one idempotent call; a demo account can also prepare itself.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { SYSTEM_ROLES, hasSystemRole } from '../authorization.js'
import { audit } from '../audit.js'
import { featuresForPlan, productsForPlan } from '../plan-catalog.js'
import { ACADEMY_DEMO_VERSION, seedAcademyDemoData, wipeAcademyDemoData } from '../academy-demo-data.js'
import { createHash } from 'node:crypto'
import { ensureStaffMember } from './people-identity.js'

const DEMO_EMPLOYEES = [
  { name: 'Marcus Vance', email: 'marcus.vance@dealership.example', department: 'Sales', team: 'Sales', job_title: 'General Sales Manager', location_name: 'Main Showroom', start_date: '2021-03-15' },
  { name: 'Sarah Jenkins', email: 'sarah.jenkins@dealership.example', department: 'Sales', team: 'Sales', job_title: 'Senior Sales Representative', location_name: 'Main Showroom', start_date: '2022-06-01' },
  { name: 'David Miller', email: 'david.miller@dealership.example', department: 'F&I', team: 'F&I', job_title: 'Finance Manager', location_name: 'Finance Office', start_date: '2020-01-10' },
  { name: 'Elena Rostova', email: 'elena.rostova@dealership.example', department: 'Service', team: 'Service', job_title: 'Service Manager', location_name: 'Service Bay', start_date: '2019-08-20' },
]

const isPlatformOwner = req => hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)
const isDealerAdmin = req => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const isDedicatedDemoName = name => /(?:^|\b)demo(?:\b|$)/i.test(String(name || ''))
const RETIRED_HQ_SANDBOXES = new Set(['MarketSync Demo', 'MarketSync Automotive'])

// ID-only variant of ownDedicatedDemoAccount, for interception points that only have a
// bare dealershipId (SMS/email/Stripe call sites deep in automation.js, action-executor.js
// — not an Express req). Short-TTL cached since sendSms()/the email executors call this on
// every send; a dealership's demo-ness never changes mid-session so 5 minutes is safe.
const __demoIdCache = new Map()
const DEMO_ID_CACHE_TTL_MS = 5 * 60 * 1000
export async function isDemoDealershipId(dealershipId) {
  if (!dealershipId) return false
  const cached = __demoIdCache.get(dealershipId)
  if (cached && Date.now() - cached.at < DEMO_ID_CACHE_TTL_MS) return cached.value
  const { data } = await supabaseAdmin.from('dealerships').select('name').eq('id', dealershipId).maybeSingle()
  const value = !!data && isDedicatedDemoName(data.name) && !RETIRED_HQ_SANDBOXES.has(data.name)
  __demoIdCache.set(dealershipId, { value, at: Date.now() })
  return value
}

const CUSTOMERS = [
  { first: 'Ava', last: 'Thompson', email: 'ava.thompson@example.com', phone: '(416) 555-2201', status: 'uncontacted', source: 'Website', stock: 'DEMO-01', price: 32480, deal_status: 'draft', num: 2001, note: 'Enquired on the RAV4 overnight — needs a first call.' },
  { first: 'Liam', last: 'Rodriguez', email: 'liam.rodriguez@example.com', phone: '(647) 555-2202', status: 'contacted', source: 'Facebook Marketplace', stock: 'DEMO-02', price: 41900, deal_status: 'quoted', num: 2002, note: 'Called back — wants payment options on the F-150.' },
  { first: 'Sophia', last: 'Nguyen', email: 'sophia.nguyen@example.com', phone: '(905) 555-2203', status: 'appointment', source: 'Website', stock: 'DEMO-03', price: 27650, deal_status: 'deposit_received', num: 2003, note: 'Booked a test drive Saturday on the Civic.' },
  { first: 'Noah', last: 'Patel', email: 'noah.patel@example.com', phone: '(519) 555-2204', status: 'sold', source: 'Referral', stock: 'DEMO-04', price: 33200, deal_status: 'credit_approved', num: 2004, note: 'Bought the Model 3 — in F&I.' },
  { first: 'Emma', last: 'Wilson', email: 'emma.wilson@example.com', phone: '(613) 555-2205', status: 'fni', source: 'Walk-in', stock: 'DEMO-05', price: 29995, deal_status: 'contract_signed', num: 2005, note: 'Signing warranty + protection on the CX-5.' },
  { first: 'Oliver', last: 'Brooks', email: 'oliver.brooks@example.com', phone: '(250) 555-2206', status: 'delivered', source: 'Website', stock: 'DEMO-06', price: 38700, deal_status: 'delivered', num: 2006, note: 'Delivered the Sierra — schedule a 30-day check-in.' },
]

const VEHICLES = [
  { stock: 'DEMO-01', year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE AWD', price: 32480, mileage: 41250, color: 'Magnetic Grey', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: '2T3W1FV6NWD000001' },
  { stock: 'DEMO-02', year: 2021, make: 'Ford', model: 'F-150', trim: 'XLT SuperCrew', price: 41900, mileage: 58900, color: 'Velocity Blue', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '1FTEW1EP7MFD00002' },
  { stock: 'DEMO-03', year: 2023, make: 'Honda', model: 'Civic', trim: 'Sport', price: 27650, mileage: 22750, color: 'Platinum White', fuel: 'Gasoline', drive: 'FWD', body: 'Sedan', vin: '2HGFE2F58PHD00003' },
  { stock: 'DEMO-04', year: 2020, make: 'Tesla', model: 'Model 3', trim: 'Long Range', price: 33200, mileage: 61200, color: 'Solid Black', fuel: 'Electric', drive: 'AWD', body: 'Sedan', vin: '5YJ3E1EB7LFD00004' },
  { stock: 'DEMO-05', year: 2021, make: 'Mazda', model: 'CX-5', trim: 'GT', price: 29995, mileage: 47800, color: 'Soul Red', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: 'JM3KFBDM1M0D00005' },
  { stock: 'DEMO-06', year: 2019, make: 'GMC', model: 'Sierra 1500', trim: 'SLT', price: 38700, mileage: 78400, color: 'Quicksilver', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '3GTU9DED8KGD00006' },
  { stock: 'DEMO-07', year: 2023, make: 'Hyundai', model: 'Tucson', trim: 'Preferred', price: 31990, mileage: 18900, color: 'Amazon Grey', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: 'KM8JBCAE9PUD00007' },
  { stock: 'DEMO-08', year: 2022, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', price: 44980, mileage: 33500, color: 'Summit White', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '1GCUYDED5NZD00008' },
]

function activeSubscription(row) {
  if (row.status === 'active') return true
  if (row.status !== 'trialing') return false
  return !row.trial_ends_at || new Date(row.trial_ends_at).getTime() > Date.now()
}

async function entitlementsFor(dealershipId) {
  const { data, error } = await supabaseAdmin.from('subscriptions')
    .select('plan_id,status,trial_ends_at').eq('dealership_id', dealershipId)
  if (error) throw error
  const planIds = [...new Set((data || []).filter(activeSubscription).map(row => row.plan_id).filter(Boolean))]
  const products = [...new Set(planIds.flatMap(productsForPlan))]
  const features = [...new Set(planIds.flatMap(featuresForPlan))]
  return { planIds, products, features }
}

async function currentDemoVersion(dealershipId) {
  const { data } = await supabaseAdmin.from('dealer_config').select('value')
    .eq('dealership_id', dealershipId).eq('key', 'demo_showcase').maybeSingle()
  return data?.value?.version || null
}

async function seedBase({ dealershipId, ownerId, products }) {
  const { data: ownerProfile, error: ownerProfileError } = await supabaseAdmin.from('profiles')
    .select('full_name,display_name,role,business_email').eq('id', ownerId)
    .eq('dealership_id', dealershipId).maybeSingle()
  if (ownerProfileError) throw ownerProfileError
  const owner = await ensureStaffMember(dealershipId, ownerId, {
    name: ownerProfile?.full_name || ownerProfile?.display_name,
    email: ownerProfile?.business_email,
    role: ownerProfile?.role,
    jobTitle: 'Dealer Principal',
    status: 'active',
  })
  if (owner.error) throw new Error(`seed demo owner employment: ${owner.error}`)

  // Demo teammates are real employment records. They intentionally have no user_id until
  // invited, proving People can precede access while Users & Access remains honest.
  for (const employee of DEMO_EMPLOYEES) {
    const { data: existing, error: findError } = await supabaseAdmin.from('staff_members')
      .select('id').eq('dealership_id', dealershipId).eq('email', employee.email).maybeSingle()
    if (findError) throw findError
    if (!existing) {
      const { data: created, error } = await supabaseAdmin.from('staff_members').insert({
        dealership_id: dealershipId, ...employee, employment_status: 'active', active: true,
        onboarding_status: 'not_started', compliance_status: 'not_started', created_by: ownerId,
      }).select('id').single()
      if (error) throw error
      const { error: historyError } = await supabaseAdmin.from('staff_status_history').insert({
        dealership_id: dealershipId, staff_member_id: created.id, from_status: null,
        to_status: 'active', reason: 'Canonical demo employment seeded', changed_by: ownerId,
      })
      if (historyError) throw historyError
    }
  }

  const productSet = new Set(products)
  const byStock = {}
  for (const vehicle of VEHICLES) {
    const { data: existing } = await supabaseAdmin.from('inventory').select('id')
      .eq('dealership_id', dealershipId).eq('stocknumber', vehicle.stock).maybeSingle()
    if (existing) { byStock[vehicle.stock] = existing.id; continue }
    // Inventory historically has a global VIN conflict target. Give each demo tenant
    // a stable fictional VIN so two demo accounts can never claim the same row.
    const vin = `MSDEM${createHash('sha256').update(`${dealershipId}:${vehicle.stock}`).digest('hex').slice(0, 12).toUpperCase()}`
    const { data, error } = await supabaseAdmin.from('inventory').insert({
      dealership_id: dealershipId, source: 'manual', status: 'published',
      year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim,
      price: vehicle.price, mileage: vehicle.mileage, condition: 'used', stocknumber: vehicle.stock,
      exterior_color: vehicle.color, fuel_type: vehicle.fuel, drivetrain: vehicle.drive,
      body_style: vehicle.body, vin,
      lot_date: new Date(Date.now() - (12 + Number(vehicle.stock.slice(-2)) * 6) * 86400000).toISOString(),
      image_urls: [],
    }).select('id').single()
    if (error) throw error
    byStock[vehicle.stock] = data.id
  }

  if (!productSet.has('dealer_os') && !productSet.has('ai_dealer')) return
  for (const row of CUSTOMERS) {
    let { data: contact } = await supabaseAdmin.from('contacts').select('id')
      .eq('dealership_id', dealershipId).ilike('email', row.email).maybeSingle()
    if (!contact) {
      const inserted = await supabaseAdmin.from('contacts').insert({
        dealership_id: dealershipId, full_name: `${row.first} ${row.last}`,
        first_name: row.first, last_name: row.last, email: row.email, phone: row.phone,
        phone_mobile: row.phone, source: row.source, status: row.status, notes: row.note,
        consent_email: false, customer_number: row.num,
        interest_inventory_id: byStock[row.stock] || null,
      }).select('id').single()
      if (inserted.error) throw inserted.error
      contact = inserted.data
    }
    if (!productSet.has('dealer_os') || !contact) continue
    const { data: deal } = await supabaseAdmin.from('deals').select('id')
      .eq('dealership_id', dealershipId).eq('contact_id', contact.id).maybeSingle()
    if (!deal) {
      const { error } = await supabaseAdmin.from('deals').insert({
        dealership_id: dealershipId, contact_id: contact.id, created_by: ownerId,
        deal_number: row.num, deal_status: row.deal_status, deal_type: 'retail',
        inventory_id: byStock[row.stock] || null, selling_price: row.price,
        total_price: Math.round(row.price * 1.13), term: 72,
        payment: Math.round((row.price * 1.13) / 72), payment_freq: 'monthly', notes: row.note,
      })
      if (error) throw error
    }
  }
}

async function seedAccount({ dealership, ownerId, force = false }) {
  if (!dealership?.id || !isDedicatedDemoName(dealership.name) || RETIRED_HQ_SANDBOXES.has(dealership.name)) {
    throw new Error('Only a dedicated demo account can receive showcase data.')
  }
  const access = await entitlementsFor(dealership.id)
  if (!access.planIds.length || !access.products.length) throw new Error('The demo account has no active plan to seed.')
  if (!force && await currentDemoVersion(dealership.id) === ACADEMY_DEMO_VERSION) {
    return { version: ACADEMY_DEMO_VERSION, already_current: true, plans: access.planIds, products: access.products }
  }
  await seedBase({ dealershipId: dealership.id, ownerId, products: access.products })
  return seedAcademyDemoData({
    db: supabaseAdmin,
    dealershipId: dealership.id,
    dealerName: dealership.name,
    ownerId,
    ...access,
  })
}

/** Refresh versioned demo data without requiring an interactive demo login. */
export async function refreshDedicatedDemoAccounts() {
  const { data: dealerships, error } = await supabaseAdmin.from('dealerships')
    .select('id,name').ilike('name', '%demo%').order('name')
  if (error) throw error
  const targets = (dealerships || []).filter(row => !RETIRED_HQ_SANDBOXES.has(row.name) && isDedicatedDemoName(row.name))
  if (!targets.length) return []
  const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles')
    .select('id,dealership_id,role,active').in('dealership_id', targets.map(row => row.id))
  if (profilesError) throw profilesError
  const rank = role => ({ DEALER_ADMIN: 0, OWNER: 1, MANAGER: 2 }[role] ?? 9)
  const owners = new Map()
  for (const profile of (profiles || []).filter(row => row.active !== false).sort((a, b) => rank(a.role) - rank(b.role))) {
    if (!owners.has(profile.dealership_id)) owners.set(profile.dealership_id, profile.id)
  }
  const results = []
  for (const dealership of targets) {
    const ownerId = owners.get(dealership.id)
    if (!ownerId) {
      results.push({ id: dealership.id, name: dealership.name, status: 'skipped', reason: 'No active demo login' })
      continue
    }
    try {
      const summary = await seedAccount({ dealership, ownerId })
      results.push({ id: dealership.id, name: dealership.name, status: summary.already_current ? 'current' : 'seeded', summary })
    } catch (error) {
      results.push({ id: dealership.id, name: dealership.name, status: 'skipped', reason: error.message })
    }
  }
  return results
}

async function ownDemoAccount(req) {
  const id = req.dealershipId
  if (!id) return null
  const { data } = await supabaseAdmin.from('dealerships').select('id,name').eq('id', id).maybeSingle()
  return data
}

// The caller's own dealership, but ONLY if it's a real dedicated demo account (used by
// routes/demo-control.js — the same "is this actually a demo tenant" check /demo/seed and
// /demo/reset already apply, factored out so it isn't duplicated).
export async function ownDedicatedDemoAccount(req) {
  const dealership = await ownDemoAccount(req)
  if (!dealership || !isDedicatedDemoName(dealership.name) || RETIRED_HQ_SANDBOXES.has(dealership.name)) return null
  return dealership
}
export { seedAccount }

// Middleware for every route that would otherwise create a real Stripe checkout session,
// billing-portal session, or connected account (routes/billing.js, routes/groups.js,
// routes/deposits.js). Short-circuits with a clearly-labeled simulated response instead of
// calling next(). `complimentary` + `error` are both set because different checkout
// call-sites on the frontend check for different fields on failure/no-op — this keeps the
// demo operator's alert readable regardless of which route they hit, without having to
// audit and special-case every frontend consumer's response-shape assumption.
export async function blockDemoStripeAction(req, res, next) {
  try {
    const dealership = await ownDedicatedDemoAccount(req)
    if (!dealership) return next()
    console.log('[demo] blocked Stripe action (simulated):', { dealershipId: req.dealershipId, path: req.originalUrl })
    return res.json({
      ok: true, demo: true, simulated: true, complimentary: true,
      error: 'This is the demo account — billing is simulated here. No real payment or Stripe session was created.',
    })
  } catch (e) { next(e) }
}

export function registerDemo(app) {
  // A dedicated demo login prepares only its own dealership and its purchased modules.
  app.post('/demo/seed', requireAuth, async (req, res) => {
    try {
      const dealership = await ownDemoAccount(req)
      if (!dealership || !isDedicatedDemoName(dealership.name) || RETIRED_HQ_SANDBOXES.has(dealership.name)) {
        return res.status(403).json({ error: 'Not a dedicated demo account.' })
      }
      const summary = await seedAccount({ dealership, ownerId: req.user.id })
      audit(req, 'demo.seeded', { demo_dealership_id: dealership.id, summary })
      res.json({ ok: true, dealership_id: dealership.id, summary })
    } catch (error) {
      console.error('[demo] account seed failed:', error.message)
      res.status(500).json({ error: error.message })
    }
  })

  // MarketSync HQ prepares every user-created account whose name explicitly says Demo.
  // It never changes plans, creates users, or writes into the HQ dealership.
  app.post('/demo/seed-all', requireAuth, async (req, res) => {
    if (!isPlatformOwner(req)) return res.status(403).json({ error: 'Platform owner required.' })
    try {
      const { data: dealerships, error } = await supabaseAdmin.from('dealerships')
        .select('id,name').ilike('name', '%demo%').order('name')
      if (error) throw error
      const targets = (dealerships || []).filter(row => row.id !== req.dealershipId && !RETIRED_HQ_SANDBOXES.has(row.name))
      const ids = targets.map(row => row.id)
      const { data: profiles } = ids.length
        ? await supabaseAdmin.from('profiles').select('id,dealership_id,role,active').in('dealership_id', ids)
        : { data: [] }
      const rank = role => ({ DEALER_ADMIN: 0, OWNER: 1, MANAGER: 2 }[role] ?? 9)
      const owners = new Map()
      for (const profile of (profiles || []).filter(row => row.active !== false).sort((a, b) => rank(a.role) - rank(b.role))) {
        if (!owners.has(profile.dealership_id)) owners.set(profile.dealership_id, profile.id)
      }
      const results = []
      for (const dealership of targets) {
        const ownerId = owners.get(dealership.id)
        if (!ownerId) { results.push({ id: dealership.id, name: dealership.name, status: 'skipped', reason: 'No active demo login' }); continue }
        try {
          const summary = await seedAccount({ dealership, ownerId })
          results.push({ id: dealership.id, name: dealership.name, status: summary.already_current ? 'current' : 'seeded', summary })
        } catch (error) {
          results.push({ id: dealership.id, name: dealership.name, status: 'skipped', reason: error.message })
        }
      }
      audit(req, 'demo.accounts_seeded', { results })
      res.json({ ok: true, accounts: results })
    } catch (error) {
      console.error('[demo] batch seed failed:', error.message)
      res.status(500).json({ error: 'Could not prepare the dedicated demo accounts.' })
    }
  })

  // Reset is available only from inside the dedicated demo account itself.
  app.post('/demo/reset', requireAuth, async (req, res) => {
    if (!isDealerAdmin(req) && !isPlatformOwner(req)) return res.status(403).json({ error: 'Demo admin required.' })
    try {
      const dealership = await ownDemoAccount(req)
      if (!dealership || !isDedicatedDemoName(dealership.name) || RETIRED_HQ_SANDBOXES.has(dealership.name)) {
        return res.status(403).json({ error: 'Not a dedicated demo account.' })
      }
      await wipeAcademyDemoData(supabaseAdmin, dealership.id)
      const summary = await seedAccount({ dealership, ownerId: req.user.id, force: true })
      audit(req, 'demo.reset', { demo_dealership_id: dealership.id, summary })
      res.json({ ok: true, dealership_id: dealership.id, summary })
    } catch (error) {
      console.error('[demo] reset failed:', error.message)
      res.status(500).json({ error: 'Could not reset this demo account.' })
    }
  })
}
