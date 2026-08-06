import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const ACADEMY_DEMO_VERSION = '2026.08.05-dedicated-accounts-v1'

const catalogUrls = [
  new URL('../marketplace-frontend/training/catalog.json', import.meta.url),
  new URL('../marketplace-frontend/training/catalog-expanded.json', import.meta.url),
]

export async function loadAcademyDemoLessons() {
  const loaded = []
  for (const url of catalogUrls) {
    try {
      const content = await readFile(url, 'utf8')
      const parsed = JSON.parse(content)
      if (parsed.lessons) loaded.push(...parsed.lessons)
    } catch (e) {}
  }
  return loaded
}

export function demoLessonsForAccess(lessons, { products = [], features = [] } = {}) {
  const productSet = new Set(products)
  const featureSet = new Set(features)
  return (lessons || []).filter(lesson =>
    (lesson.product === 'shared' || productSet.has(lesson.product))
    && (lesson.features || []).every(feature => featureSet.has(feature)))
}

export function academyDemoEntityId(lessonId) {
  const h = createHash('sha256').update(`marketsync-academy-demo:${lessonId}`).digest('hex').slice(0, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function seedLessonScenarios(db, dealershipId, ownerId, products, features) {
  const lessons = demoLessonsForAccess(await loadAcademyDemoLessons(), { products, features })
  await must('clear Academy scenario events', db.from('events').delete().eq('dealership_id', dealershipId).eq('event_name', 'training.scenario.ready'))
  const now = Date.now()
  const rows = lessons.map((lesson, index) => ({
    dealership_id: dealershipId,
    event_name: 'training.scenario.ready',
    event_version: 1,
    summary: `${lesson.id} · ${lesson.title}`,
    entity_type: 'training_lesson',
    entity_id: academyDemoEntityId(lesson.id),
    department: lesson.course,
    payload: {
      academy_demo: true,
      demo_version: ACADEMY_DEMO_VERSION,
      lesson_id: lesson.id,
      product: lesson.product,
      course: lesson.course,
      route: `/training.html?lesson=${encodeURIComponent(lesson.id)}`,
      outcome: lesson.outcome,
    },
    created_by: ownerId,
    created_at: new Date(now - index * 60000).toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 100) await must('seed Academy scenario events', db.from('events').insert(rows.slice(i, i + 100)))
  return lessons.length
}

async function seedConfiguration(db, dealershipId, ownerId, { dealerName, products, features, planIds }) {
  const rows = [
    { dealership_id: dealershipId, key: 'demo_showcase', value: { version: ACADEMY_DEMO_VERSION, fictional_data: true, dedicated_account: true, products: [...products], plans: planIds }, updated_by: ownerId },
  ]
  if (features.has('os.service')) rows.push({ dealership_id: dealershipId, key: 'service', value: { labor_rate: 149, tax_rate: 0.13, shop_supplies_pct: 0.04, part_markup_pct: 40, ro_prefix: 'DEMO-RO-' }, updated_by: ownerId })
  if (products.has('ai_dealer')) rows.push({ dealership_id: dealershipId, key: 'ai_personality', value: { name: 'Avery', tone: 'helpful, concise and professional', greeting: `Welcome to ${dealerName}. How can I help?`, handoff: 'I will connect you with our team.' }, updated_by: ownerId })
  await must('seed dealer configuration', db.from('dealer_config').upsert(rows, { onConflict: 'dealership_id,key' }))
}

async function seedFacebook(db, dealershipId, ownerId, inventory) {
  let seeded = 0
  for (let index = 0; index < Math.min(inventory.length, 8); index++) {
    const vehicle = inventory[index]
    const existing = await must('find demo Facebook listing', db.from('listings').select('id').eq('inventory_id', vehicle.id).eq('posted_by', ownerId).limit(1))
    if (existing?.length) continue
    const sold = index === 3 || index === 6
    const postedAt = new Date(Date.now() - (index + 1) * 86400000).toISOString()
    await must('seed demo Facebook listing', db.from('listings').insert({
      inventory_id: vehicle.id,
      posted_by: ownerId,
      fb_listing_id: `DEMO-FB-${dealershipId.slice(0, 8)}-${String(index + 1).padStart(3, '0')}`,
      status: sold ? 'sold' : 'posted',
      posted_price: vehicle.price ?? null,
      posted_at: postedAt,
      sold_at: sold ? new Date(Date.now() - index * 43200000).toISOString() : null,
      vehicle_label: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '),
    }))
    seeded++
  }
  return seeded
}

async function seedOperations(db, dealershipId, ownerId, inventory, contacts, features) {
  const vehicle = inventory[0]
  const customer = contacts[0]
  const due = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  const tasks = [
    ['os.service', 'Academy Demo · Safety inspection', 'Safety', 'Service', 'in_progress', 'high', null],
    ['os.service', 'Academy Demo · Detail retail-ready vehicle', 'Detail', 'Cleanup', 'blocked', 'normal', 'Waiting on mirror cap'],
    ['os.inventory', 'Academy Demo · Photograph incoming inventory', 'Photos', 'Marketing', 'todo', 'normal', null],
    ['os.sales', 'Academy Demo · Verify lender stipulation', 'Other', 'F&I', 'todo', 'urgent', null],
    ['os.accounting', 'Academy Demo · Reconcile customer deposit', 'Other', 'Accounting', 'todo', 'high', null],
    ['os.sales', 'Academy Demo · Confirm delivery appointment', 'Deliver', 'Sales', 'done', 'high', null],
  ].filter(([feature]) => features.has(feature))
  for (const [, title, kind, department, status, priority, blockedReason] of tasks) {
    const found = await must('find demo task', db.from('dealer_tasks').select('id').eq('dealership_id', dealershipId).eq('title', title).maybeSingle())
    if (!found) await must('seed demo task', db.from('dealer_tasks').insert({
      dealership_id: dealershipId, created_by: ownerId, title, kind, department, status, priority,
      blocked_reason: blockedReason, due_date: due(status === 'done' ? -1 : 1), inventory_id: vehicle?.id || null,
      stock_number: vehicle?.stocknumber || null, vin: vehicle?.vin || null, contact_id: customer?.id || null,
      contact_name: customer?.full_name || null, events: [{ at: new Date().toISOString(), actor: ownerId, action: 'created', detail: 'Academy demo data' }],
    }))
  }
  const exceptions = [
    ['os.crm', 'lead_unanswered', 'customer', customer?.id, 'Sales', 'high', 'Academy Demo · Website lead has no first response'],
    ['os.service', 'recon_stalled', 'vehicle', vehicle?.id, 'Service', 'medium', 'Academy Demo · Recon is blocked by a backordered part'],
  ].filter(([feature]) => features.has(feature))
  for (const [, kind, entityType, entityId, department, severity, description] of exceptions) {
    if (!entityId) continue
    const found = await must('find demo exception', db.from('exceptions').select('id').eq('dealership_id', dealershipId).eq('kind', kind).eq('entity_id', entityId).maybeSingle())
    if (!found) await must('seed demo exception', db.from('exceptions').insert({ dealership_id: dealershipId, kind, entity_type: entityType, entity_id: entityId, department, severity, description, status: 'open' }))
  }
}

async function seedServiceAndParts(db, dealershipId, ownerId, inventory, contacts) {
  const partRows = [
    { dealership_id: dealershipId, part_number: 'DEMO-PF64', description: 'Oil filter', bin: 'A-03', qty_on_hand: 2, cost: 8.75, price: 17.95, reorder_point: 6 },
    { dealership_id: dealershipId, part_number: 'DEMO-BRK-221', description: 'Front brake pad kit', bin: 'B-14', qty_on_hand: 8, cost: 84.2, price: 168.4, reorder_point: 3 },
    { dealership_id: dealershipId, part_number: 'DEMO-ROT-118', description: 'Front brake rotor', bin: 'B-16', qty_on_hand: 0, cost: 112, price: 224, reorder_point: 4 },
  ]
  await must('seed demo parts', db.from('parts').upsert(partRows, { onConflict: 'dealership_id,part_number' }))
  const parts = await must('load demo parts', db.from('parts').select('id,part_number,cost,price').eq('dealership_id', dealershipId).like('part_number', 'DEMO-%'))
  let ro = await must('find demo RO', db.from('repair_orders').select('id').eq('dealership_id', dealershipId).eq('ro_number', 'DEMO-RO-2084').maybeSingle())
  if (!ro) ro = await must('seed demo RO', db.from('repair_orders').insert({
    dealership_id: dealershipId, ro_number: 'DEMO-RO-2084', contact_id: contacts[0]?.id || null,
    inventory_id: inventory[0]?.id || null, vehicle_desc: inventory[0] ? `${inventory[0].year} ${inventory[0].make} ${inventory[0].model}` : '2022 Toyota RAV4',
    vin: inventory[0]?.vin || null, odometer: 41250, status: 'awaiting_parts', complaint: 'Brake noise and scheduled maintenance',
    labor_total: 298, parts_total: 336.8, fee_total: 25, tax: 85.77, total: 745.57, labor_cost: 110, parts_cost: 168.4,
    promised_at: new Date(Date.now() + 86400000).toISOString(), created_by: ownerId,
  }).select('id').single())
  const existingLines = await must('find demo RO lines', db.from('ro_lines').select('id').eq('dealership_id', dealershipId).eq('ro_id', ro.id).limit(1))
  if (!existingLines?.length) {
    const pads = parts.find(p => p.part_number === 'DEMO-BRK-221')
    await must('seed demo RO lines', db.from('ro_lines').insert([
      { dealership_id: dealershipId, ro_id: ro.id, line_type: 'labor', description: 'Inspect and replace front brakes', qty: 1, hours: 2, rate: 149, unit_price: 298, total: 298, tech_id: ownerId },
      { dealership_id: dealershipId, ro_id: ro.id, line_type: 'part', part_id: pads?.id || null, description: 'Front brake pad kit', qty: 2, unit_cost: 84.2, unit_price: 168.4, total: 336.8 },
    ]))
  }
  for (const part of parts) {
    const reference = `ACADEMY-DEMO-${part.part_number}`
    const found = await must('find demo part transaction', db.from('part_txns').select('id').eq('dealership_id', dealershipId).eq('reference', reference).maybeSingle())
    if (!found) await must('seed demo part transaction', db.from('part_txns').insert({ dealership_id: dealershipId, part_id: part.id, txn_type: 'receive', qty: part.part_number === 'DEMO-ROT-118' ? 0 : 8, unit_cost: part.cost, reference, note: 'Academy demo receiving transaction', created_by: ownerId }))
  }
  return { parts: parts.length, repair_orders: 1 }
}

async function seedAi(db, dealershipId, ownerId, contacts) {
  const tenant = dealershipId.slice(0, 8)
  const definitions = [
    [`demo-ai-appointment-${tenant}`, 'active', 91, 'positive', 'Customer wants an Equinox test drive tomorrow.', contacts[1]?.id],
    [`demo-ai-handoff-${tenant}`, 'handoff', 84, 'neutral', 'Customer asked for a human to discuss financing.', contacts[2]?.id],
    [`demo-ai-service-${tenant}`, 'closed', 72, 'positive', 'Service appointment booked after hours.', contacts[3]?.id],
  ]
  for (const [visitorToken, status, leadScore, sentiment, summary, contactId] of definitions) {
    let conv = await must('find demo AI conversation', db.from('ai_conversations').select('id').eq('dealership_id', dealershipId).eq('visitor_token', visitorToken).maybeSingle())
    if (!conv) conv = await must('seed demo AI conversation', db.from('ai_conversations').insert({ dealership_id: dealershipId, contact_id: contactId || null, visitor_token: visitorToken, website: 'https://demo.marketsync.ca', source: 'Academy demo widget', status, assigned_salesperson: status === 'handoff' ? ownerId : null, summary, sentiment, lead_score: leadScore }).select('id').single())
    const existing = await must('find demo AI messages', db.from('ai_messages').select('id').eq('dealership_id', dealershipId).eq('conversation_id', conv.id).limit(1))
    if (!existing?.length) await must('seed demo AI messages', db.from('ai_messages').insert([
      { dealership_id: dealershipId, conversation_id: conv.id, role: 'user', sender_type: 'customer', message: visitorToken.includes('service') ? 'Can I book an oil change for Friday?' : 'Do you have an Equinox I can test drive tomorrow?', tokens: 18 },
      { dealership_id: dealershipId, conversation_id: conv.id, role: 'assistant', sender_type: 'ai', message: visitorToken.includes('handoff') ? 'I can connect you with our finance manager. What is the best number to reach you?' : 'Yes. I can help reserve a time and keep the exact vehicle attached to your request.', tokens: 42 },
    ]))
  }
  return definitions.length
}

async function seedMarketingAndAccounting(db, dealershipId, ownerId, dealerName) {
  const vendorName = 'Academy Demo · Niagara Vehicle Transport'
  let vendor = await must('find demo vendor', db.from('vendors').select('id').eq('dealership_id', dealershipId).eq('name', vendorName).maybeSingle())
  if (!vendor) vendor = await must('seed demo vendor', db.from('vendors').insert({ dealership_id: dealershipId, name: vendorName, vendor_type: 'both', contact: 'Morgan Lee', phone: '(905) 555-0199', email: 'demo.transport@example.com', notes: 'Fictional Academy demonstration vendor', active: true }).select('id').single())
  const planName = 'Academy Demo · Sales Commission Plan'
  let plan = await must('find demo commission plan', db.from('commission_plans').select('id').eq('dealership_id', dealershipId).eq('name', planName).maybeSingle())
  if (!plan) plan = await must('seed demo commission plan', db.from('commission_plans').insert({ dealership_id: dealershipId, name: planName, active: true, is_default: true, config: { front_method: 'greater_of', front_percent: 25, front_flat: 300, pack_amount: 500, back_percent: 5, spiff_per_deal: 50, volume_tiers: [{ basis: 'units', threshold: 12, amount: 500 }, { basis: 'units', threshold: 16, amount: 1000 }], academy_demo: true } }).select('id').single())
  const month = new Date().toISOString().slice(0, 7)
  const startDate = `${month}-01`
  const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const period = await must('find demo commission period', db.from('commission_pay_periods').select('id').eq('dealership_id', dealershipId).eq('start_date', startDate).eq('end_date', endDate).maybeSingle())
  if (!period) await must('seed demo commission period', db.from('commission_pay_periods').insert({ dealership_id: dealershipId, name: `Academy Demo · ${month} Commissions`, period_type: 'monthly', start_date: startDate, end_date: endDate, status: 'open', notes: 'Fictional open pay period for Academy demonstrations' }))
  const templateName = 'Academy Demo · Delivery Thank-you'
  let template = await must('find demo email template', db.from('dealer_email_templates').select('id').eq('dealership_id', dealershipId).eq('name', templateName).maybeSingle())
  if (!template) template = await must('seed demo email template', db.from('dealer_email_templates').insert({ dealership_id: dealershipId, name: templateName, subject: 'Thank you for choosing {{dealership_name}}', body: 'Hi {{first_name}}, thank you for your vehicle purchase. Reply if we can help with anything.', category: 'delivery', active: true, is_seed: true, created_by: ownerId }).select('id').single())
  const campaignName = 'Academy Demo · Fall Service Reminder'
  const campaign = await must('find demo campaign', db.from('dealer_campaigns').select('id').eq('dealership_id', dealershipId).eq('name', campaignName).maybeSingle())
  if (!campaign) await must('seed demo campaign', db.from('dealer_campaigns').insert({ dealership_id: dealershipId, name: campaignName, segment: { consent_email: true, lifecycle: ['owner'], academy_demo: true }, template_id: template.id, subject: 'Prepare your vehicle for fall', body: `Book your seasonal maintenance with ${dealerName}.`, status: 'draft', recipient_count: 84, sent_count: 0, created_by: ownerId }))
  return { vendors: 1, commission_plans: 1, commission_periods: 1, campaigns: 1 }
}

export async function seedAcademyDemoData({ db, dealershipId, ownerId, dealerName, products: productList = [], features: featureList = [], planIds = [] }) {
  const products = new Set(productList)
  const features = new Set(featureList)
  const [inventory, contacts] = await Promise.all([
    must('load demo inventory', db.from('inventory').select('id,stocknumber,vin,year,make,model,price').eq('dealership_id', dealershipId).order('stocknumber')),
    must('load demo contacts', db.from('contacts').select('id,full_name,email').eq('dealership_id', dealershipId).order('customer_number')),
  ])
  await seedConfiguration(db, dealershipId, ownerId, { dealerName, products, features, planIds })
  if (products.has('dealer_os')) await seedOperations(db, dealershipId, ownerId, inventory || [], contacts || [], features)
  const [lessonScenarios, facebookListings, service, ai, business] = await Promise.all([
    seedLessonScenarios(db, dealershipId, ownerId, products, features),
    products.has('facebook') ? seedFacebook(db, dealershipId, ownerId, inventory || []) : 0,
    features.has('os.service') ? seedServiceAndParts(db, dealershipId, ownerId, inventory || [], contacts || []) : {},
    products.has('ai_dealer') ? seedAi(db, dealershipId, ownerId, contacts || []) : 0,
    (features.has('os.accounting') || features.has('os.marketing')) ? seedMarketingAndAccounting(db, dealershipId, ownerId, dealerName) : {},
  ])
  return {
    version: ACADEMY_DEMO_VERSION,
    plans: planIds,
    products: [...products],
    lesson_scenarios: lessonScenarios,
    vehicles: inventory?.length || 0,
    customers: contacts?.length || 0,
    facebook_listings: facebookListings,
    ...service,
    ai_conversations: ai,
    ...business,
  }
}

export const ACADEMY_DEMO_WIPE_TABLES = [
  'ai_messages', 'ai_memory', 'ai_conversations',
  'ro_lines', 'part_txns', 'repair_orders', 'parts',
  'workflow_instances', 'exceptions', 'dealer_tasks', 'workflow_templates',
  'dealer_campaigns', 'dealer_email_templates', 'commission_statement_acks', 'commission_exceptions', 'commission_adjustments', 'deal_commissions', 'commission_pay_periods', 'commission_plans',
  'events', 'crm_tasks', 'communications', 'recon', 'deals', 'listings', 'contacts', 'inventory', 'vendors',
]

export async function wipeAcademyDemoData(db, dealershipId) {
  for (const table of ACADEMY_DEMO_WIPE_TABLES) {
    const { error } = await db.from(table).delete().eq('dealership_id', dealershipId)
    if (error && !/does not exist|schema cache/i.test(error.message || '')) throw new Error(`clear ${table}: ${error.message}`)
  }
}
