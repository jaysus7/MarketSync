/**
 * Social accounts, grants and publishing authorization (Phase 6 PR 6.2).
 *
 * Built before any composer, deliberately: publishing is irreversible and external. A post
 * made as the wrong account cannot be recalled, so the decision about who may post as whom
 * lives here, on the server, and never in a UI that merely hides a button.
 *
 * The rule, in one place:
 *
 *   A dealership-owned account  → an explicit grant, or the marketing.publish permission.
 *   A user-owned account        → its owner, or someone explicitly granted it.
 *   Any account                 → must be in the caller's dealership, connected, and
 *                                 actually capable of the action at the provider.
 *
 * Nothing here calls a provider API yet. Where a provider cannot legitimately publish an
 * action, the account simply does not declare that capability, and the attempt is refused
 * with a reason — an honest assisted workflow rather than a button that fails at the edge.
 *
 * Tokens are stored with the existing encrypted-credentials helper and are NEVER selected
 * into a response. Every read in this file lists its columns explicitly for that reason.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission, hasPermission } from '../authorization.js'
import { audit } from '../audit.js'
import { dealerLocalToUtc } from '../utils/dealerTime.js'
import { encryptJson, PII_ENCRYPTION_VERSION } from '../crypto-pii.js'

const PROVIDERS = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin']

// Never select credentials_enc. Listing columns rather than '*' is what keeps a token from
// leaking into a response by accident when the table grows a column.
const SAFE_COLUMNS = [
  'id', 'dealership_id', 'provider', 'external_account_id', 'display_name', 'handle',
  'avatar_url', 'ownership', 'owner_user_id', 'status', 'capabilities',
  'token_expires_at', 'connected_by', 'connected_at', 'last_verified_at', 'last_error',
  'created_at', 'updated_at',
].join(', ')

/**
 * May this user perform this action on this account?
 *
 * Returns { allowed, reason }. The reason is written for a person — "you have not been
 * given access to this account" — because a bare false teaches nobody anything.
 *
 * This is THE authorization decision. Every publish path calls it; nothing bypasses it.
 */
export async function canActOnAccount(req, accountId, action = 'publish') {
  const dealershipId = req.dealershipId
  if (!dealershipId) return { allowed: false, reason: 'No dealership on this session.' }

  const { data: acct } = await supabaseAdmin.from('social_accounts')
    .select('id, dealership_id, provider, display_name, ownership, owner_user_id, status, capabilities')
    .eq('id', accountId).maybeSingle()

  // Cross-tenant reads are refused the same way a missing account is, so the response
  // cannot be used to discover that another dealership's account exists.
  if (!acct || acct.dealership_id !== dealershipId) {
    return { allowed: false, reason: 'That social account was not found.' }
  }
  if (acct.status !== 'connected') {
    return { allowed: false, reason: `${acct.display_name} is ${acct.status}. Reconnect the account first.`, account: acct }
  }
  // A provider that cannot do this is a refusal with a reason, never a silent failure later.
  const caps = acct.capabilities || {}
  const capKey = action === 'schedule' ? 'schedule' : action === 'approve' ? 'approve' : 'publish'
  if (capKey !== 'approve' && caps[capKey] === false) {
    return { allowed: false, reason: `${acct.display_name} does not support ${capKey === 'schedule' ? 'scheduling' : 'publishing'} through MarketSync.`, account: acct }
  }

  const userId = req.user?.id || null
  const { data: grant } = await supabaseAdmin.from('social_account_grants')
    .select('can_publish, can_schedule, can_approve')
    .eq('social_account_id', acct.id).eq('user_id', userId).maybeSingle()
  const granted = action === 'schedule' ? grant?.can_schedule
                : action === 'approve' ? grant?.can_approve
                : grant?.can_publish

  if (acct.ownership === 'user') {
    // Your own account is yours. Anyone else needs to have been given it explicitly —
    // a manager does NOT inherit a salesperson's personal account by seniority.
    if (acct.owner_user_id === userId) return { allowed: true, reason: null, account: acct }
    if (granted) return { allowed: true, reason: null, account: acct }
    return { allowed: false, reason: `${acct.display_name} belongs to another user and has not been shared with you.`, account: acct }
  }

  // Dealership-owned: an explicit grant, or the department-wide permission.
  if (granted) return { allowed: true, reason: null, account: acct }
  if (action === 'approve') {
    if (await hasPermission(req, 'marketing.approve').catch(() => false)) return { allowed: true, reason: null, account: acct }
    return { allowed: false, reason: `You cannot approve content for ${acct.display_name}.`, account: acct }
  }
  if (await hasPermission(req, 'marketing.publish').catch(() => false)) return { allowed: true, reason: null, account: acct }
  return { allowed: false, reason: `You have not been given access to publish as ${acct.display_name}.`, account: acct }
}

// Which accounts this user may actually publish to. The composer should offer these and
// nothing else — but the offer is a convenience, and the check above is the authority.
export async function publishableAccounts(req, action = 'publish') {
  const { data } = await supabaseAdmin.from('social_accounts')
    .select(SAFE_COLUMNS).eq('dealership_id', req.dealershipId).eq('status', 'connected')
  const out = []
  for (const a of data || []) {
    const v = await canActOnAccount(req, a.id, action)
    if (v.allowed) out.push(a)
  }
  return out
}

// ── Attention this department can honestly produce ──────────────────────────
// Exported as a builder, not just a route, so Marketing's My Day COMPOSES these rather
// than re-deriving them from the same tables and drifting.
export async function socialAttention(dealershipId) {
  // Anything scheduled more than fifteen minutes ago that has not moved. The grace period is
  // there so a post is not called stuck while the dispatcher is mid-run.
  const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const [{ data: accounts }, { data: posts }, { data: failed }, { data: stuck }, { data: vehiclePosts }] = await Promise.all([
    supabaseAdmin.from('social_accounts').select('id, display_name, status, token_expires_at, last_error')
      .eq('dealership_id', dealershipId).neq('status', 'connected'),
    supabaseAdmin.from('social_posts').select('id, body, status, scheduled_for')
      .eq('dealership_id', dealershipId).eq('status', 'needs_approval').is('deleted_at', null).limit(100),
    supabaseAdmin.from('social_post_targets').select('id, post_id, social_account_id, error, updated_at')
      .eq('dealership_id', dealershipId).eq('status', 'failed').limit(100),
    supabaseAdmin.from('social_posts').select('id, body, status, scheduled_for')
      .eq('dealership_id', dealershipId).eq('status', 'scheduled').is('deleted_at', null)
      .lt('scheduled_for', stuckBefore).limit(100),
    supabaseAdmin.from('social_posts').select('id, body, inventory_id').eq('dealership_id', dealershipId)
      .in('status', ['needs_approval', 'scheduled']).not('inventory_id', 'is', null).is('deleted_at', null).limit(100),
  ])
  const items = []
  for (const a of accounts || []) {
    items.push({ kind: 'social_account_disconnected', severity: 3, subject: a.display_name,
      reason: a.last_error || `Account is ${a.status}`, owner: 'Marketing', action: 'Reconnect Account', ref: a.id })
  }
  for (const p of posts || []) {
    items.push({ kind: 'social_post_needs_approval', severity: 2, subject: (p.body || 'Post').slice(0, 60),
      reason: 'Scheduled content is waiting for approval', owner: 'Marketing', action: 'Review Post', ref: p.id })
  }
  for (const f of failed || []) {
    items.push({ kind: 'social_publish_failed', severity: 3, subject: 'Publication failed',
      reason: f.error || 'The provider refused the post', owner: 'Marketing', action: 'Review Post', ref: f.post_id })
  }
  // A post whose time came and went without publishing. Until PR 6.6 this was the silent
  // failure the whole department could not see: 'scheduled' forever, nobody told, and the
  // vehicle it was advertising still sitting on the lot.
  for (const s of stuck || []) {
    items.push({ kind: 'social_post_stuck', severity: 3, subject: (s.body || 'Post').slice(0, 60),
      reason: `Scheduled for ${String(s.scheduled_for).slice(0, 16).replace('T', ' ')} and still not published`,
      owner: 'Marketing', action: 'Publish or Cancel', ref: s.id })
  }
  const vehicleIds = [...new Set((vehiclePosts || []).map(p => p.inventory_id).filter(Boolean))]
  const { data: availableVehicles } = vehicleIds.length ? await supabaseAdmin.from('inventory').select('id')
    .eq('dealership_id', dealershipId).in('id', vehicleIds).eq('status', 'available') : { data: [] }
  const availableIds = new Set((availableVehicles || []).map(v => v.id))
  for (const p of vehiclePosts || []) if (!availableIds.has(p.inventory_id)) {
    items.push({ kind: 'social_scheduled_vehicle_unavailable', severity: 3, subject: (p.body || 'Vehicle post').slice(0, 60),
      reason: 'The linked vehicle is sold or unavailable; publishing will be stopped', owner: 'Marketing', action: 'Review Scheduled Post', ref: p.id })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerSocial(app) {
  const canView = requirePermission('marketing.view')
  const canEdit = requirePermission('marketing.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }
  const validateLinks = async (dealershipId, body) => {
    if (body?.campaign_id) {
      const { data } = await supabaseAdmin.from('campaigns').select('id').eq('id', body.campaign_id).eq('dealership_id', dealershipId).maybeSingle()
      if (!data) throw new Error('Campaign is not available to this dealership.')
    }
    if (body?.inventory_id) {
      const { data } = await supabaseAdmin.from('inventory').select('id, status').eq('id', body.inventory_id).eq('dealership_id', dealershipId).maybeSingle()
      if (!data || data.status !== 'available') throw new Error('Vehicle is no longer available for promotion.')
    }
  }
  const canonicalSchedule = async (req, body) => {
    if (!body?.scheduled_local) return { scheduledFor: body?.scheduled_for || null, ambiguous: false }
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('timezone').eq('id', req.dealershipId).maybeSingle()
    const timezone = dealer?.timezone || 'UTC'
    const converted = dealerLocalToUtc(body.scheduled_local, timezone)
    return { scheduledFor: converted.utc, timezone, ambiguous: converted.ambiguous }
  }

  app.get('/social/accounts', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('social_accounts')
        .select(SAFE_COLUMNS).eq('dealership_id', req.dealershipId).order('ownership').order('display_name')
      if (error) return res.status(500).json({ error: error.message })
      // Each account carries what THIS user may do with it, so a surface never has to guess.
      const rows = []
      for (const a of data || []) {
        const [pub, sch] = await Promise.all([
          canActOnAccount(req, a.id, 'publish'),
          canActOnAccount(req, a.id, 'schedule'),
        ])
        rows.push({ ...a, can_publish: pub.allowed, can_schedule: sch.allowed, why: pub.allowed ? null : pub.reason })
      }
      res.json({ accounts: rows })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Connect an account. A user-owned connection is the caller's own by definition; claiming
  // one on someone else's behalf needs the department permission.
  app.post('/social/accounts', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const provider = String(b.provider || '').toLowerCase()
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: `provider must be one of ${PROVIDERS.join(', ')}` })
    const ownership = b.ownership === 'user' ? 'user' : 'dealership'
    const externalId = String(b.external_account_id || '').trim()
    const displayName = String(b.display_name || '').trim()
    if (!externalId || !displayName) return res.status(400).json({ error: 'external_account_id and display_name are required' })

    let ownerUserId = null
    if (ownership === 'user') {
      ownerUserId = b.owner_user_id || req.user?.id || null
      if (!ownerUserId) return res.status(400).json({ error: 'A user-owned account needs an owner.' })
      if (ownerUserId !== req.user?.id && !(await hasPermission(req, 'marketing.publish').catch(() => false))) {
        return res.status(403).json({ error: 'You cannot connect an account on behalf of another user.' })
      }
      // An owner from another dealership would be an account nobody here can be
      // accountable for.
      const { data: owner } = await supabaseAdmin.from('profiles')
        .select('id, dealership_id').eq('id', ownerUserId).maybeSingle()
      if (!owner || owner.dealership_id !== req.dealershipId) {
        return res.status(400).json({ error: 'That owner is not part of this dealership.' })
      }
    } else if (!(await hasPermission(req, 'marketing.publish').catch(() => false))) {
      return res.status(403).json({ error: 'Connecting a dealership account requires publishing access.' })
    }

    try {
      const row = {
        dealership_id: req.dealershipId, provider, external_account_id: externalId,
        display_name: displayName, handle: b.handle || null, avatar_url: b.avatar_url || null,
        ownership, owner_user_id: ownerUserId,
        capabilities: b.capabilities && typeof b.capabilities === 'object' ? b.capabilities : {},
        connected_by: req.user?.id || null, status: 'connected',
        token_expires_at: b.token_expires_at || null,
      }
      // Credentials are encrypted with the same helper dealer_integrations uses, and are
      // never read back out through this API.
      if (b.credentials && typeof b.credentials === 'object') {
        row.credentials_enc = encryptJson(b.credentials)
        row.credentials_encryption_version = PII_ENCRYPTION_VERSION
      }
      const { data, error } = await supabaseAdmin.from('social_accounts')
        .upsert(row, { onConflict: 'dealership_id,provider,external_account_id' })
        .select(SAFE_COLUMNS).single()
      if (error) return res.status(500).json({ error: error.message })
      audit(req, 'social.account_connected', { after_state: { id: data.id, provider, ownership, display_name: displayName } })
      res.json({ ok: true, account: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Grant one account to one user. Granting is itself an authorized act: you may only give
  // away access you hold.
  app.post('/social/accounts/:id/grants', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const userId = String(req.body?.user_id || '')
    if (!userId) return res.status(400).json({ error: 'user_id is required' })
    const mine = await canActOnAccount(req, req.params.id, 'publish')
    if (!mine.allowed) return res.status(403).json({ error: `You cannot grant access you do not have. ${mine.reason}` })
    try {
      const { data: target } = await supabaseAdmin.from('profiles')
        .select('id, dealership_id').eq('id', userId).maybeSingle()
      if (!target || target.dealership_id !== req.dealershipId) {
        return res.status(400).json({ error: 'That user is not part of this dealership.' })
      }
      const { data, error } = await supabaseAdmin.from('social_account_grants').upsert({
        dealership_id: req.dealershipId, social_account_id: req.params.id, user_id: userId,
        can_publish: !!req.body?.can_publish, can_schedule: !!req.body?.can_schedule,
        can_approve: !!req.body?.can_approve, granted_by: req.user?.id || null,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'social_account_id,user_id' }).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      audit(req, 'social.grant_changed', { after_state: data })
      res.json({ ok: true, grant: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.delete('/social/accounts/:id/grants/:userId', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const mine = await canActOnAccount(req, req.params.id, 'publish')
    if (!mine.allowed) return res.status(403).json({ error: `You cannot change access you do not have. ${mine.reason}` })
    const { error } = await supabaseAdmin.from('social_account_grants').delete()
      .eq('dealership_id', req.dealershipId).eq('social_account_id', req.params.id).eq('user_id', req.params.userId)
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'social.grant_revoked', { before_state: { account: req.params.id, user: req.params.userId } })
    res.json({ ok: true })
  })

  // What this user may publish to — the list a composer should offer.
  app.get('/social/publishable', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ accounts: await publishableAccounts(req, 'publish') }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Compose a post and choose its targets. EVERY target is authorized here, individually —
  // a post to five accounts is five separate decisions, and one refusal fails the request
  // rather than quietly dropping that channel.
  app.post('/social/posts', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const targets = Array.isArray(b.targets) ? b.targets : []
    if (!targets.length) return res.status(400).json({ error: 'A post needs at least one account to publish to.' })
    try { await validateLinks(req.dealershipId, b) } catch (e) { return res.status(400).json({ error: e.message }) }

    let schedule
    try { schedule = await canonicalSchedule(req, b) } catch (e) { return res.status(400).json({ error: e.message }) }
    const refusals = []
    for (const t of targets) {
      const v = await canActOnAccount(req, t.social_account_id, schedule.scheduledFor ? 'schedule' : 'publish')
      if (!v.allowed) refusals.push({ social_account_id: t.social_account_id, reason: v.reason })
    }
    if (refusals.length) return res.status(403).json({ error: 'Some accounts refused.', refusals })

    try {
      const requiresApproval = !!b.requires_approval
      const { data: post, error } = await supabaseAdmin.from('social_posts').insert({
        dealership_id: req.dealershipId, campaign_id: b.campaign_id || null,
        inventory_id: b.inventory_id || null, body: b.body || null,
        media: Array.isArray(b.media) ? b.media : [],
        scheduled_for: schedule.scheduledFor,
        requires_approval: requiresApproval,
        status: requiresApproval ? 'needs_approval' : (schedule.scheduledFor ? 'scheduled' : 'draft'),
        created_by: req.user?.id || null,
      }).select('*').single()
      if (error) return res.status(500).json({ error: error.message })

      const rows = targets.map(t => ({
        dealership_id: req.dealershipId, post_id: post.id,
        social_account_id: t.social_account_id, body_override: t.body_override || null,
      }))
      const { error: tErr } = await supabaseAdmin.from('social_post_targets').insert(rows)
      if (tErr) {
        // A post with no targets would sit in the calendar looking scheduled and publish
        // nowhere. Roll it back rather than leave that.
        await supabaseAdmin.from('social_posts').delete().eq('id', post.id)
        return res.status(500).json({ error: tErr.message })
      }
      audit(req, 'social.post_created', { after_state: { id: post.id, targets: rows.length, status: post.status } })
      res.json({ ok: true, post, targets: rows.length, timezone: schedule.timezone || null, ambiguous_local_time: schedule.ambiguous })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/social/posts', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      let q = supabaseAdmin.from('social_posts').select('*')
        .eq('dealership_id', req.dealershipId).is('deleted_at', null)
      if (req.query.status) q = q.eq('status', String(req.query.status))
      const { data: posts } = await q.order('scheduled_for', { ascending: true, nullsFirst: false }).limit(500)
      const ids = (posts || []).map(p => p.id)
      let targets = []
      if (ids.length) {
        const { data, error } = await supabaseAdmin.from('social_post_targets')
          .select('id, post_id, social_account_id, status, external_post_id, published_at, error, attempts, last_attempt_at, next_attempt_at')
          .in('post_id', ids)
        if (error) return res.status(500).json({ error: error.message })
        targets = data || []
      }
      const byPost = {}
      for (const t of targets) (byPost[t.post_id] ||= []).push(t)
      const accountIds = [...new Set(targets.map(t => t.social_account_id).filter(Boolean))]
      const { data: accounts } = accountIds.length ? await supabaseAdmin.from('social_accounts')
        .select('id, provider, display_name, ownership').in('id', accountIds).eq('dealership_id', req.dealershipId) : { data: [] }
      const accountById = Object.fromEntries((accounts || []).map(a => [a.id, a]))
      const { data: dealer } = await supabaseAdmin.from('dealerships').select('timezone').eq('id', req.dealershipId).maybeSingle()
      res.json({ timezone: dealer?.timezone || 'UTC', posts: (posts || []).map(p => ({ ...p, targets: (byPost[p.id] || []).map(t => ({ ...t, account: accountById[t.social_account_id] || null })) })) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Scheduled content may change only before a worker claims any target. This updates the
  // canonical timestamp; calendar drag/drop and the editor both call this same route.
  app.put('/social/posts/:id', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const { data: post } = await supabaseAdmin.from('social_posts').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
    if (!post) return res.status(404).json({ error: 'Post not found' })
    if (!['draft', 'needs_approval', 'scheduled', 'failed'].includes(post.status)) return res.status(409).json({ error: 'Publishing has started; this post can no longer be edited.' })
    const { data: ownedTargets } = await supabaseAdmin.from('social_post_targets').select('social_account_id').eq('post_id', post.id)
    for (const target of ownedTargets || []) {
      const allowed = await canActOnAccount(req, target.social_account_id, 'schedule')
      if (!allowed.allowed) return res.status(403).json({ error: allowed.reason })
    }
    const { data: active } = await supabaseAdmin.from('social_post_targets').select('id').eq('post_id', post.id).in('status', ['publishing', 'published']).limit(1)
    if (active?.length) return res.status(409).json({ error: 'Publishing has started; claimed targets cannot be changed.' })
    const patch = { updated_at: new Date().toISOString() }
    try { await validateLinks(req.dealershipId, req.body || {}) } catch (e) { return res.status(400).json({ error: e.message }) }
    if (req.body?.body !== undefined) patch.body = req.body.body || null
    if (req.body?.media !== undefined) patch.media = Array.isArray(req.body.media) ? req.body.media : []
    if (req.body?.campaign_id !== undefined) patch.campaign_id = req.body.campaign_id || null
    if (req.body?.inventory_id !== undefined) patch.inventory_id = req.body.inventory_id || null
    if (req.body?.scheduled_for !== undefined) {
      patch.scheduled_for = req.body.scheduled_for || null
      patch.status = post.requires_approval && !post.approved_at ? 'needs_approval' : (patch.scheduled_for ? 'scheduled' : 'draft')
    }
    if (req.body?.scheduled_local !== undefined) {
      try {
        const schedule = await canonicalSchedule(req, req.body)
        patch.scheduled_for = schedule.scheduledFor
        patch.status = post.requires_approval && !post.approved_at ? 'needs_approval' : (patch.scheduled_for ? 'scheduled' : 'draft')
      } catch (e) { return res.status(400).json({ error: e.message }) }
    }
    const { data, error } = await supabaseAdmin.from('social_posts').update(patch)
      .eq('id', post.id).eq('dealership_id', req.dealershipId).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'social.post_rescheduled', { before_state: { scheduled_for: post.scheduled_for, status: post.status }, after_state: { scheduled_for: data.scheduled_for, status: data.status } })
    res.json({ ok: true, post: data })
  })

  app.post('/social/posts/:id/cancel', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const { data: post } = await supabaseAdmin.from('social_posts').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!post) return res.status(404).json({ error: 'Post not found' })
    const { data: ownedTargets } = await supabaseAdmin.from('social_post_targets').select('social_account_id').eq('post_id', post.id)
    for (const target of ownedTargets || []) {
      const allowed = await canActOnAccount(req, target.social_account_id, 'schedule')
      if (!allowed.allowed) return res.status(403).json({ error: allowed.reason })
    }
    const { data: active } = await supabaseAdmin.from('social_post_targets').select('id').eq('post_id', post.id).in('status', ['publishing', 'published']).limit(1)
    if (active?.length) return res.status(409).json({ error: 'Publishing has started; this post cannot be cancelled.' })
    const { data, error } = await supabaseAdmin.from('social_posts').update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', post.id).eq('dealership_id', req.dealershipId).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, 'social.post_cancelled', { before_state: { status: post.status }, after_state: { status: data.status } })
    res.json({ ok: true, post: data })
  })

  // Approval is per post, and the approver must be able to approve for every account it
  // targets — approving content for a page you cannot post to is not an approval.
  app.post('/social/posts/:id/approve', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: post } = await supabaseAdmin.from('social_posts').select('*')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!post) return res.status(404).json({ error: 'Post not found' })
      if (post.status !== 'needs_approval') return res.status(409).json({ error: `A ${post.status} post is not awaiting approval.` })

      const { data: tg } = await supabaseAdmin.from('social_post_targets')
        .select('social_account_id').eq('post_id', post.id)
      for (const t of tg || []) {
        const v = await canActOnAccount(req, t.social_account_id, 'approve')
        if (!v.allowed) return res.status(403).json({ error: v.reason })
      }
      const { data, error } = await supabaseAdmin.from('social_posts').update({
        status: post.scheduled_for ? 'scheduled' : 'draft',
        approved_by: req.user?.id || null, approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', post.id).eq('status', 'needs_approval').select('*').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(409).json({ error: 'The post changed while you were reviewing it.' })
      audit(req, 'social.post_approved', { before_state: post, after_state: data })
      res.json({ ok: true, post: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Marketing attention items this slice can honestly produce, for My Day to compose later.
  app.get('/social/attention', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ items: await socialAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })
}
