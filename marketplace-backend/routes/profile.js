import { supabaseAdmin, sendEmail, FRONTEND_URL } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { validatePassword, rateLimit, getClientIp } from '../security.js'
import { audit, AuditAction, exportReason } from '../audit.js'
import { SYSTEM_ROLES, hasSystemRole, requirePermission, syncDealerRole } from '../authorization.js'
import multer from 'multer'
import { randomBytes, createHash } from 'node:crypto'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

// ── OWNER-ONLY: NEWSLETTER SUBSCRIBER EXPORT ──
// Gated by the server-managed platform-owner role. Returns CSV-ready data of
// everyone who opted in to marketing emails during signup.

// Which MarketSync product(s) this dealership has. Empty → full DealerOS (so existing
// accounts and personal workspaces keep everything). The frontend generates the nav +
// landing screen from this.
export const PRODUCT_KEYS = ['facebook_solo', 'facebook_dealer', 'ai_chatbot', 'dealer_os']
export function resolveProducts(dealer) {
  const p = (dealer && typeof dealer.products === 'object' && dealer.products) ? dealer.products : {}
  return PRODUCT_KEYS.some(k => p[k]) ? p : { dealer_os: true }
}

// ── MarketSync staff roles + permissions (the saas_admin workspace's access model) ──
// Permissions are config-as-code, derived from the role. The platform owner is always
// 'owner' (all permissions) regardless of the profiles.saas_role column.
export const SAAS_ROLES = ['owner', 'sales', 'support', 'marketing', 'developer']
export const SAAS_PERMISSIONS = {
  owner:     ['*'],
  sales:     ['view_customers', 'view_pipeline', 'view_revenue', 'create_trial', 'extend_trial', 'manage_followups'],
  support:   ['view_customers', 'view_pipeline', 'extend_trial', 'reset_password', 'impersonate', 'manage_followups'],
  marketing: ['view_customers', 'view_pipeline', 'marketing', 'affiliates', 'website'],
  developer: ['view_customers', 'products', 'settings', 'logs'],
}
export function saasRoleOf(req) {
  if (hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) return 'owner'
  const r = req?.profile?.saas_role
  return SAAS_ROLES.includes(r) ? r : null
}
export function saasPerms(req) { const r = saasRoleOf(req); return r ? (SAAS_PERMISSIONS[r] || []) : [] }
export function saasCan(req, perm) { const p = saasPerms(req); return p.includes('*') || p.includes(perm) }

export function registerRoutes(app) {
  app.get('/auth/me', requireAuth, async (req, res) => {
    // Workspace identity comes from a server-managed system role, never a dealer name.
    const isMarketsync = hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER, SYSTEM_ROLES.PLATFORM_ADMIN)
    // Workspace resolution (universal identity layer): one login → the top-level
    // experience this person belongs to. Same engines underneath, different front door.
    //   saas_admin → MarketSync's own back office (owner/staff)
    //   affiliate  → partner portal (they authenticate as a dealership user too, but
    //                if they also hold an affiliates row we surface it)
    //   dealer     → a dealership workspace (DealerOS or a purchased product)
    let workspace = 'dealer'
    if (isMarketsync) workspace = 'saas_admin'
    else {
      try {
        const { data: aff } = await supabaseAdmin.from('affiliates').select('id, status').eq('user_id', req.user.id).maybeSingle()
        if (aff && aff.status !== 'suspended') workspace = 'affiliate'
      } catch { /* affiliates table optional — default stays 'dealer' */ }
    }
    res.json({
      id: req.user.id,
      email: req.user.email,
      full_name: req.profile.full_name,
      display_name: req.profile.display_name || null,
      phone: req.profile.phone || null,
      avatar_url: req.profile.avatar_url || null,
      role: req.profile.role,
      mgr_role: req.profile.mgr_role || null,
      email_signature: req.profile.email_signature || null,
      email_reply_to: req.profile.email_reply_to || null,
      dealership: req.profile.dealerships,
      is_marketsync: isMarketsync,
      // Product entitlements → the frontend builds the sidebar + landing from these.
      products: resolveProducts(req.profile.dealerships),
      // Which workspace this login opens into (see resolver above).
      workspace,
      // MarketSync staff role + derived permissions (only meaningful in saas_admin).
      saas_role: saasRoleOf(req),
      saas_permissions: saasPerms(req),
    })
  })

  // ── 4. PROFILE ──
  // Avatar upload — stores in Supabase Storage bucket "avatars"
  app.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const path = `${req.user.id}/avatar.${ext}`
    const { error } = await supabaseAdmin.storage.from('avatars').upload(path, req.file.buffer, {
      contentType: req.file.mimetype, upsert: true
    })
    if (error) return res.status(500).json({ error: error.message })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
    await supabaseAdmin.from('profiles').update({ avatar_url: publicUrl }).eq('id', req.user.id)
    audit(req, AuditAction.AVATAR_UPLOADED)
    res.json({ url: publicUrl })
  })

  app.put('/profile/update', requireAuth, rateLimit('profile-update', 10, 60 * 60 * 1000), async (req, res) => {
    const { fullName, displayName, phone, email, password, dealershipName, websiteUrl, avatarUrl, registrationId, emailSignature, emailReplyTo } = req.body

    try {
      const authUpdates = {}
      if (email) authUpdates.email = email
      if (password) {
        // 2026 password policy applies to in-app password changes too
        const pwCheck = await validatePassword(password, { email: email || req.user.email })
        if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error })
        authUpdates.password = password
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, authUpdates)
        if (authError) throw authError
      }

      const profileUpdates = {}
      if (fullName) profileUpdates.full_name = fullName
      if (displayName !== undefined) profileUpdates.display_name = displayName || null
      if (phone !== undefined) profileUpdates.phone = (phone || '').trim() || null
      if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl || null
      // Salesperson/manager OMVIC or provincial registration # — prints on the bill of sale.
      if (registrationId !== undefined) profileUpdates.registration_id = (registrationId || '').trim() || null
      // CRM email signature (appended to sent emails) + optional reply-to override so
      // replies can land in a personal inbox rather than the login email.
      if (emailSignature !== undefined) profileUpdates.email_signature = (emailSignature || '').trim().slice(0, 2000) || null
      if (emailReplyTo !== undefined) {
        const rt = (emailReplyTo || '').trim()
        if (rt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rt)) return res.status(400).json({ error: 'Enter a valid reply-to email address' })
        profileUpdates.email_reply_to = rt || null
      }
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', req.user.id)
        if (profileError) throw profileError
      }

      if (req.dealershipId && (dealershipName || websiteUrl)) {
        const dealerUpdates = {}
        if (dealershipName) dealerUpdates.name = dealershipName
        if (websiteUrl) dealerUpdates.website_url = websiteUrl

        const { error: dealerError } = await supabaseAdmin
          .from('dealerships')
          .update(dealerUpdates)
          .eq('id', req.dealershipId)
        if (dealerError) throw dealerError
      }

      audit(req, AuditAction.PROFILE_UPDATED, {
        changed: Object.keys(profileUpdates).concat(Object.keys(authUpdates))
      })
      res.json({ message: 'Workspace identity updated successfully' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 5. TEAM MANAGEMENT ──
  app.get('/dealership/team', requireAuth, async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile.role)) {
      return res.status(403).json({ error: 'Admins only' })
    }
    if (!req.dealershipId) return res.json([])

    const { data: members, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, display_name, avatar_url, bio, role, account_role, created_at, can_see_all_appraisals, sales_team, mgr_role, active, registration_id')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const enriched = await Promise.all(members.map(async (m) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(m.id).catch(() => ({ data: null }))
      const { count: listingsCount } = await supabaseAdmin
        .from('listings').select('id', { count: 'exact', head: true })
        .eq('posted_by', m.id).eq('status', 'posted')
      const { count: soldCount } = await supabaseAdmin
        .from('listings').select('id', { count: 'exact', head: true })
        .eq('posted_by', m.id).eq('status', 'sold')
      const { count: totalCount } = await supabaseAdmin
        .from('listings').select('id', { count: 'exact', head: true })
        .eq('posted_by', m.id)
      const { count: loginsCount } = await supabaseAdmin
        .from('logins').select('id', { count: 'exact', head: true })
        .eq('user_id', m.id).gte('created_at', thirtyDaysAgo)
      return {
        id: m.id,
        full_name: m.full_name,
        display_name: m.display_name || null,
        avatar_url: m.avatar_url || null,
        bio: m.bio || null,
        role: m.role,
        account_role: m.account_role,
        can_see_all_appraisals: !!m.can_see_all_appraisals,
        sales_team: m.sales_team || null,
        mgr_role: m.mgr_role || null,
        active: m.active !== false,
        email: authUser?.user?.email || null,
        listings_posted: listingsCount || 0,
        listings_sold: soldCount || 0,
        conversion_rate: (totalCount || 0) > 0
          ? Math.round(((soldCount || 0) / (totalCount || 0)) * 100)
          : 0,
        logins_30d: loginsCount || 0,
        created_at: m.created_at
      }
    }))

    res.json(enriched)
  })

  app.post('/admin/users/invite', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile.role)) {
      return res.status(403).json({ error: 'Admins only' })
    }
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated with this admin account' })

    const { email, full_name, password } = req.body || {}
    if (!email || !full_name) return res.status(400).json({ error: 'email and full_name required' })

    // Only a dealer admin/owner may invite someone straight in as a Manager;
    // a manager inviting can only add reps.
    const wantsManager = req.body?.role === 'MANAGER'
    if (wantsManager && !['DEALER_ADMIN', 'OWNER'].includes(req.profile.role)) {
      return res.status(403).json({ error: 'Only a dealer admin can invite a manager' })
    }
    const newRole = wantsManager ? 'MANAGER' : 'SALES_REP'

    // Either: admin set a real password (must meet 2026 policy), or we generate a
    // cryptographically-random 16-char temporary one. No more weak Math.random() temps.
    let tempPassword
    if (password) {
      const pwCheck = await validatePassword(password, { email })
      if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error })
      tempPassword = password
    } else {
      // 16 base64 chars from crypto.randomBytes — strong enough that the rep should
      // reset on first login. Always passes the policy.
      tempPassword = randomBytes(12).toString('base64').replace(/[+/=]/g, '') + 'Aa9!'
    }

    // Create a random server-only bootstrap password. The invitee receives a
    // Resend-delivered password setup link, never this secret and never a
    // Supabase-hosted invitation email.
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true
    })
    if (authError) return res.status(500).json({ error: authError.message })

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: newUser.user.id,
      dealership_id: req.dealershipId,
      full_name,
      role: newRole,
      account_role: newRole === 'MANAGER' ? 'dealer_admin' : 'sales_rep'
    })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return res.status(500).json({ error: profileError.message })
    }
    try { await syncDealerRole(newUser.user.id, req.dealershipId, newRole, req.user.id) }
    catch (e) { await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id); await supabaseAdmin.auth.admin.deleteUser(newUser.user.id); return res.status(500).json({ error: e.message }) }

    const rawResetToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawResetToken).digest('hex')
    const { error: tokenError } = await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: newUser.user.id,
      email: email.trim().toLowerCase(),
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      requested_ip: getClientIp(req),
    })
    const actionLink = `${FRONTEND_URL}/reset-password.html?token=${rawResetToken}`
    const firstName = String(full_name).trim().split(/\s+/)[0] || 'there'
    const safeFirstName = firstName.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]))
    const mail = !tokenError ? await sendEmail({
      to: email,
      subject: 'You have been invited to MarketSync',
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to MarketSync, ${safeFirstName}!</h2>
        <p style="line-height:1.6">Your MarketSync account is ready. Set your password to activate your dealer workspace.</p>
        <p><a href="${actionLink}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none">Set my password</a></p>
        <p style="color:#64748b;font-size:13px;line-height:1.5">If the button does not work, copy this link into your browser:<br><a href="${actionLink}" style="color:#4f46e5;word-break:break-all">${actionLink}</a></p>
      </div>`,
      tags: [{ name: 'message_type', value: 'team_invite' }],
    }) : { ok: false, error: tokenError?.message || 'Could not create password setup link' }

    if (!mail.ok) {
      await supabaseAdmin.from('password_reset_tokens').delete().eq('token_hash', tokenHash)
      await supabaseAdmin.from('profiles').delete().eq('id', newUser.user.id)
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return res.status(503).json({ error: 'Invitation email could not be sent. No account was created.' })
    }

    audit(req, AuditAction.TEAM_MEMBER_INVITED, { invited_email: email, invited_user_id: newUser.user.id, delivery: 'resend' })
    res.json({
      success: true,
      user_id: newUser.user.id,
      email,
      invitation_sent: true,
      note: 'A MarketSync password-setup email was sent through Resend.'
    })
  })

  // Promote a rep to Manager (full dealer access, scoped to this store) or
  // demote a manager back to rep. Dealer admins/owners only — a manager cannot
  // mint other managers.
  app.post('/admin/users/:id/role', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (req.profile.role !== 'DEALER_ADMIN' && req.profile.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only a dealer admin can change roles' })
    }
    const { role } = req.body || {}
    // MANAGER = full dealer access. SALES_REP = standard rep. The specialized
    // sub-roles (FNI / SERVICE / ACCOUNTING / CLEANUP) each see only their own
    // workspace; none carries admin power, so they map to the 'sales_rep'
    // account_role and are gated per-domain on the API side.
    const ASSIGNABLE = ['MANAGER', 'SALES_REP', 'FNI', 'SERVICE', 'ACCOUNTING', 'CLEANUP']
    if (!ASSIGNABLE.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${ASSIGNABLE.join(', ')}` })
    }
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' })

    const { data: target } = await supabaseAdmin
      .from('profiles').select('id, dealership_id, role').eq('id', req.params.id).single()
    if (!target || target.dealership_id !== req.dealershipId) {
      return res.status(404).json({ error: 'User not found in your dealership' })
    }
    if (target.role === 'DEALER_ADMIN' || target.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot change an admin/owner role here' })
    }
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role, account_role: role === 'MANAGER' ? 'dealer_admin' : 'sales_rep' })
      .eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    try { await syncDealerRole(target.id, req.dealershipId, role, req.user.id) }
    catch (e) { return res.status(500).json({ error: e.message }) }
    audit(req, AuditAction.PERMISSION_CHANGED, { target_user_id: req.params.id, new_role: role })
    res.json({ success: true, role })
  })

  // Edit a team member's public-facing profile (name, bio, photo) — coincides with
  // the website team card. Manager+ can edit any rep in their dealership.
  app.put('/admin/users/:id/profile', requireAuth, async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile.role)) return res.status(403).json({ error: 'Manager access required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: target } = await supabaseAdmin.from('profiles').select('id, dealership_id').eq('id', req.params.id).maybeSingle()
    if (!target || target.dealership_id !== req.dealershipId) return res.status(404).json({ error: 'User not found in your dealership' })
    const b = req.body || {}, patch = {}
    if (b.full_name !== undefined) patch.full_name = String(b.full_name || '').trim().slice(0, 120) || null
    if (b.display_name !== undefined) patch.display_name = String(b.display_name || '').trim().slice(0, 120) || null
    if (b.bio !== undefined) patch.bio = String(b.bio || '').trim().slice(0, 1000) || null
    if (b.avatar_url !== undefined) patch.avatar_url = b.avatar_url ? String(b.avatar_url).slice(0, 500) : null
    // OMVIC / provincial registration # for this rep — prints beside their name + signature on the bill of sale.
    if (b.registration_id !== undefined) patch.registration_id = String(b.registration_id || '').trim().slice(0, 60) || null
    if (!Object.keys(patch).length) return res.json({ ok: true })
    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, ...patch })
  })

  // Reset a team member's password (dealer admin / owner only). Sets a temp password.
  app.put('/admin/users/:id/password', requireAuth, requireMfa, async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER'].includes(req.profile.role)) return res.status(403).json({ error: 'Dealer admin required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Use Settings to change your own password' })
    const { data: target } = await supabaseAdmin.from('profiles').select('id, dealership_id').eq('id', req.params.id).maybeSingle()
    if (!target || target.dealership_id !== req.dealershipId) return res.status(404).json({ error: 'User not found in your dealership' })
    let password = String(req.body?.password || '').trim()
    if (!password) password = 'MS-' + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89)  // auto temp
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, password })
  })

  // Set a member's sales team + manager scope (for lead routing / notifications).
  app.put('/admin/users/:id/team', requireAuth, async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile.role)) return res.status(403).json({ error: 'Manager access required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: target } = await supabaseAdmin.from('profiles').select('id, dealership_id').eq('id', req.params.id).maybeSingle()
    if (!target || target.dealership_id !== req.dealershipId) return res.status(404).json({ error: 'User not found in your dealership' })
    const b = req.body || {}, patch = {}
    if (b.sales_team !== undefined) patch.sales_team = ['new', 'used', 'both'].includes(b.sales_team) ? b.sales_team : null
    if (b.mgr_role !== undefined) patch.mgr_role = ['gm', 'gsm', 'new_mgr', 'used_mgr', 'fni'].includes(b.mgr_role) ? b.mgr_role : null
    if (b.active !== undefined) patch.active = !!b.active
    if (!Object.keys(patch).length) return res.json({ ok: true })
    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, ...patch })
  })

  // ── SESSION ACTIVITY (recent logins + sign out other devices) ──
  // Returns last 20 login events for the current user so they can spot suspicious access.
  // Pairs with /me/sessions/revoke-others to sign all OTHER sessions out at once.
  app.get('/me/sessions', requireAuth, async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('logins')
      .select('id, created_at, ip, user_agent')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return res.status(500).json({ error: error.message })

    const events = (data || []).map(row => {
      const ua = row.user_agent || ''
      let browser = 'Unknown browser'
      if (/Edg\//.test(ua)) browser = 'Edge'
      else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome'
      else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
      else if (/Firefox\//.test(ua)) browser = 'Firefox'
      let os = 'Unknown OS'
      if (/Mac OS X/.test(ua)) os = 'macOS'
      else if (/Windows/.test(ua)) os = 'Windows'
      else if (/iPhone|iPad/.test(ua)) os = 'iOS'
      else if (/Android/.test(ua)) os = 'Android'
      else if (/Linux/.test(ua)) os = 'Linux'
      return { id: row.id, timestamp: row.created_at, ip: row.ip || null, browser, os }
    })
    res.json({ events })
  })

  // Revoke every refresh token except the current request's. The current access token
  // still works until its short-lived expiry (Supabase ~1h default), then forces a
  // re-login on every other device.
  app.post('/me/sessions/revoke-others', requireAuth, requireMfa, async (req, res) => {
    try {
      const { error } = await supabaseAdmin.auth.admin.signOut(req.user.id, 'others')
      if (error) {
        // Older Supabase clients don't accept the scope arg — fall back to revoking all
        const { error: fallbackErr } = await supabaseAdmin.auth.admin.signOut(req.user.id)
        if (fallbackErr) throw fallbackErr
        audit(req, AuditAction.SESSIONS_REVOKED, { scope: 'all' })
        return res.json({ success: true, scope: 'all', message: 'All sessions signed out, including this one. Please log in again.' })
      }
      audit(req, AuditAction.SESSIONS_REVOKED, { scope: 'others' })
      res.json({ success: true, scope: 'others', message: 'Other devices have been signed out.' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── AUDIT LOG (SOC 2 evidence export) ────────────────────────────────────────
  // Admins can pull their dealership's audit log via the dashboard or for compliance.
  // The owner can pull the full platform log. Rows are read-only — no delete or update.
  app.get('/audit-log', requireAuth, requireMfa, requirePermission('audit.view'), async (req, res) => {
    const isOwner = hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)
    const isAdmin = req.profile.role === 'DEALER_ADMIN' || req.profile.role === 'OWNER'
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Admins only' })

    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Number(req.query.offset) || 0
    const action = req.query.action || null

    let query = supabaseAdmin
      .from('audit_log')
      .select('id, action, actor_id, actor_email, dealership_id, ip, meta, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Owner sees all; admin sees only their own dealership
    if (!isOwner) query = query.eq('dealership_id', req.dealershipId)
    if (action) query = query.eq('action', action)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    audit(req, AuditAction.ADMIN_DATA_EXPORT, { type: 'audit_log', limit, offset, reason: exportReason(req) })
    res.json({ entries: data || [], count: (data || []).length })
  })

  app.get('/owner/newsletter-subscribers', requireAuth, requireMfa, async (req, res) => {
    if (!hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) {
      return res.status(403).json({ error: 'Owner-only endpoint' })
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, newsletter_consent_at, newsletter_consent_ip')
      .not('newsletter_consent_at', 'is', null)
      .order('newsletter_consent_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    // Look up email from Supabase auth for each consented profile
    const enriched = await Promise.all((profiles || []).map(async (p) => {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id).catch(() => ({ data: null }))
      return {
        email: authUser?.user?.email || null,
        full_name: p.full_name,
        consent_at: p.newsletter_consent_at,
        consent_ip: p.newsletter_consent_ip
      }
    }))
    const valid = enriched.filter(r => r.email)
    audit(req, AuditAction.NEWSLETTER_EXPORTED, { count: valid.length, format: (req.query.format || 'json').toLowerCase(), reason: exportReason(req) })

    // Respect ?format=csv for direct paste into mail tools
    if ((req.query.format || '').toLowerCase() === 'csv') {
      const header = 'email,name,consent_at,consent_ip\n'
      const rows = valid.map(r =>
        `${r.email},${(r.full_name || '').replace(/,/g, ' ')},${r.consent_at},${r.consent_ip || ''}`
      ).join('\n')
      res.set('Content-Type', 'text/csv')
      res.set('Content-Disposition', 'attachment; filename="marketsync-newsletter.csv"')
      return res.send(header + rows)
    }
    res.json({ count: valid.length, subscribers: valid })
  })

  app.delete('/admin/users/:id', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile.role)) {
      return res.status(403).json({ error: 'Admins only' })
    }
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' })

    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id, dealership_id, role')
      .eq('id', req.params.id)
      .single()
    if (!target || target.dealership_id !== req.dealershipId) {
      return res.status(404).json({ error: 'User not found in your dealership' })
    }
    if (target.role === 'DEALER_ADMIN' || target.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot remove an admin/owner from the dashboard' })
    }

    const { error } = await supabaseAdmin.from('profiles').update({ active: false }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    audit(req, AuditAction.TEAM_MEMBER_REMOVED, { removed_user_id: req.params.id, deactivated: true })
    res.json({ success: true, deactivated: true })
  })
}
