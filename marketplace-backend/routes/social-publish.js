/**
 * The social publishing dispatcher (Phase 6 PR 6.6).
 *
 * PR 6.2 decided WHO may publish. This decides WHETHER a post actually went out, and it is
 * the first thing in the system that writes the publishing states the schema has allowed
 * since 6.2 but nothing has ever used.
 *
 * Before this file, a scheduled post sat at 'scheduled' forever. Not failed — nothing marked
 * it failed. Not published — nothing published it. The dealership was never told, and the
 * inventory it was advertising sat on the lot. Silence was the bug.
 *
 * Three rules run through everything here:
 *
 *   1. The claim is the database's job. `social_claim_due_targets` uses `for update skip
 *      locked`, so two workers take disjoint work. Read-then-write in application code has a
 *      window in the middle, and that window is where customers see the same post twice.
 *
 *   2. 'published' requires evidence. A target is published only when a provider returned an
 *      id for something it created. No adapter, no credentials, a throw, or a success with no
 *      id are all failures with a reason a person can read.
 *
 *   3. A post's status is derived from its targets, in one place — `rollUpPostStatus`. A post
 *      to five accounts that reached three of them is 'partially_published', which the schema
 *      has always allowed and nothing has ever written. Calling that "published" would hide
 *      the two pages the dealership meant to reach and never did.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { canActOnAccount } from './social.js'
import { requestHasCronSecret } from '../cron-auth.js'
import { publishToProvider, PROVIDER_NOT_CONFIGURED } from '../providers/social-providers.js'

// After this many tries a retryable failure stops being retried and starts being a message.
// A queue that retries forever is a queue nobody reads.
export const MAX_PUBLISH_ATTEMPTS = 5
export function vehiclePromotionAllowed(vehicle) { return !!vehicle && vehicle.status === 'available' }

// Escalating, capped. The point is to survive a provider's bad ten minutes without hammering
// it, not to implement a general-purpose scheduler.
const BACKOFF_SECONDS = [60, 300, 900, 3600, 14400]
export function nextBackoffSeconds(attempts) {
  const i = Math.max(0, Math.min(BACKOFF_SECONDS.length - 1, (Number(attempts) || 1) - 1))
  return BACKOFF_SECONDS[i]
}

/**
 * What to write on a target given what the provider did. Pure, so the tests exercise the real
 * decision rather than a description of it.
 *
 * A failure goes back to 'pending' with a retry time while retries remain, and to 'failed'
 * once they do not — 'failed' is a statement to the dealership that this will not fix itself.
 */
export function applyTargetOutcome(target, result, now = new Date()) {
  const attempts = Number(target?.attempts) || 0

  if (result?.ok && result.external_post_id) {
    return {
      status: 'published',
      external_post_id: String(result.external_post_id),
      published_at: now.toISOString(),
      error: null,
      claimed_at: null,
      next_attempt_at: null,
      updated_at: now.toISOString(),
    }
  }

  // A success with no id is not a success. Recording it as one would tell the dealership
  // their post is live when we have nothing showing that it is.
  const error = result?.ok
    ? 'The provider reported success but returned no post id, so we cannot confirm it went live.'
    : (result?.error || 'The publish attempt failed.')

  const permanent = result?.retryable === false || attempts >= MAX_PUBLISH_ATTEMPTS
  return {
    status: permanent ? 'failed' : 'pending',
    error,
    claimed_at: null,
    next_attempt_at: permanent ? null : new Date(now.getTime() + nextBackoffSeconds(attempts) * 1000).toISOString(),
    updated_at: now.toISOString(),
  }
}

/**
 * A post's status, derived from its targets. The ONE place this is decided.
 *
 * 'skipped' is a deliberate non-send (an account that lost its grant between scheduling and
 * publishing), so it does not make a post partial — but it cannot make one published on its
 * own either, which is why an all-skipped post is not 'published'.
 */
export function rollUpPostStatus(targets) {
  const rows = Array.isArray(targets) ? targets : []
  if (!rows.length) return 'failed'

  const n = (s) => rows.filter(t => t.status === s).length
  const published = n('published'), failed = n('failed'), skipped = n('skipped')

  // Anything still pending or publishing means the post is mid-flight.
  if (published + failed + skipped < rows.length) return 'publishing'
  if (published === 0) return 'failed'
  if (failed === 0) return 'published'
  return 'partially_published'
}

async function writeTargetOutcome(target, patch) {
  const { error } = await supabaseAdmin.from('social_post_targets').update(patch).eq('id', target.id)
  // A write that fails here would leave the target claimed and invisible. Say so rather than
  // let the next run silently reclaim it after the lease expires.
  if (error) console.error('[social-publish] could not record outcome for target', target.id, error.message)
  return !error
}

/**
 * Re-derive and persist a post's status from its targets. Called after every attempt, so the
 * post and its targets can never disagree about what happened.
 */
export async function refreshPostStatus(postId) {
  const { data: targets, error } = await supabaseAdmin.from('social_post_targets')
    .select('id, status').eq('post_id', postId)
  if (error) return null
  const status = rollUpPostStatus(targets || [])
  const { error: uErr } = await supabaseAdmin.from('social_posts')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', postId)
  if (uErr) console.error('[social-publish] could not update post status', postId, uErr.message)
  return status
}

/**
 * Publish one already-claimed target. Assumes the claim happened — this never decides on its
 * own that work is available, because that decision belongs to the database.
 */
export async function publishClaimedTarget(target) {
  const { data: account } = await supabaseAdmin.from('social_accounts')
    .select('id, dealership_id, provider, display_name, status, capabilities')
    .eq('id', target.social_account_id).maybeSingle()

  let result
  if (!account || account.dealership_id !== target.dealership_id) {
    // Not retryable: an account that is gone will not come back on its own.
    result = { ok: false, retryable: false, error: 'The account this post was aimed at no longer exists.' }
  } else {
    const { data: post } = await supabaseAdmin.from('social_posts')
      .select('id, body, media, inventory_id').eq('id', target.post_id).eq('dealership_id', target.dealership_id).maybeSingle()
    let vehicleAvailable = true
    if (post?.inventory_id) {
      const { data: vehicle } = await supabaseAdmin.from('inventory').select('id, status')
        .eq('id', post.inventory_id).eq('dealership_id', target.dealership_id).maybeSingle()
      vehicleAvailable = vehiclePromotionAllowed(vehicle)
    }
    result = vehicleAvailable ? await publishToProvider({
      account,
      body: target.body_override || post?.body || '',
      media: Array.isArray(post?.media) ? post.media : [],
    }) : { ok: false, retryable: false, code: 'vehicle_unavailable', error: 'The linked vehicle is no longer available. Nothing was published.' }
  }

  const patch = applyTargetOutcome(target, result)
  await writeTargetOutcome(target, patch)
  await refreshPostStatus(target.post_id)
  return { target_id: target.id, status: patch.status, error: patch.error || null, code: result.code || null }
}

/**
 * One pass of the queue. Claims what is due and attempts each one.
 *
 * Returns counts rather than throwing on individual failures: one provider having a bad day
 * must not stop the other four from going out.
 */
export async function runDuePublishes({ limit = 25, leaseSeconds = 300 } = {}) {
  const { data: claimed, error } = await supabaseAdmin
    .rpc('social_claim_due_targets', { p_limit: limit, p_lease_seconds: leaseSeconds })
  if (error) throw new Error(`Could not claim due posts: ${error.message}`)

  const outcomes = []
  for (const t of claimed || []) {
    try {
      outcomes.push(await publishClaimedTarget(t))
    } catch (e) {
      // The dispatcher itself failing is not the target's fault; release the claim so the
      // next run picks it up rather than leaving it stranded until the lease expires.
      await writeTargetOutcome(t, applyTargetOutcome(t, { ok: false, retryable: true, error: `Dispatcher error: ${e.message}` }))
      await refreshPostStatus(t.post_id)
      outcomes.push({ target_id: t.id, status: 'pending', error: e.message })
    }
  }
  return {
    claimed: (claimed || []).length,
    published: outcomes.filter(o => o.status === 'published').length,
    failed: outcomes.filter(o => o.status === 'failed').length,
    retrying: outcomes.filter(o => o.status === 'pending').length,
    unconfigured: outcomes.filter(o => o.code === PROVIDER_NOT_CONFIGURED).length,
    outcomes,
  }
}

export function registerSocialPublish(app) {
  const canEdit = requirePermission('marketing.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  /**
   * Publish now. Authorization is re-checked at publish time, not trusted from compose time:
   * a grant can be withdrawn between scheduling a post and it going out, and the moment that
   * matters is the moment it would reach customers.
   *
   * A target the caller may no longer publish to is 'skipped', not 'failed' — nothing broke,
   * the permission changed, and the difference matters to whoever reads the queue.
   */
  app.post('/social/posts/:id/publish', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: post } = await supabaseAdmin.from('social_posts')
        .select('id, status, requires_approval, approved_at')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!post) return res.status(404).json({ error: 'Post not found' })
      if (post.status === 'needs_approval') {
        return res.status(409).json({ error: 'This post is still awaiting approval.' })
      }
      if (post.status === 'published') {
        return res.status(409).json({ error: 'This post has already been published.' })
      }

      const { data: targets } = await supabaseAdmin.from('social_post_targets')
        .select('*').eq('post_id', post.id).eq('dealership_id', req.dealershipId)

      const now = new Date().toISOString()
      const results = []
      for (const t of targets || []) {
        if (t.status === 'published') { results.push({ target_id: t.id, status: 'published', already: true }); continue }
        const v = await canActOnAccount(req, t.social_account_id, 'publish')
        if (!v.allowed) {
          await supabaseAdmin.from('social_post_targets')
            .update({ status: 'skipped', error: v.reason, claimed_at: null, updated_at: now }).eq('id', t.id)
          results.push({ target_id: t.id, status: 'skipped', error: v.reason })
          continue
        }
        // Claim this one row the same way the worker would, so a manual publish racing the
        // scheduler cannot double-post.
        const { data: claimed } = await supabaseAdmin.from('social_post_targets')
          .update({ status: 'publishing', claimed_at: now, last_attempt_at: now, attempts: (t.attempts || 0) + 1, updated_at: now })
          .eq('id', t.id).in('status', ['pending', 'failed']).is('external_post_id', null)
          .select('*').maybeSingle()
        if (!claimed) { results.push({ target_id: t.id, status: t.status, skipped_claim: true }); continue }
        results.push(await publishClaimedTarget(claimed))
      }

      const status = await refreshPostStatus(post.id)
      audit(req, 'social.post_published', { after_state: { id: post.id, status, results } })
      res.json({ ok: true, status, results })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * The scheduler's entry point, on the existing /cron/* convention and behind the same
   * shared secret check the other cron routes use — this one publishes to the outside world
   * on the dealership's behalf, so it gets no weaker a guard than an ad-spend pull.
   *
   *   curl -X POST https://<backend>/cron/social-publish -H "x-cron-secret: $CRON_SECRET"
   */
  app.post('/cron/social-publish', async (req, res) => {
    if (!requestHasCronSecret(req)) return res.status(403).json({ error: 'Forbidden' })
    try {
      res.json(await runDuePublishes({ limit: Number(req.query.limit) || 25 }))
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
