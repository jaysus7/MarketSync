/**
 * License-plate → VIN lookup for trade appraisals.
 *
 * Plate decoding always requires a third-party data provider (there is no free
 * public plate→VIN service), so this stays inert until MarketSync provisions one and
 * sets its API key — the same "ops secret" pattern as the OAuth connectors. Two
 * well-documented providers are supported; whichever key is present is used:
 *
 *   CarsXE:             CARSXE_API_KEY            (api.carsxe.com/v1/platedecoder)
 *   Vehicle Databases:  VEHICLE_DATABASES_API_KEY (api.vehicledatabases.com/license-decode)
 *
 * Returns { vin, year, make, model, trim } — the VIN is the important part; the
 * appraisal then runs its normal VIN decode for full specs. Throws a clear,
 * dealer-friendly error when the plate can't be resolved or no provider is set.
 */

export function plateLookupConfigured() {
  return !!(process.env.CARSXE_API_KEY || process.env.VEHICLE_DATABASES_API_KEY)
}
export function plateLookupProvider() {
  if (process.env.CARSXE_API_KEY) return 'carsxe'
  if (process.env.VEHICLE_DATABASES_API_KEY) return 'vehicle_databases'
  return null
}

const clean = v => (v && String(v).trim() && String(v).trim().toLowerCase() !== 'null') ? String(v).trim() : null
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/

async function carsxeLookup(plate, region, country) {
  const p = new URLSearchParams({ key: process.env.CARSXE_API_KEY, plate, state: region, country, format: 'json' })
  const r = await fetch(`https://api.carsxe.com/v1/platedecoder?${p.toString()}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j?.success === false) throw new Error(j?.message || `Plate service error (HTTP ${r.status}).`)
  const v = j.vehicle || j.attributes || j.data || j
  const vin = clean(j.vin) || clean(v?.vin)
  return {
    vin, year: clean(v?.year), make: clean(v?.make), model: clean(v?.model),
    trim: clean(v?.trim) || clean(v?.series) || null,
  }
}

async function vehicleDatabasesLookup(plate, region) {
  const r = await fetch(`https://api.vehicledatabases.com/license-decode/${encodeURIComponent(region)}/${encodeURIComponent(plate)}`, {
    headers: { 'x-AuthKey': process.env.VEHICLE_DATABASES_API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j?.status && j.status !== 'success')) throw new Error(j?.message || `Plate service error (HTTP ${r.status}).`)
  const d = j.data || {}
  const basic = d.basic || d.intro || {}
  const vin = clean(d.vin) || clean(basic.vin) || clean(d.intro?.vin)
  return {
    vin, year: clean(basic.year), make: clean(basic.make), model: clean(basic.model),
    trim: clean(basic.trim) || clean(basic.series) || null,
  }
}

// Resolve a plate to a VIN. `region` = 2-letter US state / CA province; `country` = US|CA.
export async function lookupPlate({ plate, region, country = 'US' } = {}) {
  const provider = plateLookupProvider()
  if (!provider) { const e = new Error('Plate lookup isn’t set up on this account yet — enter the VIN instead.'); e.notConfigured = true; throw e }
  const pl = String(plate || '').trim().toUpperCase().replace(/\s+/g, '')
  const reg = String(region || '').trim().toUpperCase()
  const cc = String(country || 'US').trim().toUpperCase() === 'CA' ? 'CA' : 'US'
  if (!pl) throw new Error('Enter a plate number.')
  if (!/^[A-Z]{2}$/.test(reg)) throw new Error('Pick the plate’s state/province.')
  const out = provider === 'carsxe' ? await carsxeLookup(pl, reg, cc) : await vehicleDatabasesLookup(pl, reg)
  if (!out.vin || !VIN_RE.test(out.vin)) throw new Error('No VIN found for that plate — check the plate and state, or enter the VIN.')
  return out
}
