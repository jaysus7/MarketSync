// Inlined @font-face CSS for the PDF templates.
//
// Why this exists: on Render the PDFs render in @sparticuz/chromium, a slim
// Lambda-style Chromium that ships with NO system fonts. Named families like
// 'Georgia' and 'Arial' therefore silently fall back to a single default face —
// the serif/sans distinction is lost and text metrics shift, which is what made
// brochures look mis-fonted / misaligned in production.
//
// The fix: embed real fonts as base64 data-URI @font-face rules so Chromium uses
// them regardless of what's installed. We use Google's metric-compatible pair:
//   Arimo  ≈ Arial              (sans)
//   Tinos  ≈ Times New Roman    (serif)
// so the existing 'Arial' / serif stacks match closely.
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const fontFile = (pkg, file) =>
  join(here, '..', 'node_modules', '@fontsource', pkg, 'files', file)

const FACES = [
  { family: 'Arimo', weight: 400, pkg: 'arimo', file: 'arimo-latin-400-normal.woff2' },
  { family: 'Arimo', weight: 700, pkg: 'arimo', file: 'arimo-latin-700-normal.woff2' },
  { family: 'Tinos', weight: 400, pkg: 'tinos', file: 'tinos-latin-400-normal.woff2' },
  { family: 'Tinos', weight: 700, pkg: 'tinos', file: 'tinos-latin-700-normal.woff2' },
]

let _css = null

// Build the @font-face block once (cached). Never throws — if a font file is
// missing for any reason we return '' and the templates fall back to their
// existing CSS font stacks, so PDF generation still succeeds.
export function fontFaceCss() {
  if (_css !== null) return _css
  try {
    _css = FACES.map(f => {
      const b64 = readFileSync(fontFile(f.pkg, f.file)).toString('base64')
      return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};` +
             `src:url(data:font/woff2;base64,${b64}) format('woff2');}`
    }).join('\n')
  } catch (e) {
    console.warn('[brochure-fonts] could not inline fonts, using fallbacks:', e.message)
    _css = ''
  }
  return _css
}
