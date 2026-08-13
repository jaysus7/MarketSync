import { resend, EMAIL_FROM } from '../shared.js'

const PRIMARY = '#1a2e4a'
const ACCENT  = '#6366f1'

function shell(content, preheader = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MarketSync</title>
</head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}&nbsp;&zwnj;</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:${PRIMARY};padding:22px 28px">
    <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${ACCENT}">MarketSync</div>
    <div style="font-size:11px;color:#475569;margin-top:2px">Lot intelligence for Canadian dealers</div>
  </td></tr>
  ${content}
  <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
      MarketSync · <a href="https://marketsync.link" style="color:${ACCENT}">marketsync.link</a> ·
      <a href="https://marketsync.link/dashboard.html" style="color:${ACCENT}">Open dashboard</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function hero(eyebrow, heading, body) {
  return `<tr><td style="padding:32px 28px 24px;border-bottom:1px solid #e2e8f0">
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${ACCENT};margin-bottom:10px">${eyebrow}</div>
    <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:12px">${heading}</div>
    <div style="font-size:14px;color:#475569;line-height:1.7">${body}</div>
  </td></tr>`
}

function cta(label, url, color = ACCENT) {
  return `<tr><td style="padding:24px 28px">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none">${label} →</a>
  </td></tr>`
}

function featureGrid(features) {
  return `<tr><td style="border-bottom:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${features.map((f, i) => `
      <td width="${Math.floor(100/features.length)}%" style="padding:16px 18px;border-right:${i < features.length - 1 ? '1px solid #e2e8f0' : 'none'};vertical-align:top">
        <div style="font-size:17px;margin-bottom:6px">${f.icon}</div>
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:3px">${f.label}</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">${f.desc}</div>
      </td>`).join('')}
    </tr></table>
  </td></tr>`
}

function addonSection(color, icon, name, price, steps) {
  return `<tr><td style="padding:20px 28px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
      <tr><td style="background:${PRIMARY};padding:12px 18px;display:flex;align-items:center;gap:10px">
        <span style="font-size:16px">${icon}</span>
        <span style="font-size:13px;font-weight:800;color:#fff">${name}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:${color};background:rgba(255,255,255,.1);padding:2px 8px;border-radius:20px;border:1px solid rgba(255,255,255,.15)">${price}/mo CAD</span>
      </td></tr>
      ${steps.map((s, i) => `
      <tr><td style="padding:12px 18px;border-top:1px solid #f1f5f9;display:flex;gap:12px;align-items:flex-start">
        <span style="background:${color};color:#fff;font-size:10px;font-weight:800;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i+1}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">${s.label}</div>
          <div style="font-size:12px;color:#64748b;line-height:1.5">${s.desc}</div>
        </div>
      </td></tr>`).join('')}
    </table>
  </td></tr>`
}

function infoBar(bg, border, textColor, strong, body) {
  return `<tr><td style="padding:0 28px 20px">
    <div style="background:${bg};border-left:4px solid ${border};padding:14px 18px;border-radius:0 6px 6px 0">
      <div style="font-size:12px;font-weight:700;color:${textColor};margin-bottom:3px">${strong}</div>
      <div style="font-size:12px;color:${textColor};opacity:.85">${body}</div>
    </div>
  </td></tr>`
}

function receiptTable(rows) {
  return `<tr><td style="padding:0 28px 20px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px">
      ${rows.map((r, i) => `
      <tr style="${r.total ? 'background:#f8fafc;font-weight:700' : ''}">
        <td style="padding:10px 16px;border-bottom:${i < rows.length-1 ? '1px solid #e2e8f0' : 'none'};color:${r.total ? '#0f172a' : '#334155'}">${r.label}</td>
        <td style="padding:10px 16px;border-bottom:${i < rows.length-1 ? '1px solid #e2e8f0' : 'none'};text-align:right;color:${r.total ? '#0f172a' : '#334155'};font-variant-numeric:tabular-nums">${r.value}</td>
      </tr>`).join('')}
    </table>
  </td></tr>`
}

// ── Email 1: Trial Started — full feature walkthrough per add-on ──────────────
export async function sendTrialStarted({ to, dealerName, addons }) {
  const addonSections = []

  if (addons.includes('ai_boost')) {
    addonSections.push(addonSection('#6366f1', '✦', 'AI Boost', '$199', [
      { label: 'Send your first Weekly Health Report', desc: 'Go to AI Boost → click "Send Report Now". You\'ll get a full email with price drift flags, aging units, photo gaps, and inventory charts. It also downloads as a PDF.' },
      { label: 'Run Stocking Recommendations', desc: 'Click "Get Recommendations". AI reads your current lot mix and tells you which makes, models, and trims to source next — specific to your Ontario market.' },
      { label: 'Scan a competitor', desc: 'Add a competitor\'s website URL in the Competitor Scan section. MarketSync probes their DMS feed directly and shows a side-by-side comparison of pricing and inventory — auto-flagged where you\'re beating them or getting beaten.' },
      { label: 'Review Price Intelligence', desc: 'Any used vehicle priced more than 15% above or below the median of similar units on your own lot gets flagged in the health report. Adjust through your DMS and re-sync to clear the flag.' },
    ]))
  }

  if (addons.includes('vin_sticker')) {
    addonSections.push(addonSection('#10b981', '◈', 'VIN & Brochure', '$79', [
      { label: 'Decode a VIN', desc: 'Click "Decode VIN" from any page, or open the VIN & Brochure section. Enter any 17-character VIN and get full NHTSA specs, recall status, and feature list instantly.' },
      { label: 'Print a window sticker', desc: 'After decoding, click "Print Sticker". The PDF uses your dealership logo, colours, and tagline. Hand it to customers or stick it in the window — looks factory-fresh.' },
      { label: 'Generate a 2-page brochure', desc: 'Click "Generate Brochure". Pulls the hero photo from your inventory, full specs, and pricing. Share the link directly with a buyer or print it for a customer visit.' },
    ]))
  }

  if (addons.includes('ai_vision')) {
    addonSections.push(addonSection('#f59e0b', '◉', 'AI Vision', '$49', [
      { label: 'Automatic photo scoring', desc: 'AI Vision scans every listing photo on your next inventory sync. Blurry, dark, or placeholder images are flagged automatically — no manual review needed.' },
      { label: 'Find it in the health report', desc: 'Photo quality flags appear in your Weekly Health Report under "Photo Quality Issues". Each flag shows which photo failed and why.' },
      { label: 'Fix it in your DMS', desc: 'Replace the flagged photo through your DMS or directly in MarketSync. Re-sync and the flag clears on the next AI scan.' },
    ]))
  }

  const html = shell(`
    ${hero(
      `${addons.length > 1 ? 'Add-on Bundle' : 'Add-on'} Trial — 3 Days Free`,
      'Your trial is live. Here\'s exactly what to do first.',
      `Everything is active on ${dealerName}. You have three days to put it through its paces before your card is charged. We'll remind you 24 hours before the trial ends.`
    )}
    ${addonSections.join('\n')}
    <tr><td style="padding:20px 28px 0"></td></tr>
    ${cta('Open Dashboard', 'https://marketsync.link/dashboard.html')}
    <tr><td style="padding:0 28px 20px;font-size:12px;color:#64748b">
      Trial ends in <strong style="color:#0f172a">72 hours</strong>. No charge until then — cancel any time before and you won't be billed.
    </td></tr>
  `, `Your MarketSync trial is live — here's what to run first.`)

  if (!resend) return
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your trial is live — here's what to do first`,
    html
  })
}

// ── Email 2: Trial Expiring (24h) ─────────────────────────────────────────────
export async function sendTrialExpiring({ to, dealerName, addons }) {
  const total = addons.reduce((s, a) => s + (a === 'ai_boost' ? 199 : a === 'vin_sticker' ? 79 : 49), 0)
  const hst = Math.round(total * 0.13 * 100) / 100
  const html = shell(`
    ${hero('Trial Ending Soon', 'Your trial ends in 24 hours.', `Add a payment method now to keep your add-ons running without interruption. If you don't, access pauses when the trial ends — your data and settings stay safe.`)}
    <tr><td style="padding:20px 28px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${PRIMARY};border-radius:10px;overflow:hidden">
        <tr>
          ${addons.map(a => {
            const name  = a === 'ai_boost' ? 'AI Boost' : a === 'vin_sticker' ? 'VIN & Brochure' : 'AI Vision'
            const price = a === 'ai_boost' ? 199 : a === 'vin_sticker' ? 79 : 49
            const color = a === 'ai_boost' ? '#818cf8' : a === 'vin_sticker' ? '#34d399' : '#fbbf24'
            return `<td style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,.08)">
              <div style="font-size:20px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums">$${price}</div>
              <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${color};margin-top:3px">${name}</div>
            </td>`
          }).join('')}
          <td style="padding:20px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums">$${total + hst}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;margin-top:3px">Total / mo CAD</div>
          </td>
        </tr>
      </table>
    </td></tr>
    ${cta('Add Payment Method', 'https://marketsync.link/dashboard.html')}
    <tr><td style="padding:0 28px 20px;font-size:12px;color:#64748b">
      Not ready? <a href="https://marketsync.link/dashboard.html" style="color:${ACCENT}">Cancel trial</a> — you won't be charged.
    </td></tr>
  `, 'Your MarketSync trial ends in 24 hours.')

  if (!resend) return
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your trial ends tomorrow — add a payment method to keep access`,
    html
  })
}

// ── Email 3: Trial Expired ────────────────────────────────────────────────────
export async function sendTrialExpired({ to, dealerName, addons }) {
  const pausedItems = addons.map(a =>
    a === 'ai_boost'    ? 'Weekly reports · Stocking recs · Competitor scan · Price intelligence' :
    a === 'vin_sticker' ? 'VIN decode · Window stickers · Brochures' :
                          'Photo quality scoring'
  ).join('<br>')

  const html = shell(`
    ${hero('Trial Ended', 'Access has been paused.', `Your 3-day trial ended and we didn't find a payment method on file. Your lot data, branding, and settings are all still here — reactivate in one click.`)}
    ${infoBar('#fef3c7', '#d97706', '#92400e', 'What\'s paused', pausedItems)}
    ${cta('Reactivate Now', 'https://marketsync.link/dashboard.html', '#1a2e4a')}
    <tr><td style="padding:0 28px 20px;font-size:12px;color:#64748b">No pressure — your data is here whenever you're ready.</td></tr>
  `, 'Your MarketSync trial has ended.')

  if (!resend) return
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your MarketSync trial has ended`,
    html
  })
}

// ── Email 4: Payment Confirmed ────────────────────────────────────────────────
export async function sendPaymentConfirmed({ to, dealerName, addons, amountTotal, last4, nextBillingDate }) {
  const rows = [
    ...addons.map(a => ({
      label: a === 'ai_boost' ? 'AI Boost — monthly' : a === 'vin_sticker' ? 'VIN & Brochure — monthly' : 'AI Vision — monthly',
      value: `$${a === 'ai_boost' ? '199' : a === 'vin_sticker' ? '79' : '49'}.00`
    })),
    { label: 'HST (13%)', value: `$${(amountTotal * 0.13).toFixed(2)}` },
    { label: 'Total charged', value: `$${(amountTotal * 1.13).toFixed(2)} CAD`, total: true }
  ]

  const html = shell(`
    ${hero('Receipt', 'You\'re all set.', `Payment confirmed. Your add-ons are active and your next weekly health report lands Monday morning.`)}
    ${infoBar('#dcfce7', '#16a34a', '#14532d', `Payment confirmed · Visa ending ${last4 || '••••'}`, `Charged today · Next billing: ${nextBillingDate || 'next month'}`)}
    ${receiptTable(rows)}
    ${cta('Open Dashboard', 'https://marketsync.link/dashboard.html', '#1a2e4a')}
  `, 'Payment confirmed — your MarketSync add-ons are active.')

  if (!resend) return
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Payment confirmed — your add-ons are active`,
    html
  })
}

// ── Email 5: Payment Failed ───────────────────────────────────────────────────
export async function sendPaymentFailed({ to, dealerName, amountTotal, last4, retryDate }) {
  const html = shell(`
    ${hero('Billing Issue', 'We couldn\'t charge your card.', `Your renewal payment didn't go through. Update your payment method to keep access — we'll retry automatically. If not resolved within 7 days, your add-ons will be paused.`)}
    ${infoBar('#fee2e2', '#dc2626', '#7f1d1d', `Charge failed · Visa ending ${last4 || '••••'}`, `We'll retry ${retryDate ? `on ${retryDate}` : 'in 3 days'}`)}
    <tr><td style="padding:0 28px 20px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:16px;text-align:center;border-right:1px solid #e2e8f0">
            <div style="font-size:20px;font-weight:900;color:#dc2626;font-variant-numeric:tabular-nums">3</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;margin-top:3px">Retries left</div>
          </td>
          <td style="padding:16px;text-align:center;border-right:1px solid #e2e8f0">
            <div style="font-size:20px;font-weight:900;color:#d97706;font-variant-numeric:tabular-nums">7</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;margin-top:3px">Days to resolve</div>
          </td>
          <td style="padding:16px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#0f172a;font-variant-numeric:tabular-nums">$${(amountTotal * 1.13).toFixed(0)}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;margin-top:3px">Amount CAD</div>
          </td>
        </tr>
      </table>
    </td></tr>
    ${cta('Update Payment Method', 'https://marketsync.link/dashboard.html', '#dc2626')}
    <tr><td style="padding:0 28px 20px;font-size:12px;color:#64748b">Add-ons stay active while we retry. Access pauses after 7 days.</td></tr>
  `, 'Action required — we couldn\'t process your MarketSync payment.')

  if (!resend) return
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Action required: payment failed for your MarketSync subscription`,
    html
  })
}
