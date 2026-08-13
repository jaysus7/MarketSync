/**
 * OEM brochure fetcher — pulls the authentic manufacturer sales brochure PDF from
 * Auto-Brochures (auto-brochures.com), which hosts factory brochures up to ~2023.
 *
 * Their files follow a predictable path:
 *   /makes/{Make}/{ModelFolder}/{Make}_{Region}%20{ModelFile}_{Year}.pdf
 * e.g. /makes/Chevrolet/Silverado/Chevrolet_US%20Silverado_2002.pdf
 *      /makes/Chevrolet/Silverado/Chevrolet_US%20SilveradoHD_2011.pdf
 *
 * Model naming varies (base word vs joined vs suffixed), so we try a small set of
 * candidate URLs and return the first that returns a real PDF. Returns
 * { buffer, url, provider, year } or null.
 */
import { browserFetch } from '../shared.js'

const BASE = 'https://www.auto-brochures.com'
const proper = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

export async function fetchOemBrochurePdf(vehicle) {
  const make = proper(vehicle.make)
  const rawModel = String(vehicle.model || '').trim()
  const yr = Number(vehicle.year)
  if (!make || !rawModel || !yr) return null

  const words = rawModel.split(/\s+/).filter(Boolean)
  const first = proper(words[0])
  const joined = proper(words.join(''))          // "Silverado 1500" -> "Silverado1500"
  const files = [...new Set([first, joined].filter(Boolean))]
  const folders = [...new Set([first, joined].filter(Boolean))]
  // Site tops out around 2023 — for newer cars try the most recent brochures, which
  // usually share the current generation's styling.
  const years = yr > 2023 ? [2023, 2022, 2021] : [yr, yr - 1]
  const regions = ['US', 'CA']

  let attempts = 0
  for (const year of years) {
    for (const folder of folders) {
      for (const file of files) {
        for (const region of regions) {
          if (attempts++ > 24) return null
          const url = `${BASE}/makes/${encodeURIComponent(make)}/${encodeURIComponent(folder)}/${encodeURIComponent(make)}_${region}%20${encodeURIComponent(file)}_${year}.pdf`
          try {
            const r = await browserFetch(url, {
              signal: AbortSignal.timeout(9000),
              headers: { Accept: 'application/pdf,*/*', Referer: `${BASE}/${make.toLowerCase()}.html` },
            })
            if (!r.ok) continue
            const buf = Buffer.from(await r.arrayBuffer())
            const ct = (r.headers.get('content-type') || '').toLowerCase()
            // Guard against HTML 404 pages served with a 200: require a real PDF.
            const isPdf = ct.includes('pdf') || buf.slice(0, 5).toString('latin1') === '%PDF-'
            if (isPdf && buf.length > 20000) {
              return { buffer: buf, url, provider: 'Auto-Brochures', year }
            }
          } catch { /* try next candidate */ }
        }
      }
    }
  }
  return null
}
