import dns from 'node:dns/promises'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { requireProduct } from '../access.js'
import { audit } from '../audit.js'
import { findOrCreateContact } from './crm.js'
import { enqueueForTrigger } from './automation.js'
import { routeAndNotifyLead } from '../lead-routing.js'
import { createNotification } from '../notifications.js'
import { aiAllowed, recordUsage } from '../usage.js'
import { rateLimit, getClientIp, consumeQuota, randomToken } from '../security.js'
import { getConfig } from './config-engine.js'
import { offTopicRefusal, scopeClause, sanitizeTranscript, CHAT_LIMITS } from '../chatGuard.js'
import { runAutoResponder } from '../autoresponder.js'
import { depositConfigForSite } from './deposits.js'
import { toolDefs, callTool } from './tool-registry.js'
import { startOrContinueConversation, saveMessage } from './ai-engine.js'
import { categorizeConversation, formatShownVehicles, summarizeConversation, verifyRecaptcha, RECAPTCHA_SITE_KEY } from './ai-runtime.js'
import { sanitizeHtml, stripScriptsFromHead } from '../html-sanitizer.js'
import { registerSitePublicRoutes } from './submodules/site-public.js'

const slugOk = (s) => /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(s)   // 3–40, no leading/trailing dash
// The host a dealer points their custom domain's CNAME at (the static-site domain,
// or the Cloudflare-for-SaaS CNAME target once that's set up).
const SITE_HOST = (process.env.SITE_DOMAIN_TARGET || 'marketsync.link').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
// FQDN check without a backtracking regex. The old single pattern nested a
// bounded quantifier inside a `(...)+` group over user-controlled input, which
// CodeQL flags as polynomial ReDoS. Bound the total length first, then validate
// each dot-separated label with a linear, non-ambiguous per-label regex.
const LABEL_OK = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/   // 1–63 chars, no leading/trailing dash
const domainOk = (s) => {
  if (typeof s !== 'string' || s.length === 0 || s.length > 253) return false
  const labels = s.split('.')
  if (labels.length < 2) return false                       // require at least one dot (FQDN)
  return labels.every((l) => LABEL_OK.test(l))
}

// ── Cloudflare for SaaS (Custom Hostnames) — auto-provisions a TLS cert per domain.
// Inert until CF_API_TOKEN + CF_ZONE_ID are set on the backend; falls back to a
// plain DNS check when not configured.
const CF_ENABLED = !!(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID)
async function cfApi(path, method = 'GET', body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  return { ok: r.ok && j.success !== false, result: j.result, errors: j.errors }
}
// Register a custom hostname (idempotent-ish) → returns the CF hostname id.
async function cfCreateHostname(domain) {
  const { ok, result } = await cfApi('/custom_hostnames', 'POST', { hostname: domain, ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } })
  return ok ? (result?.id || null) : null
}
async function cfDeleteHostname(id) { if (id) { try { await cfApi(`/custom_hostnames/${id}`, 'DELETE') } catch {} } }
async function cfHostnameActive(id) {
  if (!id) return false
  const { ok, result } = await cfApi(`/custom_hostnames/${id}`)
  return ok && result?.status === 'active' && (result?.ssl?.status === 'active')
}

// Only expose safe, public-facing vehicle fields (no internal/source data).
// Derive a vehicle's public market status from the inventory flag + the pipeline
// stage of any lead attached to it. Delivered (or manually sold) → off the lot;
// a live deal (sold/fni/turnover, not yet delivered) → sale pending; demo units →
// demo; everything else → in stock.
function marketStatus(v, contactStage) {
  const s = String(v.status || '').toLowerCase()
  const stage = String(contactStage || '').toLowerCase()
  if (s === 'sold' || stage === 'delivered') return 'delivered'
  if (s === 'pending' || stage === 'sold' || stage === 'fni' || stage === 'turnover') return 'pending'
  if (String(v.condition || '').toLowerCase() === 'demo') return 'demo'
  return 'available'
}
function publicVehicle(v) {
  // Only surface docs that already exist — factory (oem) or a sticker/brochure the
  // dealer generated (gen). The public site never generates or decodes anything.
  const recallCount = Array.isArray(v.recalls) ? v.recalls.length : 0
  return {
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim,
    price: v.price, mileage: v.mileage, condition: v.condition,
    exterior_color: v.exterior_color, interior_color: v.interior_color,
    drivetrain: v.drivetrain, fuel_type: v.fuel_type, transmission: v.transmission,
    engine: v.engine, body_style: v.body_style, doors: v.doors,
    stocknumber: v.stocknumber, vin: v.vin,
    image_urls: Array.isArray(v.image_urls) ? v.image_urls : [],
    // Prefer the AI sales pitch when present, else the plain feed description.
    description: v.sales_pitch || v.description || null,
    specs_manual: v.specs_manual && typeof v.specs_manual === 'object' ? v.specs_manual : null,
    carfax_url: v.carfax_url || null,
    window_sticker_url: v.window_sticker_oem_url || v.window_sticker_gen_url || v.window_sticker_url || null,
    brochure_url: v.brochure_oem_url || v.brochure_gen_url || v.brochure_url || null,
    recall_count: recallCount,
    market_status: v._market_status || marketStatus(v),
    // Deep spec sheet (NHTSA decode) for the brochure-style detail layout.
    vin_data: v.vin_data && typeof v.vin_data === 'object' ? v.vin_data : null,
  }
}
function publicRep(p) {
  return {
    name: p.display_name || p.full_name || null,
    title: ({ OWNER: 'Owner', DEALER_ADMIN: 'General Manager', MANAGER: 'Sales Manager', SALES_REP: 'Sales' }[p.role] || 'Sales'),
    // Department header on the public Team page — merges cleanly with dealer-added staff.
    department: ({ OWNER: 'Management', DEALER_ADMIN: 'Management', MANAGER: 'Management', SALES_REP: 'Sales' }[p.role] || 'Sales'),
    photo: p.avatar_url || null,
    phone: p.phone || null,
    bio: p.bio || null,
  }
}

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// Builder persistence is revision-first. The branding JSON remains the published
// compatibility projection for the existing renderer, while draft edits live here
// and cannot leak onto the public site until explicitly published.
async function latestDealerWebsiteRevision(dealershipId, state) {
  try {
    const { data, error } = await supabaseAdmin.from('dealer_website_revisions')
      .select('*').eq('dealership_id', dealershipId).eq('state', state)
      .order('revision_number', { ascending: false }).limit(1).maybeSingle()
    if (error) return null
    return data || null
  } catch { return null }
}
async function saveDealerWebsiteRevision({ dealershipId, content, state = 'draft', createdBy = null, changeSummary = 'Website builder update', baseRevisionId = null }) {
  try {
    const { data: latest } = await supabaseAdmin.from('dealer_website_revisions').select('revision_number')
      .eq('dealership_id', dealershipId).order('revision_number', { ascending: false }).limit(1).maybeSingle()
    const revisionNumber = Number(latest?.revision_number || 0) + 1
    if (state === 'published') await supabaseAdmin.from('dealer_website_revisions').update({ state: 'archived' }).eq('dealership_id', dealershipId).eq('state', 'published')
    const { data, error } = await supabaseAdmin.from('dealer_website_revisions').insert({ dealership_id: dealershipId, revision_number: revisionNumber, state, content, base_revision_id: baseRevisionId, change_summary: changeSummary, created_by: createdBy, published_at: state === 'published' ? new Date().toISOString() : null }).select('*').single()
    if (error) return null
    return data
  } catch { return null }
}

async function promoteDealerWebsiteContent(dealershipId, content) {
  const { data: current, error: readError } = await supabaseAdmin.from('dealerships').select('branding').eq('id', dealershipId).single()
  if (readError) throw readError
  const branding = { ...(current?.branding || {}) }
  const source = content && typeof content === 'object' ? content : {}
  const keys = ['tagline', 'about', 'hours', 'phone', 'email', 'address', 'hero_url', 'primary_color', 'secondary_color', 'accent_color', 'facebook_url', 'instagram_url', 'typography', 'heading_font', 'body_font', 'hero_photos', 'seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'discovery_summary', 'discovery_terms', 'discovery_intents', 'discovery_enabled']
  for (const key of keys) if (source[key] !== undefined) branding[key] = source[key]
  if (source.pages !== undefined) branding.site_pages = cleanPages(source.pages)
  if (source.staff !== undefined) branding.site_team = cleanStaff(source.staff)
  if (source.builtins !== undefined) branding.site_builtins = cleanBuiltins(source.builtins)
  if (source.menu_order !== undefined) branding.site_menu_order = cleanMenuOrder(source.menu_order)
  if (source.sections !== undefined) branding.site_sections = cleanSections(source.sections)
  if (source.theme !== undefined) branding.site_theme = SITE_THEMES.includes(source.theme) ? source.theme : 'classic'
  const { error } = await supabaseAdmin.from('dealerships').update({ branding, site_published: true }).eq('id', dealershipId)
  if (error) throw error
}

// Derive a unique site_slug from the dealership name (de-duplicated with a numeric
// suffix). Safe to call for a still-unpublished site: every public-facing route also
// requires site_published, so an auto-assigned slug on its own exposes nothing.
async function autoAssignSlug(dealershipId, name) {
  let base = slugify(name || '') || 'dealer'
  if (base.length < 3) base = ('dealer-' + base).replace(/-$/, '').slice(0, 40)
  let slug = base, n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: taken } = await supabaseAdmin.from('dealerships')
      .select('id').ilike('site_slug', slug).neq('id', dealershipId).maybeSingle()
    if (!taken) break
    slug = (base.slice(0, 36) + '-' + (++n)).slice(0, 40)
  }
  await supabaseAdmin.from('dealerships').update({ site_slug: slug }).eq('id', dealershipId)
  return slug
}

// Custom pages the dealer adds (About, Financing info, etc.) — title + HTML body.
function cleanPages(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set()
  return arr.slice(0, 20).map(p => {
    const title = String(p.title || '').trim().slice(0, 80)
    let slug = slugify(p.slug || title)
    while (slug && seen.has(slug)) slug += '-1'
    seen.add(slug)
    const kind = ['content', 'model', 'incentive'].includes(p.kind) ? p.kind : 'content'
    return {
      // Stable id so the menu-order list can reference a page across saves.
      id: p.id ? String(p.id).slice(0, 40) : ('pg' + Math.random().toString(36).slice(2, 9)),
      slug, title, body_html: sanitizeHtml(String(p.body_html || '').slice(0, 40000)), nav: p.nav !== false, kind,
      // Optional dropdown group in the top nav (e.g. "New Vehicles", "Offers").
      menu: p.menu ? String(p.menu).slice(0, 40) : null,
      make: p.make ? String(p.make).slice(0, 40) : null,
      model: p.model ? String(p.model).slice(0, 60) : null,
      // Per-page brand accent (hex) + nav icon (emoji/short glyph) — #28.
      accent: /^#[0-9a-fA-F]{6}$/.test(String(p.accent || '')) ? String(p.accent) : null,
      icon: p.icon ? String(p.icon).slice(0, 8) : null,
      // Per-page SEO: unique title, meta description and focus keyword. Blank = the
      // public site derives them from the page's own content at render time.
      seo_title: p.seo_title ? String(p.seo_title).slice(0, 120) : null,
      seo_description: p.seo_description ? String(p.seo_description).slice(0, 320) : null,
      seo_keyword: p.seo_keyword ? String(p.seo_keyword).slice(0, 80) : null,
      // Full section builder per page (hero, CTAs, inventory…) — same as the home page.
      sections: Array.isArray(p.sections) ? cleanSections(p.sections) : [],
    }
  }).filter(p => p.title && p.slug)
}

// Explicit nav ordering: an array of tokens ("b:inventory", "p:<pageId>").
function cleanMenuOrder(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set(), out = []
  for (const t of arr) { const s = String(t || '').trim().slice(0, 60); if (s && /^[bp]:/.test(s) && !seen.has(s)) { seen.add(s); out.push(s) } }
  return out.slice(0, 60)
}

// The franchise brands a dealer sells new (drives the Build & Price make list).
function cleanMakes(arr) {
  if (!Array.isArray(arr)) return []
  const seen = new Set(), out = []
  for (const m of arr) { const s = String(m || '').trim().slice(0, 40); const k = s.toLowerCase(); if (s && !seen.has(k)) { seen.add(k); out.push(s) } }
  return out.slice(0, 20)
}
// Built-in pages that ship with every site (Inventory, Build & Price, Value Trade,
// Financing, Team, Contact). The dealer can rename or switch each off from the page
// builder; unset = on, so existing dealers keep them all.
const BUILTIN_KEYS = ['inventory', 'build', 'trade', 'finance', 'team', 'contact']
const BUILTIN_DEFAULTS = { inventory: 'Inventory', build: 'Build & Price', trade: 'Value Trade', finance: 'Financing', team: 'Team', contact: 'Contact' }
function cleanBuiltins(obj) {
  const src = (obj && typeof obj === 'object') ? obj : {}
  const out = {}
  for (const k of BUILTIN_KEYS) {
    const v = (src[k] && typeof src[k] === 'object') ? src[k] : {}
    out[k] = {
      enabled: v.enabled !== false,   // default ON
      label: (v.label ? String(v.label).trim().slice(0, 40) : '') || BUILTIN_DEFAULTS[k],
      // Optional dropdown group in the nav (e.g. put Value Trade + Financing under "Finance").
      menu: v.menu ? String(v.menu).trim().slice(0, 40) : null,
      // Dealer-defined intro sections (hero/SEO) rendered above the built-in's functional content.
      sections: Array.isArray(v.sections) ? cleanSections(v.sections) : [],
    }
  }
  return out
}

// Dealer staff shown on the Team page, grouped by department with a job label.
const STAFF_DEPTS = ['Management', 'Sales', 'Finance', 'Service', 'Parts', 'Admin', 'Reception', 'Other']
function cleanStaff(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 80).map(m => ({
    name: String(m.name || '').trim().slice(0, 80),
    title: String(m.title || '').trim().slice(0, 60) || null,
    department: STAFF_DEPTS.includes(m.department) ? m.department : 'Sales',
    photo: m.photo ? String(m.photo).slice(0, 500) : null,
    phone: String(m.phone || '').trim().slice(0, 40) || null,
    email: String(m.email || '').trim().slice(0, 160) || null,
  })).filter(m => m.name)
}

// Discovery is the semantic layer shared by the public website, SEO metadata,
// and the MarketSync Discovery surface. Keep synonyms structured and bounded so
// they improve recall without becoming keyword-stuffed page copy.
function cleanDiscoveryTerms(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',')
  const seen = new Set()
  return values.map(v => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 80))
    .filter(v => v.length >= 2 && v.length <= 80)
    .filter(v => { const k = v.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, 40)
}

// The section palette for the page builder. Each is dealership-aware on render.
const SECTION_TYPES = ['hero', 'feature_cards', 'featured_inventory', 'inventory_grid', 'text_image', 'body_style', 'payment_calc', 'ad_banner', 'finance_cta', 'trade_cta', 'service_cta', 'staff', 'reviews', 'faq', 'blog', 'cta_banner', 'gallery', 'map', 'contact', 'html']
function cleanSections(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 40).map((s, i) => {
    let settings = (s.settings && typeof s.settings === 'object') ? { ...s.settings } : {}
    try { if (JSON.stringify(settings).length > 12000) settings = {} } catch { settings = {} }
    if (settings.html && typeof settings.html === 'string') {
      settings.html = sanitizeHtml(settings.html)
    }
    return {
      id: String(s.id || `s${i}_${Math.random().toString(36).slice(2, 7)}`),
      type: SECTION_TYPES.includes(s.type) ? s.type : 'html',
      settings,
    }
  })
}
const TYPOGRAPHY = ['modern', 'luxury', 'bold', 'corporate', 'minimal']
const SITE_THEMES = ['classic', 'prestige', 'modern', 'bold', 'minimal']

// Placed widgets: where they can go and their shape.
const WIDGET_SLOTS = ['top_banner', 'hero_below', 'above_inventory', 'below_inventory', 'above_footer']
function cleanWidgets(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 40).map((w, i) => ({
    id: String(w.id || `w${i}_${Math.random().toString(36).slice(2, 7)}`),
    slot: WIDGET_SLOTS.includes(w.slot) ? w.slot : 'below_inventory',
    title: (w.title == null ? '' : String(w.title)).slice(0, 120) || null,
    html: sanitizeHtml(String(w.html == null ? '' : w.html)).slice(0, 20000),
    height: Math.min(2000, Math.max(60, parseInt(w.height) || 400)),
  })).filter(w => w.html.trim())
}

// The site's content bundle from the dealership's branding jsonb.
function siteContent(d) {
  const b = d.branding || {}
  return {
    name: d.name,
    slug: d.site_slug || null,
    custom_domain: d.custom_domain || null,
    logo_url: b.logo_url || null,
    primary_color: b.primary_color || '#1e3a8a',
    secondary_color: b.secondary_color || '#0f172a',
    tagline: b.tagline || null,
    hero_url: b.hero_url || null,
    about: b.about || null,
    hours: b.hours || null,
    phone: b.phone || null,
    email: b.email || null,
    address: b.address || null,
    city: d.city || null, province: d.province || null, postal_code: d.postal_code || null,
    website_url: d.website_url || null,
    photo_background_url: d.photo_background_url || null,
    facebook_url: b.facebook_url || null,
    instagram_url: b.instagram_url || null,
    // SEO: page title, meta description, keywords, and social-share (OG) image.
    seo_title: b.seo_title || null,
    seo_description: b.seo_description || null,
    seo_keywords: b.seo_keywords || null,
    seo_image: b.seo_image || null,
    // Shared semantic discovery contract. SEO may use these as supporting
    // signals, while Discovery uses them to match natural-language intent.
    discovery_summary: b.discovery_summary || null,
    discovery_terms: cleanDiscoveryTerms(b.discovery_terms),
    discovery_intents: cleanDiscoveryTerms(b.discovery_intents),
    discovery_enabled: b.discovery_enabled !== false,
    // Dealer-controlled custom code: sanitized for shared-origin safety
    head_html: b.site_head_html ? stripScriptsFromHead(b.site_head_html) : null,
    widgets: cleanWidgets(b.site_widgets),
    pages: cleanPages(b.site_pages),
    // Dealer-managed staff for the Team page (managers, sales, service, admin…).
    staff: cleanStaff(b.site_team),
    // Franchise brands sold new — the Build & Price make list (empty = auto-detect).
    build_makes: cleanMakes(b.build_makes),
    // Built-in page on/off + custom nav labels.
    builtins: cleanBuiltins(b.site_builtins),
    // Explicit nav order across built-ins + custom pages.
    menu_order: Array.isArray(b.site_menu_order) ? b.site_menu_order : [],
    // Page builder: ordered sections + global styling.
    sections: cleanSections(b.site_sections),
    typography: TYPOGRAPHY.includes(b.typography) ? b.typography : 'modern',
    // One-click design theme — a bundle of tokens (radius, shadow, spacing, hero/card
    // style) applied by the public site for an eDealer/LeadBox-grade look.
    theme: SITE_THEMES.includes(b.site_theme) ? b.site_theme : 'classic',
    // Optional dealer-chosen Google Fonts (override the typography preset).
    heading_font: b.heading_font || null,
    body_font: b.body_font || null,
    // When on, heroes use real inventory photos instead of the generated gradient art.
    hero_photos: !!b.hero_photos,
    accent_color: b.accent_color || null,
    // AI sales concierge chat bubble on the public site (dealer opt-in).
    sales_chat: !!b.site_sales_chat,
    // Customer-facing name for the concierge (e.g. "Ava"). Blank = generic.
    chat_name: b.site_chat_name || null,
    // AI concierge tuning: dealer knowledge base, custom instructions, disclaimer.
    chat_kb: b.site_chat_kb || null,
    chat_instructions: b.site_chat_instructions || null,
    chat_disclaimer: b.site_chat_disclaimer || null,
    // `auto` keeps a new Digital site useful before the dealer connects their
    // own lot: show Marketplace inventory first, then switch to the dealer's
    // canonical inventory as soon as it exists.
    inventory_source: ['auto', 'dealer', 'marketplace', 'merged'].includes(b.site_inventory_source)
      ? b.site_inventory_source : 'auto',
  }
}

const SITE_COLS = 'id, name, branding, site_published, site_slug, custom_domain, city, province, postal_code, website_url, photo_background_url'
export function selectSiteInventory(rows, mode = 'auto') {
  const all = Array.isArray(rows) ? rows : []
  const isMarketplace = v => ['marketplace', 'marketplace_feed'].includes(String(v.source || '').toLowerCase())
  const marketplace = all.filter(isMarketplace)
  const dealer = all.filter(v => !isMarketplace(v))
  if (mode === 'marketplace') return marketplace
  if (mode === 'dealer') return dealer
  if (mode === 'merged') return all
  return dealer.length ? dealer : marketplace
}

async function buildSiteResponse(d) {
  const [{ data: inv }, { data: team }, { data: interests }] = await Promise.all([
    supabaseAdmin.from('inventory')
      .select('id, year, make, model, trim, price, mileage, condition, exterior_color, interior_color, drivetrain, fuel_type, transmission, engine, body_style, doors, stocknumber, vin, image_urls, description, carfax_url, window_sticker_url, window_sticker_oem_url, window_sticker_gen_url, brochure_url, brochure_oem_url, brochure_gen_url, recalls, vin_data, sales_pitch, specs_manual, status, source, created_at')
      .eq('dealership_id', d.id).is('archived_at', null).neq('status', 'sold')
      .or('awaiting_possession.is.null,awaiting_possession.eq.false')   // hide acquired trades until possession (#16)
      .order('created_at', { ascending: false }).limit(600),
    supabaseAdmin.from('profiles')
      .select('full_name, display_name, avatar_url, phone, role, hide_on_site, bio')
      .eq('dealership_id', d.id),
    // Pipeline stage of any contact tied to a vehicle → drives the vehicle's status.
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
  const inventoryMode = ['auto', 'dealer', 'marketplace', 'merged'].includes(d.branding?.site_inventory_source)
    ? d.branding.site_inventory_source : 'auto'
  const vehicles = selectSiteInventory(inv || [], inventoryMode)
    .map(v => ({ ...v, _market_status: marketStatus(v, stageByVeh[v.id]?.s) }))
    .filter(v => v._market_status !== 'delivered')
    .map(publicVehicle)
  const roster = (team || []).filter(p => !p.hide_on_site && (p.display_name || p.full_name)).map(publicRep)
  const deposits = await depositConfigForSite(d.id).catch(() => ({ enabled: false }))
  // The AI concierge persona (name + headshot + greeting) is set in AI Chat → Settings
  // (ai_personality). It drives the on-site chat bubble's identity — persona wins, with
  // the per-site branding name as a fallback.
  const persona = await getConfig(d.id, 'ai_personality', {}).catch(() => ({}))
  const site = siteContent(d)
  site.chat_name = persona?.name || site.chat_name || null
  site.chat_avatar = persona?.avatar_url || null
  site.chat_greeting = persona?.greeting || null
  site.recaptcha_site_key = RECAPTCHA_SITE_KEY || null   // gates the on-site reCAPTCHA
  return { site, vehicles, team: roster, count: vehicles.length, deposits }
}

// Public site data, lead capture, and booking routes extracted to routes/submodules/site-public.js
export function registerSite(app) {
  registerSitePublicRoutes(app)


  // ── PUBLIC: AI sales concierge chat for a dealer's website ─────────────────
  // Answers shopper questions strictly from THIS dealer's live inventory + info,
  // nudges toward a test drive / financing / trade, and hands off to the lead form
  // for contact capture. Rate-limited per IP + gated on the dealer's AI budget and
  // an opt-in toggle so it can never run up cost silently.
  const CHAT_FALLBACK = "I can't chat live right now, but leave your name and number and a product advisor will get right back to you."
  app.post('/site/:slug/chat', rateLimit('sitechat', 20, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const { data: d } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    const b = d.branding || {}
    if (!b.site_sales_chat) return res.status(403).json({ error: 'Chat is not enabled for this site.' })
    if (!(await verifyRecaptcha(req.body?.recaptcha_token))) return res.status(403).json({ error: 'recaptcha_failed' })

    // Graceful degrade: no key or over the monthly budget → show the lead form.
    if (!process.env.ANTHROPIC_API_KEY || !(await aiAllowed(d.id, false))) {
      return res.json({ reply: CHAT_FALLBACK, capture: true })
    }
    // Cost cap: per-dealer DAILY message ceiling (on top of the per-minute IP limit
    // and the monthly AI budget). Over it → hand off to the form, no model call.
    const daily = await consumeQuota(`sitechat:${d.id}`, CHAT_LIMITS.perDealerDaily, 86400)
    if (!daily.allowed) return res.json({ reply: "Our online assistant is taking a quick break — leave your name and number and we'll be right with you.", capture: true })

    const { ok, messages, lastUser } = sanitizeTranscript(req.body?.messages)
    if (!ok) return res.status(400).json({ error: 'Send a message.' })
    // Scope guard: refuse the clearest off-topic / injection inputs with zero tokens.
    const refusal = offTopicRefusal(lastUser, { marketing: false })
    if (refusal) return res.json({ reply: refusal, capture: false })

    // Live inventory the concierge answers from (scoped to this dealer, on-lot only).
    const { data: inv } = await supabaseAdmin.from('inventory')
      .select('year, make, model, trim, price, mileage, condition, exterior_color, drivetrain, fuel_type, body_style, stocknumber, source')
      .eq('dealership_id', d.id).is('archived_at', null).neq('status', 'sold')
      .or('awaiting_possession.is.null,awaiting_possession.eq.false')
      .order('price', { ascending: true }).limit(400)
    const chatMode = ['auto', 'dealer', 'marketplace', 'merged'].includes(b.site_inventory_source) ? b.site_inventory_source : 'auto'
    const list = selectSiteInventory(inv || [], chatMode)
    const money = n => n ? '$' + Number(n).toLocaleString('en-US') : 'call for price'
    const lines = list.slice(0, 60).map(v => `- ${[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')} · ${money(v.price)}${v.mileage ? ' · ' + Number(v.mileage).toLocaleString('en-US') + ' km/mi' : ''}${v.exterior_color ? ' · ' + v.exterior_color : ''}${v.condition ? ' · ' + v.condition : ''}${v.stocknumber ? ' · #' + v.stocknumber : ''}`).join('\n')
    const makeCounts = {}
    for (const v of list) { const k = v.make || 'Other'; makeCounts[k] = (makeCounts[k] || 0) + 1 }
    const byMake = Object.entries(makeCounts).sort((a, c) => c[1] - a[1]).slice(0, 10).map(([m, n]) => `${m} (${n})`).join(', ')
    const bi = cleanBuiltins(b.site_builtins)
    const can = (k) => !bi[k] || bi[k].enabled !== false
    const loc = [d.city, d.province].filter(Boolean).join(', ')
    let facts = [
      `Dealership: ${d.name}${loc ? ` — ${loc}` : ''}.`,
      b.phone ? `Phone: ${b.phone}.` : '',
      b.email ? `Email: ${b.email}.` : '',
      b.address ? `Address: ${b.address}.` : '',
      b.hours ? `Hours: ${String(b.hours).slice(0, 300)}.` : '',
      b.about ? `About: ${String(b.about).slice(0, 600)}.` : '',
      `Vehicles in stock: ${list.length}. By make: ${byMake || 'n/a'}.`,
      `Financing available: ${can('finance') ? 'yes' : 'ask'}. Trade-in appraisals: ${can('trade') ? 'yes' : 'ask'}.`,
    ].filter(Boolean).join('\n')

    // Dealership-level AI persona + knowledge base (set in Settings → AI) layer on top
    // of the per-site chat knobs. Fetched separately so they never ride SITE_COLS into
    // the public site JSON.
    const { data: aiCfg } = await supabaseAdmin.from('dealerships')
      .select('ai_customer_style, ai_knowledge, ai_knowledge_name, service_settings').eq('id', d.id).maybeSingle()
    // Deepen grounding with the dealer's service department (menu + hours) if set up.
    const svc = (aiCfg?.service_settings && typeof aiCfg.service_settings === 'object') ? aiCfg.service_settings : null
    if (svc) {
      const types = Array.isArray(svc.service_types) ? svc.service_types.slice(0, 12).join(', ') : ''
      facts += `\nService department: ${svc.enabled ? 'books service online' : 'by phone'}${types ? ` — offers ${types}` : ''}${svc.hours ? `. Service hours: ${String(svc.hours).slice(0, 200)}` : ''}.`
    }
    const kb = [String(b.site_chat_kb || '').trim(), String(aiCfg?.ai_knowledge || '').trim()].filter(Boolean).join('\n\n').slice(0, 12000)
    // Default AI tone comes from the Configuration Engine (ai_personality); a dealer's
    // own per-site style still wins when set. Non-disruptive: only used as a fallback.
    const aiPersona = await getConfig(d.id, 'ai_personality', null)
    const defaultTone = aiPersona?.tone ? `Tone: ${aiPersona.tone}.` : ''
    const instr = [String(aiCfg?.ai_customer_style || '').trim(), String(b.site_chat_instructions || '').trim()].filter(Boolean).join('\n\n').slice(0, 4000) || defaultTone
    const disclaimer = String(b.site_chat_disclaimer || '').trim().slice(0, 600)
    const botName = String(b.site_chat_name || '').trim().slice(0, 60)
    const system = `You are ${botName ? `${botName}, a real member of the sales team` : 'the online sales concierge'} at ${d.name}, a car dealership${loc ? ` in ${loc}` : ''}.${botName ? ` If a shopper asks your name, you're ${botName}.` : ''}

YOUR #1 JOB: get the customer IN THE DOOR. You're not closing the sale over chat — you're booking the appointment (test drive or a quick visit) and getting their contact info. Everything points at that.

HOW YOU TALK:
- Short. One or two sentences per message, like texting. No long paragraphs, no dumping the whole inventory list.
- One question at a time, warm and natural, a little personality. Never say you're an AI or a bot.

PLAYBOOK:
- Get their name early and casually, then a phone or email so an advisor can lock in a time.
- When they tell you what they want, use search_inventory to pull 2-3 great matches, then steer straight to a visit: "Want me to set up a time to come see it?" (The app shows the vehicles you find as cards automatically — don't paste long specs.)
- You KNOW the live prices (search_inventory) — but don't negotiate or quote monthly payments in chat. If they push on price, say the sharpest number comes from a few minutes in person and offer to book it.
- Use your TOOLS to actually DO things: search_inventory, dealership_info (hours/address/phone/financing/stock count), calculate_payment, book_appointment (SALES test-drive/visit or SERVICE — once you have name + phone/email + a date/time; compute the ISO date-time from what they say), create_lead (the moment you have name + phone/email), save_memory, request_human (sales/service/parts for anything complicated).
- Always be closing — on the APPOINTMENT, not the car. Every reply nudges toward "let's get you in."
- If you need their contact info and don't have it yet, ask for name + phone/email and end that message with the token [CAPTURE].
- Only discuss vehicles from search_inventory / the list below — never invent stock, prices, VINs or specs. Keep it about ${d.name}. Today: ${new Date().toISOString().slice(0, 10)}.
- CONDITION — be exact: describe a vehicle ONLY by its listed condition (New, Used, or Demo). NEVER imply newness from mileage or say "basically brand new", "only a few km" or "practically new" — a new vehicle can legally carry delivery kilometres, so that's misleading. Don't quote kilometres on New vehicles; just say it's new. Mention km only for Used/Demo. The app shows the vehicles you find as cards with a View Details link — let those cards do the showing instead of pasting long specs.${instr ? `

DEALER INSTRUCTIONS (how this dealership wants you to answer — follow these, but never break the RULES above):
${instr}` : ''}${kb ? `

DEALER KNOWLEDGE BASE (dealer-provided facts about this store — policies, financing, warranty, hours, staff, FAQs. Prefer these answers over guessing; if something isn't here or in inventory, offer to have an advisor confirm):
${kb}` : ''}${disclaimer ? `

DISCLAIMER: If the shopper asks about pricing accuracy, availability guarantees, legal/financing terms, or when you're unsure, include this dealer disclaimer naturally: "${disclaimer}"` : ''}

DEALERSHIP FACTS:
${facts}

INVENTORY (${list.length} in stock):
${lines || '(no vehicles listed right now)'}` + scopeClause(`${d.name} — its vehicles, pricing, financing, trades, test drives, service, hours and location`, 'the inventory above, financing, trade-ins, booking a test drive or service visit, and the dealership\'s hours/location/contact')

    // A conversation handle so the agentic tools (book_appointment, create_lead,
    // request_human, save_memory) can persist to the CRM / timeline / AI Chat home.
    // The visitor token is echoed back so follow-up turns continue the same thread.
    // This token IS a credential: the conversation is looked up by it, so a predictable
    // one would let a stranger resume another visitor's thread. Must be crypto-random.
    const visitorToken = String(req.body?.visitor_token || '') || ('v_' + randomToken(12))
    let conversation = null
    if (req.body?.conversation_id) {
      const { data } = await supabaseAdmin.from('ai_conversations').select('*').eq('id', req.body.conversation_id).eq('dealership_id', d.id).maybeSingle()
      conversation = data
    }
    if (!conversation) { try { conversation = await startOrContinueConversation(d.id, { visitorToken, website: `site:${slug}`, source: 'site' }) } catch {} }
    const ctx = { dealershipId: d.id, conversation: conversation || { id: null }, contactRef: { id: conversation?.contact_id || null } }

    // Persist the shopper's turn so the dealer console's transcript (AI Chat →
    // conversation) shows the real history. The reply is saved after the loop.
    if (conversation?.id && lastUser) { try { await saveMessage(conversation.id, d.id, 'user', lastUser) } catch {} }

    // A rep has taken over — the AI stays quiet; the rep's replies reach the widget
    // through its poller. Just acknowledge the visitor's message.
    if (conversation?.status === 'handoff') {
      return res.json({ reply: '', handoff: true, vehicles: [], conversation_id: conversation.id, visitor_token: visitorToken })
    }

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const tools = toolDefs('sales_chat')
      let reply = ''
      // Agentic tool loop — the concierge can search inventory, look up store facts,
      // book sales/service appointments, capture leads and hand off to a human.
      for (let hop = 0; hop < 5; hop++) {
        const resp = await Promise.race([
          anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system, tools, messages }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 22000)),
        ])
        const toolUses = (resp.content || []).filter(x => x.type === 'tool_use')
        const textPart = (resp.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim()
        if (textPart) reply = textPart
        if (resp.stop_reason !== 'tool_use' || !toolUses.length) break
        messages.push({ role: 'assistant', content: resp.content })
        const results = []
        for (const tu of toolUses) {
          const out = await callTool(tu.name, tu.input || {}, ctx, { surface: 'sales_chat' })
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) })
        }
        messages.push({ role: 'user', content: results })
      }
      // Categorize this chat for the AI Chat dashboard feed (department/intent/tags)
      // and keep the CRM summary fresh automatically.
      if (conversation?.id) {
        const userText = messages.filter(m => m.role === 'user' && typeof m.content === 'string').map(m => m.content).join(' ')
        categorizeConversation(d.id, conversation.id, userText, { booked: !!ctx.booked }).catch(() => {})
        summarizeConversation(d.id, conversation.id).catch(() => {})
      }
      const captureTok = /\[CAPTURE\]/i.test(reply)
      reply = reply.replace(/\[CAPTURE\]/ig, '').trim()
      // Only show the lead form when we still need contact info (no lead captured yet).
      const capture = captureTok && !ctx.contactRef.id
      if (!reply) return res.json({ reply: CHAT_FALLBACK, capture: true, conversation_id: conversation?.id || null, visitor_token: visitorToken })
      // Persist the concierge's reply so the transcript reads as a real conversation.
      let savedReply = null
      if (conversation?.id) { try { savedReply = await saveMessage(conversation.id, d.id, 'assistant', reply) } catch {} }
      recordUsage(d.id, { ai: 1 })
      // Vehicles the concierge surfaced this turn → rendered as cards in the widget.
      const vehicles = await formatShownVehicles(d.id, ctx.shownVehicles).catch(() => [])
      res.json({ reply, reply_at: savedReply?.created_at || null, vehicles, capture, conversation_id: conversation?.id || null, visitor_token: visitorToken })
    } catch (e) {
      res.json({ reply: CHAT_FALLBACK, capture: true, conversation_id: conversation?.id || null, visitor_token: visitorToken })
    }
  })

  // ── ADMIN: read the site config (slug, published, content) ─────────────────
  app.get('/dealership/site', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: d } = await supabaseAdmin.from('dealerships')
      .select('name, branding, site_slug, site_published, custom_domain, custom_domain_verified, city, province, postal_code, website_url').eq('id', req.dealershipId).single()
    // The visual Live Builder requires a slug before it can render at all (it needs a
    // real site address to preview/link against). Rather than leaving every dealership
    // that hasn't published yet stuck behind a dead-end "set your address first" screen,
    // assign one automatically here — draft/unpublished, so nothing becomes publicly
    // reachable until the dealer explicitly publishes.
    if (!d.site_slug) d.site_slug = await autoAssignSlug(req.dealershipId, d.name)
    const draftRevision = await latestDealerWebsiteRevision(req.dealershipId, 'draft')
    const publishedRevision = await latestDealerWebsiteRevision(req.dealershipId, 'published')
    res.json({
      site_slug: d.site_slug || null,
      site_published: !!d.site_published,
      custom_domain: d.custom_domain || null,
      custom_domain_verified: !!d.custom_domain_verified,
      domain_target: SITE_HOST,   // where the dealer points their CNAME
      can_manage: true,
      // Draft is the editor source; public rendering continues to use the
      // dealership branding projection until a publish action promotes it.
      content: draftRevision?.content || siteContent(d),
      revision: draftRevision ? { id: draftRevision.id, number: draftRevision.revision_number, state: draftRevision.state, created_at: draftRevision.created_at } : null,
      published_revision: publishedRevision ? { id: publishedRevision.id, number: publishedRevision.revision_number, published_at: publishedRevision.published_at } : null,
    })
  })

  app.get('/dealership/site/revisions', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('dealer_website_revisions').select('id, revision_number, state, change_summary, created_by, created_at, published_at').eq('dealership_id', req.dealershipId).order('revision_number', { ascending: false }).limit(80)
      if (error) throw error
      const { data: deployments } = await supabaseAdmin.from('website_deployments').select('id, status, trigger_type, published_summary, deployed_at, verified_at, verified_status, created_at').eq('site_id', req.dealershipId).order('created_at', { ascending: false }).limit(20)
      res.json({ revisions: data || [], deployments: deployments || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/dealership/site/revisions/:id/restore', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    try {
      const { data: source, error } = await supabaseAdmin.from('dealer_website_revisions').select('content, revision_number').eq('id', req.params.id).eq('dealership_id', req.dealershipId).single()
      if (error || !source) return res.status(404).json({ error: 'Revision not found' })
      const restored = await saveDealerWebsiteRevision({ dealershipId: req.dealershipId, content: source.content, state: 'draft', createdBy: req.user?.id, baseRevisionId: req.params.id, changeSummary: `Restored revision ${source.revision_number}` })
      if (!restored) return res.status(500).json({ error: 'Could not restore revision' })
      res.status(201).json({ revision: { id: restored.id, number: restored.revision_number, state: restored.state } })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/dealership/site/deployments/:id/rollback', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    try {
      const { data: deployment, error: deploymentError } = await supabaseAdmin.from('website_deployments').select('id, site_id, published_summary').eq('id', req.params.id).eq('site_id', req.dealershipId).single()
      if (deploymentError || !deployment) return res.status(404).json({ error: 'Deployment not found' })
      const revisionId = deployment.published_summary?.revision_id
      if (!revisionId) return res.status(400).json({ error: 'This deployment has no restorable revision' })
      const { data: source, error: sourceError } = await supabaseAdmin.from('dealer_website_revisions').select('content, revision_number, state').eq('id', revisionId).eq('dealership_id', req.dealershipId).single()
      if (sourceError || !source) return res.status(404).json({ error: 'Published revision not found' })
      const restored = await saveDealerWebsiteRevision({ dealershipId: req.dealershipId, content: source.content, state: 'published', createdBy: req.user?.id, baseRevisionId: revisionId, changeSummary: `Rolled back to revision ${source.revision_number}` })
      if (!restored) return res.status(500).json({ error: 'Could not create rollback revision' })
      await promoteDealerWebsiteContent(req.dealershipId, source.content)
      const now = new Date().toISOString()
      const { data: rollbackDeployment } = await supabaseAdmin.from('website_deployments').insert({
        site_id: req.dealershipId, trigger_type: 'rollback', status: 'verified',
        published_summary: { revision_id: restored.id, revision_number: restored.revision_number, rollback_source_revision_id: revisionId, change_summary: `Rolled back to revision ${source.revision_number}` },
        deployed_at: now, verified_at: now, verified_status: 'Database-backed public site state confirmed', created_by: req.user?.id,
      }).select('id, status, trigger_type, published_summary, deployed_at, verified_at, verified_status').single()
      audit(req, 'site.rollback', { after_state: { source_revision_id: revisionId, published_revision_id: restored.id } })
      res.status(201).json({ ok: true, revision: { id: restored.id, number: restored.revision_number, state: restored.state }, deployment: rollbackDeployment || null })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── ADMIN: update slug / publish / site content ────────────────────────────
  app.put('/dealership/site', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    // The visual builder sends its complete draft under `content`, while the
    // settings form sends fields at the top level. Normalize both contracts at
    // the route boundary so SEO/Discovery edits cannot silently disappear.
    const rawBody = req.body || {}
    const b = { ...(rawBody.content && typeof rawBody.content === 'object' ? rawBody.content : {}), ...rawBody }
    const update = {}
    const { data: currentSite } = await supabaseAdmin.from('dealerships').select('name, branding, site_slug, site_published, city, province, postal_code, website_url').eq('id', req.dealershipId).maybeSingle()
    const builderAction = ['draft', 'publish'].includes(rawBody.builder_action) ? rawBody.builder_action : null
    let revisionSaved = false
    let revisionInfo = null
    if (builderAction) {
      // Editors send the draft revision they loaded. Reject stale writes rather
      // than silently replacing another user's newer work. Legacy/settings
      // callers that do not send a cursor retain the existing behavior.
      const baseRevisionId = rawBody.base_revision_id ? String(rawBody.base_revision_id).slice(0, 80) : null
      if (baseRevisionId) {
        const currentDraft = await latestDealerWebsiteRevision(req.dealershipId, 'draft')
        if (currentDraft?.id && currentDraft.id !== baseRevisionId) {
          return res.status(409).json({
            error: 'This website draft changed in another session. Reload the latest draft before saving.',
            code: 'WEBSITE_DRAFT_CONFLICT',
            current_revision: { id: currentDraft.id, number: currentDraft.revision_number, created_at: currentDraft.created_at },
          })
        }
      }
      const base = siteContent(currentSite || { name: 'Dealership', branding: {} })
      const content = { ...base, ...(rawBody.content && typeof rawBody.content === 'object' ? rawBody.content : {}) }
      for (const key of ['sections', 'pages', 'staff', 'builtins', 'menu_order', 'primary_color', 'secondary_color', 'accent_color', 'typography', 'heading_font', 'body_font', 'hero_photos', 'theme', 'seo_title', 'seo_description', 'seo_keywords', 'discovery_summary', 'discovery_terms', 'discovery_intents', 'discovery_enabled']) {
        if (rawBody[key] !== undefined) content[key] = rawBody[key]
      }
      const saved = await saveDealerWebsiteRevision({ dealershipId: req.dealershipId, content, state: builderAction === 'publish' ? 'published' : 'draft', createdBy: req.user?.id, changeSummary: rawBody.change_summary || (builderAction === 'publish' ? 'Published website builder changes' : 'Saved website builder draft'), baseRevisionId: rawBody.base_revision_id || null })
      revisionSaved = !!saved
      revisionInfo = saved ? { id: saved.id, number: saved.revision_number, state: saved.state } : null
    }

    if (b.site_slug !== undefined) {
      const slug = String(b.site_slug || '').toLowerCase().trim()
      if (slug) {
        if (!slugOk(slug)) return res.status(400).json({ error: 'Use 3–40 letters, numbers or dashes (no leading/trailing dash).' })
        const { data: taken } = await supabaseAdmin.from('dealerships')
          .select('id').ilike('site_slug', slug).neq('id', req.dealershipId).maybeSingle()
        if (taken) return res.status(409).json({ error: 'That address is already taken — try another.' })
        update.site_slug = slug
      } else update.site_slug = null
    }
    // A draft is editor state only. Never unpublish the live site just because
    // the builder sent its current draft toggle as false.
    if (b.site_published !== undefined && !(builderAction === 'draft' && revisionSaved)) update.site_published = !!b.site_published

    // Auto-assign a web address the first time a site is published (e.g. right after a
    // template is applied) so it goes live immediately without the dealer hand-picking a
    // slug. Derived from the dealership name; de-duplicated with a numeric suffix.
    if (update.site_published === true && update.site_slug === undefined) {
      const { data: cur } = await supabaseAdmin.from('dealerships').select('name, site_slug').eq('id', req.dealershipId).maybeSingle()
      if (!cur?.site_slug) {
        let base = slugify(cur?.name || '') || 'dealer'
        if (base.length < 3) base = ('dealer-' + base).replace(/-$/, '').slice(0, 40)
        let slug = base, n = 1
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: taken } = await supabaseAdmin.from('dealerships')
            .select('id').ilike('site_slug', slug).neq('id', req.dealershipId).maybeSingle()
          if (!taken) break
          slug = (base.slice(0, 36) + '-' + (++n)).slice(0, 40)
        }
        update.site_slug = slug
      }
    }

    if (b.custom_domain !== undefined) {
      const dom = String(b.custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      const { data: cur } = await supabaseAdmin.from('dealerships').select('custom_domain, custom_domain_cf_id').eq('id', req.dealershipId).single()
      if (dom) {
        if (!domainOk(dom)) return res.status(400).json({ error: 'Enter a valid domain like yourdealership.com or www.yourdealership.com (no http:// or paths).' })
        const bare = dom.replace(/^www\./, '')
        const { data: taken } = await supabaseAdmin.from('dealerships').select('id')
          .or(`custom_domain.ilike.${bare},custom_domain.ilike.www.${bare}`).neq('id', req.dealershipId).maybeSingle()
        if (taken) return res.status(409).json({ error: 'That domain is already connected to another account.' })
        update.custom_domain = dom
        update.custom_domain_verified = false
        update.custom_domain_added_at = new Date().toISOString()
        if (CF_ENABLED && dom !== cur?.custom_domain) {
          await cfDeleteHostname(cur?.custom_domain_cf_id)
          update.custom_domain_cf_id = await cfCreateHostname(dom)   // provisions the TLS cert
        }
      } else {
        if (CF_ENABLED) await cfDeleteHostname(cur?.custom_domain_cf_id)
        update.custom_domain = null; update.custom_domain_verified = false; update.custom_domain_cf_id = null
      }
    }

    // Merge site content into the shared branding jsonb (don't wipe sticker fields).
    const contentKeys = ['tagline', 'about', 'hours', 'phone', 'email', 'address', 'hero_url', 'primary_color', 'secondary_color', 'accent_color', 'facebook_url', 'instagram_url', 'typography', 'heading_font', 'body_font', 'hero_photos', 'seo_title', 'seo_description', 'seo_keywords', 'seo_image', 'discovery_summary', 'discovery_terms', 'discovery_intents', 'discovery_enabled']
    const touchesContent = (!revisionSaved || builderAction === 'publish') && (contentKeys.some(k => b[k] !== undefined) || b.inventory_source !== undefined || b.theme !== undefined || b.head_html !== undefined || b.widgets !== undefined || b.pages !== undefined || b.sections !== undefined || b.staff !== undefined || b.build_makes !== undefined || b.builtins !== undefined || b.menu_order !== undefined || b.sales_chat !== undefined || b.chat_name !== undefined || b.chat_kb !== undefined || b.chat_instructions !== undefined || b.chat_disclaimer !== undefined)
    if (touchesContent) {
      const { data: cur } = await supabaseAdmin.from('dealerships').select('branding').eq('id', req.dealershipId).single()
      const branding = { ...(cur?.branding || {}) }
      for (const k of contentKeys) if (b[k] !== undefined) branding[k] = b[k] === '' ? null : b[k]
      if (b.inventory_source !== undefined) branding.site_inventory_source = ['auto', 'dealer', 'marketplace', 'merged'].includes(b.inventory_source) ? b.inventory_source : 'auto'
      if (b.sales_chat !== undefined) branding.site_sales_chat = !!b.sales_chat
      if (b.chat_name !== undefined) branding.site_chat_name = String(b.chat_name || '').slice(0, 60) || null
      if (b.chat_kb !== undefined) branding.site_chat_kb = String(b.chat_kb || '').slice(0, 12000) || null
      if (b.chat_instructions !== undefined) branding.site_chat_instructions = String(b.chat_instructions || '').slice(0, 4000) || null
      if (b.chat_disclaimer !== undefined) branding.site_chat_disclaimer = String(b.chat_disclaimer || '').slice(0, 600) || null
      if (b.head_html !== undefined) branding.site_head_html = stripScriptsFromHead(String(b.head_html || '')).slice(0, 20000) || null
      if (b.discovery_summary !== undefined) branding.discovery_summary = String(b.discovery_summary || '').trim().slice(0, 600) || null
      if (b.discovery_terms !== undefined) branding.discovery_terms = cleanDiscoveryTerms(b.discovery_terms)
      if (b.discovery_intents !== undefined) branding.discovery_intents = cleanDiscoveryTerms(b.discovery_intents)
      if (b.discovery_enabled !== undefined) branding.discovery_enabled = b.discovery_enabled !== false
      if (b.widgets !== undefined) branding.site_widgets = cleanWidgets(b.widgets)
      if (b.pages !== undefined) branding.site_pages = cleanPages(b.pages)
      if (b.staff !== undefined) branding.site_team = cleanStaff(b.staff)
      if (b.build_makes !== undefined) branding.build_makes = cleanMakes(b.build_makes)
      if (b.builtins !== undefined) branding.site_builtins = cleanBuiltins(b.builtins)
      if (b.menu_order !== undefined) branding.site_menu_order = cleanMenuOrder(b.menu_order)
      if (b.sections !== undefined) branding.site_sections = cleanSections(b.sections)
      if (b.typography !== undefined) branding.typography = TYPOGRAPHY.includes(b.typography) ? b.typography : 'modern'
      if (b.theme !== undefined) branding.site_theme = SITE_THEMES.includes(b.theme) ? b.theme : 'classic'
      update.branding = branding
    }

    if (!Object.keys(update).length) return res.json({ ok: true, revision: revisionInfo })
    const { error } = await supabaseAdmin.from('dealerships').update(update).eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    if (builderAction === 'publish' && revisionInfo) {
      // Dealer websites are rendered from the published Supabase projection, so
      // this deployment is synchronous. Keep an auditable deployment record in
      // the shared deployment table used by HQ rather than inventing a second
      // history system for dealer sites.
      await supabaseAdmin.from('website_deployments').insert({
        site_id: req.dealershipId,
        trigger_type: 'publish',
        status: 'verified',
        published_summary: { revision_id: revisionInfo.id, revision_number: revisionInfo.number, change_summary: rawBody.change_summary || 'Published website builder changes' },
        deployed_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        verified_status: 'Database-backed public site state confirmed',
        created_by: req.user?.id,
      })
    }
    audit(req, 'site.configuration_updated', { after_state: { fields: Object.keys(update), site_published: update.site_published, site_slug: update.site_slug, custom_domain: update.custom_domain } })
    res.json({ ok: true, site_slug: update.site_slug, site_published: update.site_published, custom_domain: update.custom_domain, domain_target: SITE_HOST, revision: revisionInfo, current_revision: revisionInfo })
  })

  // ── ADMIN: check whether the dealer's custom domain now points at us ─────────
  app.post('/dealership/site/verify-domain', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    const { data: d } = await supabaseAdmin.from('dealerships').select('custom_domain, custom_domain_cf_id').eq('id', req.dealershipId).single()
    const dom = d?.custom_domain
    if (!dom) return res.status(400).json({ error: 'Add a domain first.' })
    let ok = false
    if (CF_ENABLED) {
      // Cloudflare tells us authoritatively when the hostname + cert are live.
      let cfId = d.custom_domain_cf_id
      if (!cfId) { cfId = await cfCreateHostname(dom); if (cfId) await supabaseAdmin.from('dealerships').update({ custom_domain_cf_id: cfId }).eq('id', req.dealershipId) }
      ok = await cfHostnameActive(cfId)
    } else {
      const bare = dom.replace(/^www\./, '')
      for (const n of [dom, bare, 'www.' + bare]) {
        try { const c = await dns.resolveCname(n); if (c.some(x => x.toLowerCase().includes(SITE_HOST))) { ok = true; break } } catch {}
      }
      if (!ok) {
        try {
          const [ourA, theirA] = await Promise.all([dns.resolve4(SITE_HOST).catch(() => []), dns.resolve4(dom).catch(() => [])])
          if (theirA.length && theirA.some(ip => ourA.includes(ip))) ok = true
        } catch {}
      }
    }
    await supabaseAdmin.from('dealerships').update({ custom_domain_verified: ok }).eq('id', req.dealershipId)
    audit(req, 'site.domain_verified', { after_state: { domain: dom, verified: ok } })
    res.json({ verified: ok, domain: dom, target: SITE_HOST, message: ok ? 'Connected! Your domain is live with a secure certificate.' : 'Not live yet — DNS/SSL can take a few minutes to an hour after you add the record. Try again shortly.' })
  })

  // ── Dealer blog — authoring (owner / GM), RLS-scoped via req.supabase ────────
  const BLOG_COLS = 'id, slug, title, excerpt, content_html, cover_image_url, author, tags, status, seo_title, seo_description, published_at, created_at, updated_at'
  async function uniqueBlogSlug(supa, dealershipId, base, ignoreId) {
    let slug = slugify(base) || 'post'; let n = 1
    while (true) {
      let q = supa.from('dealer_blog_posts').select('id').eq('dealership_id', dealershipId).eq('slug', slug)
      if (ignoreId) q = q.neq('id', ignoreId)
      const { data } = await q.maybeSingle()
      if (!data) return slug
      slug = `${slugify(base) || 'post'}-${++n}`
    }
  }

  app.get('/dealership/blog', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await req.supabase.from('dealer_blog_posts')
      .select(BLOG_COLS).eq('dealership_id', req.dealershipId).order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ posts: data || [] })
  })

  app.post('/dealership/blog', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const title = String(b.title || '').trim()
    if (!title) return res.status(400).json({ error: 'Title is required' })
    const slug = await uniqueBlogSlug(req.supabase, req.dealershipId, b.slug || title)
    const status = b.status === 'published' ? 'published' : 'draft'
    const row = {
      dealership_id: req.dealershipId, slug, title,
      excerpt: String(b.excerpt || '').trim(),
      content_html: String(b.content_html || ''),
      cover_image_url: b.cover_image_url || null,
      author: String(b.author || '').trim() || null,
      tags: Array.isArray(b.tags) ? b.tags.filter(Boolean).map(String) : [],
      status, seo_title: b.seo_title || null, seo_description: b.seo_description || null,
      published_at: status === 'published' ? new Date().toISOString() : null,
      created_by: req.user.id,
    }
    const { data, error } = await req.supabase.from('dealer_blog_posts').insert(row).select(BLOG_COLS).single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ post: data })
  })

  app.patch('/dealership/blog/:id', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const { data: existing } = await req.supabase.from('dealer_blog_posts')
      .select('id, status, published_at').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'Post not found' })
    const patch = { updated_at: new Date().toISOString() }
    if (b.title !== undefined) patch.title = String(b.title || '').trim()
    if (b.excerpt !== undefined) patch.excerpt = String(b.excerpt || '').trim()
    if (b.content_html !== undefined) patch.content_html = String(b.content_html || '')
    if (b.cover_image_url !== undefined) patch.cover_image_url = b.cover_image_url || null
    if (b.author !== undefined) patch.author = String(b.author || '').trim() || null
    if (b.tags !== undefined) patch.tags = Array.isArray(b.tags) ? b.tags.filter(Boolean).map(String) : []
    if (b.seo_title !== undefined) patch.seo_title = b.seo_title || null
    if (b.seo_description !== undefined) patch.seo_description = b.seo_description || null
    if (b.slug !== undefined && b.slug) patch.slug = await uniqueBlogSlug(req.supabase, req.dealershipId, b.slug, existing.id)
    if (b.status !== undefined) {
      patch.status = b.status === 'published' ? 'published' : 'draft'
      if (patch.status === 'published' && !existing.published_at) patch.published_at = new Date().toISOString()
    }
    const { data, error } = await req.supabase.from('dealer_blog_posts')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select(BLOG_COLS).single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ post: data })
  })

  app.delete('/dealership/blog/:id', requireAuth, requireMfa, requireProduct('marketsync_website'), requirePermission('site.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { error } = await req.supabase.from('dealer_blog_posts')
      .delete().eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── PUBLIC: a dealer's published blog (served for the public site) ───────────
  async function dealerBySlug(slug) {
    const s = String(slug || '').toLowerCase().trim()
    if (!s) return null
    const { data } = await supabaseAdmin.from('dealerships').select('id, name, site_published').ilike('site_slug', s).maybeSingle()
    return (data && data.site_published) ? data : null
  }
  app.get('/site/:slug/blog', rateLimit('pub-site-blog', 120, 60000), async (req, res) => {
    const d = await dealerBySlug(req.params.slug)
    if (!d) return res.status(404).json({ error: 'Site not found' })
    const { data } = await supabaseAdmin.from('dealer_blog_posts')
      .select('slug, title, excerpt, cover_image_url, author, tags, published_at')
      .eq('dealership_id', d.id).eq('status', 'published').order('published_at', { ascending: false }).limit(100)
    res.json({ posts: data || [] })
  })
  app.get('/site/:slug/blog/:postSlug', rateLimit('pub-site-blogpost', 120, 60000), async (req, res) => {
    const d = await dealerBySlug(req.params.slug)
    if (!d) return res.status(404).json({ error: 'Site not found' })
    const { data } = await supabaseAdmin.from('dealer_blog_posts')
      .select('slug, title, excerpt, content_html, cover_image_url, author, tags, published_at, seo_title, seo_description')
      .eq('dealership_id', d.id).eq('slug', String(req.params.postSlug || '').toLowerCase()).eq('status', 'published').maybeSingle()
    if (!data) return res.status(404).json({ error: 'Post not found' })
    res.json({ post: data })
  })
}
