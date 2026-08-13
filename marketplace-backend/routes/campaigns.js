/**
 * Campaigns — the canonical Marketing initiative (Phase 6 PR 6.1).
 *
 * A Campaign is ONE identity that may span Meta, Google, organic social, email, SMS, a
 * landing page and a slice of inventory. A provider's own "campaign" is an external
 * REFERENCE to this record (`campaign_external_refs`), never the identity — otherwise the
 * same initiative fragments into one campaign per provider and can never be measured whole.
 *
 * Two rules run through everything here:
 *   • Attribution is by ID. A contact or lead linked through `campaign_id` is LINKED
 *     attribution. A legacy free-text `source` string is INFERRED attribution, reported as
 *     such and never silently upgraded — the strings are the only record older rows have.
 *   • Marketing consumes financial truth, it does not invent it. Gross comes from the
 *     posted ledger; where a delivered deal has no posted gross, the campaign reports units
 *     WITHOUT gross rather than assuming an average.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { socialAttention } from './social.js'
import { conversationAttention } from './conversations.js'
import { reputationAttention } from './reputation.js'

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

const STATUSES = ['draft', 'needs_approval', 'approved', 'active', 'paused', 'completed', 'cancelled', 'exception']
// Which moves are legal. Kept small and explicit — a campaign that can go anywhere from
// anywhere has no lifecycle at all.
const TRANSITIONS = {
  draft: ['needs_approval', 'approved', 'cancelled'],
  needs_approval: ['approved', 'draft', 'cancelled'],
  approved: ['active', 'draft', 'cancelled'],
  active: ['paused', 'completed', 'exception'],
  paused: ['active', 'completed', 'cancelled'],
  exception: ['active', 'paused', 'cancelled'],
  completed: [],
  cancelled: [],
}

// ── Source taxonomy ─────────────────────────────────────────────────────────
// Global rows plus this dealership's own additions. One vocabulary, so no screen has to
// invent its own spelling.
export async function marketingSources(dealershipId) {
  const { data } = await supabaseAdmin.from('marketing_sources')
    .select('key, label, channel, paid, active, dealership_id')
    .or(`dealership_id.eq.${dealershipId},dealership_id.is.null`)
    .eq('active', true).order('sort')
  const seen = new Set()
  const out = []
  // A dealership's own row for a key wins over the global of the same key.
  for (const s of [...(data || [])].sort((a, b) => (a.dealership_id ? 0 : 1) - (b.dealership_id ? 0 : 1))) {
    if (seen.has(s.key)) continue
    seen.add(s.key); out.push(s)
  }
  return out
}

// Map a legacy free-text source onto a taxonomy key. This is INFERENCE, and its result is
// always labelled as such — it exists so historical rows stay readable, not so they can
// masquerade as linked attribution.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve the campaign a visitor arrived from, by ID.
 *
 * Deliberately ID-only. Matching a `utm_campaign` string against campaign NAMES would
 * reintroduce exactly the defect PR 6.1 removed — two campaigns called "Summer Sale" a year
 * apart, and an attribution that silently picks one. If the link does not carry a campaign
 * id belonging to this dealership, the visit is attributed as INFERRED from its source
 * string and `campaign_id` stays null. Unknown is a better answer than a plausible guess.
 */
export async function resolveCampaignForVisit(dealershipId, raw) {
  const id = String(raw || '').trim()
  if (!UUID_RE.test(id)) return null
  const { data } = await supabaseAdmin.from('campaigns')
    .select('id, dealership_id, deleted_at').eq('id', id).maybeSingle()
  // Cross-tenant campaign ids are ignored rather than honoured: a link cannot attribute a
  // lead to another dealership's campaign.
  if (!data || data.dealership_id !== dealershipId || data.deleted_at) return null
  return data.id
}

export function inferSourceKey(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null
  if (/(facebook marketplace|marketplace)/.test(s)) return 'facebook_marketplace'
  if (/(facebook ad|fb ad|meta ad)/.test(s)) return 'facebook_ads'
  if (/(instagram ad|ig ad)/.test(s)) return 'instagram_ads'
  if (/(google ad|adwords|ppc|sem)/.test(s)) return 'google_ads'
  if (/(facebook|fb\b|meta)/.test(s)) return 'facebook_organic'
  if (/(instagram|\big\b)/.test(s)) return 'instagram_organic'
  if (/tiktok/.test(s)) return 'tiktok'
  if (/youtube/.test(s)) return 'youtube'
  if (/linkedin/.test(s)) return 'linkedin'
  if (/(google|gmb|business profile|organic search|seo)/.test(s)) return 'organic_search'
  if (/(website|web|site|chatbot|chat|form|vdp)/.test(s)) return 'website'
  if (/email/.test(s)) return 'email'
  if (/(sms|text)/.test(s)) return 'sms'
  if (/referr/.test(s)) return 'referral'
  if (/(phone|call|inbound)/.test(s)) return 'phone'
  if (/(walk.?in|showroom|drive.?by)/.test(s)) return 'walk_in'
  if (/(autotrader|cargurus|kijiji|trader|third.?party)/.test(s)) return 'third_party_lead'
  return null
}

// ── Campaign performance, attributed by ID ──────────────────────────────────
// Returns per campaign: leads, customers, delivered units, and posted gross where the
// ledger actually has it.
export async function campaignPerformance(dealershipId, campaignIds) {
  const ids = (campaignIds || []).filter(Boolean)
  const blank = () => ({ leads: 0, customers: 0, delivered: 0, revenue: 0, gross: 0, gross_known: 0, gross_unknown: 0 })
  const out = Object.fromEntries(ids.map(id => [id, blank()]))
  if (!ids.length) return out

  const [{ data: leads }, { data: contacts }] = await Promise.all([
    supabaseAdmin.from('leads').select('id, campaign_id').eq('dealership_id', dealershipId).in('campaign_id', ids).is('deleted_at', null).limit(50000),
    supabaseAdmin.from('contacts').select('id, campaign_id').eq('dealership_id', dealershipId).in('campaign_id', ids).limit(50000),
  ])
  for (const l of leads || []) if (out[l.campaign_id]) out[l.campaign_id].leads++
  const contactCampaign = {}
  for (const c of contacts || []) { contactCampaign[c.id] = c.campaign_id; if (out[c.campaign_id]) out[c.campaign_id].customers++ }

  const contactIds = Object.keys(contactCampaign)
  if (!contactIds.length) return out

  const { data: deals } = await supabaseAdmin.from('deals')
    .select('id, contact_id, selling_price, deal_status, delivered_at')
    .eq('dealership_id', dealershipId).eq('deal_status', 'delivered')
    .in('contact_id', contactIds).is('deleted_at', null).limit(20000)
  if (!deals?.length) return out

  // Gross from the POSTED ledger — Marketing consumes Accounting's truth rather than
  // recomputing deal profitability. Revenue credits minus COGS debits on that deal's entry.
  const { data: entries } = await supabaseAdmin.from('journal_entries')
    .select('id, reference').eq('dealership_id', dealershipId).eq('source', 'deal')
    .eq('posted', true).in('reference', deals.map(d => d.id)).limit(20000)
  const entryByDeal = Object.fromEntries((entries || []).map(e => [e.reference, e.id]))
  const grossByDeal = {}
  const entryIds = Object.values(entryByDeal)
  if (entryIds.length) {
    const { data: lines } = await supabaseAdmin.from('journal_lines')
      .select('journal_entry_id, debit, credit, account_id').in('journal_entry_id', entryIds).limit(50000)
    const { data: accts } = await supabaseAdmin.from('gl_accounts')
      .select('id, category').eq('dealership_id', dealershipId)
    const catOf = Object.fromEntries((accts || []).map(a => [a.id, a.category]))
    const byEntry = {}
    for (const l of lines || []) {
      const cat = catOf[l.account_id]
      const g = (byEntry[l.journal_entry_id] ||= 0)
      if (cat === 'income') byEntry[l.journal_entry_id] = g + n(l.credit) - n(l.debit)
      else if (cat === 'cogs') byEntry[l.journal_entry_id] = g - (n(l.debit) - n(l.credit))
      else byEntry[l.journal_entry_id] = g
    }
    for (const [dealId, entryId] of Object.entries(entryByDeal)) grossByDeal[dealId] = round2(byEntry[entryId] || 0)
  }

  for (const d of deals) {
    const cid = contactCampaign[d.contact_id]
    const agg = out[cid]; if (!agg) continue
    agg.delivered++
    agg.revenue = round2(agg.revenue + n(d.selling_price))
    if (Object.prototype.hasOwnProperty.call(grossByDeal, d.id)) {
      agg.gross = round2(agg.gross + grossByDeal[d.id]); agg.gross_known++
    } else {
      // No posted journal for this delivery. Report the unit, never an assumed gross.
      agg.gross_unknown++
    }
  }
  return out
}

// Budget and actual are different columns for a reason: ROI is computed from ACTUAL only.
export async function campaignSpend(dealershipId, campaignIds) {
  const ids = (campaignIds || []).filter(Boolean)
  const out = Object.fromEntries(ids.map(id => [id, { budget: 0, actual: 0, imported: 0, manual: 0 }]))
  if (!ids.length) return out
  const { data } = await supabaseAdmin.from('marketing_spend')
    .select('campaign_id, kind, amount, origin').eq('dealership_id', dealershipId)
    .in('campaign_id', ids).is('deleted_at', null).limit(20000)
  for (const r of data || []) {
    const g = out[r.campaign_id]; if (!g) continue
    if (r.kind === 'budget') g.budget = round2(g.budget + n(r.amount))
    else {
      g.actual = round2(g.actual + n(r.amount))
      g[r.origin === 'imported' ? 'imported' : 'manual'] = round2(g[r.origin === 'imported' ? 'imported' : 'manual'] + n(r.amount))
    }
  }
  return out
}

// ── Attention and opportunity ───────────────────────────────────────────────
// What a marketing manager should look at, derived from real spend and real attribution.
// Every claim here is checkable: money went out and nothing came back, or a campaign is
// genuinely paying and deserves more.
export async function campaignAttention(dealershipId) {
  const { data: rows } = await supabaseAdmin.from('campaigns')
    .select('id, name, status, starts_at, ends_at, budget')
    .eq('dealership_id', dealershipId).is('deleted_at', null)
    .in('status', ['draft', 'needs_approval', 'approved', 'active', 'paused', 'exception']).limit(300)
  if (!rows?.length) return []

  const ids = rows.map(c => c.id)
  const [perf, spend] = await Promise.all([campaignPerformance(dealershipId, ids), campaignSpend(dealershipId, ids)])
  const items = []

  for (const c of rows) {
    const p = perf[c.id], s = spend[c.id]

    if (c.status === 'needs_approval') {
      items.push({ kind: 'campaign_needs_approval', severity: 2, subject: c.name,
        reason: 'Waiting for approval before it can run', owner: 'Marketing',
        action: 'Review Campaign', ref: c.id })
    }

    // Money out, nothing back. The most expensive thing marketing can do unnoticed.
    if (s.actual > 0 && p.leads === 0 && c.status === 'active') {
      items.push({ kind: 'campaign_spending_no_leads', severity: 3, subject: c.name,
        reason: `${s.actual.toFixed(2)} spent and no leads attributed yet`, owner: 'Marketing',
        action: 'Review Campaign', ref: c.id, amount: s.actual })
    }

    // Spending past the plan is a decision someone should make on purpose.
    if (s.budget > 0 && s.actual > s.budget) {
      items.push({ kind: 'campaign_over_budget', severity: 2, subject: c.name,
        reason: `Spent ${s.actual.toFixed(2)} against a ${s.budget.toFixed(2)} budget`,
        owner: 'Marketing', action: 'Review Campaign', ref: c.id, amount: round2(s.actual - s.budget) })
    }

    // An OPPORTUNITY, not a problem: it is working, and it is nearly over.
    if (s.actual > 0 && p.gross_known > 0 && p.gross > s.actual * 2 && c.status === 'active') {
      items.push({ kind: 'campaign_performing_well', severity: 1, subject: c.name,
        reason: `${p.delivered} delivered and ${p.gross.toFixed(2)} gross on ${s.actual.toFixed(2)} spent`,
        owner: 'Marketing', action: 'Review Campaign', ref: c.id, amount: p.gross })
    }

    // Ended but never closed off — its numbers keep looking live.
    if (c.status === 'active' && c.ends_at && new Date(c.ends_at) < new Date()) {
      items.push({ kind: 'campaign_ended_still_active', severity: 2, subject: c.name,
        reason: `Ended ${c.ends_at} and is still marked active`, owner: 'Marketing',
        action: 'Review Campaign', ref: c.id })
    }

    // The honest caveat, surfaced rather than buried in a tooltip.
    if (p.gross_unknown > 0) {
      items.push({ kind: 'campaign_gross_incomplete', severity: 1, subject: c.name,
        reason: `${p.gross_unknown} delivered unit(s) have no posted journal, so their gross is missing`,
        owner: 'Accounting', action: 'Review Deal', ref: c.id })
    }
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerCampaigns(app) {
  const canView = requirePermission('marketing.view')
  const canEdit = requirePermission('marketing.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  // Marketing's My Day, COMPOSED from what each slice already produces rather than
  // re-derived here. Composing is the point: a second derivation of "what needs attention"
  // would drift from the department that owns the fact.
  app.get('/marketing/attention', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const [campaign, social, conversation, reputation] = await Promise.all([
        campaignAttention(req.dealershipId).catch(() => []),
        socialAttention(req.dealershipId).catch(() => []),
        conversationAttention(req.dealershipId).catch(() => []),
        reputationAttention(req.dealershipId).catch(() => []),
      ])
      const items = [...campaign, ...social, ...conversation, ...reputation]
      // Opportunities read differently from problems, so they are separated rather than
      // ranked against each other — "this is working, do more" is not a smaller version of
      // "this is broken".
      const needsAttention = items.filter(i => i.severity >= 2).sort((a, b) => b.severity - a.severity)
      const opportunities = items.filter(i => i.severity < 2)
      res.json({ needs_attention: needsAttention, opportunities, total: items.length })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/marketing/sources', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ sources: await marketingSources(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/campaigns', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      let q = supabaseAdmin.from('campaigns').select('*')
        .eq('dealership_id', req.dealershipId).is('deleted_at', null)
      if (req.query.status) q = q.eq('status', String(req.query.status))
      const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
      if (error) return res.json({ campaigns: [] })
      const ids = (data || []).map(c => c.id)
      const [perf, spend] = await Promise.all([
        campaignPerformance(req.dealershipId, ids).catch(() => ({})),
        campaignSpend(req.dealershipId, ids).catch(() => ({})),
      ])
      res.json({
        campaigns: (data || []).map(c => {
          const p = perf[c.id] || {}, s = spend[c.id] || {}
          // ROI uses ACTUAL spend and POSTED gross. Never budget, never an assumed gross.
          const roi = s.actual > 0 && p.gross_known > 0 ? round2((p.gross - s.actual) / s.actual * 100) : null
          return {
            ...c, performance: p, spend: s, roi,
            cost_per_lead: s.actual > 0 && p.leads > 0 ? round2(s.actual / p.leads) : null,
            cost_per_sale: s.actual > 0 && p.delivered > 0 ? round2(s.actual / p.delivered) : null,
            // Honest about what the numbers can and cannot say.
            gross_complete: p.gross_unknown === 0,
          }
        }),
      })
    } catch { res.json({ campaigns: [] }) }
  })

  app.post('/campaigns', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const name = String(b.name || '').trim()
    if (!name) return res.status(400).json({ error: 'A campaign needs a name.' })
    // Channels must be real taxonomy keys — this is where source drift would start.
    const valid = new Set((await marketingSources(req.dealershipId)).map(s => s.key))
    const channels = (Array.isArray(b.channels) ? b.channels : []).map(String)
    const bad = channels.filter(c => !valid.has(c))
    if (bad.length) return res.status(400).json({ error: `Unknown marketing source: ${bad.join(', ')}` })
    try {
      const { data, error } = await supabaseAdmin.from('campaigns').insert({
        dealership_id: req.dealershipId, name,
        objective: b.objective || null, campaign_type: b.campaign_type || null,
        channels, offer: b.offer || null,
        inventory_scope: b.inventory_scope && typeof b.inventory_scope === 'object' ? b.inventory_scope : {},
        starts_at: b.starts_at || null, ends_at: b.ends_at || null,
        budget: round2(b.budget), owner_id: b.owner_id || req.user?.id || null,
        created_by: req.user?.id || null,
      }).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      audit(req, 'campaign.created', { after_state: data })
      res.json({ ok: true, campaign: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Lifecycle. The server owns which moves are legal; approval is recorded with its actor.
  app.post('/campaigns/:id/status', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const to = String(req.body?.status || '')
    if (!STATUSES.includes(to)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` })
    try {
      const { data: cur } = await supabaseAdmin.from('campaigns').select('*')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!cur) return res.status(404).json({ error: 'Campaign not found' })
      if (cur.status === to) return res.json({ ok: true, campaign: cur })
      if (!(TRANSITIONS[cur.status] || []).includes(to)) {
        return res.status(409).json({ error: `A ${cur.status} campaign cannot become ${to}.` })
      }
      const patch = { status: to, updated_at: new Date().toISOString() }
      if (to === 'approved') { patch.approved_by = req.user?.id || null; patch.approved_at = new Date().toISOString() }
      const { data, error } = await supabaseAdmin.from('campaigns').update(patch)
        .eq('id', cur.id).eq('dealership_id', req.dealershipId).eq('status', cur.status)   // lost-update guard
        .select('*').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(409).json({ error: 'The campaign changed while you were working on it.' })
      audit(req, 'campaign.status_changed', { before_state: cur, after_state: data })
      res.json({ ok: true, campaign: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // A provider's campaign id points AT ours. Unique per (dealership, provider, external id),
  // so the same provider row can never be counted under two campaigns.
  app.post('/campaigns/:id/external-ref', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const provider = String(req.body?.provider || '').trim().toLowerCase()
    const externalId = String(req.body?.external_id || '').trim()
    if (!provider || !externalId) return res.status(400).json({ error: 'provider and external_id are required' })
    try {
      const { data: c } = await supabaseAdmin.from('campaigns').select('id')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!c) return res.status(404).json({ error: 'Campaign not found' })
      const { data, error } = await supabaseAdmin.from('campaign_external_refs').insert({
        dealership_id: req.dealershipId, campaign_id: c.id, provider, external_id: externalId,
        external_name: req.body?.external_name || null,
      }).select('*').single()
      if (error) {
        if (String(error.message).includes('duplicate')) {
          return res.status(409).json({ error: 'That provider campaign is already linked to a campaign.' })
        }
        return res.status(500).json({ error: error.message })
      }
      res.json({ ok: true, ref: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Budget and actual are recorded separately, and an actual figure records its origin.
  app.post('/campaigns/:id/spend', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const kind = String(b.kind || '')
    const origin = String(b.origin || 'manual')
    if (!['budget', 'actual'].includes(kind)) return res.status(400).json({ error: "kind must be 'budget' or 'actual'" })
    if (!['manual', 'imported'].includes(origin)) return res.status(400).json({ error: "origin must be 'manual' or 'imported'" })
    if (!/^\d{4}-\d{2}$/.test(String(b.period || ''))) return res.status(400).json({ error: 'period must be YYYY-MM' })
    try {
      const { data: c } = await supabaseAdmin.from('campaigns').select('id')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!c) return res.status(404).json({ error: 'Campaign not found' })
      const { data, error } = await supabaseAdmin.from('marketing_spend').upsert({
        dealership_id: req.dealershipId, campaign_id: c.id,
        channel: String(b.channel || 'all'), period: String(b.period),
        kind, origin, provider: b.provider || null,
        amount: round2(b.amount), created_by: req.user?.id || null, updated_at: new Date().toISOString(),
      }, { onConflict: 'dealership_id,channel,period,kind,campaign_id' }).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      audit(req, 'campaign.spend_recorded', { after_state: data })
      res.json({ ok: true, spend: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Attribution for one campaign, separating what is LINKED from what is INFERRED.
  app.get('/campaigns/:id/attribution', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: c } = await supabaseAdmin.from('campaigns').select('*')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!c) return res.status(404).json({ error: 'Campaign not found' })
      const [perf, spend] = await Promise.all([
        campaignPerformance(req.dealershipId, [c.id]),
        campaignSpend(req.dealershipId, [c.id]),
      ])
      const p = perf[c.id], s = spend[c.id]
      res.json({
        campaign: c, performance: p, spend: s,
        attribution: {
          basis: 'linked',
          note: p.gross_unknown
            ? `${p.gross_unknown} delivered unit(s) have no posted journal, so their gross is not included.`
            : null,
        },
        roi: s.actual > 0 && p.gross_known > 0 ? round2((p.gross - s.actual) / s.actual * 100) : null,
      })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
