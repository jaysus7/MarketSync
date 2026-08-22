// ─────────────────────────────────────────────────────────────────────────────
// MarketSync CRM — VIN Sticker Submodule: HTML Template Builders
// ─────────────────────────────────────────────────────────────────────────────
import { fontFaceCss } from '../../utils/brochureFonts.js'

export function buildWindowStickerHtml(vehicle, dealer, branding, recalls, photoDataUris, logoDataUri, blurb, specs) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const photoDataUri = Array.isArray(photoDataUris) ? photoDataUris[0] : photoDataUris
  const primary   = branding.primary_color   || '#003087'
  const secondary = branding.secondary_color || '#c9a84c'
  const isUS = /^(US|USA|UNITED STATES)$/.test((dealer?.country || '').trim().toUpperCase())

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const myNorm = norm(vehicle.trim)
  const specTrims = Array.isArray(specs?.trims) ? specs.trims : []
  const myTrimObj = specTrims.find(t => { const n = norm(t.name); return myNorm && n && (n.includes(myNorm) || myNorm.includes(n)) }) || null
  const pkgs = Array.isArray(specs?.packages) ? specs.packages : []
  const optRows = pkgs.slice(0, 6)
    .map(p => `<div class="opt-row"><span>${esc(p.name || '')}</span><b>${esc((p.availability || '').replace(/^available on\s*/i, '').trim() || 'Avail.')}</b></div>`).join('')
  const feCells = (() => {
    const fe = specs?.fuel_economy; if (!fe) return ''
    const g = fe.gas || {}, e = fe.electric || {}
    const cell = (lab, big, small) => `<div class="fe-c"><div class="fe-cl">${lab}</div><div class="fe-cb">${esc(big)}</div><div class="fe-cs">${esc(small)}</div></div>`
    if (e && (e.range_km != null || e.range_mi != null)) {
      const km = e.range_km != null ? `${e.range_km} km` : '—', mi = e.range_mi != null ? `${e.range_mi} mi` : '—'
      return cell('Range', isUS ? mi : km, isUS ? km : mi) + (e.kwh != null ? cell('Battery', `${e.kwh} kWh`, ' ') : '')
    }
    const dual = (l, m) => { const met = l != null ? `${l} L/100` : '—', imp = m != null ? `${m} MPG` : '—'; return { big: isUS ? imp : met, small: isUS ? met : imp } }
    let out = ''
    for (const [lab, l, m] of [['City', g.city_l100, g.city_mpg], ['Hwy', g.hwy_l100, g.hwy_mpg], ['Comb', g.combined_l100, g.combined_mpg]]) {
      if (l == null && m == null) continue; const d = dual(l, m); out += cell(lab, d.big, d.small)
    }
    return out
  })()

  const logoSrc  = logoDataUri || branding.logo_url || null
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${dealer.name || ''}" style="max-height:48px;max-width:170px;object-fit:contain;display:block;">`
    : `<span style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-.3px;">${dealer.name || 'Your Dealership'}</span>`

  const vehicleName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')

  const vd = vehicle.vin_data || {}
  const desc = (vehicle.description || '').toLowerCase()
  const has  = kw => desc.includes(kw)
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
        vehicle.engine && vehicle.engine,
        vehicle.drivetrain && `${vehicle.drivetrain} Drivetrain`,
        vehicle.transmission && `${vehicle.transmission} Transmission`,
        vd.transmission_speeds && `${vd.transmission_speeds}-Speed Transmission`,
        vehicle.fuel_type && `${vehicle.fuel_type} Fuel`,
        vd.fuel_injection && `${vd.fuel_injection} Fuel Injection`,
        nhtsa(vd.turbo, 'Turbocharged'),
        vd.horsepower && `${vd.horsepower} Horsepower`,
        vd.displacement_cc && `${vd.displacement_cc}cc Displacement`,
        vd.gvwr && `GVWR: ${vd.gvwr}`,
        has('tow') || has('trailer') ? 'Towing Package' : null,
        has('awd') || has('4wd') || has('four-wheel') ? 'Four-Wheel / AWD Capable' : null,
      ].filter(Boolean),
    },
    {
      title: 'Comfort & Convenience',
      items: [
        has('heated seat') ? 'Heated Front Seats' : null,
        has('ventilated') ? 'Ventilated Seats' : null,
        has('heated steering') ? 'Heated Steering Wheel' : null,
        has('remote start') ? 'Remote Vehicle Start' : null,
        (has('keyless') || nhtsa(vd.keyless_ignition, 'x')) ? 'Keyless Entry / Push-Button Start' : null,
        has('sunroof') || has('moonroof') ? 'Power Sunroof / Moonroof' : null,
        has('panoramic') ? 'Panoramic Roof' : null,
        has('power liftgate') ? 'Power Liftgate' : null,
        has('leather') ? 'Leather-Appointed Seating' : null,
        has('third row') || has('3rd row') ? 'Third-Row Seating' : null,
        has('wireless charg') ? 'Wireless Charging Pad' : null,
        vd.seat_rows && `${vd.seat_rows} Row Seating`,
        vd.seats && `${vd.seats} Passenger Capacity`,
        vehicle.interior_color && `${vehicle.interior_color} Interior`,
        vehicle.exterior_color && `${vehicle.exterior_color} Exterior`,
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
      ].filter(Boolean),
    },
  ]

  const featureColHtml = featureCols.map(c => `
    <div class="col font-mono text-slate-800">
      <div class="col-hdr">${esc(c.title)}</div>
      ${c.items.length ? c.items.map(f => `<div class="feat-item">• ${esc(f)}</div>`).join('') : '<div class="feat-item text-slate-400">See dealer for details</div>'}
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #fff; }
  .col-hdr { font-weight: 800; font-size: 13px; margin-bottom: 6px; border-bottom: 2px solid ${primary}; }
  .feat-item { font-size: 11px; margin-bottom: 3px; }
  .opt-row { display: flex; justify-content: space-between; font-size: 10px; border-bottom: 1px solid #f1f5f9; padding: 2px 0; }
  .fe-c { text-align: center; } .fe-cl { font-size: 9px; color: #64748b; } .fe-cb { font-weight: 800; font-size: 13px; } .fe-cs { font-size: 9px; }
</style>
</head>
<body>
  <div style="background: ${primary}; color: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>${logoHtml}</div>
      <div style="text-align: right;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 900;">${esc(vehicleName)}</h1>
        <div style="font-size: 12px; opacity: 0.9;">Stock #: ${esc(vehicle.stocknumber || 'N/A')} | VIN: ${esc(vehicle.vin || 'N/A')}</div>
      </div>
    </div>
  </div>
  ${blurb ? `<div style="background: #f8fafc; border-left: 4px solid ${secondary}; padding: 10px 14px; font-size: 12px; font-style: italic; margin-bottom: 16px;">${esc(blurb)}</div>` : ''}
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
    ${featureColHtml}
  </div>
  ${feCells ? `<div style="background: #f1f5f9; padding: 12px; border-radius: 6px; display: flex; justify-content: space-around; margin-bottom: 16px;">${feCells}</div>` : ''}
  ${optRows ? `<div style="background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;"><div class="col-hdr">Available Packages</div>${optRows}</div>` : ''}
</body>
</html>`
}

export function buildBrochureHtml(vehicle, dealer, branding, recalls, photosDataUris, logoDataUri, copy) {
  const primary   = branding.primary_color   || '#1a2e4a'
  const secondary = branding.secondary_color || '#c8a84b'
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

  const isUS = /^(US|USA|UNITED STATES)$/.test((dealer?.country || '').trim().toUpperCase())
  const distUnit = isUS ? 'mi' : 'km'
  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
  const trim   = vehicle.trim || ''
  const price  = vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Call for Price'
  const mileage = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} ${distUnit}`
    : (vehicle.condition === 'new' ? 'Brand New' : '—')
  const photo0 = photosDataUris?.[0] || null

  const logoSrc = logoDataUri || branding.logo_url || null
  const logoImg = (h) => logoSrc
    ? `<img src="${logoSrc}" alt="${esc(dealer.name || '')}" style="max-height:${h}px;max-width:${h * 3.4}px;object-fit:contain;display:block;">`
    : `<span style="font-size:${Math.round(h * 0.42)}px;font-weight:900;color:${primary};">${esc(dealer.name || 'Your Dealership')}</span>`

  const c = copy || {}
  const specs = c.specs || null
  const highlight = (Array.isArray(c.highlight) ? c.highlight : []).slice(0, 2)

  const specTile = (label, val) => val ? `
    <div class="spec-tile"><div class="st-label">${esc(label)}</div><div class="st-val">${esc(val)}</div></div>` : ''

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const myNorm = norm(trim)
  const specTrims = Array.isArray(specs?.trims) ? specs.trims : []
  const trimMatches = (t) => { const n = norm(t.name); return myNorm && n && (n.includes(myNorm) || myNorm.includes(n)) }
  const myTrimObj = specTrims.find(trimMatches) || null
  const msrp = myTrimObj?.msrp || null

  const VIN_LABELS = {
    abs: 'ABS', esc: 'Stability Control', gvwr: 'GVWR', tpms: 'Tire Pressure Monitor',
    series: 'Series', turbo: 'Turbocharged', axles: 'Axles', seats: 'Seats', wheels: 'Wheels',
    windows: 'Windows', cylinders: 'Cylinders', lane_keep: 'Lane Keep Assist', seat_rows: 'Seat Rows',
    auto_brake: 'Automatic Emergency Braking', brake_desc: 'Brakes', horsepower: 'Horsepower',
    plant_city: 'Assembly City', wheel_base: 'Wheelbase', airbag_knee: 'Knee Airbags',
    airbag_side: 'Side Airbags', plant_state: 'Assembly State/Prov.', valve_train: 'Valve Train',
    airbag_front: 'Front Airbags', brake_system: 'Brake System', engine_model: 'Engine Model',
    manufacturer: 'Manufacturer', vehicle_type: 'Vehicle Type', adaptive_beam: 'Adaptive Driving Beam',
    engine_config: 'Engine Configuration', airbag_curtain: 'Curtain Airbags', blind_spot_mon: 'Blind Spot Monitor',
    curb_weight_lb: 'Curb Weight (lb)', displacement_l: 'Displacement (L)', fuel_injection: 'Fuel Injection',
    lane_departure: 'Lane Departure Warning', sae_automation: 'Driving Automation', adaptive_cruise: 'Adaptive Cruise',
    displacement_cc: 'Displacement (cc)', electrification: 'Electrification', wheel_size_rear: 'Rear Wheel Size',
    keyless_ignition: 'Keyless Ignition', wheel_size_front: 'Front Wheel Size', blind_spot_interv: 'Blind Spot Intervention',
    forward_collision: 'Forward Collision Warning', steering_location: 'Steering', adaptive_headlights: 'Adaptive Headlights',
    engine_manufacturer: 'Engine Manufacturer', fuel_type_secondary: 'Secondary Fuel', transmission_speeds: 'Transmission Speeds',
    plant_country: 'Assembly Country',
  }
  const SKIP = new Set(['decoded_at', 'decode_error', 'plant_company'])
  const humanize = k => k.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
  const specMap = new Map()
  const addSpec = (label, val) => {
    if (val == null) return
    const s = String(val).trim()
    if (!s || /^(not applicable|n\/?a|null|none)$/i.test(s)) return
    if (!specMap.has(label)) specMap.set(label, s)
  }
  addSpec('Year', vehicle.year); addSpec('Make', vehicle.make); addSpec('Model', vehicle.model)
  addSpec('Trim', trim); addSpec('Body Style', vehicle.body_style); addSpec('Drivetrain', vehicle.drivetrain)
  addSpec('Transmission', vehicle.transmission); addSpec('Engine', vehicle.engine)
  addSpec('Fuel Type', vehicle.fuel_type); addSpec('Doors', vehicle.doors)
  addSpec('Exterior Colour', vehicle.exterior_color); addSpec('Interior Colour', vehicle.interior_color)
  addSpec('Mileage', vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} ${distUnit}` : null)
  const vd = vehicle.vin_data || {}
  for (const [k, v] of Object.entries(vd)) { if (!SKIP.has(k)) addSpec(VIN_LABELS[k] || humanize(k), v) }
  const specSheet = [...specMap.entries()].slice(0, 44)
    .map(([l, v]) => `<div class="sp"><span class="sp-l">${esc(l)}</span><span class="sp-v">${esc(v)}</span></div>`).join('')

  const feHtml = (() => {
    const fe = specs?.fuel_economy; if (!fe) return ''
    const g = fe.gas || {}, e = fe.electric || {}
    const dual = (l100, mpg) => {
      const met = l100 != null ? `${l100} L/100km` : '—', imp = mpg != null ? `${mpg} MPG` : '—'
      return { big: isUS ? imp : met, small: isUS ? met : imp }
    }
    const cell = (label, big, small) => `<div class="fe-cell"><div class="fe-lbl">${esc(label)}</div><div class="fe-big">${esc(big)}</div><div class="fe-sm">${esc(small)}</div></div>`
    let cells = ''
    if (e && (e.range_km != null || e.range_mi != null)) {
      const km = e.range_km != null ? `${e.range_km} km` : '—', mi = e.range_mi != null ? `${e.range_mi} mi` : '—'
      cells += cell('Electric Range', isUS ? mi : km, isUS ? km : mi)
      if (e.kwh != null) cells += cell('Battery', `${e.kwh} kWh`, ' ')
    } else {
      for (const [lab, l100, mpg] of [['City', g.city_l100, g.city_mpg], ['Highway', g.hwy_l100, g.hwy_mpg], ['Combined', g.combined_l100, g.combined_mpg]]) {
        if (l100 == null && mpg == null) continue
        const d = dual(l100, mpg); cells += cell(lab, d.big, d.small)
      }
    }
    if (!cells) return ''
    return `<div class="fe"><div class="fe-title">Fuel Economy${fe.note ? ` <span class="fe-note">— ${esc(fe.note)}</span>` : ''}</div><div class="fe-grid">${cells}</div><div class="fe-foot">Shown in ${isUS ? 'MPG · L/100km' : 'L/100km · MPG'}. Manufacturer estimates — actual mileage varies.</div></div>`
  })()

  const trimsHtml = specTrims.slice(0, 6).map(t => {
    const mine = trimMatches(t)
    const feats = Array.isArray(t.features) ? t.features.slice(0, 6) : []
    return `<div class="trimcard${mine ? ' mine' : ''}">
      <div class="trimcard-h"><h3>${esc(t.name || '')}</h3>${mine ? '<span class="trim-badge">YOUR TRIM</span>' : ''}${t.msrp ? `<span class="trim-msrp">${esc(t.msrp)}</span>` : ''}</div>
      ${t.summary ? `<p class="trim-sum">${esc(t.summary)}</p>` : ''}
      ${feats.length ? `<ul class="trim-feats">${feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    </div>`
  }).join('')

  const pkgs = Array.isArray(specs?.packages) ? specs.packages : []
  const pkgsHtml = pkgs.slice(0, 8).map(p => `<div class="pkg">
    <div class="pkg-h"><h4>${esc(p.name || '')}</h4>${p.availability ? `<span class="pkg-av">${esc(p.availability)}</span>` : ''}</div>
    ${p.detail ? `<p>${esc(p.detail)}</p>` : ''}</div>`).join('')

  const contactLines = [
    branding.address ? `<div class="d-line">${esc(branding.address)}</div>` : '',
    branding.phone ? `<div class="d-line"><b>${esc(branding.phone)}</b></div>` : '',
    dealer.website_url ? `<div class="d-line">${esc(dealer.website_url)}</div>` : '',
    branding.hours ? `<div class="d-line" style="margin-top:10px;">${esc(branding.hours)}</div>` : '',
  ].filter(Boolean).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><style>
  ${fontFaceCss()}
  *{margin:0;padding:0;box-sizing:border-box;overflow-wrap:break-word;word-break:break-word;}
  @page{size:Letter;margin:0;}
  body{font-family:'Arimo','Arial',Helvetica,sans-serif;width:816px;background:#fff;color:#1f2937;}
  .page{width:816px;position:relative;page-break-after:always;break-after:page;padding-bottom:24px;}
  .page:last-child{page-break-after:auto;break-after:auto;}
  .page.full{height:1056px;padding-bottom:0;display:flex;flex-direction:column;overflow:hidden;}
  .page.full > .ihdr{flex-shrink:0;}
  .page.full > .icontent{flex:1;min-height:0;overflow:hidden;}
  .ihdr,.spec-row,.fe,.sp,.hl-para,.trimcard,.pkg,.cover-foot,.sect-lbl{break-inside:avoid;}
  .sans{font-family:'Arimo','Arial',Helvetica,sans-serif;}
  .eyebrow{font-family:'Arimo','Arial',sans-serif;font-size:13px;letter-spacing:5px;text-transform:uppercase;color:${secondary};font-weight:700;}

  /* PAGE 1 — COVER */
  .cover-top{padding:40px 56px 0;display:flex;align-items:center;justify-content:space-between;}
  .cover-hero{margin:26px 0 0;height:440px;background:${primary};}
  .cover-hero img{width:100%;height:100%;object-fit:cover;}
  .cover-hero .noimg{width:100%;height:100%;background:linear-gradient(135deg,${primary},${secondary});}
  .cover-body{flex:1;padding:34px 56px 0;}
  .cover-headline{font-size:44px;line-height:1.08;font-weight:900;color:${primary};letter-spacing:-1px;margin:12px 0 14px;}
  .cover-sub{font-size:20px;line-height:1.5;color:#4b5563;font-style:italic;}
  .cover-foot{margin-top:auto;background:${primary};padding:24px 56px;display:flex;align-items:center;justify-content:space-between;}
  .cover-name{color:#fff;font-size:25px;font-weight:900;font-family:'Arimo','Arial',sans-serif;}
  .cover-trim{color:rgba(255,255,255,.75);font-size:15px;font-family:'Arimo','Arial',sans-serif;margin-top:3px;}
  .cover-prices{display:flex;gap:10px;}
  .cover-price{background:${secondary};color:#fff;border-radius:8px;padding:12px 22px;text-align:center;}
  .cover-price.msrp{background:rgba(255,255,255,.14);}
  .cover-price .lbl{font-family:'Arimo','Arial',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.85;}
  .cover-price .val{font-size:26px;font-weight:900;line-height:1.15;}

  /* SHARED interior header */
  .ihdr{background:${primary};padding:32px 56px;}
  .ihdr .eyebrow{color:${secondary};}
  .ihdr h2{font-family:'Arimo','Arial',sans-serif;color:#fff;font-size:32px;font-weight:900;margin-top:8px;letter-spacing:-.5px;}
  .icontent{padding:34px 54px 34px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:22px 30px;align-items:start;}
  .cards-2col{columns:2;column-gap:24px;}
  .cards-2col > *{break-inside:avoid;}
  .trim-inc{margin-top:2px;}
  .trim-inc .ti-hdr{font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${secondary};margin-bottom:10px;}
  .trim-inc ul{list-style:none;}
  .trim-inc li{font-size:14px;color:#374151;padding:5px 0 5px 20px;position:relative;line-height:1.4;border-bottom:1px solid #f1f3f7;}
  .trim-inc li:before{content:'✓';position:absolute;left:0;color:${secondary};font-weight:900;}

  /* PAGE 2 — the build */
  .spec-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:26px;}
  .spec-tile{background:#f8fafc;border:1px solid #e5e7eb;border-top:4px solid ${secondary};border-radius:6px;padding:14px 12px;text-align:center;}
  .st-label{font-family:'Arimo','Arial',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;}
  .st-val{font-family:'Arimo','Arial',sans-serif;font-size:17px;font-weight:800;color:${primary};margin-top:5px;line-height:1.2;}
  .sect-lbl{font-family:'Arimo','Arial',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${secondary};margin:22px 0 12px;}
  .fe{background:${primary};border-radius:8px;padding:18px 22px;margin-bottom:8px;}
  .fe-title{font-family:'Arimo','Arial',sans-serif;color:#fff;font-size:16px;font-weight:800;margin-bottom:12px;}
  .fe-note{color:${secondary};font-weight:600;font-size:13px;}
  .fe-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .fe-cell{background:rgba(255,255,255,.08);border-radius:6px;padding:12px;text-align:center;}
  .fe-lbl{font-family:'Arimo','Arial',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.65);}
  .fe-big{font-family:'Arimo','Arial',sans-serif;font-size:20px;font-weight:900;color:#fff;margin-top:4px;}
  .fe-sm{font-family:'Arimo','Arial',sans-serif;font-size:12px;color:${secondary};margin-top:2px;}
  .fe-foot{font-family:'Arimo','Arial',sans-serif;font-size:10px;color:rgba(255,255,255,.6);margin-top:10px;}
  .specsheet{columns:2;column-gap:40px;}
  .sp{display:flex;justify-content:space-between;gap:12px;padding:8.5px 0;border-bottom:1px solid #eef1f5;break-inside:avoid;}
  .sp-l{font-size:13px;color:#64748b;}
  .sp-v{font-size:13px;font-weight:700;color:${primary};text-align:right;}

  /* PAGE 3 — this vehicle */
  .hl-photo{height:300px;background:${primary};margin-bottom:28px;border-radius:8px;overflow:hidden;}
  .hl-photo img{width:100%;height:100%;object-fit:cover;}
  .hl-para{font-size:15px;line-height:1.65;color:#374151;margin-bottom:14px;}

  /* PAGE 4 — trims */
  .lineup-intro{font-size:17px;line-height:1.7;color:#374151;margin-bottom:8px;}
  .lifestyle{font-size:15px;line-height:1.6;color:#6b7280;font-style:italic;margin-bottom:22px;}
  .trimcard{border:1px solid #e5e7eb;border-left:4px solid #e5e7eb;border-radius:6px;padding:13px 15px;margin-bottom:16px;break-inside:avoid;}
  .trimcard.mine{border-color:${secondary};border-left-color:${secondary};background:${secondary}0f;}
  .trimcard-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;}
  .trimcard h3{font-size:17px;font-weight:800;color:${primary};}
  .trim-msrp{font-size:12.5px;font-weight:800;color:${primary};margin-left:auto;}
  .trim-badge{font-size:9.5px;font-weight:800;letter-spacing:1px;background:${secondary};color:#fff;padding:2px 7px;border-radius:99px;}
  .trim-sum{font-size:12.5px;line-height:1.5;color:#4b5563;margin-bottom:5px;}
  .trim-feats{list-style:none;}
  .trim-feats li{font-size:12.5px;color:#374151;padding-left:14px;position:relative;line-height:1.55;}
  .trim-feats li:before{content:'✓';position:absolute;left:0;color:${secondary};font-weight:900;}

  /* PAGE 5 — packages */
  .pkg{border:1px solid #e5e7eb;border-left:4px solid ${secondary};border-radius:6px;padding:12px 16px;margin-bottom:16px;break-inside:avoid;}
  .pkg-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:2px;}
  .pkg h4{font-size:16px;font-weight:800;color:${primary};}
  .pkg-av{font-size:10.5px;color:#94a3b8;margin-left:auto;}
  .pkg p{font-size:13px;line-height:1.5;color:#4b5563;margin-top:3px;}

  /* PAGE 6 — dealership */
  .d-page{align-items:stretch;}
  .d-hero{background:${primary};flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px;}
  .d-logo{background:#fff;border-radius:12px;padding:26px 34px;margin-bottom:34px;}
  .d-name{color:#fff;font-size:40px;font-weight:900;font-family:'Arimo','Arial',sans-serif;letter-spacing:-.5px;}
  .d-tag{color:${secondary};font-size:20px;font-style:italic;margin-top:14px;max-width:560px;}
  .d-contact{background:#fff;padding:46px 56px;text-align:center;}
  .d-contact .eyebrow{display:block;margin-bottom:16px;}
  .d-line{font-family:'Arimo','Arial',sans-serif;font-size:19px;line-height:1.9;color:#374151;}
  .d-cta{margin-top:26px;background:${secondary};color:#fff;font-family:'Arimo','Arial',sans-serif;font-size:20px;font-weight:800;padding:16px 0;border-radius:8px;}
  .d-vin{font-family:'Arimo','Arial',sans-serif;font-size:12px;color:#9ca3af;margin-top:22px;letter-spacing:.5px;}
</style></head><body>

<!-- PAGE 1 — COVER -->
<div class="page full">
  <div class="cover-top">${logoImg(52)}<span class="eyebrow">Vehicle Brochure</span></div>
  <div class="cover-hero">${photo0 ? `<img src="${photo0}">` : `<div class="noimg"></div>`}</div>
  <div class="cover-body">
    <span class="eyebrow">${esc(vehicle.condition === 'new' ? 'New Arrival' : 'Featured Vehicle')}</span>
    <div class="cover-headline">${esc(c.headline || vehicleName)}</div>
    <div class="cover-sub">${esc(c.cover_subhead || '')}</div>
  </div>
  <div class="cover-foot">
    <div><div class="cover-name">${esc(vehicleName)}</div>${trim ? `<div class="cover-trim">${esc(trim)}</div>` : ''}</div>
    <div class="cover-prices">
      ${msrp ? `<div class="cover-price msrp"><div class="lbl">MSRP</div><div class="val">${esc(String(msrp).replace(/\s*\(approx\.?\)/i, ''))}</div></div>` : ''}
      <div class="cover-price"><div class="lbl">Our Price</div><div class="val">${esc(price)}</div></div>
    </div>
  </div>
</div>

<!-- PAGE 2 — THE BUILD (as configured) + highlight -->
<div class="page full">
  <div class="ihdr"><span class="eyebrow">The Build</span><h2>Your ${esc(vehicleName)}${trim ? ' ' + esc(trim) : ''}</h2></div>
  <div class="icontent">
    <div class="spec-row">
      ${specTile('Our Price', price)}
      ${msrp ? specTile('MSRP', String(msrp).replace(/\s*\(approx\.?\)/i, '')) : specTile('Mileage', mileage)}
      ${specTile('Mileage', mileage)}
    </div>
    <div class="spec-row">
      ${specTile(vehicle.vin_data?.electrification ? 'Powertrain' : 'Drivetrain', vehicle.vin_data?.electrification || vehicle.drivetrain)}
      ${specTile('Engine', vehicle.engine)}
      ${specTile('Transmission', vehicle.transmission || (vehicle.vin_data?.transmission_speeds ? `${vehicle.vin_data.transmission_speeds}-Speed` : null))}
    </div>
    ${feHtml}
    <div class="two-col">
      ${highlight.length ? `<div><div class="sect-lbl">About This Vehicle</div>${highlight.map(p => `<p class="hl-para">${esc(p)}</p>`).join('')}</div>` : '<div></div>'}
      ${myTrimObj && Array.isArray(myTrimObj.features) && myTrimObj.features.length
        ? `<div class="trim-inc"><div class="ti-hdr">Your ${esc(myTrimObj.name || trim || 'Trim')} Includes</div><ul>${myTrimObj.features.slice(0, 12).map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`
        : ''}
    </div>
  </div>
</div>

<!-- PAGE 3 — FULL SPECIFICATIONS -->
<div class="page full">
  <div class="ihdr"><span class="eyebrow">Specifications</span><h2>Full Specs — As Decoded from the VIN</h2></div>
  <div class="icontent">
    <div class="specsheet">${specSheet}</div>
  </div>
</div>

${specTrims.length ? `
<!-- PAGE 4 — MODELS & TRIMS -->
<div class="page full">
  <div class="ihdr"><span class="eyebrow">The Lineup</span><h2>${esc([vehicle.make, vehicle.model].filter(Boolean).join(' '))} — Models &amp; Trims</h2></div>
  <div class="icontent">
    ${specs?.model_intro ? `<p class="lineup-intro">${esc(specs.model_intro)}</p>` : ''}
    ${specs?.lifestyle ? `<p class="lifestyle">${esc(specs.lifestyle)}</p>` : ''}
    <div class="cards-2col">${trimsHtml}</div>
  </div>
</div>` : ''}

${pkgs.length ? `
<!-- PAGE 5 — PACKAGES & OPTIONS -->
<div class="page full">
  <div class="ihdr"><span class="eyebrow">Packages &amp; Options</span><h2>Available on the ${esc([vehicle.make, vehicle.model].filter(Boolean).join(' '))}</h2></div>
  <div class="icontent">
    <div class="cards-2col">${pkgsHtml}</div>
  </div>
</div>` : ''}

<!-- PAGE — DEALERSHIP -->
<div class="page full d-page">
  <div class="d-hero">
    ${logoSrc ? `<div class="d-logo">${logoImg(70)}</div>` : ''}
    <div class="d-name">${esc(dealer.name || 'Your Dealership')}</div>
    ${branding.tagline ? `<div class="d-tag">&ldquo;${esc(branding.tagline)}&rdquo;</div>` : ''}
  </div>
  <div class="d-contact">
    <span class="eyebrow">Visit Us Today</span>
    ${contactLines || `<div class="d-line">Contact us to book your test drive.</div>`}
    <div class="d-cta">Book Your Test Drive</div>
    <div class="d-vin">${esc(vehicleName)}${trim ? ' ' + esc(trim) : ''}${vehicle.stocknumber ? ' · Stock #' + esc(vehicle.stocknumber) : ''}${vehicle.vin ? ' · VIN ' + esc(vehicle.vin) : ''}</div>
  </div>
</div>

</body></html>`
}
