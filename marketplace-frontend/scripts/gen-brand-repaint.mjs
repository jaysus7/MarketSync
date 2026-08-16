// Regenerates css/dashboard-brand-repaint.css.
//
// The dashboard is built with Tailwind's CDN (JIT) compiler and its literal
// source uses Tailwind's stock `indigo-*` utility classes throughout
// dashboard.html + dashboard.js + js/modules/*.js — hundreds of occurrences
// across load-order-critical files that must not be hand-edited one by one.
// Real brand color is the blue scale in css/marketsync-theme.css
// (--ms-blue-50..950, anchored on the brand guide's #2563EB/#1F4ED8/#153AA6
// at 500/600/700). This script scans the dashboard source for every
// `indigo-*` utility token actually in use (including state/dark/group/peer
// variants and opacity modifiers), and emits one !important override per
// token, pointed at the matching --ms-blue-N custom property.
//
// Run after adding a NEW indigo-* class anywhere in the dashboard source:
//   node scripts/gen-brand-repaint.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FE = fileURLToPath(new URL('../', import.meta.url));
const OUT = FE + 'css/dashboard-brand-repaint.css';

const files = [
  'dashboard.html',
  'dashboard.js',
  ...readdirSync(FE + 'js/modules').filter(f => f.endsWith('.js')).map(f => 'js/modules/' + f),
];
let src = '';
for (const f of files) src += readFileSync(FE + f, 'utf8') + '\n';

const RE = /\b((?:[a-zA-Z-]+:)*)(bg|text|border|ring-offset|ring|accent|decoration|divide|outline|shadow|from|via|to|caret|fill|stroke|placeholder)-indigo-(50|100|200|300|400|500|600|700|800|900|950)(\/(\d{1,3}))?\b/g;
const found = new Map();
let m;
while ((m = RE.exec(src))) {
  const [, prefix, util, shade, , alpha] = m;
  const key = prefix + util + '-indigo-' + shade + (alpha ? '/' + alpha : '');
  found.set(key, { prefix, util, shade, alpha: alpha || null });
}

function colorValue(shade, alpha) {
  if (!alpha) return `var(--ms-blue-${shade})`;
  return `rgb(var(--ms-blue-${shade}-rgb) / ${alpha}%)`;
}

const PROP = {
  bg: 'background-color', text: 'color', border: 'border-color',
  ring: '--tw-ring-color', accent: 'accent-color', shadow: '--tw-shadow-color',
  'ring-offset': '--tw-ring-offset-color', decoration: 'text-decoration-color',
  outline: 'outline-color', caret: 'caret-color', fill: 'fill', stroke: 'stroke',
};

const escapeClass = (full) => full.replace(/:/g, '\\:').replace(/\//g, '\\/');

function buildSelector(prefix, fullClassEscaped) {
  const parts = prefix ? prefix.split(':').filter(Boolean) : [];
  let sel = '';
  for (const part of parts) {
    if (part === 'dark') sel += '.dark ';
    else if (part === 'group-hover') sel += '.group:hover ';
    else if (part === 'peer-checked') sel += '.peer:checked ~ ';
  }
  let out = sel;
  if (parts.includes('placeholder')) {
    out += '.' + fullClassEscaped + '::placeholder';
  } else {
    out += '.' + fullClassEscaped;
    if (parts.includes('hover')) out += ':hover';
    if (parts.includes('focus')) out += ':focus';
    if (parts.includes('focus-within')) out += ':focus-within';
    if (parts.includes('active')) out += ':active';
    if (parts.includes('disabled')) out += ':disabled';
  }
  return out;
}

const lines = [];
const skipped = [];
for (const t of found.values()) {
  const full = t.prefix + t.util + '-indigo-' + t.shade + (t.alpha ? '/' + t.alpha : '');
  const escaped = escapeClass(full);
  const selector = buildSelector(t.prefix, escaped);
  const value = colorValue(t.shade, t.alpha);

  if (t.util === 'from') lines.push(`${selector}{--tw-gradient-from:${value} var(--tw-gradient-from-position)!important}`);
  else if (t.util === 'via') lines.push(`${selector}{--tw-gradient-via:${value} var(--tw-gradient-via-position)!important}`);
  else if (t.util === 'to') lines.push(`${selector}{--tw-gradient-to:${value} var(--tw-gradient-to-position)!important}`);
  else if (t.util === 'placeholder') lines.push(`${selector}{color:${value}!important}`);
  else if (PROP[t.util]) lines.push(`${selector}{${PROP[t.util]}:${value}!important}`);
  else skipped.push(full);
}

if (skipped.length) console.warn('Skipped (no property mapping):', skipped);
console.log(`${OUT}: ${lines.length} rules generated from ${found.size} indigo-* tokens found across ${files.length} files.`);

const css = `/* ── Brand blue repaint — auto-generated, do not hand-edit ──────────────
 * Tailwind CDN's default indigo palette is used throughout the dashboard
 * source (bg-indigo-*, text-indigo-*, border-indigo-*, ring/shadow/gradient
 * stops) — but the real brand color is the blue scale in
 * css/marketsync-theme.css (--ms-blue-50..950, anchored on the brand guide's
 * #2563EB/#1F4ED8/#153AA6 at 500/600/700). Rather than touching hundreds of
 * literal class names across load-order-critical dashboard.js/js/modules
 * files, this repaints every indigo-* utility actually used in the app to
 * its matching --ms-blue-N token, unconditionally (applies everywhere,
 * including inside the internal owner-only "MarketSync mode" purple skin in
 * dashboard.html, which wins there via its higher-specificity selectors).
 *
 * Regenerate after adding a new indigo-* class anywhere in the dashboard
 * source: node scripts/gen-brand-repaint.mjs
 * ────────────────────────────────────────────────────────────────────── */
${lines.join('\n')}
`;

writeFileSync(OUT, css);
