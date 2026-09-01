import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const frontend = new URL('../../marketplace-frontend/', import.meta.url)

// The rule governs Dealer OS CHROME: the interface an employee looks at. It is not a
// ban on the character class everywhere in the frontend. Campaign subject lines are
// content a dealership sends to its own customers, where emoji is deliberate marketing
// copy; stripping it to satisfy an interface rule would be the rule misfiring. That
// content lives in js/data/, which is why the scan is scoped to chrome - see the
// boundary test below, which keeps the distinction honest rather than implicit.
const files = ['dashboard.html', 'dashboard.js', 'tour.js', ...readdirSync(new URL('js/modules/', frontend)).filter(x => x.endsWith('.js')).map(x => `js/modules/${x}`)]
const emoji = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

test('loaded Dealer OS surfaces contain no hardcoded emoji or Unicode decoration', () => {
  const failures = files.filter(file => emoji.test(readFileSync(new URL(file, frontend), 'utf8')))
  assert.deepEqual(failures, [], `emoji UI remains in: ${failures.join(', ')}`)
})

test('the scan still covers the whole interface', () => {
  // Without this, the rule quietly stops applying the day a module is moved out of
  // js/modules/ - which is exactly the escape hatch the content split could become.
  assert.ok(files.length > 20, `only ${files.length} chrome files scanned`)
  assert.ok(files.includes('dashboard.html'))
  assert.ok(files.some(f => /js\/modules\/dashboard-part\d+\.js/.test(f)), 'dashboard part files must be scanned')
})

test('campaign template content is data, not chrome, and is not scanned as chrome', () => {
  // The split is only legitimate while js/data/ holds content and nothing else. A UI
  // module hidden there would escape the rule, so assert the boundary both ways.
  const dataFiles = readdirSync(new URL('js/data/', frontend)).filter(x => x.endsWith('.js'))
  assert.ok(dataFiles.includes('communication-templates.js'), 'template content module must exist')
  for (const file of dataFiles) {
    const text = readFileSync(new URL(`js/data/${file}`, frontend), 'utf8')
    assert.doesNotMatch(text, /document\.(getElementById|querySelector)|addEventListener|innerHTML\s*=/,
      `js/data/${file} touches the DOM — it is chrome, and must live in js/modules/ where the emoji rule applies`)
  }
  // And the content really did leave the chrome module.
  const part18 = readFileSync(new URL('js/modules/dashboard-part18.js', frontend), 'utf8')
  assert.doesNotMatch(part18, /const DEFAULT_COMMUNICATION_TEMPLATES\s*=/, 'template content must not be redeclared in chrome')
})
