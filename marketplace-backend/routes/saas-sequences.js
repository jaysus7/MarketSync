/**
 * MarketSync HQ — customer-success SEQUENCES (Phase 3).
 *
 * Automated, multi-step cadences that MarketSync runs against its OWN customers
 * (dealership accounts): dunning (failed payment), win-back (cancelled), and a
 * manual white-glove onboarding cadence. Each step is an email (via the shared
 * mailer) or a task (an HQ follow-up on saas_account_followups).
 *
 * The catalog is config-as-code below. Enrollment + a per-step audit log live in
 * saas_sequence_enrollments / saas_sequence_events. A cron (/cron/saas-sequences)
 * auto-enrolls accounts by billing status, advances due steps, and stops dunning
 * automatically when an account recovers to ACTIVE. Idempotent: a partial unique
 * index guarantees one live enrollment per account per sequence, and current_step
 * guarantees each step fires once.
 *
 * Trial onboarding is intentionally NOT here — drip.js already owns trial emails.
 */
import { supabaseAdmin, sendEmail, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requestHasCronSecret } from '../cron-auth.js'
import { saasCan } from './profile.js'

const DAY_MS = 86400000

// ── Catalog ──────────────────────────────────────────────────────────────────
// step: { day, type:'email'|'task', subject/body (email) | title/note/priority (task) }
export const SAAS_SEQUENCES = {
  dunning: {
    name: 'Payment recovery',
    trigger: 'past_due',
    description: 'Recover a failed payment before the account churns.',
    steps: [
      { day: 0, type: 'email', subject: 'Your MarketSync payment didn’t go through',
        body: 'We had trouble charging your card for MarketSync. No action has been taken on your account yet — just update your payment method and you’re all set.' },
      { day: 2, type: 'email', subject: 'Reminder: update your card to keep MarketSync active',
        body: 'Your MarketSync subscription is past due. Update your payment details to avoid any interruption to posting, your dealer site, or the AI chat.' },
      { day: 5, type: 'task', priority: 'high', title: 'Call about failed payment',
        note: 'Dunning day 5 — personal outreach before access pauses.' },
      { day: 8, type: 'email', subject: 'Final notice — your MarketSync access will pause',
        body: 'This is the last reminder before your MarketSync access pauses. Update your card today to keep everything running.' },
    ],
  },
  winback: {
    name: 'Win-back',
    trigger: 'cancelled',
    description: 'Re-engage a cancelled account.',
    steps: [
      { day: 1, type: 'email', subject: 'We’d love to have you back at MarketSync',
        body: 'Your MarketSync account is paused. If there’s anything we could have done better, just reply — we read every message. Reactivating takes one click whenever you’re ready.' },
      { day: 14, type: 'email', subject: 'What’s new at MarketSync',
        body: 'A lot has shipped since you left — faster Facebook posting, a smarter AI chat, and deeper inventory intelligence. Come see what’s new.' },
      { day: 30, type: 'task', priority: 'normal', title: 'Win-back call',
        note: '30 days since cancellation — personal check-in.' },
    ],
  },
  onboarding_touch: {
    name: 'White-glove onboarding',
    trigger: 'manual',
    description: 'A hands-on onboarding cadence you enroll new accounts into.',
    steps: [
      { day: 0, type: 'task', priority: 'high', title: 'Onboarding kickoff call',
        note: 'Schedule the kickoff and confirm the inventory feed is connected.' },
      { day: 2, type: 'email', subject: 'Getting started with MarketSync',
        body: 'Welcome aboard! Here’s how to connect your inventory, install the extension, and post your first vehicles to Facebook Marketplace.' },
      { day: 7, type: 'task', priority: 'normal', title: 'Week-1 adoption check',
        note: 'Confirm they’ve posted, and offer help with anything stuck.' },
      { day: 14, type: 'email', subject: 'Two weeks in — get more from MarketSync',
        body: 'You’re rolling. Here are the features dealers get the most value from once they’re past setup.' },
    ],
  },
}

function seqHtml(title, body) {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
    <h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#334155;">${body}</div>
    <p style="margin-top:24px;font-size:14px;"><a href="${FRONTEND_URL}/login.html" style="color:#6366f1;font-weight:600;">Open MarketSync</a></p>
    <p style="margin-top:20px;font-size:13px;color:#94a3b8;">— The MarketSync team</p>
  </div>`
}

// The account's primary admin email (dealer admin, else first team member).
async function accountRecipient(dealershipId) {
  const { data: profs } = await supabaseAdmin.from('profiles').select('id, role').eq('dealership_id', dealershipId)
  if (!profs?.length) return null
  const admin = profs.find(p => p.role === 'DEALER_ADMIN') || profs[0]
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(admin.id)
    const u = data?.user
    if (!u?.email || !u?.email_confirmed_at) return null
    return { email: u.email, name: u.user_metadata?.full_name || null }
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
      const r = await sendEmail({ to: rcpt.email, subject: s.subject, html: seqHtml(s.subject, s.body) })
      if (r.ok) { summary.emails++; await logStep(e, stepIndex, 'email', s.subject) }
    }
  } else if (s.type === 'task') {
    await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id: e.dealership_id, title: s.title,
      note: s.note || `${seq.name} — step ${stepIndex + 1}`,
      priority: s.priority || 'normal', due_at: new Date().toISOString(),
    })
    summary.tasks++
    await logStep(e, stepIndex, 'task', s.title)
  }
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

  // 1) Auto-enroll / auto-stop by billing status.
  const [{ data: dealers }, { data: live }] = await Promise.all([
    supabaseAdmin.from('dealerships').select('id, billing_status').limit(5000),
    supabaseAdmin.from('saas_sequence_enrollments').select('id, dealership_id, sequence_key, status').in('status', ['active', 'paused']),
  ])
  const liveByKey = new Map()
  for (const e of live || []) liveByKey.set(e.dealership_id + '|' + e.sequence_key, e)
  for (const d of dealers || []) {
    const S = (d.billing_status || '').toUpperCase()
    try {
      if (S === 'PAST_DUE' && !liveByKey.has(d.id + '|dunning')) { await enroll(d.id, 'dunning', null); summary.enrolled++ }
      else if (S === 'INACTIVE' && !liveByKey.has(d.id + '|winback')) { await enroll(d.id, 'winback', null); summary.enrolled++ }
      if (S === 'ACTIVE') {
        const dn = liveByKey.get(d.id + '|dunning')
        if (dn) { await supabaseAdmin.from('saas_sequence_enrollments').update({ status: 'stopped', updated_at: new Date().toISOString() }).eq('id', dn.id); summary.stopped++ }
      }
    } catch (err) { console.error('[saas-seq] enroll failed for', d.id, err.message) }
  }

  // 2) Advance every active enrollment through its due steps.
  const { data: toRun } = await supabaseAdmin.from('saas_sequence_enrollments').select('*').eq('status', 'active')
  for (const e of toRun || []) {
    const seq = SAAS_SEQUENCES[e.sequence_key]
    if (!seq) continue
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
// Surfaces accounts that need a human, as idempotent HQ follow-ups: trials ending
// soon, and paying accounts whose usage has gone quiet. (Failed payments are handled
// by the dunning sequence, so they're not duplicated here.)
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

  // Catalog + live enrollment counts per sequence.
  app.get('/saas/sequences', requireAuth, async (req, res) => {
    if (!can('view_pipeline')(req, res)) return
    const { data: rows } = await supabaseAdmin.from('saas_sequence_enrollments').select('sequence_key, status')
    const counts = {}
    for (const r of rows || []) { const k = r.sequence_key; (counts[k] = counts[k] || { active: 0, total: 0 }); counts[k].total++; if (r.status === 'active') counts[k].active++ }
    res.json({
      sequences: Object.entries(SAAS_SEQUENCES).map(([key, s]) => ({
        key, name: s.name, trigger: s.trigger, description: s.description,
        steps: s.steps.length, active: counts[key]?.active || 0, total: counts[key]?.total || 0,
      })),
    })
  })

  // Manually enroll an account (e.g. onboarding_touch).
  app.post('/saas/sequences/enroll', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const { dealership_id, sequence_key } = req.body || {}
    if (!dealership_id || !SAAS_SEQUENCES[sequence_key]) return res.status(400).json({ error: 'dealership_id and a valid sequence_key are required' })
    try {
      const r = await enroll(dealership_id, sequence_key, req.user.id)
      if (r.skipped) return res.status(409).json({ error: 'Account is already in this sequence' })
      res.json(r.enrollment)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Pause / resume / stop an enrollment.
  app.patch('/saas/sequences/:id', requireAuth, async (req, res) => {
    if (!can('manage_followups')(req, res)) return
    const status = req.body?.status
    if (!['active', 'paused', 'stopped'].includes(status)) return res.status(400).json({ error: 'invalid status' })
    const { data, error } = await supabaseAdmin.from('saas_sequence_enrollments')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // Cron: auto-enroll + advance. Render Cron Job (daily):
  //   curl -X POST https://<backend>/cron/saas-sequences -H "x-cron-secret: $CRON_SECRET"
  app.post('/cron/saas-sequences', async (req, res) => {
    if (!requestHasCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const sequences = await runSaasSequences({ trigger: 'cron' })
      const exceptions = await runSaasExceptionScan()
      res.json({ sequences, exceptions })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
