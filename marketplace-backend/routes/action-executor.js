/**
 * Action Executor — Stage 4 of the Workflow Engine.
 *
 *   events → workflow engine → system_actions → action_executor → { executors }
 *
 * The engine never talks to a provider directly. It calls dispatchAction(), which
 * records a system_action_runs row and routes to a single registered executor
 * (email, sms, vin_decode, carfax, accounting, webhook, notification). Every attempt
 * is written to the ledger, giving us:
 *   • retry safety   — a transient failure is retried with backoff (5m, 15m, 60m)
 *   • dead-lettering — after max_attempts the run goes 'dead', raises an exception
 *                      and notifies the manager
 *   • auditability   — provider responses + errors are captured per attempt
 *
 * Executor contract: return a JSON-able provider response on success, or
 * { skipped: true, reason } when the provider simply isn't configured (a terminal,
 * non-error outcome — no retry). THROW for real/transient failures — those retry.
 *
 * Adding a new capability is now: register one executor here + emit an action from a
 * workflow step. No new bespoke module, no new retry logic.
 */
import { supabaseAdmin, resend, EMAIL_FROM } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notifications.js'
import { emitWebhook } from '../webhooks.js'
import { raiseException } from './workflow.js'

// Minutes to wait before each retry, indexed by attempt number (1-based).
const BACKOFF_MIN = [5, 15, 60]
const backoffFor = (attempt) => BACKOFF_MIN[Math.min(attempt, BACKOFF_MIN.length) - 1] || 60

// ── Executor registry ───────────────────────────────────────────────────────
const EXECUTORS = {
  async email(p) {
    if (!resend) return { skipped: true, reason: 'email_not_configured' }
    if (!p.to) throw new Error('email: missing recipient')
    const r = await resend.emails.send({ from: p.from || EMAIL_FROM, to: p.to, subject: p.subject || '', html: p.html || p.text || '' })
    if (r?.error) throw new Error('resend: ' + (r.error.message || 'send failed'))
    return { id: r?.data?.id || null }
  },
  async sms(p) {
    if (!p.to) throw new Error('sms: missing recipient')
    const { sendDealerSms } = await import('./automation.js')
    const r = await sendDealerSms(p.dealershipId, p.to, p.body || '')
    if (r?.simulated) return { skipped: true, reason: 'sms_not_configured' }
    if (!r?.ok) throw new Error('sms: ' + (r?.error || 'send failed'))
    return { sid: r.sid || null }
  },
  async vin_decode(p) {
    const { autoDecodeInventory } = await import('../sync/vinDecode.js')
    const r = await autoDecodeInventory(p.dealershipId, { max: p.max || 10 })
    return r || { ok: true }
  },
  // No Carfax/AutoCheck provider wired yet — terminal skip (documented), not a failure.
  async carfax(p) { return { skipped: true, reason: 'carfax_not_configured' } },
  // Real ledger/commission posting happens on the delivery path (idempotent there);
  // routing it here too would double-post, so the accounting executor is a no-op that
  // exists for future direct-posting workflows.
  async accounting(p) { return { skipped: true, reason: 'handled_by_delivery_path' } },
  async webhook(p) { await emitWebhook(p.dealershipId, p.event || 'workflow.action', p.data || {}); return { ok: true } },
  async notification(p) {
    await createNotification({ dealershipId: p.dealershipId, type: p.ntype || 'task', title: p.title || '', body: p.body || '', linkPage: p.linkPage || null, targetUserId: p.targetUserId || null })
    return { ok: true }
  },
}
// Map a workflow step's action_type → executor name.
const ACTION_TO_EXECUTOR = {
  send_email: 'email', email: 'email',
  send_sms: 'sms', sms: 'sms',
  system_vin_decode: 'vin_decode', vin_decode: 'vin_decode',
  system_carfax: 'carfax', carfax: 'carfax',
  post_ledger: 'accounting', post_commission: 'accounting', accounting: 'accounting',
  webhook: 'webhook',
  send_notification: 'notification', notification: 'notification',
}
export function isExecutableAction(actionType) { return !!ACTION_TO_EXECUTOR[actionType] }

// ── Dispatch + run ──────────────────────────────────────────────────────────
// Create a ledger row and attempt it immediately. Never throws — failures are
// recorded on the run and retried by the worker.
export async function dispatchAction({ dealershipId, actionType, payload = {}, workflowInstanceId = null, workflowStepId = null, entityType = null, entityId = null, maxAttempts = 3 }) {
  if (!dealershipId || !actionType) return null
  const executor = ACTION_TO_EXECUTOR[actionType]
  if (!executor) { console.warn('[action-executor] no executor for', actionType); return null }
  let run
  try {
    const { data } = await supabaseAdmin.from('system_action_runs').insert({
      dealership_id: dealershipId, workflow_instance_id: workflowInstanceId, workflow_step_id: workflowStepId,
      action_type: actionType, executor, entity_type: entityType, entity_id: entityId,
      status: 'pending', max_attempts: maxAttempts, payload: { ...payload, dealershipId },
    }).select('*').single()
    run = data
  } catch (e) { console.error('[action-executor] could not create run:', e.message); return null }
  return runAction(run)
}

// Execute one ledger row (fresh or a retry). Idempotent per attempt.
async function runAction(run) {
  if (!run) return null
  const fn = EXECUTORS[run.executor]
  const now = new Date().toISOString()
  const attempt = (run.attempts || 0) + 1
  await supabaseAdmin.from('system_action_runs').update({ status: 'running', attempts: attempt, executed_at: now, updated_at: now }).eq('id', run.id)
  try {
    if (!fn) throw new Error('unknown executor: ' + run.executor)
    const resp = await fn(run.payload || {})
    await supabaseAdmin.from('system_action_runs').update({
      status: 'succeeded', provider_response: resp || {}, error: null, next_retry_at: null, updated_at: new Date().toISOString(),
    }).eq('id', run.id)
    return { ok: true, response: resp }
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 1000)
    if (attempt < (run.max_attempts || 3)) {
      const next = new Date(Date.now() + backoffFor(attempt) * 60 * 1000).toISOString()
      await supabaseAdmin.from('system_action_runs').update({ status: 'failed', error: msg, next_retry_at: next, updated_at: new Date().toISOString() }).eq('id', run.id)
      console.warn(`[action-executor] ${run.action_type} attempt ${attempt} failed: ${msg} — retry in ${backoffFor(attempt)}m`)
      return { ok: false, retrying: true }
    }
    // Exhausted — dead-letter: raise an exception + notify the manager.
    await supabaseAdmin.from('system_action_runs').update({ status: 'dead', error: msg, next_retry_at: null, updated_at: new Date().toISOString() }).eq('id', run.id)
    console.error(`[action-executor] ${run.action_type} DEAD after ${attempt} attempts: ${msg}`)
    await raiseException(run.dealership_id, {
      kind: 'action_failed', entityType: run.entity_type || 'task', entityId: run.entity_id || run.id,
      department: null, severity: 'high', description: `${run.action_type} failed after ${attempt} attempts: ${msg}`,
    }).catch(() => {})
    await createNotification({
      dealershipId: run.dealership_id, type: 'task', title: `Action failed: ${run.action_type}`,
      body: msg, linkPage: 'operations',
    }).catch(() => {})
    return { ok: false, dead: true }
  }
}

// ── Retry worker — re-runs due failures (called on an interval from sync.js) ──
export async function retryDueActions() {
  try {
    const { data } = await supabaseAdmin.from('system_action_runs').select('*')
      .eq('status', 'failed').lte('next_retry_at', new Date().toISOString()).limit(100)
    for (const run of data || []) await runAction(run)
    if (data?.length) console.log(`[action-executor] retried ${data.length} due action(s)`)
  } catch (e) { console.error('[action-executor] retry sweep failed:', e.message) }
}

// ── HTTP surface — the action run ledger (managers) ─────────────────────────
export function registerActionExecutor(app) {
  app.get('/action-runs', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    let q = supabaseAdmin.from('system_action_runs').select('*')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
    if (req.query.status) q = q.eq('status', String(req.query.status))
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ runs: data || [] })
  })

  // Manually re-drive a dead run (manager retry from the dashboard).
  app.post('/action-runs/:id/retry', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: run } = await supabaseAdmin.from('system_action_runs').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!run) return res.status(404).json({ error: 'not found' })
    // Give it a fresh attempt budget so a manual retry always runs.
    await supabaseAdmin.from('system_action_runs').update({ status: 'failed', attempts: 0, next_retry_at: new Date().toISOString() }).eq('id', run.id)
    const r = await runAction({ ...run, attempts: 0, status: 'failed' })
    res.json({ ok: true, result: r })
  })
}
