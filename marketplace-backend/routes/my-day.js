/**
 * My Day — one queue, composed across departments (Phase 6.10).
 *
 * Every department already answers "what needs attention here?" for itself. This composes
 * those answers into the single list an employee actually opens in the morning, and it
 * derives nothing of its own: a second opinion about severity would drift from the department
 * that owns the fact, and then two screens would disagree about the same dealership.
 *
 * Three rules, each of them a direct application of AGENTS.md A19/A20:
 *
 *   1. A source the caller may not see is never loaded. Permission is checked per SOURCE, not
 *      once for the endpoint — My Day spans departments, so a single gate would either leak
 *      accounting exceptions to a salesperson or hide them from a controller.
 *
 *   2. A source that FAILS is reported as failed. Silently dropping it would render a calm,
 *      empty morning for a dealership that actually has eleven problems — "empty success is a
 *      failure mode", and this is exactly the shape it takes.
 *
 *   3. Every item is normalized before it ships. `accountingExceptions` predates the attention
 *      contract and carries no `subject`; composing it raw would render blank rows. A row
 *      nobody can read is not attention, it is noise.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { hasPermission } from '../authorization.js'
import { campaignAttention } from './campaigns.js'
import { socialAttention } from './social.js'
import { conversationAttention } from './conversations.js'
import { reputationAttention } from './reputation.js'
import { salesVideoAttention } from './sales-video.js'
import { accountingExceptions } from './accounting-ar-ap.js'

/**
 * Every department that can answer for itself, and what a caller must hold to see it.
 *
 * Adding a department here is the whole integration — that is the point of the attention
 * contract. A department with no builder is absent, and `MY_DAY_GAPS` says so out loud rather
 * than letting a quiet omission read as "nothing to do".
 */
export const MY_DAY_SOURCES = [
  { key: 'campaigns', label: 'Campaigns', department: 'Marketing', permission: 'marketing.view', load: campaignAttention },
  { key: 'social', label: 'Social', department: 'Marketing', permission: 'marketing.view', load: socialAttention },
  { key: 'reputation', label: 'Reputation', department: 'Marketing', permission: 'marketing.view', load: reputationAttention },
  { key: 'conversations', label: 'Conversations', department: 'Sales', permission: 'customer.view', load: conversationAttention },
  { key: 'sales_video', label: 'Sales video', department: 'Sales', permission: 'customer.view', load: salesVideoAttention },
  { key: 'accounting', label: 'Accounting', department: 'Accounting', permission: 'accounting.view', load: accountingExceptions },
]

/**
 * Departments that do NOT yet emit server-side attention. Named deliberately: an employee
 * whose whole job is Service should not be told their day is clear by a queue that was never
 * able to see Service in the first place.
 */
export const MY_DAY_GAPS = ['Service', 'Parts', 'Inventory', 'F&I', 'People']

const SEVERITY_MIN = 1
const SEVERITY_MAX = 3

/**
 * Bring one department's item onto the shared contract. Pure, so the normalization is
 * testable without a database.
 *
 * Returns null for an item too malformed to render — a row with no subject AND no reason
 * tells a person nothing, and shipping it would just make the queue longer.
 */
export function normalizeItem(raw, source) {
  if (!raw || typeof raw !== 'object') return null

  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
  // `accountingExceptions` predates this contract and has no subject. Build one from what it
  // does carry rather than rendering an empty row.
  const subject = (typeof raw.subject === 'string' && raw.subject.trim())
    ? raw.subject.trim()
    : (raw.source ? `${String(raw.source)} · ${String(raw.kind || 'exception').replace(/_/g, ' ')}`
                  : String(raw.kind || '').replace(/_/g, ' ').trim())

  if (!subject && !reason) return null

  const sev = Number(raw.severity)
  return {
    kind: String(raw.kind || 'unknown'),
    severity: Number.isFinite(sev) ? Math.min(SEVERITY_MAX, Math.max(SEVERITY_MIN, Math.round(sev))) : 2,
    subject: subject || reason.slice(0, 60),
    reason,
    // The department that can actually fix it, which is not always the one that noticed.
    owner: String(raw.owner || source.department),
    action: String(raw.action || 'Review'),
    ref: raw.ref ?? null,
    amount: raw.amount ?? null,
    age_days: raw.age_days ?? null,
    source: source.key,
    source_label: source.label,
  }
}

/**
 * Build one person's day.
 *
 * `failed` is part of the answer, not an error path. A morning that looks calm because
 * Accounting timed out is worse than one that says so.
 */
export async function buildMyDay(req, { sources = MY_DAY_SOURCES, can = hasPermission } = {}) {
  const dealershipId = req.dealershipId
  if (!dealershipId) throw new Error('No dealership on this session.')

  const allowed = []
  for (const s of sources) {
    // A permission lookup that throws must not be read as "allowed". Failing open here would
    // put another department's exceptions in front of someone who may not see them.
    let ok = false
    try { ok = await can(req, s.permission) } catch { ok = false }
    if (ok) allowed.push(s)
  }

  const results = await Promise.all(allowed.map(async (s) => {
    try {
      const rows = await s.load(dealershipId)
      return { source: s, items: Array.isArray(rows) ? rows : [] }
    } catch (e) {
      return { source: s, items: [], error: e?.message || 'could not be loaded' }
    }
  }))

  const items = []
  const failed = []
  for (const r of results) {
    if (r.error) {
      failed.push({ source: r.source.key, label: r.source.label, reason: r.error })
      continue
    }
    for (const raw of r.items) {
      const item = normalizeItem(raw, r.source)
      if (item) items.push(item)
    }
  }

  // Problems and opportunities read differently, so they are separated rather than ranked
  // against each other — "this is working, do more" is not a smaller version of "this is
  // broken". Within problems, worst first, then oldest.
  const needsAttention = items.filter(i => i.severity >= 2)
    .sort((a, b) => (b.severity - a.severity) || ((b.age_days || 0) - (a.age_days || 0)))
  const opportunities = items.filter(i => i.severity < 2)

  return {
    needs_attention: needsAttention,
    opportunities,
    total: items.length,
    // What this queue could see, what it could not, and what it has never been able to see.
    sources: allowed.map(s => s.key),
    failed,
    not_covered: MY_DAY_GAPS,
    complete: failed.length === 0,
  }
}

export function registerMyDay(app) {
  /**
   * Deliberately gated on authentication only. Every SOURCE carries its own permission, so a
   * salesperson gets a real day without accounting exceptions rather than a 403 — and a
   * controller sees theirs. A single endpoint-level permission could only do one of those.
   */
  app.get('/my-day', requireAuth, requireMfa, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    try {
      res.json(await buildMyDay(req))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
