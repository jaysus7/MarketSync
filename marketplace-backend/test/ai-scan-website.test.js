import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../routes/ai-runtime.js', import.meta.url), 'utf8')
const route = source.match(/app\.post\('\/ai\/scan-website'[\s\S]*?\n {2}\}\)/)?.[0] || ''

test('store name prefers og:site_name over a title that leads with a generic page label', () => {
  // "Home | Welland Chevrolet" used to become the store name "Home" by blindly taking
  // the title's first '-'/'|' segment. Real dealer sites title their homepage either
  // way ("Home | Business" or "Business | Home"), so the fix must check og:site_name
  // first and, failing that, skip generic segments like "home"/"welcome"/"index".
  assert.match(route, /og:site_name/)
  assert.match(route, /GENERIC_TITLE_WORDS\s*=\s*\/\^\(home\|welcome\|index\|main\|homepage\)\$\/i/)
})

test('phone extraction prefers a tel: link and requires phone-shaped separators, not any 7 digits', () => {
  // The old regex — (?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4} — made the area code AND
  // every separator optional, so it matched any bare 7-digit run anywhere in the raw
  // HTML (prices, ids, zip codes) as a "phone number". The fix requires a separator
  // between each group, and checks tel: links first.
  assert.match(route, /href=\["']tel:/)
  assert.doesNotMatch(route, /\(\?\:\\\(\?\\d\{3\}\\\)\?\[\\s\.-\]\?\)\?\\d\{3\}\[\\s\.-\]\?\\d\{4\}/, 'the old permissive bare-digit phone regex must be gone')
})

test('email extraction prefers a mailto: link over a bare regex scan of the page', () => {
  assert.match(route, /href=\["']mailto:/)
})
