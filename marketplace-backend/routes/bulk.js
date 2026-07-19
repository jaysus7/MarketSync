/**
 * Natural-language bulk actions — "text everyone uncontacted 3+ days", "email all
 * positive-equity customers". The AI parses the request into a STRUCTURED filter +
 * drafted message (never free-form DB access); the server resolves the audience
 * deterministically, and nothing sends until a manager reviews the preview and
 * confirms. Consent + opt-out are enforced on the server regardless of what the
 * client sends back, and every send is capped and logged to the timeline.
 *
 *   POST /ai/bulk/plan     → { channel, message, filter, audience_count, sample }
 *   POST /ai/bulk/execute  → { sent, failed, skipped }   (re-resolves the audience)
 */
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { aiAllowed, recordUsage } from '../usage.js'
import { sendDealerSms } from './automation.js'
import { buildEquityRadar } from './equity.js'

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'massiejay@gmail.com').toLowerCase()
const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const STATUSES = ['uncontacted', 'contacted', 'appointment', 'sold', 'fni', 'delivered', 'lost']
const MAX_SEND = 200   // hard ceiling per run, whatever the filter matches

// Normalise the AI's structured filter into something safe + bounded.
function cleanFilter(f = {}) {
  const out = {}
  if (Array.isArray(f.statuses)) { const s = f.statuses.filter(x => STATUSES.includes(x)); if (s.length) out.statuses = s }
  const nc = Number(f.not_contacted_days); if (Number.isFinite(nc) && nc >= 0) out.not_contacted_days = Math.min(365, Math.round(nc))
  const cw = Number(f.created_within_days); if (Number.isFinite(cw) && cw > 0) out.created_within_days = Math.min(3650, Math.round(cw))
  if (f.source && typeof f.source === 'string') out.source = f.source.trim().slice(0, 40)
  if (f.equity === 'positive' || f.equity === 'lease_maturing') out.equity = f.equity
  return out
}
function describeFilter(f, channel) {
  const bits = []
  if (f.statuses) bits.push(`status: ${f.statuses.join(', ')}`)
  if (f.not_contacted_days != null) bits.push(`no contact in ${f.not_contacted_days}+ days`)
  if (f.created_within_days) bits.push(`added in the last ${f.created_within_days} days`)
  if (f.source) bits.push(`source ~ "${f.source}"`)
  if (f.equity === 'positive') bits.push('positive equity')
  if (f.equity === 'lease_maturing') bits.push('lease maturing (≤6 mo)')
  return `${channel.toUpperCase()} to customers where ${bits.join(' · ') || 'everyone (no filter)'}`
}

// Resolve the audience deterministically from the structured filter. Returns
// consent-clean recipients for the chosen channel.
async function resolveAudience(dealershipId, filter, channel) {
  let q = supabaseAdmin.from('contacts')
    .select('id, first_name, last_name, full_name, email, phone, phone_mobile, status, source, opt_out, consent_email, consent_sms, created_at')
    .eq('dealership_id', dealershipId).limit(5000)
  if (filter.statuses) q = q.in('status', filter.statuses)
  if (filter.source) q = q.ilike('source', `%${filter.source}%`)
  if (filter.created_within_days) q = q.gte('created_at', new Date(Date.now() - filter.created_within_days * 86400000).toISOString())
  let { data: rows } = await q
  rows = rows || []

  // Equity narrowing (reuse the Equity Radar engine).
  if (filter.equity) {
    try {
      const { items } = await buildEquityRadar(dealershipId)
      const ok = new Set(items.filter(i => filter.equity === 'lease_maturing'
        ? (i.months_remaining != null && i.months_remaining <= 6)
        : (Number(i.equity) > 0)).map(i => i.customer_id).filter(Boolean))
      rows = rows.filter(r => ok.has(r.id))
    } catch { /* equity engine unavailable → skip narrowing */ }
  }

  // "Not contacted in N days" — last communication (any direction) older than the
  // cutoff, or never. One batched fetch over the candidate ids.
  if (filter.not_contacted_days != null && rows.length) {
    const cutoff = Date.now() - filter.not_contacted_days * 86400000
    const ids = rows.map(r => r.id)
    const lastByContact = {}
    for (let i = 0; i < ids.length; i += 500) {
      const { data: comms } = await supabaseAdmin.from('communications')
        .select('contact_id, occurred_at, created_at').eq('dealership_id', dealershipId)
        .in('contact_id', ids.slice(i, i + 500)).limit(20000)
      for (const c of (comms || [])) {
        const t = new Date(c.occurred_at || c.created_at).getTime()
        if (!Number.isFinite(t)) continue
        if (!lastByContact[c.contact_id] || t > lastByContact[c.contact_id]) lastByContact[c.contact_id] = t
      }
    }
    rows = rows.filter(r => !lastByContact[r.id] || lastByContact[r.id] < cutoff)
  }

  // Consent + reachability for the chosen channel.
  const clean = []
  for (const r of rows) {
    if (r.opt_out === true) continue
    if (channel === 'sms') {
      const to = r.phone_mobile || r.phone
      if (!to || r.consent_sms === false) continue
      clean.push({ ...r, to })
    } else {
      if (!r.email || r.consent_email === false) continue
      clean.push({ ...r, to: r.email })
    }
  }
  return clean
}

function renderMsg(tpl, r, dealerName) {
  const first = r.first_name || (r.full_name || '').split(' ')[0] || 'there'
  return String(tpl || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*first\s*\}\}/gi, first)
    .replace(/\{\{\s*name\s*\}\}/gi, r.full_name || first)
    .replace(/\{\{\s*full_name\s*\}\}/gi, r.full_name || first)
    .replace(/\{\{\s*dealership(\.name)?\s*\}\}/gi, dealerName || 'our dealership')
    .trim()
}

export function registerBulk(app) {
  // Parse a natural-language ask → structured plan + audience preview. Nothing sends.
  app.post('/ai/bulk/plan', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('name, ai_boost_active, ai_tone, ai_internal_style, ai_customer_style').eq('id', req.dealershipId).maybeSingle()
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured.' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Monthly AI limit reached — resets next month.' })
    const instruction = String(req.body?.instruction || '').trim().slice(0, 500)
    if (!instruction) return res.status(400).json({ error: 'Tell me who to reach and what to say.' })

    const style = dealer?.ai_customer_style || (dealer?.ai_tone === 'friendly' ? 'warm and friendly' : dealer?.ai_tone === 'aggressive' ? 'energetic, deal-focused' : 'professional and concise')
    const prompt = `You turn a dealer manager's plain-English bulk-outreach request into a strict JSON plan. Output ONLY one JSON object, no prose.
Schema:
{
  "channel": "sms" | "email",
  "message": "the message to send; use {{first_name}} and {{dealership}} where natural; SMS <=320 chars, include a soft opt-out cue for SMS",
  "subject": "email subject line (only if channel is email)",
  "filter": {
    "statuses": array of any of [${STATUSES.join(', ')}] (optional),
    "not_contacted_days": number (optional; 'not contacted / no follow-up in N days'),
    "created_within_days": number (optional; 'new leads this week' = 7),
    "source": string (optional; a lead source/channel like "facebook", "website"),
    "equity": "positive" | "lease_maturing" (optional; for upgrade/pull-ahead asks)
  }
}
Rules: pick sms if they say text/SMS, else email. Only include filter keys the request implies. Write the message in this dealership's voice: ${style}. Dealership name: ${dealer?.name || 'the dealership'}.
Request: "${instruction}"`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: 'Respond with ONLY one valid JSON object. No markdown, no fences.', messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 20000)),
      ])
      recordUsage(req.dealershipId, { ai: 1 })
      let plan
      try { plan = JSON.parse((msg.content?.[0]?.text || '').replace(/^```json?|```$/g, '').trim()) } catch { return res.status(502).json({ error: 'Could not understand that — try rephrasing (e.g. "text everyone uncontacted for 3 days about our weekend sale").' }) }
      const channel = plan.channel === 'sms' ? 'sms' : 'email'
      const filter = cleanFilter(plan.filter || {})
      const message = String(plan.message || '').slice(0, channel === 'sms' ? 480 : 4000).trim()
      const subject = channel === 'email' ? String(plan.subject || `A note from ${dealer?.name || 'us'}`).slice(0, 160) : null
      if (!message) return res.status(502).json({ error: 'The AI didn’t draft a message — try rephrasing.' })
      const audience = await resolveAudience(req.dealershipId, filter, channel)
      res.json({
        ok: true, channel, message, subject, filter,
        summary: describeFilter(filter, channel),
        audience_count: audience.length,
        capped: audience.length > MAX_SEND ? MAX_SEND : audience.length,
        sample: audience.slice(0, 8).map(r => ({ name: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '—', to: channel === 'sms' ? r.to : r.to })),
      })
    } catch (e) {
      res.status(502).json({ error: e.message === 'ai timeout' ? 'AI timed out — try again.' : 'AI is temporarily unavailable — try again.' })
    }
  })

  // Execute a reviewed plan. Re-resolves the audience server-side (never trusts a
  // client-sent recipient list), enforces consent, caps at MAX_SEND, logs each send.
  app.post('/ai/bulk/execute', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const channel = req.body?.channel === 'sms' ? 'sms' : 'email'
    const filter = cleanFilter(req.body?.filter || {})
    const message = String(req.body?.message || '').trim()
    const subject = channel === 'email' ? String(req.body?.subject || '').trim().slice(0, 160) : null
    if (!message) return res.status(400).json({ error: 'No message to send.' })
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('name, automation_settings').eq('id', req.dealershipId).maybeSingle()
    const houseEmail = dealer?.automation_settings?.house_email || null

    const audience = await resolveAudience(req.dealershipId, filter, channel)
    const targets = audience.slice(0, MAX_SEND)
    let sent = 0, failed = 0
    const nowIso = new Date().toISOString()
    for (const r of targets) {
      const body = renderMsg(message, r, dealer?.name)
      try {
        if (channel === 'sms') {
          const out = await sendDealerSms(req.dealershipId, r.to, body)
          if (!out.ok) { failed++; continue }
        } else {
          await resend.emails.send({ from: houseEmail ? `${dealer?.name || 'MarketSync'} <${houseEmail}>` : EMAIL_FROM, to: r.to, subject: renderMsg(subject || `A note from ${dealer?.name || 'us'}`, r, dealer?.name), text: body })
        }
        sent++
        // Log to the customer timeline so reps see the outreach.
        await supabaseAdmin.from('communications').insert({
          dealership_id: req.dealershipId, contact_id: r.id, type: channel, direction: 'out',
          subject: channel === 'email' ? (subject || null) : null, body,
          occurred_at: nowIso, created_by: req.user?.id || null,
          meta: { kind: 'bulk_ai', by: req.user?.email || null },
        })
      } catch { failed++ }
    }
    res.json({ ok: true, sent, failed, matched: audience.length, capped: audience.length > MAX_SEND })
  })
}
