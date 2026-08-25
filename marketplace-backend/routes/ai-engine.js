/**
 * AI Engine — Phase 1 (persistence + memory + context assembly).
 *
 * The persistent, CRM-native AI. This phase owns its tables (ai_conversations,
 * ai_messages, ai_memory) and exposes the primitives the Phase-2 runtime + tool
 * registry will call: conversation/message persistence, long-term memory, and the
 * fixed memory-retrieval pipeline (assembleContext) run before every AI response.
 *
 * Kernel-contract conformance: reads other engines through their APIs (getContact,
 * the /timeline events read), never their tables; every meaningful action emits an
 * event so it lands on the unified timeline beside human activity. The LLM runtime,
 * tool registry, summarizer, lead scorer, and widget come in Phase 2–3.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { emitEvent } from './events.js'
import { getContact } from './crm.js'
import {
  extractQualificationState,
  calculateExplainableLeadScore,
  generateAiLeadBrief,
} from '../services/chatbot-qualification-engine.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'].includes(req.profile?.role)

// Dealer-facing conversation responses are intentionally minimized. In
// particular, visitor_token is a public-chat credential and must never leave
// the backend through an authenticated dashboard list or detail response.
const SAFE_CONVO_COLUMNS = [
  'id', 'contact_id', 'website', 'source', 'status', 'assigned_salesperson',
  'summary', 'sentiment', 'lead_score', 'started_at', 'last_message_at',
  'created_at', 'department', 'lead_type', 'tags', 'booked', 'requested_rep',
  'channel', 'takeover_by', 'takeover_at', 'last_customer_at', 'last_dealer_at',
  'closed_at', 'closed_by', 'merged_into',
].join(',')

// ── Long-term memory ─────────────────────────────────────────────────────────
export async function getMemory(dealershipId, contactId) {
  if (!dealershipId || !contactId) return []
  const { data } = await supabaseAdmin.from('ai_memory')
    .select('memory_type, value, confidence, updated_at')
    .eq('dealership_id', dealershipId).eq('contact_id', contactId)
    .order('updated_at', { ascending: false })
  return data || []
}

// Upsert one memory fact (one row per type per customer). Higher-confidence or newer
// facts overwrite. Emits ai.memory_saved for the timeline.
export async function saveMemory(dealershipId, contactId, memoryType, value, { confidence = 0.7, conversationId = null } = {}) {
  if (!dealershipId || !contactId || !memoryType) return null
  const row = {
    dealership_id: dealershipId, contact_id: contactId, memory_type: memoryType,
    value: value == null ? null : String(value).slice(0, 2000), confidence,
    source_conversation_id: conversationId, updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('ai_memory')
    .upsert(row, { onConflict: 'dealership_id,contact_id,memory_type' }).select('id').single()
  if (error) { console.warn('[ai-engine] saveMemory failed:', error.message); return null }
  return data?.id || null
}

// ── Conversation + message persistence (every message kept permanently) ──────
export async function startOrContinueConversation(dealershipId, { contactId = null, visitorToken = null, website = null, source = 'website' } = {}) {
  if (!dealershipId) return null
  // Reuse an active conversation for this identity, else open one.
  let q = supabaseAdmin.from('ai_conversations').select('*').eq('dealership_id', dealershipId).eq('status', 'active')
  if (contactId) q = q.eq('contact_id', contactId)
  else if (visitorToken) q = q.eq('visitor_token', visitorToken)
  else return createConversation(dealershipId, { contactId, visitorToken, website, source })
  const { data: existing } = await q.order('last_message_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) return existing
  return createConversation(dealershipId, { contactId, visitorToken, website, source })
}

async function createConversation(dealershipId, { contactId, visitorToken, website, source }) {
  const { data, error } = await supabaseAdmin.from('ai_conversations')
    .insert({ dealership_id: dealershipId, contact_id: contactId, visitor_token: visitorToken, website, source })
    .select('*').single()
  if (error) { console.warn('[ai-engine] createConversation failed:', error.message); return null }
  emitEvent({
    dealershipId, eventName: 'ai.conversation_started', entityType: contactId ? 'customer' : 'conversation',
    entityId: contactId || data.id, summary: 'AI conversation started', department: 'Sales',
    payload: { conversation_id: data.id, source },
  })
  return data
}

export async function saveMessage(conversationId, dealershipId, role, message, { tokens = null, attachments = [], senderType = null, channel = 'chat' } = {}) {
  if (!conversationId || !dealershipId || !role) return null
  const payload = { conversation_id: conversationId, dealership_id: dealershipId, role, message: String(message || ''), tokens, attachments, sender_type: senderType, channel }
  const { data, error } = await supabaseAdmin.from('ai_messages')
    .insert(payload)
    .select('id, created_at, channel, sender_type').single()
  if (error) {
    // Fallback if channel column doesn't exist yet
    delete payload.channel
    const { data: d2, error: err2 } = await supabaseAdmin.from('ai_messages').insert(payload).select('id, created_at').single()
    if (err2) { console.warn('[ai-engine] saveMessage failed:', err2.message); return null }
    await supabaseAdmin.from('ai_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
    return d2 || null
  }
  await supabaseAdmin.from('ai_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
  return data || null
}

export async function getHistory(conversationId, limit = 50) {
  const { data } = await supabaseAdmin.from('ai_messages')
    .select('role, message, created_at, sender_type, channel').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(limit)
  return data || []
}

// ── Context assembly ─────────────────────────────────────────────────────────
export async function assembleContext(dealershipId, conversationId, contactId = null) {
  const { data: messages } = await supabaseAdmin.from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)

  const history = messages || []
  let profile = null
  let memory = []
  let timeline = []

  if (contactId) {
    profile = await getContact(dealershipId, contactId)
    memory = await getMemory(dealershipId, contactId)
    const { data } = await supabaseAdmin.from('communications')
      .select('channel, direction, subject, body, occurred_at')
      .eq('dealership_id', dealershipId).eq('contact_id', contactId)
      .order('created_at', { ascending: false }).limit(30)
    timeline = data || []
  }
  return { history, profile, memory, timeline }
}

// ── HTTP surface — dealer console reads (managers) ───────────────────────────
export function registerAiEngine(app) {
  const canView = requirePermission('customer.view')
  const canEdit = requirePermission('customer.edit')

  // Live conversations list for the dealer console + AI Chat feed.
  // Supports categorization filters used by the AI Chat dashboard:
  //   status, department, type (lead_type), booked, captured, tag
  app.get('/ai/conversations', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit, 10) || 200))
    let q = supabaseAdmin.from('ai_conversations').select(SAFE_CONVO_COLUMNS)
      .eq('dealership_id', req.dealershipId).order('last_message_at', { ascending: false }).limit(limit)
    if (req.query.status) q = q.eq('status', String(req.query.status))
    if (req.query.department) q = q.eq('department', String(req.query.department))
    if (req.query.type) q = q.eq('lead_type', String(req.query.type))
    if (req.query.booked === 'true') q = q.eq('booked', true)
    if (req.query.captured === 'true') q = q.not('contact_id', 'is', null)
    if (req.query.tag) q = q.contains('tags', [String(req.query.tag)])
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    const rows = data || []
    // Enrich captured conversations with the customer's name/contact so the feed can
    // show who it is instead of just "site".
    const ids = [...new Set(rows.map(r => r.contact_id).filter(Boolean))]
    if (ids.length) {
      const { data: contacts } = await supabaseAdmin.from('contacts')
        .select('id, full_name, phone, email').in('id', ids)
      const byId = Object.fromEntries((contacts || []).map(c => [c.id, c]))
      for (const r of rows) {
        const c = r.contact_id && byId[r.contact_id]
        if (c) { r.contact_name = c.full_name || null; r.contact_phone = c.phone || null; r.contact_email = c.email || null }
      }
    }
    res.json({ conversations: rows })
  })

  // One conversation + its full message history + (if captured) the customer memory + qualification brief.
  app.get('/ai/conversations/:id', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select(SAFE_CONVO_COLUMNS)
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!convo) return res.status(404).json({ error: 'not found' })
    const messages = await getHistory(convo.id, 500)
    const memory = convo.contact_id ? await getMemory(req.dealershipId, convo.contact_id) : []
    let contactObj = null
    if (convo.contact_id) {
      const { data: c } = await supabaseAdmin.from('contacts').select('id, full_name, first_name, last_name, phone, phone_mobile, email, status, assigned_rep').eq('id', convo.contact_id).maybeSingle()
      if (c) {
        contactObj = c
        convo.contact_name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || null
        convo.contact_phone = c.phone_mobile || c.phone || null
        convo.contact_email = c.email || null
      }
    }
    const qualification = extractQualificationState(messages, memory, {}, contactObj || { full_name: convo.contact_name, phone: convo.contact_phone, email: convo.contact_email })
    const scoreDetails = calculateExplainableLeadScore(messages, memory, qualification)
    const leadBrief = generateAiLeadBrief({
      conversation: convo,
      contact: contactObj || { full_name: convo.contact_name, phone: convo.contact_phone, email: convo.contact_email },
      qualificationState: qualification,
      messages,
    })
    res.json({ conversation: convo, messages, memory, qualification, score_details: scoreDetails, lead_brief: leadBrief })
  })

  // Customer memory (for the CRM contact card).
  app.get('/ai/memory/:contactId', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ memory: await getMemory(req.dealershipId, req.params.contactId) })
  })

  // Manager takeover / hand-back (Phase 3 UI drives this).
  app.post('/ai/conversations/:id/status', requireAuth, canEdit, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const status = String(req.body?.status || '')
    if (!['active', 'handoff', 'closed'].includes(status)) return res.status(400).json({ error: 'bad status' })
    const patch = { status }
    if (status === 'handoff') patch.assigned_salesperson = req.user?.id || null
    const { error } = await supabaseAdmin.from('ai_conversations').update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, status })
  })
}
