import multer from 'multer'
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notifications.js'
import { fetchOemWindowStickerPdf } from '../utils/oemWindowSticker.js'
import { fetchOemBrochurePdf } from '../utils/oemBrochure.js'
import { brandVehiclePhotos } from '../utils/photoOverlay.js'
import { fontFaceCss } from '../utils/brochureFonts.js'
import { withHeadlessGuard } from '../puppeteerRenderer.js'
import { recordUsage, marketcheckAllowed, recordMarketcheckCall } from '../usage.js'
import { marketcheckEnabled, marketcheckDecodeVin } from '../marketcheck.js'
import { carapiEnabled, carapiDecodeVin } from '../carapi.js'
import { buildFeatureList, imgToDataUri, generatePdf } from './submodules/vinsticker-renderer.js'
import { buildWindowStickerHtml, buildBrochureHtml } from './submodules/vinsticker-templates.js'
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } })

const NHTSA_DECODE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended'
const NHTSA_RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVin'

function requireDealerAdmin(req, res, next) {
  if (!['DEALER_ADMIN', 'DEALER_STAFF', 'SALES_REP', 'MANAGER', 'OWNER'].includes(req.profile?.role)) {
    return res.status(403).json({ error: 'Dealer access required' })
  }
  next()
}

// Entitlements:
//  • The VIN decoder + factory (OEM) window stickers/brochures are part of the
//    Inventory Intelligence tier.
//  • The generated/branded MarketSync sticker and AI-written brochure require AI Boost.
function hasAiBoost(dealer, req) {
  if (hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) return true
  return !!dealer?.ai_boost_active
}
function hasInvIntel(dealer, req) {
  if (hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) return true
  return !!dealer?.inv_intel_active
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pick(obj, ...keys) {
  for (const k of keys) if (obj[k]) return obj[k]
  return ''
}

async function loadDealershipData(dealershipId) {
  const { data, error } = await supabaseAdmin
    .from('dealerships')
    .select('id, name, website_url, branding, vin_sticker_active, ai_boost_active, inv_intel_active')
    .eq('id', dealershipId)
    .single()
  if (error) console.error('[loadDealershipData]', error.message)
  return data
}

// Short AI "why buy this" line for the branded window sticker (AI Boost).
async function buildStickerBlurb(vehicle) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
    const prompt = `Write ONE punchy sentence (max 22 words) for a car-dealership window sticker highlighting why this vehicle is a great buy. No markdown, no quotes, no emojis.
Vehicle: ${label}${vehicle.mileage ? `, ${Number(vehicle.mileage).toLocaleString()} km` : ''}${vehicle.price ? `, $${Number(vehicle.price).toLocaleString()}` : ''}.
Notable: ${(vehicle.description || '').slice(0, 400) || 'well-equipped'}.`
    const msg = await Promise.race([
      anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 80, messages: [{ role: 'user', content: prompt }] }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 15000)),
    ])
    return (msg?.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '') || null
  } catch { return null }
}




// ── Model research (cached per model) ─────────────────────────────────────────
// Full trim / package / MSRP / fuel-economy / lifestyle breakdown for a
// year+make+model, researched once via Claude and cached in vehicle_model_specs.
// Every future brochure for the SAME model reuses the cache → near-zero AI cost
// after the first. Returns the parsed object, or null when unavailable.
async function getModelSpecs(vehicle, dealer) {
  const isUS = /^(US|USA|UNITED STATES)$/.test((dealer?.country || '').trim().toUpperCase())
  const country = isUS ? 'US' : 'CA'
  const cur = isUS ? 'USD' : 'CAD'
  const sig = [vehicle.year, vehicle.make, vehicle.model, country]
    .map(s => String(s ?? '').toLowerCase().trim()).join('|')

  // Cache hit — model specs are static for a given model-year, so keep ~1 year.
  try {
    const { data: hit } = await supabaseAdmin
      .from('vehicle_model_specs').select('data, generated_at').eq('signature', sig).maybeSingle()
    if (hit && (Date.now() - new Date(hit.generated_at)) < 365 * 86400000) return hit.data
  } catch { /* table not provisioned yet — fall through to live research */ }

  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `You are an automotive product specialist. Research the ${vehicle.year} ${vehicle.make} ${vehicle.model} for the ${isUS ? 'United States' : 'Canadian'} market and return ONLY valid JSON (no markdown) with this exact shape:
{
  "model_intro": "2-4 sentences introducing this model line and what sets it apart",
  "lifestyle": "1-2 sentences describing the ideal owner and how they'll use it",
  "trims": [ { "name": "trim name", "msrp": "from $XX,XXX ${cur} (approx.)", "summary": "1 sentence", "features": ["3-6 headline features this trim adds"] } ],
  "packages": [ { "name": "option/package name", "detail": "what it includes", "availability": "which trims it's offered on" } ],
  "fuel_economy": {
    "note": "one short line naming the powertrain these ratings are for",
    "gas": { "city_l100": number|null, "hwy_l100": number|null, "combined_l100": number|null, "city_mpg": number|null, "hwy_mpg": number|null, "combined_mpg": number|null },
    "electric": { "range_km": number|null, "range_mi": number|null, "kwh": number|null }
  }
}
Rules:
- List EVERY trim offered for this model-year (e.g. WT, LT, Z71, Trail Boss…), ascending, each with approximate MSRP in ${cur}. Always mark pricing "(approx.)".
- List the notable option PACKAGES buyers can add and which trims they're on.
- Give official-style combined/city/highway fuel economy in BOTH L/100km AND US MPG (convert if only one is published). For an EV, fill "electric" (range in km and miles, battery kWh) and leave the gas figures null.
- Be accurate; give the closest realistic manufacturer values and keep "(approx.)". NEVER invent trims that don't exist for this make/model. Keep every string tight for print.`
    const call = anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2400, messages: [{ role: 'user', content: prompt }] })
    const message = await Promise.race([call, new Promise((_, r) => setTimeout(() => r(new Error('specs timeout')), 55000))])
    let text = (message?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    const a = text.indexOf('{'), b = text.lastIndexOf('}')
    if (a >= 0 && b > a) text = text.slice(a, b + 1)
    const parsed = JSON.parse(text)
    supabaseAdmin.from('vehicle_model_specs')
      .upsert({ signature: sig, data: parsed, generated_at: new Date().toISOString() })
      .then(() => {}).catch(() => {})
    return parsed
  } catch (e) {
    console.warn('[brochure] model specs failed:', e.message)
    return null
  }
}

// ── Per-vehicle cover copy (cheap, per unit) ──────────────────────────────────
// Cover headline/subhead + two highlight paragraphs about THIS specific unit.
// Always returns something (templated fallback) so the brochure never blocks.
async function generateVehicleHighlight(vehicle, dealer) {
  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
  const trim = vehicle.trim || ''
  const isUS = /^(US|USA|UNITED STATES)$/.test((dealer?.country || '').trim().toUpperCase())
  const distUnit = isUS ? 'mi' : 'km'
  const price = vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Call for price'
  const fallback = {
    headline: (`The ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`.trim()) || name,
    cover_subhead: `The ${name}${trim ? ' ' + trim : ''} — engineered for the way you drive.`,
    highlight: [
      `This ${name}${trim ? ' ' + trim : ''}${vehicle.exterior_color ? `, finished in ${vehicle.exterior_color}` : ''}${vehicle.interior_color ? ` with a ${vehicle.interior_color} interior` : ''}, is ready to make every drive feel special.`,
      `Priced at ${price}${vehicle.stocknumber ? ` (Stock #${vehicle.stocknumber})` : ''}, it's an exceptional opportunity${dealer?.name ? ` at ${dealer.name}` : ''}. Visit us and take it for a test drive.`,
    ],
  }
  if (!process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const prompt = `Write printed-brochure cover copy for this specific vehicle. Return ONLY JSON: {"headline":"max 8 words","cover_subhead":"one benefit sentence","highlight":["~50 words on THIS vehicle & its ${trim || 'trim'}, colour and standout features","~45 words on value + an invitation to visit ${dealer?.name || 'the dealership'}"]}. Warm, confident ${isUS ? 'American' : 'Canadian'} English.
VEHICLE: ${name} ${trim} · ${price} · ${vehicle.mileage ? Number(vehicle.mileage).toLocaleString() + ' ' + distUnit : 'brand new'} · ${vehicle.engine || ''} · ${vehicle.drivetrain || ''} · ${vehicle.exterior_color || ''}/${vehicle.interior_color || ''}
Notes: ${(vehicle.description || '').slice(0, 400)}`
    const call = anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 550, messages: [{ role: 'user', content: prompt }] })
    const message = await Promise.race([call, new Promise((_, r) => setTimeout(() => r(new Error('hl timeout')), 30000))])
    let text = (message?.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
    const a = text.indexOf('{'), b = text.lastIndexOf('}')
    if (a >= 0 && b > a) text = text.slice(a, b + 1)
    const p = JSON.parse(text)
    return {
      headline: p.headline || fallback.headline,
      cover_subhead: p.cover_subhead || fallback.cover_subhead,
      highlight: Array.isArray(p.highlight) && p.highlight.length ? p.highlight.slice(0, 2) : fallback.highlight,
    }
  } catch (e) {
    console.warn('[brochure] highlight failed:', e.message)
    return fallback
  }
}


async function uploadPdf(buffer, path) {
  const { error } = await supabaseAdmin.storage.from('vehicle-pdfs').upload(path, buffer, {
    contentType: 'application/pdf', upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabaseAdmin.storage.from('vehicle-pdfs').getPublicUrl(path)
  return publicUrl
}

// ── Route registration ──────────────────────────────────────────────────────

export function registerRoutes(app) {

  // ── Branding: GET ──────────────────────────────────────────────────────
  app.get('/branding', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .select('name, website_url, branding, vin_sticker_active')
      .eq('id', req.dealershipId)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // ── Branding: PUT ──────────────────────────────────────────────────────
  app.put('/branding', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    // Merge onto existing branding so a partial save never wipes other fields.
    const { data: current } = await supabaseAdmin
      .from('dealerships').select('branding').eq('id', req.dealershipId).single()
    const branding = { ...(current?.branding || {}) }
    for (const k of ['primary_color', 'secondary_color', 'tagline', 'logo_url',
                     'overlay_enabled', 'overlay_phone', 'overlay_position', 'overlay_logo',
                     'facebook_url', 'instagram_url', 'twitter_url', 'linkedin_url', 'youtube_url', 'tiktok_url']) {
      if (b[k] !== undefined) branding[k] = b[k]
    }

    const { error } = await supabaseAdmin
      .from('dealerships')
      .update({ branding })
      .eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, branding })
  })

  // ── Brand a vehicle's photos (phone/logo overlay) ──────────────────────
  app.post('/photos/brand/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: vehicle, error } = await supabaseAdmin
      .from('inventory')
      .select('id, image_urls, branded_image_urls')
      .eq('id', req.params.vehicleId).eq('dealership_id', req.dealershipId).single()
    if (error || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    const dealer = await loadDealershipData(req.dealershipId)
    if (!dealer?.branding?.overlay_enabled) {
      return res.status(400).json({ error: 'Photo overlays are turned off. Enable them in Branding first.' })
    }
    try {
      const urls = await brandVehiclePhotos({ ...vehicle, id: vehicle.id }, { id: req.dealershipId, branding: dealer.branding }, { force: req.query.regen === '1' })
      if (!urls) return res.status(422).json({ error: 'Could not brand these photos (no usable images or overlay disabled).' })
      res.json({ branded_image_urls: urls })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Branding logo upload ───────────────────────────────────────────────
  app.post('/branding/logo', requireAuth, requireDealerAdmin, upload.single('logo'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!req.file) return res.status(400).json({ error: 'No file' })
    const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    const path = `${req.dealershipId}/logo.${ext}`
    const { error } = await supabaseAdmin.storage.from('dealer-branding').upload(path, req.file.buffer, {
      contentType: req.file.mimetype, upsert: true,
    })
    if (error) return res.status(500).json({ error: error.message })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('dealer-branding').getPublicUrl(path)

    // Persist to branding jsonb
    const { data: current } = await supabaseAdmin.from('dealerships').select('branding').eq('id', req.dealershipId).single()
    const merged = { ...(current?.branding || {}), logo_url: publicUrl }
    await supabaseAdmin.from('dealerships').update({ branding: merged }).eq('id', req.dealershipId)

    res.json({ url: publicUrl })
  })

  // ── VIN decode ────────────────────────────────────────────────────────
  app.get('/vin/decode/:vin', requireAuth, requireDealerAdmin, async (req, res) => {
    const vin = (req.params.vin || '').trim().toUpperCase()
    if (!vin || vin.length < 11) return res.status(400).json({ error: 'Invalid VIN' })

    // VIN decoder is part of the Inventory Intelligence tier.
    const dealer = await loadDealershipData(req.dealershipId)
    if (!hasInvIntel(dealer, req)) {
      return res.status(403).json({ error: 'The VIN decoder is part of Inventory Intelligence' })
    }

    try {
      const [decodeRes, recallRes] = await Promise.allSettled([
        fetch(`${NHTSA_DECODE}/${encodeURIComponent(vin)}?format=json`).then(r => r.json()),
        fetch(`${NHTSA_RECALLS}?vin=${encodeURIComponent(vin)}`).then(r => r.json()),
      ])

      let decoded = {}
      let allFields = []
      if (decodeRes.status === 'fulfilled') {
        const r = decodeRes.value?.Results?.[0] || {}
        // Full deep-dive: every non-empty NHTSA field, as label/value pairs, so the
        // modal can show ALL of it (not just the curated subset). Noise keys dropped.
        const NOISE = /^(ErrorCode|ErrorText|AdditionalErrorText|SuggestedVIN|PossibleValues|VIN|VehicleDescriptor|NCSABodyType|NCSAMake|NCSAModel|NCSAMapExcApprovedBy|NCSAMapExcApprovedOn|NCSANote|NCSAMappingException)$/
        allFields = Object.entries(r)
          .filter(([k, v]) => v != null && String(v).trim() !== '' && String(v).trim() !== 'Not Applicable' && String(v).trim() !== '0' && !NOISE.test(k))
          .map(([k, v]) => ({ label: k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim(), value: String(v).trim() }))
        const nv = v => (v && v !== 'Not Applicable' && v !== '0' && v.trim() !== '') ? v.trim() : null
        const ni = v => { const n = parseInt(v); return isNaN(n) ? null : n }
        const nf = v => { const n = parseFloat(v); return isNaN(n) ? null : n }

        // Build engine string
        const dispL = nf(r.DisplacementL)
        const cyls  = nv(r.EngineCylinders)
        const engineStr = [
          dispL    ? `${dispL}L`                             : null,
          cyls     ? `${cyls}-cyl`                           : null,
          nv(r.EngineConfiguration),
          nv(r.ValveTrainDesign),
          nv(r.Turbo) === 'Yes' ? 'Turbocharged'            : null,
          nv(r.EngineHP) ? `${nv(r.EngineHP)} HP`           : null,
        ].filter(Boolean).join(' ') || null

        decoded = {
          vin,
          // Core inventory fields
          year:         nv(r.ModelYear),
          make:         nv(r.Make),
          model:        nv(r.Model),
          trim:         nv(r.Trim),
          body_style:   nv(r.BodyClass),
          doors:        ni(r.Doors),
          fuel_type:    nv(r.FuelTypePrimary),
          drivetrain:   nv(r.DriveType),
          transmission: nv(r.TransmissionStyle),
          engine:       engineStr,
          // Extended VIN data (stored in vin_data jsonb)
          vin_data: {
            // Identity
            manufacturer:        nv(r.Manufacturer),
            vehicle_type:        nv(r.VehicleType),
            series:              nv(r.Series) || nv(r.Series2),
            // Assembly plant
            plant_city:          nv(r.PlantCity),
            plant_state:         nv(r.PlantState),
            plant_country:       nv(r.PlantCountry),
            plant_company:       nv(r.PlantCompanyName),
            // Engine details
            engine_model:        nv(r.EngineModel),
            engine_manufacturer: nv(r.EngineManufacturer),
            engine_config:       nv(r.EngineConfiguration),
            valve_train:         nv(r.ValveTrainDesign),
            displacement_l:      dispL,
            displacement_cc:     nf(r.DisplacementCC),
            cylinders:           nv(r.EngineCylinders),
            horsepower:          nv(r.EngineHP),
            turbo:               nv(r.Turbo),
            fuel_type_secondary: nv(r.FuelTypeSecondary),
            fuel_injection:      nv(r.FuelDeliveryFuelInjectionType),
            electrification:     nv(r.ElectrificationLevel),
            // Transmission
            transmission_speeds: nv(r.TransmissionSpeed),
            // Chassis & body
            wheel_base:          nv(r.WheelBaseLong) || nv(r.WheelBaseShort),
            wheel_size_front:    nv(r.WheelSizeFront),
            wheel_size_rear:     nv(r.WheelSizeRear),
            wheels:              nv(r.Wheels),
            axles:               nv(r.Axles),
            windows:             nv(r.Windows),
            seat_rows:           nv(r.SeatRows),
            seats:               nv(r.Seats),
            // Weight / capacity
            gvwr:                nv(r.GVWR),
            curb_weight_lb:      nv(r.CurbWeightLB),
            // Brakes / steering
            brake_system:        nv(r.BrakeSystemType),
            brake_desc:          nv(r.BrakeSystemDesc),
            steering_location:   nv(r.SteeringLocation),
            // Safety systems
            abs:                 nv(r.ABS),
            esc:                 nv(r.ESC),
            tpms:                nv(r.TPMS),
            forward_collision:   nv(r.ForwardCollisionWarning),
            lane_departure:      nv(r.LaneDepartureWarning),
            lane_keep:           nv(r.LaneKeepSystem),
            blind_spot_mon:      nv(r.BlindSpotMon),
            blind_spot_interv:   nv(r.BlindSpotIntervention),
            adaptive_cruise:     nv(r.AdaptiveCruiseControl),
            auto_brake:          nv(r.AutomaticEmergencyBraking) || nv(r.RearAutomaticEmergencyBraking),
            adaptive_headlights: nv(r.AdaptiveHeadlights),
            adaptive_beam:       nv(r.AdaptiveDrivingBeam),
            // Airbags
            airbag_front:        nv(r.AirBagLocFront),
            airbag_side:         nv(r.AirBagLocSide),
            airbag_curtain:      nv(r.AirBagLocCurtain),
            airbag_knee:         nv(r.AirBagLocKnee),
            // Keyless / automation
            keyless_ignition:    nv(r.KeylessIgnition),
            sae_automation:      nv(r.SAEAutomationLevel_To),
            // Error
            decode_error:        r.ErrorCode === '0' ? null : nv(r.ErrorText),
          },
        }
      }

      let recalls = []
      if (recallRes.status === 'fulfilled') {
        recalls = (recallRes.value?.results || []).map(r => ({
          id: r.NHTSACampaignNumber,
          Component: r.Component,
          Summary: r.Summary,
          Consequence: r.Consequence,
          Remedy: r.Remedy,
          ReportReceivedDate: r.ReportReceivedDate,
        }))
      }

      // Enrich with MarketCheck neovin specs (fuel economy, MSRP, factory options)
      // when live data is available — a metered + capped call, gracefully skipped
      // if over cap or unavailable. Richer paid fields are prepended so they show
      // first in the modal's full field list.
      try {
        const isOwner = hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)
        const extra = []
        const push = (label, val) => { if (val != null && String(val).trim() !== '') extra.push({ label, value: String(val).trim() }) }
        if (marketcheckEnabled() && vin.length === 17 && await marketcheckAllowed(req.dealershipId, isOwner)) {
          const specs = await marketcheckDecodeVin(vin)
          await recordMarketcheckCall(req.dealershipId)
          if (specs && typeof specs === 'object') {
            push('City MPG', specs.city_mpg ?? specs.epa_city_mpg)
            push('Highway MPG', specs.highway_mpg ?? specs.epa_highway_mpg)
            push('Combined MPG', specs.combined_mpg ?? specs.epa_combined_mpg)
            push('MSRP', specs.msrp != null ? '$' + Number(specs.msrp).toLocaleString() : null)
            push('Body Subtype', specs.body_subtype)
            push('Drivetrain (MarketCheck)', specs.drivetrain)
            const opts = specs.options ?? specs.high_value_features ?? specs.installed_options
            if (Array.isArray(opts) && opts.length) push('Factory options', opts.map(o => o?.name || o).filter(Boolean).slice(0, 30).join(', '))
            else if (typeof opts === 'string') push('Factory options', opts)
          }
        }
        // Fallback: if MarketCheck was off / over-cap / returned nothing, try CarAPI.
        if (!extra.length && carapiEnabled() && vin.length === 17) {
          const cs = await carapiDecodeVin(vin)
          if (cs) {
            push('City MPG', cs.city_mpg)
            push('Highway MPG', cs.highway_mpg)
            push('Combined MPG', cs.combined_mpg)
            push('MSRP', cs.msrp != null ? '$' + Number(cs.msrp).toLocaleString() : null)
            push('Drivetrain (CarAPI)', cs.drivetrain)
            if (cs.options && cs.options.length) push('Factory options', cs.options.join(', '))
            // Backfill core decoded fields NHTSA may have left blank.
            if (cs.engine && !decoded.engine) decoded.engine = cs.engine
            if (cs.fuel_type && !decoded.fuel_type) decoded.fuel_type = cs.fuel_type
            if (cs.doors && !decoded.doors) decoded.doors = cs.doors
            if (cs.body_type && !decoded.body_style) decoded.body_style = cs.body_type
          }
        }
        if (extra.length) allFields = extra.concat(allFields)
      } catch { /* enrichment is a bonus — never fail the decode for it */ }

      res.json({ decoded, recalls, recall_count: recalls.length, all_fields: allFields })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── Apply VIN decode to inventory vehicle ─────────────────────────────
  app.post('/vin/apply/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { decoded, recalls } = req.body
    if (!decoded) return res.status(400).json({ error: 'No decoded data' })

    const update = {}
    if (decoded.year)         update.year = decoded.year
    if (decoded.make)         update.make = decoded.make
    if (decoded.model)        update.model = decoded.model
    if (decoded.trim)         update.trim = decoded.trim
    if (decoded.body_style)   update.body_style = decoded.body_style
    if (decoded.fuel_type)    update.fuel_type = decoded.fuel_type
    if (decoded.drivetrain)   update.drivetrain = decoded.drivetrain
    if (decoded.transmission) update.transmission = decoded.transmission
    if (decoded.engine)       update.engine = decoded.engine
    if (decoded.doors)        update.doors = decoded.doors
    if (decoded.vin_data)     update.vin_data = decoded.vin_data
    if (recalls) {
      update.recalls = recalls
      update.recalls_checked_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin
      .from('inventory')
      .update(update)
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, updated: Object.keys(update) })
  })

  // ── Generate window sticker ───────────────────────────────────────────
  // ── OEM docs by VIN (Appraisal page — no inventory vehicle needed) ────────
  // Fetch the authentic factory window sticker / brochure for a decoded VIN.
  // OEM only (no AI-generated variant). Inventory Intelligence add-on.
  app.post('/vin/oem-window-sticker', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const dealer = await loadDealershipData(req.dealershipId)
    if (!hasInvIntel(dealer, req)) return res.status(403).json({ error: 'Factory window stickers are part of Inventory Intelligence' })
    const vin = String(req.body?.vin || '').trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return res.status(400).json({ error: 'Enter a valid 17-character VIN' })
    try {
      const oem = await fetchOemWindowStickerPdf({ vin, make: req.body?.make || null }).catch(() => null)
      if (!oem) return res.status(404).json({ error: 'no_oem', message: 'No factory (OEM) window sticker is available for this VIN.' })
      const url = await uploadPdf(oem.buffer, `${req.dealershipId}/appraisal/${vin}-window-sticker-oem.pdf`)
      res.json({ url })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/vin/oem-brochure', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const dealer = await loadDealershipData(req.dealershipId)
    if (!hasInvIntel(dealer, req)) return res.status(403).json({ error: 'Factory brochures are part of Inventory Intelligence' })
    const vin = String(req.body?.vin || '').trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return res.status(400).json({ error: 'Enter a valid 17-character VIN' })
    try {
      const oem = await fetchOemBrochurePdf({ vin, make: req.body?.make, model: req.body?.model, year: req.body?.year }).catch(() => null)
      if (!oem) return res.status(404).json({ error: 'no_oem', message: 'No factory (OEM) brochure is available for this vehicle (on file up to 2023).' })
      const url = await uploadPdf(oem.buffer, `${req.dealershipId}/appraisal/${vin}-brochure-oem.pdf`)
      res.json({ url })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/pdf/window-sticker/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const dealer = await loadDealershipData(req.dealershipId)
    // VIN decoder + factory OEM stickers are part of Inventory Intelligence.
    if (!hasInvIntel(dealer, req)) {
      return res.status(403).json({ error: 'The VIN decoder & window stickers are part of Inventory Intelligence' })
    }
    // The generated (branded) MarketSync sticker additionally needs AI Boost.
    // Anything that isn't an explicit OEM pull is the AI-generated variant.
    if (req.query.source !== 'oem' && !hasAiBoost(dealer, req)) {
      return res.status(403).json({ error: 'Generating a branded sticker requires AI Boost' })
    }

    const { data: vehicle, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (error || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    // OEM and AI-generated stickers are independent documents with independent
    // caches — pulling one never overwrites the other.
    const variant = req.query.source === 'oem' ? 'oem' : 'generated'
    const col = variant === 'oem' ? 'window_sticker_oem_url' : 'window_sticker_gen_url'
    const path = `${req.dealershipId}/${vehicle.id}/window-sticker-${variant}.pdf`

    // Serve this variant from its own cache.
    if (vehicle[col] && req.query.regen !== '1') {
      return res.json({ url: vehicle[col], source: variant, cached: true })
    }

    // OEM: fetch the authentic factory sticker (synchronous). No fallback — the
    // AI-generated sticker is a separate button with its own cache.
    if (variant === 'oem') {
      const oem = await fetchOemWindowStickerPdf(vehicle).catch(() => null)
      if (!oem) return res.status(404).json({ error: 'no_oem', message: 'No factory (OEM) window sticker is available for this VIN.' })
      const url = await uploadPdf(oem.buffer, path)
      await supabaseAdmin.from('inventory')
        .update({ window_sticker_oem_url: url, window_sticker_url: url, window_sticker_source: 'oem' })
        .eq('id', vehicle.id)
      return res.json({ url, source: 'oem', cached: false })
    }

    // AI-generated (branded) — build in the background to avoid platform timeout.
    res.json({ status: 'generating' })

    ;(async () => {
      const deadline = setTimeout(() => {
        console.error('[window-sticker background] hard timeout — killed after 110s')
      }, 110000)
      try {
        const vName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
        const branding = dealer.branding || {}
        // Images are resized to WebP by imgToDataUri to keep HTML payload small
        const imageUrls = (vehicle.image_urls || []).slice(0, 2)
        const [photoDataUris, logoDataUri] = await Promise.all([
          Promise.all(imageUrls.map(u => imgToDataUri(u))),
          branding.logo_url ? imgToDataUri(branding.logo_url) : Promise.resolve(null),
        ])
        // AI enhancement (AI Boost): a one-line "why buy this" blurb, plus the cached
        // model research (MSRP · packages · fuel economy) — shared with the brochure,
        // so it's free when that model was already researched.
        const [stickerBlurb, specs] = await Promise.all([
          buildStickerBlurb(vehicle),
          getModelSpecs(vehicle, dealer),
        ])
        if (stickerBlurb) recordUsage(req.dealershipId, { ai: 1 })
        const html = buildWindowStickerHtml(vehicle, dealer, branding, vehicle.recalls || [], photoDataUris.filter(Boolean), logoDataUri, stickerBlurb, specs)
        const pdf = await generatePdf(html, { landscape: true, viewportWidth: 1100, viewportHeight: 860, timeoutMs: 90000 })
        const url = await uploadPdf(pdf, path)
        await supabaseAdmin.from('inventory')
          .update({ window_sticker_gen_url: url, window_sticker_url: url, window_sticker_source: 'generated' })
          .eq('id', vehicle.id)
        // Surface a clickable notification linking straight to the finished PDF.
        await createNotification({
          dealershipId: req.dealershipId,
          type: 'window_sticker',
          title: 'Window sticker ready',
          body: `Your window sticker for the ${vName} is ready to view or print.`,
          linkUrl: url,
        })
      } catch (e) {
        console.error('[window-sticker background]', e.message)
      } finally {
        clearTimeout(deadline)
      }
    })()
  })

  // ── Poll window sticker status ────────────────────────────────────────
  app.get('/pdf/window-sticker/:vehicleId/status', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const variant = req.query.source === 'oem' ? 'oem' : 'generated'
    const col = variant === 'oem' ? 'window_sticker_oem_url' : 'window_sticker_gen_url'
    const { data: vehicle } = await supabaseAdmin
      .from('inventory')
      .select(col)
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (vehicle?.[col]) return res.json({ status: 'ready', url: vehicle[col], source: variant })
    return res.json({ status: 'generating' })
  })

  // ── Generate brochure ─────────────────────────────────────────────────
  app.post('/pdf/brochure/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const dealer = await loadDealershipData(req.dealershipId)
    // Entitlements mirror the window sticker: the factory (OEM) brochure is part of
    // Inventory Intelligence; the branded/AI-written dealer brochure needs AI Boost.
    const wantsOem = req.query.source === 'oem'
    if (wantsOem) {
      if (!hasInvIntel(dealer, req)) {
        return res.status(403).json({ error: 'The OEM brochure is part of Inventory Intelligence' })
      }
    } else if (!hasAiBoost(dealer, req)) {
      return res.status(403).json({ error: 'The dealer brochure requires AI Boost' })
    }

    const { data: vehicle, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (error || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    // OEM and AI-generated brochures are independent documents with independent
    // caches — pulling one never overwrites the other.
    const variant = wantsOem ? 'oem' : 'generated'
    const col = variant === 'oem' ? 'brochure_oem_url' : 'brochure_gen_url'
    const path = `${req.dealershipId}/${vehicle.id}/brochure-${variant}.pdf`

    if (vehicle[col] && req.query.regen !== '1') {
      return res.json({ url: vehicle[col], source: variant, cached: true })
    }

    // OEM: fetch the authentic manufacturer brochure (Auto-Brochures, up to 2023).
    if (variant === 'oem') {
      const oem = await fetchOemBrochurePdf(vehicle).catch(() => null)
      if (!oem) {
        return res.status(404).json({ error: 'no_oem', message: 'No manufacturer brochure is available for this vehicle (factory brochures are on file up to 2023).' })
      }
      const url = await uploadPdf(oem.buffer, path)
      await supabaseAdmin.from('inventory').update({ brochure_oem_url: url, brochure_url: url, brochure_source: 'oem' }).eq('id', vehicle.id)
      return res.json({ url, source: 'oem', cached: false })
    }

    // AI-written dealer brochure — build in the background to avoid platform timeout.
    res.json({ status: 'generating' })

    ;(async () => {
      const deadline = setTimeout(() => {
        console.error('[brochure background] hard timeout — killed after 110s')
      }, 110000)
      try {
        const branding = dealer.branding || {}
        // Images are resized to WebP by imgToDataUri to keep HTML payload small
        const imageUrls = (vehicle.image_urls || []).slice(0, 2)
        const [photosDataUris, logoDataUri] = await Promise.all([
          Promise.all(imageUrls.map(u => imgToDataUri(u))),
          branding.logo_url ? imgToDataUri(branding.logo_url) : Promise.resolve(null),
        ])
        // Model research (trims · MSRP · packages · fuel economy · lifestyle) is cached
        // per model — so repeat brochures for the same model cost $0. The per-vehicle
        // cover copy is a cheap separate call.
        const [specs, highlight] = await Promise.all([
          getModelSpecs(vehicle, dealer),
          generateVehicleHighlight(vehicle, dealer),
        ])
        recordUsage(req.dealershipId, { ai: specs ? 2 : 1 })   // AI-written copy (AI Boost)
        const html = buildBrochureHtml(vehicle, dealer, branding, vehicle.recalls || [], photosDataUris.filter(Boolean), logoDataUri, { ...highlight, specs })
        const pdf = await generatePdf(html, { landscape: false, viewportWidth: 860, viewportHeight: 1100, timeoutMs: 90000 })
        const url = await uploadPdf(pdf, path)
        await supabaseAdmin.from('inventory').update({ brochure_gen_url: url, brochure_url: url, brochure_source: 'generated' }).eq('id', vehicle.id)
        // Surface a clickable notification linking straight to the finished PDF.
        const vName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
        await createNotification({
          dealershipId: req.dealershipId,
          type: 'brochure',
          title: 'Brochure ready',
          body: `Your full-spec brochure for the ${vName} is ready to view or print.`,
          linkUrl: url,
        })
      } catch (e) {
        console.error('[brochure background]', e.message)
      } finally {
        clearTimeout(deadline)
      }
    })()
  })

  // ── Poll brochure status ──────────────────────────────────────────────
  app.get('/pdf/brochure/:vehicleId/status', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const variant = req.query.source === 'oem' ? 'oem' : 'generated'
    const col = variant === 'oem' ? 'brochure_oem_url' : 'brochure_gen_url'
    const { data: vehicle } = await supabaseAdmin
      .from('inventory')
      .select(col)
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (vehicle?.[col]) return res.json({ status: 'ready', url: vehicle[col], source: variant })
    return res.json({ status: 'generating' })
  })

  // ── Clear cached PDFs when vehicle is sold/deleted ────────────────────
  app.delete('/pdf/cache/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const vehicleId = req.params.vehicleId
    const base = `${req.dealershipId}/${vehicleId}`
    await Promise.allSettled([
      supabaseAdmin.storage.from('vehicle-pdfs').remove([
        `${base}/window-sticker.pdf`, `${base}/window-sticker-oem.pdf`, `${base}/window-sticker-generated.pdf`,
        `${base}/brochure.pdf`, `${base}/brochure-oem.pdf`, `${base}/brochure-generated.pdf`,
      ]),
      supabaseAdmin.from('inventory').update({
        window_sticker_url: null, window_sticker_source: null, window_sticker_oem_url: null, window_sticker_gen_url: null,
        brochure_url: null, brochure_source: null, brochure_oem_url: null, brochure_gen_url: null,
      }).eq('id', vehicleId).eq('dealership_id', req.dealershipId),
    ])
    res.json({ ok: true })
  })
}
