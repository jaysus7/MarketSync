// Onboarding drip campaign. A 7-email sequence that walks a brand-new trial user
// through getting value out of MarketSync, ending with a "your trial ends
// tomorrow" nudge to subscribe.
//
// How it's driven: a daily cron (see /cron/drip in server.js) calls
// runDripCampaign(). For each trialing, email-verified user we work out which day
// of their trial they're on (derived from trial_ends_at, which is signup + 7 days)
// and send the next unsent email in the sequence — at most one per user per run,
// in order. Sends are recorded in the `drip_sends` table, so the cron is
// idempotent: a double-fire or a re-run never sends the same email twice.
//
// Provider: Resend (same as password resets / security alerts). Sender domain
// (marketsync.link) must be verified with DKIM/SPF/DMARC.
//
// Consent / compliance: these are relationship/onboarding emails to people who
// just created a trial account, but we still give every message a one-click
// unsubscribe (List-Unsubscribe header + footer link) and honour it via
// profiles.drip_unsubscribed_at — CAN-SPAM / CASL friendly.

import { createHash } from 'crypto'

const DAY_MS = 24 * 60 * 60 * 1000
const TRIAL_DAYS = 7   // keep in sync with trialEndsAt in server.js registration

// ──────────────────────────────────────────────────────────────────────────────
// Unsubscribe tokens
// ──────────────────────────────────────────────────────────────────────────────
// Deterministic, unguessable, stateless: HMAC-ish hash of the user id + a server
// secret. No DB storage needed — we recompute and compare on the unsubscribe hit.

export function unsubToken(userId, secret) {
  return createHash('sha256').update(`${userId}:drip:${secret}`).digest('hex')
}

export function verifyUnsubToken(userId, token, secret) {
  if (!userId || !token) return false
  const expected = unsubToken(userId, secret)
  // Length check guards timingSafeEqual; both are hex of equal length anyway.
  return token.length === expected.length && token === expected
}

// ──────────────────────────────────────────────────────────────────────────────
// Email content
// ──────────────────────────────────────────────────────────────────────────────
// One entry per day. `day` is the number of full days since signup on which the
// email should go out (0 = signup day). `skipIfTrialEnded` stops a stale "trial
// ends tomorrow" nudge from reaching someone whose trial already lapsed (e.g. if
// the cron missed a day). Body builders get the recipient's first name + links.

function firstName(fullName) {
  const n = (fullName || '').trim().split(/\s+/)[0]
  return n || 'there'
}

// day → { subject, intro, body (array of <p> strings), cta: {text, path} }
function dripContent(frontendUrl, extensionUrl) {
  const dash = `${frontendUrl}/dashboard.html`
  return [
    {
      day: 0,
      key: 'welcome',
      subject: 'Welcome to MarketSync — let\'s sync your inventory',
      heading: 'Welcome to MarketSync 👋',
      body: [
        'Thanks for starting your trial! MarketSync auto-posts your dealership inventory to Facebook Marketplace so you stop copy-pasting listings by hand.',
        'First step: connect your inventory so we can pull in your vehicles. It takes about two minutes — add your inventory feed URL (or website) from your dashboard and we\'ll do the rest.'
      ],
      cta: { text: 'Sync your inventory', url: dash }
    },
    {
      day: 1,
      key: 'inventory-live',
      subject: 'Your inventory is live 🚗',
      heading: 'Your inventory is live',
      body: [
        'Your vehicles are now in MarketSync. Head to your dashboard to view every listing, check details, and manage what\'s ready to post.',
        'Tip: spend a minute making sure prices and photos look right before you start posting — clean listings get more responses.'
      ],
      cta: { text: 'View your listings', url: dash }
    },
    {
      day: 2,
      key: 'post-to-facebook',
      subject: 'Post to Facebook Marketplace in a couple clicks',
      heading: 'Posting to Facebook Marketplace',
      body: [
        'Ready for the magic? The MarketSync Chrome extension takes a vehicle from your dashboard and fills out the Facebook Marketplace listing for you — photos, price, description, all of it.',
        'Install the extension, open Marketplace, and let MarketSync do the typing. No more 15-minutes-per-car.'
      ],
      cta: { text: 'Get the Chrome extension', url: extensionUrl }
    },
    {
      day: 3,
      key: 'as-is-status-badges',
      subject: 'Pro tip: AS-IS notes & status badges',
      heading: 'Pro tip: AS-IS & status badges',
      body: [
        'Keeping your lot clean is half the battle. MarketSync lets you flag vehicles as AS-IS and mark status badges (posted, sold, pending) so you always know what\'s where at a glance.',
        'When a car sells, mark it sold in MarketSync and it stops cluttering your active listings — no more chasing dead posts.'
      ],
      cta: { text: 'Manage your listings', url: dash }
    },
    {
      day: 4,
      key: 'track-whats-posted',
      subject: 'Never double-post a vehicle again',
      heading: 'Track what\'s already posted',
      body: [
        'MarketSync tracks which vehicles you\'ve posted, so you never accidentally list the same car twice (Facebook hates that — and so do shoppers).',
        'Your dashboard shows posted vs. not-yet-posted at a glance, so you can work through your lot without keeping a spreadsheet.'
      ],
      cta: { text: 'See what\'s posted', url: dash }
    },
    {
      day: 5,
      key: 'power-user-tips',
      subject: 'Get the most out of MarketSync',
      heading: 'Power-user tips',
      body: [
        'A few ways our top dealers squeeze more out of MarketSync: keep your inventory feed connected so new arrivals show up automatically, post your freshest units first thing in the morning, and re-post slow movers to bump them back to the top.',
        'Set your inventory to auto-sync and MarketSync keeps your listings current without you lifting a finger.'
      ],
      cta: { text: 'Open your dashboard', url: dash }
    },
    {
      day: 6,
      key: 'trial-ending',
      subject: 'Your MarketSync trial ends tomorrow',
      heading: 'Your trial ends tomorrow',
      skipIfTrialEnded: true,
      body: [
        'Your free trial wraps up tomorrow. To keep auto-posting your inventory to Facebook Marketplace without interruption, pick a plan from your dashboard — it takes a minute and you keep everything you\'ve set up.',
        'Questions before you decide? Just reply to this email. Common ones: yes, you can cancel anytime; yes, your listings stay; and yes, the extension keeps working on your plan.'
      ],
      cta: { text: 'Choose your plan', url: `${frontendUrl}/dashboard.html` }
    }
  ]
}

// Branded HTML shell — matches the password-reset email styling in server.js.
function renderHtml({ heading, body, cta, unsubUrl }) {
  const paragraphs = body.map(p =>
    `<p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 16px 0;">${p}</p>`
  ).join('\n          ')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:32px 32px 16px 32px;">
          <div style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
            Market<span style="color:#6366f1;">Sync</span>
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px 0;">${heading}</h1>
          ${paragraphs}
          <p style="margin:8px 0 32px 0;">
            <a href="${cta.url}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">${cta.text}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
            MarketSync · Auto-post dealership inventory to Facebook Marketplace<br>
            <a href="https://marketsync.link/" style="color:#94a3b8;">marketsync.link</a> ·
            <a href="${unsubUrl}" style="color:#94a3b8;">Unsubscribe from tips</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function renderText({ heading, body, cta, unsubUrl }) {
  return `${heading}

${body.join('\n\n')}

${cta.text}: ${cta.url}

—
MarketSync
https://marketsync.link/
Unsubscribe from these tips: ${unsubUrl}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────────────
// Loads every verified auth user (paginated), then walks the trialing profiles
// and sends each the next unsent email in their sequence. Never throws per-user:
// one bad send doesn't stop the batch. Returns a summary for the cron response.

async function loadVerifiedUsers(supabaseAdmin) {
  const byId = new Map()
  let page = 1
  const perPage = 1000
  // Paginate until a short page tells us we've seen everyone.
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    for (const u of users) {
      byId.set(u.id, { email: u.email, confirmedAt: u.email_confirmed_at || u.confirmed_at || null })
    }
    if (users.length < perPage) break
    page += 1
  }
  return byId
}

export async function runDripCampaign({
  supabaseAdmin, resend, emailFrom, frontendUrl, extensionUrl, unsubBaseUrl, unsubSecret, trigger = 'manual'
}) {
  if (!resend) {
    console.warn('[drip] RESEND_API_KEY not set — skipping drip campaign')
    return { success: false, reason: 'no resend key', sent: 0 }
  }

  const EMAILS = dripContent(frontendUrl, extensionUrl)
  const now = Date.now()
  const summary = { trigger, sent: 0, skipped: 0, errors: 0, processed: 0 }

  let users
  try {
    users = await loadVerifiedUsers(supabaseAdmin)
  } catch (e) {
    console.error('[drip] failed to load users:', e.message)
    return { success: false, reason: e.message, sent: 0 }
  }

  // Trialing profiles who haven't opted out. trial_ends_at lives on the profile
  // for solo reps and on the dealership for dealer admins — mirror the auth
  // middleware and fall back to the dealership.
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, billing_status, trial_ends_at, drip_unsubscribed_at, dealerships(billing_status, trial_ends_at)')
    .is('drip_unsubscribed_at', null)

  if (profErr) {
    console.error('[drip] failed to load profiles:', profErr.message)
    return { success: false, reason: profErr.message, sent: 0 }
  }

  for (const p of profiles || []) {
    const billing = p.billing_status || p.dealerships?.billing_status
    if (billing !== 'TRIALING') continue

    const trialEndsRaw = p.trial_ends_at || p.dealerships?.trial_ends_at
    if (!trialEndsRaw) continue

    const auth = users.get(p.id)
    if (!auth || !auth.email || !auth.confirmedAt) continue   // not verified → don't email

    summary.processed += 1

    const trialEndsAt = new Date(trialEndsRaw).getTime()
    const signupTime = trialEndsAt - TRIAL_DAYS * DAY_MS
    const currentDay = Math.floor((now - signupTime) / DAY_MS)
    if (currentDay < 0) continue

    // Which days has this user already received?
    const { data: sentRows } = await supabaseAdmin
      .from('drip_sends')
      .select('day_number')
      .eq('user_id', p.id)
    const sentDays = new Set((sentRows || []).map(r => r.day_number))

    // Next unsent email that's due (smallest day <= currentDay). At most one per
    // run, so users progress through the sequence in order even after a missed day.
    const next = EMAILS
      .filter(e => e.day <= currentDay && !sentDays.has(e.day))
      .sort((a, b) => a.day - b.day)[0]
    if (!next) continue

    // Don't send a stale "trial ends tomorrow" to someone whose trial already ended.
    if (next.skipIfTrialEnded && now > trialEndsAt) {
      summary.skipped += 1
      continue
    }

    // Unsubscribe is handled by this backend (the static frontend has no routes),
    // so the link points at the API host, not frontendUrl.
    const unsubUrl = `${unsubBaseUrl || frontendUrl}/unsubscribe?u=${p.id}&t=${unsubToken(p.id, unsubSecret)}`
    const content = {
      heading: next.heading,
      body: [`Hi ${firstName(p.full_name)},`, ...next.body],
      cta: next.cta,
      unsubUrl
    }

    try {
      const { error: sendErr } = await resend.emails.send({
        from: emailFrom,
        to: auth.email,
        subject: next.subject,
        html: renderHtml(content),
        text: renderText(content),
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@marketsync.link?subject=unsub-${p.id}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': `drip-${p.id}-${next.day}`
        }
      })
      if (sendErr) {
        console.warn(`[drip] send failed for ${auth.email} (day ${next.day}): ${sendErr.message}`)
        summary.errors += 1
        continue
      }
    } catch (e) {
      console.warn(`[drip] send threw for ${auth.email}: ${e.message}`)
      summary.errors += 1
      continue
    }

    // Record the send. The unique (user_id, day_number) constraint means a racing
    // second run can't double-send: the insert just fails harmlessly.
    const { error: insErr } = await supabaseAdmin
      .from('drip_sends')
      .insert({ user_id: p.id, day_number: next.day })
    if (insErr) {
      console.warn(`[drip] sent but failed to record (user ${p.id}, day ${next.day}): ${insErr.message}`)
    }
    summary.sent += 1
    console.log(`[drip] sent "${next.key}" (day ${next.day}) to ${auth.email}`)
  }

  console.log(`[drip:${trigger}] done — processed ${summary.processed}, sent ${summary.sent}, skipped ${summary.skipped}, errors ${summary.errors}`)
  return { success: true, ...summary }
}
