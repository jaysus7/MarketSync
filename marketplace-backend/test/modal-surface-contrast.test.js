import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const theme = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const css = theme.replace(/\/\*[\s\S]*?\*\//g, '')

const luminance = (hex) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => {
  const [L1, L2] = [luminance(a), luminance(b)]
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

const rule = (selector) => {
  const at = css.indexOf(selector)
  assert.ok(at > -1, `expected the rule for ${selector}`)
  return css.slice(at, css.indexOf('}', at))
}

// ── A modal is a content surface, so it is opaque ────────────────────────────
// The card was a translucent gradient (.94 -> .82 alpha) on a dark .52 scrim, so
// the scrim bled through progressively: the header rendered ~#F7F7F8 and the
// bottom ~#DCDFE5. On a tall record modal that reads as the lower half being
// disabled. Depth belongs to the scrim behind the card, not to the card itself.
test('the modal card is opaque in both themes', () => {
  for (const sel of ['.ms-crm-glass {', '.dark .ms-crm-glass {']) {
    const body = rule(sel)
    const bg = body.match(/background:\s*([^;]+)/)
    assert.ok(bg, `${sel} must set a background`)
    assert.doesNotMatch(bg[1], /rgba\([^)]*,\s*0?\.\d+\s*\)/,
      `${sel} is translucent, so the dark scrim behind it bleeds through the content:\n  ${bg[1].trim()}`)
  }
})

test('the modal card does not composite a blur it cannot show', () => {
  const body = rule('.ms-crm-glass {')
  assert.match(body, /backdrop-filter:\s*none/,
    'an opaque card blurs nothing — the filter is pure compositing cost')
})

test("the modal's sticky header is opaque too", () => {
  const body = rule('.ms-crm-glass > .sticky {')
  const bg = body.match(/background:\s*([^;]+)/)
  assert.doesNotMatch(bg[1], /rgba\([^)]*,\s*0?\.\d+\s*\)/,
    'a translucent sub-header shows the scrim through the customer name')
})

// ── Theme-specific colours need a theme scope ────────────────────────────────
// The action buttons were styled for a dark modal — #d7e0ed on a 10%-alpha fill —
// with NO .dark scope, so that styling also landed on the light card at about
// 1.3:1. Email / Call / Text were not "greyed out" in the bug report; they were
// very nearly invisible, and they are the primary actions on a customer record.
test('modal action buttons are readable on the card they actually sit on', () => {
  const light = rule('.ms-crm-actions button {\n  color')
  const lightColor = light.match(/color:\s*(#[0-9a-fA-F]{3,6})/)
  assert.ok(lightColor, 'the light action button must set an explicit colour')
  const onCard = contrast(lightColor[1], '#FFFFFF')
  assert.ok(onCard >= 4.5,
    `light action buttons are ${onCard.toFixed(2)}:1 on the white card; WCAG AA needs 4.5:1`)

  const dark = rule('.dark .ms-crm-actions button {')
  const darkColor = dark.match(/color:\s*(#[0-9a-fA-F]{3,6})/)
  assert.ok(darkColor, 'the dark treatment must be scoped to .dark, not applied to both themes')
  const onDarkCard = contrast(darkColor[1], '#1C2943')
  assert.ok(onDarkCard >= 4.5,
    `dark action buttons are ${onDarkCard.toFixed(2)}:1 on the dark card`)
})

test('modal placeholders are legible in the theme they render in', () => {
  const light = rule('.ms-crm-glass input::placeholder,')
  const c = light.match(/color:\s*(#[0-9a-fA-F]{3,6})/)[1]
  const r = contrast(c, '#FFFFFF')
  assert.ok(r >= 4.5, `light placeholder ${c} is ${r.toFixed(2)}:1 on a white field`)
  assert.match(css, /\.dark \.ms-crm-glass input::placeholder/,
    'the dark placeholder must be scoped rather than shared')
})

// The general rule, so the next modal cannot repeat it: a colour chosen for one
// theme must not be applied by a rule that paints both.
test('no modal rule sets a light-on-light text colour for both themes at once', () => {
  const modalish = /(?:modal|dialog|drawer|crm-glass|crm-actions|popover)/i
  const norm = (sel) => sel.replace(/\s+/g, ' ').trim()

  // A rule is judged against the white card only when nothing supplies a surface under
  // it. That can come from the same block, from the wrapper the selector names (the
  // `h1` in `.studio-home-hero h1` sits on the hero's gradient), or from the Tailwind
  // bg-*/text-white utility the selector explicitly targets. The modal ROOT does not
  // count as that wrapper — it is the card itself, so exempting on it would exempt
  // every rule in the modal. A qualifying wrapper therefore has a descendant part of
  // its own, i.e. at least two space-separated compounds.
  const painted = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/background(?:-color|-image)?:/.test(m[2])) continue
    for (const one of m[1].split(',')) {
      const sel = norm(one)
      if (sel && !sel.startsWith('@') && sel.split(' ').length >= 2) painted.push(sel)
    }
  }
  const hasSurface = (sel, body) => {
    if (/background(?:-color|-image)?:/.test(body)) return true
    if (/\[class\*="bg-|\.bg-|\.text-white/.test(sel)) return true
    return painted.some((p) => p !== sel &&
      (sel.startsWith(p + ' ') || sel.startsWith(p + '::') || sel.startsWith(p + ':')))
  }

  const offenders = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2]
    const col = body.match(/(?<!-)color:\s*(#[0-9a-fA-F]{3,6})/)
    if (!col) continue
    for (const raw of m[1].split(',')) {
      const sel = norm(raw)
      if (!sel || !modalish.test(sel)) continue
      if (/(^|\s)\.dark(\s|\.)/.test(sel)) continue
      if (hasSurface(sel, body)) continue
      if (contrast(col[1], '#FFFFFF') < 4.5) offenders.push(`${col[1]} in ${sel.slice(0, 70)}`)
    }
  }

  assert.deepEqual(offenders, [],
    `these unscoped modal rules put low-contrast text on the surface they land on:\n  ${offenders.join('\n  ')}`)
})
