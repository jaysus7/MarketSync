// ─────────────────────────────────────────────────────────────────────────────
// MarketSync CRM — Automation Submodule: Morning & Weekly Briefings
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL } from '../../shared.js'
import { createNotification } from '../../notifications.js'
import { aiAllowed, recordUsage } from '../../usage.js'

const DEALER_LEVEL = ['DEALER_ADMIN', 'OWNER', 'MANAGER']

export function dealerSettings(dealer) {
  const s = (dealer?.automation_settings && typeof dealer.automation_settings === 'object') ? dealer.automation_settings : {}
  return {
    timezone: s.timezone || 'America/Toronto',
    business_start: Number.isFinite(s.business_start) ? s.business_start : 8,
    business_end: Number.isFinite(s.business_end) ? s.business_end : 19,
    house_sms: s.house_sms || null,
    house_email: s.house_email || dealer?.branding?.email || null,
    review_url: s.review_url || null,
    referral_bonus: s.referral_bonus || 'a referral bonus',
    service_url: s.service_url || (dealer?.branding?.email ? null : null),
    holidays: Array.isArray(s.holidays) ? s.holidays : [],
    digest_enabled: s.digest_enabled !== false,
    digest_email: s.digest_email === true,
    weekly_enabled: s.weekly_enabled !== false,
    weekly_email: s.weekly_email === true,
    weekly_day: Number.isInteger(s.weekly_day) && s.weekly_day >= 0 && s.weekly_day <= 6 ? s.weekly_day : 1,
    weekly_focus: typeof s.weekly_focus === 'string' ? s.weekly_focus.slice(0, 600) : null,
    enabled: s.enabled !== false,
    email: (s.email && typeof s.email === 'object') ? {
      from_name: s.email.from_name || null,
      from: s.email.from || null,
      reply_to: s.email.reply_to || null,
      sender_mode: ['house', 'rep', 'both'].includes(s.email.sender_mode) ? s.email.sender_mode : 'house',
      track_to_tasks: s.email.track_to_tasks !== false,
    } : { from_name: null, from: null, reply_to: null, sender_mode: 'house', track_to_tasks: true },
  }
}

export async function buildDigest(dealershipId) {
  const now = Date.now(), d = new Date()
  const nowIso = new Date().toISOString()
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
  const d7 = new Date(now - 7 * 86400000).toISOString()
  const d14 = new Date(now - 14 * 86400000).toISOString()
  const todayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US')

  const [uncontacted, overdue, appts, inv, soldDeals, mtdDeals, leads] = await Promise.all([
    supabaseAdmin.from('contacts').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('status', 'uncontacted'),
    supabaseAdmin.from('crm_tasks').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('done', false).lt('due_at', nowIso),
    supabaseAdmin.from('crm_tasks').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('done', false).eq('type', 'appointment').gte('due_at', nowIso).lte('due_at', todayEnd),
    supabaseAdmin.from('inventory').select('created_at, lot_date').eq('dealership_id', dealershipId).eq('status', 'available').limit(2000),
    supabaseAdmin.from('deals').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('deal_status', 'sold'),
    supabaseAdmin.from('deals').select('selling_price, sold_at, created_at, deal_status').eq('dealership_id', dealershipId).in('deal_status', ['sold', 'delivered']).gte('sold_at', monthStart).limit(1000),
    supabaseAdmin.from('leads').select('created_at').eq('dealership_id', dealershipId).gte('created_at', d14).limit(4000),
  ])
  const age = v => { const ref = v.lot_date || v.created_at; return ref ? Math.floor((now - new Date(ref)) / 86400000) : 0 }
  const aged90 = (inv.data || []).filter(v => age(v) >= 90).length
  const aged60 = (inv.data || []).filter(v => age(v) >= 60 && age(v) < 90).length
  const mtd = (mtdDeals.data || []).filter(x => (x.sold_at || x.created_at) >= monthStart)
  const leads7 = (leads.data || []).filter(l => l.created_at >= d7).length
  const leadsPrev7 = (leads.data || []).filter(l => l.created_at < d7).length

  const items = []
  if ((uncontacted.count || 0) > 0) items.push({ emoji: '📞', text: `${uncontacted.count} uncontacted lead(s) need a first touch`, priority: 'high' })
  if ((overdue.count || 0) > 0) items.push({ emoji: '⏰', text: `${overdue.count} overdue follow-up task(s)`, priority: 'high' })
  if (aged90 > 0) items.push({ emoji: '🚨', text: `${aged90} unit(s) 90+ days old — wholesale/auction candidates`, priority: 'high' })
  if (aged60 > 0) items.push({ emoji: '📉', text: `${aged60} unit(s) 60–90 days — consider a price drop`, priority: 'medium' })
  if ((appts.count || 0) > 0) items.push({ emoji: '📅', text: `${appts.count} appointment(s) booked for today`, priority: 'medium' })
  if ((soldDeals.count || 0) > 0) items.push({ emoji: '🚗', text: `${soldDeals.count} sold deal(s) awaiting delivery`, priority: 'medium' })
  const rank = { high: 0, medium: 1, low: 2 }
  items.sort((a, b) => rank[a.priority] - rank[b.priority])

  const leadDelta = leadsPrev7 ? Math.round(((leads7 - leadsPrev7) / leadsPrev7) * 100) : (leads7 ? 100 : 0)
  const pulse = {
    units_mtd: mtd.length,
    revenue_mtd: money(mtd.reduce((s, x) => s + (Number(x.selling_price) || 0), 0)),
    leads_7d: leads7,
    leads_delta_pct: leadDelta,
  }
  const headline = items.length
    ? `${items.length} thing(s) need attention — ${items.filter(i => i.priority === 'high').length} high priority`
    : 'You’re all caught up — lot, leads, recon and tasks are current.'
  return { items, pulse, headline, hasWork: items.length > 0 }
}

export function digestEmailHtml(dealerName, dg) {
  const arrow = dg.pulse.leads_delta_pct > 0 ? '▲' : dg.pulse.leads_delta_pct < 0 ? '▼' : '■'
  const rows = dg.items.length
    ? dg.items.map(i => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:15px;">${i.emoji} ${i.text}</td></tr>`).join('')
    : `<tr><td style="padding:14px 12px;font-size:15px;color:#16a34a;">✅ You’re all caught up.</td></tr>`
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <tr><td style="background:#1e3a8a;padding:18px 24px;color:#fff;">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">MarketSync · Morning Briefing</div>
      <div style="font-size:20px;font-weight:800;margin-top:2px;">${dealerName}</div>
      <div style="font-size:13px;opacity:.85;margin-top:2px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    </td></tr>
    <tr><td style="padding:18px 24px 6px;font-size:15px;color:#0f172a;font-weight:600;">${dg.headline}</td></tr>
    <tr><td style="padding:0 12px;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td style="padding:16px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;">
        <tr>
          <td style="padding:12px;text-align:center;border-right:1px solid #eef2f7;"><div style="font-size:22px;font-weight:800;color:#1e3a8a;">${dg.pulse.units_mtd}</div><div style="font-size:11px;color:#64748b;">units MTD</div></td>
          <td style="padding:12px;text-align:center;border-right:1px solid #eef2f7;"><div style="font-size:22px;font-weight:800;color:#1e3a8a;">${dg.pulse.revenue_mtd}</div><div style="font-size:11px;color:#64748b;">revenue MTD</div></td>
          <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1e3a8a;">${dg.pulse.leads_7d} <span style="font-size:13px;color:${dg.pulse.leads_delta_pct >= 0 ? '#16a34a' : '#dc2626'};">${arrow}${Math.abs(dg.pulse.leads_delta_pct)}%</span></div><div style="font-size:11px;color:#64748b;">leads last 7d</div></td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:6px 24px 22px;">
      <a href="${FRONTEND_URL}/dashboard.html" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;">Open MarketSync →</a>
    </td></tr>
  </table></td></tr></table></body></html>`
}

export async function runMorningDigest() {
  const { data: dealers } = await supabaseAdmin.from('dealerships').select('id, name, automation_settings')
  let pushed = 0, emailed = 0, skipped = 0
  for (const dl of (dealers || [])) {
    const s = dealerSettings(dl)
    if (!s.enabled || !s.digest_enabled) { skipped++; continue }
    const { data: mgrs } = await supabaseAdmin.from('profiles')
      .select('id, email, active').eq('dealership_id', dl.id).in('role', DEALER_LEVEL)
    const managers = (mgrs || []).filter(m => m.active !== false)
    if (!managers.length) { skipped++; continue }
    let dg
    try { dg = await buildDigest(dl.id) } catch { skipped++; continue }
    for (const m of managers) {
      await createNotification({
        dealershipId: dl.id, type: 'daily_digest', targetUserId: m.id,
        title: 'Your morning briefing', body: dg.headline, linkPage: 'command',
      })
      pushed++
    }
    if (s.digest_email) {
      const html = digestEmailHtml(dl.name || 'Your dealership', dg)
      const subject = `☀️ Morning briefing — ${dl.name || 'your store'} — ${dg.hasWork ? dg.headline : 'all caught up'}`
      for (const m of managers) {
        if (!m.email) continue
        try { await resend.emails.send({ from: EMAIL_FROM, to: m.email, subject, html }); emailed++ } catch (e) {}
      }
    }
  }
  return { pushed, emailed, skipped }
}

export async function buildWeeklyBriefing(dealershipId, focus) {
  const now = Date.now()
  const d7 = new Date(now - 7 * 86400000).toISOString()
  const d14 = new Date(now - 14 * 86400000).toISOString()
  const nowIso = new Date().toISOString()
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US')

  const [deals, leads, apprs, inv, uncontacted, overdue] = await Promise.all([
    supabaseAdmin.from('deals').select('selling_price, sold_at, created_at, deal_status').eq('dealership_id', dealershipId).in('deal_status', ['sold', 'delivered']).gte('sold_at', d14).limit(2000),
    supabaseAdmin.from('leads').select('created_at, source').eq('dealership_id', dealershipId).gte('created_at', d14).limit(8000),
    supabaseAdmin.from('trade_appraisals').select('created_at').eq('dealership_id', dealershipId).gte('created_at', d14).limit(2000),
    supabaseAdmin.from('inventory').select('created_at, lot_date').eq('dealership_id', dealershipId).eq('status', 'available').limit(3000),
    supabaseAdmin.from('contacts').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('status', 'uncontacted'),
    supabaseAdmin.from('crm_tasks').select('id', { count: 'exact', head: true }).eq('dealership_id', dealershipId).eq('done', false).lt('due_at', nowIso),
  ])
  const inWk = (arr, key) => (arr || []).filter(x => (x[key] || x.created_at) >= d7)
  const inPrev = (arr, key) => (arr || []).filter(x => { const t = x[key] || x.created_at; return t && t >= d14 && t < d7 })
  const soldWk = inWk(deals.data, 'sold_at'), soldPrev = inPrev(deals.data, 'sold_at')
  const leadsWk = inWk(leads.data), leadsPrev = inPrev(leads.data)
  const apprWk = inWk(apprs.data), apprPrev = inPrev(apprs.data)
  const revWk = soldWk.reduce((s, x) => s + (Number(x.selling_price) || 0), 0)
  const revPrev = soldPrev.reduce((s, x) => s + (Number(x.selling_price) || 0), 0)
  const age = v => { const ref = v.lot_date || v.created_at; return ref ? Math.floor((now - new Date(ref)) / 86400000) : 0 }
  const aged60 = (inv.data || []).filter(v => age(v) >= 60).length
  const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : (a ? 100 : 0)
  const srcCount = {}; for (const l of leadsWk) { const k = l.source || 'Unknown'; srcCount[k] = (srcCount[k] || 0) + 1 }
  const topSources = Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => `${s} (${n})`)

  const stats = {
    units: { wk: soldWk.length, prev: soldPrev.length, delta: pct(soldWk.length, soldPrev.length) },
    revenue: { wk: money(revWk), prev: money(revPrev), delta: pct(revWk, revPrev) },
    leads: { wk: leadsWk.length, prev: leadsPrev.length, delta: pct(leadsWk.length, leadsPrev.length) },
    appraisals: { wk: apprWk.length, prev: apprPrev.length, delta: pct(apprWk.length, apprPrev.length) },
    aged_60_plus: aged60, uncontacted: uncontacted.count || 0, overdue_tasks: overdue.count || 0,
    top_sources: topSources,
  }

  let narrative = null
  const { data: dealer } = await supabaseAdmin.from('dealerships').select('name, ai_boost_active, ai_internal_style').eq('id', dealershipId).maybeSingle()
  const isOwnerless = false
  if (process.env.ANTHROPIC_API_KEY && (dealer?.ai_boost_active) && await aiAllowed(dealershipId, isOwnerless)) {
    const facts = `Units sold: ${stats.units.wk} (prev ${stats.units.prev}, ${stats.units.delta >= 0 ? '+' : ''}${stats.units.delta}%). Revenue: ${stats.revenue.wk} (${stats.revenue.delta >= 0 ? '+' : ''}${stats.revenue.delta}%). New leads: ${stats.leads.wk} (${stats.leads.delta >= 0 ? '+' : ''}${stats.leads.delta}%). Appraisals: ${stats.appraisals.wk}. Units 60+ days: ${stats.aged_60_plus}. Uncontacted leads: ${stats.uncontacted}. Overdue tasks: ${stats.overdue_tasks}. Top lead sources: ${topSources.join(', ') || 'n/a'}.`
    const styleLine = dealer?.ai_internal_style ? ` Voice: ${dealer.ai_internal_style}.` : ''
    const focusLine = focus ? ` The GM specifically wants this to focus on: ${focus}.` : ''
    const prompt = `You are the GM's analyst writing this dealership's WEEKLY briefing. Write 3–4 short sentences: how the week went vs last week (lead with the trend), the single biggest win, and the top 1–2 things to fix or push next week. Be direct and specific with the numbers. No markdown, no headings, no greeting.${focusLine}${styleLine}\n\nThis week's data: ${facts}`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 20000)),
      ])
      narrative = (msg?.content?.[0]?.text || '').trim() || null
      if (narrative) recordUsage(dealershipId, { ai: 1 })
    } catch {}
  }
  if (!narrative) {
    const dir = stats.units.delta >= 0 ? 'up' : 'down'
    narrative = `${stats.units.wk} units and ${stats.revenue.wk} this week — sales ${dir} ${Math.abs(stats.units.delta)}% vs last week on ${stats.leads.wk} new leads. ${stats.uncontacted} uncontacted lead(s) and ${stats.overdue_tasks} overdue task(s) to clear; ${stats.aged_60_plus} unit(s) are 60+ days old and need a pricing decision.`
  }
  const headline = `${stats.units.wk} sold · ${stats.revenue.wk} · ${stats.leads.wk} leads this week`
  return { stats, narrative, headline, dealer_name: dealer?.name || 'Your dealership' }
}

export function weeklyEmailHtml(dealerName, wk) {
  const chip = (label, v, delta) => {
    const col = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#64748b'
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '■'
    return `<td style="padding:12px;text-align:center;border-right:1px solid #eef2f7;"><div style="font-size:22px;font-weight:800;color:#4338ca;">${v}</div><div style="font-size:11px;color:#64748b;">${label} <span style="color:${col};">${arrow}${Math.abs(delta)}%</span></div></td>`
  }
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <tr><td style="background:#4338ca;padding:18px 24px;color:#fff;">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">MarketSync · Weekly Briefing</div>
      <div style="font-size:20px;font-weight:800;margin-top:2px;">${dealerName}</div>
      <div style="font-size:13px;opacity:.85;margin-top:2px;">Week ending ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div>
    </td></tr>
    <tr><td style="padding:18px 24px 8px;font-size:15px;color:#0f172a;line-height:1.55;">${wk.narrative}</td></tr>
    <tr><td style="padding:8px 24px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;"><tr>
        ${chip('units', wk.stats.units.wk, wk.stats.units.delta)}
        ${chip('revenue', wk.stats.revenue.wk, wk.stats.revenue.delta)}
        ${chip('leads', wk.stats.leads.wk, wk.stats.leads.delta)}
        <td style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#4338ca;">${wk.stats.appraisals.wk}</div><div style="font-size:11px;color:#64748b;">appraisals</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 24px 8px;font-size:13px;color:#475569;">
      ${wk.stats.uncontacted} uncontacted · ${wk.stats.overdue_tasks} overdue tasks · ${wk.stats.aged_60_plus} units 60+ days
    </td></tr>
    <tr><td style="padding:10px 24px 22px;">
      <a href="${FRONTEND_URL}/dashboard.html" style="display:inline-block;background:#4338ca;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;">Open MarketSync →</a>
    </td></tr>
  </table></td></tr></table></body></html>`
}

export async function runWeeklyBriefing(force = false) {
  const today = new Date().getDay()
  const { data: dealers } = await supabaseAdmin.from('dealerships').select('id, name, automation_settings')
  let pushed = 0, emailed = 0, skipped = 0
  for (const dl of (dealers || [])) {
    const s = dealerSettings(dl)
    if (!s.enabled || !s.weekly_enabled) { skipped++; continue }
    if (!force && s.weekly_day !== today) { skipped++; continue }
    const { data: mgrs } = await supabaseAdmin.from('profiles').select('id, email, active').eq('dealership_id', dl.id).in('role', DEALER_LEVEL)
    const managers = (mgrs || []).filter(m => m.active !== false)
    if (!managers.length) { skipped++; continue }
    let wk
    try { wk = await buildWeeklyBriefing(dl.id, s.weekly_focus) } catch { skipped++; continue }
    for (const m of managers) {
      await createNotification({ dealershipId: dl.id, type: 'weekly_briefing', targetUserId: m.id, title: 'Your weekly briefing', body: wk.headline, linkPage: 'command' })
      pushed++
    }
    if (s.weekly_email) {
      const html = weeklyEmailHtml(dl.name || 'Your dealership', wk)
      const subject = `📊 Weekly briefing — ${dl.name || 'your store'} — ${wk.headline}`
      for (const m of managers) { if (!m.email) continue; try { await resend.emails.send({ from: EMAIL_FROM, to: m.email, subject, html }); emailed++ } catch {} }
    }
  }
  return { pushed, emailed, skipped, weekday: today }
}
