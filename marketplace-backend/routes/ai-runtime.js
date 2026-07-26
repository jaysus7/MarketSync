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
import { supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { emitEvent } from './events.js'
import { getConfig, setConfig } from './config-engine.js'
import { getContact, findOrCreateContact } from './crm.js'
import { routeAndNotifyLead } from '../lead-routing.js'
import { assistantDailyAllowed, recordAssistantChat, aiAllowed, recordUsage } from '../usage.js'
import { rateLimit } from '../security.js'
import {
  startOrContinueConversation, saveMessage, getHistory, assembleContext, saveMemory,
} from './ai-engine.js'
import { registerTool, toolDefs, callTool } from './tool-registry.js'

const MODEL = 'claude-haiku-4-5-20251001'
const SURFACE = 'sales_chat'   // the agent surface the customer-facing chatbot runs on
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

// ── Sales-chat tools — every tool wraps an engine API; handlers get (args, ctx) ──
// ctx = { dealershipId, conversation, contactRef } (contactRef.id mutable on capture).
// These are registered into the shared Agent Tool Registry (kernel contract §5) on
// the 'sales_chat' surface, so the same registry can also back an MCP server later.
const SALES_TOOLS = [
  {
    name: 'search_inventory',
    description: "Search the dealership's live inventory. Use whenever the shopper asks about a vehicle, price, availability, or a body style. Only vehicles returned here exist — never invent stock.",
    input_schema: { type: 'object', properties: {
      query: { type: 'string', description: 'make, model, body style, or keywords' },
      max_price: { type: 'number' }, min_year: { type: 'number' },
    } },
    async handler(a, ctx) {
      let q = supabaseAdmin.from('inventory').select('id, year, make, model, trim, price, mileage, stock_number, vin, status, image_urls')
        .eq('dealership_id', ctx.dealershipId).is('archived_at', null).neq('status', 'sold').limit(8)
      if (a.max_price) q = q.lte('price', a.max_price)
      if (a.min_year) q = q.gte('year', a.min_year)
      if (a.query) q = q.or(`make.ilike.%${a.query}%,model.ilike.%${a.query}%,trim.ilike.%${a.query}%`)
      const { data } = await q
      return (data || []).map(v => ({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, price: v.price, mileage: v.mileage, stock: v.stock_number }))
    },
  },
  {
    name: 'get_customer',
    description: 'Get the known profile of the customer in this conversation (name, contact, status). Returns null if the visitor is still anonymous.',
    input_schema: { type: 'object', properties: {} },
    async handler(a, ctx) { return ctx.contactRef.id ? await getContact(ctx.dealershipId, ctx.contactRef.id) : null },
  },
  {
    name: 'save_memory',
    description: 'Remember a durable fact about this customer for future visits (budget, trade vehicle, family needs, financing, vehicle interest, preferences). Use whenever the shopper shares something worth remembering.',
    input_schema: { type: 'object', properties: {
      memory_type: { type: 'string', description: 'budget|trade|family|credit|financing|vehicle_interest|appointment|notes' },
      value: { type: 'string' },
    }, required: ['memory_type', 'value'] },
    async handler(a, ctx) {
      if (!ctx.contactRef.id) return { ok: false, reason: 'no_customer_yet' }
      await saveMemory(ctx.dealershipId, ctx.contactRef.id, a.memory_type, a.value, { conversationId: ctx.conversation.id })
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
      ctx.contactRef.id = contactId
      await supabaseAdmin.from('ai_conversations').update({ contact_id: contactId }).eq('id', ctx.conversation.id)
      if (a.vehicle_interest) await saveMemory(ctx.dealershipId, contactId, 'vehicle_interest', a.vehicle_interest, { conversationId: ctx.conversation.id })
      routeAndNotifyLead(ctx.dealershipId, { contactId, vehicleId: null, name: a.name, source: 'AI Chat' }).catch(() => {})
      emitEvent({ dealershipId: ctx.dealershipId, eventName: 'lead.created', entityType: 'customer', entityId: contactId, summary: `AI captured lead — ${a.name}`, department: 'Sales', payload: { source: 'AI Chat', conversation_id: ctx.conversation.id } })
      return { ok: true, contact_id: contactId }
    },
  },
  {
    name: 'calculate_payment',
    description: 'Estimate a monthly payment. Use when the shopper asks "what would payments be". Returns an estimate only.',
    input_schema: { type: 'object', properties: {
      price: { type: 'number' }, down: { type: 'number' }, rate_apr: { type: 'number' }, term_months: { type: 'number' },
    }, required: ['price'] },
    async handler(a) {
      const principal = Math.max(0, n(a.price) - n(a.down))
      const term = n(a.term_months) || 72
      const r = (n(a.rate_apr) || 7.99) / 100 / 12
      const pmt = r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -term)) : principal / term
      return { monthly: Math.round(pmt), term_months: term, principal: Math.round(principal), note: 'Estimate only — final terms on approved credit.' }
    },
  },
  {
    name: 'request_human',
    description: 'Hand the conversation to a human salesperson. Call when the shopper explicitly asks for a person, or is ready to buy/negotiate.',
    input_schema: { type: 'object', properties: { reason: { type: 'string' } } },
    async handler(a, ctx) {
      await supabaseAdmin.from('ai_conversations').update({ status: 'handoff' }).eq('id', ctx.conversation.id)
      emitEvent({ dealershipId: ctx.dealershipId, eventName: 'ai.handoff_requested', entityType: ctx.contactRef.id ? 'customer' : 'conversation', entityId: ctx.contactRef.id || ctx.conversation.id, summary: `Customer asked for a human${a.reason ? ' — ' + a.reason : ''}`, department: 'Sales', payload: { conversation_id: ctx.conversation.id } })
      return { ok: true }
    },
  },
]
// Register every sales-chat tool into the shared registry (side effect on import, so
// runChat/publicChat work whether or not registerAiRuntime has run yet).
SALES_TOOLS.forEach(t => registerTool({ ...t, surface: SURFACE }))

// ── Deterministic lead score (0–100) from conversation signals ───────────────
function scoreConversation(messages, memory, captured) {
  const text = messages.filter(m => m.role === 'user').map(m => m.message).join(' ').toLowerCase()
  let s = Math.min(20, messages.length * 2)                        // engagement
  if (captured) s += 25                                            // contact shared
  if (/trade|trade-in|my car/.test(text)) s += 12
  if (/financ|payment|apr|monthly|approv|credit/.test(text)) s += 15
  if (/test drive|appointment|come in|visit|see it/.test(text)) s += 15
  if (/buy|purchase|deal|price|available|in stock/.test(text)) s += 8
  if ((memory || []).some(m => m.memory_type === 'vehicle_interest')) s += 5
  return Math.max(0, Math.min(100, Math.round(s)))
}

async function rescoreLead(ctx, messages, memory) {
  const score = scoreConversation(messages, memory, !!ctx.contactRef.id)
  const prev = ctx.conversation.lead_score || 0
  if (score === prev) return score
  await supabaseAdmin.from('ai_conversations').update({ lead_score: score }).eq('id', ctx.conversation.id)
  if (ctx.contactRef.id) {
    emitEvent({ dealershipId: ctx.dealershipId, eventName: 'ai.lead_scored', entityType: 'customer', entityId: ctx.contactRef.id, summary: `Lead score ${prev} → ${score}`, department: 'Sales', fromState: String(prev), toState: String(score), payload: { conversation_id: ctx.conversation.id } })
    // Notification-rule: hot lead crosses the threshold → alert sales.
    const rules = await getConfig(ctx.dealershipId, 'notification_rules', {})
    const thresh = n(rules?.lead_score_over) || 80
    if (score >= thresh && prev < thresh) {
      const { createNotification } = await import('../notifications.js')
      createNotification({ dealershipId: ctx.dealershipId, type: 'new_lead', title: `🔥 Hot AI lead (${score})`, body: 'An AI chat lead crossed your alert threshold — follow up now.', linkPage: 'crm' }).catch(() => {})
    }
  }
  ctx.conversation.lead_score = score
  return score
}

// ── System prompt (grounded in dealer + config personality) ──────────────────
async function buildSystem(dealershipId, ctx, contextBundle) {
  const { data: d } = await supabaseAdmin.from('dealerships').select('name, city, province, country').eq('id', dealershipId).maybeSingle()
  const persona = await getConfig(dealershipId, 'ai_personality', {})
  const kb = await getConfig(dealershipId, 'ai_knowledge', {})
  const mem = (contextBundle.memory || []).map(m => `- ${m.memory_type}: ${m.value}`).join('\n')
  const profile = contextBundle.profile ? `Known customer: ${contextBundle.profile.full_name || ''} (${contextBundle.profile.status || 'lead'}).` : 'Visitor not yet identified.'
  // Dealer-authored knowledge base — the AI answers hours/policies/financing/etc. from this.
  const kbLines = [
    kb?.hours && `Hours: ${kb.hours}`, kb?.financing && `Financing: ${kb.financing}`,
    kb?.trade_in && `Trade-ins: ${kb.trade_in}`, kb?.specials && `Current specials: ${kb.specials}`,
    kb?.policies && `Policies: ${kb.policies}`,
  ].filter(Boolean).join('\n')
  return `You are the AI sales concierge for ${d?.name || 'the dealership'}${d?.city ? ' in ' + d.city : ''}. ${persona?.tone ? 'Tone: ' + persona.tone + '.' : 'Be warm, concise, never pushy.'}
Help the shopper find a vehicle, answer from live inventory (use search_inventory — never invent stock or prices), and move them toward a test drive, financing, or a trade value.
As soon as they share a name + phone/email, call create_lead. Remember durable facts with save_memory. If they want a human or are ready to negotiate, call request_human. Keep replies to 2–4 sentences.
${kbLines ? `\nDealership info (answer from this, don't invent):\n${kbLines}` : ''}
${profile}${mem ? `\nWhat we remember about them:\n${mem}` : ''}
Today: ${new Date().toISOString().slice(0, 10)}.`
}

// ── The chat runtime — persist, assemble, agentic tool loop, score ───────────
async function runChat({ dealershipId, conversation, contactId, userText, isOwner }) {
  const ctx = { dealershipId, conversation, contactRef: { id: contactId || conversation.contact_id || null } }
  await saveMessage(conversation.id, dealershipId, 'user', userText)

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
        // Dispatch through the registry: it enforces the surface, never throws, and
        // returns an { error } object the model can read and recover from.
        const out = await callTool(tu.name, tu.input || {}, ctx, { surface: SURFACE })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) })
      }
      messages.push({ role: 'user', content: results })
    }
  } catch (e) {
    console.warn('[ai-runtime] model call failed:', e.message)
    replyText = "Sorry — I'm having a moment. A team member will follow up, or try again shortly."
  }

  if (replyText) await saveMessage(conversation.id, dealershipId, 'assistant', replyText)
  recordUsage(dealershipId, { ai: 1 }).catch(() => {})
  recordAssistantChat(dealershipId).catch(() => {})
  const allMsgs = await getHistory(conversation.id, 100)
  await rescoreLead(ctx, allMsgs, bundle.memory)
  return { reply: replyText, conversation_id: conversation.id, contact_id: ctx.contactRef.id, lead_score: conversation.lead_score }
}

// ── Conversation summary (structured, for CRM) ───────────────────────────────
export async function summarizeConversation(dealershipId, conversationId) {
  const msgs = await getHistory(conversationId, 200)
  if (!msgs.length) return null
  const transcript = msgs.map(m => `${m.role}: ${m.message}`).join('\n').slice(0, 12000)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: `Summarize this car-shopping chat for the dealership CRM. Plain text, labelled lines only:\nWants:\nBudget:\nTrade:\nFinancing:\nNext step:\n\n${transcript}` }] })
    const summary = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    if (summary) await supabaseAdmin.from('ai_conversations').update({ summary }).eq('id', conversationId)
    return summary
  } catch (e) { console.warn('[ai-runtime] summarize failed:', e.message); return null }
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
    res.json({ enabled: !!d.ai_chatbot_active, name: d.name, greeting: persona?.greeting || 'Hi! How can I help you find your next vehicle?' })
  })

  app.post('/ai/widget/chat', rateLimit('widgetchat', 20, 60000), async (req, res) => {
    const dealer = String(req.body?.dealer || '')
    const message = String(req.body?.message || '').trim()
    if (!dealer || !message) return res.status(400).json({ error: 'dealer and message required' })
    const { data: d } = await supabaseAdmin.from('dealerships').select('id, ai_chatbot_active').eq('id', dealer).maybeSingle()
    if (!d || !d.ai_chatbot_active) return res.status(403).json({ error: 'chatbot_not_enabled' })
    if (!(await aiAllowed(d.id, false))) return res.status(429).json({ error: 'busy' })
    const visitorToken = String(req.body?.visitor_token || '') || ('v_' + Math.random().toString(36).slice(2) + Date.now().toString(36))
    const out = await publicChat({ dealershipId: d.id, conversationId: req.body?.conversation_id || null, visitorToken, message, website: req.body?.website || null })
    if (!out) return res.status(500).json({ error: 'chat failed' })
    res.json({ ...out, visitor_token: visitorToken })
  })


  // Authenticated chat (internal testing + logged-in surfaces). The public,
  // CORS-gated widget endpoint lands in Phase 3 on top of the same runtime.
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

  // ── AI Chatbot product home: stats + recent conversations ───────────────────
  app.get('/ai/home', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data } = await supabaseAdmin.from('ai_conversations')
      .select('id, contact_id, lead_score, status, created_at, website')
      .eq('dealership_id', req.dealershipId).gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
    const rows = data || []
    const afterHours = rows.filter(r => { const h = new Date(r.created_at).getHours(); return h < 8 || h >= 18 }).length
    res.json({
      stats: {
        conversations: rows.length,
        leads_captured: rows.filter(r => r.contact_id).length,
        hot_leads: rows.filter(r => (r.lead_score || 0) >= 80).length,
        after_hours: afterHours,
      },
      recent: rows.slice(0, 10).map(r => ({ id: r.id, score: r.lead_score || 0, status: r.status || 'open', captured: !!r.contact_id, website: r.website || null, at: r.created_at })),
    })
  })

  // Knowledge base the AI answers from (hours/policies/financing/trade/specials).
  app.get('/ai/knowledge', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ knowledge: await getConfig(req.dealershipId, 'ai_knowledge', {}) })
  })
  app.put('/ai/knowledge', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const b = req.body || {}
    const value = {
      hours: String(b.hours || '').slice(0, 2000), financing: String(b.financing || '').slice(0, 2000),
      trade_in: String(b.trade_in || '').slice(0, 2000), specials: String(b.specials || '').slice(0, 2000),
      policies: String(b.policies || '').slice(0, 4000),
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
    const value = { tone: String(b.tone || '').slice(0, 200), greeting: String(b.greeting || '').slice(0, 400) }
    try { await setConfig(req.dealershipId, 'ai_personality', value, req); res.json({ ok: true, personality: value }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // The dealer's copy-paste embed snippet for LeadBox / eDealer / any site.
  app.get('/ai/widget/embed', requireAuth, (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const origin = FRONTEND_URL || 'https://marketsync.link'
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
}
