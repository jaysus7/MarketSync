/**
 * MarketSync HQ — customer-success SEQUENCES + email templates (editable).
 *
 * Cadences MarketSync runs against its own customers (dunning, win-back, onboarding,
 * or anything HQ builds). The definitions live in the DB (saas_sequences +
 * saas_sequence_steps) and pull copy from a reusable template library
 * (saas_email_templates), so HQ edits them in the UI — no code deploy. Each step is
 * an email (shared mailer, with {{first_name}}/{{account}} merge fields) or a task
 * (an HQ follow-up). Enrollment + a per-step audit log live in
 * saas_sequence_enrollments / saas_sequence_events.
 *
 * A cron (/cron/saas-sequences) auto-enrolls by billing status, advances due steps,
 * auto-stops dunning on recovery, then runs the exception scanner. Idempotent
 * throughout. Trial onboarding stays in drip.js to avoid double-emailing.
 */
import { supabaseAdmin, sendEmail, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requestHasCronSecret } from '../cron-auth.js'
import { saasCan } from './profile.js'

const DAY_MS = 86400000

function seqHtml(title, body) {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
    <h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#334155;white-space:pre-wrap;">${body}</div>
    <p style="margin-top:24px;font-size:14px;"><a href="${FRONTEND_URL}/login.html" style="color:#6366f1;font-weight:600;">Open MarketSync</a></p>
    <p style="margin-top:20px;font-size:13px;color:#94a3b8;">— The MarketSync team</p>
  </div>`
}
function mergeFields(str, ctx) {
  return String(str || '').replace(/\{\{\s*(first_name|account)\s*\}\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''))
}

// Recipient (account admin email + name) and the account/dealership name.
async function accountRecipient(dealershipId) {
  const [{ data: profs }, { data: dealer }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role').eq('dealership_id', dealershipId),
    supabaseAdmin.from('dealerships').select('name').eq('id', dealershipId).maybeSingle(),
  ])
  if (!profs?.length) return null
  const admin = profs.find(p => p.role === 'DEALER_ADMIN') || profs[0]
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(admin.id)
    const u = data?.user
    if (!u?.email || !u?.email_confirmed_at) return null
    return { email: u.email, name: u.user_metadata?.full_name || null, account: dealer?.name || null }
  } catch { return null }
}

async function logStep(e, stepIndex, action, detail) {
  await supabaseAdmin.from('saas_sequence_events').insert({
    enrollment_id: e.id, dealership_id: e.dealership_id, sequence_key: e.sequence_key,
    step_index: stepIndex, action, detail: detail || null,
  })
}

async function executeStep(e, seq, s, stepIndex, summary) {
  if (s.type === 'email') {
    const rcpt = await accountRecipient(e.dealership_id)
    if (rcpt?.email) {
      const ctx = { first_name: (rcpt.name || '').split(' ')[0] || 'there', account: rcpt.account || 'your dealership' }
      const subject = mergeFields(s.subject, ctx)
      const r = await sendEmail({ to: rcpt.email, subject, html: seqHtml(subject, mergeFields(s.body, ctx)) })
      if (r.ok) { summary.emails++; await logStep(e, stepIndex, 'email', subject) }
    }
  } else if (s.type === 'task') {
    await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id: e.dealership_id, title: s.title || `${seq.name} — step ${stepIndex + 1}`,
      note: s.note || null, priority: s.priority || 'normal', due_at: new Date().toISOString(),
    })
    summary.tasks++
    await logStep(e, stepIndex, 'task', s.title)
  }
}

// Load every sequence definition (enabled + steps, with template copy resolved) from
// the DB, keyed by sequence.key — this is what the runner executes.
async function loadSequenceDefs() {
  const [{ data: seqs }, { data: steps }, { data: tmpls }] = await Promise.all([
    supabaseAdmin.from('saas_sequences').select('*'),
    supabaseAdmin.from('saas_sequence_steps').select('*').order('step_order', { ascending: true }),
    supabaseAdmin.from('saas_email_templates').select('*'),
  ])
  const tById = Object.fromEntries((tmpls || []).map(t => [t.id, t]))
  const byId = {}, byKey = {}
  for (const s of seqs || []) { const def = { ...s, steps: [] }; byKey[s.key] = def; byId[s.id] = def }
  for (const st of steps || []) {
    const def = byId[st.sequence_id]; if (!def) continue
    const tmpl = st.template_id ? tById[st.template_id] : null
    def.steps.push({
      day: st.day_offset, type: st.type,
      subject: st.subject || tmpl?.subject || '', body: st.body || tmpl?.body || '',
      title: st.title, note: st.note, priority: st.priority,
    })
  }
  return byKey
}

// Create a live enrollment if none exists (idempotent via the partial unique index).
async function enroll(dealershipId, sequenceKey, createdBy) {
  const { data, error } = await supabaseAdmin.from('saas_sequence_enrollments')
    .insert({ dealership_id: dealershipId, sequence_key: sequenceKey, created_by: createdBy || null })
    .select().single()
  if (error) {
    if ((error.code === '23505') || /duplicate|unique/i.test(error.message || '')) return { skipped: true }
    throw error
  }
  return { enrollment: data }
}

// ── The engine ────────────────────────────────────────────────────────────────
export async function runSaasSequences({ trigger = 'manual' } = {}) {
  const summary = { trigger, enrolled: 0, stopped: 0, steps: 0, emails: 0, tasks: 0, completed: 0 }
  const defs = await loadSequenceDefs()

  // 1) Auto-enroll / auto-stop by billing status (only for enabled sequences).
  const [{ data: dealers }, { data: live }] = await Promise.all([
    supabaseAdmin.from('dealerships').select('id, billing_status').limit(5000),
    supabaseAdmin.from('saas_sequence_enrollments').select('id, dealership_id, sequence_key, status').in('status', ['active', 'paused']),
  ])
  const liveByKey = new Map()
  for (const e of live || []) liveByKey.set(e.dealership_id + '|' + e.sequence_key, e)
  const dunningOn = defs.dunning?.enabled, winbackOn = defs.winback?.enabled
  for (const d of dealers || []) {
    const S = (d.billing_status || '').toUpperCase()
    try {
      if (dunningOn && S === 'PAST_DUE' && !liveByKey.has(d.id + '|dunning')) { await enroll(d.id, 'dunning', null); summary.enrolled++ }
      else if (winbackOn && S === 'INACTIVE' && !liveByKey.has(d.id + '|winback')) { await enroll(d.id, 'winback', null); summary.enrolled++ }
      if (S === 'ACTIVE') {
        const dn = liveByKey.get(d.id + '|dunning')
        if (dn) { await supabaseAdmin.from('saas_sequence_enrollments').update({ status: 'stopped', updated_at: new Date().toISOString() }).eq('id', dn.id); summary.stopped++ }
      }
    } catch (err) { console.error('[saas-seq] enroll failed for', d.id, err.message) }
  }

  // 2) Advance every active enrollment through its due steps.
  const { data: toRun } = await supabaseAdmin.from('saas_sequence_enrollments').select('*').eq('status', 'active')
  for (const e of toRun || []) {
    const seq = defs[e.sequence_key]
    if (!seq || !seq.enabled) continue
    const days = Math.floor((Date.now() - new Date(e.started_at).getTime()) / DAY_MS)
    let step = e.current_step
    while (step < seq.steps.length && seq.steps[step].day <= days) {
      try { await executeStep(e, seq, seq.steps[step], step, summary); summary.steps++ }
      catch (err) { console.error('[saas-seq] step failed', e.id, err.message) }
      step++
    }
    if (step !== e.current_step) {
      const done = step >= seq.steps.length
      await supabaseAdmin.from('saas_sequence_enrollments').update({
        current_step: step, last_step_at: new Date().toISOString(),
        status: done ? 'done' : 'active', updated_at: new Date().toISOString(),
      }).eq('id', e.id)
      if (done) summary.completed++
    }
  }
  console.log(`[saas-seq:${trigger}] enrolled ${summary.enrolled}, steps ${summary.steps} (${summary.emails} email / ${summary.tasks} task), completed ${summary.completed}, stopped ${summary.stopped}`)
  return summary
}

// ── Exception scanner (Phase 4) ───────────────────────────────────────────────
export async function runSaasExceptionScan() {
  const summary = { scanned: 0, created: 0 }
  const since = new Date(Date.now() - 14 * DAY_MS).toISOString()
  const [{ data: dealers }, { data: openF }, { data: recent }] = await Promise.all([
    supabaseAdmin.from('dealerships').select('id, name, billing_status, trial_ends_at').limit(5000),
    supabaseAdmin.from('saas_account_followups').select('dealership_id, title').is('completed_at', null),
    supabaseAdmin.from('events').select('dealership_id').gte('created_at', since).limit(20000),
  ])
  const activeRecently = new Set((recent || []).map(e => e.dealership_id))
  const hasOpen = (did, tag) => (openF || []).some(f => f.dealership_id === did && (f.title || '').startsWith(tag))
  async function ensure(did, tag, title, priority, note) {
    if (hasOpen(did, tag)) return
    await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id: did, title, note: note || null, priority: priority || 'normal', due_at: new Date().toISOString(),
    })
    summary.created++
  }
  const now = Date.now()
  for (const d of dealers || []) {
    summary.scanned++
    const S = (d.billing_status || '').toUpperCase()
    if (d.trial_ends_at) {
      const days = Math.round((new Date(d.trial_ends_at).getTime() - now) / DAY_MS)
      if (S !== 'ACTIVE' && days >= 0 && days <= 3) {
        try { await ensure(d.id, 'Trial ending', `Trial ending in ${days}d — convert ${d.name}`, 'high', 'Trial is almost over. Reach out to convert before it lapses.') }
        catch (e) { console.error('[saas-scan] trial flag failed', d.id, e.message) }
      }
    }
    if (S === 'ACTIVE' && !activeRecently.has(d.id)) {
      try { await ensure(d.id, 'Usage dropped', `Usage dropped — check in with ${d.name}`, 'high', 'No activity in 14+ days on a paying account — churn risk.') }
      catch (e) { console.error('[saas-scan] usage flag failed', d.id, e.message) }
    }
  }
  console.log(`[saas-scan] scanned ${summary.scanned}, created ${summary.created} follow-up(s)`)
  return summary
}

// ── HQ routes ─────────────────────────────────────────────────────────────────
export function registerSaasSequences(app) {
  const can = (perm) => (req, res) => { if (saasCan(req, perm)) return true; res.status(403).json({ error: 'Insufficient permission' }); return false }
  const touch = () => ({ updated_at: new Date().toISOString() })

  // Catalog + live enrollment counts (used by the Customer 360 enroll picker).
  app.get('/saas/sequences', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const [{ data: seqs }, { data: enr }] = await Promise.all([
      supabaseAdmin.from('saas_sequences').select('key, name, trigger, description, enabled'),
      supabaseAdmin.from('saas_sequence_enrollments').select('sequence_key, status'),
    ])
    const counts = {}
    for (const r of enr || []) { const k = r.sequence_key; (counts[k] = counts[k] || { active: 0, total: 0 }); counts[k].total++; if (r.status === 'active') counts[k].active++ }
    res.json({ sequences: (seqs || []).map(s => ({ ...s, active: counts[s.key]?.active || 0, total: counts[s.key]?.total || 0 })) })
  })

  // Manually enroll an account.
  app.post('/saas/sequences/enroll', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { dealership_id, sequence_key } = req.body || {}
    if (!dealership_id || !sequence_key) return res.status(400).json({ error: 'dealership_id and sequence_key required' })
    const { data: seq } = await supabaseAdmin.from('saas_sequences').select('key').eq('key', sequence_key).maybeSingle()
    if (!seq) return res.status(400).json({ error: 'Unknown sequence' })
    try {
      const r = await enroll(dealership_id, sequence_key, req.user.id)
      if (r.skipped) return res.status(409).json({ error: 'Account is already in this sequence' })
      res.json(r.enrollment)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Pause / resume / stop an ENROLLMENT (operates on an enrollment id).
  app.patch('/saas/sequences/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const status = req.body?.status
    if (!['active', 'paused', 'stopped'].includes(status)) return res.status(400).json({ error: 'invalid status' })
    const { data, error } = await supabaseAdmin.from('saas_sequence_enrollments')
      .update({ status, ...touch() }).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // ── Automation builder — sequence DEFINITIONS + steps ──
  app.get('/saas/automation/sequences', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const [{ data: seqs }, { data: steps }, { data: enr }] = await Promise.all([
      supabaseAdmin.from('saas_sequences').select('*').order('created_at', { ascending: true }),
      supabaseAdmin.from('saas_sequence_steps').select('*').order('step_order', { ascending: true }),
      supabaseAdmin.from('saas_sequence_enrollments').select('sequence_key, status'),
    ])
    const counts = {}
    for (const r of enr || []) { const k = r.sequence_key; (counts[k] = counts[k] || { active: 0, total: 0 }); counts[k].total++; if (r.status === 'active') counts[k].active++ }
    res.json({
      sequences: (seqs || []).map(s => ({
        ...s, active: counts[s.key]?.active || 0, total: counts[s.key]?.total || 0,
        steps: (steps || []).filter(st => st.sequence_id === s.id),
      })),
    })
  })

  app.post('/saas/automation/sequences', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { key, name, trigger, description } = req.body || {}
    if (!key || !name) return res.status(400).json({ error: 'key and name required' })
    const { data, error } = await supabaseAdmin.from('saas_sequences')
      .insert({ key: String(key).toLowerCase().replace(/[^a-z0-9_]/g, '_'), name, trigger: trigger || 'manual', description: description || null }).select().single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'A sequence with that key exists' : error.message })
    res.json(data)
  })

  app.patch('/saas/automation/sequences/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const patch = touch()
    for (const k of ['name', 'trigger', 'description', 'enabled']) if (k in (req.body || {})) patch[k] = req.body[k]
    const { data, error } = await supabaseAdmin.from('saas_sequences').update(patch).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.delete('/saas/automation/sequences/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('saas_sequences').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  app.post('/saas/automation/sequences/:id/steps', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const b = req.body || {}
    const { data: existing } = await supabaseAdmin.from('saas_sequence_steps').select('step_order').eq('sequence_id', req.params.id)
    const nextOrder = (existing || []).reduce((m, r) => Math.max(m, r.step_order + 1), 0)
    const { data, error } = await supabaseAdmin.from('saas_sequence_steps').insert({
      sequence_id: req.params.id, step_order: nextOrder,
      day_offset: b.day_offset || 0, type: b.type === 'task' ? 'task' : 'email',
      template_id: b.template_id || null, subject: b.subject || null, body: b.body || null,
      title: b.title || null, note: b.note || null, priority: b.priority || null,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.patch('/saas/automation/steps/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const patch = touch()
    for (const k of ['day_offset', 'type', 'template_id', 'subject', 'body', 'title', 'note', 'priority', 'step_order']) if (k in (req.body || {})) patch[k] = req.body[k]
    const { data, error } = await supabaseAdmin.from('saas_sequence_steps').update(patch).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.delete('/saas/automation/steps/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('saas_sequence_steps').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  app.post('/saas/automation/sequences/:id/reorder', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const order = Array.isArray(req.body?.order) ? req.body.order : []
    for (let i = 0; i < order.length; i++) {
      await supabaseAdmin.from('saas_sequence_steps').update({ step_order: i, ...touch() }).eq('id', order[i]).eq('sequence_id', req.params.id)
    }
    res.json({ ok: true })
  })

  // ── Email template library ──
  app.get('/saas/automation/templates', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const { data } = await supabaseAdmin.from('saas_email_templates').select('*').order('updated_at', { ascending: false })
    res.json({ templates: data || [] })
  })
  app.post('/saas/automation/templates', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { name, subject, body } = req.body || {}
    if (!name || !subject || !body) return res.status(400).json({ error: 'name, subject and body required' })
    const { data, error } = await supabaseAdmin.from('saas_email_templates').insert({ name, subject, body, created_by: req.user.id }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })
  app.patch('/saas/automation/templates/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const patch = touch()
    for (const k of ['name', 'subject', 'body']) if (k in (req.body || {})) patch[k] = req.body[k]
    const { data, error } = await supabaseAdmin.from('saas_email_templates').update(patch).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })
  app.delete('/saas/automation/templates/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('saas_email_templates').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── Email campaigns (Part 2) — one-off sends to a customer segment ──
  async function segmentDealers(segment) {
    let q = supabaseAdmin.from('dealerships').select('id, name, billing_status, trial_ends_at')
    const now = new Date().toISOString()
    if (segment === 'active') q = q.eq('billing_status', 'ACTIVE')
    else if (segment === 'past_due') q = q.eq('billing_status', 'PAST_DUE')
    else if (segment === 'cancelled') q = q.eq('billing_status', 'INACTIVE')
    else if (segment === 'trialing') q = q.or(`billing_status.eq.TRIALING,trial_ends_at.gt.${now}`)
    const { data } = await q.limit(2000)
    return data || []
  }

  app.get('/saas/automation/campaigns', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const { data } = await supabaseAdmin.from('saas_campaigns').select('*').order('created_at', { ascending: false }).limit(200)
    res.json({ campaigns: data || [] })
  })

  // Recipient-count preview for a segment.
  app.get('/saas/automation/segment-count', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const dealers = await segmentDealers(String(req.query.segment || 'all'))
    res.json({ count: dealers.length })
  })

  app.post('/saas/automation/campaigns', requireAuth, async (req, res) => {
    if (!can('marketing')(req, res)) return
    const { name, segment, subject, body, template_id } = req.body || {}
    if (!name || !subject || !body) return res.status(400).json({ error: 'name, subject and body required' })
    const { data, error } = await supabaseAdmin.from('saas_campaigns').insert({
      name, segment: segment || 'all', subject, body, template_id: template_id || null, created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // Send a campaign now — resolve the segment, email each account's admin (merge
  // fields), record sent/fail counts. Capped to keep the request bounded.
  app.post('/saas/automation/campaigns/:id/send', requireAuth, async (req, res) => {
    if (!can('marketing')(req, res)) return
    const { data: c } = await supabaseAdmin.from('saas_campaigns').select('*').eq('id', req.params.id).maybeSingle()
    if (!c) return res.status(404).json({ error: 'Campaign not found' })
    if (c.status === 'sent') return res.status(409).json({ error: 'Campaign already sent' })
    const dealers = (await segmentDealers(c.segment)).slice(0, 500)
    let sent = 0, fail = 0
    for (const d of dealers) {
      try {
        const rcpt = await accountRecipient(d.id)
        if (!rcpt?.email) { fail++; continue }
        const ctx = { first_name: (rcpt.name || '').split(' ')[0] || 'there', account: rcpt.account || 'your dealership' }
        const r = await sendEmail({ to: rcpt.email, subject: mergeFields(c.subject, ctx), html: seqHtml(mergeFields(c.subject, ctx), mergeFields(c.body, ctx)) })
        if (r.ok) sent++; else fail++
      } catch { fail++ }
    }
    const { data: updated } = await supabaseAdmin.from('saas_campaigns')
      .update({ status: 'sent', sent_count: sent, fail_count: fail, sent_at: new Date().toISOString() })
      .eq('id', c.id).select().single()
    res.json(updated || { ok: true, sent, fail })
  })

  // Cron: auto-enroll + advance sequences, then run the exception scan.
  app.post('/cron/saas-sequences', async (req, res) => {
    if (!requestHasCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const sequences = await runSaasSequences({ trigger: 'cron' })
      const exceptions = await runSaasExceptionScan()
      res.json({ sequences, exceptions })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
