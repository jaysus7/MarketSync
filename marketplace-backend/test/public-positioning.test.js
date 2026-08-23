import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../../marketplace-frontend/${p}`, import.meta.url), 'utf8')

// Primary public marketing/positioning pages.
const CORE_PAGES = ['index.html', 'pricing.html', 'dealer-os.html', 'faq.html', 'compare.html', 'features.html', 'upgrade.html']

// The feature landing pages that used to carry the false "Core — included with every
// plan" badge.
const BADGE_PAGES = [
  'crm-lead-delivery.html', 'dealer-groups.html', 'dealer-inventory-sync.html',
  'sales-leaderboard.html', 'sales-pipeline.html',
  'facebook-marketplace-poster.html', 'facebook-posting-safety.html',
]

test('no public page claims "Core — included with every plan" (Core is a paid DealerOS tier)', () => {
  for (const page of [...CORE_PAGES, ...BADGE_PAGES]) {
    assert.doesNotMatch(read(page), /Core\s*[—-]\s*included with every plan/i,
      `${page} must not claim Core is included with every plan`)
  }
})

test('the primary public pages carry no obsolete product/pricing positioning', () => {
  // AI Boost (retired add-on brand), the old Facebook-first Dealer/Individual Sales Rep
  // plans, and the retired $129/$299 add-on tier pricing must not reappear.
  const banned = [
    /\bAI Boost\b/,
    /Individual Sales Rep Plan/,
    /\bDealer Plan\b/,
    /\$129\s*\/\s*mo/,
    /\$299\s*\/\s*mo/,
  ]
  for (const page of CORE_PAGES) {
    const text = read(page)
    for (const rx of banned) {
      assert.doesNotMatch(text, rx, `${page} carries obsolete positioning: ${rx}`)
    }
  }
})

test('the pricing pages do not reintroduce the retired Starter/Growth DealerOS pricing', () => {
  // The old DealerOS ladder was Starter $999 / Growth $1,799. The current public ladder
  // is Core $1,499 / Pro $2,499 / Complete $3,999 (plus MarketSync Digital $1,199).
  for (const page of ['pricing.html', 'index.html', 'compare.html', 'dealer-os.html']) {
    const text = read(page)
    assert.doesNotMatch(text, /\$1,799/, `${page} must not show the retired Growth price`)
    assert.doesNotMatch(text, /DealerOS Starter|Dealer OS Starter|DealerOS Growth|Dealer OS Growth/,
      `${page} must not name the retired Starter/Growth tiers`)
  }
})

test('the SEO feature landing pages carry no retired "AI Boost" / add-on-pricing framing', () => {
  // These pages used to frame features as paid add-ons ("AI Boost — $129/mo",
  // "Inventory Intelligence at $299/month"). Those capabilities now ship inside DealerOS.
  const SEO_PAGES = [
    'ai-listing-copy.html', 'ai-vision-photo-scoring.html', 'automation-followups.html',
    'guide.html', 'inventory-intelligence.html', 'vin-decoder-window-stickers.html',
    'workflow.html', 'market-price-reports.html', 'trade-appraisal.html', 'features.html',
  ]
  for (const page of SEO_PAGES) {
    const text = read(page)
    assert.doesNotMatch(text, /\bAI Boost\b/, `${page} must not name the retired AI Boost add-on`)
    assert.doesNotMatch(text, /\$129\s*\/\s*mo(nth)?/, `${page} must not quote the retired $129 AI add-on price`)
    assert.doesNotMatch(text, /Inventory Intelligence (add-on|tier|at \$299)/i,
      `${page} must not frame Inventory Intelligence as a paid add-on/tier`)
    assert.doesNotMatch(text, /\$299\s*\/\s*month\b/, `${page} must not quote the retired $299 add-on price`)
  }
})

test('the current architecture is present where it matters', () => {
  // A meaningful guard: the homepage and pricing page must still name the live products.
  for (const page of ['index.html', 'pricing.html']) {
    const text = read(page)
    assert.match(text, /MarketSync Digital/, `${page} should present MarketSync Digital`)
    assert.match(text, /DealerOS/, `${page} should present DealerOS`)
  }
  // features.html groups the AI/analytics capabilities under the current brand.
  assert.match(read('features.html'), /Intelligence by MarketSync/, 'features.html uses the current Intelligence brand')
})
