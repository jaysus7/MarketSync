/**
 * AI Engine — Phase 2 runtime (LLM loop + tool registry + lead scoring + summary).
 *
 * The AI never touches the DB. It calls TOOLS; each handler wraps an existing engine
 * API (kernel contract §5) and its effects emit events. The runtime:
 *   1. persists the user message
 *   2. assembles context (history + CRM profile + timeline + memory + inventory)
 *   3. runs an agentic tool loop against the model
 *   4. persists the assistant reply, re-scores the lead, and (on capture/intent)
 *      creates the CRM lead + notifies the rep — all through engine APIs
 *
 * Tools live in the shared Agent Tool Registry (tool-registry.js, kernel contract §5),
 * MCP-shaped ({ name, description, input_schema }) and scoped to the 'sales_chat'
 * surface — so the same registry can back an MCP server for external agents, and other
 * engines can add their own tools without touching this file.
 */
import Anthropic from '@anthropic-ai/sdk'
import multer from 'multer'
import { supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { safeOutboundFetch } from '../outbound-http-policy.js'
import { requireAuth } from '../middleware.js'
import { BUSINESS_CAPABILITIES, INDUSTRY_TEMPLATES, AI_EMPLOYEE_ROLES, AI_CHATBOT_GOALS } from './ai.js'
import { emitEvent } from './events.js'
import { getConfig, setConfig } from './config-engine.js'
import { getContact, findOrCreateContact } from './crm.js'
import { routeAndNotifyLead } from '../lead-routing.js'
import { createNotification } from '../notifications.js'
import { assistantDailyAllowed, recordAssistantChat, aiAllowed, recordUsage } from '../usage.js'
import { rateLimit, randomToken } from '../security.js'
import {
  startOrContinueConversation, saveMessage, getHistory, assembleContext, saveMemory,
} from './ai-engine.js'
import { registerTool, toolDefs, callTool } from './tool-registry.js'
import {
  extractQualificationState,
  calculateExplainableLeadScore,
  generateAiLeadBrief,
  evaluateHandoffTriggers,
  classifyObjection,
  OBJECTION_TAXONOMY,
  PURCHASE_TIMEFRAMES,
  BUYING_INTENT_CATEGORIES,
  PAYMENT_PREFERENCES,
  TRADE_STATUSES,
} from '../services/chatbot-qualification-engine.js'
import {
  analyzeCustomerMessage,
  evaluateBuyingStage,
  determineNextBestQuestion,
  identifyObjection,
  updateObjectionLifecycle,
  calculateExplainableLeadIntelligence,
  generateAiLeadBrief2,
  evaluateHumanEscalationTriggers,
  generateRepCopilotSuggestion,
  verifyAndSanitizeAiResponse,
  CUSTOMER_INTELLIGENCE_TOOLS,
  createInitialCustomerIntelligenceState,
  mergeIntelligenceState,
  persistDurableCustomerFacts,
  hydrateCustomerStateFromDurableMemory,
} from '../services/customer-intelligence/index.js'

const MODEL = 'claude-haiku-4-5-20251001'
const SURFACE = 'sales_chat'   // the agent surface the customer-facing chatbot runs on
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const SITE_PUBLIC = process.env.SITE_PUBLIC_URL || FRONTEND_URL || 'https://marketsync.link'
const aiAvatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } })

// ── Google reCAPTCHA (v3) ────────────────────────────────────────────────────
// Enabled only when both keys are set in the environment. The site key is public
// (sent to the browser); the secret verifies tokens server-side.
export const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || ''
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || ''
export async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET) return true          // not configured → don't block anyone
  if (!token) return false
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
    })
    const d = await r.json()
    // v3 returns a score (0–1); accept a generous threshold for chat/lead forms.
    return !!d.success && (d.score === undefined || d.score >= 0.3)
  } catch { return true }                      // network/proxy hiccup → fail open, don't lock out real customers
}

// Turn the vehicles the agent surfaced (ctx.shownVehicles) into rich cards for the
// chat client: photo, title, price, stock, VIN and a deep link to the vehicle page.
export async function formatShownVehicles(dealershipId, rows) {
  if (!rows || !rows.length) return []
  let base = null
  try {
    const { data: d } = await supabaseAdmin.from('dealerships')
      .select('site_slug, custom_domain, custom_domain_verified').eq('id', dealershipId).maybeSingle()
    // Deep link to the vehicle on the dealer's public site. Custom domain → root
    // (site.html resolves the dealer by hostname); otherwise the hosted site.html?d=slug.
    if (d?.custom_domain && d?.custom_domain_verified) base = `https://${d.custom_domain}/?v=`
    else if (d?.site_slug) base = `${SITE_PUBLIC.replace(/\/$/, '')}/site.html?d=${encodeURIComponent(d.site_slug)}&v=`
  } catch {}
  return rows.slice(0, 24).map(v => ({
    id: v.id,
    title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
    price: v.price ?? null,
    image: (Array.isArray(v.image_urls) && v.image_urls[0]) || null,
    stock: v.stocknumber || v.stock || null,
    vin: v.vin || null,
    condition: v.condition || null,
    // Link to the vehicle's stock page on the dealer's own website (from the sync);
    // fall back to the hosted MarketSync site VDP only if there's no source URL.
    url: (v.source_url && /^https?:\/\//i.test(v.source_url)) ? v.source_url : (base ? `${base}${v.id}` : null),
  }))
}

// ── Conversation categorization (deterministic, zero-cost) ───────────────────
// Tags every chat by department + intent + extracted attributes so the AI Chat
// dashboard can show a filterable feed and insights. No model call — pure keywords.
const CAR_MAKES = ['toyota', 'honda', 'ford', 'chevrolet', 'chevy', 'gmc', 'ram', 'dodge', 'jeep', 'nissan', 'hyundai', 'kia', 'mazda', 'subaru', 'volkswagen', 'vw', 'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti', 'buick', 'cadillac', 'chrysler', 'tesla', 'volvo', 'porsche', 'land rover', 'jaguar', 'mitsubishi', 'genesis', 'lincoln']
function categorizeText(text) {
  const t = String(text || '').toLowerCase()
  const tags = new Set()
  let department = 'general'
  if (/\b(parts?|accessor|tire|battery|brake pad|wiper|floor mat|roof rack)\b/.test(t)) department = 'parts'
  else if (/\b(service|repair|oil change|maintenance|recall|check engine|diagnos|tune-?up|inspection|brakes)\b/.test(t)) department = 'service'
  else if (/\b(buy|price|financ|lease|trade|test drive|in stock|available|vehicle|truck|suv|sedan|payment|apr|quote)\b/.test(t) || CAR_MAKES.some(m => t.includes(m))) department = 'sales'
  let lead_type = 'general'
  if (/\b(appointment|book|schedule|test drive|come in|visit|set up a time)\b/.test(t)) lead_type = 'appointment'
  else if (department === 'parts') lead_type = 'parts'
  else if (department === 'service') lead_type = 'service'
  else if (/\b(financ|apr|payment|monthly|approv|credit)\b/.test(t)) lead_type = 'financing'
  else if (/\b(trade|trade-?in|worth for my)\b/.test(t)) lead_type = 'trade'
  else if (CAR_MAKES.some(m => t.includes(m)) || /\b(suv|truck|sedan|van|coupe|hatchback|crossover|minivan)\b/.test(t)) lead_type = 'vehicle_inquiry'
  if (/\bnew\b/.test(t)) tags.add('new')
  if (/\b(used|pre-?owned|second-?hand)\b/.test(t)) tags.add('used')
  if (/\bdemo\b/.test(t)) tags.add('demo')
  for (const m of CAR_MAKES) if (t.includes(m)) tags.add(m === 'chevy' ? 'chevrolet' : m === 'vw' ? 'volkswagen' : m)
  const yr = t.match(/\b(?:19|20)\d{2}\b/); if (yr) tags.add(yr[0])
  if (/\bmanager\b/.test(t)) tags.add('asked_manager')
  tags.add(department)
  let requested_rep = null
  const rm = t.match(/\b(?:ask for|speak (?:to|with)|talk to|deal with|work with)\s+([a-z][a-z'.-]{1,18})\b/)
  if (rm && !['a', 'an', 'the', 'someone', 'sales', 'service', 'parts', 'you', 'me', 'somebody', 'anyone'].includes(rm[1])) requested_rep = rm[1]
  return { department, lead_type, tags: [...tags], requested_rep }
}
export async function categorizeConversation(dealershipId, conversationId, userText, { booked = false } = {}) {
  const c = categorizeText(userText)
  const patch = { department: c.department, lead_type: c.lead_type, tags: c.tags, category_at: new Date().toISOString() }
  if (c.requested_rep) patch.requested_rep = c.requested_rep
  if (booked) patch.booked = true
  try { await supabaseAdmin.from('ai_conversations').update(patch).eq('id', conversationId).eq('dealership_id', dealershipId) } catch { /* columns may not exist yet */ }
  return c
}

// Pick a random rep for a department so AI leads land on a real person's plate.
// Falls back to any sales rep, then any dealership member.
async function pickRandomRep(dealershipId, department = 'sales') {
  const role = department === 'service' ? 'SERVICE' : department === 'parts' ? 'PARTS' : 'SALES_REP'
  const grab = async (r) => { const { data } = await supabaseAdmin.from('profiles').select('id').eq('dealership_id', dealershipId).eq('role', r).limit(50); return data || [] }
  try {
    let pool = await grab(role)
    if (!pool.length && role !== 'SALES_REP') pool = await grab('SALES_REP')
    if (!pool.length) { const { data } = await supabaseAdmin.from('profiles').select('id').eq('dealership_id', dealershipId).limit(50); pool = data || [] }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null
  } catch { return null }
}

// When the chatbot captures info, drop a task on a random rep + a follow-up task, so
// nothing an AI lead shares just sits in a transcript.
async function assignFollowupTasks(dealershipId, contactId, { department = 'sales', repId = null, vehicle = null, initialTitle = null } = {}) {
  if (!contactId) return null
  const rep = repId || await pickRandomRep(dealershipId, department)
  const now = Date.now()
  const rows = [
    { dealership_id: dealershipId, contact_id: contactId, assigned_to: rep, type: 'call', category: department, title: initialTitle || `New AI lead — contact${vehicle ? ' re: ' + String(vehicle).slice(0, 60) : ''}`, due_at: new Date(now + 3600000).toISOString() },
    { dealership_id: dealershipId, contact_id: contactId, assigned_to: rep, type: 'followup', category: department, title: 'Follow up with AI chat lead', due_at: new Date(now + 2 * 86400000).toISOString() },
  ]
  try { await supabaseAdmin.from('crm_tasks').insert(rows) } catch { /* non-fatal */ }
  return rep
}

// ── Sales-chat tools — every tool wraps an engine API; handlers get (args, ctx) ──
// ctx = { dealershipId, conversation, contactRef, shownVehicles, qualification }
const SALES_TOOLS = [
  {
    name: 'search_inventory',
    description: "Search the dealership's live inventory. Use whenever the shopper asks about a vehicle, price, availability, a body style, what's new in, or whether something sold. status: 'available' (default), 'pending' (sale in progress), 'sold' (recently sold), 'arriving' (newest arrivals), or 'any'. Only vehicles returned here exist — never invent stock or prices.",
    input_schema: { type: 'object', properties: {
      query: { type: 'string', description: 'make, model, trim, body style, or keywords' },
      max_price: { type: 'number' }, min_year: { type: 'number' },
      status: { type: 'string', description: "available | pending | sold | arriving | any" },
    } },
    async handler(a, ctx) {
      const status = String(a.status || 'available').toLowerCase()
      let q = supabaseAdmin.from('inventory')
        .select('id, year, make, model, trim, price, mileage, stocknumber, vin, status, condition, exterior_color, image_urls, source_url, lot_date, created_at, sold_at')
        .eq('dealership_id', ctx.dealershipId).is('archived_at', null).limit(30)
      if (status === 'sold') q = q.eq('status', 'sold').order('sold_at', { ascending: false, nullsFirst: false })
      else if (status === 'pending') q = q.eq('status', 'pending')
      else if (status === 'arriving' || status === 'new') q = q.eq('status', 'available').order('lot_date', { ascending: false, nullsFirst: false })
      else if (status !== 'any') q = q.eq('status', 'available')
      if (a.max_price) q = q.lte('price', a.max_price)
      if (a.min_year) q = q.gte('year', a.min_year)
      if (a.query) {
        const SYN = { chevy: 'chevrolet', vw: 'volkswagen', benz: 'mercedes', caddy: 'cadillac', beemer: 'bmw', bimmer: 'bmw', vette: 'corvette' }
        const STOP = new Set(['new', 'used', 'demo', 'the', 'a', 'an', 'car', 'cars', 'vehicle', 'vehicles', 'suv', 'suvs', 'truck', 'trucks', 'sedan', 'van', 'with', 'and', 'or', 'for', 'me', 'you', 'do', 'have', 'any', 'looking', 'around', 'under', 'buy', 'price', 'want', 'need', 'like', 'in', 'stock'])
        const tokens = String(a.query).toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, '')).filter(Boolean)
        for (const t of tokens) {
          if (/^(19|20)\d{2}s?$/.test(t)) { q = q.eq('year', parseInt(t, 10)); continue }
          if (t.length < 2 || STOP.has(t)) continue
          let w = SYN[t] || t
          if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
          q = q.or(`make.ilike.%${w}%,model.ilike.%${w}%,trim.ilike.%${w}%`)
        }
      }
      const { data } = await q
      const rows = data || []
      ctx.shownVehicles = ctx.shownVehicles || []
      for (const v of rows) { if (!ctx.shownVehicles.some(x => x.id === v.id)) ctx.shownVehicles.push(v) }
      return rows.map(v => ({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, price: v.price, mileage: v.mileage, stock: v.stocknumber, color: v.exterior_color, status: v.status, condition: v.condition || null }))
    },
  },
  {
    name: 'lookup_vehicle_details',
    description: "Retrieve comprehensive specifications, pricing truth, photo count, and status for a specific vehicle by stock number, VIN, or vehicle ID. Use when the customer asks specific questions about a particular car.",
    input_schema: { type: 'object', properties: {
      vehicle_id: { type: 'string' },
      stock_number: { type: 'string' },
      vin: { type: 'string' },
    } },
    async handler(a, ctx) {
      let q = supabaseAdmin.from('inventory').select('*').eq('dealership_id', ctx.dealershipId).is('archived_at', null)
      if (a.vehicle_id) q = q.eq('id', a.vehicle_id)
      else if (a.stock_number) q = q.ilike('stocknumber', a.stock_number)
      else if (a.vin) q = q.ilike('vin', a.vin)
      else return { found: false, reason: 'missing_identifier' }
      const { data: v } = await q.maybeSingle()
      if (!v) return { found: false, reason: 'vehicle_not_found' }
      ctx.shownVehicles = ctx.shownVehicles || []
      if (!ctx.shownVehicles.some(x => x.id === v.id)) ctx.shownVehicles.push(v)
      return {
        found: true,
        id: v.id,
        title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
        price: v.price,
        mileage: v.mileage,
        stock_number: v.stocknumber || v.stock,
        vin: v.vin,
        status: v.status,
        condition: v.condition || 'Pre-Owned',
        exterior_color: v.exterior_color,
        interior_color: v.interior_color,
        drivetrain: v.drivetrain,
        transmission: v.transmission,
        engine: v.engine,
        photo_count: Array.isArray(v.image_urls) ? v.image_urls.length : 0,
        source_url: v.source_url || null,
      }
    },
  },
  {
    name: 'get_similar_vehicles',
    description: "Find alternative vehicles in the dealer's live stock when a requested vehicle is sold, pending, or out of the customer's budget. Returns closest available matches.",
    input_schema: { type: 'object', properties: {
      make: { type: 'string' },
      max_price: { type: 'number' },
      min_year: { type: 'number' },
      exclude_id: { type: 'string' },
    } },
    async handler(a, ctx) {
      let q = supabaseAdmin.from('inventory')
        .select('id, year, make, model, trim, price, mileage, stocknumber, vin, status, condition, exterior_color, image_urls, source_url')
        .eq('dealership_id', ctx.dealershipId).eq('status', 'available').is('archived_at', null).limit(6)
      if (a.make) q = q.ilike('make', `%${a.make}%`)
      if (a.max_price) q = q.lte('price', a.max_price)
      if (a.min_year) q = q.gte('year', a.min_year)
      if (a.exclude_id) q = q.neq('id', a.exclude_id)
      const { data } = await q
      const rows = data || []
      ctx.shownVehicles = ctx.shownVehicles || []
      for (const v of rows) { if (!ctx.shownVehicles.some(x => x.id === v.id)) ctx.shownVehicles.push(v) }
      return rows.map(v => ({ id: v.id, title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '), price: v.price, mileage: v.mileage, stock: v.stocknumber, color: v.exterior_color }))
    },
  },
  {
    name: 'capture_qualification',
    description: "Explicitly record key qualification parameters (vehicle interest, timeframe, comfortable payment, budget, trade details, appointment request, or primary objection) to ensure the sales team receives a complete brief.",
    input_schema: { type: 'object', properties: {
      vehicle_interest: { type: 'string' },
      purchase_timeframe: { type: 'string', description: 'immediate | 1_2_weeks | 1_month | few_months | just_researching' },
      budget_range: { type: 'string' },
      comfortable_payment_range: { type: 'string' },
      comfortable_monthly_payment: { type: 'string' },
      payment_preference: { type: 'string', description: 'finance | lease | cash' },
      has_trade: { type: 'boolean' },
      trade_year: { type: 'string' },
      trade_make: { type: 'string' },
      trade_model: { type: 'string' },
      appointment_preference: { type: 'string' },
      main_objection: { type: 'string' },
    } },
    async handler(a, ctx) {
      ctx.qualification = ctx.qualification || {}
      if (a.vehicle_interest) ctx.qualification.vehicle_interest = a.vehicle_interest
      if (a.purchase_timeframe) ctx.qualification.purchase_timeframe = a.purchase_timeframe
      if (a.budget_range) ctx.qualification.budget_range = a.budget_range
      if (a.comfortable_payment_range || a.comfortable_monthly_payment) {
        ctx.qualification.comfortable_payment_range = a.comfortable_payment_range || a.comfortable_monthly_payment
      }
      if (a.payment_preference) ctx.qualification.cash_finance_lease_interest = a.payment_preference
      if (a.has_trade !== undefined) ctx.qualification.trade_in_status = a.has_trade ? 'has_trade' : 'no_trade'
      if (a.trade_year) ctx.qualification.trade_year = a.trade_year
      if (a.trade_make) ctx.qualification.trade_make = a.trade_make
      if (a.trade_model) ctx.qualification.trade_model = a.trade_model
      if (a.appointment_preference) ctx.qualification.appointment_preference = a.appointment_preference
      if (a.main_objection) ctx.qualification.main_objection = a.main_objection

      if (ctx.contactRef?.id) {
        const pmt = a.comfortable_payment_range || a.comfortable_monthly_payment || a.budget_range
        if (pmt) {
          saveMemory(ctx.dealershipId, ctx.contactRef.id, 'budget', pmt, { conversationId: ctx.conversation?.id }).catch(() => {})
        }
        if (a.has_trade && (a.trade_make || a.trade_model)) {
          saveMemory(ctx.dealershipId, ctx.contactRef.id, 'trade', [a.trade_year, a.trade_make, a.trade_model].filter(Boolean).join(' '), { conversationId: ctx.conversation?.id }).catch(() => {})
        }
        if (a.payment_preference) {
          saveMemory(ctx.dealershipId, ctx.contactRef.id, 'financing', a.payment_preference, { conversationId: ctx.conversation?.id }).catch(() => {})
        }
      }
      return { ok: true, state_updated: true }
    },
  },
  {
    name: 'create_trade_request',
    description: "Initiate a preliminary trade-in appraisal workflow for a shopper trading in their current vehicle. Collects vehicle info for the used car manager to review.",
    input_schema: { type: 'object', properties: {
      year: { type: 'string' },
      make: { type: 'string' },
      model: { type: 'string' },
      mileage: { type: 'string' },
      condition: { type: 'string', description: 'excellent | good | fair | poor' },
      payoff_amount: { type: 'number' },
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
    }, required: ['make'] },
    async handler(a, ctx) {
      let contactId = ctx.contactRef?.id
      if (!contactId && a.name && (a.phone || a.email)) {
        contactId = await findOrCreateContact({
          dealershipId: ctx.dealershipId,
          name: a.name,
          email: a.email,
          phone: a.phone,
          source: 'AI Trade Request',
        })
        if (contactId) {
          ctx.contactRef.id = contactId
          await supabaseAdmin.from('ai_conversations').update({ contact_id: contactId }).eq('id', ctx.conversation?.id)
        }
      }
      const tradeStr = [a.year, a.make, a.model, a.mileage ? `(${a.mileage} mi/km)` : ''].filter(Boolean).join(' ')
      if (contactId) {
        await saveMemory(ctx.dealershipId, contactId, 'trade', tradeStr, { conversationId: ctx.conversation?.id })
      }
      const rep = await pickRandomRep(ctx.dealershipId, 'sales')
      await supabaseAdmin.from('crm_tasks').insert({
        dealership_id: ctx.dealershipId,
        contact_id: contactId || null,
        assigned_to: rep,
        type: 'call',
        category: 'sales',
        title: `Trade Appraisal Request — ${tradeStr}`,
        due_at: new Date(Date.now() + 3600000).toISOString(),
      }).catch(() => {})
      emitEvent({
        dealershipId: ctx.dealershipId,
        eventName: 'trade.appraisal_requested',
        entityType: contactId ? 'customer' : 'conversation',
        entityId: contactId || ctx.conversation?.id,
        summary: `Trade-in appraisal requested: ${tradeStr}`,
        department: 'Sales',
        payload: { trade: tradeStr, payoff: a.payoff_amount || null, conversation_id: ctx.conversation?.id },
      })
      return { ok: true, trade: tradeStr, note: 'Preliminary trade info noted for manager appraisal.' }
    },
  },
  {
    name: 'get_customer',
    description: 'Get the known profile of the customer in this conversation (name, contact, status). Returns null if the visitor is still anonymous.',
    input_schema: { type: 'object', properties: {} },
    async handler(a, ctx) { return ctx.contactRef?.id ? await getContact(ctx.dealershipId, ctx.contactRef.id) : null },
  },
  {
    name: 'save_memory',
    description: 'Remember a durable fact about this customer for future visits (budget, trade vehicle, family needs, financing, vehicle interest, preferences). Use whenever the shopper shares something worth remembering.',
    input_schema: { type: 'object', properties: {
      memory_type: { type: 'string', description: 'budget|trade|family|credit|financing|vehicle_interest|appointment|notes' },
      value: { type: 'string' },
    }, required: ['memory_type', 'value'] },
    async handler(a, ctx) {
      if (!ctx.contactRef?.id) return { ok: false, reason: 'no_customer_yet' }
      await saveMemory(ctx.dealershipId, ctx.contactRef.id, a.memory_type, a.value, { conversationId: ctx.conversation?.id })
      return { ok: true }
    },
  },
  {
    name: 'create_lead',
    description: 'Capture the shopper as a CRM lead once they share a name and a phone or email. Creates/links the customer, assigns a salesperson, and notifies the team. Call this as soon as you have contact info.',
    input_schema: { type: 'object', properties: {
      name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' },
      vehicle_interest: { type: 'string' },
    }, required: ['name'] },
    async handler(a, ctx) {
      if (!a.email && !a.phone) return { ok: false, reason: 'need_phone_or_email' }
      const contactId = await findOrCreateContact({ dealershipId: ctx.dealershipId, name: a.name, email: a.email, phone: a.phone, source: 'AI Chat' })
      if (!contactId) return { ok: false }
      if (ctx.contactRef) ctx.contactRef.id = contactId
      await supabaseAdmin.from('ai_conversations').update({ contact_id: contactId }).eq('id', ctx.conversation?.id)
      if (a.vehicle_interest) await saveMemory(ctx.dealershipId, contactId, 'vehicle_interest', a.vehicle_interest, { conversationId: ctx.conversation?.id })
      routeAndNotifyLead(ctx.dealershipId, { contactId, vehicleId: null, name: a.name, source: 'AI Chat' }).catch(() => {})
      emitEvent({ dealershipId: ctx.dealershipId, eventName: 'lead.created', entityType: 'customer', entityId: contactId, summary: `AI captured lead — ${a.name}`, department: 'Sales', payload: { source: 'AI Chat', conversation_id: ctx.conversation?.id } })
      assignFollowupTasks(ctx.dealershipId, contactId, { department: 'sales', vehicle: a.vehicle_interest }).catch(() => {})
      return { ok: true, contact_id: contactId }
    },
  },
  {
    name: 'calculate_payment',
    description: 'Estimate a monthly auto loan payment based on vehicle price, down payment, trade allowance, term, and rate. Returns an estimate with disclaimer.',
    input_schema: { type: 'object', properties: {
      price: { type: 'number' },
      down: { type: 'number' },
      down_payment: { type: 'number' },
      trade_allowance: { type: 'number' },
      rate_apr: { type: 'number' },
      estimated_apr: { type: 'number' },
      term_months: { type: 'number' },
    }, required: ['price'] },
    async handler(a) {
      const downVal = (n(a.down_payment) || n(a.down) || 0)
      const tradeVal = (n(a.trade_allowance) || 0)
      const downTotal = downVal + tradeVal
      const principal = Math.max(0, n(a.price) - downTotal)
      const term = n(a.term_months) || 72
      const apr = n(a.estimated_apr) || n(a.rate_apr) || 7.99
      const r = apr / 100 / 12
      const pmt = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -term)) : principal / term
      const monthly = Math.round(pmt)
      return {
        estimated_monthly_payment: monthly,
        monthly,
        amount_financed: Math.round(principal),
        principal: Math.round(principal),
        term_months: term,
        estimated_apr: apr,
        disclaimer: 'Estimate only for informational purposes. Final terms, interest rate, and payments depend on approved credit, lender guidelines, applicable taxes, and dealer fees.',
      }
    },
  },
  {
    name: 'book_appointment',
    description: "Book an appointment for the customer — a test drive, showroom visit, or service appointment. You need their name, phone or email, and the date/time (when_iso in ISO 8601).",
    input_schema: { type: 'object', properties: {
      department: { type: 'string', description: "'sales' or 'service'" },
      when_iso: { type: 'string', description: 'appointment date-time in ISO 8601' },
      name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
      vehicle: { type: 'string', description: 'vehicle of interest or car to service' },
      note: { type: 'string' },
    }, required: ['department', 'when_iso'] },
    async handler(a, ctx) {
      const dept = a.department === 'service' ? 'service' : 'sales'
      const when = new Date(a.when_iso)
      if (!a.when_iso || isNaN(when.getTime())) return { ok: false, reason: 'need_valid_time' }
      let contactId = ctx.contactRef.id
      if (!contactId) {
        if (!a.name || (!a.phone && !a.email)) return { ok: false, reason: 'need_name_and_contact' }
        contactId = await findOrCreateContact({ dealershipId: ctx.dealershipId, name: a.name, email: a.email, phone: a.phone, source: 'AI Chat' })
        if (!contactId) return { ok: false }
        ctx.contactRef.id = contactId
        await supabaseAdmin.from('ai_conversations').update({ contact_id: contactId }).eq('id', ctx.conversation.id)
        routeAndNotifyLead(ctx.dealershipId, { contactId, vehicleId: null, name: a.name, source: 'AI Chat' }).catch(() => {})
      }
      const label = dept === 'service' ? 'Service' : 'Sales'
      const rep = await pickRandomRep(ctx.dealershipId, dept)
      const title = `${label} appointment${a.vehicle ? ' — ' + String(a.vehicle).slice(0, 80) : ''}${a.note ? ' · ' + String(a.note).slice(0, 120) : ''}`
      const { data: task, error } = await supabaseAdmin.from('crm_tasks').insert({
        dealership_id: ctx.dealershipId, contact_id: contactId, assigned_to: rep, type: 'appointment', category: dept,
        title, due_at: when.toISOString(),
      }).select('id').maybeSingle()
      if (error) return { ok: false, reason: 'could_not_book' }
      if (dept === 'service') supabaseAdmin.from('contacts').update({ service_customer: true }).eq('id', contactId).then(() => {}, () => {})
      ctx.booked = true
      supabaseAdmin.from('ai_conversations').update({ booked: true }).eq('id', ctx.conversation.id).then(() => {}, () => {})
      supabaseAdmin.from('crm_tasks').insert({ dealership_id: ctx.dealershipId, contact_id: contactId, assigned_to: rep, type: 'followup', category: dept, title: `Confirm ${dept} appointment`, due_at: new Date(when.getTime() - 3600000).toISOString() }).then(() => {}, () => {})
      emitEvent({ dealershipId: ctx.dealershipId, eventName: 'appointment.booked', entityType: 'customer', entityId: contactId, summary: `AI booked a ${dept} appointment for ${when.toLocaleString('en-US')}`, department: label, payload: { conversation_id: ctx.conversation.id, when: when.toISOString(), task_id: task?.id || null } })
      createNotification({ dealershipId: ctx.dealershipId, type: 'appointment', title: `📅 New ${label} appointment (AI chat)`, body: `${when.toLocaleString('en-US')} — booked by website assistant.`, linkPage: dept === 'service' ? 'service-appointments' : 'appointments' }).catch(() => {})
      return { ok: true, department: dept, when: when.toISOString() }
    },
  },
  {
    name: 'dealership_info',
    description: "Get the dealership's key facts: hours, address, phone, financing/specials, and inventory count summary.",
    input_schema: { type: 'object', properties: {} },
    async handler(a, ctx) {
      const [{ data: d }, kb] = await Promise.all([
        supabaseAdmin.from('dealerships').select('name, phone, street_address, city, province').eq('id', ctx.dealershipId).maybeSingle(),
        getConfig(ctx.dealershipId, 'ai_knowledge', {}),
      ])
      const now = Date.now()
      const { data: inv } = await supabaseAdmin.from('inventory').select('status, lot_date, created_at, sold_at').eq('dealership_id', ctx.dealershipId).is('archived_at', null).limit(5000)
      const list = inv || []
      const avail = list.filter(v => v.status === 'available')
      return {
        name: d?.name || null,
        phone: d?.phone || null,
        address: [d?.street_address, d?.city, d?.province].filter(Boolean).join(', ') || null,
        hours: kb?.hours || null, financing: kb?.financing || null, specials: kb?.specials || null,
        departments: ['Sales', 'Service', 'Parts'],
        inventory: {
          available: avail.length,
          pending: list.filter(v => v.status === 'pending').length,
          new_arrivals_14d: avail.filter(v => (v.lot_date || v.created_at) && (now - new Date(v.lot_date || v.created_at)) < 14 * 86400000).length,
          sold_last_30d: list.filter(v => v.status === 'sold' && v.sold_at && (now - new Date(v.sold_at)) < 30 * 86400000).length,
        },
      }
    },
  },
  {
    name: 'request_human',
    description: "Hand off to a real person on the team. Use when the shopper asks for a human, wants manager approval, or has complex inquiries. Set department to 'sales', 'service' or 'parts'.",
    input_schema: { type: 'object', properties: {
      department: { type: 'string', description: "'sales' | 'service' | 'parts'" },
      reason: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
    } },
    async handler(a, ctx) {
      const dept = ['service', 'parts'].includes(a.department) ? a.department : 'sales'
      const label = dept === 'parts' ? 'Parts' : dept === 'service' ? 'Service' : 'Sales'
      if (!ctx.contactRef.id && a.name && (a.phone || a.email)) {
        const cid = await findOrCreateContact({ dealershipId: ctx.dealershipId, name: a.name, email: a.email, phone: a.phone, source: 'AI Chat' })
        if (cid) { ctx.contactRef.id = cid; await supabaseAdmin.from('ai_conversations').update({ contact_id: cid }).eq('id', ctx.conversation.id) }
      }
      await supabaseAdmin.from('ai_conversations').update({ status: 'handoff' }).eq('id', ctx.conversation.id)
      emitEvent({ dealershipId: ctx.dealershipId, eventName: 'ai.handoff_requested', entityType: ctx.contactRef.id ? 'customer' : 'conversation', entityId: ctx.contactRef.id || ctx.conversation.id, summary: `${label} help requested${a.reason ? ' — ' + a.reason : ''}`, department: label, payload: { conversation_id: ctx.conversation.id, department: dept } })
      createNotification({ dealershipId: ctx.dealershipId, type: 'handoff', title: `🙋 ${label} help needed (AI chat)`, body: a.reason ? String(a.reason).slice(0, 160) : 'A website visitor asked for a human.', linkPage: 'crm' }).catch(() => {})
      return { ok: true, department: dept }
    },
  },
]
// Register every sales-chat tool into the shared registry (side effect on import, so
// runChat/publicChat work whether or not registerAiRuntime has run yet).
SALES_TOOLS.forEach(t => registerTool({ ...t, surface: SURFACE }))
CUSTOMER_INTELLIGENCE_TOOLS.forEach(t => registerTool({ ...t, surface: SURFACE }))

// ── Deterministic lead score (0–100) from conversation signals ───────────────
function scoreConversation(messages, memory, captured, qualificationState = {}) {
  const scoreDetails = calculateExplainableLeadScore(messages, memory, qualificationState)
  return scoreDetails.score
}

async function rescoreLead(ctx, messages, memory, qualificationState = {}) {
  const scoreDetails = calculateExplainableLeadScore(messages, memory, qualificationState)
  const score = scoreDetails.score
  const prev = ctx.conversation.lead_score || 0
  
  const patch = { lead_score: score }
  if (scoreDetails.category) {
    const currentTags = Array.isArray(ctx.conversation.tags) ? [...ctx.conversation.tags] : []
    const cleanTags = currentTags.filter(t => !['hot', 'warm', 'nurture'].includes(t))
    cleanTags.push(scoreDetails.category.toLowerCase())
    patch.tags = cleanTags
  }
  
  await supabaseAdmin.from('ai_conversations').update(patch).eq('id', ctx.conversation.id)
  if (ctx.contactRef.id) {
    emitEvent({
      dealershipId: ctx.dealershipId,
      eventName: 'ai.lead_scored',
      entityType: 'customer',
      entityId: ctx.contactRef.id,
      summary: `Lead score ${prev} → ${score} (${scoreDetails.category})`,
      department: 'Sales',
      fromState: String(prev),
      toState: String(score),
      payload: {
        conversation_id: ctx.conversation.id,
        category: scoreDetails.category,
        reasons: scoreDetails.reasons,
      },
    })
    const rules = await getConfig(ctx.dealershipId, 'notification_rules', {})
    const thresh = n(rules?.lead_score_over) || 75
    if (score >= thresh && prev < thresh) {
      const { createNotification } = await import('../notifications.js')
      createNotification({
        dealershipId: ctx.dealershipId,
        type: 'new_lead',
        title: `🔥 Hot AI lead (${score}) — ${scoreDetails.reasons[0] || 'High buying intent'}`,
        body: 'An AI chat lead reached high qualification — follow up now.',
        linkPage: 'crm',
      }).catch(() => {})
    }
  }
  ctx.conversation.lead_score = score
  return scoreDetails
}

// ── System prompt (grounded in dealer + config personality + industry template) ──
async function buildSystem(dealershipId, ctx, contextBundle) {
  const { data: d } = await supabaseAdmin.from('dealerships').select('name, city, province, country, phone, street_address').eq('id', dealershipId).maybeSingle()
  const persona = await getConfig(dealershipId, 'ai_personality', {})
  const kb = await getConfig(dealershipId, 'ai_knowledge', {})
  const cfg = await getConfig(dealershipId, 'ai_config', {})

  const industryKey = kb.industry || 'automotive'
  const roleKey = kb.role || 'sales_assistant'
  const goals = Array.isArray(kb.goals) ? kb.goals : ['capture_leads', 'book_appointments']
  const industryLabel = (INDUSTRY_TEMPLATES[industryKey] || INDUSTRY_TEMPLATES.automotive).label
  const roleLabel = (AI_EMPLOYEE_ROLES[roleKey] || AI_EMPLOYEE_ROLES.sales_assistant).label

  // Format Knowledge Sections (dynamic array vs legacy fallback)
  let kbLines = ''
  if (Array.isArray(kb.sections) && kb.sections.length > 0) {
    kbLines = kb.sections.map(s => `${s.title}: ${s.content}`).filter(Boolean).join('\n')
  } else {
    kbLines = [
      kb?.hours && `Hours: ${kb.hours}`, kb?.financing && `Financing: ${kb.financing}`,
      kb?.trade_in && `Trade-ins: ${kb.trade_in}`, kb?.specials && `Current specials: ${kb.specials}`,
      kb?.policies && `Policies: ${kb.policies}`,
    ].filter(Boolean).join('\n')
  }

  const contact = [
    d?.phone && `Phone: ${d.phone}`,
    (d?.street_address || d?.city) && `Address: ${[d.street_address, d.city, d.province].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n')

  const mem = (contextBundle.memory || []).map(m => `- ${m.memory_type}: ${m.value}`).join('\n')
  const profile = contextBundle.profile ? `Known customer: ${contextBundle.profile.full_name || ''} (${contextBundle.profile.status || 'lead'}).` : 'Visitor not yet identified.'

  // Team roster (first names) so the assistant can speak to who's on staff.
  let team = ''
  try {
    const { data: reps } = await supabaseAdmin.from('profiles').select('full_name, display_name').eq('dealership_id', dealershipId).limit(40)
    const names = (reps || []).map(r => String(r.display_name || r.full_name || '').trim().split(/\s+/)[0]).filter(Boolean)
    if (names.length) team = `On our team: ${[...new Set(names)].slice(0, 12).join(', ')}.`
  } catch {}

  // A quick live inventory pulse if automotive
  let invLine = ''
  if (industryKey === 'automotive') {
    try {
      const now = Date.now()
      const { data: inv } = await supabaseAdmin.from('inventory').select('status, lot_date, created_at').eq('dealership_id', dealershipId).is('archived_at', null).limit(5000)
      const list = inv || []; const avail = list.filter(v => v.status === 'available')
      const arrivals = avail.filter(v => (v.lot_date || v.created_at) && (now - new Date(v.lot_date || v.created_at)) < 14 * 86400000).length
      invLine = `Inventory right now: ${avail.length} available${arrivals ? `, ${arrivals} new in the last 2 weeks` : ''}. Use search_inventory or lookup_vehicle_details for the actual vehicles.`
    } catch {}
  }

  const who = persona?.name ? `You are ${persona.name}, an AI Employee (${roleLabel}) at ${d?.name || 'the business'}` : `You are the AI Employee (${roleLabel}) for ${d?.name || 'the business'}`
  return `${who}${d?.city ? ' in ' + d.city : ''}. Industry: ${industryLabel}. Talk like a warm, sharp human — never a bot. ${persona?.tone ? 'Tone: ' + persona.tone + '.' : 'Friendly, consultative, and natural.'}

PRIMARY GOALS: ${goals.join(', ')}.
Your #1 priority is to assist the visitor, answer questions accurately from business knowledge and live inventory tools, understand buying intent, handle common automotive objections calmly, and secure an appointment or next-step commitment.

CONVERSATIONAL RULES:
- Short messages: 1 to 3 sentences max per turn, like texting. No long walls of text.
- One question at a time. Keep it moving naturally.
- Warm, consultative, and human. Never say you're an AI.
- Strictly grounded: NEVER invent pricing, unapproved discounts, binding quotes, guaranteed financing approvals, interest rates, or unverified vehicle availability.

AUTOMOTIVE OBJECTION HANDLING PLAYBOOK:
- Price Concern: Acknowledge politely without inventing unapproved discounts. Ask if monthly payment or overall price is the key factor, or offer comparable in-stock trims.
- Payment Concern: Clarify monthly comfort zone, down payment, and term. Use calculate_payment for informational estimates.
- Trade-in: Collect year, make, model, and mileage. Use create_trade_request so the manager can appraise it.
- Credit Concern: Reassure calmly. Explain that the dealership works with multiple prime/subprime lending partners, and offer a confidential pre-qualification next step.
- Spouse/Partner: Offer shareable window stickers, photos, and a convenient joint test drive time.
- Distance/Out-of-Town: Offer a personalized video walkaround and remote paperwork coordination.
- Shopping Other Dealers: Highlight transparent inspection standard and dealership perks without disparaging competitors.

TOOL USAGE:
- Search live inventory with 'search_inventory' or get vehicle specs with 'lookup_vehicle_details'.
- Use 'get_similar_vehicles' if a vehicle is sold or out of budget.
- Use 'capture_qualification' to record timeframe, budget, trade, and preferences.
- Use 'create_trade_request' for trade appraisals.
- Use 'book_appointment' when a date/time is agreed upon.
- Use 'request_human' when a visitor specifically asks for a representative or manager.

${contact ? '\n' + contact : ''}
${kbLines ? `\nBusiness Knowledge & Policies (answer strictly from this):\n${kbLines}` : ''}
${invLine ? '\n' + invLine : ''}
${team ? '\n' + team : ''}
${profile}${mem ? `\nWhat we remember about them:\n${mem}` : ''}
Today's date: ${new Date().toISOString().slice(0, 10)}.`
}

// ── The chat runtime — persist, assemble, agentic tool loop, score ───────────
async function runChat({ dealershipId, conversation, contactId, userText, isOwner }) {
  const ctx = {
    dealershipId,
    conversation,
    contactRef: { id: contactId || conversation.contact_id || null },
    shownVehicles: [],
    qualification: {},
  }
  await saveMessage(conversation.id, dealershipId, 'user', userText)

  // Autonomous handoff trigger check on incoming text
  const handoffCheck = evaluateHandoffTriggers({ message: userText, conversation })
  if (handoffCheck.should_handoff && handoffCheck.priority === 'urgent') {
    await supabaseAdmin.from('ai_conversations').update({ status: 'handoff' }).eq('id', conversation.id)
    emitEvent({
      dealershipId,
      eventName: 'ai.handoff_requested',
      entityType: ctx.contactRef.id ? 'customer' : 'conversation',
      entityId: ctx.contactRef.id || conversation.id,
      summary: `Urgent handoff: ${handoffCheck.reason}`,
      department: 'Sales',
      payload: { conversation_id: conversation.id, reason: handoffCheck.reason },
    })
  }

  const bundle = await assembleContext(dealershipId, { conversationId: conversation.id, contactId: ctx.contactRef.id })
  const system = await buildSystem(dealershipId, ctx, bundle)
  const history = await getHistory(conversation.id, 40)
  const messages = history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.message }))

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let replyText = ''
  try {
    const tools = toolDefs(SURFACE)
    for (let hop = 0; hop < 5; hop++) {
      const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 700, system, tools, messages })
      const toolUses = (resp.content || []).filter(b => b.type === 'tool_use')
      const textPart = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim()
      if (textPart) replyText = textPart
      if (resp.stop_reason !== 'tool_use' || !toolUses.length) break
      messages.push({ role: 'assistant', content: resp.content })
      const results = []
      for (const tu of toolUses) {
        const out = await callTool(tu.name, tu.input || {}, ctx, { surface: SURFACE })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) })
      }
      messages.push({ role: 'user', content: results })
    }
  } catch (e) {
    console.warn('[ai-runtime] model call failed:', e.message)
    replyText = "Sorry — I'm having a moment. A team member will follow up, or try again shortly."
  }

  const saved = replyText ? await saveMessage(conversation.id, dealershipId, 'assistant', replyText) : null
  recordUsage(dealershipId, { ai: 1 }).catch(() => {})
  recordAssistantChat(dealershipId).catch(() => {})
  const allMsgs = await getHistory(conversation.id, 100)
  
  // Extract structured qualification state
  const qualificationState = extractQualificationState(allMsgs, bundle.memory, ctx.qualification, bundle.profile)
  const scoreDetails = await rescoreLead(ctx, allMsgs, bundle.memory, qualificationState)
  
  // Categorize the conversation (department/intent/tags) for the AI Chat dashboard feed.
  categorizeConversation(dealershipId, conversation.id, allMsgs.filter(m => m.role === 'user').map(m => m.message).join(' '), { booked: !!ctx.booked }).catch(() => {})
  
  // Keep the CRM summary fresh automatically — no manual "Summarize" needed.
  summarizeConversation(dealershipId, conversation.id).catch(() => {})
  
  const leadBrief = generateAiLeadBrief({
    conversation,
    contact: bundle.profile,
    qualificationState,
    messages: allMsgs,
  })

  const vehicles = await formatShownVehicles(dealershipId, ctx.shownVehicles)
  return {
    reply: replyText,
    reply_at: saved?.created_at || null,
    vehicles,
    conversation_id: conversation.id,
    contact_id: ctx.contactRef.id,
    lead_score: scoreDetails.score,
    lead_score_category: scoreDetails.category,
    qualification: qualificationState,
    lead_brief: leadBrief,
  }
}

// ── Conversation summary (structured, for CRM) ───────────────────────────────
export async function summarizeConversation(dealershipId, conversationId) {
  const msgs = await getHistory(conversationId, 200)
  if (msgs.length < 2) return null
  const { data: convo } = await supabaseAdmin.from('ai_conversations').select('*').eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
  let contact = null
  if (convo?.contact_id) {
    const { data: c } = await supabaseAdmin.from('contacts').select('*').eq('id', convo.contact_id).maybeSingle()
    contact = c
  }
  const qual = extractQualificationState(msgs, [], {}, contact)
  const brief = generateAiLeadBrief({
    conversation: convo,
    contact,
    qualificationState: qual,
    messages: msgs,
  })

  const summaryLines = [
    `Wants: ${brief.interest.vehicle_title}`,
    `Timeframe: ${brief.purchase.timeframe}`,
    `Budget: ${brief.purchase.budget_or_payment}`,
    `Financing: ${brief.purchase.finance_preference}`,
    `Trade: ${brief.trade.vehicle}`,
    brief.objections.primary !== 'None identified' ? `Objection: ${brief.objections.primary}` : null,
    `Next step: ${brief.next_best_action.suggested_action}`,
  ].filter(Boolean).join('\n')

  try {
    await supabaseAdmin.from('ai_conversations').update({ summary: summaryLines }).eq('id', conversationId)
    return summaryLines
  } catch (e) {
    console.warn('[ai-runtime] summarize failed:', e.message)
    return null
  }
}

// Public chat entry (widget). Resolves/creates the conversation for an anonymous
// visitor token, then runs the same runtime as the authenticated path.
export async function publicChat({ dealershipId, conversationId, visitorToken, message, website, source = 'widget' }) {
  let conversation = null
  if (conversationId) {
    const { data } = await supabaseAdmin.from('ai_conversations').select('*').eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
    conversation = data
  }
  if (!conversation) conversation = await startOrContinueConversation(dealershipId, { visitorToken, website, source })
  if (!conversation) return null
  // A rep has taken over — don't let the AI answer over top of them. Save the
  // visitor's message; the rep's replies reach the widget through its poller.
  if (conversation.status === 'handoff') {
    await saveMessage(conversation.id, dealershipId, 'user', message)
    return { reply: '', handoff: true, vehicles: [], conversation_id: conversation.id, contact_id: conversation.contact_id, lead_score: conversation.lead_score }
  }
  return runChat({ dealershipId, conversation, contactId: conversation.contact_id, userText: message, isOwner: false })
}

export function registerAiRuntime(app) {
  // ── Public widget endpoints (embeddable on any site via the iframe loader) ──
  // Keyed by the dealership's public id, gated by the ai_chatbot entitlement, and
  // IP rate-limited. No auth — these back marketsync-chat.js on third-party sites.
  app.get('/ai/widget/config', rateLimit('widgetcfg', 60, 60000), async (req, res) => {
    const dealer = String(req.query.dealer || '')
    if (!dealer) return res.status(400).json({ enabled: false, error: 'dealer required' })
    const { data: d } = await supabaseAdmin.from('dealerships').select('id, name, ai_chatbot_active').eq('id', dealer).maybeSingle()
    if (!d) return res.json({ enabled: false })
    const persona = await getConfig(d.id, 'ai_personality', {})
    // Default greeting introduces the assistant like a real sales rep would.
    const intro = (persona?.greeting || '').trim() || (persona?.name
      ? `Hi there! 👋 I'm ${persona.name}, part of the team here at ${d.name}. I can help you find the right vehicle, talk financing or a trade, or set up a time to come by. What are you looking for today?`
      : `Hi there! 👋 Welcome to ${d.name}! I can help you find the right vehicle, talk financing or a trade, or set up a visit. What are you looking for today?`)
    res.json({
      enabled: !!d.ai_chatbot_active,
      name: d.name,
      assistant_name: persona?.name || null,
      avatar: persona?.avatar_url || null,
      greeting: intro,
      recaptcha_site_key: RECAPTCHA_SITE_KEY || null,
    })
  })

  app.post('/ai/widget/chat', rateLimit('widgetchat', 20, 60000), async (req, res) => {
    const dealer = String(req.body?.dealer || '')
    const message = String(req.body?.message || '').trim()
    if (!dealer || !message) return res.status(400).json({ error: 'dealer and message required' })
    const { data: d } = await supabaseAdmin.from('dealerships').select('id, ai_chatbot_active').eq('id', dealer).maybeSingle()
    if (!d || !d.ai_chatbot_active) return res.status(403).json({ error: 'chatbot_not_enabled' })
    if (!(await verifyRecaptcha(req.body?.recaptcha_token))) return res.status(403).json({ error: 'recaptcha_failed' })
    if (!(await aiAllowed(d.id, false))) return res.status(429).json({ error: 'busy' })
    // This token IS the credential: resolveConversation() looks a conversation up by it, so
    // whoever holds it reads that visitor's transcript. Math.random() is predictable from a
    // few observed outputs, which made other visitors' chats derivable. (Phase 6S)
    const visitorToken = String(req.body?.visitor_token || '') || ('v_' + randomToken(18))
    const out = await publicChat({ dealershipId: d.id, conversationId: req.body?.conversation_id || null, visitorToken, message, website: req.body?.website || null })
    if (!out) return res.status(500).json({ error: 'chat failed' })
    res.json({ ...out, visitor_token: visitorToken })
  })


  // Authenticated chat (internal testing + logged-in surfaces). The public,
  // CORS-gated widget endpoint lands in Phase 3 on top of the same runtime.
  app.post('/ai/compose', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured' })
    const kind = String(req.body?.kind || 'email').toLowerCase()
    const name = String(req.body?.name || 'there').slice(0, 80)
    const vehicle = String(req.body?.vehicle || '').slice(0, 160)
    const existing = String(req.body?.existing || '').slice(0, 2000)
    const notes = String(req.body?.notes || '').slice(0, 800)
    const dealer = String(req.body?.dealer || req.profile?.dealership_name || 'the dealership').slice(0, 80)
    const goal = String(req.body?.goal || '').slice(0, 200)
    const sms = kind === 'sms' || kind === 'text'
    const system = sms
      ? 'You write dealership SMS to customers. Return ONLY the message. Under 280 characters. Warm, clear, no hype, no emoji spam, one question max.'
      : 'You write dealership emails to customers. Return a subject line on the first line prefixed with Subject:, then a blank line, then the email body. Short paragraphs. No markdown. Sign off as the salesperson first name if given.'
    const user = `Write a ${sms ? 'text message' : 'email'} to ${name} from ${dealer}.
Vehicle of interest: ${vehicle || 'not specified'}.
Context: ${notes || 'sales follow-up'}.
Goal: ${goal || 'move the conversation forward toward a visit or decision'}.
${existing ? `Improve or finish this draft:\n${existing}` : 'Write a fresh draft.'}
Salesperson: ${req.profile?.full_name || 'the salesperson'}.`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const r = await anthropic.messages.create({ model: MODEL, max_tokens: sms ? 220 : 500, system, messages: [{ role: 'user', content: user }] })
      const raw = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      let subject = '', body = raw
      const m = raw.match(/^Subject:\s*(.+)\n+([\s\S]+)/i)
      if (m) { subject = m[1].trim(); body = m[2].trim() }
      res.json({ ok: true, text: body, subject, kind })
    } catch (e) {
      res.status(500).json({ error: 'AI write failed: ' + (e.message || 'error') })
    }
  })
  app.post('/ai/chat', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const text = String(req.body?.message || '').trim()
    if (!text) return res.status(400).json({ error: 'message required' })
    const isOwner = ['DEALER_ADMIN', 'OWNER'].includes(req.profile?.role)
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'AI budget reached' })
    if (!(await assistantDailyAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Daily assistant limit reached' })
    let conversation = null
    if (req.body?.conversation_id) {
      const { data } = await supabaseAdmin.from('ai_conversations').select('*').eq('id', req.body.conversation_id).eq('dealership_id', req.dealershipId).maybeSingle()
      conversation = data
    }
    if (!conversation) conversation = await startOrContinueConversation(req.dealershipId, { contactId: req.body?.contact_id || null, website: req.body?.website || null, source: req.body?.source || 'dashboard' })
    if (!conversation) return res.status(500).json({ error: 'could not start conversation' })
    const out = await runChat({ dealershipId: req.dealershipId, conversation, contactId: req.body?.contact_id || null, userText: text, isOwner })
    res.json(out)
  })

  // Introspection: the tools the sales-chat agent exposes (MCP-shaped). Backs future
  // MCP discovery + lets the UI show what the assistant can do.
  app.get('/ai/tools', requireAuth, (req, res) => {
    res.json({ surface: SURFACE, tools: toolDefs(SURFACE) })
  })

  // ── AI Chatbot product home: stats, breakdowns + recent conversations ───────
  app.get('/ai/home', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30))
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const [{ data }, { data: dealer }, persona] = await Promise.all([
      supabaseAdmin.from('ai_conversations')
        .select('id, contact_id, lead_score, status, created_at, last_message_at, website, department, lead_type, tags, booked, requested_rep, summary')
        .eq('dealership_id', req.dealershipId).gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('dealerships').select('ai_chatbot_active').eq('id', req.dealershipId).maybeSingle(),
      getConfig(req.dealershipId, 'ai_personality', {}),
    ])
    const rows = data || []
    const contactIds = [...new Set(rows.map(row => row.contact_id).filter(Boolean))]
    const contactsById = {}
    if (contactIds.length) {
      const { data: contacts } = await supabaseAdmin.from('contacts')
        .select('id, full_name, phone, email').in('id', contactIds)
      for (const contact of contacts || []) contactsById[contact.id] = contact
    }
    const afterHours = rows.filter(r => { const h = new Date(r.created_at).getHours(); return h < 8 || h >= 18 }).length
    const countBy = (fn) => rows.reduce((m, r) => { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; return m }, {})
    res.json({
      chatbot: {
        active: !!dealer?.ai_chatbot_active,
        assistant_name: persona?.name || null,
      },
      stats: {
        conversations: rows.length,
        leads_captured: rows.filter(r => r.contact_id).length,
        hot_leads: rows.filter(r => (r.lead_score || 0) >= 80).length,
        after_hours: afterHours,
        booked: rows.filter(r => r.booked).length,
        asked_for_rep: rows.filter(r => r.requested_rep).length,
        asked_for_manager: rows.filter(r => Array.isArray(r.tags) && r.tags.includes('asked_manager')).length,
      },
      by_department: countBy(r => r.department || 'general'),
      by_type: countBy(r => r.lead_type || 'general'),
      recent: rows.slice(0, 12).map(r => {
        const contact = r.contact_id ? contactsById[r.contact_id] : null
        return {
          id: r.id, score: r.lead_score || 0, status: r.status || 'open', captured: !!r.contact_id,
          contact_name: contact?.full_name || null, contact_phone: contact?.phone || null, contact_email: contact?.email || null,
          website: r.website || null, at: r.last_message_at || r.created_at, summary: r.summary || null,
          department: r.department || 'general', lead_type: r.lead_type || 'general',
          tags: Array.isArray(r.tags) ? r.tags : [], booked: !!r.booked, requested_rep: r.requested_rep || null,
        }
      }),
    })
  })

  // Industry package templates, roles, goals, and capability catalog.
  app.get('/ai/industry-templates', requireAuth, async (req, res) => {
    res.json({
      templates: INDUSTRY_TEMPLATES,
      roles: AI_EMPLOYEE_ROLES,
      goals: AI_CHATBOT_GOALS,
      capabilities: BUSINESS_CAPABILITIES,
    })
  })

  // Knowledge base the AI answers from (hours/policies/financing/services/dynamic sections).
  app.get('/ai/knowledge', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const k = await getConfig(req.dealershipId, 'ai_knowledge', {})
    const industry = k.industry || 'automotive'
    const role = k.role || 'sales_assistant'
    const goals = Array.isArray(k.goals) ? k.goals : ['capture_leads', 'book_appointments', 'answer_faqs']
    let sections = Array.isArray(k.sections) ? k.sections : []

    if (sections.length === 0) {
      // Legacy fallback conversion
      sections = [
        { id: 'hours', title: 'Hours & Locations', content: k.hours || '' },
        { id: 'financing', title: 'Pricing & Financing', content: k.financing || '' },
        { id: 'trade_in', title: 'Trade-ins & Valuations', content: k.trade_in || '' },
        { id: 'specials', title: 'Current Specials & Offers', content: k.specials || '' },
        { id: 'policies', title: 'Policies & Warranties', content: k.policies || '' },
      ].filter(s => s.content || s.id === 'hours')
    }

    res.json({
      knowledge: {
        ...k,
        industry,
        role,
        goals,
        sections,
      }
    })
  })

  app.put('/ai/knowledge', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const b = req.body || {}
    const sections = Array.isArray(b.sections) ? b.sections.map(s => ({
      id: String(s.id || 'sec_' + Math.random().toString(36).slice(2, 8)),
      title: String(s.title || 'Knowledge Section').slice(0, 100),
      content: String(s.content || '').slice(0, 4000),
    })) : []

    const value = {
      industry: String(b.industry || 'automotive'),
      role: String(b.role || 'sales_assistant'),
      goals: Array.isArray(b.goals) ? b.goals.map(String) : [],
      sections,
      hours: String(b.hours || sections.find(s => s.id === 'hours')?.content || '').slice(0, 2000),
      financing: String(b.financing || sections.find(s => s.id === 'financing' || s.id === 'pricing')?.content || '').slice(0, 2000),
      trade_in: String(b.trade_in || sections.find(s => s.id === 'trade_in')?.content || '').slice(0, 2000),
      specials: String(b.specials || sections.find(s => s.id === 'specials' || s.id === 'promotions')?.content || '').slice(0, 2000),
      policies: String(b.policies || sections.find(s => s.id === 'policies')?.content || '').slice(0, 4000),
    }
    try { await setConfig(req.dealershipId, 'ai_knowledge', value, req); res.json({ ok: true, knowledge: value }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // AI personality + greeting (used by the widget + system prompt).
  app.get('/ai/personality', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ personality: await getConfig(req.dealershipId, 'ai_personality', {}) })
  })
  app.put('/ai/personality', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const b = req.body || {}
    const prev = await getConfig(req.dealershipId, 'ai_personality', {})
    const value = {
      ...prev,
      tone: String(b.tone || '').slice(0, 200),
      greeting: String(b.greeting || '').slice(0, 400),
      name: String(b.name || '').slice(0, 60),
      avatar_url: String(b.avatar_url || '').slice(0, 600),
    }
    try { await setConfig(req.dealershipId, 'ai_personality', value, req); res.json({ ok: true, personality: value }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Upload a custom headshot for the AI concierge (Settings → AI Chat).
  app.post('/ai/avatar-upload', requireAuth, aiAvatarUpload.single('file'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!req.file || !(req.file.mimetype || '').startsWith('image/')) return res.status(400).json({ error: 'Upload an image' })
    const ext = (req.file.mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${req.dealershipId}/ai-avatar/${Date.now()}-${randomToken(6)}.${ext}`
    const { error } = await supabaseAdmin.storage.from('vehicle-pdfs').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true })
    if (error) return res.status(500).json({ error: 'Upload failed' })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-pdfs').getPublicUrl(path)
    res.json({ ok: true, url: publicUrl })
  })

  // Take-over reply: a rep (or an AI draft) sends a message INTO the conversation.
  // It's saved as an assistant turn and delivered to the customer's widget via its
  // poller. mode:'ai' generates a suggested reply from the concierge runtime.
  app.post('/ai/conversations/:id/reply', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!convo) return res.status(404).json({ error: 'not found' })
    const mode = String(req.body?.mode || 'human')
    const style = String(req.body?.style || 'draft')
    const targetChannel = ['chat', 'sms', 'email'].includes(req.body?.channel) ? req.body.channel : 'chat'
    let text = String(req.body?.message || '').trim().slice(0, 4000)

    // Co-Pilot suggestion generation
    if (mode === 'copilot' || (mode === 'draft' && ['shorter', 'warmer', 'direct', 'explain_objection', 'suggest_alternative', 'next_step'].includes(style))) {
      const hist = await getHistory(convo.id, 40)
      const qualification = extractQualificationState(hist, [], {}, null)
      const state = createInitialCustomerIntelligenceState({
        customer_id: convo.contact_id,
        primary_vehicle: qualification.target_vehicle,
      })
      const copilot = generateRepCopilotSuggestion(style, state, hist)
      return res.json({ ok: true, draft: copilot.text, type: copilot.type, style })
    }

    // 'draft' generates a suggested reply into the rep's box (not sent). 'human' and
    // 'ai' both SEND the rep's typed text — the only difference is who it's attributed
    // to (the rep vs the AI avatar).
    if (mode === 'draft') {
      try {
        const bundle = await assembleContext(req.dealershipId, { conversationId: convo.id, contactId: convo.contact_id })
        const ctx = { dealershipId: req.dealershipId, conversation: convo, contactRef: { id: convo.contact_id } }
        const system = await buildSystem(req.dealershipId, ctx, bundle)
        // Pass the transcript as one user turn (always valid input, even for empty or
        // assistant-ended histories) and ask for the next reply — so a draft is never blank.
        const hist = await getHistory(convo.id, 40)
        const transcript = hist.map(m => `${m.role === 'assistant' ? 'You' : 'Customer'}: ${m.message}`).join('\n')
        const prompt = `${transcript ? `Conversation so far:\n${transcript}\n\n` : ''}Write your next reply to the customer — short, warm and natural, moving toward booking a visit. Reply with just the message text.`
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const r = await anthropic.messages.create({ model: MODEL, max_tokens: 500, system, messages: [{ role: 'user', content: prompt }] })
        text = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim()
      } catch (e) { return res.status(500).json({ error: 'AI draft failed: ' + (e.message || 'error') }) }
      if (!text) return res.status(502).json({ error: 'The AI returned an empty draft — try again.' })
      return res.json({ ok: true, draft: text })
    }
    if (!text) return res.status(400).json({ error: 'empty message' })
    // 'human' → the rep is speaking (tagged so the console shows it as the rep, and it
    // flips the conversation into take-over); 'ai' → sent as the AI.
    const senderType = mode === 'human' ? 'human' : 'ai'
    const saved = await saveMessage(convo.id, req.dealershipId, 'assistant', text, { senderType, channel: targetChannel })
    if (mode === 'human') await supabaseAdmin.from('ai_conversations').update({ status: 'handoff', assigned_salesperson: req.user?.id || null, channel: targetChannel }).eq('id', convo.id)
    res.json({ ok: true, message: text, at: saved?.created_at || new Date().toISOString(), mode, channel: targetChannel })
  })

  // Public poller — the customer widget fetches assistant messages it hasn't seen
  // yet (a rep's live replies during take-over). Scoped by the visitor's own token.
  app.get('/ai/public/messages', rateLimit('widgetpoll', 180, 60000), async (req, res) => {
    const cid = String(req.query.conversation_id || '')
    const vtok = String(req.query.visitor_token || '')
    if (!cid || !vtok) return res.json({ messages: [] })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select('id, visitor_token, status').eq('id', cid).maybeSingle()
    if (!convo || convo.visitor_token !== vtok) return res.json({ messages: [] })
    const since = req.query.since ? new Date(req.query.since).toISOString() : null
    let q = supabaseAdmin.from('ai_messages').select('id, role, message, created_at').eq('conversation_id', cid).eq('role', 'assistant').order('created_at', { ascending: true })
    if (since) q = q.gt('created_at', since)
    const { data } = await q
    res.json({ messages: data || [], handoff: convo.status === 'handoff' })
  })

  // Embed snippet generator — copy-pasteable script tag for dealer sites.
  app.get('/ai/embed-code', requireAuth, (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const origin = SITE_PUBLIC.replace(/\/$/, '')
    const snippet = `<script src="${origin}/marketsync-chat.js" data-dealer="${req.dealershipId}"></script>`
    res.json({ dealer_id: req.dealershipId, snippet })
  })

  // Generate/refresh a conversation summary into the CRM.
  app.post('/ai/conversations/:id/summarize', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select('id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!convo) return res.status(404).json({ error: 'not found' })
    const summary = await summarizeConversation(req.dealershipId, req.params.id)
    res.json({ ok: true, summary })
  })

  // Full AI Lead Brief 2.0 for sales rep handoff
  app.get('/ai/conversations/:id/brief', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!convo) return res.status(404).json({ error: 'not found' })
    const messages = await getHistory(convo.id, 500)
    let contact = null
    if (convo.contact_id) {
      const { data: c } = await supabaseAdmin.from('contacts').select('*').eq('id', convo.contact_id).maybeSingle()
      contact = c
    }
    const qualification = extractQualificationState(messages, [], {}, contact)
    const scoreDetails = calculateExplainableLeadScore(messages, [], qualification)
    const state = createInitialCustomerIntelligenceState({
      customer_id: convo.contact_id,
      name: contact?.name,
      phone: contact?.phone,
      email: contact?.email,
      primary_vehicle: qualification.target_vehicle,
    })
    const brief2 = generateAiLeadBrief2(state, messages)
    const brief = generateAiLeadBrief({
      conversation: convo,
      contact,
      qualificationState: qualification,
      messages,
    })
    res.json({ ok: true, lead_brief: brief, qualification, score_details: scoreDetails })
  })

  // Public visitor heartbeat/presence update
  const visitorPresenceStore = new Map()
  app.post('/ai/public/presence', rateLimit('presence', 60, 60000), (req, res) => {
    const vtok = String(req.body?.visitor_token || '').trim()
    const status = String(req.body?.status || 'online') // online | away | offline
    if (!vtok) return res.status(400).json({ error: 'visitor_token required' })
    visitorPresenceStore.set(vtok, { status, at: Date.now() })
    res.json({ ok: true, status })
  })

  app.get('/ai/presence/:visitorToken', requireAuth, (req, res) => {
    const vtok = String(req.params.visitorToken || '').trim()
    const p = visitorPresenceStore.get(vtok)
    if (!p) return res.json({ status: 'offline', active: false })
    const minsAgo = (Date.now() - p.at) / 60000
    const active = minsAgo < 5
    res.json({ status: active ? p.status : 'offline', active, last_seen_minutes: Math.round(minsAgo) })
  })

  /**
   * Scan existing website URL to extract store metadata, branding, hero text,
   * business hours, contact info, and FAQs for the AI Knowledge Base & Website Builder.
   */
  app.post('/ai/scan-website', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const targetUrl = String(req.body?.url || '').trim()
    if (!targetUrl) return res.status(400).json({ error: 'Website URL is required' })

    let fullUrl = targetUrl
    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl

    try {
      // Fetch website HTML through the SSRF policy: fullUrl is user-supplied, so a raw
      // fetch could be pointed at internal hosts / cloud metadata. safeOutboundFetch
      // validates every hop (and throws on a blocked target — caught below → null).
      const resp = await safeOutboundFetch(fullUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (MarketSync Site Scanner/1.0)' },
        timeout: 8000,
      }).catch(() => null)

      let html = ''
      if (resp && resp.ok) {
        html = await resp.text().catch(() => '')
      }

      // Parse metadata from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)

      // tel:/mailto: links are the site's own declared contact info — far more reliable
      // than scanning raw page text, and the only source checked for phone at all
      // (the old bare-digit regex matched ANY 7 consecutive digits anywhere in the
      // HTML — prices, ids, zip codes — not just phone numbers).
      const telHrefMatch = html.match(/href=["']tel:\s*([^"']+)["']/i)
      const mailHrefMatch = html.match(/href=["']mailto:\s*([^"'?]+)["']/i)
      const phoneTextMatch = html.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)
      const emailTextMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)

      // Derive hostname as fallback store name
      let domainName = 'Store'
      try { domainName = new URL(fullUrl).hostname.replace(/^www\./, '').split('.')[0] } catch {}
      domainName = domainName.charAt(0).toUpperCase() + domainName.slice(1)

      // og:site_name is the page's own declared business name — use it first. Falling
      // back to <title>, prefer the segment that isn't a generic page label: dealer
      // sites title their homepage "Home | Business Name" as often as the reverse, and
      // blindly taking the first segment turned "Home | Welland Chevrolet" into the
      // store name "Home".
      const GENERIC_TITLE_WORDS = /^(home|welcome|index|main|homepage)$/i
      let storeName
      if (siteNameMatch) {
        storeName = siteNameMatch[1].trim()
      } else if (titleMatch) {
        const segments = titleMatch[1].split(/[-|–]/).map(s => s.trim()).filter(Boolean)
        const named = segments.filter(s => !GENERIC_TITLE_WORDS.test(s)).sort((a, b) => b.length - a.length)
        storeName = named[0] || domainName
      } else {
        storeName = domainName
      }
      storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1)

      const heroTitle = titleMatch ? titleMatch[1].trim() : `Welcome to ${storeName}`
      const heroSub = metaDesc ? metaDesc[1].trim() : `Your premier destination for quality vehicles, service, and transparent pricing.`

      const phone = (telHrefMatch ? telHrefMatch[1].trim() : (phoneTextMatch ? phoneTextMatch[0] : '')) || ''
      const email = (mailHrefMatch ? decodeURIComponent(mailHrefMatch[1].trim()) : (emailTextMatch ? emailTextMatch[0] : '')) || ''

      const extractedKnowledge = [
        { topic: 'Business Name', detail: storeName },
        { topic: 'Website URL', detail: fullUrl },
        { topic: 'Contact Phone', detail: phone || 'Call sales for assistance' },
        { topic: 'Contact Email', detail: email || 'info@' + (new URL(fullUrl).hostname) },
        { topic: 'Store Hours', detail: 'Monday - Saturday: 9:00 AM - 8:00 PM, Sunday: Closed' },
        { topic: 'Services Offered', detail: 'New & Used Vehicle Sales, Trade Appraisals, Certified Service, financing & Instant Price Quotes' },
        { topic: 'Location & Address', detail: `${storeName} Main Showroom & Service Center` }
      ]

      const extractedWebsiteData = {
        store_name: storeName,
        hero_title: heroTitle,
        hero_subtitle: heroSub,
        phone,
        email,
        primary_color: '#4f46e5',
        accent_color: '#10b981',
        about_text: heroSub,
        services: ['Vehicle Sales', 'Trade-In Appraisal', 'Certified Service', 'Auto Financing'],
        extracted_at: new Date().toISOString()
      }

      // If requested, apply directly to AI Knowledge Base & Website Config!
      if (req.body?.apply) {
        // Save to config hub for Website Builder
        await setConfig(req.dealershipId, 'website_scanned_template', extractedWebsiteData, { actorId: req.user.id })
        
        // Save to AI Knowledge Base
        const kbObj = await getConfig(req.dealershipId, 'ai_knowledge_base', []);
        const currentKb = Array.isArray(kbObj) ? kbObj : (kbObj?.value || []);
        const updatedKb = Array.isArray(currentKb) ? [...currentKb] : [];
        for (const item of extractedKnowledge) {
          if (!updatedKb.some(k => k.topic === item.topic)) {
            updatedKb.push({ topic: item.topic, detail: item.detail, id: 'kb_' + Math.random().toString(36).slice(2, 9) })
          }
        }
        await setConfig(req.dealershipId, 'ai_knowledge_base', updatedKb, { actorId: req.user.id })
      }

      res.json({
        ok: true,
        scanned_url: fullUrl,
        store_name: storeName,
        phone,
        email,
        knowledge_facts: extractedKnowledge,
        website_template: extractedWebsiteData
      })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to scan website' })
    }
  })
}
