import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRIAL_PERIOD_DAYS, trialEndsAtISO, getPlan } from '../plan-catalog.js'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('the canonical trial is 30 days and computes a 30-day trial end', () => {
  assert.equal(TRIAL_PERIOD_DAYS, 30, 'MarketSync Digital (and every plan) trials for 30 days')
  const from = Date.UTC(2026, 0, 1)               // 2026-01-01T00:00:00Z
  const ends = new Date(trialEndsAtISO(from))
  const days = (ends.getTime() - from) / (24 * 60 * 60 * 1000)
  assert.equal(days, 30, 'trialEndsAtISO yields exactly 30 days')
})

test('a new MarketSync Digital signup resolves the plan and gets the 30-day trial config', () => {
  // Registration grants the CHOSEN plan on a trial. MarketSync Digital must resolve so
  // the signup can be provisioned, and its trial end is the canonical 30-day window.
  const plan = getPlan('marketsync-digital')
  assert.ok(plan, 'marketsync-digital must resolve for registration')
  assert.equal(plan.id, 'marketsync-digital')
  // The alias new signups may arrive with (?plan=digital) resolves to the same plan.
  assert.equal(getPlan('digital')?.id, 'marketsync-digital')

  const signupAt = Date.UTC(2026, 5, 15)
  const trialEndsAt = trialEndsAtISO(signupAt)
  const days = (new Date(trialEndsAt).getTime() - signupAt) / (24 * 60 * 60 * 1000)
  assert.equal(days, TRIAL_PERIOD_DAYS)
})

test('every trial path uses the ONE canonical definition — no hardcoded divergent trial length', () => {
  // Registration (auth.js) computes the trial end via the shared helper and reports the
  // shared constant — not a private literal that could drift from other paths.
  const auth = read('routes/auth.js')
  assert.match(auth, /import \{[^}]*TRIAL_PERIOD_DAYS[^}]*trialEndsAtISO[^}]*\} from '\.\.\/plan-catalog\.js'/)
  assert.match(auth, /const trialEndsAt = trialEndsAtISO\(\)/, 'registration uses the canonical helper')
  assert.match(auth, /trial_days: TRIAL_PERIOD_DAYS/, 'registration reports the canonical constant')
  assert.doesNotMatch(auth, /const TRIAL_DAYS = 30/, 'no private 30-day literal in registration')

  // Billing checkout paths (add-on + package) use the canonical constant, not a literal.
  const billing = read('routes/billing.js')
  assert.match(billing, /TRIAL_PERIOD_DAYS/, 'billing imports/uses the canonical trial constant')
  assert.doesNotMatch(billing, /trial_period_days: 30\b/, 'billing must not hardcode a 30-day literal')

  // Drip cron derives the trial window from the same constant.
  const drip = read('drip.js')
  assert.match(drip, /import \{ TRIAL_PERIOD_DAYS \} from '\.\/plan-catalog\.js'/)

  // No stale "39-day" trial statement remains anywhere in the resolved paths.
  for (const f of ['routes/auth.js', 'routes/billing.js', 'drip.js', 'access-policy.js']) {
    assert.doesNotMatch(read(f), /39[ -]day/, `${f} must not claim a 39-day trial`)
  }
})
