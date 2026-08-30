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
// Selectors this stylesheet paints with a dark or saturated background. Anything
// nested inside one of them renders on that surface, so light text there is correct.
const darkSurfaces = (() => {
  const out = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [sel, body] = [m[1].trim().replace(/\s+/g, ' '), m[2]]
    const bg = body.match(/background(?:-color|-image)?:\s*([^;]+)/)
    if (!bg) continue
    const value = bg[1]
    if (/gradient\(/.test(value)) { out.push(sel); continue }
    const hex = value.match(/#([0-9a-fA-F]{3,6})/)
    if (hex && luminance(`#${hex[1]}`) < 0.25) out.push(sel)
  }
  return out
})()

test('no modal rule sets a light-on-light text colour for both themes at once', () => {
  const modalish = /(?:modal|dialog|drawer|crm-glass|crm-actions|popover)/i
  const offenders = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [sel, body] = [m[1].trim(), m[2]]
    if (!modalish.test(sel)) continue
    if (/(^|\s)\.dark(\s|\.)/.test(sel)) continue
    // A rule that paints its own background is judged against that, not the card.
    if (/background(?:-color|-image)?:/.test(body)) continue
    // A selector that targets elements BY their background utility is likewise judged
    // against that background: `button[class*="bg-blue-600"] { color: #fff }` is white
    // on blue-600, not white on the card. The background is declared by the element the
    // rule selects, which is the same guarantee as painting it here.
    if (/\[class\*=["']bg-[\w-]+|(^|[\s.])bg-[\w-]+/.test(sel)) continue
    // Same principle for `.text-white`: the utility's entire meaning is "this text is
    // white because what it sits on is not". A rule enforcing it against a competing
    // panel colour is honouring that intent, not choosing a colour for both themes.
    // The panel's other text utilities ARE remapped for light, which is the real
    // protection here and is asserted separately below.
    if (/(^|[\s.])text-white(\s|$|[,:])/.test(sel)) continue
    // A descendant of a surface this stylesheet paints dark is on that surface, not on
    // the card — e.g. the Studio header input sits inside a dark gradient header.
    if (darkSurfaces.some(prefix => sel.startsWith(prefix) && sel.length > prefix.length)) continue
    const col = body.match(/(?<!-)color:\s*(#[0-9a-fA-F]{3,6})/)
    if (!col) continue
    if (contrast(col[1], '#FFFFFF') < 4.5) offenders.push(`${col[1]} in ${sel.replace(/\s+/g, ' ').slice(0, 70)}`)
  }
  assert.deepEqual(offenders, [],
    `these unscoped modal rules put low-contrast text on the light card:\n  ${offenders.join('\n  ')}`)
})

test('the light Studio tool panel remaps text utilities chosen for a dark surface', () => {
  // This is what makes exempting `.text-white` above safe: the panel is light, and the
  // slate utilities picked for a dark panel are deliberately re-tinted for it. If that
  // sweep is ever removed, light-on-light returns to the panel and this fails - rather
  // than the exemption quietly absorbing it.
  for (const [utility, expected] of [['.text-slate-300', '#334155'], ['.text-slate-400', '#64748b']]) {
    const re = new RegExp(`#studio-tool-panel \\${utility} \\{\\s*color:\\s*(#[0-9a-fA-F]{3,6})`)
    const found = css.match(re)
    assert.ok(found, `${utility} must be remapped for the light tool panel`)
    assert.equal(found[1].toLowerCase(), expected)
    assert.ok(contrast(found[1], '#FFFFFF') >= 4.5,
      `${utility} remaps to ${found[1]}, only ${contrast(found[1], '#FFFFFF').toFixed(2)}:1 on the light panel`)
  }
})
