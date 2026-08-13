/**
 * Instant AI lead auto-responder. When a genuine inbound lead lands (website form
 * / chat capture), MarketSync fires a personalised first-touch reply within seconds
 * — the metric most correlated with close rate. Three modes, dealer-configurable:
 *
 *   off   — do nothing (default)
 *   draft — AI writes the reply, logs it on the customer's timeline + a review task,
 *           and pings the rep to send it (human-in-the-loop)
 *   auto  — AI writes AND sends it (email or SMS), then pings the rep to follow up
 *
 * Always consent-aware (opt-out / channel consent), AI-Boost + budget gated, and
 * fire-and-forget so it never slows the customer's form submit. NOT wired to CSV
 * imports or booked-appointment confirmations — only true new inbound leads.
 */
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM } from './shared.js'
import { aiAllowed, recordUsage } from './usage.js'
import { sendDealerSms } from './routes/automation.js'
import { createNotification } from './notifications.js'

export async function runAutoResponder(dealershipId, { contactId, name, email, phone, source, vehicleId, repId } = {}) {
  try {
    if (!contactId || !dealershipId) return { skipped: 'no_contact' }
    const { data: d } = await supabaseAdmin.from('dealerships')
      .select('name, autoresponder_mode, autoresponder_channel, ai_boost_active, ai_customer_style, ai_knowledge, city, province, automation_settings')
      .eq('id', dealershipId).maybeSingle()
    const mode = d?.autoresponder_mode || 'off'
    if (mode === 'off') return { skipped: 'off' }
    if (!process.env.ANTHROPIC_API_KEY || !d?.ai_boost_active) return { skipped: 'no_ai' }
    if (!(await aiAllowed(dealershipId, false))) return { skipped: 'budget' }

    const channel = d.autoresponder_channel === 'sms' ? 'sms' : 'email'
    const { data: c } = await supabaseAdmin.from('contacts')
      .select('first_name, full_name, email, phone, phone_mobile, consent_email, consent_sms, opt_out').eq('id', contactId).maybeSingle()
    if (!c || c.opt_out === true) return { skipped: 'opt_out' }
    const to = channel === 'sms' ? (c.phone_mobile || c.phone || phone) : (c.email || email)
    if (!to) return { skipped: 'no_channel' }
    if (channel === 'sms' && c.consent_sms === false) return { skipped: 'no_consent' }
    if (channel === 'email' && c.consent_email === false) return { skipped: 'no_consent' }

    let vehLine = ''
    if (vehicleId) {
      const { data: v } = await supabaseAdmin.from('inventory').select('year, make, model, trim, price').eq('id', vehicleId).maybeSingle()
      if (v) vehLine = `They enquired about: ${[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}${v.price ? ` ($${Number(v.price).toLocaleString()})` : ''}.`
    }
    const first = c.first_name || String(c.full_name || name || '').split(' ')[0] || 'there'
    const style = d.ai_customer_style || 'warm, professional and concise'
    const kb = String(d.ai_knowledge || '').slice(0, 4000)
    const loc = [d.city, d.province].filter(Boolean).join(', ')
    const lenRule = channel === 'sms' ? 'Keep it under 320 characters and end with a soft opt-out cue (reply STOP to opt out). ' : ''
    const prompt = `You are the sales team at ${d.name}${loc ? `, a car dealership in ${loc}` : ''}, writing the FIRST reply to a brand-new ${source || 'website'} lead named ${first}. ${vehLine} Thank them for reaching out, be genuinely helpful, and invite the next step (a quick call, a test drive, or answering their questions). Sound like a real person, not a form letter. ${lenRule}Voice: ${style}. Sign off as the ${d.name} team. Output ONLY the message body — plain text, no subject line, no placeholders like [name].${kb ? `\n\nDealership facts you may draw on:\n${kb}` : ''}`

    let text = ''
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: channel === 'sms' ? 200 : 450, messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
      ])
      text = (msg?.content?.[0]?.text || '').trim()
    } catch { return { skipped: 'ai_error' } }
    if (!text) return { skipped: 'empty' }
    recordUsage(dealershipId, { ai: 1 })
    const nowIso = new Date().toISOString()
    const subject = `Thanks for reaching out — ${d.name}`

    if (mode === 'auto') {
      let sent = false
      if (channel === 'sms') { const r = await sendDealerSms(dealershipId, to, text); sent = !!r.ok }
      else {
        const houseEmail = d.automation_settings?.house_email
        const from = houseEmail ? `${d.name} <${houseEmail}>` : EMAIL_FROM
        try { await resend.emails.send({ from, to, subject, text }); sent = true } catch { /* logged below anyway */ }
      }
      await supabaseAdmin.from('communications').insert({
        dealership_id: dealershipId, contact_id: contactId, channel, direction: 'out',
        subject: channel === 'email' ? subject : null, body: text, occurred_at: nowIso, rep_id: repId || null,
        meta: { kind: 'ai_autoresponse', auto: true, sent },
      }).catch(() => {})
      if (repId) await createNotification({ dealershipId, type: 'new_lead', targetUserId: repId, title: `🤖 AI replied to ${first}`, body: `Auto-sent a first ${channel === 'sms' ? 'text' : 'email'} — follow up personally.`, linkPage: 'leads' }).catch(() => {})
      return { ok: true, mode: 'auto', channel, sent }
    }

    // draft mode — log the draft + a review task + ping the rep to send it.
    await supabaseAdmin.from('communications').insert({
      dealership_id: dealershipId, contact_id: contactId, channel: 'note', direction: 'internal',
      subject: `AI-drafted ${channel} reply — review & send`, body: text, occurred_at: nowIso, rep_id: repId || null,
      meta: { kind: 'ai_draft', draft_channel: channel },
    }).catch(() => {})
    await supabaseAdmin.from('crm_tasks').insert({
      dealership_id: dealershipId, contact_id: contactId, assigned_to: repId || null,
      title: `Review & send AI reply to ${first}`, type: 'followup', due_at: new Date(Date.now() + 30 * 60000).toISOString(),
    }).catch(() => {})
    if (repId) await createNotification({ dealershipId, type: 'new_lead', targetUserId: repId, title: `✍️ AI drafted a reply to ${first}`, body: 'Open the lead to review and send it.', linkPage: 'leads' }).catch(() => {})
    return { ok: true, mode: 'draft', channel }
  } catch (e) {
    console.warn('[autoresponder] failed:', e.message)
    return { skipped: 'error', error: e.message }
  }
}
