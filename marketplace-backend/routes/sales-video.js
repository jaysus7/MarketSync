/**
 * Sales video messaging (Phase 6 PR 6.7).
 *
 * Owned by SALES. A rep recording a walkaround for one customer about one vehicle is a sales
 * conversation, so it is gated by `customer.edit` and goes through the same consent gate every
 * other sender calls. It reuses Phase 6 plumbing; it does not become a marketing campaign.
 *
 * The rule this file exists to enforce:
 *
 *   Fetching a link is not watching a video.
 *
 * Outlook Safe Links, Gmail's proxy, SMS previewers and security scanners fetch a URL the
 * moment it is delivered. If those counted as views, a rep would see "watched twice" about a
 * customer who never opened it — and reps act on that, calling people who did nothing. So the
 * public page load records `link_opened`, and only `play_started`, which needs JavaScript and
 * a user gesture, begins a watch. The database recomputes the summary from the events, so what
 * a rep sees and the evidence behind it cannot drift apart.
 */
import { supabaseAdmin, sendEmail, emailHealth, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { mayContact } from './consent.js'
import { sendDealerSms } from './automation.js'
import { rateLimit } from '../security.js'
import multer from 'multer'
import crypto from 'crypto'

// Videos are large by nature; 200MB matches the bucket's own limit.
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } })

const VIDEO_COLUMNS = [
  'id', 'dealership_id', 'contact_id', 'inventory_id', 'created_by', 'title',
  'storage_path', 'public_url', 'poster_url', 'duration_seconds', 'bytes', 'share_token', 'expires_at', 'revoked_at',
  'status', 'channel', 'sent_at', 'consent_basis', 'first_opened_at', 'first_played_at',
  'watched_seconds', 'watch_percent', 'play_count', 'created_at',
].join(', ')

// Long enough that guessing is not a strategy, short enough to survive an SMS.
const newShareToken = () => crypto.randomBytes(18).toString('base64url')

// A share link that lives forever is a data-exposure liability nobody remembers to close.
const DEFAULT_EXPIRY_DAYS = 60

// The public watch link a customer actually taps. Must match the frontend's own
// vidBuildShareUrl (`<origin>/watch.html?t=<token>`) so a link sent by email/SMS and
// a link copied in the studio point at the same page. FRONTEND_URL is the static-site
// host (the backend serves no HTML), the same base every other transactional link uses.
function watchUrl(shareToken) {
  return `${FRONTEND_URL}/watch.html?t=${encodeURIComponent(shareToken)}`
}

// Extract canonical storage path from video record or legacy public URL.
export function extractStoragePath(video) {
  if (video?.storage_path) return video.storage_path
  if (!video?.public_url) return null
  const match = video.public_url.match(/\/sales-videos\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

// Generate short-lived signed playback URL from private storage.
export async function getSignedPlaybackUrl(storagePath, expiresInSeconds = 900) {
  if (!storagePath) return null
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('sales-videos')
      .createSignedUrl(storagePath, expiresInSeconds)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

// Minimal, deliverable email body. Plain and link-forward on purpose: a walkaround
// video won't inline in most inboxes, so the message is the personal note plus the
// one tap that opens it.
function videoEmailHtml({ url, repName, dealerName, note }) {
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const who = repName ? `${esc(repName)}${dealerName ? ` at ${esc(dealerName)}` : ''}` : (dealerName ? esc(dealerName) : 'your salesperson')
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <p style="font-size:16px;line-height:1.5">${note ? esc(note) : `${who} recorded a short video for you.`}</p>
  <p style="margin:24px 0"><a href="${esc(url)}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">▶ Watch your video</a></p>
  <p style="font-size:13px;color:#64748b;line-height:1.5">Or paste this link into your browser:<br><a href="${esc(url)}" style="color:#4f46e5">${esc(url)}</a></p>
</div>`
}

/**
 * Is this link still usable? Expiry is enforced on read, not by a sweeper, so a link stops
 * working the moment it should rather than whenever a job next happens to run.
 */
export function shareLinkState(video, now = new Date()) {
  if (!video || video.deleted_at || video.revoked_at) return { ok: false, reason: 'This video link is no longer available.' }
  if (video.expires_at && new Date(video.expires_at) < now) {
    return { ok: false, reason: 'This video link has expired. Ask your salesperson to send a new one.' }
  }
  return { ok: true }
}

/**
 * What a rep should be told about a video they sent. Pure, so the wording and the thresholds
 * are testable without a database.
 *
 * The distinction that matters: 'sent' and 'opened' are NOT 'watched'. A rep deciding whether
 * to follow up needs to know which of those three actually happened.
 */
export function watchSummary(v) {
  if (!v) return { label: 'Unknown', detail: '', engaged: false }
  if (v.status === 'draft' || v.status === 'ready') return { label: 'Not sent', detail: 'Recorded but never sent.', engaged: false }
  if (v.first_played_at) {
    const pct = v.watch_percent
    const detail = pct == null
      ? `Watched ${v.watched_seconds}s`
      : `Watched ${pct}% (${v.watched_seconds}s)${v.play_count > 1 ? ` · played ${v.play_count} times` : ''}`
    return { label: pct != null && pct >= 80 ? 'Watched it all' : 'Watched', detail, engaged: true }
  }
  if (v.first_opened_at) {
    // Deliberately hedged. A link fetch is very often a mail scanner, and telling a rep the
    // customer "opened" it as though that were a human act is the lie this slice avoids.
    return { label: 'Link fetched', detail: 'The link was fetched, but nobody pressed play. This is often an email scanner, not the customer.', engaged: false }
  }
  return { label: 'Sent', detail: 'Delivered, not opened yet.', engaged: false }
}

/**
 * Sales attention: what a rep should do about their videos today. Emitted in the same shape
 * as every other Phase 6 attention source so My Day can compose it without special-casing.
 */
export async function salesVideoAttention(dealershipId) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: watched }, { data: cold }] = await Promise.all([
    // Someone watched most of a walkaround and nobody has called them. This is the most
    // actionable signal the whole feature produces.
    supabaseAdmin.from('sales_videos')
      .select('id, title, contact_id, watch_percent, first_played_at')
      .eq('dealership_id', dealershipId).is('deleted_at', null)
      .eq('status', 'watched').gte('watch_percent', 50).limit(50),
    supabaseAdmin.from('sales_videos')
      .select('id, title, contact_id, sent_at')
      .eq('dealership_id', dealershipId).is('deleted_at', null)
      .eq('status', 'sent').lt('sent_at', dayAgo).limit(50),
  ])

  const items = []
  for (const v of watched || []) {
    items.push({
      kind: 'sales_video_watched', severity: 1,
      subject: v.title || 'Your walkaround video',
      reason: `A customer watched ${v.watch_percent}% of it — they are interested right now`,
      owner: 'Sales', action: 'Call them', ref: v.id,
    })
  }
  for (const v of cold || []) {
    items.push({
      kind: 'sales_video_unopened', severity: 2,
      subject: v.title || 'Your walkaround video',
      reason: 'Sent over a day ago and still not played — try another channel',
      owner: 'Sales', action: 'Follow up', ref: v.id,
    })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerSalesVideo(app) {
  const canView = requirePermission('customer.view')
  const canEdit = requirePermission('customer.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  app.get('/sales-videos', requireAuth, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      let q = supabaseAdmin.from('sales_videos').select(VIDEO_COLUMNS)
        .eq('dealership_id', req.dealershipId).is('deleted_at', null)
      if (req.query.contact_id) q = q.eq('contact_id', req.query.contact_id)
      if (req.query.mine === '1' && req.user?.id) q = q.eq('created_by', req.user.id)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) return res.status(500).json({ error: error.message })
      const videos = (data || []).map(v => ({
        ...v,
        watch_url: watchUrl(v.share_token),
        summary: watchSummary(v),
      }))
      res.json({ videos })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Authenticated playback URL generation for dealership users. Enforces tenant boundary.
  app.get('/sales-videos/:id/playback', requireAuth, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: video, error } = await supabaseAdmin.from('sales_videos')
        .select('id, dealership_id, storage_path, public_url, deleted_at, title')
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) return res.status(500).json({ error: error.message })
      if (!video) return res.status(404).json({ error: 'Video not found' })

      const path = extractStoragePath(video)
      if (!path) return res.status(404).json({ error: 'Video storage path not found' })

      const signedUrl = await getSignedPlaybackUrl(path, 3600)
      if (!signedUrl) return res.status(500).json({ error: 'Could not generate signed playback URL' })

      res.set('Cache-Control', 'private, no-store')
      res.json({ ok: true, video_id: video.id, title: video.title, playback_url: signedUrl })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/sales-videos/attention', requireAuth, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ items: await salesVideoAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Upload to private sales-videos bucket with tenant-scoped path.
  app.post('/sales-videos', requireAuth, canEdit, videoUpload.single('file'), async (req, res) => {
    if (!guard(req, res)) return
    if (!req.file) return res.status(400).json({ error: 'No video was uploaded.' })
    const mime = (req.file.mimetype || '').toLowerCase()
    if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'].includes(mime) && !/^video\//.test(mime)) {
      return res.status(400).json({ error: 'That file is not a video.' })
    }

    const ext = (req.file.originalname?.split('.').pop() || mime.split('/')[1] || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'mp4'
    const path = `${req.dealershipId}/${req.user?.id || 'unknown'}/${Date.now()}-${crypto.randomBytes(9).toString('base64url')}.${ext}`
    const { error: upErr } = await supabaseAdmin.storage.from('sales-videos')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false })
    if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message })

    const expires = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin.from('sales_videos').insert({
      dealership_id: req.dealershipId,
      contact_id: req.body?.contact_id || null,
      inventory_id: req.body?.inventory_id || null,
      created_by: req.user?.id || null,
      title: req.body?.title || null,
      storage_path: path,
      public_url: '',
      duration_seconds: req.body?.duration_seconds ? Math.round(Number(req.body.duration_seconds)) : null,
      bytes: req.file.size,
      share_token: newShareToken(),
      expires_at: expires,
      status: 'ready',
    }).select(VIDEO_COLUMNS).single()

    if (error) {
      // Bytes already in the bucket with no row is invisible storage cost forever.
      await supabaseAdmin.storage.from('sales-videos').remove([path])
      return res.status(500).json({ error: error.message })
    }
    const signedUrl = await getSignedPlaybackUrl(path, 3600)
    audit(req, 'sales_video.recorded', { after_state: { id: data.id, bytes: data.bytes } })
    res.json({ ok: true, video: { ...data, playback_url: signedUrl, summary: watchSummary(data) } })
  })

  // Revoke an active share link immediately
  app.post('/sales-videos/:id/revoke', requireAuth, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabaseAdmin.from('sales_videos')
        .update({ revoked_at: now, updated_at: now })
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .select(VIDEO_COLUMNS)
        .maybeSingle()

      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Video not found' })

      audit(req, 'sales_video.revoked', { after_state: { id: data.id } })
      res.json({ ok: true, message: 'Share link revoked', video: { ...data, summary: watchSummary(data) } })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Regenerate customer share token with a new unguessable token
  app.post('/sales-videos/:id/share-token', requireAuth, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const token = newShareToken()
      const expires = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()
      const { data, error } = await supabaseAdmin.from('sales_videos')
        .update({ share_token: token, expires_at: expires, revoked_at: null, updated_at: now })
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .select(VIDEO_COLUMNS)
        .maybeSingle()

      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Video not found' })

      audit(req, 'sales_video.token_regenerated', { after_state: { id: data.id } })
      res.json({ ok: true, share_token: token, watch_url: watchUrl(token), video: { ...data, summary: watchSummary(data) } })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Soft-delete video and remove storage object
  app.delete('/sales-videos/:id', requireAuth, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data: video } = await supabaseAdmin.from('sales_videos')
        .select('id, dealership_id, storage_path, public_url')
        .eq('id', req.params.id)
        .eq('dealership_id', req.dealershipId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!video) return res.status(404).json({ error: 'Video not found' })

      const now = new Date().toISOString()
      await supabaseAdmin.from('sales_videos')
        .update({ deleted_at: now, revoked_at: now, updated_at: now })
        .eq('id', video.id)

      const path = extractStoragePath(video)
      if (path) {
        await supabaseAdmin.storage.from('sales-videos').remove([path]).catch(() => {})
      }

      audit(req, 'sales_video.deleted', { before_state: { id: video.id } })
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Send it. This is a contact, so it goes through the ONE consent gate — a customer who
   * opted out of SMS does not receive a video by SMS because it came from Sales rather than
   * Marketing. The basis is stored as evidence of what was true at the moment we sent.
   */
  app.post('/sales-videos/:id/send', requireAuth, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const channel = String(req.body?.channel || '').toLowerCase()
    if (!['sms', 'email'].includes(channel)) {
      return res.status(400).json({ error: 'Choose sms or email.' })
    }
    try {
      const { data: video } = await supabaseAdmin.from('sales_videos').select('*')
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
      if (!video) return res.status(404).json({ error: 'Video not found' })
      if (!video.contact_id) return res.status(400).json({ error: 'Attach this video to a customer before sending it.' })

      const consent = await mayContact(req.dealershipId, video.contact_id, channel)
      if (!consent.allowed) return res.status(403).json({ error: consent.reason, basis: consent.basis })

      // Who it's going to.
      const [{ data: contact }, { data: dealer }, { data: rep }] = await Promise.all([
        supabaseAdmin.from('contacts').select('full_name, first_name, email, phone, phone_mobile').eq('id', video.contact_id).maybeSingle(),
        supabaseAdmin.from('dealerships').select('name').eq('id', req.dealershipId).maybeSingle(),
        video.created_by ? supabaseAdmin.from('profiles').select('full_name').eq('id', video.created_by).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (!contact) return res.status(404).json({ error: 'Customer not found for this video.' })

      const url = watchUrl(video.share_token)
      const note = String(req.body?.message || '').trim().slice(0, 800)
      const repName = (rep?.full_name || '').split(' ')[0] || ''
      const dealerName = dealer?.name || ''

      let delivery, to, unconfigured = false
      if (channel === 'email') {
        to = (contact.email || '').trim()
        if (!to) return res.status(400).json({ error: 'This customer has no email address on file.' })
        if (!emailHealth().configured) { unconfigured = true }
        else {
          const subject = repName
            ? `${repName} sent you a video${dealerName ? ` — ${dealerName}` : ''}`
            : `A video for you${dealerName ? ` from ${dealerName}` : ''}`
          delivery = await sendEmail({ to, subject, html: videoEmailHtml({ url, repName, dealerName, note }) })
        }
      } else {
        to = (contact.phone || contact.phone_mobile || '').trim()
        if (!to) return res.status(400).json({ error: 'This customer has no mobile number on file.' })
        const body = `${note || `${repName ? `${repName}: ` : ''}Here's a quick video for you`}: ${url}`
        delivery = await sendDealerSms(req.dealershipId, to, body)
        if (!delivery?.ok && delivery?.simulated) unconfigured = true
      }
      if (unconfigured) {
        return res.json({ ok: false, code: 'delivery_unconfigured', channel, to, watch_url: url })
      }
      if (!delivery?.ok) {
        return res.status(502).json({ error: delivery?.error || `Could not send the ${channel === 'email' ? 'email' : 'text'}. Check your ${channel === 'email' ? 'email' : 'texting number'} setup and try again.` })
      }

      const { data, error } = await supabaseAdmin.from('sales_videos').update({
        status: 'sent', channel, sent_at: new Date().toISOString(),
        consent_basis: consent.basis, updated_at: new Date().toISOString(),
      }).eq('id', video.id).select(VIDEO_COLUMNS).single()
      if (error) return res.status(500).json({ error: error.message })

      audit(req, 'sales_video.sent', { after_state: { id: video.id, channel, basis: consent.basis } })
      res.json({ ok: true, video: { ...data, summary: watchSummary(data) } })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── The customer's side. No auth: they have a token, not an account. ───────

  /**
   * What the watch page needs. Deliberately minimal — the rep's first name and the vehicle,
   * never the customer's own record. Generates short-lived signed playback URL from private storage.
   */
  app.get('/v/:token', rateLimit('sales_video_watch', 60, 60 * 1000), async (req, res) => {
    try {
      const token = String(req.params.token || '').trim()
      if (!token || token.length < 8) return res.status(404).json({ error: 'Video unavailable' })

      const { data: video } = await supabaseAdmin.from('sales_videos')
        .select('id, dealership_id, title, storage_path, public_url, poster_url, duration_seconds, expires_at, revoked_at, deleted_at, created_by, inventory_id')
        .eq('share_token', token).maybeSingle()

      const state = shareLinkState(video)
      if (!state.ok) return res.status(404).json({ error: state.reason })

      const storagePath = extractStoragePath(video)
      if (!storagePath) return res.status(404).json({ error: 'Video unavailable' })

      const signedUrl = await getSignedPlaybackUrl(storagePath, 900) // 15-minute short-lived playback URL
      if (!signedUrl) return res.status(500).json({ error: 'Could not generate playback URL' })

      const [{ data: rep }, { data: veh }] = await Promise.all([
        video.created_by
          ? supabaseAdmin.from('profiles').select('full_name').eq('id', video.created_by).maybeSingle()
          : Promise.resolve({ data: null }),
        video.inventory_id
          ? supabaseAdmin.from('inventory').select('year, make, model, trim').eq('id', video.inventory_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      // Fetching the page is NOT watching it.
      await supabaseAdmin.from('sales_video_events').insert({
        dealership_id: video.dealership_id, video_id: video.id, kind: 'link_opened',
        user_agent: (req.get('user-agent') || '').slice(0, 300),
      })

      res.set('Cache-Control', 'private, no-store')
      res.json({
        title: video.title,
        url: signedUrl,
        poster: video.poster_url,
        duration_seconds: video.duration_seconds,
        from: (rep?.full_name || '').split(' ')[0] || null,
        vehicle: veh ? [veh.year, veh.make, veh.model, veh.trim].filter(Boolean).join(' ') : null,
      })
    } catch (e) { res.status(500).json({ error: 'Video unavailable' }) }
  })

  /**
   * A playback event from the player. Requires JavaScript and — for `play_started` — a real
   * user gesture, which is exactly what separates this from a prefetch.
   */
  app.post('/v/:token/event', rateLimit('sales_video_event', 120, 60 * 1000), async (req, res) => {
    const kind = String(req.body?.kind || '')
    if (!['play_started', 'progress', 'completed', 'replied'].includes(kind)) {
      return res.status(400).json({ error: 'Unknown event.' })
    }
    try {
      const { data: video } = await supabaseAdmin.from('sales_videos')
        .select('id, dealership_id, expires_at, revoked_at, deleted_at').eq('share_token', req.params.token).maybeSingle()
      const state = shareLinkState(video)
      if (!state.ok) return res.status(404).json({ error: state.reason })

      const pos = Number(req.body?.position_seconds)
      await supabaseAdmin.from('sales_video_events').insert({
        dealership_id: video.dealership_id, video_id: video.id, kind,
        position_seconds: Number.isFinite(pos) && pos >= 0 ? Math.round(pos) : null,
        user_agent: (req.get('user-agent') || '').slice(0, 300),
      })
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
