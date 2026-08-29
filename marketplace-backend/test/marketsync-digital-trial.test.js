import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRIAL_DAYS, trialDaysForPlan, trialEndsAtISO, getPlan } from '../plan-catalog.js'
import { scheduleTrialEmails } from '../drip.js'

const readBackend = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const readFrontend = p => readFileSync(new URL(`../../marketplace-frontend/${p}`, import.meta.url), 'utf8')
const DAY_MS = 24 * 60 * 60 * 1000

test('trial policy is 7 days for independent products, 14 for suites, and 30 for Digital and DealerOS', () => {
  assert.deepEqual(TRIAL_DAYS, { independent: 7, suite: 14, platform: 30 })

  const independent = [
    'fb_solo', 'fb_dealership', 'ai_standard', 'marketsync_video',
    'marketsync_website', 'marketsync_social', 'marketsync_email',
    'design-studio', 'social-scheduler', 'autoposter-salesperson',
    'autoposter-dealer', 'video', 'campaigns-email-sms', 'dealer-website',
    'marketsync-seo', 'ai-chatbot', 'identity-verify',
  ]
  const suites = ['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite']
  const platforms = [
    'marketsync-digital', 'os_starter', 'os_growth', 'os_pro',
    'dealer-os-core', 'dealer-os-pro', 'dealer-os-complete',
  ]

  for (const id of independent) assert.equal(trialDaysForPlan(id), 7, `${id} must have a 7-day trial`)
  for (const id of suites) assert.equal(trialDaysForPlan(id), 14, `${id} must have a 14-day trial`)
  for (const id of platforms) assert.equal(trialDaysForPlan(id), 30, `${id} must have a 30-day trial`)

  assert.equal(trialDaysForPlan('sales-suite'), 14, 'suite aliases follow their canonical plan')
  assert.equal(trialDaysForPlan('digital'), 30, 'Digital alias follows its canonical plan')
})

test('trialEndsAtISO computes the selected plan trial exactly', () => {
  const from = Date.UTC(2026, 0, 1)
  for (const [plan, expectedDays] of [
    ['design-studio', 7],
    ['sales-marketing-suite', 14],
    ['marketsync-digital', 30],
    ['dealer-os-complete', 30],
  ]) {
    const ends = new Date(trialEndsAtISO(plan, from))
    assert.equal((ends.getTime() - from) / DAY_MS, expectedDays, `${plan} trial end mismatch`)
  }
})

test('MarketSync Digital resolves and retains its 30-day trial', () => {
  assert.equal(getPlan('marketsync-digital')?.id, 'marketsync-digital')
  assert.equal(getPlan('digital')?.id, 'marketsync-digital')
  assert.equal(trialDaysForPlan('marketsync-digital'), 30)
})

test('registration creates and reports the selected plan trial', () => {
  const auth = readBackend('routes/auth.js')
  assert.match(auth, /trialDaysForPlan\(chosenPlan\.id\)/)
  assert.match(auth, /trialEndsAtISO\(chosenPlan\.id\)/)
  assert.match(auth, /trial_days: trialDays/)
  assert.doesNotMatch(auth, /TRIAL_PERIOD_DAYS/)
})

test('Stripe Checkout applies 7 days to independent add-ons and 30 days to DealerOS packages', () => {
  const billing = readBackend('routes/billing.js')
  assert.match(billing, /trial_period_days: TRIAL_DAYS\.independent/)
  assert.match(billing, /trial_period_days: TRIAL_DAYS\.platform/)
  assert.doesNotMatch(billing, /trial_period_days:\s*30\b/)
})

test('public pricing and registration expose the same category policy', () => {
  const publicConfig = readFrontend('js/public-config.js')
  assert.match(publicConfig, /MARKETSYNC_PRICING\.standalone\) product\.trialDays = 7/)
  assert.match(publicConfig, /suite\.id === 'marketsync-digital' \? 30 : 14/)
  assert.match(publicConfig, /MARKETSYNC_PRICING\.dealerOS\) plan\.trialDays = 30/)

  const register = readFrontend('register.html')
  assert.match(register, /function trialDaysForPlan\(planId\)/)
  assert.match(register, /trialDaysForPlan\(selectedPlan\)/)
  assert.doesNotMatch(register, /30-day trial · no card today/)
})

test('public product pages and in-app add-on CTAs state the correct trial lengths', () => {
  for (const page of [
    'ai-chatbot.html', 'facebook-autoposter.html', 'marketsync-seo.html',
    'design-studio.html', 'video-studio.html', 'campaigns.html',
    'inventory-intelligence.html',
  ]) {
    assert.match(readFrontend(page), /7-day|7 days/, `${page} must advertise the independent-product trial`)
  }
  assert.match(readFrontend('marketsync-digital.html'), /30-day trial/)
  assert.match(readFrontend('dealer-os.html'), /30-day trial/)

  const index = readFrontend('index.html')
  assert.match(index, /7 days for products/)
  assert.match(index, /14 for suites/)
  assert.match(index, /30 for Digital/)

  for (const source of [
    'components/dashboard-pages.html', 'components/dashboard-settings.html',
    'js/modules/dashboard-part20.js', 'js/modules/dashboard-part21.js',
  ]) {
    assert.doesNotMatch(readFrontend(source), /Start 30-Day Free Trial|Try Free for 30 Days/, `${source} has stale add-on trial copy`)
  }
})

test('the onboarding drip does not claim one trial length for every plan', () => {
  const drip = readBackend('drip.js')
  assert.doesNotMatch(drip, /TRIAL_PERIOD_DAYS/)
  assert.doesNotMatch(drip, /starting your 30-day trial/)
  assert.match(drip, /created_at/)
})

test('the onboarding drip always schedules the expiry notice for the final trial day', () => {
  const messages = [
    { key: 'welcome', day: 0 },
    { key: 'tip', day: 6 },
    { key: 'power', day: 18 },
    { key: 'trial-ending', day: 29 },
  ]
  assert.deepEqual(scheduleTrialEmails(messages, 7).map(x => [x.key, x.day]), [
    ['welcome', 0], ['trial-ending', 6],
  ])
  assert.deepEqual(scheduleTrialEmails(messages, 14).map(x => [x.key, x.day]), [
    ['welcome', 0], ['tip', 6], ['trial-ending', 13],
  ])
  assert.deepEqual(scheduleTrialEmails(messages, 30).map(x => [x.key, x.day]), [
    ['welcome', 0], ['tip', 6], ['power', 18], ['trial-ending', 29],
  ])
})
