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
    ? `<img src="${logoSrc}" alt="${dealer.name || ''}" style="max-height:52px;max-width:180px;object-fit:contain;display:block;">`
    : `<span style="font-size:16px;font-weight:900;color:#fff;">${dealer.name || 'Your Dealership'}</span>`

  const photoHtml = photoDataUri
    ? `<img src="${photoDataUri}" style="width:100%;height:100%;object-fit:cover;" alt="Vehicle">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#dde3ec;color:#94a3b8;font-size:12px;">No Photo Available</div>`

  const price   = vehicle.price   ? `$${Number(vehicle.price).toLocaleString()}` : 'Call for Price'
  const mileage = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km` : (vehicle.condition === 'new' ? 'New Vehicle' : '—')
  const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
  const vehicleName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')

  // ── Pull extended VIN data ────────────────────────────────────────────────
  const vd = vehicle.vin_data || {}
  const plantStr = [vd.plant_city, vd.plant_state, vd.plant_country].filter(Boolean).join(', ') || null

  // ── Categorised feature columns (mirroring GM Monroney layout) ──────────
  const desc = (vehicle.description || '').toLowerCase()
  const has  = kw => desc.includes(kw)

  const featureCols = [
    {
      title: 'Performance & Mechanical',
      items: [
        vehicle.engine        && vehicle.engine,
        vehicle.drivetrain    && `${vehicle.drivetrain} Drivetrain`,
        vehicle.transmission  && `${vehicle.transmission} Transmission`,
        vehicle.fuel_type     && `${vehicle.fuel_type}`,
        has('tow')            && 'Towing Package',
        has('trailer')        && 'Trailer Hitch',
        has('sport')          && 'Sport Mode',
        has('awd') || has('4wd') || has('four-wheel') ? 'All-Wheel / 4WD Capable' : null,
      ].filter(Boolean),
    },
    {
      title: 'Comfort & Convenience',
      items: [
        has('heated seat')    && 'Heated Front Seats',
        has('ventilated')     && 'Ventilated Seats',
        has('heated steering') && 'Heated Steering Wheel',
        has('remote start')   && 'Remote Vehicle Start',
        has('keyless')        && 'Keyless Entry / Push-Button Start',
        has('sunroof') || has('moonroof') ? 'Power Sunroof / Moonroof' : null,
        has('panoramic')      && 'Panoramic Roof',
        has('power liftgate') && 'Power Liftgate',
        has('leather')        && 'Leather-Appointed Seating',
        has('third row') || has('3rd row') ? 'Third-Row Seating' : null,
        has('wireless charg') && 'Wireless Charging Pad',
        vehicle.interior_color && `${vehicle.interior_color} Interior`,
        vehicle.exterior_color && `${vehicle.exterior_color} Exterior`,
      ].filter(Boolean),
    },
    {
      title: 'Safety & Security',
      items: [
        has('backup camera') || has('rear camera') || has('rearview') ? 'Rear-View Camera' : null,
        has('blind spot')     && 'Blind Spot Monitoring',
        has('lane departure') || has('lane keep') ? 'Lane Keep Assist' : null,
        has('forward collision') || has('collision alert') ? 'Forward Collision Alert' : null,
        has('automatic emergency') || has('aeb') ? 'Automatic Emergency Braking' : null,
        has('adaptive cruise') && 'Adaptive Cruise Control',
        has('parking sensor') || has('park assist') ? 'Parking Sensors / Assist' : null,
        has('360') || has('surround') ? '360° Surround-View Camera' : null,
        has('stability control') && 'Electronic Stability Control',
        has('airbag')         && 'Advanced Airbag System',
        recalls?.length ? `⚠ ${recalls.length} Open Recall — See Dealer` : '✓ No Open Recalls on Record',
      ].filter(Boolean),
    },
    {
      title: 'Technology & Connectivity',
      items: [
        has('apple carplay')  && 'Apple CarPlay®',
        has('android auto')   && 'Android Auto™',
        has('navigation') || has('nav system') ? 'Built-In Navigation' : null,
        has('bluetooth')      && 'Bluetooth Connectivity',
        has('wi-fi') || has('wifi') || has('hotspot') ? 'Built-In Wi-Fi Hotspot' : null,
        has('onstar')         && 'OnStar Connected Services',
        has('bose') || has('harman') || has('jbl') ? 'Premium Audio System' : null,
        has('usb')            && 'USB Charging Ports',
        has('digital cluster') || has('digital dash') ? 'Digital Instrument Cluster' : null,
        has('heads-up') || has('hud') ? 'Heads-Up Display' : null,
      ].filter(Boolean),
    },
  ]

  // Ensure each column has at least one item
  featureCols.forEach(col => {
    if (!col.items.length) col.items.push('See dealer for full equipment details')
  })

  const colHtml = featureCols.map(col => `
    <div class="fcol">
      <div class="col-hdr">${col.title}</div>
      ${col.items.map(item => `<div class="fi">${item}</div>`).join('')}
    </div>`).join('')

  // ── Price breakdown ───────────────────────────────────────────────────────
  const basePrice = vehicle.price ? Number(vehicle.price) : null

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Arial',Helvetica,sans-serif;width:1056px;min-height:816px;background:#fff;color:#111;font-size:11px;}

  /* ── TOP HEADER BAR ── */
  .top-hdr{background:${primary};display:flex;align-items:center;gap:0;height:64px;}
  .top-hdr .logo-cell{padding:0 20px;display:flex;align-items:center;min-width:200px;}
  .top-hdr .veh-name-cell{flex:1;padding:0 18px;display:flex;flex-direction:column;justify-content:center;border-left:1px solid rgba(255,255,255,.25);border-right:1px solid rgba(255,255,255,.25);}
  .top-hdr .veh-label{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.65);}
  .top-hdr .veh-name{font-size:19px;font-weight:900;color:#fff;line-height:1.15;letter-spacing:-.3px;}
  .top-hdr .color-cell{padding:0 16px;display:flex;flex-direction:column;justify-content:center;gap:3px;border-right:1px solid rgba(255,255,255,.25);}
  .top-hdr .color-row{font-size:9px;color:rgba(255,255,255,.75);display:flex;gap:4px;}
  .top-hdr .color-row b{color:#fff;}
  .top-hdr .eng-cell{padding:0 16px;display:flex;flex-direction:column;justify-content:center;gap:3px;}
  .top-hdr .eng-row{font-size:9px;color:rgba(255,255,255,.75);display:flex;gap:4px;}
  .top-hdr .eng-row b{color:#fff;}

  /* ── SECONDARY STRIPE ── */
  .sec-stripe{background:${secondary};height:6px;}

  /* ── BODY ── */
  .body-wrap{display:flex;min-height:calc(816px - 64px - 6px - 38px);}

  /* LEFT: photo + 4 feature columns */
  .left-panel{flex:1;display:flex;flex-direction:column;border-right:2px solid ${primary};}

  .photo-row{height:200px;background:#dde3ec;overflow:hidden;flex-shrink:0;}
  .photo-row img{width:100%;height:100%;object-fit:cover;}
  .photo-row .no-photo{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;}

  /* Spec ribbon below photo */
  .spec-ribbon{display:flex;background:#f1f5f9;border-bottom:1px solid #dde3ec;flex-shrink:0;}
  .spec-cell{flex:1;padding:6px 10px;border-right:1px solid #dde3ec;text-align:center;}
  .spec-cell:last-child{border-right:none;}
  .spec-cell .sl{font-size:7.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;}
  .spec-cell .sv{font-size:10.5px;font-weight:700;color:#0f172a;margin-top:1px;}

  /* Feature columns */
  .feat-section{display:flex;flex:1;padding:10px 8px 8px;gap:8px;}
  .fcol{flex:1;min-width:0;}
  .col-hdr{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.9px;color:${primary};border-bottom:2px solid ${secondary};padding-bottom:3px;margin-bottom:6px;}
  .fi{font-size:9.5px;color:#334155;padding:2.5px 0 2.5px 12px;position:relative;line-height:1.35;}
  .fi::before{content:"•";position:absolute;left:2px;color:${secondary};font-weight:900;font-size:11px;top:1px;}

  /* RIGHT: price box */
  .right-panel{width:220px;display:flex;flex-direction:column;background:#fff;}
  .price-hdr{background:${primary};color:#fff;padding:11px 14px 8px;text-align:center;flex-shrink:0;}
  .price-hdr .ph-label{font-size:8px;letter-spacing:2.5px;text-transform:uppercase;opacity:.7;}
  .price-hdr .ph-val{font-size:28px;font-weight:900;line-height:1.1;margin-top:1px;}
  .price-hdr .ph-cond{font-size:9px;opacity:.75;margin-top:2px;letter-spacing:.5px;}

  .price-breakdown{padding:10px 14px;border-bottom:1px solid #e2e8f0;flex-shrink:0;}
  .pb-row{display:flex;justify-content:space-between;font-size:9.5px;padding:2px 0;color:#475569;}
  .pb-row.total{font-size:11px;font-weight:800;color:${primary};border-top:2px solid ${secondary};margin-top:5px;padding-top:5px;}
  .pb-row b{color:#0f172a;}

  .vin-block{padding:9px 14px;border-bottom:1px solid #e2e8f0;flex-shrink:0;text-align:center;}
  .vin-label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
  .vin-val{font-size:9.5px;font-weight:700;font-family:monospace;letter-spacing:.7px;word-break:break-all;margin-top:2px;color:#0f172a;}

  .recall-block{padding:8px 14px;border-bottom:1px solid #e2e8f0;flex-shrink:0;}
  .recall-ok{background:#f0fdf4;border:1px solid #86efac;border-radius:5px;padding:7px 9px;text-align:center;font-size:9.5px;font-weight:700;color:#15803d;}
  .recall-bad{background:#fef2f2;border:1px solid #fca5a5;border-radius:5px;padding:7px 9px;font-size:9.5px;font-weight:700;color:#dc2626;text-align:center;}

  .dealer-block{padding:10px 14px;flex:1;}
  .db-name{font-size:12px;font-weight:900;color:${primary};margin-bottom:5px;}
  .db-line{font-size:9.5px;color:#475569;line-height:1.7;}
  .db-tagline{font-size:9px;font-style:italic;color:#94a3b8;margin-top:6px;}

  .stock-badge{background:${secondary};color:#fff;font-size:9px;font-weight:800;padding:5px 14px;text-align:center;letter-spacing:.5px;flex-shrink:0;}

  /* ── FOOTER ── */
  .footer{background:${primary};color:rgba(255,255,255,.8);padding:8px 22px;display:flex;justify-content:space-between;font-size:9px;height:38px;align-items:center;}
  .footer b{color:#fff;}
</style>
</head>
<body>

<!-- TOP HEADER -->
<div class="top-hdr">
  <div class="logo-cell">${logoHtml}</div>
  <div class="veh-name-cell">
    <div class="veh-label">Monroney Label &nbsp;·&nbsp; Vehicle Information</div>
    <div class="veh-name">${vehicleName || 'Vehicle Details'}</div>
  </div>
  <div class="color-cell">
    ${vehicle.exterior_color ? `<div class="color-row"><span>Exterior:</span><b>${vehicle.exterior_color}</b></div>` : ''}
    ${vehicle.interior_color ? `<div class="color-row"><span>Interior:</span><b>${vehicle.interior_color}</b></div>` : ''}
    ${vehicle.body_style     ? `<div class="color-row"><span>Body:</span><b>${vehicle.body_style}</b></div>` : ''}
  </div>
  <div class="eng-cell">
    ${vehicle.engine       ? `<div class="eng-row"><span>Engine:</span><b>${vehicle.engine}</b></div>` : ''}
    ${vehicle.transmission ? `<div class="eng-row"><span>Trans:</span><b>${vehicle.transmission}</b></div>` : ''}
    ${vehicle.drivetrain   ? `<div class="eng-row"><span>Drive:</span><b>${vehicle.drivetrain}</b></div>` : ''}
  </div>
</div>

<div class="sec-stripe"></div>

<div class="body-wrap">

  <!-- LEFT PANEL -->
  <div class="left-panel">

    <!-- Vehicle photo -->
    <div class="photo-row">
      ${photoDataUri
        ? `<img src="${photoDataUri}" alt="Vehicle">`
        : `<div class="no-photo">No Photo Available</div>`}
    </div>

    <!-- Spec ribbon -->
    <div class="spec-ribbon">
      ${[
        ['Stock #',      vehicle.stocknumber  || '—'],
        ['Condition',    cap(vehicle.condition)],
        ['Mileage',      mileage],
        ['Fuel Type',    vehicle.fuel_type    || '—'],
        ['Doors',        vehicle.doors ? String(vehicle.doors) : '—'],
        ['Year',         vehicle.year         || '—'],
      ].map(([l,v]) => `<div class="spec-cell"><div class="sl">${l}</div><div class="sv">${v}</div></div>`).join('')}
    </div>

    <!-- 4-column features (GM Monroney style) -->
    <div class="feat-section">${colHtml}</div>

    <!-- Full Build Data row -->
    ${Object.values(vd).some(v => v !== null) ? `
    <div style="background:#f8fafc;border-top:2px solid ${secondary};padding:7px 10px;display:flex;flex-wrap:wrap;gap:3px 14px;">
      <div style="width:100%;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${primary};margin-bottom:4px;">Vehicle Build Data (NHTSA)</div>
      ${[
        vd.manufacturer       && ['Manufacturer',       vd.manufacturer],
        vd.vehicle_type       && ['Type',               vd.vehicle_type],
        vd.series             && ['Series',             vd.series],
        plantStr              && ['Built In',           plantStr],
        vd.plant_company      && ['Plant',              vd.plant_company],
        vd.engine_model       && ['Engine Model',       vd.engine_model],
        vd.engine_manufacturer && ['Engine Mfr',        vd.engine_manufacturer],
        vd.engine_config      && ['Engine Config',      vd.engine_config],
        vd.valve_train        && ['Valve Train',        vd.valve_train],
        vd.displacement_l     && ['Displacement',       `${vd.displacement_l}L`],
        vd.displacement_cc    && ['Displ. (cc)',        `${vd.displacement_cc}cc`],
        vd.cylinders          && ['Cylinders',          vd.cylinders],
        vd.horsepower         && ['Horsepower',         `${vd.horsepower} HP`],
        vd.turbo              && ['Turbo',              vd.turbo],
        vd.fuel_injection     && ['Fuel Injection',     vd.fuel_injection],
        vd.fuel_type_secondary && ['Alt Fuel',          vd.fuel_type_secondary],
        vd.electrification    && ['Electrification',    vd.electrification],
        vd.transmission_speeds && ['Trans Speeds',      vd.transmission_speeds],
        vd.wheel_base         && ['Wheel Base',         vd.wheel_base],
        vd.wheel_size_front   && ['Wheel Size (F)',     vd.wheel_size_front],
        vd.wheel_size_rear    && ['Wheel Size (R)',     vd.wheel_size_rear],
        vd.wheels             && ['Wheels',             vd.wheels],
        vd.axles              && ['Axles',              vd.axles],
        vd.windows            && ['Windows',            vd.windows],
        vd.seat_rows          && ['Seat Rows',          vd.seat_rows],
        vd.seats              && ['Seats',              vd.seats],
        vd.gvwr               && ['GVWR',               vd.gvwr],
        vd.curb_weight_lb     && ['Curb Weight',        `${vd.curb_weight_lb} lbs`],
        vd.brake_system       && ['Brakes',             vd.brake_system],
        vd.steering_location  && ['Steering',           vd.steering_location],
        vd.abs                && ['ABS',                vd.abs],
        vd.esc                && ['ESC',                vd.esc],
        vd.tpms               && ['TPMS',               vd.tpms],
        vd.forward_collision  && ['Fwd Collision Warn', vd.forward_collision],
        vd.lane_departure     && ['Lane Departure',     vd.lane_departure],
        vd.lane_keep          && ['Lane Keep',          vd.lane_keep],
        vd.blind_spot_mon     && ['Blind Spot Mon',     vd.blind_spot_mon],
        vd.adaptive_cruise    && ['Adaptive Cruise',    vd.adaptive_cruise],
        vd.auto_brake         && ['Auto Emergency Brk', vd.auto_brake],
        vd.adaptive_headlights && ['Adaptive Hdlts',   vd.adaptive_headlights],
        vd.airbag_front       && ['Airbags (Front)',    vd.airbag_front],
        vd.airbag_side        && ['Airbags (Side)',     vd.airbag_side],
        vd.airbag_curtain     && ['Airbags (Curtain)',  vd.airbag_curtain],
        vd.airbag_knee        && ['Airbags (Knee)',     vd.airbag_knee],
        vd.keyless_ignition   && ['Keyless Ignition',   vd.keyless_ignition],
        vd.sae_automation     && ['SAE Auto Level',     vd.sae_automation],
      ].filter(Boolean).map(([l,v]) => `<div style="display:flex;gap:3px;align-items:baseline;"><span style="font-size:7.5px;color:#94a3b8;white-space:nowrap;">${l}:</span><span style="font-size:8px;font-weight:700;color:#1e293b;">${v}</span></div>`).join('')}
    </div>` : ''}

  </div>

  <!-- RIGHT PANEL (price box) -->
  <div class="right-panel">
    <div class="price-hdr">
      <div class="ph-label">Total Asking Price</div>
      <div class="ph-val">${price}</div>
      <div class="ph-cond">${cap(vehicle.condition)} &nbsp;·&nbsp; ${mileage}</div>
    </div>

    <div class="price-breakdown">
      ${basePrice !== null ? `
      <div class="pb-row"><span>Base Vehicle Price</span><b>${`$${basePrice.toLocaleString()}`}</b></div>
      <div class="pb-row"><span>Options / Packages</span><b>Included</b></div>
      <div class="pb-row"><span>Destination &amp; Delivery</span><b>See Dealer</b></div>
      <div class="pb-row total"><span>TOTAL PRICE</span><b>${price}</b></div>
      ` : `<div class="pb-row"><span>Contact dealer for pricing details.</span></div>`}
    </div>

    <div class="vin-block">
      <div class="vin-label">Vehicle Identification Number (VIN)</div>
      <div class="vin-val">${vehicle.vin || 'Not Available'}</div>
    </div>

    <div class="recall-block">
      ${recalls?.length
        ? `<div class="recall-bad">⚠ ${recalls.length} Open Recall${recalls.length > 1 ? 's' : ''}<br><span style="font-weight:400;font-size:9px;">Contact dealer for remedy details</span></div>`
        : `<div class="recall-ok">✓ No Open Recalls on Record</div>`}
    </div>

    <div class="dealer-block">
      <div class="db-name">${dealer.name || 'Your Dealership'}</div>
      ${dealer.website_url ? `<div class="db-line">🌐 ${dealer.website_url}</div>` : ''}
      ${branding.tagline   ? `<div class="db-tagline">"${branding.tagline}"</div>` : ''}
    </div>

    <div class="stock-badge">Stock # ${vehicle.stocknumber || '—'}</div>
  </div>

</div>

<!-- FOOTER -->
<div class="footer">
  <span>VIN: <b>${vehicle.vin || '—'}</b></span>
  <span>${dealer.name || ''}</span>
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
