import { supabaseAdmin } from '../../shared.js'
import { rateLimit } from '../../security.js'
import { loadPublicInventory } from './site-public-inventory.js'

const SITE_COLS = 'id, name, branding, site_published, site_slug, custom_domain, city, province, postal_code, website_url, photo_background_url'

function siteContent(d) {
  const b = d.branding || {}
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
    hero_banner_url: b.hero_banner_url || null,
    phone: b.phone || null,
    email: b.email || null,
    address: b.address || null,
    tagline: b.tagline || null,
    hours: b.hours || null,
    socials: b.socials || null,
    widgets: Array.isArray(b.site_widgets) ? b.site_widgets : [],
    menu_order: Array.isArray(b.site_menu_order) ? b.site_menu_order : [],
    sections: Array.isArray(b.site_sections) ? b.site_sections : [],
    pages: Array.isArray(b.site_pages) ? b.site_pages : [],
    builtins: b.site_builtins && typeof b.site_builtins === 'object' ? b.site_builtins : {},
    typography: b.typography || 'modern',
    theme: b.site_theme || 'classic',
    hero_photos: !!b.hero_photos,
    accent_color: b.accent_color || null,
    sales_chat: !!b.site_sales_chat,
    chat_name: b.site_chat_name || null,
    discovery_enabled: b.discovery_enabled !== false,
  }
}

function publicVehicle(v) {
  return {
    id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim,
    price: v.price, mileage: v.mileage, condition: v.condition,
    exterior_color: v.exterior_color, interior_color: v.interior_color,
    drivetrain: v.drivetrain, fuel_type: v.fuel_type, transmission: v.transmission,
    engine: v.engine, body_style: v.body_style, doors: v.doors,
    stocknumber: v.stocknumber, vin: v.vin,
    image_urls: Array.isArray(v.image_urls) ? v.image_urls : [],
    description: v.sales_pitch || v.description || null,
    status: v.status || 'available',
    market_status: v.status || 'available'
  }
}

async function buildSiteResponse(d) {
  const rows = await loadPublicInventory(d.id)
  const inventory = rows.map(publicVehicle)
  return { site: siteContent(d), inventory, vehicles: inventory, team: [], count: inventory.length }
}

async function dealerBySlug(slug) {
  const s = String(slug || '').toLowerCase().trim()
  if (!s) return null
  const { data } = await supabaseAdmin.from('dealerships').select(SITE_COLS).ilike('site_slug', s).maybeSingle()
  return (data && data.site_published) ? data : null
}

async function dealerByHost(host) {
  const h = String(host || '').toLowerCase().trim().replace(/^www\./, '').replace(/:\d+$/, '')
  if (!h) return null
  const { data } = await supabaseAdmin.from('dealerships').select(SITE_COLS)
    .or(`custom_domain.ilike.${h},custom_domain.ilike.www.${h}`).maybeSingle()
  return (data && data.site_published) ? data : null
}

export function registerSitePublicRoutes(app) {
  app.get('/site/:slug', rateLimit('pub-site', 120, 60000), async (req, res) => {
    const d = await dealerBySlug(req.params.slug)
    if (!d) return res.status(404).json({ error: 'Site not found' })
    res.json(await buildSiteResponse(d))
  })

  app.get('/site-by-domain', rateLimit('pub-site-domain', 120, 60000), async (req, res) => {
    const d = await dealerByHost(req.query.host)
    if (!d) return res.status(404).json({ error: 'Site not found' })
    res.json(await buildSiteResponse(d))
  })
}
