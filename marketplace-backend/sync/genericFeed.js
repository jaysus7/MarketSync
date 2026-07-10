// Generic inventory-feed ingester — dependency-free.
//
// Dealers can hand us the same inventory data feed their website platform already
// syndicates to AutoTrader / CarGurus / Google Vehicle Ads / Meta (Facebook). Those
// come in three shapes: JSON, XML (Google Vehicle / RSS-ish), and CSV/TSV (Meta
// catalog). This module auto-detects the format and maps each record to our canonical
// vehicle shape with flexible field-name matching, so a pasted feed URL "just works"
// regardless of which export the dealer gives us.

// ── Canonical field extraction ────────────────────────────────────────────────
// Each row is normalized to a plain lower-cased key→value map first, then we pull
// canonical fields by trying many common aliases (order = preference).
const FIELD_ALIASES = {
  vin: ['vin', 'vehicleidentificationnumber', 'vehicle_vin'],
  stocknumber: ['stocknumber', 'stock_number', 'stock', 'stockid', 'stock_id', 'stocknum', 'stockno', 'id', 'sku'],
  year: ['year', 'modelyear', 'model_year', 'vehicle_year', 'vehicleyear'],
  make: ['make', 'brand', 'manufacturer', 'vehicle_make', 'vehiclemake'],
  model: ['model', 'vehicle_model', 'vehiclemodel'],
  trim: ['trim', 'series', 'style', 'edition', 'trim_level'],
  price: ['price', 'saleprice', 'sale_price', 'sellingprice', 'selling_price', 'internetprice',
          'internet_price', 'askingprice', 'asking_price', 'specialprice', 'ourprice', 'listprice', 'list_price', 'msrp'],
  mileage: ['mileage', 'odometer', 'kilometres', 'kilometers', 'km', 'miles', 'odometer_value'],
  exteriorcolor: ['exteriorcolor', 'exterior_color', 'exteriorcolour', 'extcolor', 'ext_color', 'color', 'colour'],
  interiorcolor: ['interiorcolor', 'interior_color', 'interiorcolour', 'intcolor', 'int_color'],
  transmission: ['transmission', 'trans', 'transmission_type'],
  fueltype: ['fueltype', 'fuel_type', 'fuel'],
  bodystyle: ['bodystyle', 'body_style', 'body', 'bodytype', 'body_type'],
  condition: ['condition', 'type', 'newused', 'new_used', 'stocktype', 'stock_type', 'vehicle_type', 'availability_type'],
  vdp_url: ['url', 'link', 'vdp', 'vdpurl', 'vdp_url', 'detailurl', 'detail_url', 'vehicle_url', 'vehicleurl', 'permalink'],
  image_field: ['image', 'images', 'imageurl', 'image_url', 'imageurls', 'image_urls', 'photo', 'photos',
                'picture', 'pictures', 'image_link', 'imagelink', 'additional_image_link', 'photo_url', 'photourl'],
  // True lot / in-stock date (absolute) — the day the car actually landed on the lot.
  lot_date: ['date_in_stock', 'dateinstock', 'in_stock_date', 'instockdate', 'stock_date', 'stockdate',
             'date_added', 'dateadded', 'listing_date', 'listingdate', 'inventory_date', 'date_on_lot',
             'entry_date', 'date_in', 'datein', 'created_date', 'date_created', 'first_seen', 'inventory_date_added'],
  // Relative age fallback (days on lot) — used to derive a lot date when no absolute date is given.
  days_in_stock: ['days_in_stock', 'daysinstock', 'days_on_lot', 'daysonlot', 'age_in_days', 'age_days', 'dol']
}

// Resolve a true lot/in-stock date from a feed row: prefer an absolute date, else
// derive from a "days on lot" count. Returns an ISO string or null.
const parseLotDate = (row) => {
  const abs = pick(row, FIELD_ALIASES.lot_date)
  if (abs) {
    const t = Date.parse(abs)
    // Guard against garbage / epoch-0 / future-dated values.
    if (Number.isFinite(t) && t > Date.parse('2000-01-01') && t <= Date.now() + 86400000) {
      return new Date(t).toISOString()
    }
  }
  const daysRaw = pick(row, FIELD_ALIASES.days_in_stock)
  if (daysRaw != null) {
    const d = parseInt(String(daysRaw).replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(d) && d >= 0 && d < 3650) {
      return new Date(Date.now() - d * 86400000).toISOString()
    }
  }
  return null
}

const pick = (row, aliases) => {
  for (const a of aliases) {
    const v = row[a]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

const parseIntSafe = (s) => {
  if (s == null) return 0
  const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const normalizeCondition = (row) => {
  const raw = (pick(row, FIELD_ALIASES.condition) || '').toLowerCase()
  if (/demo|d[ée]mo/.test(raw)) return 'Demo'
  if (/\bnew\b/.test(raw)) return 'New'
  if (/used|pre-?owned|certified|occasion/.test(raw)) return 'Used'
  return null
}

const splitImages = (val) => {
  if (!val) return []
  // Feeds separate multiple image URLs by comma, pipe, semicolon, or whitespace.
  return String(val)
    .split(/[|,;\s]+/)
    .map(s => s.trim())
    .filter(u => /^https?:\/\//i.test(u) && !/coming|no-?image|placeholder/i.test(u))
}

// Map one normalized row (lower-cased keys) → canonical vehicle. Returns null if the
// row has no usable identifier (VIN or stock number).
export function mapFeedRow(rawRow) {
  const row = {}
  for (const [k, v] of Object.entries(rawRow)) row[k.toLowerCase().trim()] = v

  const vin = pick(row, FIELD_ALIASES.vin)
  const stocknumber = pick(row, FIELD_ALIASES.stocknumber)
  if (!vin && !stocknumber) return null

  const condition = normalizeCondition(row)
  return {
    vin: vin || null,
    stocknumber: stocknumber || null,
    year: parseIntSafe(pick(row, FIELD_ALIASES.year)) || null,
    make: pick(row, FIELD_ALIASES.make),
    model: pick(row, FIELD_ALIASES.model),
    trim: pick(row, FIELD_ALIASES.trim),
    price: parseIntSafe(pick(row, FIELD_ALIASES.price)),
    mileage: parseIntSafe(pick(row, FIELD_ALIASES.mileage)),
    exteriorcolor: pick(row, FIELD_ALIASES.exteriorcolor),
    interiorcolor: pick(row, FIELD_ALIASES.interiorcolor),
    transmission: pick(row, FIELD_ALIASES.transmission),
    fueltype: pick(row, FIELD_ALIASES.fueltype),
    bodystyle: pick(row, FIELD_ALIASES.bodystyle),
    condition,
    demo: condition === 'Demo',
    vdp_url: pick(row, FIELD_ALIASES.vdp_url),
    image_urls: splitImages(pick(row, FIELD_ALIASES.image_field)),
    lot_date: parseLotDate(row),
    onweb: true,
    salepending: false
  }
}

// ── JSON ───────────────────────────────────────────────────────────────────────
function parseJsonFeed(text) {
  let data
  try { data = JSON.parse(text) } catch { return null }
  const arr = Array.isArray(data) ? data
    : data.vehicles || data.Vehicles || data.inventory || data.Inventory
      || data.items || data.Items || data.records || data.Records || data.results || data.data
  if (!Array.isArray(arr)) return null
  return arr
}

// ── XML ──────────────────────────────────────────────────────────────────────
// Hand-rolled, good enough for flat vehicle feeds (Google Vehicle Ads, RSS-style,
// generic <vehicle>/<listing> exports). Finds the repeating record element, then
// pulls immediate child tag → text (and common attribute-carried image URLs).
function parseXmlFeed(text) {
  // Pick the record wrapper: try known names in order of specificity.
  const candidates = ['vehicle', 'listing', 'entry', 'item', 'record', 'car', 'unit', 'product']
  let tag = null, blocks = null
  for (const t of candidates) {
    const re = new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'gi')
    const found = [...text.matchAll(re)]
    if (found.length >= 1) { tag = t; blocks = found.map(m => m[1]); break }
  }
  if (!blocks) return null

  const decode = (s) => s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim()

  return blocks.map(block => {
    const row = {}
    // child tags: <field>value</field> (collect repeats — e.g. multiple <image>)
    const tagRe = /<([a-zA-Z0-9_:.-]+)\b[^>]*>([\s\S]*?)<\/\1>/g
    let m
    while ((m = tagRe.exec(block)) !== null) {
      const key = m[1].replace(/^.*:/, '').toLowerCase()  // strip xml namespace
      const val = decode(m[2])
      if (val === '') continue
      // Repeats (image, photo) → join so splitImages can re-split them.
      row[key] = row[key] ? `${row[key]}|${val}` : val
    }
    // self-closing tags carrying a url attribute: <image url="..."/> or <img src="..."/>
    const attrRe = /<(image|img|photo|picture)\b[^>]*\b(?:url|src|href)=["']([^"']+)["']/gi
    while ((m = attrRe.exec(block)) !== null) {
      row.image = row.image ? `${row.image}|${m[2]}` : m[2]
    }
    return row
  })
}

// ── CSV / TSV ──────────────────────────────────────────────────────────────────
// RFC-4180-ish: handles quoted fields, embedded commas/newlines, and doubled quotes.
// Auto-detects comma vs tab delimiter from the header line.
function parseCsvFeed(text) {
  const clean = text.replace(/^﻿/, '')  // strip BOM
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? clean.length : clean.indexOf('\n'))
  const delim = (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? '\t' : ','

  const rows = []
  let field = '', record = [], inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === delim) { record.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.length > 1 || record[0] !== '') rows.push(record)
      record = []
    } else field += c
  }
  if (field !== '' || record.length) { record.push(field); rows.push(record) }
  if (rows.length < 2) return null

  const header = rows[0].map(h => h.trim())
  return rows.slice(1).map(cells => {
    const obj = {}
    header.forEach((h, i) => { obj[h] = cells[i] })
    return obj
  })
}

// ── Public entrypoint ────────────────────────────────────────────────────────
// Detect format from content-type + body, parse rows, map to canonical vehicles.
// Returns { vehicles, format } or { vehicles: [], format: null } if unrecognized.
export function parseGenericFeed(body, contentType = '') {
  if (!body || !body.trim()) return { vehicles: [], format: null }
  const ct = contentType.toLowerCase()
  const head = body.trimStart().slice(0, 1)

  let rows = null, format = null
  if (ct.includes('json') || head === '{' || head === '[') { rows = parseJsonFeed(body); format = 'json' }
  else if (ct.includes('xml') || head === '<') { rows = parseXmlFeed(body); format = 'xml' }
  else { rows = parseCsvFeed(body); format = 'csv' }

  // Fallback: if the guessed format yielded nothing, try the others.
  if (!rows || !rows.length) {
    for (const [fmt, fn] of [['json', parseJsonFeed], ['xml', parseXmlFeed], ['csv', parseCsvFeed]]) {
      if (fmt === format) continue
      const r = fn(body)
      if (r && r.length) { rows = r; format = fmt; break }
    }
  }
  if (!rows || !rows.length) return { vehicles: [], format: null }

  const vehicles = rows.map(mapFeedRow).filter(Boolean)
  return { vehicles, format }
}
