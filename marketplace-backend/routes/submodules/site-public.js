import { supabaseAdmin, resend, EMAIL_FROM, PUBLIC_SITE_ORIGIN } from '../../shared.js'
import { buildDealerSiteMetadata, renderDealerSiteHead } from '../../services/dealerSiteHeadService.js'
import { findOrCreateContact } from '../crm.js'
import { enqueueForTrigger } from '../automation.js'
import { routeAndNotifyLead } from '../../lead-routing.js'
import { createNotification } from '../../notifications.js'
import { rateLimit, randomToken } from '../../security.js'
import { resolveCampaignForVisit, inferSourceKey } from '../campaigns.js'
import { recordConsent } from '../consent.js'
import { runAutoResponder } from '../../autoresponder.js'
import { toolDefs, callTool } from '../tool-registry.js'
import { startOrContinueConversation, saveMessage } from '../ai-engine.js'
import { categorizeConversation, formatShownVehicles, summarizeConversation, verifyRecaptcha } from '../ai-runtime.js'
import { aiAllowed, recordUsage } from '../../usage.js'
import { offTopicRefusal, scopeClause, sanitizeTranscript, CHAT_LIMITS } from '../../chatGuard.js'

// Discovery settings live inside dealerships.branding, not as dealership columns.
// Asking PostgREST for the four branding keys as top-level columns makes the whole
// select fail; the old route then misreported that database error as "Site not found."
const SITE_COLS = 'id, name, branding, site_published, site_slug, custom_domain, city, province, postal_code, website_url, photo_background_url'

// Placed widgets & typography presets
const WIDGET_SLOTS = ['top_banner', 'hero_below', 'above_inventory', 'below_inventory', 'above_footer']
function cleanWidgets(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 40).map((w, i) => ({
    id: String(w.id || `w${i}_${Math.random().toString(36).slice(2, 7)}`),
    slot: WIDGET_SLOTS.includes(w.slot) ? w.slot : 'below_inventory',
    title: (w.title == null ? '' : String(w.title)).slice(0, 120) || null,
    html: (w.html == null ? '' : String(w.html)).slice(0, 20000),
    height: Math.min(2000, Math.max(60, parseInt(w.height) || 400)),
  })).filter(w => w.html.trim())
}

const SECTION_TYPES = ['hero', 'inventory', 'trade', 'finance', 'about', 'contact', 'map', 'reviews', 'text_media', 'banner', 'staff', 'hours', 'html']
function cleanSections(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 30).map((s, i) => {
    let settings = (s.settings && typeof s.settings === 'object') ? s.settings : {}
    try { if (JSON.stringify(settings).length > 12000) settings = {} } catch { settings = {} }
    return {
      id: String(s.id || `s${i}_${Math.random().toString(36).slice(2, 7)}`),
      type: SECTION_TYPES.includes(s.type) ? s.type : 'html',
      settings,
    }
  })
}
const TYPOGRAPHY = ['modern', 'luxury', 'bold', 'corporate', 'minimal']
const SITE_THEMES = ['classic', 'prestige', 'modern', 'bold', 'minimal']

function siteContent(d) {
  const b = d.branding || {}
  const discoveryTerms = (value) => (Array.isArray(value) ? value : String(value || '').split(','))
    .map(v => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 80))
    .filter((v, i, a) => v.length >= 2 && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(0, 40)
  return {
    name: d.name,
    slug: d.site_slug || null,
    custom_domain: d.custom_domain || null,
    city: d.city || null,
    province: d.province || null,
    logo_url: b.logo_url || null,
    primary_color: b.primary_color || '#1e3a8a',
    secondary_color: b.secondary_color || '#0f172a',
    about: b.about || null,
    seo_title: b.seo_title || null,
    seo_description: b.seo_description || null,
    seo_keywords: b.seo_keywords || null,
    seo_image: b.seo_image || null,
    hero_banner_url: b.hero_banner_url || null,
    phone: b.phone || d.branding?.phone || null,
    email: b.email || d.branding?.email || null,
    address: b.address || d.branding?.address || null,
    tagline: b.tagline || d.branding?.tagline || null,
    hours: b.hours || d.branding?.hours || null,
    socials: b.socials || d.branding?.socials || null,
    widgets: cleanWidgets(b.site_widgets),
    menu_order: Array.isArray(b.site_menu_order) ? b.site_menu_order : [],
    sections: cleanSections(b.site_sections),
    pages: Array.isArray(b.site_pages) ? b.site_pages : [],
    builtins: b.site_builtins && typeof b.site_builtins === 'object' ? b.site_builtins : {},
    typography: TYPOGRAPHY.includes(b.typography) ? b.typography : 'modern',
    theme: SITE_THEMES.includes(b.site_theme) ? b.site_theme : 'classic',
    heading_font: b.heading_font || null,
    body_font: b.body_font || null,
    hero_photos: !!b.hero_photos,
    accent_color: b.accent_color || null,
    sales_chat: !!b.site_sales_chat,
    chat_name: b.site_chat_name || null,
    chat_kb: b.site_chat_kb || null,
    chat_instructions: b.site_chat_instructions || null,
    chat_disclaimer: b.site_chat_disclaimer || null,
    discovery_summary: b.discovery_summary || null,
    discovery_terms: discoveryTerms(b.discovery_terms),
    discovery_intents: discoveryTerms(b.discovery_intents),
    discovery_enabled: b.discovery_enabled !== false,
  }
}

// Public semantic contract shared by SEO, the Discovery surface, and external
// discovery agents. It deliberately contains only public dealership data and
// uses the same live inventory payload as the rendered website.
function discoveryDocument(response) {
  const site = response.site || {}
  const base = site.custom_domain ? `https://${site.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : null
  const pages = Array.isArray(site.pages) ? site.pages.filter(p => p && p.nav !== false).map(p => ({
    title: p.title, slug: p.slug, url: p.slug ? `${base || ''}/site.html?d=${encodeURIComponent(site.slug || '')}#/` + p.slug : null,
    summary: p.seo_description || p.title, terms: [p.seo_keyword].filter(Boolean),
  })) : []
  const vehicles = (response.vehicles || []).map(v => ({
    id: v.id, title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
    make: v.make, model: v.model, year: v.year, condition: v.condition,
    price: v.price, mileage: v.mileage, url: `${base || ''}/site.html?d=${encodeURIComponent(site.slug || '')}#inventory/${encodeURIComponent(v.id)}`,
  }))
  return {
    version: '1.0', type: 'dealership-discovery', generated_at: new Date().toISOString(),
    canonical_site: base || (site.slug ? `/site.html?d=${encodeURIComponent(site.slug)}` : null),
    dealership: { name: site.name, city: site.city, province: site.province, address: site.address, phone: site.phone, hours: site.hours },
    summary: site.discovery_summary || site.about || site.tagline || null,
    terms: site.discovery_terms || [], intents: site.discovery_intents || [],
    pages, inventory: vehicles, counts: { inventory: vehicles.length, pages: pages.length },
  }
}

function marketStatus(v, contactStage) {
  const s = String(v.status || '').toLowerCase()
  const stage = String(contactStage || '').toLowerCase()
  if (s === 'sold' || stage === 'delivered') return 'delivered'
  if (s === 'pending' || stage === 'sold' || stage === 'fni' || stage === 'turnover') return 'pending'
  if (String(v.condition || '').toLowerCase() === 'demo') return 'demo'
  return 'available'
}

function publicVehicle(v) {
  const recallCount = Array.isArray(v.recalls) ? v.recalls.length : 0
  const marketState = marketStatus(v, v._stage)
  return {
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim,
    price: v.price, mileage: v.mileage, condition: v.condition,
    exterior_color: v.exterior_color, interior_color: v.interior_color,
    drivetrain: v.drivetrain, fuel_type: v.fuel_type, transmission: v.transmission,
    engine: v.engine, body_style: v.body_style, doors: v.doors,
    stocknumber: v.stocknumber, vin: v.vin,
    image_urls: Array.isArray(v.image_urls) ? v.image_urls : [],
    description: v.sales_pitch || v.description || null,
    specs_manual: v.specs_manual && typeof v.specs_manual === 'object' ? v.specs_manual : null,
    vin_data: v.vin_data && typeof v.vin_data === 'object' ? v.vin_data : null,
    carfax_url: v.carfax_url || null,
    window_sticker_url: v.window_sticker_oem_url || v.window_sticker_gen_url || v.window_sticker_url || null,
    brochure_url: v.brochure_oem_url || v.brochure_gen_url || v.brochure_url || null,
    recalls_count: recallCount,
    // Keep the public vehicle contract explicit for the shared card and VDP
    // renderer. These aliases preserve compatibility with older templates.
    recall_count: recallCount,
    recalls: recallCount ? v.recalls : [],
    status: marketState,
    market_status: marketState,
    has_possession: !v.awaiting_possession,
  }
}

async function buildSiteResponse(d) {
  const [{ data: inv }, { data: team }, { data: interests }] = await Promise.all([
    supabaseAdmin.from('inventory')
      .select('id, year, make, model, trim, price, mileage, condition, exterior_color, interior_color, drivetrain, fuel_type, transmission, engine, body_style, doors, stocknumber, vin, image_urls, description, carfax_url, window_sticker_url, window_sticker_oem_url, window_sticker_gen_url, brochure_url, brochure_oem_url, brochure_gen_url, recalls, vin_data, sales_pitch, specs_manual, status, created_at')
      .eq('dealership_id', d.id).is('archived_at', null).neq('status', 'sold')
      .or('awaiting_possession.is.null,awaiting_possession.eq.false')
      .order('created_at', { ascending: false }).limit(600),
    supabaseAdmin.from('profiles')
      .select('full_name, display_name, avatar_url, phone, role, hide_on_site, bio')
      .eq('dealership_id', d.id),
    supabaseAdmin.from('contacts')
      .select('interest_inventory_id, status')
      .eq('dealership_id', d.id).not('interest_inventory_id', 'is', null),
  ])
  const stageByVeh = {}
  const RANK = { delivered: 4, sold: 3, fni: 3, turnover: 3 }
  for (const c of (interests || [])) {
    const s = String(c.status || '').toLowerCase(); const r = RANK[s]; if (!r) continue
    const cur = stageByVeh[c.interest_inventory_id]
    if (!cur || r > cur.r) stageByVeh[c.interest_inventory_id] = { s, r }
  }
  const inventory = (inv || []).map(v => publicVehicle({ ...v, _stage: stageByVeh[v.id]?.s }))
  const publicTeam = (team || []).filter(p => !p.hide_on_site).map(p => ({
    name: p.full_name || p.display_name || 'Team member',
    role: p.role,
    avatar_url: p.avatar_url || null,
    bio: p.bio || null,
  }))
  return { site: siteContent(d), inventory, team: publicTeam }
}

const LUX_MAKES = new Set(['bmw', 'mercedes', 'mercedes-benz', 'audi', 'lexus', 'acura', 'infiniti', 'cadillac', 'lincoln', 'porsche', 'land rover', 'range rover', 'jaguar', 'volvo', 'tesla', 'genesis', 'maserati', 'bentley'])
const TRUCK_RE = /silverado|sierra|f-?150|f-?250|f-?350|\bram\b|ram\s?1500|tundra|titan|tahoe|suburban|yukon|expedition|sequoia|super\s?duty|colorado|canyon|ranger|tacoma|frontier/i
const numish = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null }

function heuristicTradeRange({ year, make, model, mileage }) {
  const now = new Date().getFullYear()
  const yr = numish(year)
  if (!yr || yr < 1990 || yr > now + 1) return null
  const age = Math.max(0, now - yr)
  const mk = String(make || '').toLowerCase().trim()
  const md = String(model || '')
  let base = 34000
  if (LUX_MAKES.has(mk)) base = 58000
  else if (TRUCK_RE.test(md) || TRUCK_RE.test(mk)) base = 52000
  let val = base
  for (let i = 0; i < age; i++) val *= (i === 0 ? 0.84 : 0.89)
  val = Math.max(val, base * 0.09)
  const mi = numish(mileage)
  if (mi != null) {
    const expected = Math.max(age, 1) * 18000
    const delta = (expected - mi) * 0.06
    val = Math.max(base * 0.06, val + Math.max(-val * 0.35, Math.min(val * 0.25, delta)))
  }
  const lo = Math.round((val * 0.88) / 250) * 250
  const hi = Math.round((val * 1.12) / 250) * 250
  if (hi <= 0 || lo <= 0) return null
  return { low: lo, high: hi }
}

function tradeVehicleFromFields(fields) {
  if (!fields || typeof fields !== 'object') return {}
  const pick = (...names) => {
    for (const [k, v] of Object.entries(fields)) {
      const key = k.toLowerCase().replace(/[^a-z]/g, '')
      if (names.includes(key) && v != null && String(v).trim()) return String(v).trim()
    }
    return null
  }
  return {
    year: pick('year', 'vehicleyear'),
    make: pick('make', 'vehiclemake'),
    model: pick('model', 'vehiclemodel'),
    trim: pick('trim', 'vehicletrim', 'series'),
    mileage: pick('mileage', 'kilometers', 'kilometres', 'km', 'miles', 'odometer'),
  }
}

export function registerSitePublicRoutes(app) {
  app.get('/site/:slug', rateLimit('pub-site', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).json({ error: 'Not found' })
    const { data: d, error } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
    if (error) {
      console.error('[site-public] published site lookup failed:', error.message)
      return res.status(503).json({ error: 'Site is temporarily unavailable' })
    }
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    res.json(await buildSiteResponse(d))
  })

  // Server-rendered <head> metadata for the public site shell.
  //
  // site.html injects its title/description/canonical/schema with JavaScript, so every
  // crawler that does not execute JS sees the placeholder <title>Inventory</title> and
  // nothing else. This endpoint exposes the real metadata, computed from the same
  // published payload the client renders from, so an edge worker (or an origin serving
  // the shell) can put it in the HTML before it reaches a crawler.
  app.get('/site/:slug/head-metadata', rateLimit('pub-site-head', 240, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).json({ error: 'Not found' })
    const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    const response = await buildSiteResponse(d)
    const metadata = buildDealerSiteMetadata(response.site, { publicSiteOrigin: PUBLIC_SITE_ORIGIN })
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.json({ ...metadata, head_html: renderDealerSiteHead(metadata) })
  })

  // Custom-domain twin of /site/:slug/head-metadata, mirroring how /site-by-domain
  // pairs with /site/:slug. A dealer site served from its own domain has no slug in
  // the URL, so the edge resolves it by hostname instead.
  app.get('/site-head-metadata', rateLimit('pub-site-head-domain', 240, 60000), async (req, res) => {
    const host = String(req.query.host || '').toLowerCase().trim().replace(/^www\./, '').replace(/:\d+$/, '')
    if (!host) return res.status(404).json({ error: 'Not found' })
    const { data: d, error } = await supabaseAdmin.from('dealerships').select(SITE_COLS)
      .or(`custom_domain.ilike.${host},custom_domain.ilike.www.${host}`).maybeSingle()
    if (error) {
      console.error('[site-public] custom-domain lookup failed:', error.message)
      return res.status(503).json({ error: 'Site is temporarily unavailable' })
    }
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    const response = await buildSiteResponse(d)
    const metadata = buildDealerSiteMetadata(response.site, { publicSiteOrigin: PUBLIC_SITE_ORIGIN })
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.json({ ...metadata, head_html: renderDealerSiteHead(metadata) })
  })

  // Machine-readable Discovery surface. SEO and Discovery consume the same
  // canonical payload instead of maintaining separate keyword/page inventories.
  app.get('/site/:slug/discovery', rateLimit('pub-site-discovery', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    const response = await buildSiteResponse(d)
    if (response.site.discovery_enabled === false) return res.status(404).json({ error: 'Discovery is disabled for this site' })
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.json(discoveryDocument(response))
  })

  app.get('/site-by-domain', rateLimit('pub-site-domain', 120, 60000), async (req, res) => {
    const host = String(req.query.host || '').toLowerCase().trim().replace(/^www\./, '').replace(/:\d+$/, '')
    if (!host) return res.status(404).json({ error: 'Not found' })
    const { data: d, error } = await supabaseAdmin.from('dealerships').select(SITE_COLS)
      .or(`custom_domain.ilike.${host},custom_domain.ilike.www.${host}`).maybeSingle()
    if (error) {
      console.error('[site-public] public custom-domain lookup failed:', error.message)
      return res.status(503).json({ error: 'Site is temporarily unavailable' })
    }
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    res.json(await buildSiteResponse(d))
  })

  app.post('/site/:slug/lead', rateLimit('sitelead', 8, 60 * 1000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const { data: d } = await supabaseAdmin.from('dealerships')
      .select('id, site_published').ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    if (!(await verifyRecaptcha(req.body?.recaptcha_token))) return res.status(403).json({ error: 'recaptcha_failed' })
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 120)
    const email = String(b.email || '').trim().slice(0, 160)
    const phone = String(b.phone || '').trim().slice(0, 40)
    const message = String(b.message || '').trim().slice(0, 2000)
    if (!name && !email && !phone) return res.status(400).json({ error: 'Enter a name, phone, or email' })

    const FORMS = { trade: 'Trade-In', credit: 'Credit Application', inquiry: 'Website', build: 'Build & Price', chat: 'Website Chat', reserve: 'Reserve / Deposit', payment: 'Payment Quote' }
    const source = FORMS[String(b.form_type || '').toLowerCase()] || 'Website'
    let comments = message
    if (b.fields && typeof b.fields === 'object') {
      const extra = Object.entries(b.fields)
        .filter(([, v]) => v != null && String(v).trim())
        .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`).join('\n').slice(0, 3000)
      if (extra) comments = [message, `— ${source} details —`, extra].filter(Boolean).join('\n')
    }

    let inventory_id = null
    if (b.vehicle_id) {
      const { data: v } = await supabaseAdmin.from('inventory').select('id, dealership_id').eq('id', b.vehicle_id).maybeSingle()
      if (v && v.dealership_id === d.id) inventory_id = v.id
    }
    // Attribution, at the front door. PR 6.1 gave leads a campaign_id and a source_key and
    // nothing has ever written either from the website — so every website lead has attributed
    // as INFERRED, and the campaign that paid for the click was dropped on arrival.
    //
    // A campaign is linked only by its own id (`?c=<uuid>`), never by matching a utm_campaign
    // string against campaign names — that is the defect 6.1 removed.
    const campaignId = await resolveCampaignForVisit(d.id, b.campaign_id || b.c)
    const sourceKey = inferSourceKey(b.utm_source || b.referrer_source || source) || 'website'

    try {
      const { data: lead } = await supabaseAdmin.from('leads').insert({
        dealership_id: d.id, name: name || null, email: email || null, phone: phone || null,
        comments: comments || null, source, inventory_id,
        campaign_id: campaignId, source_key: sourceKey,
      }).select('id').single()
      const contactId = await findOrCreateContact({ dealershipId: d.id, name, email, phone, source: 'Website' })
      if (contactId && lead?.id) await supabaseAdmin.from('leads').update({ contact_id: contactId }).eq('id', lead.id)
      if (contactId) {
        // Carry the attribution onto the customer too, so a deal made a month later still
        // knows which campaign brought them. Only ever fills a blank — a customer's FIRST
        // campaign is the one that earned them, and a later visit must not overwrite it.
        try {
          const patch = {}
          if (campaignId) patch.campaign_id = campaignId
          if (sourceKey) patch.source_key = sourceKey
          if (Object.keys(patch).length) {
            await supabaseAdmin.from('contacts').update(patch)
              .eq('id', contactId).eq('dealership_id', d.id).is('campaign_id', null)
          }
        } catch (e) { console.error('[site-lead] attribution not carried to contact:', e.message) }

        // A customer who typed their phone number into a dealership's form and asked to be
        // contacted has given more than implied consent. Until now nothing recorded that, so
        // every one of them resolved as the weakest basis there is. Evidence is the point:
        // what they submitted, from where, when.
        const channels = [email ? 'email' : null, phone ? 'sms' : null, phone ? 'phone' : null].filter(Boolean)
        if (channels.length) {
          await recordConsent(d.id, contactId, channels, {
            source: 'web_form',
            ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
            userAgent: req.get('user-agent'),
            evidence: { form_type: String(b.form_type || 'inquiry'), slug, submitted_at: new Date().toISOString() },
          })
        }
        const routed = await routeAndNotifyLead(d.id, { contactId, vehicleId: inventory_id || null, name, source: source })
        enqueueForTrigger(d.id, 'internet_lead', { contactId, vehicleId: inventory_id || null, repId: routed?.assignee || null })
        runAutoResponder(d.id, { contactId, name, email, phone, source, vehicleId: inventory_id || null, repId: routed?.assignee || null }).catch(() => {})

        if (String(b.form_type || '').toLowerCase() === 'trade') {
          const tv = tradeVehicleFromFields(b.fields)
          const range = heuristicTradeRange(tv)
          if (range) {
            const veh = [tv.year, tv.make, tv.model, tv.trim].filter(Boolean).join(' ').trim() || 'their trade'
            const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US')
            const rangeStr = `${fmt(range.low)}–${fmt(range.high)}`
            try {
              await supabaseAdmin.from('communications').insert({
                dealership_id: d.id, contact_id: contactId, channel: 'note', direction: 'internal',
                subject: 'Trade ballpark heuristic',
                body: `Estimated trade-in ballpark for ${veh}: ${rangeStr}\n\nThis is a rough heuristic. Open the contact in MarketSync to run a live market appraisal.`,
                meta: { kind: 'trade_ballpark', vehicle: tv, range },
              })
            } catch (err) { console.warn('[site] trade note failed:', err.message) }
          }
        }

        if (Array.isArray(b.transcript) && b.transcript.length) {
          try {
            const tx = b.transcript
              .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
              .slice(-60).map(m => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
            if (tx.length) {
              await supabaseAdmin.from('communications').insert({
                dealership_id: d.id, contact_id: contactId, channel: 'chat', direction: 'in',
                subject: 'Website AI chat',
                body: `AI website chat — ${tx.length} message${tx.length === 1 ? '' : 's'}. Open to read the full conversation.`,
                meta: { kind: 'ai_chat', source: 'website', transcript: tx },
              })
            }
          } catch (err) { console.warn('[site] chat transcript save failed:', err.message) }
        }

        if (String(b.form_type || '').toLowerCase() === 'reserve') {
          await createNotification({
            dealershipId: d.id, type: 'new_lead',
            title: `Reserve request${name ? ': ' + name : ''}`,
            body: `A shopper wants to reserve a vehicle online — follow up fast to take the deposit.`,
            linkPage: 'crm', targetUserId: routed?.assignee || null,
          })
        }
      }
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/site/:slug/book', rateLimit('sitebook', 12, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const { data: d } = await supabaseAdmin.from('dealerships').select('id, name, branding, site_published, city, province').ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    if (!(await verifyRecaptcha(req.body?.recaptcha_token))) return res.status(403).json({ error: 'recaptcha_failed' })
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 120)
    const email = String(b.email || '').trim().slice(0, 160)
    const phone = String(b.phone || '').trim().slice(0, 40)
    const notes = String(b.notes || b.message || '').trim().slice(0, 1000)
    if (!name || (!email && !phone)) return res.status(400).json({ error: 'Add your name and an email or phone.' })
    const when = new Date(b.when)
    if (isNaN(when.getTime())) return res.status(400).json({ error: 'Pick a valid date and time.' })
    if (when.getTime() < Date.now() + 15 * 60 * 1000) return res.status(400).json({ error: 'Please choose a time at least 15 minutes out.' })
    if (when.getTime() > Date.now() + 120 * 86400000) return res.status(400).json({ error: 'Please choose a time within the next few months.' })
    const durationMin = 30
    const kind = String(b.kind || 'Test drive').slice(0, 40)

    let inventory_id = null, vehicleLabel = ''
    if (b.vehicle_id) {
      const { data: v } = await supabaseAdmin.from('inventory').select('id, dealership_id, year, make, model, trim').eq('id', b.vehicle_id).maybeSingle()
      if (v && v.dealership_id === d.id) { inventory_id = v.id; vehicleLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') }
    }
    const endAt = new Date(when.getTime() + durationMin * 60000)
    const whenLabel = (() => { try { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: b.tz || 'America/Toronto' }).format(when) } catch { return when.toISOString() } })()
    // The room URL is the ONLY thing keeping a stranger out of a customer's appointment.
    const rand = randomToken(12)
    const meetUrl = `https://meet.jit.si/${(d.name || 'dealer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'dealer'}-${rand}`
    const campaignId = await resolveCampaignForVisit(d.id, b.campaign_id || b.c)
    const sourceKey = inferSourceKey(b.utm_source || b.referrer_source || 'Website') || 'website'

    try {
      const { data: lead } = await supabaseAdmin.from('leads').insert({
        dealership_id: d.id, name: name || null, email: email || null, phone: phone || null,
        comments: `${kind} booked for ${whenLabel}${vehicleLabel ? ' — ' + vehicleLabel : ''}${notes ? ' · ' + notes : ''}`, source: 'Website', inventory_id,
        campaign_id: campaignId, source_key: sourceKey,
      }).select('id').single()
      const contactId = await findOrCreateContact({ dealershipId: d.id, name, email, phone, source: 'Website' })
      if (contactId && lead?.id) await supabaseAdmin.from('leads').update({ contact_id: contactId }).eq('id', lead.id)
      if (contactId) {
        const attribution = {}
        if (campaignId) attribution.campaign_id = campaignId
        if (sourceKey) attribution.source_key = sourceKey
        if (Object.keys(attribution).length) await supabaseAdmin.from('contacts').update(attribution)
          .eq('id', contactId).eq('dealership_id', d.id).is('campaign_id', null)
      }
      const routed = await routeAndNotifyLead(d.id, { contactId, vehicleId: inventory_id || null, name, source: 'Website' })
      const repId = routed?.assignee || null
      await supabaseAdmin.from('contacts').update({ status: 'appointment', updated_at: new Date().toISOString() }).eq('id', contactId)
      await supabaseAdmin.from('crm_tasks').insert({
        dealership_id: d.id, contact_id: contactId, assigned_to: repId, created_by: repId,
        title: `${kind} — ${name}${vehicleLabel ? ' — ' + vehicleLabel : ''}`, type: 'appointment', due_at: when.toISOString(),
      })
      await supabaseAdmin.from('communications').insert({
        dealership_id: d.id, contact_id: contactId, channel: 'note', direction: 'internal',
        subject: `${kind} booked`, body: `${whenLabel} (${durationMin} min)${vehicleLabel ? '\nVehicle: ' + vehicleLabel : ''}\nVideo: ${meetUrl}${notes ? '\nNotes: ' + notes : ''}`,
        meta: { kind: 'appointment', meet_url: meetUrl, when: when.toISOString(), duration_min: durationMin },
      })
      enqueueForTrigger(d.id, 'appointment_booked', { contactId, vehicleId: inventory_id || null, repId })
      await createNotification({
        dealershipId: d.id, type: 'new_lead', title: `📅 ${kind} booked — ${name}`,
        body: `${whenLabel}${vehicleLabel ? ' · ' + vehicleLabel : ''}. Confirm with the customer.`, linkPage: 'appointments', targetUserId: repId,
      })

      if (resend) {
        const gS = when.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), gE = endAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(kind + ' — ' + d.name)}&dates=${gS}/${gE}&details=${encodeURIComponent((vehicleLabel ? vehicleLabel + '\n' : '') + 'Join: ' + meetUrl)}`
        const btn = (h, l, bg) => `<a href="${h}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px;margin:4px 6px 4px 0">${l}</a>`
        const shell = (heading, intro) => `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto"><div style="background:#1e3a8a;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><div style="font-size:19px;font-weight:800">${heading}</div></div><div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px"><p style="font-size:15px;color:#0f172a;margin:0 0 12px">${intro}</p><table style="width:100%;font-size:14px;color:#334155"><tr><td style="padding:6px 0;color:#64748b;width:90px">When</td><td style="padding:6px 0;font-weight:700">${whenLabel}</td></tr>${vehicleLabel ? `<tr><td style="padding:6px 0;color:#64748b">Vehicle</td><td style="padding:6px 0">${vehicleLabel}</td></tr>` : ''}<tr><td style="padding:6px 0;color:#64748b">Video</td><td style="padding:6px 0"><a href="${meetUrl}" style="color:#1e3a8a;font-weight:700">${meetUrl}</a></td></tr></table><div style="margin-top:16px">${btn(meetUrl, '▶ Join', '#16a34a')}${btn(gcal, '+ Add to calendar', '#1e3a8a')}</div></div></div>`
        if (email) resend.emails.send({ from: EMAIL_FROM, to: email, subject: `Your ${kind.toLowerCase()} at ${d.name} — ${whenLabel}`, html: shell(`${kind} confirmed`, `Thanks ${name.split(' ')[0] || ''}! We've got you down for a ${kind.toLowerCase()}. See you then.`) }).catch(() => {})
        const inboxes = new Set()
        const house = d.branding?.email || d.automation_settings?.house_email
        if (house) inboxes.add(String(house).toLowerCase())
        if (repId) { const { data: rp } = await supabaseAdmin.from('profiles').select('email').eq('id', repId).maybeSingle(); if (rp?.email) inboxes.add(rp.email.toLowerCase()) }
        for (const to of inboxes) resend.emails.send({ from: EMAIL_FROM, to, subject: `New ${kind.toLowerCase()} booked — ${name} — ${whenLabel}`, html: shell(`New ${kind.toLowerCase()} booked`, `${name} booked a ${kind.toLowerCase()}${vehicleLabel ? ` for the ${vehicleLabel}` : ''}. It's on the calendar.${notes ? `<br><br><b>Notes:</b> ${notes}` : ''}`) }).catch(() => {})
      }
      res.json({ ok: true, when: when.toISOString(), meet_url: meetUrl })
    } catch (e) {
      console.warn('[site] booking failed:', e.message)
      res.status(500).json({ error: 'Could not book that time — please try again.' })
    }
  })

  // ── SERVER-RENDERED HTML: Homepage with SEO metadata ────────────────────────
  function escapeJson(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  }

  function escapeJsonString(str) {
    if (!str) return ''
    return JSON.stringify(String(str))
  }

  function escapeHtml(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escapeUrlAttribute(url) {
    if (!url) return ''
    const str = String(url)
    if (!/^https?:\/\/|^\/|^data:/.test(str)) return ''
    return escapeHtml(str)
  }

  function generateHtmlPage({ site, inventory, team, title, description, imageUrl, canonical, dealer }) {
    const siteUrl = site.custom_domain ? `https://${site.custom_domain}` : `https://marketsync.link/site/${site.slug}`
    const ogImage = imageUrl || site.seo_image || site.hero_banner_url || `${siteUrl}/og-image.png`
    const escapedSiteData = escapeJson({ site, inventory, team })

    const safeSiteUrl = escapeHtml(siteUrl)
    const safeCanonical = escapeHtml(canonical || siteUrl)
    const safeTitle = escapeHtml(title || site.name || 'Dealer')
    const safeDescription = escapeHtml(description || site.seo_description || site.about || site.tagline || 'Welcome to our dealership')
    const safeImage = escapeUrlAttribute(ogImage)
    const safeKeywords = escapeHtml(site.seo_keywords ? site.seo_keywords.split(',').join(', ') : (site.discovery_terms || []).join(', '))
    const safeSiteName = escapeHtml(site.name)
    const safeSitePhone = escapeHtml(site.phone || '')
    const safeSiteEmail = escapeHtml(site.email || '')
    const safeSiteAddress = escapeHtml(site.address || '')
    const safeSiteCity = escapeHtml(site.city || '')
    const safeSiteProvince = escapeHtml(site.province || '')
    const safeSitePostalCode = escapeHtml(dealer?.postal_code || '')
    const safeSiteLogo = escapeUrlAttribute(site.logo_url || ogImage)
    const safePrimaryColor = escapeHtml(site.primary_color || '#1e3a8a')
    const safeFacebookUrl = escapeUrlAttribute(site.facebook_url || '')
    const safeInstagramUrl = escapeUrlAttribute(site.instagram_url || '')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta name="keywords" content="${safeKeywords}">

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safeCanonical}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${safeCanonical}">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": site.name || 'Dealer',
    "image": site.logo_url || ogImage,
    "url": siteUrl,
    ...(site.phone ? { "telephone": site.phone } : {}),
    ...(site.email ? { "email": site.email } : {}),
    ...(site.address ? {
      "address": {
        "@type": "PostalAddress",
        "streetAddress": site.address,
        "addressLocality": site.city || '',
        "addressRegion": site.province || '',
        "postalCode": dealer?.postal_code || ''
      }
    } : {}),
    "priceRange": "$",
    "@type": ["LocalBusiness", "AutoDealer"],
    ...(site.facebook_url || site.instagram_url ? {
      "sameAs": [site.facebook_url, site.instagram_url].filter(Boolean)
    } : {})
  }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
  </script>

  <!-- Site Configuration (used by client-side renderer) -->
  <script id="site-config" type="application/json">
  ${escapedSiteData}
  </script>

  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="theme-color" content="${safePrimaryColor}">
  <link rel="icon" href="${safeSiteLogo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚗</text></svg>'}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fff; }
    html { scroll-behavior: smooth; }
    noscript { display: block; padding: 20px; background: #fee2e2; color: #991b1b; text-align: center; }
  </style>
  <link rel="stylesheet" href="/assets/public-shell.css">
</head>
<body>
  <noscript>This website requires JavaScript to be enabled. Please enable JavaScript in your browser settings.</noscript>

  <!-- Server-rendered homepage content -->
  <main role="main" style="max-width: 1200px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="margin-bottom: 40px;">
      <h1 style="font-size: 32px; color: #0f172a; margin-bottom: 10px;">${safeSiteName}</h1>
      <p style="font-size: 16px; color: #666; margin-bottom: 20px;">${safeDescription}</p>
      ${safeSitePhone ? `<p style="font-size: 14px; color: #666;"><a href="tel:${safeSitePhone.replace(/\D/g, '')}" style="color: ${safePrimaryColor}; text-decoration: none; font-weight: 600;">${safeSitePhone}</a></p>` : ''}
    </div>

    <section style="margin-top: 40px;">
      <h2 style="font-size: 24px; color: #0f172a; margin-bottom: 20px; border-bottom: 3px solid ${safePrimaryColor}; padding-bottom: 10px;">Inventory (${inventory ? inventory.length : 0} Vehicles)</h2>

      ${inventory && inventory.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px;">
          ${inventory.slice(0, 12).map(v => `
            <article style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; transition: box-shadow 0.3s ease;">
              <div style="background: #f8fafc; padding: 16px; min-height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border-bottom: 1px solid #e2e8f0;">
                <p style="font-size: 32px; margin: 0;">🚗</p>
                <p style="font-size: 12px; color: #999; margin: 8px 0 0;">${v.photos && v.photos[0] ? 'Photo available' : 'No photo'}</p>
              </div>
              <div style="padding: 16px;">
                <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px;"><a href="${escapeUrlAttribute(siteUrl + '/inventory/' + encodeURIComponent(v.id))}" style="color: inherit; text-decoration: none;">${escapeHtml(String(v.year || ''))} ${escapeHtml(v.make || '')} ${escapeHtml(v.model || '')}</a></h3>
                ${v.trim ? `<p style="font-size: 13px; color: #666; margin-bottom: 6px;">${escapeHtml(v.trim)}</p>` : ''}
                ${v.mileage ? `<p style="font-size: 13px; color: #666; margin-bottom: 6px;">${escapeHtml(String(v.mileage))} km</p>` : ''}
                ${v.price ? `<p style="font-size: 18px; font-weight: 700; color: ${safePrimaryColor}; margin-top: 12px;">$${Number(v.price).toLocaleString('en-CA')}</p>` : ''}
                <a href="${escapeUrlAttribute(siteUrl + '/inventory/' + encodeURIComponent(v.id))}" style="display: block; margin-top: 12px; padding: 8px 12px; background: ${safePrimaryColor}; color: white; text-align: center; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">View Details</a>
              </div>
            </article>
          `).join('')}
        </div>
        ${inventory.length > 12 ? `<p style="text-align: center; margin-top: 30px; color: #666;">+ ${inventory.length - 12} more vehicles available</p>` : ''}
      ` : `
        <p style="color: #999; text-align: center; padding: 40px 0;">No vehicles in inventory at this time. Please check back soon.</p>
      `}
    </section>
  </main>

  <!-- Client-side rendering mount point -->
  <div id="root"></div>

  <script src="/assets/public-shell.js"></script>
  <script>
    // Boot the client-side renderer with the server-provided site config
    if (window.PublicSiteRenderer) {
      const config = document.getElementById('site-config');
      const data = config ? JSON.parse(config.textContent) : {};
      window.PublicSiteRenderer.init(data);
    }
  </script>
</body>
</html>`
  }

  // Server-rendered homepage with SEO metadata
  app.get('/site/:slug/index.html', rateLimit('pub-site-html', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) return res.status(404).send('Site not found')

      const siteData = await buildSiteResponse(d)
      const canonical = d.custom_domain ? `https://${d.custom_domain}/` : `https://marketsync.link/site/${slug}/`

      res.set('Content-Type', 'text/html; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
      res.send(generateHtmlPage({
        site: siteData.site,
        inventory: siteData.inventory,
        team: siteData.team,
        title: siteData.site.seo_title || `${siteData.site.name} - Cars for Sale`,
        description: siteData.site.seo_description || `${siteData.site.name} - ${siteData.inventory.length} vehicles in stock`,
        imageUrl: siteData.site.seo_image,
        canonical,
        dealer: d,
      }))
    } catch (e) {
      console.error('[site-html]', e.message)
      res.status(500).send('Error loading website')
    }
  })

  // Alternate: serve at /site/:slug/ (redirect or direct render)
  app.get('/site/:slug/', rateLimit('pub-site-html', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) return res.status(404).send('Site not found')

      const siteData = await buildSiteResponse(d)
      const canonical = d.custom_domain ? `https://${d.custom_domain}/` : `https://marketsync.link/site/${slug}/`

      res.set('Content-Type', 'text/html; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
      res.send(generateHtmlPage({
        site: siteData.site,
        inventory: siteData.inventory,
        team: siteData.team,
        title: siteData.site.seo_title || `${siteData.site.name} - Cars for Sale`,
        description: siteData.site.seo_description || `${siteData.site.name} - ${siteData.inventory.length} vehicles in stock`,
        imageUrl: siteData.site.seo_image,
        canonical,
        dealer: d,
      }))
    } catch (e) {
      console.error('[site-html]', e.message)
      res.status(500).send('Error loading website')
    }
  })

  // Sitemap endpoint for search engines
  app.get('/site/:slug/sitemap.xml', rateLimit('pub-site-sitemap', 60, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) return res.status(404).send('Not found')

      const base = d.custom_domain ? `https://${d.custom_domain}` : `https://marketsync.link/site/${slug}`
      const siteData = await buildSiteResponse(d)
      const now = new Date().toISOString().split('T')[0]

      const urls = [
        `<url><loc>${base}/</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${base}/inventory/</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
        ...(siteData.inventory || []).slice(0, 10000).map(v =>
          `<url><loc>${base}/inventory/${encodeURIComponent(v.id)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
        ),
      ].join('\n')

      res.set('Content-Type', 'application/xml; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`)
    } catch (e) {
      console.error('[sitemap]', e.message)
      res.status(500).send('Error generating sitemap')
    }
  })

  // robots.txt for published sites
  app.get('/site/:slug/robots.txt', rateLimit('pub-site-robots', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select('site_published').ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) {
        res.set('Content-Type', 'text/plain; charset=utf-8')
        res.send('User-agent: *\nDisallow: /')
        return
      }

      const base = `https://marketsync.link/site/${slug}`
      res.set('Content-Type', 'text/plain; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=86400')
      res.send(`User-agent: *
Allow: /

Disallow: /admin
Disallow: /api
Disallow: /internal

Sitemap: ${base}/sitemap.xml`)
    } catch (e) {
      res.status(404).send('Not found')
    }
  })

  // ── BATCH 5: Vehicle Detail Page (VDP) ────────────────────────────────────
  function generateVehicleDetailPage({ vehicle, site, title, description, imageUrl, canonical, dealer }) {
    const siteUrl = site.custom_domain ? `https://${site.custom_domain}` : `https://marketsync.link/site/${site.slug}`
    const ogImage = imageUrl || (vehicle.photos && vehicle.photos[0]) || site.seo_image || `${siteUrl}/og-image.png`

    const safeCanonical = escapeHtml(canonical)
    const safeTitle = escapeHtml(title)
    const safeDescription = escapeHtml(description)
    const safeImage = escapeUrlAttribute(ogImage)
    const safeKeywords = escapeHtml(`${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}, ${site.name || 'Dealer'}`)

    const safeSiteName = escapeHtml(site.name)
    const safeSitePhone = escapeHtml(site.phone || '')
    const safeVehicleYear = escapeHtml(String(vehicle.year || ''))
    const safeVehicleMake = escapeHtml(vehicle.make || '')
    const safeVehicleModel = escapeHtml(vehicle.model || '')
    const safeVehicleTrim = escapeHtml(vehicle.trim || '')
    const safeVehicleColor = escapeHtml(vehicle.color || '')
    const safeVehicleMileage = escapeHtml(String(vehicle.mileage || ''))
    const safeVehiclePrice = escapeHtml(String(vehicle.price || ''))
    const safeVehicleVin = escapeHtml(vehicle.vin || '')
    const safeVehicleBody = escapeHtml(vehicle.body_type || '')
    const safeVehicleTransmission = escapeHtml(vehicle.transmission || '')
    const safeVehicleEngineSize = escapeHtml(vehicle.engine_size || '')
    const safeSiteLogo = escapeUrlAttribute(site.logo_url)
    const safePrimaryColor = escapeHtml(site.primary_color || '#1e3a8a')

    const vehicleSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}${vehicle.trim ? ' ' + vehicle.trim : ''}`,
      "description": description,
      "image": ogImage,
      "sku": vehicle.vin || vehicle.id,
      ...(vehicle.price ? {
        "offers": {
          "@type": "Offer",
          "url": canonical,
          "priceCurrency": "CAD",
          "price": String(vehicle.price),
          "availability": "https://schema.org/InStock"
        }
      } : {}),
      ...(vehicle.mileage ? { "mileageFromOdometer": vehicle.mileage } : {}),
      ...(vehicle.year ? { "productionDate": `${vehicle.year}-01-01` } : {}),
    }

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Inventory",
          "item": `${siteUrl}/inventory/`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`,
          "item": canonical
        }
      ]
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta name="keywords" content="${safeKeywords}">

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="product">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safeCanonical}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${safeCanonical}">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  ${JSON.stringify(vehicleSchema)}
  </script>

  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema)}
  </script>

  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="theme-color" content="${safePrimaryColor}">
  <link rel="icon" href="${safeSiteLogo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚗</text></svg>'}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fff; }
    html { scroll-behavior: smooth; }
    noscript { display: block; padding: 20px; background: #fee2e2; color: #991b1b; text-align: center; }
  </style>
  <link rel="stylesheet" href="/assets/public-shell.css">
</head>
<body>
  <noscript>This website requires JavaScript to be enabled. Please enable JavaScript in your browser settings.</noscript>

  <!-- Server-rendered vehicle detail content -->
  <main role="main" style="max-width: 1200px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <nav aria-label="Breadcrumb" style="margin-bottom: 20px; font-size: 14px; color: #666;">
      <a href="${escapeUrlAttribute(siteUrl)}" style="text-decoration: none; color: #1e3a8a;">Home</a>
      &gt;
      <a href="${escapeUrlAttribute(siteUrl + '/inventory/')}" style="text-decoration: none; color: #1e3a8a;">Inventory</a>
      &gt;
      <span>${safeVehicleYear} ${safeVehicleMake} ${safeVehicleModel}</span>
    </nav>

    <h1 style="font-size: 28px; margin-bottom: 10px; color: #0f172a;">${safeVehicleYear} ${safeVehicleMake} ${safeVehicleModel} ${safeVehicleTrim}</h1>
    <p style="font-size: 16px; color: #666; margin-bottom: 30px;">${description}</p>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-top: 30px;">
      <div>
        <h2 style="font-size: 18px; margin-bottom: 15px; color: #0f172a; border-bottom: 2px solid ${safePrimaryColor}; padding-bottom: 10px;">Vehicle Details</h2>
        <dl style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px; line-height: 1.6;">
          <dt style="font-weight: 600; color: #0f172a;">Year</dt>
          <dd style="color: #666;">${safeVehicleYear}</dd>
          <dt style="font-weight: 600; color: #0f172a;">Make</dt>
          <dd style="color: #666;">${safeVehicleMake}</dd>
          <dt style="font-weight: 600; color: #0f172a;">Model</dt>
          <dd style="color: #666;">${safeVehicleModel}</dd>
          ${safeVehicleTrim ? `<dt style="font-weight: 600; color: #0f172a;">Trim</dt><dd style="color: #666;">${safeVehicleTrim}</dd>` : ''}
          ${safeVehicleMileage ? `<dt style="font-weight: 600; color: #0f172a;">Mileage</dt><dd style="color: #666;">${safeVehicleMileage} km</dd>` : ''}
          ${safeVehicleColor ? `<dt style="font-weight: 600; color: #0f172a;">Color</dt><dd style="color: #666;">${safeVehicleColor}</dd>` : ''}
          ${safeVehicleBody ? `<dt style="font-weight: 600; color: #0f172a;">Body Type</dt><dd style="color: #666;">${safeVehicleBody}</dd>` : ''}
          ${safeVehicleTransmission ? `<dt style="font-weight: 600; color: #0f172a;">Transmission</dt><dd style="color: #666;">${safeVehicleTransmission}</dd>` : ''}
          ${safeVehicleEngineSize ? `<dt style="font-weight: 600; color: #0f172a;">Engine</dt><dd style="color: #666;">${safeVehicleEngineSize}L</dd>` : ''}
          ${safeVehicleVin ? `<dt style="font-weight: 600; color: #0f172a;">VIN</dt><dd style="color: #666; font-family: monospace;">${safeVehicleVin}</dd>` : ''}
        </dl>
      </div>

      <aside style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; height: fit-content;">
        ${vehicle.price ? `<div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Price</p>
          <p style="font-size: 28px; font-weight: 700; color: ${safePrimaryColor};">$${Number(vehicle.price).toLocaleString('en-CA')}</p>
        </div>` : ''}

        <div style="margin-bottom: 20px;">
          <p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 600;">Dealership</p>
          <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">${escapeHtml(site.name)}</p>
          ${site.phone ? `<p style="font-size: 14px; color: #666; margin-bottom: 5px;">
            <a href="tel:${site.phone.replace(/\D/g, '')}" style="color: ${safePrimaryColor}; text-decoration: none;">${escapeHtml(site.phone)}</a>
          </p>` : ''}
          ${site.city || site.province ? `<p style="font-size: 14px; color: #666;">${escapeHtml(site.city || '')}${site.city && site.province ? ', ' : ''}${escapeHtml(site.province || '')}</p>` : ''}
        </div>

        <a href="${escapeUrlAttribute(siteUrl + '/inventory/')}" style="display: block; padding: 12px 16px; background: ${safePrimaryColor}; color: white; text-align: center; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 15px;">Back to Inventory</a>
      </aside>
    </div>
  </main>

  <!-- Client-side rendering mount point -->
  <div id="root"></div>

  <script src="/assets/public-shell.js"></script>
  <script id="vehicle-config" type="application/json">
  ${JSON.stringify({ site: { name: site.name, slug: site.slug, custom_domain: site.custom_domain }, vehicle })}
  </script>
  <script>
    if (window.PublicSiteRenderer) {
      const config = document.getElementById('vehicle-config');
      const data = config ? JSON.parse(config.textContent) : {};
      window.PublicSiteRenderer.initVehicleDetail(data);
    }
  </script>
</body>
</html>`
  }

  // Vehicle Detail Page route
  app.get('/site/:slug/inventory/:vehicleId', rateLimit('pub-site-vehicle', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const vehicleId = String(req.params.vehicleId || '').toLowerCase().trim()
    if (!slug || !vehicleId) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) return res.status(404).send('Site not found')

      const { data: vehicle } = await supabaseAdmin.from('vehicles').select('*').eq('dealership_id', d.id).ilike('id', vehicleId).maybeSingle()
      if (!vehicle || vehicle.status !== 'active') return res.status(404).send('Vehicle not found')

      const siteData = siteContent(d)
      const title = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}${vehicle.trim ? ' ' + vehicle.trim : ''} - ${siteData.name}`
      const description = vehicle.description || `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''} with ${(vehicle.mileage || 0).toLocaleString()} miles. Contact ${siteData.name} for more details.`
      const canonicalDomain = d.custom_domain ? escapeHtml(d.custom_domain) : null
      const canonical = canonicalDomain
        ? `https://${canonicalDomain}/inventory/${vehicle.id}`
        : `https://marketsync.link/site/${slug}/inventory/${vehicle.id}`

      res.set('Content-Type', 'text/html; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
      res.send(generateVehicleDetailPage({
        vehicle,
        site: siteData,
        title,
        description,
        imageUrl: (vehicle.photos && vehicle.photos[0]) || siteData.seo_image,
        canonical,
        dealer: d,
      }))
    } catch (e) {
      console.error('[vehicle-detail]', e.message)
      res.status(500).send('Error loading vehicle')
    }
  })

  // ── BATCH 5: Search Results Page (SRP) ────────────────────────────────────
  function generateInventoryListPage({ site, vehicles, title, description, imageUrl, canonical, pageNumber = 1, totalPages = 1, dealer }) {
    const siteUrl = site.custom_domain ? `https://${site.custom_domain}` : `https://marketsync.link/site/${site.slug}`
    const ogImage = imageUrl || site.seo_image || site.hero_banner_url || `${siteUrl}/og-image.png`

    const safeCanonical = escapeHtml(canonical)
    const safeTitle = escapeHtml(title)
    const safeDescription = escapeHtml(description)
    const safeImage = escapeUrlAttribute(ogImage)
    const safeKeywords = escapeHtml('used cars, vehicles for sale, inventory, ' + (site.discovery_terms || []).slice(0, 5).join(', '))
    const safeSiteName = escapeHtml(site.name)
    const safeSiteLogo = escapeUrlAttribute(site.logo_url)
    const safePrimaryColor = escapeHtml(site.primary_color || '#1e3a8a')

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Inventory",
          "item": canonical
        }
      ]
    }

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": title,
      "description": description,
      "url": canonical,
      "mainEntity": {
        "@type": "ItemList",
        "name": title,
        "numberOfItems": vehicles.length,
        "itemListElement": (vehicles || []).map((v, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "name": `${v.year || ''} ${v.make || ''} ${v.model || ''}`,
          "url": `${siteUrl}/inventory/${v.id}`,
          "item": {
            "@type": "Product",
            "name": `${v.year || ''} ${v.make || ''} ${v.model || ''}${v.trim ? ' ' + v.trim : ''}`,
            "image": (v.photos && v.photos[0]) || site.seo_image,
            ...(v.price ? { "offers": { "@type": "Offer", "price": String(v.price), "priceCurrency": "CAD" } } : {}),
            ...(v.mileage ? { "mileageFromOdometer": v.mileage } : {})
          }
        }))
      }
    }

    const paginationLinks = [
      pageNumber > 1 ? `<link rel="prev" href="${escapeHtml(siteUrl)}/inventory/?page=${pageNumber - 1}">` : '',
      pageNumber < totalPages ? `<link rel="next" href="${escapeHtml(siteUrl)}/inventory/?page=${pageNumber + 1}">` : ''
    ].filter(Boolean).join('\n  ')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <meta name="keywords" content="${safeKeywords}">

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safeCanonical}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">

  <!-- Canonical URL -->
  <link rel="canonical" href="${safeCanonical}">

  <!-- Pagination Links -->
  ${paginationLinks}

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema)}
  </script>

  <script type="application/ld+json">
  ${JSON.stringify(itemListSchema)}
  </script>

  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="theme-color" content="${safePrimaryColor}">
  <link rel="icon" href="${safeSiteLogo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚗</text></svg>'}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fff; }
    html { scroll-behavior: smooth; }
    noscript { display: block; padding: 20px; background: #fee2e2; color: #991b1b; text-align: center; }
  </style>
  <link rel="stylesheet" href="/assets/public-shell.css">
</head>
<body>
  <noscript>This website requires JavaScript to be enabled. Please enable JavaScript in your browser settings.</noscript>
  <div id="root"></div>

  <script src="/assets/public-shell.js"></script>
  <script id="inventory-config" type="application/json">
  ${JSON.stringify({ site: { name: site.name, slug: site.slug, custom_domain: site.custom_domain }, vehicles: vehicles || [], pageNumber, totalPages })}
  </script>
  <script>
    if (window.PublicSiteRenderer) {
      const config = document.getElementById('inventory-config');
      const data = config ? JSON.parse(config.textContent) : {};
      window.PublicSiteRenderer.initInventoryList(data);
    }
  </script>
</body>
</html>`
  }

  // Enhanced inventory list route (Search Results Page)
  app.get('/site/:slug/inventory/', rateLimit('pub-site-inventory', 120, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    if (!slug) return res.status(404).send('Not found')

    try {
      const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
      if (!d || !d.site_published) return res.status(404).send('Site not found')

      const pageNum = Math.max(1, parseInt(req.query.page) || 1)
      const pageSize = 20
      const offset = (pageNum - 1) * pageSize

      const { data: vehicles, count } = await supabaseAdmin
        .from('vehicles')
        .select('*', { count: 'exact' })
        .eq('dealership_id', d.id)
        .eq('status', 'active')
        .range(offset, offset + pageSize - 1)

      const siteData = siteContent(d)
      const totalPages = Math.ceil((count || 0) / pageSize)
      const canonicalDomain = d.custom_domain ? escapeHtml(d.custom_domain) : null
      const canonical = canonicalDomain
        ? `https://${canonicalDomain}/inventory/${pageNum > 1 ? '?page=' + pageNum : ''}`
        : `https://marketsync.link/site/${slug}/inventory/${pageNum > 1 ? '?page=' + pageNum : ''}`

      res.set('Content-Type', 'text/html; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
      res.send(generateInventoryListPage({
        site: siteData,
        vehicles: vehicles || [],
        title: `${siteData.name} - Inventory (Page ${pageNum})`,
        description: `Browse ${count || 0} vehicles in our inventory. Find your next car at ${siteData.name}.`,
        imageUrl: siteData.seo_image,
        canonical,
        pageNumber: pageNum,
        totalPages,
        dealer: d,
      }))
    } catch (e) {
      console.error('[inventory-list]', e.message)
      res.status(500).send('Error loading inventory')
    }
  })
}
