import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import { supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL, browserFetch } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { hasPermission, requirePermission } from '../authorization.js'
import { requestHasCronSecret } from '../cron-auth.js'
import { marketcheckMarket, marketcheckListings, marketcheckEnabled, marketcheckCompetitorStats, marketcheckPing, marketcheckDecodeVin, marketcheckPredictPrice, marketcheckMarketStats } from '../marketcheck.js'
import { getMarketData, getSoldData, recordUsage, aiAllowed, getUsage, getAssistantUsage, assistantDailyAllowed, recordAssistantChat, ASSISTANT_DAILY_LIMIT, marketcheckAllowed, recordMarketcheckCall } from '../usage.js'
import { findOrCreateContact } from './crm.js'
import { buildEquityRadar } from './equity.js'
import { buildMarketingRoi } from './marketing.js'
import { createNotification, createNotifications } from '../notifications.js'
import { runPhotoVision, scoreVehiclePhotos } from '../sync/photoVision.js'
import { fetchOemWindowStickerPdf } from '../utils/oemWindowSticker.js'
import { lookupPlate, plateLookupConfigured } from '../providers/plateLookup.js'
import { audit, AuditAction } from '../audit.js'
import {
  isPlatformOwner, attachOemStickerToInventory, LANG_NAME, langName,
  PRODUCT_KB, ASSISTANT_TOOLS, REPORT_TOPICS,
  buildDealershipReport, runAssistantTool,
  skipPriceComp, PRICE_MIN_COMPS, buildPriceFlag, aiErrorMessage,
  marketMedianForScan, median, mileageAdjustedMedian,
  computeDailyDigest,
} from './ai-helpers.js'
import { registerAiPricing } from './ai-pricing.js'
import { registerAiAppraisalRoutes } from './submodules/ai-appraisal.js'
import { registerAiAppraisalManagementRoutes } from './submodules/ai-appraisal-management.js'
import { registerAiAssistantChatRoutes } from './submodules/ai-assistant-chat.js'
import { registerAiReportsCronRoutes } from './submodules/ai-reports-cron.js'
import { registerAiDesignStudioRoutes } from './submodules/ai-design-studio.js'
import { SMART_MODEL } from '../aiModels.js'
import { normalizeCommissionImport, commissionImportSummary } from '../commission-plan-import.js'

// ── MarketSync AI Employee Platform Catalogs ─────────────────────────────────

export const BUSINESS_CAPABILITIES = Object.freeze([
  { id: 'business.lookup_product', name: 'business.lookup_product', label: 'Lookup Products & Items', desc: 'Search and display available products, items, or inventory listings.' },
  { id: 'business.lookup_service', name: 'business.lookup_service', label: 'Lookup Services & Pricing', desc: 'Provide details on offered services, treatments, packages, and fee rules.' },
  { id: 'business.lookup_contact', name: 'business.lookup_contact', label: 'Lookup Customer Record', desc: 'Identify returning customers and retrieve CRM profile history.' },
  { id: 'business.book_appointment', name: 'business.book_appointment', label: 'Book Appointments & Calls', desc: 'Check schedule availability and book consultations or service visits.' },
  { id: 'business.capture_lead', name: 'business.capture_lead', label: 'Capture & Qualify Leads', desc: 'Collect contact details, purchase timeframe, and customer intent.' },
  { id: 'business.create_quote_request', name: 'business.create_quote_request', label: 'Generate Quote Estimates', desc: 'Collect project details to generate instant price quotes.' },
  { id: 'business.send_message', name: 'business.send_message', label: 'Send SMS & Email Follow-ups', desc: 'Dispatch confirmation texts, emails, or summary updates.' },
  { id: 'business.escalate_to_human', name: 'business.escalate_to_human', label: 'Escalate to Human Staff', desc: 'Hand off live conversations to staff, managers, or duty reps.' },
  { id: 'business.lookup_order', name: 'business.lookup_order', label: 'Lookup Orders & Status', desc: 'Check status of pending orders, tickets, or reservations.' },
  { id: 'business.lookup_inventory', name: 'business.lookup_inventory', label: 'Lookup Automotive Inventory', desc: 'Search real-time vehicle lot inventory, VINs, and pricing.' },
  { id: 'business.lookup_availability', name: 'business.lookup_availability', label: 'Lookup Operating Hours', desc: 'Answer questions on business hours, locations, and staff schedules.' },
  { id: 'business.take_action', name: 'business.take_action', label: 'Execute Custom Actions', desc: 'Run industry-specific actions and workflow triggers.' },
])

export const INDUSTRY_TEMPLATES = Object.freeze({
  automotive: {
    id: 'automotive',
    label: 'Automotive Dealership',
    desc: 'Sales, vehicle inventory, VIN decoding, trade appraisals, service appointments & finance.',
    defaultRole: 'sales_assistant',
    defaultGoals: ['capture_leads', 'book_appointments', 'qualify_prospects', 'sell_products', 'handoff_staff'],
    defaultCapabilities: ['business.lookup_inventory', 'business.book_appointment', 'business.capture_lead', 'business.create_quote_request', 'business.escalate_to_human', 'business.send_message'],
  },
  home_services: {
    id: 'home_services',
    label: 'Home Services & Contractors',
    desc: 'Quote requests, service area verification, project qualification, photo uploads & bookings.',
    defaultRole: 'lead_qualifier',
    defaultGoals: ['capture_leads', 'generate_quotes', 'book_appointments', 'qualify_prospects'],
    defaultCapabilities: ['business.create_quote_request', 'business.book_appointment', 'business.capture_lead', 'business.lookup_service', 'business.send_message', 'business.escalate_to_human'],
  },
  medical_dental: {
    id: 'medical_dental',
    label: 'Medical, Dental & Healthcare',
    desc: 'Patient appointment booking, insurance verification FAQs, service details & intake.',
    defaultRole: 'receptionist',
    defaultGoals: ['book_appointments', 'answer_faqs', 'collect_intake', 'route_support'],
    defaultCapabilities: ['business.book_appointment', 'business.lookup_service', 'business.collect_intake', 'business.lookup_availability', 'business.escalate_to_human'],
  },
  professional_services: {
    id: 'professional_services',
    label: 'Professional Services',
    desc: 'Legal, accounting, financial advice, consultation booking & client intake.',
    defaultRole: 'booking_assistant',
    defaultGoals: ['book_appointments', 'qualify_prospects', 'collect_intake', 'answer_faqs'],
    defaultCapabilities: ['business.book_appointment', 'business.capture_lead', 'business.lookup_service', 'business.collect_intake', 'business.escalate_to_human'],
  },
  retail: {
    id: 'retail',
    label: 'Retail & E-Commerce',
    desc: 'Product recommendations, order tracking, returns policy & store hours.',
    defaultRole: 'sales_assistant',
    defaultGoals: ['sell_products', 'answer_faqs', 'route_support'],
    defaultCapabilities: ['business.lookup_product', 'business.lookup_order', 'business.capture_lead', 'business.lookup_availability', 'business.send_message'],
  },
  real_estate: {
    id: 'real_estate',
    label: 'Real Estate & Property',
    desc: 'Property listings, tour scheduling, buyer/seller qualification & market inquiries.',
    defaultRole: 'lead_qualifier',
    defaultGoals: ['capture_leads', 'book_appointments', 'qualify_prospects'],
    defaultCapabilities: ['business.lookup_product', 'business.book_appointment', 'business.capture_lead', 'business.create_quote_request', 'business.escalate_to_human'],
  },
  hospitality: {
    id: 'hospitality',
    label: 'Hospitality & Restaurants',
    desc: 'Table reservations, menu questions, catering leads, dietary FAQs & event inquiries.',
    defaultRole: 'receptionist',
    defaultGoals: ['book_appointments', 'answer_faqs', 'capture_leads'],
    defaultCapabilities: ['business.book_appointment', 'business.lookup_service', 'business.capture_lead', 'business.lookup_availability'],
  },
  other: {
    id: 'other',
    label: 'General Business',
    desc: 'Custom business configurations for any company or service.',
    defaultRole: 'custom',
    defaultGoals: ['answer_faqs', 'capture_leads', 'book_appointments'],
    defaultCapabilities: ['business.capture_lead', 'business.book_appointment', 'business.lookup_service', 'business.escalate_to_human'],
  },
})

export const AI_EMPLOYEE_ROLES = Object.freeze({
  sales_assistant: { id: 'sales_assistant', label: 'Sales Assistant', desc: 'Friendly, persuasive, focuses on qualifying & converting prospects.' },
  support_assistant: { id: 'support_assistant', label: 'Support Assistant', desc: 'Helpful, patient, resolves inquiries & routes technical issues.' },
  receptionist: { id: 'receptionist', label: 'Front Desk & Receptionist', desc: 'Warm, welcoming, manages scheduling, hours & greetings.' },
  booking_assistant: { id: 'booking_assistant', label: 'Booking Specialist', desc: 'Efficient, scheduling-focused, secures time slots & consultations.' },
  lead_qualifier: { id: 'lead_qualifier', label: 'Lead Qualifier', desc: 'Asks targeted questions, collects contact details & evaluates intent.' },
  service_advisor: { id: 'service_advisor', label: 'Service Advisor', desc: 'Detail-oriented, books maintenance, repairs & estimates.' },
  custom: { id: 'custom', label: 'Custom AI Employee', desc: 'Fully custom persona and system instructions.' },
})

export const AI_CHATBOT_GOALS = Object.freeze({
  capture_leads: { id: 'capture_leads', label: 'Capture Leads', desc: 'Collect names, emails, phones, and purchase intent.' },
  book_appointments: { id: 'book_appointments', label: 'Book Appointments', desc: 'Schedule time slots, consultations, or service visits.' },
  answer_faqs: { id: 'answer_faqs', label: 'Answer FAQs', desc: 'Answer questions about hours, location, policies, and services.' },
  qualify_prospects: { id: 'qualify_prospects', label: 'Qualify Prospects', desc: 'Score and evaluate leads based on budget, urgency, and fit.' },
  sell_products: { id: 'sell_products', label: 'Sell Products / Items', desc: 'Recommend products, vehicle inventory, or services.' },
  route_support: { id: 'route_support', label: 'Route Support Inquiries', desc: 'Help existing customers and route tickets to staff.' },
  generate_quotes: { id: 'generate_quotes', label: 'Generate Quotes / Estimates', desc: 'Collect details needed to prepare price quotes.' },
  collect_intake: { id: 'collect_intake', label: 'Collect Intake Details', desc: 'Gather new patient or client intake information.' },
  handoff_staff: { id: 'handoff_staff', label: 'Hand Off to Human Staff', desc: 'Connect high-intent visitors directly to human staff.' },
})

const ASSISTANT_TOOL_CATALOG = [
  ...BUSINESS_CAPABILITIES.map(c => ({ name: c.id, label: c.label, desc: c.desc })),
  { name: 'dealership_report', label: 'Dealership data & reports', desc: "Answer from the store's own numbers — sales, gross, F&I, per-rep, leads, aging, priorities, pricing, equity, marketing ROI." },
  { name: 'customer_lookup', label: 'Customer lookup', desc: "Find a specific customer by name/phone/email and summarize their status, rep, interest, last activity and deal." },
  { name: 'inventory_lookup', label: 'Inventory lookup', desc: "Find a specific unit by stock #/VIN/description — price, mileage, days on lot, photo health and price-vs-market." },
  { name: 'market_snapshot', label: 'Live market snapshot', desc: 'Active listing count, median price and days-on-market for a make/model (uses market data).' },
  { name: 'decode_vin', label: 'VIN decode', desc: 'Decode a 17-character VIN into a full spec sheet.' },
  { name: 'predict_price', label: 'Price prediction', desc: 'Model-comparable predicted retail price + confidence band for a VIN (uses market data).' },
  { name: 'propose_action', label: 'Take actions (with confirmation)', desc: 'Let the assistant set up a task or a bulk text/email — always requires the user to confirm before anything runs.' },
]

export function registerAI(app) {
  registerAiPricing(app)   // inventory-intelligence / pricing / vision / competitor routes
  registerAiAppraisalRoutes(app)
  registerAiAppraisalManagementRoutes(app)
  registerAiAssistantChatRoutes(app)
  registerAiReportsCronRoutes(app)
  registerAiDesignStudioRoutes(app)
  // GET /ai/config — returns dealership's AI config
  app.get('/ai/config', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email, vin_sticker_active, inv_intel_active, ai_vision_active, ai_boost_paid, inv_intel_paid, full_access_until, photo_background_url, country, province, city, postal_code, daily_digest_enabled, legal_name, street_address, phone, fax, hst_number, omvic_reg, plan, fb_only, desk_fees, ai_assistant_name, ai_internal_style, ai_customer_style, ai_knowledge, ai_knowledge_name, ai_tools_disabled, ai_assistant_reps, cost_tracking_enabled, cost_rep_visible, autoresponder_mode, autoresponder_channel, appraisal_recon_default, appraisal_gross_default, allow_quick_add_trade')
      .eq('id', req.dealershipId)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    const isOwner = isPlatformOwner(req)

    // 30-day full-access onboarding: everything is on until full_access_until. This
    // is the self-healing expiry — the first config load after the window closes
    // drops each add-on to whatever was actually paid for. (A cron sweep is the
    // backstop for dealers who aren't logged in.)
    const fa = data.full_access_until ? new Date(data.full_access_until) : null
    const fullAccess = !!fa && fa.getTime() > Date.now()
    if (fa && !fullAccess) {
      await supabaseAdmin.from('dealerships').update({
        ai_boost_active: !!data.ai_boost_paid,
        inv_intel_active: !!data.inv_intel_paid,
        full_access_until: null,
      }).eq('id', req.dealershipId)
      data.ai_boost_active = !!data.ai_boost_paid
      data.inv_intel_active = !!data.inv_intel_paid
      data.full_access_until = null
    }

    // Entitlement model:
    //  • AI Boost is the master switch for ALL AI (listing copy, price reports,
    //    AI Vision, generated/branded sticker & brochure, AI lot narrative).
    //  • Inventory Intelligence includes the VIN decoder + factory OEM docs.
    //  • The AI lot narrative inside Inv Intel needs AI Boost too.
    const aiBoost = isOwner || fullAccess || !!data.ai_boost_active
    const invIntel = true
    const trialDaysLeft = fullAccess ? Math.ceil((fa.getTime() - Date.now()) / 86400000) : 0
    res.json({
      ...data,
      allow_quick_add_trade: data.allow_quick_add_trade !== false,
      ai_boost_active: aiBoost,
      inv_intel_active: invIntel,
      vin_sticker_active: invIntel,      // VIN decoder is part of Inventory Intelligence
      ai_docs_active: aiBoost,           // generated/branded sticker & AI brochure
      ai_vision_active: aiBoost,         // AI Vision folded into AI Boost
      full_access: fullAccess,           // in the 30-day everything-on window
      full_access_until: data.full_access_until,
      trial_days_left: trialDaysLeft,
      // Facebook-only tier: strip the dashboard to the Facebook hub + leaderboard.
      // Owners and dealers still inside the 30-day everything-on window see it all.
      fb_only: !isOwner && !fullAccess && !!data.fb_only,
      // Photo tools: is a branded background set, and is the AI cutout provider keyed?
      photo_background_url: data.photo_background_url || null,
      background_provider_ready: !!process.env.REMOVEBG_API_KEY,
      // Trade appraisal: is a plate→VIN provider provisioned? (hides the plate UI if not)
      plate_lookup_ready: plateLookupConfigured(),
      // Assistant management: the tools that can be toggled, with friendly labels.
      ai_tools_catalog: ASSISTANT_TOOL_CATALOG,
      ai_tools_disabled: Array.isArray(data.ai_tools_disabled) ? data.ai_tools_disabled : [],
      ai_assistant_reps: data.ai_assistant_reps !== false,
    })
  })

  // GET /ai/usage — consumption for the AI management panel. Today's assistant
  // questions vs the daily cap + this month's AI/MarketCheck ops vs the soft quota.
  app.get('/ai/usage', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      const [monthly, assistant] = await Promise.all([
        getUsage(req.dealershipId),
        getAssistantUsage(req.dealershipId),
      ])
      res.json({ ok: true, assistant, monthly })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Could not load usage' })
    }
  })

  // PUT /ai/config — dealership-wide configuration needs a verified MFA session
  // and the explicit settings authority, not a legacy profile role.
  app.put('/ai/config', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { ai_tone, ai_required_fields, ai_manager_email, ai_boost_active, country, province, city, postal_code, daily_digest_enabled,
      legal_name, street_address, phone, fax, hst_number, omvic_reg } = req.body
    const update = {}
    if (ai_tone !== undefined) update.ai_tone = ai_tone
    if (ai_required_fields !== undefined) update.ai_required_fields = ai_required_fields
    if (ai_manager_email !== undefined) update.ai_manager_email = ai_manager_email
    if (ai_boost_active !== undefined) update.ai_boost_active = ai_boost_active
    if (daily_digest_enabled !== undefined) update.daily_digest_enabled = !!daily_digest_enabled
    // Market/location — drives US-vs-Canada pricing and comp searches.
    if (country !== undefined) update.country = (country || '').trim() || null
    if (province !== undefined) update.province = (province || '').trim() || null
    if (city !== undefined) update.city = (city || '').trim() || null
    if (postal_code !== undefined) update.postal_code = (postal_code || '').trim() || null
    // Legal identifiers + full contact for the OMVIC deal documents.
    if (legal_name !== undefined) update.legal_name = (legal_name || '').trim() || null
    if (street_address !== undefined) update.street_address = (street_address || '').trim() || null
    if (phone !== undefined) update.phone = (phone || '').trim() || null
    if (fax !== undefined) update.fax = (fax || '').trim() || null
    if (hst_number !== undefined) update.hst_number = (hst_number || '').trim() || null
    if (omvic_reg !== undefined) update.omvic_reg = (omvic_reg || '').trim() || null
    // Trade appraisal defaults (managers): reconditioning allowance + target gross.
    if (req.body.appraisal_recon_default !== undefined) { const n = Number(req.body.appraisal_recon_default); update.appraisal_recon_default = Number.isFinite(n) && n >= 0 ? n : null }
    if (req.body.appraisal_gross_default !== undefined) { const n = Number(req.body.appraisal_gross_default); update.appraisal_gross_default = Number.isFinite(n) && n >= 0 ? n : null }
    // Vehicle-cost tracking (internal gross): on/off + whether sales reps can see it.
    if (req.body.cost_tracking_enabled !== undefined) update.cost_tracking_enabled = !!req.body.cost_tracking_enabled
    if (req.body.cost_rep_visible !== undefined) update.cost_rep_visible = !!req.body.cost_rep_visible
    // Management policy: allow quick add trade-in without full appraisal
    if (req.body.allow_quick_add_trade !== undefined) update.allow_quick_add_trade = !!req.body.allow_quick_add_trade
    // Instant AI lead auto-responder: off / draft / auto, email or SMS.
    if (req.body.autoresponder_mode !== undefined) update.autoresponder_mode = ['off', 'draft', 'auto'].includes(req.body.autoresponder_mode) ? req.body.autoresponder_mode : 'off'
    if (req.body.autoresponder_channel !== undefined) update.autoresponder_channel = req.body.autoresponder_channel === 'sms' ? 'sms' : 'email'
    // AI persona/style prompts + knowledge base. Style prompts steer tone/voice;
    // the knowledge base is grounding text both the internal assistant and the
    // customer chat can draw on. Bounded so they can't blow up the prompt/cost.
    if (req.body.ai_assistant_name !== undefined) update.ai_assistant_name = (req.body.ai_assistant_name || '').toString().trim().slice(0, 60) || null
    if (req.body.ai_internal_style !== undefined) update.ai_internal_style = (req.body.ai_internal_style || '').toString().trim().slice(0, 2000) || null
    if (req.body.ai_customer_style !== undefined) update.ai_customer_style = (req.body.ai_customer_style || '').toString().trim().slice(0, 2000) || null
    if (req.body.ai_knowledge !== undefined) update.ai_knowledge = (req.body.ai_knowledge || '').toString().trim().slice(0, 12000) || null
    if (req.body.ai_knowledge_name !== undefined) update.ai_knowledge_name = (req.body.ai_knowledge_name || '').toString().trim().slice(0, 200) || null
    // Assistant capability controls (management page): which tools are turned off
    // (validated against the real tool set), and whether sales reps may use it.
    if (req.body.ai_tools_disabled !== undefined) {
      const valid = new Set(ASSISTANT_TOOLS.map(t => t.name))
      update.ai_tools_disabled = Array.isArray(req.body.ai_tools_disabled)
        ? [...new Set(req.body.ai_tools_disabled.filter(n => valid.has(n)))]
        : []
    }
    if (req.body.ai_assistant_reps !== undefined) update.ai_assistant_reps = !!req.body.ai_assistant_reps
    // Deal-desk fee schedule set by management: [{name, amount, taxable, locked}].
    // `locked` fees can't be edited per-deal on the desk; unlocked ones can.
    if (req.body.desk_fees !== undefined) {
      update.desk_fees = Array.isArray(req.body.desk_fees)
        ? req.body.desk_fees.slice(0, 30).map(f => ({
            name: String(f?.name || '').trim().slice(0, 80),
            amount: Math.max(0, Number(f?.amount) || 0),
            taxable: f?.taxable !== false,
            locked: f?.locked === true,
          })).filter(f => f.name)
        : null
    }

    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .update(update)
      .eq('id', req.dealershipId)
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email, country, province, city, postal_code, daily_digest_enabled, legal_name, street_address, phone, fax, hst_number, omvic_reg, desk_fees, ai_assistant_name, ai_internal_style, ai_customer_style, ai_knowledge, ai_knowledge_name, cost_tracking_enabled, cost_rep_visible, autoresponder_mode, autoresponder_channel, appraisal_recon_default, appraisal_gross_default')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    // Audit sensitive setting changes — especially the internal-cost visibility flags.
    const changed = Object.keys(update)
    if (changed.length) audit(req, AuditAction.CONFIG_UPDATED, { fields: changed })
    if (req.body.cost_tracking_enabled !== undefined || req.body.cost_rep_visible !== undefined) {
      audit(req, AuditAction.COST_VISIBILITY_CHANGED, {
        cost_tracking_enabled: !!data.cost_tracking_enabled,
        cost_rep_visible: !!data.cost_rep_visible,
      })
    }
    res.json(data)
  })

  // POST /ai/knowledge-upload — extract text from an uploaded KB file (txt/md/csv,
  // or a text-based PDF) and store it as the dealership knowledge base.
  app.post('/ai/knowledge-upload', requireAuth, requireMfa, requirePermission('settings.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const name = String(req.body?.name || 'knowledge').slice(0, 200)
    let text = String(req.body?.text || '')
    // The client extracts plain text for txt/md/csv and sends it directly. For PDFs it
    // sends the raw text it could pull; we just store whatever text arrives, trimmed.
    text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000)
    if (!text) return res.status(400).json({ error: 'Couldn’t read any text from that file — paste the text instead.' })
    const { error } = await supabaseAdmin.from('dealerships')
      .update({ ai_knowledge: text, ai_knowledge_name: name }).eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: 'Could not save the knowledge base.' })
    audit(req, AuditAction.CONFIG_UPDATED, { fields: ['ai_knowledge', 'ai_knowledge_name'], source: 'knowledge_upload' })
    res.json({ ok: true, name, chars: text.length })
  })

  // POST /ai/enrich-listing — run AI enrichment on an inventory item
  app.post('/ai/enrich-listing', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { inventory_id } = req.body
    if (!inventory_id) return res.status(400).json({ error: 'inventory_id required' })
    // Target language for the Facebook listing copy: an explicit body value, else
    // the posting rep's own preference (set via the Google Translate widget).
    let language = String(req.body?.language || '').trim().slice(0, 40)

    // Fetch inventory item
    const { data: vehicle, error: invErr } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (invErr || !vehicle) return res.status(404).json({ error: 'Inventory item not found' })

    // Fetch dealership AI config + location for market price comps
    const { data: dealer, error: dealerErr } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email, city, province, country, postal_code')
      .eq('id', req.dealershipId)
      .single()
    if (dealerErr) return res.status(500).json({ error: dealerErr.message })

    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer.ai_boost_active) {
      return res.status(403).json({ error: 'AI Boost subscription is not active for this dealership' })
    }
    // Resolve the copy language: explicit request → this rep's saved preference.
    if (!language) {
      const { data: me } = await supabaseAdmin.from('profiles')
        .select('preferred_language').eq('id', req.user.id).maybeSingle()
      language = me?.preferred_language || ''
    }
    language = langName(language)
    // Meter the AI listing-copy generation against the soft AI cap.
    recordUsage(req.dealershipId, { ai: 1 })

    // Check Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features not configured' })
    }

    // ── Missing field checks ──
    const warnings = []
    const requiredFields = dealer.ai_required_fields || ['price', 'mileage', 'image_urls']
    if (requiredFields.includes('price') && (!vehicle.price || Number(vehicle.price) === 0)) {
      warnings.push('Missing or zero price')
    }
    if (requiredFields.includes('mileage') && vehicle.mileage == null) {
      warnings.push('Missing mileage')
    }
    if (requiredFields.includes('image_urls') && (!vehicle.image_urls || vehicle.image_urls.length === 0)) {
      warnings.push('No photos attached')
    }
    if (requiredFields.includes('description') && (!vehicle.description || vehicle.description.length < 20)) {
      warnings.push('Description is missing or too short')
    }

    // Send email alert if there are warnings and manager email is set
    if (warnings.length > 0 && dealer.ai_manager_email && resend) {
      const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
      await resend.emails.send({
        from: EMAIL_FROM,
        to: dealer.ai_manager_email,
        subject: `Missing info alert: ${vehicleLabel}`,
        html: `<p>The following required fields are missing for <strong>${vehicleLabel}</strong> (Stock #${vehicle.stocknumber || 'N/A'}):</p><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul><p>Please update the listing before posting.</p>`
      }).catch(() => {}) // non-blocking — don't fail the request
      // Mirror the email as an in-app notification, deep-linked to the vehicle.
      await createNotification({
        dealershipId: req.dealershipId,
        type: 'email_sent',
        title: `Missing-info email sent: ${vehicleLabel}`,
        body: `Emailed ${dealer.ai_manager_email} — ${warnings.join(', ')}.`,
        linkPage: 'inventory',
        linkFilter: vehicle.stocknumber || vehicle.vin || '',
      })
    }

    // ── Price comp check vs external marketplaces ──
    // Skip for new vehicles — MSRP pricing doesn't need market comp.
    let price_flag = null
    if (!skipPriceComp(vehicle) && vehicle.price && vehicle.make && vehicle.model && vehicle.year) {
      const countryRaw = (dealer?.country || '').trim().toUpperCase()
      const _isUS = countryRaw === 'US' || countryRaw === 'USA' || countryRaw === 'UNITED STATES'
      const _isOwner = isPlatformOwner(req)
      const mm = await marketMedianForScan({ vehicle, dealer, isUS: _isUS, dealershipId: req.dealershipId, isOwner: _isOwner })
      if (mm) price_flag = buildPriceFlag(vehicle.price, mm.median, mm.source, mm.count, mm.matched_on ? !!mm.matched_on.trim : null)
    }

    // ── Generate AI copy via Anthropic ──
    const tone = dealer.ai_tone || 'professional'
    const toneInstruction = tone === 'friendly'
      ? 'Use a warm, approachable, conversational tone. You may use friendly language.'
      : tone === 'aggressive'
        ? 'Use an urgent, deal-focused tone. Emphasize value and urgency.'
        : 'Use a professional, informative tone. Be clear and factual. No emoji.'

    const vehicleDetails = [
      vehicle.year && vehicle.make && vehicle.model
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
        : null,
      vehicle.mileage ? `Mileage: ${Number(vehicle.mileage).toLocaleString()} km` : null,
      vehicle.price ? `Price: $${Number(vehicle.price).toLocaleString()}` : null,
      vehicle.condition ? `Condition: ${vehicle.condition}` : null,
      vehicle.exterior_color ? `Colour: ${vehicle.exterior_color}` : null,
      vehicle.stocknumber ? `Stock #: ${vehicle.stocknumber}` : null,
      vehicle.description ? `Description: ${vehicle.description}` : null,
    ].filter(Boolean).join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let copy = null
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are writing a Facebook Marketplace vehicle listing. ${toneInstruction}

Vehicle details:
${vehicleDetails}

Write a compelling listing in under 280 words. Include the year/make/model/trim, mileage, price, condition, colour, and key highlights from the description. Do not invent details not provided. ${tone !== 'friendly' ? 'No emoji.' : 'Minimal emoji only if it enhances readability.'}${language && !/^en(g|glish)?$/i.test(language) ? `\n\nWrite the entire listing in ${language}. Keep the price, mileage number, VIN and stock number as-is.` : ''}`
          }
        ]
      })
      copy = message.content[0]?.text || null
    } catch (aiErr) {
      return res.status(502).json({ error: aiErrorMessage(aiErr) })
    }

    // Log activity so the dealer can see what AI found
    supabaseAdmin.from('ai_activity').insert({
      dealership_id: req.dealershipId,
      inventory_id,
      actor_id: req.user.id,
      vehicle_label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '),
      warnings: warnings.length > 0 ? warnings : null,
      price_flagged: !!(price_flag?.flagged),
      price_pct_diff: price_flag?.pct_diff ?? null,
      price_median: price_flag?.median ?? null,
      comp_count: price_flag?.comp_count ?? null,
      trim_matched: price_flag?.trim_matched ?? null,
      copy_generated: !!copy
    }).then(() => {}).catch(() => {}) // fire-and-forget

    res.json({ copy, warnings, price_flag })
  })

  // POST /ai/sync-all — run AI enrichment on all active inventory for the dealership
  // Runs in background; returns immediately with a count. Results appear in /ai/activity.
  app.post('/ai/sync-all', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, inv_intel_active, ai_tone, ai_required_fields, ai_manager_email, city, province, country, postal_code')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)
    // The Inventory Scan lives on the Inventory page and is part of the Inventory
    // Intelligence add-on — it refreshes each vehicle's market comps / % to market
    // (a metered MarketCheck call), so we gate it to Inventory Intelligence.
    if (!isOwner && !dealer?.inv_intel_active) {
      return res.status(403).json({ error: 'Inventory Intelligence add-on required' })
    }

    // Light cooldown so "Scan All" can't be hammered (owner exempt). Caching
    // already makes re-scans cheap; this is just abuse protection.
    if (!isOwner) {
      const { data: last } = await supabaseAdmin
        .from('ai_activity').select('created_at')
        .eq('dealership_id', req.dealershipId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      const cooldownMin = Number(process.env.SCAN_COOLDOWN_MIN || 10)
      if (last && (Date.now() - new Date(last.created_at)) < cooldownMin * 60000) {
        return res.status(429).json({ error: `Inventory was just scanned — please wait a few minutes before running it again.` })
      }
    }

    const { data: vehicles, error } = await supabaseAdmin
      .from('inventory')
      .select('id')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')

    if (error) return res.status(500).json({ error: error.message })
    const ids = (vehicles || []).map(v => v.id)
    res.json({ queued: ids.length, message: `Running AI checks on ${ids.length} vehicles…` })

    const _syncIsUS = (() => {
      const c = (dealer?.country || '').trim().toUpperCase()
      return c === 'US' || c === 'USA' || c === 'UNITED STATES'
    })()

    // Run enrichments in the background sequentially to avoid Anthropic rate limits
    ;(async () => {
      for (const inventory_id of ids) {
        // Every vehicle MUST produce exactly one activity row so the progress bar
        // can reach 100%. We build the row defensively and always attempt the
        // insert in a finally block — a scrape/fetch error for one car can never
        // strand the scan at "166 of 167".
        let vehicle = null
        let warnings = []
        let price_flag = null
        try {
          const { data } = await supabaseAdmin
            .from('inventory').select('*').eq('id', inventory_id).single()
          vehicle = data

          if (vehicle) {
            const requiredFields = dealer.ai_required_fields || ['price', 'mileage', 'image_urls']
            if (requiredFields.includes('price') && (!vehicle.price || Number(vehicle.price) === 0)) warnings.push('Missing or zero price')
            if (requiredFields.includes('mileage') && vehicle.mileage == null) warnings.push('Missing mileage')
            if (requiredFields.includes('image_urls') && (!vehicle.image_urls || vehicle.image_urls.length === 0)) warnings.push('No photos attached')
            if (requiredFields.includes('description') && (!vehicle.description || vehicle.description.length < 20)) warnings.push('Description is missing or too short')

            if (!skipPriceComp(vehicle) && vehicle.price && vehicle.make && vehicle.model && vehicle.year) {
              const mm = await marketMedianForScan({ vehicle, dealer, isUS: _syncIsUS, dealershipId: req.dealershipId, isOwner, allowLive: true })
              if (mm) price_flag = buildPriceFlag(vehicle.price, mm.median, mm.source, mm.count, mm.matched_on ? !!mm.matched_on.trim : null)
            }
          }
        } catch {
          // fall through to the guaranteed insert below
        } finally {
          try {
            await supabaseAdmin.from('ai_activity').insert({
              dealership_id: req.dealershipId,
              inventory_id,
              actor_id: req.user.id,
              vehicle_label: vehicle
                ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
                : 'Vehicle',
              warnings: warnings.length > 0 ? warnings : null,
              price_flagged: !!(price_flag?.flagged),
              price_pct_diff: price_flag?.pct_diff ?? null,
              price_median: price_flag?.median ?? null,
              comp_count: price_flag?.comp_count ?? null,
              trim_matched: price_flag?.trim_matched ?? null,
              copy_generated: false
            })
          } catch {}
          await new Promise(r => setTimeout(r, 300)) // gentle rate limiting between vehicles
        }
      }
    })()
  })

  // GET /ai/activity — recent AI enrichment log for the dealership
  app.get('/ai/activity', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const limit = Math.min(Number(req.query.limit) || 200, 500)
    const { data, error } = await supabaseAdmin
      .from('ai_activity')
      .select('id, vehicle_label, warnings, price_flagged, price_pct_diff, price_median, copy_generated, created_at, inventory_id')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return res.status(500).json({ error: error.message })

    // Attach each vehicle's stock number (dealers identify units by stock #, not label).
    const rows = data || []
    const invIds = [...new Set(rows.map(r => r.inventory_id).filter(Boolean))]
    if (invIds.length) {
      const { data: inv } = await supabaseAdmin
        .from('inventory').select('id, stocknumber').in('id', invIds)
      const stockById = new Map((inv || []).map(v => [v.id, v.stocknumber]))
      for (const r of rows) r.stocknumber = r.inventory_id ? (stockById.get(r.inventory_id) || null) : null
    }
    res.json({ activity: rows })
  })

  // GET /ai/marketcheck-status — is the licensed MarketCheck feed configured & live?
  app.get('/ai/marketcheck-status', requireAuth, async (req, res) => {
    res.json(await marketcheckPing())
  })

  // GET /ai/usage — this dealership's monthly live-data / AI usage vs its soft caps.
  app.get('/ai/usage', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ marketcheck: null, ai: null })
    res.json(await getUsage(req.dealershipId))
  })

  // GET /ai/daily-digest — a "today's briefing" of what needs attention on the lot.
  // The signal counts are free for any dealer admin; the one-line summary is an AI
  // Boost enhancement (owner exempt, metered) and falls back to a templated line.
  app.get('/ai/daily-digest', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ items: [], summary: null })
    const isOwner = isPlatformOwner(req)
    res.json(await computeDailyDigest(req.dealershipId, isOwner))
  })

  // POST /ai/lead-reply — draft a tone-matched reply to a Marketplace lead (AI Boost).
  // Two modes: pass { lead_id } to pull the lead from the DB (dashboard Pipeline), OR
  // pass { message, vehicle_label } for an ad-hoc draft from a live Facebook chat (the
  // extension, where no lead row exists).
  app.post('/ai/lead-reply', requireAuth, requirePermission('customer.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { lead_id, message, vehicle_label: vlabelIn } = req.body || {}

    let lead = null
    if (lead_id) {
      const { data } = await supabaseAdmin
        .from('leads').select('id, name, comments, inventory_id')
        .eq('id', lead_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!data) return res.status(404).json({ error: 'Lead not found' })
      lead = data
    } else if (message && String(message).trim()) {
      lead = { name: null, comments: String(message).slice(0, 1500), inventory_id: null }
    } else {
      return res.status(400).json({ error: 'lead_id or message required' })
    }

    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('name, ai_tone, ai_boost_active').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) {
      return res.status(429).json({ error: 'Monthly AI limit reached — resets at the start of next month.' })
    }

    let vehicle = null
    if (lead.inventory_id) {
      const { data } = await supabaseAdmin.from('inventory')
        .select('year, make, model, trim, price, mileage, stocknumber').eq('id', lead.inventory_id).maybeSingle()
      vehicle = data
    }

    const tone = dealer?.ai_tone || 'professional'
    const toneLine = tone === 'friendly' ? 'warm, friendly and personable'
      : tone === 'aggressive' ? 'energetic and deal-focused (but never pushy or rude)'
      : 'professional, clear and courteous'
    const vLabel = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
      : (vlabelIn ? String(vlabelIn).slice(0, 120) : null)
    const vLine = vehicle
      ? `They're asking about: ${vLabel}${vehicle.price ? `, listed at $${Number(vehicle.price).toLocaleString()}` : ''}${vehicle.mileage ? `, ${Number(vehicle.mileage).toLocaleString()} on the odometer` : ''}${vehicle.stocknumber ? ` (stock #${vehicle.stocknumber})` : ''}.`
      : (vLabel ? `They're asking about: ${vLabel}.` : 'No specific vehicle is attached to this lead.')

    const prompt = `You are a salesperson at ${dealer?.name || 'a car dealership'} replying to a customer inquiry that came in from Facebook Marketplace. Write a ${toneLine} reply.
Customer name: ${lead.name || 'there'}.
Their message: "${(lead.comments || '').slice(0, 800) || '(no message text — they tapped "is this still available?")'}"
${vLine}
Guidelines: under 90 words; answer their question if they asked one; confirm the vehicle is available; end by inviting them to book a time to come see it or take a test drive. Do NOT invent specs, financing terms, or prices you weren't given. Return ONLY the reply text — no subject line, no signature, no markdown.`

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 25000)),
      ])
      const draft = (msg?.content?.[0]?.text || '').trim()
      if (!draft) throw new Error('No reply generated')
      recordUsage(req.dealershipId, { ai: 1 })
      res.json({ ok: true, draft, vehicle_label: vLabel })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Scan a driver's licence → structured customer fields ───────────────────
  // A rep snaps the front of a licence; AI Vision reads it and returns the fields
  // to pre-fill a new customer. Nothing is stored here — the rep reviews and saves
  // through the normal add-customer flow. The licence image is NOT persisted.
  app.post('/crm/scan-license', requireAuth, requireMfa, requirePermission('customer.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const isOwner = isPlatformOwner(req)
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('ai_boost_active').eq('id', req.dealershipId).maybeSingle()
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Monthly AI limit reached — resets next month.' })
    const img = String(req.body?.image || '')
    const m = img.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/)
    if (!m) return res.status(400).json({ error: 'Send the licence photo as a base64 data URL.' })
    const media_type = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
    const data = m[3]
    if (data.length > 8_000_000) return res.status(400).json({ error: 'Image too large — retake at normal quality.' })
    const prompt = `You are reading a photo of a driver's licence or government photo ID to help a dealership start a customer record. Extract ONLY what is clearly legible. Return STRICT JSON with these keys (use null when not visible): first_name, last_name, address, city, province_state, postal_code, country, dl_number, date_of_birth (YYYY-MM-DD), expiry (YYYY-MM-DD). Do not guess. Return ONLY the JSON object, no prose.`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: prompt },
        ] }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 30000)),
      ])
      recordUsage(req.dealershipId, { ai: 1 })
      let txt = (msg?.content?.[0]?.text || '').trim().replace(/^```json\s*|\s*```$/g, '')
      let fields
      try { fields = JSON.parse(txt) } catch { return res.status(422).json({ error: 'Could not read the licence clearly — try a sharper, straight-on photo.' }) }
      const full_name = [fields.first_name, fields.last_name].filter(Boolean).join(' ').trim() || null
      res.json({ ok: true, fields: { ...fields, full_name } })
    } catch (e) {
      res.status(500).json({ error: e.message === 'ai timeout' ? 'Reading the licence took too long — try again.' : 'Could not read the licence.' })
    }
  })

  // ── Scan a receipt → structured expense fields ─────────────────────────────
  // Accounting snaps a photo of a receipt; AI Vision reads it and returns the
  // fields to pre-fill an expense (vendor, date, total, tax, a category guess).
  // Nothing is stored here — the user reviews and saves through the normal flow.
  app.post('/accounting/scan-receipt', requireAuth, requireMfa, requirePermission('accounting.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const isOwner = isPlatformOwner(req)
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('ai_boost_active').eq('id', req.dealershipId).maybeSingle()
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'Receipt scanning needs AI Boost' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Monthly AI limit reached — resets next month.' })
    const img = String(req.body?.image || '')
    const m = img.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/)
    if (!m) return res.status(400).json({ error: 'Send the receipt photo as a base64 data URL.' })
    const media_type = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
    const data = m[3]
    if (data.length > 8_000_000) return res.status(400).json({ error: 'Image too large — retake at normal quality.' })
    // Optional: the dealer's expense-account names, so the AI can pick the best fit.
    const categories = Array.isArray(req.body?.categories)
      ? req.body.categories.map(c => String(c || '').slice(0, 60)).filter(Boolean).slice(0, 40) : []
    const catLine = categories.length
      ? `Choose the single best "category" from THIS list (copy it exactly), or null if none clearly fit: ${JSON.stringify(categories)}.`
      : `Give a short "category" guess (e.g. "Fuel", "Office supplies", "Advertising", "Meals", "Repairs", "Parts", "Utilities") or null.`
    const prompt = `You are reading a photo of a purchase RECEIPT to help a car dealership record an expense. Extract ONLY what is clearly legible. Return STRICT JSON with these keys (use null when not visible): vendor (the store/merchant name), date (YYYY-MM-DD), subtotal (number, pre-tax), tax (number, total tax), total (number, grand total actually paid). ${catLine} Numbers must be plain (no currency symbols or commas). Do not guess or invent. Return ONLY the JSON object, no prose.`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: prompt },
        ] }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 30000)),
      ])
      recordUsage(req.dealershipId, { ai: 1 })
      let txt = (msg?.content?.[0]?.text || '').trim().replace(/^```json\s*|\s*```$/g, '')
      let f
      try { f = JSON.parse(txt) } catch { return res.status(422).json({ error: 'Could not read the receipt clearly — try a flatter, well-lit photo.' }) }
      const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }
      res.json({ ok: true, fields: {
        vendor: f.vendor ? String(f.vendor).slice(0, 120) : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : null,
        subtotal: num(f.subtotal), tax: num(f.tax), total: num(f.total),
        category: f.category ? String(f.category).slice(0, 60) : null,
      } })
    } catch (e) {
      res.status(500).json({ error: e.message === 'ai timeout' ? 'Reading the receipt took too long — try again.' : 'Could not read the receipt.' })
    }
  })

  // ── AI copy for the website builder (✨ per-section actions) ────────────────
  // task: rewrite | improve | expand | shorten | generate | seo | faq
  // kind: headline | subheadline | cta | about | faq | seo | text
  app.post('/ai/site-copy', requireAuth, requireMfa, requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const task = String(b.task || 'generate').toLowerCase()
    const kind = String(b.kind || 'text').toLowerCase().slice(0, 30)
    const current = String(b.current || '').slice(0, 2000)
    const hint = String(b.hint || '').slice(0, 200)
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('name, ai_tone, ai_boost_active, city, province').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Monthly AI limit reached — resets next month.' })

    // Canonical tasks + back-compat aliases. The five the dealer asked for are
    // boost / fresh / short / long / seo, plus title (SEO click-worthy hook),
    // links (link-rich description) and meta (page meta description).
    const YEAR = new Date().getFullYear()
    const taskAlias = { improve: 'boost', rewrite: 'fresh', generate: 'fresh', expand: 'long', shorten: 'short' }
    const t = taskAlias[task] || task
    const keyword = String(b.keyword || '').slice(0, 80).trim()
    // Internal link targets the AI may weave in: [{label, href}]. External auth
    // links the AI chooses itself. Both only used for description-style copy.
    const linkTargets = Array.isArray(b.links)
      ? b.links.filter(l => l && l.href).slice(0, 12).map(l => ({ label: String(l.label || '').slice(0, 60), href: String(l.href).slice(0, 200) }))
      : []
    // Description-ish kinds can hold HTML links; short labels stay plain text.
    const RICH_KINDS = ['about', 'body', 'text', 'description', 'paragraph', 'intro']
    const isRich = RICH_KINDS.includes(kind)
    const wantLinks = t === 'links' || (b.with_links === true && isRich)

    const SEO_RULES = `Follow modern ${YEAR} SEO best practices: write for humans first and search engines second. ${keyword ? `Weave the focus keyword "${keyword}" in naturally near the start plus one close variant — never stuff it.` : 'Use the natural language a buyer would search.'} Match search intent, be specific and genuinely useful, use concrete entities (brands, models, city), and keep it scannable.`
    const instr = {
      boost: 'Keep the meaning but make it noticeably sharper — tighter phrasing, stronger verbs, better flow and punch.',
      fresh: 'Rewrite it from scratch with a genuinely new angle and fresh wording — do not lightly reword the original.',
      short: 'Make it shorter and punchier — cut every wasted word while keeping the core message.',
      long: 'Expand it with more useful, specific detail a buyer actually cares about — no filler or fluff.',
      seo: `Rewrite it for search. ${SEO_RULES}`,
      title: `Write ONE SEO-optimized, click-worthy title with a real hook. ${keyword ? `Front-load the keyword "${keyword}".` : ''} Under ~60 characters, specific and compelling (a curiosity or benefit hook), never clickbait that lies. No trailing period.`,
      links: `Rewrite it into an engaging, SEO-aware description (${SEO_RULES}).`,
      meta: `Write ONE meta description of 140–160 characters for this page. ${keyword ? `Include the keyword "${keyword}" naturally near the front.` : ''} Action-oriented, unique, benefit-led. Plain text only.`,
      faq: 'Write 5 genuinely useful FAQ items.',
    }[t] || 'Write fresh, specific copy.'
    const kindHint = {
      headline: 'a distinctive hero headline, 4–9 words (a real headline with a hook, not a generic slogan)',
      subheadline: 'a single supporting subheadline sentence',
      cta: 'a short call-to-action button label (2–4 words)',
      about: 'a warm, specific "about the dealership" paragraph',
      body: 'a section of website body copy',
      text: 'a section of website body copy',
      title: 'an SEO page or section title',
      meta: 'a page meta description',
      faq: 'FAQ content',
      seo: 'SEO website copy',
    }[kind] || 'a short piece of website copy'
    const tone = dealer?.ai_tone === 'friendly' ? 'warm and welcoming' : dealer?.ai_tone === 'aggressive' ? 'energetic and deal-focused' : 'confident and professional'
    const loc = [dealer?.city, dealer?.province].filter(Boolean).join(', ')
    // Real context so copy isn't generic — the makes this dealer actually stocks.
    let makes = []
    try {
      const { data: mk } = await supabaseAdmin.from('inventory').select('make').eq('dealership_id', req.dealershipId).not('make', 'is', null).limit(500)
      const counts = {}
      for (const r of (mk || [])) { const m = (r.make || '').trim(); if (m) counts[m] = (counts[m] || 0) + 1 }
      makes = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0])
    } catch {}
    // Rotate the creative angle each call so repeated clicks give genuinely different lines.
    const ANGLES = [
      'lead with the specific brands or models they carry',
      'lead with local pride and the community they serve',
      'lead with selection and inventory breadth',
      'lead with the buying experience — easy, no-pressure, fast',
      'lead with trust, expertise, and reputation',
      'lead with financing and trade-in ease',
      'lead with a concrete customer benefit or outcome',
      'lead with service, maintenance, and ownership support',
    ]
    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]
    const avoid = Array.isArray(b.avoid) ? b.avoid : (b.avoid ? [String(b.avoid)] : [])
    const avoidLine = [current, ...avoid].filter(Boolean).slice(0, 6).map(s => `"${String(s).slice(0, 120)}"`).join(', ')
    const isFaq = t === 'faq' || kind === 'faq'
    const isTitle = t === 'title'
    const isMeta = t === 'meta' || kind === 'meta'
    // Angle rotation only helps free-form copy; titles/meta/links stay on-brief.
    const angleLine = (isTitle || isMeta || wantLinks) ? '' : `For this version, ${angle}.\n`
    // Link block: give the model the exact internal hrefs to use + rules for one
    // external authority link. HTML output so links actually render on the site.
    const linksBlock = wantLinks
      ? `\nInclude 1–2 relevant INTERNAL links using ONLY these exact hrefs, as HTML anchors: ${linkTargets.length ? linkTargets.map(l => `"${l.label}" -> ${l.href}`).join('; ') : '(none provided — skip internal links)'}. Also include exactly ONE relevant EXTERNAL link to a genuinely authoritative, useful source (e.g. the manufacturer's official site, a government safety/consumer resource, Carfax) — use target="_blank" rel="nofollow noopener" on the external one only. Output valid HTML using <a>, <strong>, <em> and <br> where helpful; no other tags, no markdown, no <html>/<body> wrapper.`
      : ''
    const banned = 'NEVER use phrases like "Drive Home Your Dream", "Best Deals", "Your Trusted Dealer", "Today!", "Look no further", "Unbeatable", or empty hype.'
    const prompt = `You are a senior automotive copywriter for ${dealer?.name || 'a car dealership'}${loc ? ' in ' + loc : ''}.${makes.length ? ` They primarily sell ${makes.join(', ')}.` : ''} Tone: ${tone}.
Write ${kindHint}. ${instr}${hint ? ` This is for the "${hint}" ${isMeta || isTitle ? 'page' : 'section'}.` : ''}
${angleLine}Make it specific and distinctive — reference real details (brands, city, selection) where natural. ${banned}${avoidLine ? ` Do NOT repeat or lightly reword any of these existing lines: ${avoidLine}.` : ''}${linksBlock}${current && !isFaq ? `\nCurrent text to work from: "${current}".` : ''}
Return ONLY the ${isTitle ? 'title' : isMeta ? 'meta description' : 'copy'} — no quotes, no preamble${wantLinks ? '' : ', no markdown'}.${isFaq ? ' Put each FAQ on its own line formatted exactly as "Question :: Answer".' : ''}`

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const maxTok = wantLinks || t === 'long' ? 900 : isTitle ? 120 : 500
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTok, temperature: isTitle || isMeta ? 0.9 : 1, messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 25000)),
      ])
      let text = (msg?.content?.[0]?.text || '').trim()
      if (!wantLinks) text = text.replace(/^["']|["']$/g, '')
      if (!text) throw new Error('No copy generated')
      recordUsage(req.dealershipId, { ai: 1 })
      res.json({ ok: true, text, html: /<a\s/i.test(text) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })



  // Weekly report & cron routes extracted to routes/submodules/ai-reports-cron.js

  // Save this rep's language preference (chosen in the Google Translate widget).
  // Per-user; also becomes the default language for their AI Facebook copy.
  app.put('/ai/my-language', requireAuth, async (req, res) => {
    const code = String(req.body?.language || '').trim().toLowerCase().slice(0, 12) || null
    const { error } = await supabaseAdmin.from('profiles')
      .update({ preferred_language: code }).eq('id', req.user.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, language: code })
  })

  // GET /ai/market-snapshot — live listing count, median price and days-on-market
  // for a make/model (recipe 05). Inventory Intelligence add-on; one metered +
  // daily-capped MarketCheck call. Owner exempt from the per-dealer caps.
  app.get('/ai/market-snapshot', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const isOwner = isPlatformOwner(req)
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('inv_intel_active, country').eq('id', req.dealershipId).maybeSingle()
    if (!isOwner && !dealer?.inv_intel_active) return res.status(403).json({ error: 'Inventory Intelligence add-on required' })
    if (!marketcheckEnabled()) return res.status(503).json({ error: 'Live market data is not configured.' })
    const make = String(req.query.make || '').trim()
    const model = String(req.query.model || '').trim()
    if (!make || !model) return res.status(400).json({ error: 'make and model are required' })
    if (!(await marketcheckAllowed(req.dealershipId, isOwner))) {
      return res.status(429).json({ error: 'Market-data lookup limit reached — try again later.' })
    }
    const isUS = /^(us|usa|united states)$/i.test((dealer?.country || '').trim())
    const year = req.query.year ? Number(req.query.year) : undefined
    const trim = req.query.trim ? String(req.query.trim).trim() : undefined
    try {
      const snap = await marketcheckMarketStats({ make, model, year, trim, isUS })
      await recordMarketcheckCall(req.dealershipId)
      if (!snap) return res.json({ ok: true, found: false })
      res.json({ ok: true, found: true, make, model, year: year || null, trim: trim || null, currency: isUS ? 'USD' : 'CAD', ...snap })
    } catch (e) {
      res.status(502).json({ error: 'Market snapshot failed — the data service may be busy.' })
    }
  })

  // Assistant chat & commission import routes extracted to routes/submodules/ai-assistant-chat.js

}
