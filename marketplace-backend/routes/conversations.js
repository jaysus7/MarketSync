/**
 * Conversation continuity (Phase 6 PR 6.4).
 *
 * ONE customer conversation, whatever channel it arrives on. A shopper asks about a
 * Silverado on the website, gives their number, then texts "are you open at 2?" — that is
 * the same conversation, and the salesperson who picks it up should not have to staple two
 * threads together in their head.
 *
 * The model already had what it needed: `ai_conversations` carries both `contact_id` and
 * `visitor_token`, so an anonymous visitor can later become a known customer. What was
 * missing was the moment of identification. If the customer already had a conversation open,
 * setting contact_id on the anonymous one would produce two live conversations for one
 * person — which is exactly the fragmentation this phase is meant to prevent.
 *
 * So identification MERGES. The older conversation wins (it holds more history), the newer
 * one's messages move across, and the loser is marked 'merged' pointing at the winner rather
 * than deleted — a transcript is evidence of what was said to a customer.
 *
 * Nothing here sends anything. Sending is gated by routes/consent.js; this module decides
 * WHICH conversation a message belongs to, and who is waiting on whom.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { emitEvent } from './events.js'
import { mayContact } from './consent.js'

export const CONVERSATION_CHANNELS = ['web', 'sms', 'email', 'phone']

// Small on purpose. A conversation nobody can describe in one word is one nobody acts on.
export const CONVERSATION_STATUSES = ['active', 'waiting_customer', 'waiting_dealer', 'handoff', 'closed', 'merged']
const OPEN_STATUSES = ['active', 'waiting_customer', 'waiting_dealer', 'handoff']

const CONV_COLUMNS = 'id, dealership_id, contact_id, visitor_token, channel, status, department, ' +
  'assigned_salesperson, takeover_by, takeover_at, summary, sentiment, lead_score, lead_type, ' +
  'started_at, last_message_at, last_customer_at, last_dealer_at, booked, requested_rep, merged_into'

/**
 * Find the conversation a message belongs to, or start one.
 *
 * Resolution order matters: an identified customer's open conversation beats a visitor
 * token, because the same person on a new device is still the same person.
 */
export async function resolveConversation(dealershipId, { contactId = null, visitorToken = null, channel = 'web', department = 'sales', website = null } = {}) {
  const ch = CONVERSATION_CHANNELS.includes(channel) ? channel : 'web'
  const dept = department || 'sales'

  if (contactId) {
    const { data: byContact } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
      .eq('dealership_id', dealershipId).eq('contact_id', contactId)
      .eq('department', dept).in('status', OPEN_STATUSES)
      .order('started_at', { ascending: true }).limit(1).maybeSingle()
    if (byContact) {
      // The customer came back on a different channel. Follow them.
      if (byContact.channel !== ch) {
        await supabaseAdmin.from('ai_conversations').update({ channel: ch }).eq('id', byContact.id)
        byContact.channel = ch
      }
      return { conversation: byContact, created: false }
    }
  }

  if (visitorToken) {
    const { data: byToken } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
      .eq('dealership_id', dealershipId).eq('visitor_token', visitorToken)
      .in('status', OPEN_STATUSES).order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (byToken) {
      // The visitor just told us who they are: this is the identification moment.
      if (contactId && !byToken.contact_id) return identifyConversation(dealershipId, byToken.id, contactId)
      return { conversation: byToken, created: false }
    }
  }

  const { data, error } = await supabaseAdmin.from('ai_conversations').insert({
    dealership_id: dealershipId, contact_id: contactId, visitor_token: visitorToken,
    channel: ch, department: dept, website, status: 'active',
    started_at: new Date().toISOString(), last_message_at: new Date().toISOString(),
  }).select(CONV_COLUMNS).single()
  if (error) throw new Error(`could not start a conversation: ${error.message}`)
  return { conversation: data, created: true }
}

/**
 * An anonymous conversation now belongs to a known customer.
 *
 * If that customer already has one open, the two are the same conversation and must become
 * one — otherwise the customer has two live threads and whoever answers sees half the story.
 */
export async function identifyConversation(dealershipId, conversationId, contactId) {
  const { data: convo } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
    .eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
  if (!convo) throw new Error('conversation not found')
  if (convo.contact_id === contactId) return { conversation: convo, created: false, merged: false }

  const dept = convo.department || 'sales'
  const { data: existing } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
    .eq('dealership_id', dealershipId).eq('contact_id', contactId).eq('department', dept)
    .in('status', OPEN_STATUSES).order('started_at', { ascending: true }).limit(1).maybeSingle()

  if (!existing) {
    const { data, error } = await supabaseAdmin.from('ai_conversations')
      .update({ contact_id: contactId }).eq('id', convo.id).select(CONV_COLUMNS).single()
    if (error) throw new Error(`could not identify the conversation: ${error.message}`)
    await emitEvent({
      dealershipId, eventName: 'conversation.identified', entityType: 'contact', entityId: contactId,
      summary: 'A website visitor became a known customer', department: dept,
      payload: { conversation_id: convo.id, channel: convo.channel },
    })
    return { conversation: data, created: false, merged: false }
  }

  // The older conversation is the survivor — it carries more of the story.
  return mergeConversations(dealershipId, existing.id, convo.id)
}

/** Fold `loserId` into `winnerId`. The transcript moves; nothing is destroyed. */
export async function mergeConversations(dealershipId, winnerId, loserId) {
  if (winnerId === loserId) throw new Error('a conversation cannot be merged into itself')
  const { data: pair } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
    .eq('dealership_id', dealershipId).in('id', [winnerId, loserId])
  const winner = (pair || []).find(c => c.id === winnerId)
  const loser = (pair || []).find(c => c.id === loserId)
  if (!winner || !loser) throw new Error('conversation not found')

  await supabaseAdmin.from('ai_messages').update({ conversation_id: winnerId }).eq('conversation_id', loserId)

  // Mark the loser BEFORE touching the winner: the one-open-per-contact index would
  // otherwise refuse the winner's update while two open rows still name the same customer.
  await supabaseAdmin.from('ai_conversations')
    .update({ status: 'merged', merged_into: winnerId, closed_at: new Date().toISOString() })
    .eq('id', loserId).eq('dealership_id', dealershipId)

  const patch = { last_message_at: new Date().toISOString() }
  // The customer's latest channel is the one to reply on.
  if (loser.channel && loser.channel !== winner.channel) patch.channel = loser.channel
  if (!winner.lead_score && loser.lead_score) patch.lead_score = loser.lead_score
  if (!winner.lead_type && loser.lead_type) patch.lead_type = loser.lead_type
  const { data: merged } = await supabaseAdmin.from('ai_conversations')
    .update(patch).eq('id', winnerId).select(CONV_COLUMNS).maybeSingle()

  await emitEvent({
    dealershipId, eventName: 'conversation.merged', entityType: 'contact', entityId: winner.contact_id,
    summary: 'Two conversations were the same customer', department: winner.department || 'sales',
    payload: { winner: winnerId, loser: loserId, channel: patch.channel || winner.channel },
  })
  return { conversation: merged || winner, created: false, merged: true, merged_from: loserId }
}

/**
 * Record a message and move the conversation's waiting state.
 *
 * Who is waiting on whom is the only status question that matters operationally, and it is
 * derivable from who spoke last — so it is derived, not asked for.
 */
export async function recordMessage(dealershipId, conversationId, { role, message, channel = 'web', senderType = null, externalId = null, tokens = null }) {
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('ai_messages').insert({
    conversation_id: conversationId, dealership_id: dealershipId,
    role, message: String(message || ''), channel, sender_type: senderType,
    external_id: externalId, tokens,
  })
  // A retried provider webhook must not append the same text twice.
  if (error && /duplicate/i.test(error.message)) return { recorded: false, duplicate: true }
  if (error) throw new Error(`could not record the message: ${error.message}`)

  const fromCustomer = role === 'user'
  const patch = { last_message_at: now, channel }
  if (fromCustomer) { patch.last_customer_at = now } else { patch.last_dealer_at = now }

  // A human takeover is a deliberate state and must not be undone by the next message.
  const { data: convo } = await supabaseAdmin.from('ai_conversations')
    .select('status').eq('id', conversationId).maybeSingle()
  if (convo && convo.status !== 'handoff' && convo.status !== 'closed' && convo.status !== 'merged') {
    patch.status = fromCustomer ? 'waiting_dealer' : 'waiting_customer'
  }
  await supabaseAdmin.from('ai_conversations').update(patch).eq('id', conversationId).eq('dealership_id', dealershipId)
  return { recorded: true, duplicate: false }
}

/**
 * Hand the conversation to a human, with everything they need to not ask twice.
 */
export async function takeOver(dealershipId, conversationId, userId, { reason = null } = {}) {
  const { data: convo } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
    .eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
  if (!convo) throw new Error('conversation not found')
  if (convo.status === 'closed' || convo.status === 'merged') throw new Error('that conversation is finished')

  const { data, error } = await supabaseAdmin.from('ai_conversations').update({
    status: 'handoff', takeover_by: userId, takeover_at: new Date().toISOString(),
    assigned_salesperson: convo.assigned_salesperson || userId,
  }).eq('id', conversationId).eq('dealership_id', dealershipId).select(CONV_COLUMNS).single()
  if (error) throw new Error(error.message)

  await emitEvent({
    dealershipId, eventName: 'conversation.human_takeover', entityType: 'contact', entityId: convo.contact_id,
    summary: 'A person took over the conversation', department: convo.department || 'sales',
    payload: { conversation_id: conversationId, by: userId, reason },
  })
  return data
}

/** Everything a person needs on arrival, so the customer never repeats themselves. */
export async function handoffBrief(dealershipId, conversationId) {
  const { data: convo } = await supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
    .eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
  if (!convo) return null

  const [{ data: messages }, { data: contact }] = await Promise.all([
    supabaseAdmin.from('ai_messages').select('role, message, channel, created_at, sender_type')
      .eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(500),
    convo.contact_id
      ? supabaseAdmin.from('contacts').select('id, first_name, last_name, email, phone, phone_mobile, status, assigned_rep, interest_inventory_id')
          .eq('id', convo.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // What may we actually reply on? A brief that offers SMS to someone who opted out is
  // worse than no brief.
  const reachable = {}
  if (convo.contact_id) {
    for (const ch of ['sms', 'email']) {
      const v = await mayContact(dealershipId, convo.contact_id, ch, { ignorePause: true })
      reachable[ch] = { allowed: v.allowed, basis: v.basis, reason: v.reason }
    }
  }

  const channelsUsed = [...new Set((messages || []).map(m => m.channel))]
  return {
    conversation: convo, contact: contact || null,
    summary: convo.summary || null, sentiment: convo.sentiment || null,
    lead_score: convo.lead_score ?? null, lead_type: convo.lead_type || null,
    channels_used: channelsUsed,
    transcript: messages || [],
    reachable,
    // The action a person should take, rather than a wall of context and no direction.
    next_action: convo.status === 'waiting_dealer' ? 'Reply to the customer'
               : convo.booked ? 'Confirm the appointment'
               : convo.lead_type === 'trade' ? 'Review Trade Lead'
               : 'Review the conversation',
  }
}

/**
 * Attention this department can honestly produce.
 *
 * Exported as a builder, not just a route, so Marketing's My Day COMPOSES these rather than
 * re-deriving them from the same tables and drifting.
 */
export async function conversationAttention(dealershipId) {
  const { data } = await supabaseAdmin.from('ai_conversations')
    .select('id, contact_id, status, channel, lead_type, lead_score, last_customer_at, last_message_at, takeover_by')
    .eq('dealership_id', dealershipId).in('status', ['waiting_dealer', 'handoff']).limit(200)
  const now = Date.now()
  return (data || []).map(c => {
    const waited = c.last_customer_at ? Math.floor((now - new Date(c.last_customer_at).getTime()) / 60000) : null
    return {
      kind: c.status === 'handoff' ? 'conversation_human_takeover' : 'conversation_waiting_dealer',
      // A customer who has waited an hour outranks one who just wrote.
      severity: (waited ?? 0) > 60 ? 3 : 2,
      subject: c.lead_type ? `${c.lead_type} conversation` : 'Customer conversation',
      reason: waited == null ? 'Waiting on the dealership'
            : waited < 60 ? `Customer has been waiting ${waited} min`
            : `Customer has been waiting ${Math.floor(waited / 60)}h`,
      owner: c.takeover_by ? 'Assigned' : 'Sales',
      action: 'Reply to the customer', ref: c.id, channel: c.channel,
    }
  }).sort((a, b) => b.severity - a.severity)
}

export function registerConversations(app) {
  const canView = requirePermission('customer.view')
  const canEdit = requirePermission('customer.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  app.get('/conversations', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      let q = supabaseAdmin.from('ai_conversations').select(CONV_COLUMNS)
        .eq('dealership_id', req.dealershipId).not('status', 'in', '("merged")')
      if (req.query.status) q = q.eq('status', String(req.query.status))
      const { data, error } = await q.order('last_message_at', { ascending: false }).limit(300)
      if (error) return res.status(500).json({ error: error.message })
      res.json({ conversations: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/conversations/:id/brief', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const brief = await handoffBrief(req.dealershipId, req.params.id)
      if (!brief) return res.status(404).json({ error: 'Conversation not found' })
      res.json(brief)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/conversations/:id/takeover', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const convo = await takeOver(req.dealershipId, req.params.id, req.user?.id || null, { reason: req.body?.reason || null })
      audit(req, 'conversation.human_takeover', { after_state: { id: convo.id, by: req.user?.id } })
      res.json({ ok: true, conversation: convo })
    } catch (e) { res.status(409).json({ error: e.message }) }
  })

  // Return it to the assistant. The history stays; only who is answering changes.
  app.post('/conversations/:id/release', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('ai_conversations')
        .update({ status: 'active', takeover_by: null, takeover_at: null })
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).eq('status', 'handoff')
        .select(CONV_COLUMNS).maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(409).json({ error: 'That conversation is not in human takeover.' })
      audit(req, 'conversation.released', { after_state: { id: data.id } })
      res.json({ ok: true, conversation: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/conversations/:id/close', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const { data, error } = await supabaseAdmin.from('ai_conversations')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: req.user?.id || null })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).in('status', OPEN_STATUSES)
      .select(CONV_COLUMNS).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(409).json({ error: 'That conversation is already finished.' })
    audit(req, 'conversation.closed', { after_state: { id: data.id } })
    res.json({ ok: true, conversation: data })
  })

  // Attention items this slice produces, for My Day to compose from later.
  app.get('/conversations/attention', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ items: await conversationAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Internal Staff / Team Chat Endpoints ────────────────────────────────────
  const teamMessagesStore = new Map()

  app.get('/team/chat/roster', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ members: [] })
    try {
      const { data: profiles } = await supabaseAdmin.from('profiles')
        .select('id, full_name, display_name, role, avatar_url, active, updated_at')
        .eq('dealership_id', req.dealershipId)

      const msgs = teamMessagesStore.get(req.dealershipId) || []
      const currentUserId = req.user.id
      const now = Date.now()

      const members = (profiles || [])
        .filter(p => p.id !== currentUserId)
        .map(p => {
          const userMsgs = msgs.filter(m =>
            (m.sender_id === p.id && m.recipient_id === currentUserId) ||
            (m.sender_id === currentUserId && m.recipient_id === p.id)
          ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

          const lastMsg = userMsgs[0] || null
          const unreadCount = msgs.filter(m => m.sender_id === p.id && m.recipient_id === currentUserId && !m.read).length
          const isOnline = p.active !== false && (p.updated_at && (now - new Date(p.updated_at).getTime() < 15 * 60 * 1000))

          return {
            id: p.id,
            name: p.full_name || p.display_name || 'Staff Member',
            role: (p.role || 'Staff').replace('_', ' '),
            avatar_url: p.avatar_url || null,
            online: !!isOnline,
            last_message: lastMsg ? { content: lastMsg.content, created_at: lastMsg.created_at, from_me: lastMsg.sender_id === currentUserId } : null,
            unread_count: unreadCount,
          }
        })
        .sort((a, b) => {
          if (a.online !== b.online) return a.online ? -1 : 1
          const aTime = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0
          const bTime = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0
          return bTime - aTime || a.name.localeCompare(b.name)
        })

      res.json({ ok: true, members })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/team/chat/messages', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ messages: [] })
    const targetUserId = req.query.with
    if (!targetUserId) return res.status(400).json({ error: 'Missing target user ID' })

    const msgs = teamMessagesStore.get(req.dealershipId) || []
    const currentUserId = req.user.id

    msgs.forEach(m => {
      if (m.sender_id === targetUserId && m.recipient_id === currentUserId) {
        m.read = true
      }
    })

    const thread = msgs.filter(m =>
      (m.sender_id === targetUserId && m.recipient_id === currentUserId) ||
      (m.sender_id === currentUserId && m.recipient_id === targetUserId)
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    res.json({ ok: true, messages: thread })
  })

  app.post('/team/chat/messages', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { recipient_id, content } = req.body || {}
    if (!recipient_id || !content || !content.trim()) {
      return res.status(400).json({ error: 'Recipient and content required' })
    }

    if (!teamMessagesStore.has(req.dealershipId)) {
      teamMessagesStore.set(req.dealershipId, [])
    }

    const { data: sender } = await supabaseAdmin.from('profiles')
      .select('full_name, display_name').eq('id', req.user.id).maybeSingle()
    const senderName = sender?.full_name || sender?.display_name || 'A teammate'

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      dealership_id: req.dealershipId,
      sender_id: req.user.id,
      sender_name: senderName,
      recipient_id,
      content: content.trim(),
      read: false,
      created_at: new Date().toISOString()
    }

    teamMessagesStore.get(req.dealershipId).push(newMsg)

    await supabaseAdmin.from('notifications').insert({
      dealership_id: req.dealershipId,
      target_user_id: recipient_id,
      type: 'team_message',
      title: `Message from ${senderName}`,
      body: content.length > 120 ? content.slice(0, 117) + '...' : content,
      link_page: 'ai-inbox',
      read: false,
      created_at: new Date().toISOString()
    }).catch(() => {})

    res.json({ ok: true, message: newMsg })
  })
}
