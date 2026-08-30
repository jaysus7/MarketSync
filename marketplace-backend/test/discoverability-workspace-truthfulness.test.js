import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../marketplace-frontend/js/modules/discoverability-workspace.js', import.meta.url),
  'utf8'
)

test('the workspace renders no fabricated metric fallbacks', () => {
  // Patterns like `${expr || '1,420'}` or `${expr || '59.3%'}` silently invent a
  // plausible-looking measurement when the backend reported nothing.
  const fabricated = [...source.matchAll(/\$\{[^{}]*?\|\|\s*'([0-9][^']*)'\}/g)].map((m) => m[1])
  assert.deepEqual(fabricated, [], `fabricated metric fallbacks still present: ${fabricated.join(', ')}`)
})

test('the workspace has no seeded overview fixture', () => {
  // The old loader substituted a whole fake payload (compositeScore 86, 1420 organic
  // clicks, 28400 impressions, ...) whenever the API call failed.
  assert.doesNotMatch(source, /compositeScore:\s*8[0-9]/, 'seeded compositeScore fixture still present')
  assert.doesNotMatch(source, /organicClicks:\s*\d/, 'seeded SEO fixture still present')
  assert.doesNotMatch(source, /organicImpressions:\s*\d/, 'seeded SEO fixture still present')
  assert.doesNotMatch(source, /brandMentionRate:\s*'/, 'seeded GEO fixture still present')
})

test('a failed or unavailable overview renders a state, never placeholder scores', () => {
  assert.match(source, /renderDiscUnavailableState\s*\(/)
  assert.match(source, /function renderDiscUnavailableState/)
  // The loader must not fall back to an object literal when the API returns nothing.
  assert.doesNotMatch(source, /__discData\s*=\s*res\s*\|\|\s*\{/)
})

test('an unentitled dealership sees the upgrade state rather than scores', () => {
  assert.match(source, /function renderDiscUpgradeState/)
  assert.match(source, /entitled\s*===\s*false/)
})

test('Quality and Evidence Coverage are reported separately and never combined', () => {
  assert.match(source, /uppercase font-bold text-slate-400">Quality</)
  assert.match(source, /uppercase font-bold text-slate-400">Evidence Coverage</)
  assert.match(source, /discScoreHtml\(d\.qualityScore\)/)
  assert.match(source, /discScoreHtml\(d\.evidenceCoverage\)/)
  // The replaced header combined both into a single "Composite Score" badge.
  assert.doesNotMatch(source, />Composite Score</)
})

test('an absent score renders as Not measured, never as zero or a placeholder', () => {
  assert.match(source, /function discScoreValue/)
  assert.match(source, /Number\.isFinite\(value\)/)
  assert.match(source, /Not measured/)
  // `|| 86` turned both "unknown" and a real 0 into a fabricated 86.
  assert.doesNotMatch(source, /compositeScore\s*\|\|\s*86/)
})

test('Verified 100 renders each requirement independently', () => {
  assert.match(source, /function renderDiscVerified100Card/)
  for (const requirement of [
    'Quality = 100',
    'Evidence Coverage = 100',
    'Critical = 0',
    'High = 0',
    'Validation failures = 0'
  ]) {
    assert.ok(source.includes(requirement), `Verified 100 requirement not rendered: ${requirement}`)
  }
  for (const state of ['Passed', 'Failing', 'Not measured']) {
    assert.ok(source.includes(state), `Verified 100 state not rendered: ${state}`)
  }
})

test('Verified 100 cannot be shown from the backend flag alone', () => {
  // verified100 must be corroborated by every requirement independently passing, so a
  // single upstream boolean can never force the badge.
  assert.match(source, /d\.verified100 === true && rows\.every\(/)
})

test('applying a fix advertises no hardcoded score gain', () => {
  assert.doesNotMatch(source, /totalScoreGain/, 'hardcoded score-gain accumulator still present')
  assert.doesNotMatch(source, /Est\. Score Gain/, 'estimated score gain tile still present')
  assert.doesNotMatch(source, /\+\$\{[a-zA-Z]*[Ss]coreGain\}/)
  assert.match(source, /Re-measured/)
})
