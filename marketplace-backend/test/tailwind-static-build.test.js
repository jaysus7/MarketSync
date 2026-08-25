import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const htmlFiles = readdirSync(FRONTEND).filter((f) => f.endsWith('.html'))

const CDN_HOST = 'cdn.tailwindcss.com'

// Matches hostnames exactly rather than substring-matching a raw URL, so a page that
// happens to reference some other host containing this one as a substring (e.g. as a
// query param or path segment) can't produce a false pass/fail here.
function referencesHost(text, host) {
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    try {
      if (new URL(match[0]).hostname === host) return true
    } catch { /* not a well-formed URL, ignore */ }
  }
  return false
}

// Tailwind's Play CDN (cdn.tailwindcss.com) is a runtime JIT compiler that Tailwind's
// own docs say is not for production use — it silently drops all utility CSS app-wide
// if the script is slow, blocked, or unreachable. Pages must load the pre-built,
// checked-in stylesheet instead (see tailwind.config.class.js / tailwind.config.media.js
// and `npm run build:css`).
test('no frontend page loads the Tailwind Play CDN', () => {
  const offenders = htmlFiles.filter((f) => referencesHost(readFileSync(path.join(FRONTEND, f), 'utf8'), CDN_HOST))
  assert.deepEqual(offenders, [], `these pages still reference the Tailwind Play CDN: ${offenders.join(', ')}`)
})

test('both pre-built Tailwind stylesheets exist and are non-trivial', () => {
  for (const name of ['tailwind-built.css', 'tailwind-built-media.css']) {
    const file = path.join(FRONTEND, 'css', name)
    const size = statSync(file).size
    assert.ok(size > 50000, `${name} is only ${size} bytes — looks like an empty/broken build`)
  }
})

test('every page that references a tailwind-built stylesheet links a file that exists', () => {
  const cssDir = path.join(FRONTEND, 'css')
  for (const f of htmlFiles) {
    const text = readFileSync(path.join(FRONTEND, f), 'utf8')
    const match = text.match(/href="css\/(tailwind-built(?:-media)?\.css)/)
    if (!match) continue
    assert.ok(statSync(path.join(cssDir, match[1])).isFile(), `${f} links css/${match[1]} which does not exist`)
  }
})
