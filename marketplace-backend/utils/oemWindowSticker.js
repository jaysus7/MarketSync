// ─────────────────────────────────────────────────────────────────────────
// OEM window sticker lookup — tries to fetch the REAL manufacturer Monroney
// label (the original window sticker) by VIN, so a dealer sees the authentic
// factory document when it's available, and we only fall back to a generated
// sticker when it isn't.
//
// Reality of coverage: the window sticker is produced per-manufacturer, and
// only a few brands publish it publicly by VIN. Ford/Lincoln have a genuinely
// public, reliable endpoint — that's what we start with. Each provider is a
// small self-contained function, so more public brands can be added over time
// (and a paid Monroney API could slot in here later for near-universal cover).
// ─────────────────────────────────────────────────────────────────────────

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i

// A real Monroney PDF is a proper PDF and never trivially small. Manufacturer
// "not found" responses are usually an HTML page or a tiny placeholder.
function looksLikePdf(buf) {
  return buf && buf.length > 8000 && buf.slice(0, 5).toString('latin1') === '%PDF-'
}

// Ford Direct publishes Ford + Lincoln window stickers publicly by VIN.
async function fordProvider(vin) {
  const url = `https://www.windowsticker.forddirect.com/windowsticker.pdf?vin=${encodeURIComponent(vin)}`
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
  if (!res.ok) return null
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (!ct.includes('pdf') && !ct.includes('octet-stream')) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (!looksLikePdf(buf)) return null
  return { buffer: buf, provider: 'Ford' }
}

// Map a make to the providers worth trying (avoids pointless cross-brand calls).
function providersFor(make) {
  const m = (make || '').toLowerCase()
  const list = []
  if (/\bford\b|lincoln/.test(m)) list.push(fordProvider)
  return list
}

/**
 * Attempt to fetch the authentic OEM window sticker PDF for a vehicle.
 * Returns { buffer, provider } on success, or null if no public source has it.
 * Never throws — safe to call inline.
 *
 * @param {object} vehicle  inventory row (needs vin + make)
 */
export async function fetchOemWindowStickerPdf(vehicle) {
  const vin = (vehicle?.vin || '').trim().toUpperCase()
  if (!VIN_RE.test(vin)) return null
  for (const provider of providersFor(vehicle.make)) {
    try {
      const hit = await provider(vin)
      if (hit) return hit
    } catch (e) {
      console.warn('[oem-sticker] provider failed:', e.message)
    }
  }
  return null
}
