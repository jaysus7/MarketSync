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
import { emitEvent } from './events.js'
import { getContact } from './crm.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'].includes(req.profile?.role)

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

export async function saveMessage(conversationId, dealershipId, role, message, { tokens = null, attachments = [] } = {}) {
  if (!conversationId || !dealershipId || !role) return null
  const { data, error } = await supabaseAdmin.from('ai_messages')
    .insert({ conversation_id: conversationId, dealership_id: dealershipId, role, message: String(message || ''), tokens, attachments })
    .select('id').single()
  if (error) { console.warn('[ai-engine] saveMessage failed:', error.message); return null }
  await supabaseAdmin.from('ai_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
  return data?.id || null
}

export async function getHistory(conversationId, limit = 50) {
  const { data } = await supabaseAdmin.from('ai_messages')
    .select('role, message, created_at').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(limit)
  return data || []
}

// ── Memory-retrieval pipeline (fixed order, run before every AI response) ─────
// Phase 2 appends viewed + current inventory and hands this to the LLM. For now it
// assembles the customer-side context so the runtime can be dropped in cleanly.
export async function assembleContext(dealershipId, { conversationId = null, contactId = null } = {}) {
  const [history, profile, memory] = await Promise.all([
    conversationId ? getHistory(conversationId) : Promise.resolve([]),
    contactId ? getContact(dealershipId, contactId) : Promise.resolve(null),
    contactId ? getMemory(dealershipId, contactId) : Promise.resolve([]),
  ])
  let timeline = []
  if (contactId) {
    const { data } = await supabaseAdmin.from('events').select('event_name, summary, created_at')
      .eq('dealership_id', dealershipId).eq('entity_type', 'customer').eq('entity_id', contactId)
      .order('created_at', { ascending: false }).limit(30)
    timeline = data || []
  }
  return { history, profile, memory, timeline }
}

// ── HTTP surface — dealer console reads (managers) ───────────────────────────
export function registerAiEngine(app) {
  // Live conversations list for the dealer console.
  app.get('/ai/conversations', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    let q = supabaseAdmin.from('ai_conversations').select('*')
      .eq('dealership_id', req.dealershipId).order('last_message_at', { ascending: false }).limit(200)
    if (req.query.status) q = q.eq('status', String(req.query.status))
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ conversations: data || [] })
  })

  // One conversation + its full message history + (if captured) the customer memory.
  app.get('/ai/conversations/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: convo } = await supabaseAdmin.from('ai_conversations').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!convo) return res.status(404).json({ error: 'not found' })
    const messages = await getHistory(convo.id, 500)
    const memory = convo.contact_id ? await getMemory(req.dealershipId, convo.contact_id) : []
    res.json({ conversation: convo, messages, memory })
  })

  // Customer memory (for the CRM contact card).
  app.get('/ai/memory/:contactId', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json({ memory: await getMemory(req.dealershipId, req.params.contactId) })
  })

  // Manager takeover / hand-back (Phase 3 UI drives this).
  app.post('/ai/conversations/:id/status', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const status = String(req.body?.status || '')
    if (!['active', 'handoff', 'closed'].includes(status)) return res.status(400).json({ error: 'bad status' })
    const patch = { status }
    if (status === 'handoff') patch.assigned_salesperson = req.user?.id || null
    const { error } = await supabaseAdmin.from('ai_conversations').update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, status })
  })
}
