import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } })

const NHTSA_DECODE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended'
const NHTSA_RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVin'

function requireDealerAdmin(req, res, next) {
  if (!['DEALER_ADMIN', 'DEALER_STAFF', 'SALES_REP'].includes(req.profile?.role)) {
    return res.status(403).json({ error: 'Dealer access required' })
  }
  next()
}

function requireVinSticker(req, res, next) {
  if (!req.dealershipData?.vin_sticker_active) {
    return res.status(403).json({ error: 'VIN Sticker & Brochure add-on not active' })
  }
  next()
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pick(obj, ...keys) {
  for (const k of keys) if (obj[k]) return obj[k]
  return ''
}

async function loadDealershipData(dealershipId) {
  const { data, error } = await supabaseAdmin
    .from('dealerships')
    .select('id, name, website_url, branding, vin_sticker_active')
    .eq('id', dealershipId)
    .single()
  if (error) console.error('[loadDealershipData]', error.message)
  return data
}

function buildWindowStickerHtml(vehicle, dealer, branding, recalls, photoDataUri, logoDataUri) {
  const primary   = branding.primary_color   || '#003087'
  const secondary = branding.secondary_color || '#c9a84c'

  const logoSrc  = logoDataUri || branding.logo_url || null
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${dealer.name || ''}" style="max-height:48px;max-width:170px;object-fit:contain;display:block;">`
    : `<span style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-.3px;">${dealer.name || 'Your Dealership'}</span>`

  const price     = vehicle.price   ? `$${Number(vehicle.price).toLocaleString()}` : 'Call for Price'
  const mileage   = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km` : (vehicle.condition === 'new' ? 'New Vehicle' : '—')
  const cap       = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
  const vehicleName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
  const basePrice = vehicle.price ? Number(vehicle.price) : null

  // ── Extended VIN data ─────────────────────────────────────────────────────
  const vd = vehicle.vin_data || {}
  const plantStr = [vd.plant_city, vd.plant_state, vd.plant_country].filter(Boolean).join(', ') || null

  // ── Feature columns — blend description keywords WITH NHTSA vin_data ──────
  const desc = (vehicle.description || '').toLowerCase()
  const has  = kw => desc.includes(kw)
  // Helper: format NHTSA yes/no/standard values into human-readable
  const nhtsa = (val, label) => {
    if (!val) return null
    const v = val.toString().toLowerCase()
    if (v === 'not applicable' || v === 'none') return null
    if (v === 'yes' || v === 'standard') return label
    if (v === 'optional') return `${label} (Optional)`
    return label
  }

  const featureCols = [
    {
      title: 'Performance & Mechanical',
      items: [
        vehicle.engine                                   && vehicle.engine,
        vehicle.drivetrain                               && `${vehicle.drivetrain} Drivetrain`,
        vehicle.transmission                             && `${vehicle.transmission} Transmission`,
        vd.transmission_speeds                           && `${vd.transmission_speeds}-Speed Transmission`,
        vehicle.fuel_type                                && `${vehicle.fuel_type} Fuel`,
        vd.fuel_injection                                && `${vd.fuel_injection} Fuel Injection`,
        nhtsa(vd.turbo, 'Turbocharged'),
        vd.horsepower                                    && `${vd.horsepower} Horsepower`,
        vd.displacement_cc                               && `${vd.displacement_cc}cc Displacement`,
        vd.gvwr                                          && `GVWR: ${vd.gvwr}`,
        has('tow') || has('trailer')                     ? 'Towing Package' : null,
        has('awd') || has('4wd') || has('four-wheel')    ? 'Four-Wheel / AWD Capable' : null,
      ].filter(Boolean),
    },
    {
      title: 'Comfort & Convenience',
      items: [
        has('heated seat')                               ? 'Heated Front Seats' : null,
        has('ventilated')                                ? 'Ventilated Seats' : null,
        has('heated steering')                           ? 'Heated Steering Wheel' : null,
        has('remote start')                              ? 'Remote Vehicle Start' : null,
        (has('keyless') || nhtsa(vd.keyless_ignition, 'x')) ? 'Keyless Entry / Push-Button Start' : null,
        has('sunroof') || has('moonroof')                ? 'Power Sunroof / Moonroof' : null,
        has('panoramic')                                 ? 'Panoramic Roof' : null,
        has('power liftgate')                            ? 'Power Liftgate' : null,
        has('leather')                                   ? 'Leather-Appointed Seating' : null,
        has('third row') || has('3rd row')               ? 'Third-Row Seating' : null,
        has('wireless charg')                            ? 'Wireless Charging Pad' : null,
        vd.seat_rows                                     && `${vd.seat_rows} Row Seating`,
        vd.seats                                         && `${vd.seats} Passenger Capacity`,
        vehicle.interior_color                           && `${vehicle.interior_color} Interior`,
        vehicle.exterior_color                           && `${vehicle.exterior_color} Exterior`,
      ].filter(Boolean),
    },
    {
      title: 'Safety & Security',
      items: [
        has('backup camera') || has('rear camera') || has('rearview') ? 'Rear-View Camera' : null,
        nhtsa(vd.blind_spot_mon, 'Blind Spot Monitoring'),
        nhtsa(vd.lane_departure, 'Lane Departure Warning'),
        nhtsa(vd.lane_keep, 'Lane Keep Assist'),
        nhtsa(vd.forward_collision, 'Forward Collision Warning'),
        nhtsa(vd.auto_brake, 'Automatic Emergency Braking'),
        nhtsa(vd.adaptive_cruise, 'Adaptive Cruise Control'),
        nhtsa(vd.adaptive_headlights, 'Adaptive Headlights'),
        nhtsa(vd.abs, 'Anti-Lock Brakes (ABS)'),
        nhtsa(vd.esc, 'Electronic Stability Control'),
        nhtsa(vd.tpms, 'Tire Pressure Monitoring (TPMS)'),
        vd.airbag_front   && `Front Airbags: ${vd.airbag_front}`,
        vd.airbag_side    && `Side Airbags: ${vd.airbag_side}`,
        vd.airbag_curtain && `Curtain Airbags: ${vd.airbag_curtain}`,
        vd.airbag_knee    && `Knee Airbags: ${vd.airbag_knee}`,
        has('park assist') || has('parking sensor')      ? 'Parking Sensors / Assist' : null,
        has('360') || has('surround')                    ? '360° Surround-View Camera' : null,
      ].filter(Boolean),
    },
    {
      title: 'Technology & Connectivity',
      items: [
        has('apple carplay')                             ? 'Apple CarPlay®' : null,
        has('android auto')                              ? 'Android Auto™' : null,
        has('navigation') || has('nav system')           ? 'Built-In Navigation' : null,
        has('bluetooth')                                 ? 'Bluetooth Connectivity' : null,
        has('wi-fi') || has('wifi') || has('hotspot')    ? 'Built-In Wi-Fi Hotspot' : null,
        has('onstar')                                    ? 'OnStar Connected Services' : null,
        has('bose') || has('harman') || has('jbl')       ? 'Premium Audio System' : null,
        has('usb')                                       ? 'USB Charging Ports' : null,
        has('digital cluster') || has('digital dash')    ? 'Digital Instrument Cluster' : null,
        has('heads-up') || has('hud')                    ? 'Heads-Up Display' : null,
        vd.sae_automation                                && `SAE Automation Level: ${vd.sae_automation}`,
      ].filter(Boolean),
    },
  ]

  featureCols.forEach(col => {
    if (!col.items.length) col.items.push('See dealer for full equipment details')
  })

  const colHtml = featureCols.map(col => `
    <div class="fcol">
      <div class="col-hdr">${col.title}</div>
      ${col.items.map(item => `<div class="fi">${item}</div>`).join('')}
    </div>`).join('')

  // ── Build data grid (only if vin_data exists) ─────────────────────────────
  const buildRows = [
    ['Manufacturer',    vd.manufacturer],
    ['Vehicle Type',    vd.vehicle_type],
    ['Series',          vd.series],
    ['Built In',        plantStr],
    ['Plant',           vd.plant_company],
    ['Engine Model',    vd.engine_model],
    ['Engine Mfr',      vd.engine_manufacturer],
    ['Engine Config',   vd.engine_config],
    ['Valve Train',     vd.valve_train],
    ['Displacement',    vd.displacement_l ? `${vd.displacement_l}L / ${vd.displacement_cc || '—'}cc` : null],
    ['Cylinders',       vd.cylinders],
    ['Horsepower',      vd.horsepower ? `${vd.horsepower} HP` : null],
    ['Alt Fuel',        vd.fuel_type_secondary],
    ['Electrification', vd.electrification],
    ['Wheel Base',      vd.wheel_base],
    ['Wheel Size (F)',  vd.wheel_size_front],
    ['Wheel Size (R)',  vd.wheel_size_rear],
    ['Wheels',          vd.wheels],
    ['Axles',           vd.axles],
    ['Windows',         vd.windows],
    ['Curb Weight',     vd.curb_weight_lb ? `${vd.curb_weight_lb} lbs` : null],
    ['Brakes',          vd.brake_system],
    ['Steering',        vd.steering_location],
  ].filter(([, v]) => v)

  const buildDataHtml = buildRows.length ? `
    <div class="build-section">
      <div class="build-hdr">Vehicle Build Data (NHTSA)</div>
      <div class="build-grid">
        ${buildRows.map(([l, v]) => `
          <div class="build-cell">
            <div class="bc-label">${l}</div>
            <div class="bc-val">${v}</div>
          </div>`).join('')}
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Arial',Helvetica,sans-serif;width:1056px;height:816px;background:#fff;color:#111;display:flex;flex-direction:column;overflow:hidden;}

  /* ── HEADER ── */
  .top-hdr{background:${primary};display:flex;align-items:stretch;height:60px;flex-shrink:0;}
  .logo-cell{padding:0 18px;display:flex;align-items:center;min-width:190px;border-right:1px solid rgba(255,255,255,.2);}
  .name-cell{flex:1;padding:0 16px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid rgba(255,255,255,.2);}
  .name-label{font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:3px;}
  .name-val{font-size:20px;font-weight:900;color:#fff;line-height:1;letter-spacing:-.4px;}
  .meta-cell{padding:0 14px;display:flex;flex-direction:column;justify-content:center;gap:2px;border-right:1px solid rgba(255,255,255,.2);min-width:200px;}
  .meta-row{font-size:8.5px;color:rgba(255,255,255,.7);display:flex;gap:4px;align-items:baseline;}
  .meta-row b{color:#fff;font-size:9px;}
  .eng-cell{padding:0 14px;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:220px;}
  .eng-row{font-size:8.5px;color:rgba(255,255,255,.7);display:flex;gap:4px;align-items:baseline;}
  .eng-row b{color:#fff;font-size:9px;}

  .accent-bar{background:${secondary};height:5px;flex-shrink:0;}

  /* ── MAIN LAYOUT ── */
  .main{display:flex;flex:1;min-height:0;}

  /* LEFT = photo + ribbon + columns + build data */
  .left{flex:1;display:flex;flex-direction:column;min-width:0;border-right:2px solid ${primary};}

  .photo{height:168px;background:#dde3ec;overflow:hidden;flex-shrink:0;position:relative;}
  .photo img{width:100%;height:100%;object-fit:cover;object-position:center;}
  .photo-none{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;background:#e8ecf0;}

  .ribbon{display:flex;background:#f0f4f8;border-bottom:1px solid #d1dae3;flex-shrink:0;}
  .rc{flex:1;padding:5px 8px;border-right:1px solid #d1dae3;text-align:center;}
  .rc:last-child{border-right:none;}
  .rl{font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;}
  .rv{font-size:10px;font-weight:700;color:#0f172a;margin-top:1px;line-height:1.2;}

  /* 4 feature columns */
  .cols{display:flex;flex:1;padding:8px 6px 0;gap:6px;min-height:0;}
  .fcol{flex:1;min-width:0;overflow:hidden;}
  .col-hdr{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${primary};border-bottom:2px solid ${secondary};padding-bottom:2px;margin-bottom:5px;}
  .fi{font-size:9px;color:#1e293b;padding:2px 0 2px 10px;position:relative;line-height:1.3;}
  .fi::before{content:"•";position:absolute;left:1px;color:${secondary};font-weight:900;font-size:10px;line-height:1.3;}

  /* Build data section */
  .build-section{background:#f8fafc;border-top:1.5px solid ${secondary};padding:5px 8px;flex-shrink:0;}
  .build-hdr{font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${primary};margin-bottom:4px;}
  .build-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px 8px;}
  .build-cell{}
  .bc-label{font-size:6.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;}
  .bc-val{font-size:8px;font-weight:700;color:#0f172a;line-height:1.25;}

  /* RIGHT = price panel */
  .right{width:210px;display:flex;flex-direction:column;flex-shrink:0;}

  .price-hdr{background:${primary};color:#fff;padding:10px 13px 8px;text-align:center;}
  .ph-lbl{font-size:7.5px;letter-spacing:2px;text-transform:uppercase;opacity:.65;margin-bottom:2px;}
  .ph-val{font-size:30px;font-weight:900;line-height:1;}
  .ph-sub{font-size:8.5px;opacity:.7;margin-top:3px;}

  .price-break{padding:9px 13px;border-bottom:1px solid #e2e8f0;}
  .pb-row{display:flex;justify-content:space-between;font-size:9px;padding:2.5px 0;color:#64748b;}
  .pb-row b{color:#1e293b;font-weight:700;}
  .pb-total{display:flex;justify-content:space-between;font-size:10.5px;font-weight:800;color:${primary};border-top:2px solid ${secondary};margin-top:5px;padding-top:5px;}

  .vin-blk{padding:8px 13px;border-bottom:1px solid #e2e8f0;text-align:center;}
  .vin-lbl{font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
  .vin-val{font-size:8.5px;font-weight:700;font-family:monospace;letter-spacing:.5px;word-break:break-all;color:#0f172a;margin-top:2px;line-height:1.3;}

  .recall-blk{padding:7px 13px;border-bottom:1px solid #e2e8f0;}
  .r-ok{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:6px 8px;text-align:center;font-size:9px;font-weight:700;color:#15803d;}
  .r-bad{background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:6px 8px;text-align:center;font-size:9px;font-weight:700;color:#dc2626;}
  .r-note{font-size:7.5px;font-weight:400;display:block;margin-top:2px;}

  .dealer-blk{padding:9px 13px;flex:1;}
  .d-name{font-size:12px;font-weight:900;color:${primary};margin-bottom:4px;}
  .d-line{font-size:8.5px;color:#475569;line-height:1.75;}
  .d-tag{font-size:8px;font-style:italic;color:#94a3b8;margin-top:5px;}

  .stock-bar{background:${secondary};color:#fff;font-size:8.5px;font-weight:800;padding:5px 13px;text-align:center;letter-spacing:.5px;}

  /* ── FOOTER ── */
  .footer{background:${primary};color:rgba(255,255,255,.75);padding:0 20px;display:flex;justify-content:space-between;align-items:center;font-size:8.5px;height:33px;flex-shrink:0;}
  .footer b{color:#fff;}
</style>
</head>
<body>

<!-- HEADER -->
<div class="top-hdr">
  <div class="logo-cell">${logoHtml}</div>
  <div class="name-cell">
    <div class="name-label">Monroney Label &nbsp;&middot;&nbsp; Vehicle Information</div>
    <div class="name-val">${vehicleName || 'Vehicle Details'}</div>
  </div>
  <div class="meta-cell">
    ${vehicle.exterior_color ? `<div class="meta-row"><span>Exterior:</span><b>${vehicle.exterior_color}</b></div>` : ''}
    ${vehicle.interior_color ? `<div class="meta-row"><span>Interior:</span><b>${vehicle.interior_color}</b></div>` : ''}
    ${vehicle.body_style     ? `<div class="meta-row"><span>Body:</span><b>${vehicle.body_style}</b></div>` : ''}
    ${plantStr               ? `<div class="meta-row"><span>Built In:</span><b>${plantStr}</b></div>` : ''}
  </div>
  <div class="eng-cell">
    ${vehicle.engine       ? `<div class="eng-row"><span>Engine:</span><b>${vehicle.engine}</b></div>` : ''}
    ${vehicle.transmission ? `<div class="eng-row"><span>Trans:</span><b>${vehicle.transmission}</b></div>` : ''}
    ${vehicle.drivetrain   ? `<div class="eng-row"><span>Drive:</span><b>${vehicle.drivetrain}</b></div>` : ''}
    ${vd.horsepower        ? `<div class="eng-row"><span>Power:</span><b>${vd.horsepower} HP</b></div>` : ''}
  </div>
</div>
<div class="accent-bar"></div>

<!-- MAIN -->
<div class="main">

  <!-- LEFT PANEL -->
  <div class="left">

    <div class="photo">
      ${photoDataUri
        ? `<img src="${photoDataUri}" alt="Vehicle">`
        : `<div class="photo-none">No Photo Available</div>`}
    </div>

    <div class="ribbon">
      ${[
        ['Stock #',   vehicle.stocknumber || '—'],
        ['Condition', cap(vehicle.condition)],
        ['Mileage',   mileage],
        ['Fuel',      vehicle.fuel_type || '—'],
        ['Doors',     vehicle.doors ? String(vehicle.doors) : '—'],
        ['Seats',     vd.seats || '—'],
        ['GVWR',      vd.gvwr || '—'],
        ['Year',      String(vehicle.year || '—')],
      ].map(([l,v]) => `<div class="rc"><div class="rl">${l}</div><div class="rv">${v}</div></div>`).join('')}
    </div>

    <div class="cols">${colHtml}</div>

    ${buildDataHtml}

  </div>

  <!-- RIGHT PANEL -->
  <div class="right">
    <div class="price-hdr">
      <div class="ph-lbl">Total Asking Price</div>
      <div class="ph-val">${price}</div>
      <div class="ph-sub">${cap(vehicle.condition)} &nbsp;&middot;&nbsp; ${mileage}</div>
    </div>

    <div class="price-break">
      ${basePrice !== null ? `
      <div class="pb-row"><span>Base Vehicle Price</span><b>$${basePrice.toLocaleString()}</b></div>
      <div class="pb-row"><span>Options / Packages</span><b>Included</b></div>
      <div class="pb-row"><span>Destination &amp; Delivery</span><b>See Dealer</b></div>
      <div class="pb-total"><span>TOTAL PRICE</span><span>${price}</span></div>
      ` : `<div class="pb-row"><span>Contact dealer for pricing.</span></div>`}
    </div>

    <div class="vin-blk">
      <div class="vin-lbl">Vehicle Identification Number</div>
      <div class="vin-val">${vehicle.vin || 'Not Available'}</div>
    </div>

    <div class="recall-blk">
      ${recalls?.length
        ? `<div class="r-bad">⚠ ${recalls.length} Open Recall${recalls.length > 1 ? 's' : ''}<span class="r-note">Contact dealer for remedy</span></div>`
        : `<div class="r-ok">&#10003; No Open Recalls on Record</div>`}
    </div>

    <div class="dealer-blk">
      <div class="d-name">${dealer.name || 'Your Dealership'}</div>
      ${dealer.website_url ? `<div class="d-line">${dealer.website_url}</div>` : ''}
      ${branding.tagline   ? `<div class="d-tag">&ldquo;${branding.tagline}&rdquo;</div>` : ''}
    </div>

    <div class="stock-bar">Stock # ${vehicle.stocknumber || '&mdash;'}</div>
  </div>

</div>

<!-- FOOTER -->
<div class="footer">
  <span>VIN: <b>${vehicle.vin || '&mdash;'}</b></span>
  <span>${dealer.name || ''} &nbsp;&middot;&nbsp; ${dealer.website_url || ''}</span>
  <span>Generated: <b>${new Date().toLocaleDateString('en-CA')}</b></span>
</div>

</body></html>`
}

function buildBrochureHtml(vehicle, dealer, branding, recalls, photosDataUris, logoDataUri) {
  const primary = branding.primary_color || '#1a2e4a'
  const secondary = branding.secondary_color || '#c8a84b'

  const logoSrc = logoDataUri || branding.logo_url || null
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${dealer.name || ''}" style="max-height:52px;max-width:180px;object-fit:contain;display:block;">`
    : `<span style="font-size:17px;font-weight:900;color:#fff;">${dealer.name || 'Your Dealership'}</span>`

  const price = vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Call for Price'
  const mileage = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km` : vehicle.condition === 'new' ? 'New' : '—'
  const features = buildFeatureList(vehicle)
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : null

  // Use pre-fetched base64 uris; fallback to raw URLs (may not render in Puppeteer)
  const rawPhotos = (vehicle.image_urls || []).slice(0, 4)
  const getPhoto = i => photosDataUris?.[i] || rawPhotos[i] || null

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Arial',Helvetica,sans-serif;width:816px;background:#fff;color:#111;}
  .page{width:816px;min-height:1056px;position:relative;display:flex;flex-direction:column;page-break-after:always;}

  /* ── PAGE 1 ── */
  .hero{position:relative;height:400px;background:${primary};overflow:hidden;flex-shrink:0;}
  .hero img{width:100%;height:100%;object-fit:cover;}
  .hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.05) 0%,rgba(0,0,0,.72) 100%);}
  .hero-content{position:absolute;bottom:0;left:0;right:0;padding:22px 30px;color:#fff;}
  .hero-accent{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${secondary};margin-bottom:5px;}
  .hero-name{font-size:30px;font-weight:900;line-height:1.05;}
  .hero-sub{font-size:15px;opacity:.85;margin-top:3px;}

  .strip{background:${secondary};display:flex;align-items:center;justify-content:space-between;padding:10px 30px;flex-shrink:0;}
  .strip .logo-area{}
  .strip .price-area{text-align:center;color:#fff;}
  .strip .price-area .pv{font-size:22px;font-weight:900;}
  .strip .price-area .mv{font-size:12px;opacity:.85;}
  .strip .contact-area{text-align:right;color:rgba(255,255,255,.9);font-size:11px;line-height:1.7;}

  .specbar{display:flex;border-bottom:1px solid #e5e7eb;flex-shrink:0;}
  .sb-item{flex:1;padding:10px 12px;border-right:1px solid #e5e7eb;text-align:center;}
  .sb-item:last-child{border-right:none;}
  .sb-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
  .sb-val{font-size:12px;font-weight:700;color:#0f172a;margin-top:2px;}

  .gallery{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:14px 20px;flex:1;}
  .gallery .gp{border-radius:6px;overflow:hidden;aspect-ratio:16/9;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;}
  .gallery img{width:100%;height:100%;object-fit:cover;}

  .p1-footer{background:${primary};padding:9px 30px;display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.8);}
  .p1-footer b{color:#fff;}

  /* ── PAGE 2 ── */
  .p2-hdr{background:${primary};padding:14px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .p2-hdr-title{color:#fff;font-size:15px;font-weight:700;}
  .p2-body{display:flex;flex:1;}
  .p2-left{flex:1;padding:20px 24px;border-right:1px solid #e5e7eb;}
  .p2-right{width:240px;padding:20px 18px;display:flex;flex-direction:column;gap:12px;}

  .sec{margin-bottom:16px;}
  .sec-hdr{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:${primary};border-bottom:2px solid ${secondary};padding-bottom:3px;margin-bottom:8px;}
  .desc{font-size:11px;line-height:1.7;color:#475569;}
  .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;}
  .fi{font-size:11px;color:#334155;padding:3px 0;display:flex;gap:5px;align-items:flex-start;}
  .fi::before{content:"✓";color:${secondary};font-weight:800;flex-shrink:0;font-size:10px;}
  .full-specs{display:grid;grid-template-columns:1fr 1fr;gap:5px;}
  .fs-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;}
  .fs-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
  .fs-val{font-size:11px;font-weight:700;color:#0f172a;margin-top:1px;}

  .price-card{background:${primary};color:#fff;border-radius:8px;padding:16px;text-align:center;}
  .pc-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;opacity:.7;}
  .pc-val{font-size:28px;font-weight:900;line-height:1.1;margin-top:2px;}
  .pc-mile{font-size:11px;opacity:.75;margin-top:3px;}

  .recall-ok{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#15803d;}
  .recall-bad{background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 10px;font-size:11px;}
  .recall-bad b{display:block;color:#dc2626;font-size:12px;margin-bottom:2px;}

  .contact-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;}
  .cc-name{font-size:14px;font-weight:800;color:${primary};margin-bottom:5px;}
  .cc-line{font-size:11px;color:#475569;line-height:1.8;}
  .cc-tagline{font-size:10px;font-style:italic;color:#94a3b8;margin-top:8px;}

  .vin-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;}
  .vin-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
  .vin-val{font-size:10px;font-weight:700;font-family:monospace;letter-spacing:.8px;word-break:break-all;margin-top:2px;}

  .p2-footer{background:${primary};padding:9px 28px;display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.8);flex-shrink:0;margin-top:auto;}
  .p2-footer b{color:#fff;}
</style>
</head>
<body>

<!-- ══ PAGE 1 ══ -->
<div class="page">
  <div class="hero">
    ${getPhoto(0) ? `<img src="${getPhoto(0)}" alt="Vehicle">` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${primary} 0%,${secondary} 100%);"></div>`}
    <div class="hero-grad"></div>
    <div class="hero-content">
      ${branding.tagline ? `<div class="hero-accent">${branding.tagline}</div>` : ''}
      <div class="hero-name">${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}</div>
      <div class="hero-sub">${[vehicle.trim, cap(vehicle.condition)].filter(Boolean).join(' · ')}</div>
    </div>
  </div>

  <div class="strip">
    <div class="logo-area">${logoHtml}</div>
    <div class="price-area">
      <div class="pv">${price}</div>
      <div class="mv">${mileage}</div>
    </div>
    <div class="contact-area">
      ${dealer.website_url ? `<div>🌐 ${dealer.website_url}</div>` : ''}
      <div>${dealer.name || ''}</div>
    </div>
  </div>

  <div class="specbar">
    ${[
      ['Drivetrain',   vehicle.drivetrain   || '—'],
      ['Fuel Type',    vehicle.fuel_type    || '—'],
      ['Transmission', vehicle.transmission || '—'],
      ['Body Style',   vehicle.body_style   || '—'],
      ['Ext. Colour',  vehicle.exterior_color || '—'],
      ['Stock #',      vehicle.stocknumber  || '—'],
    ].map(([l,v]) => `<div class="sb-item"><div class="sb-label">${l}</div><div class="sb-val">${v}</div></div>`).join('')}
  </div>

  <div class="gallery">
    ${[0,1,2,3].map(i => getPhoto(i)
      ? `<div class="gp"><img src="${getPhoto(i)}" alt="Photo ${i+1}"></div>`
      : `<div class="gp">Photo ${i+1}</div>`
    ).join('')}
  </div>

  <div class="p1-footer">
    <span>Stock #: <b>${vehicle.stocknumber || '—'}</b></span>
    <span>${dealer.name || ''}</span>
    <span>Generated ${new Date().toLocaleDateString('en-CA')}</span>
  </div>
</div>

<!-- ══ PAGE 2 ══ -->
<div class="page">
  <div class="p2-hdr">
    ${logoHtml}
    <div class="p2-hdr-title">${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}${vehicle.trim ? ' — ' + vehicle.trim : ''}</div>
  </div>

  <div class="p2-body">
    <div class="p2-left">
      ${vehicle.description ? `
      <div class="sec">
        <div class="sec-hdr">About This Vehicle</div>
        <div class="desc">${vehicle.description.slice(0, 650)}${vehicle.description.length > 650 ? '…' : ''}</div>
      </div>` : ''}

      <div class="sec">
        <div class="sec-hdr">Features &amp; Equipment</div>
        <div class="feat-grid">
          ${features.map(f => `<div class="fi">${f}</div>`).join('')}
        </div>
      </div>

      ${[
        ['Engine',       vehicle.engine],
        ['Body Style',   vehicle.body_style],
        ['Doors',        vehicle.doors ? String(vehicle.doors) : null],
        ['Int. Colour',  vehicle.interior_color],
        ['Condition',    cap(vehicle.condition)],
        ['VIN',          vehicle.vin],
      ].filter(([,v]) => v).length ? `
      <div class="sec">
        <div class="sec-hdr">Full Specifications</div>
        <div class="full-specs">
          ${[
            ['Engine',       vehicle.engine],
            ['Body Style',   vehicle.body_style],
            ['Doors',        vehicle.doors ? String(vehicle.doors) : null],
            ['Int. Colour',  vehicle.interior_color],
            ['Condition',    cap(vehicle.condition)],
          ].filter(([,v]) => v).map(([l,v]) => `
          <div class="fs-item"><div class="fs-label">${l}</div><div class="fs-val">${v}</div></div>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div class="p2-right">
      <div class="price-card">
        <div class="pc-label">Asking Price</div>
        <div class="pc-val">${price}</div>
        <div class="pc-mile">${mileage}</div>
      </div>

      ${recalls?.length
        ? `<div class="recall-bad"><b>⚠ ${recalls.length} Open Recall${recalls.length > 1 ? 's' : ''}</b>See dealer for details &amp; remedy.</div>`
        : `<div class="recall-ok">✓ No Open Recalls on Record</div>`}

      <div class="contact-card">
        <div class="cc-name">${dealer.name || 'Your Dealership'}</div>
        ${dealer.website_url ? `<div class="cc-line">🌐 ${dealer.website_url}</div>` : ''}
        ${branding.tagline ? `<div class="cc-tagline">"${branding.tagline}"</div>` : ''}
      </div>

      <div class="vin-box">
        <div class="vin-label">VIN</div>
        <div class="vin-val">${vehicle.vin || 'Not Available'}</div>
      </div>
    </div>
  </div>

  <div class="p2-footer">
    <span>Stock #: <b>${vehicle.stocknumber || '—'}</b></span>
    <span>VIN: ${vehicle.vin || '—'}</span>
    <span>Generated ${new Date().toLocaleDateString('en-CA')}</span>
  </div>
</div>

</body></html>`
}

function buildFeatureList(vehicle) {
  const features = []
  if (vehicle.drivetrain) features.push(`${vehicle.drivetrain} Drivetrain`)
  if (vehicle.transmission) features.push(`${vehicle.transmission} Transmission`)
  if (vehicle.fuel_type || vehicle.fueltype) features.push(`${vehicle.fuel_type || vehicle.fueltype} Engine`)
  if (vehicle.exterior_color) features.push(`${vehicle.exterior_color} Exterior`)
  if (vehicle.interior_color) features.push(`${vehicle.interior_color} Interior`)
  if (vehicle.body_style || vehicle.bodystyle) features.push(`${vehicle.body_style || vehicle.bodystyle} Body`)
  if (vehicle.engine) features.push(vehicle.engine)

  // Parse free-text features from description if available
  const featureKeywords = [
    'heated seats', 'heated steering', 'sunroof', 'moonroof', 'panoramic',
    'navigation', 'backup camera', 'blind spot', 'lane departure', 'adaptive cruise',
    'apple carplay', 'android auto', 'bluetooth', 'remote start', 'keyless entry',
    'leather', 'alloy wheels', 'third row', 'tow package', 'lift kit',
    'power liftgate', 'wireless charging', 'bose', 'harman', '360 camera',
  ]
  if (vehicle.description) {
    const desc = vehicle.description.toLowerCase()
    for (const kw of featureKeywords) {
      if (desc.includes(kw) && !features.some(f => f.toLowerCase().includes(kw))) {
        features.push(kw.replace(/\b\w/g, c => c.toUpperCase()))
      }
    }
  }

  return features.length ? features : ['See dealer for full equipment list']
}

// Fetch an image URL and return a base64 data URI so Puppeteer can render it
async function imgToDataUri(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') || 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch { return null }
}

async function generatePdf(html) {
  // Dynamic import to avoid memory cost when not in use
  const puppeteer = (await import('puppeteer-core')).default
  let browser, page
  try {
    const isRender = process.env.NODE_ENV === 'production' || process.env.RENDER
    let launchOpts
    if (isRender) {
      const chromium = (await import('@sparticuz/chromium')).default
      launchOpts = {
        executablePath: await chromium.executablePath(),
        args: chromium.args,
        headless: chromium.headless,
      }
    } else {
      const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ]
      const fs = await import('fs')
      const exec = candidates.find(p => { try { fs.statSync(p); return true } catch { return false } })
      if (!exec) throw new Error('No local Chrome found')
      launchOpts = { executablePath: exec, args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' }
    }
    browser = await puppeteer.launch({ ...launchOpts, defaultViewport: { width: 816, height: 1056 } })
    page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'Letter', landscape: true, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
    return pdf
  } finally {
    if (page) await page.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
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
    const { primary_color, secondary_color, tagline, logo_url } = req.body
    const branding = {}
    if (primary_color !== undefined) branding.primary_color = primary_color
    if (secondary_color !== undefined) branding.secondary_color = secondary_color
    if (tagline !== undefined) branding.tagline = tagline
    if (logo_url !== undefined) branding.logo_url = logo_url

    const { error } = await supabaseAdmin
      .from('dealerships')
      .update({ branding })
      .eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
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

    try {
      const [decodeRes, recallRes] = await Promise.allSettled([
        fetch(`${NHTSA_DECODE}/${encodeURIComponent(vin)}?format=json`).then(r => r.json()),
        fetch(`${NHTSA_RECALLS}?vin=${encodeURIComponent(vin)}`).then(r => r.json()),
      ])

      let decoded = {}
      if (decodeRes.status === 'fulfilled') {
        const r = decodeRes.value?.Results?.[0] || {}
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

      res.json({ decoded, recalls, recall_count: recalls.length })
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
  app.post('/pdf/window-sticker/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const dealer = await loadDealershipData(req.dealershipId)
    if (!dealer?.vin_sticker_active) return res.status(403).json({ error: 'VIN Sticker & Brochure add-on not active' })

    const { data: vehicle, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (error || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    // Return cached URL if already generated
    if (vehicle.window_sticker_url && req.query.regen !== '1') {
      return res.json({ url: vehicle.window_sticker_url, cached: true })
    }

    try {
      const branding = dealer.branding || {}
      const [photoDataUri, logoDataUri] = await Promise.all([
        vehicle.image_urls?.[0] ? imgToDataUri(vehicle.image_urls[0]) : Promise.resolve(null),
        branding.logo_url ? imgToDataUri(branding.logo_url) : Promise.resolve(null),
      ])
      const html = buildWindowStickerHtml(vehicle, dealer, branding, vehicle.recalls || [], photoDataUri, logoDataUri)
      const pdf = await generatePdf(html)
      const path = `${req.dealershipId}/${vehicle.id}/window-sticker.pdf`
      const url = await uploadPdf(pdf, path)
      await supabaseAdmin.from('inventory').update({ window_sticker_url: url }).eq('id', vehicle.id)
      res.json({ url, cached: false })
    } catch (e) {
      console.error('[window-sticker]', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ── Generate brochure ─────────────────────────────────────────────────
  app.post('/pdf/brochure/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })

    const dealer = await loadDealershipData(req.dealershipId)
    if (!dealer?.vin_sticker_active) return res.status(403).json({ error: 'VIN Sticker & Brochure add-on not active' })

    const { data: vehicle, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', req.params.vehicleId)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (error || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    if (vehicle.brochure_url && req.query.regen !== '1') {
      return res.json({ url: vehicle.brochure_url, cached: true })
    }

    try {
      const branding = dealer.branding || {}
      const imageUrls = (vehicle.image_urls || []).slice(0, 2)
      const [photosDataUris, logoDataUri] = await Promise.all([
        Promise.all(imageUrls.map(u => imgToDataUri(u))),
        branding.logo_url ? imgToDataUri(branding.logo_url) : Promise.resolve(null),
      ])
      const html = buildBrochureHtml(vehicle, dealer, branding, vehicle.recalls || [], photosDataUris, logoDataUri)
      const pdf = await generatePdf(html)
      const path = `${req.dealershipId}/${vehicle.id}/brochure.pdf`
      const url = await uploadPdf(pdf, path)
      await supabaseAdmin.from('inventory').update({ brochure_url: url }).eq('id', vehicle.id)
      res.json({ url, cached: false })
    } catch (e) {
      console.error('[brochure]', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ── Clear cached PDFs when vehicle is sold/deleted ────────────────────
  app.delete('/pdf/cache/:vehicleId', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const vehicleId = req.params.vehicleId
    await Promise.allSettled([
      supabaseAdmin.storage.from('vehicle-pdfs').remove([`${req.dealershipId}/${vehicleId}/window-sticker.pdf`]),
      supabaseAdmin.storage.from('vehicle-pdfs').remove([`${req.dealershipId}/${vehicleId}/brochure.pdf`]),
      supabaseAdmin.from('inventory').update({ window_sticker_url: null, brochure_url: null }).eq('id', vehicleId).eq('dealership_id', req.dealershipId),
    ])
    res.json({ ok: true })
  })
}
