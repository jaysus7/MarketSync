import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO = fileURLToPath(new URL('../..', import.meta.url))
const wf = readFileSync(path.join(REPO, '.github', 'workflows', 'staging-qa.yml'), 'utf8')

// "Not configured" and "misconfigured" are different failures and must not share
// an outcome. A repo whose staging environment was never provisioned has nothing
// to test against; reporting that as a red check on every pull request trains
// people to ignore the one signal meant to say "something you changed is broken".
// A half-configured environment is the opposite: almost always a mistake, and it
// must still fail loudly rather than quietly testing nothing.
test('the suite skips only when NO staging secret is set at all', () => {
  const detect = wf.slice(wf.indexOf('- name: Detect staging QA configuration'),
                          wf.indexOf('- name: Setup Node.js 22'))
  assert.ok(detect.includes('id: cfg'), 'the detect step must expose an output other steps can gate on')
  // Every guarded secret must be joined with && — a single || would let one
  // missing value skip the whole suite, which is the failure mode this guards.
  for (const v of ['STAGING_URL', 'STAGING_TEST_OWNER_USER', 'STAGING_TEST_OWNER_PASS',
                   'STAGING_TEST_RESTRICTED_USER', 'STAGING_TEST_RESTRICTED_PASS']) {
    assert.ok(detect.includes(`-z "$${v}"`), `${v} must be part of the not-configured test`)
  }
  assert.doesNotMatch(detect, /\|\|/,
    'the conditions must be ANDed: any one secret being present means configured')
  assert.ok(detect.includes('configured=false') && detect.includes('configured=true'))
})

// The loud failure is the whole point of the original step and must survive.
test('a partial or localhost configuration still fails loudly', () => {
  const verify = wf.slice(wf.indexOf('- name: Verify staging configuration'),
                          wf.indexOf('- name: Run Staging Fast Smoke Tests'))
  assert.match(verify, /if: steps\.cfg\.outputs\.configured == 'true'/,
    'verification runs whenever anything is configured — including partially')
  assert.match(verify, /::error::Missing required staging QA secrets/)
  assert.match(verify, /localhost/, 'a localhost target must still be rejected')
  assert.match(verify, /exit 1/)
})

// Installing Node, npm deps and a Chromium build costs minutes for a suite that
// cannot run. Everything after detection is gated.
test('nothing expensive runs when the suite is going to skip', () => {
  for (const step of ['Setup Node.js 22', 'Install dependencies',
                      'Install Playwright Chromium Browser']) {
    const at = wf.indexOf(`- name: ${step}`)
    assert.ok(at > 0, `${step} must exist`)
    const block = wf.slice(at, at + 260)
    assert.match(block, /if: steps\.cfg\.outputs\.configured == 'true'/,
      `${step} must be gated on the suite actually being configured`)
  }
})

test('every suite runner is gated on configuration as well as its event', () => {
  const runners = [
    ["Run Staging Fast Smoke Tests (Push Event)", 'push'],
    ["Run Full Staging QA Suite (Schedule Event)", 'schedule'],
    ["Run Selected Test Suite (Manual Workflow Dispatch)", 'workflow_dispatch'],
  ]
  for (const [name, event] of runners) {
    const at = wf.indexOf(`- name: ${name}`)
    assert.ok(at > 0, `${name} must exist`)
    const block = wf.slice(at, at + 220)
    assert.ok(
      block.includes(`if: steps.cfg.outputs.configured == 'true' && github.event_name == '${event}'`),
      `${name} must require BOTH configuration and its triggering event`)
  }
})

// The report upload runs on failure too; with nothing installed there is nothing
// to collect, and an empty artifact only muddies the run.
test('the report upload does not fire for a skipped run', () => {
  assert.match(wf, /if: always\(\) && steps\.cfg\.outputs\.configured == 'true'/)
})

// The detect step must come after checkout (the job sets a working-directory
// default that does not exist until the repo is on disk) and before everything
// it gates.
test('detection sits after checkout and before the steps it gates', () => {
  const checkout = wf.indexOf('- name: Checkout repository')
  const detect = wf.indexOf('- name: Detect staging QA configuration')
  const node = wf.indexOf('- name: Setup Node.js 22')
  assert.ok(checkout < detect && detect < node,
    'order must be checkout → detect → gated steps')
})
