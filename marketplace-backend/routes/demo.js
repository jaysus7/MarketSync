/**
 * The owner's sandboxed DEMO dealership — a separate workspace, seeded with fake
 * cars + customers spread across every deal stage, so the MarketSync owner can show
 * the full vehicle-dealer product (and walk deals forward/back on the timeline) live
 * in a demo, without ever touching real MarketSync data.
 *
 * The middleware routes requests here when the owner is in Demo mode (X-Act-Demo);
 * this module just creates + seeds + resets the workspace. Owner-only.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { bustDemoDealerCache } from '../middleware.js'

const DEMO_NAME = 'MarketSync Demo'
const isOwner = (req) => req.profile?.dealerships?.name === 'JMS Automotive'

// Demo customers across the full pipeline so the stage stepper has material.
const CUSTOMERS = [
  { first: 'Ava', last: 'Thompson', email: 'ava.thompson@example.com', phone: '(416) 555-2201', status: 'uncontacted', source: 'Website', stock: 'DEMO-01', price: 32480, deal_status: 'working', num: 2001, note: 'Enquired on the RAV4 overnight — needs a first call.' },
  { first: 'Liam', last: 'Rodriguez', email: 'liam.rodriguez@example.com', phone: '(647) 555-2202', status: 'contacted', source: 'Facebook Marketplace', stock: 'DEMO-02', price: 41900, deal_status: 'working', num: 2002, note: 'Called back — wants payment options on the F-150.' },
  { first: 'Sophia', last: 'Nguyen', email: 'sophia.nguyen@example.com', phone: '(905) 555-2203', status: 'appointment', source: 'Website', stock: 'DEMO-03', price: 27650, deal_status: 'working', num: 2003, note: 'Booked a test drive Saturday on the Civic.' },
  { first: 'Noah', last: 'Patel', email: 'noah.patel@example.com', phone: '(519) 555-2204', status: 'sold', source: 'Referral', stock: 'DEMO-04', price: 33200, deal_status: 'sold', num: 2004, note: 'Bought the Model 3 — in F&I.' },
  { first: 'Emma', last: 'Wilson', email: 'emma.wilson@example.com', phone: '(613) 555-2205', status: 'fni', source: 'Walk-in', stock: 'DEMO-05', price: 29995, deal_status: 'sold', num: 2005, note: 'Signing warranty + protection on the CX-5.' },
  { first: 'Oliver', last: 'Brooks', email: 'oliver.brooks@example.com', phone: '(250) 555-2206', status: 'delivered', source: 'Website', stock: 'DEMO-06', price: 38700, deal_status: 'delivered', num: 2006, note: 'Delivered the Sierra — schedule a 30-day check-in.' },
]
const VEHICLES = [
  { stock: 'DEMO-01', year: 2022, make: 'Toyota', model: 'RAV4', trim: 'XLE AWD', price: 32480, mileage: 41250, color: 'Magnetic Grey', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: '2T3W1RFV6NWD00001' },
  { stock: 'DEMO-02', year: 2021, make: 'Ford', model: 'F-150', trim: 'XLT SuperCrew', price: 41900, mileage: 58900, color: 'Velocity Blue', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '1FTEW1EP7MFD00002' },
  { stock: 'DEMO-03', year: 2023, make: 'Honda', model: 'Civic', trim: 'Sport', price: 27650, mileage: 22750, color: 'Platinum White', fuel: 'Gasoline', drive: 'FWD', body: 'Sedan', vin: '2HGFE2F58PHD00003' },
  { stock: 'DEMO-04', year: 2020, make: 'Tesla', model: 'Model 3', trim: 'Long Range', price: 33200, mileage: 61200, color: 'Solid Black', fuel: 'Electric', drive: 'AWD', body: 'Sedan', vin: '5YJ3E1EB7LFD00004' },
  { stock: 'DEMO-05', year: 2021, make: 'Mazda', model: 'CX-5', trim: 'GT', price: 29995, mileage: 47800, color: 'Soul Red', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: 'JM3KFBDM1M0D00005' },
  { stock: 'DEMO-06', year: 2019, make: 'GMC', model: 'Sierra 1500', trim: 'SLT', price: 38700, mileage: 78400, color: 'Quicksilver', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '3GTU9DED8KGD00006' },
  // A couple of fresh, un-sold units so the lot never looks empty.
  { stock: 'DEMO-07', year: 2023, make: 'Hyundai', model: 'Tucson', trim: 'Preferred', price: 31990, mileage: 18900, color: 'Amazon Grey', fuel: 'Gasoline', drive: 'AWD', body: 'SUV', vin: 'KM8JBCAE9PUD00007' },
  { stock: 'DEMO-08', year: 2022, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', price: 44980, mileage: 33500, color: 'Summit White', fuel: 'Gasoline', drive: '4WD', body: 'Truck', vin: '1GCUYDED5NZD00008' },
]

async function ensureDemoDealership() {
  const { data: found } = await supabaseAdmin.from('dealerships').select('id').eq('name', DEMO_NAME).maybeSingle()
  if (found) { bustDemoDealerCache(found.id); return found.id }
  const farFuture = new Date(Date.now() + 100 * 365 * 86400000).toISOString()
  const { data, error } = await supabaseAdmin.from('dealerships').insert({
    name: DEMO_NAME, website_url: 'https://marketsync.link', billing_status: 'ACTIVE',
    full_access_until: farFuture, ai_boost_active: true, inv_intel_active: true, city: 'Toronto', province: 'ON', country: 'CA',
  }).select('id').single()
  if (error) throw error
  bustDemoDealerCache(data.id)
  return data.id
}

async function seed(dealershipId, ownerId) {
  const byStock = {}
  for (const v of VEHICLES) {
    const { data: ex } = await supabaseAdmin.from('inventory').select('id').eq('dealership_id', dealershipId).eq('stocknumber', v.stock).maybeSingle()
    if (ex) { byStock[v.stock] = ex.id; continue }
    const { data } = await supabaseAdmin.from('inventory').insert({
      dealership_id: dealershipId, source: 'manual', status: 'available',
      year: v.year, make: v.make, model: v.model, trim: v.trim, price: v.price, mileage: v.mileage, condition: 'used',
      stocknumber: v.stock, exterior_color: v.color, fuel_type: v.fuel, drivetrain: v.drive, body_style: v.body, vin: v.vin,
      lot_date: new Date(Date.now() - Math.floor(Math.random() * 70) * 86400000).toISOString(), image_urls: [],
    }).select('id').single()
    if (data) byStock[v.stock] = data.id
  }
  for (const r of CUSTOMERS) {
    let { data: c } = await supabaseAdmin.from('contacts').select('id').eq('dealership_id', dealershipId).ilike('email', r.email).maybeSingle()
    if (!c) {
      const ins = await supabaseAdmin.from('contacts').insert({
        dealership_id: dealershipId, full_name: `${r.first} ${r.last}`, first_name: r.first, last_name: r.last,
        email: r.email, phone: r.phone, phone_mobile: r.phone, source: r.source, status: r.status,
        notes: r.note, consent_email: false, customer_number: r.num,
        interest_inventory_id: byStock[r.stock] || null,
      }).select('id').single()
      c = ins.data
    }
    if (!c) continue
    const invId = byStock[r.stock] || null
    const { data: deal } = await supabaseAdmin.from('deals').select('id').eq('dealership_id', dealershipId).eq('contact_id', c.id).maybeSingle()
    if (!deal) {
      await supabaseAdmin.from('deals').insert({
        dealership_id: dealershipId, contact_id: c.id, created_by: ownerId, deal_number: r.num,
        deal_status: r.deal_status, deal_type: 'retail', inventory_id: invId,
        selling_price: r.price, total_price: Math.round(r.price * 1.13), term: 72,
        payment: Math.round((r.price * 1.13) / 72), payment_freq: 'monthly', notes: r.note,
      })
    }
  }
}

async function wipe(dealershipId) {
  for (const t of ['deals', 'crm_tasks', 'communications', 'recon', 'contacts', 'inventory']) {
    await supabaseAdmin.from(t).delete().eq('dealership_id', dealershipId)
  }
}

export function registerDemo(app) {
  // Create (if needed) + seed the demo workspace. Idempotent.
  app.post('/demo/seed', requireAuth, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Not available for this account.' })
    try {
      const id = await ensureDemoDealership()
      await seed(id, req.user.id)
      res.json({ ok: true, dealership_id: id, seeded: true })
    } catch (e) { console.error('[demo] seed failed:', e.message); res.status(500).json({ error: 'Could not set up the demo workspace.' }) }
  })

  // Wipe + reseed — resets the demo back to its starting point.
  app.post('/demo/reset', requireAuth, async (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'Not available for this account.' })
    try {
      const id = await ensureDemoDealership()
      await wipe(id)
      await seed(id, req.user.id)
      res.json({ ok: true, dealership_id: id, reset: true })
    } catch (e) { console.error('[demo] reset failed:', e.message); res.status(500).json({ error: 'Could not reset the demo workspace.' }) }
  })
}
