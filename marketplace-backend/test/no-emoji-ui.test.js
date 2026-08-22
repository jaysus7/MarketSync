import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const frontend = new URL('../../marketplace-frontend/', import.meta.url)
const files = ['dashboard.html', 'dashboard.js', 'tour.js', ...readdirSync(new URL('js/modules/', frontend)).filter(x => x.endsWith('.js')).map(x => `js/modules/${x}`)]
const emoji = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

test('loaded Dealer OS surfaces contain no hardcoded emoji or Unicode decoration', () => {
  const failures = files.filter(file => emoji.test(readFileSync(new URL(file, frontend), 'utf8')))
  assert.deepEqual(failures, [], `emoji UI remains in: ${failures.join(', ')}`)
})
