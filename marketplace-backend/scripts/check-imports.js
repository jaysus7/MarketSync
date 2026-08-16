import fs from 'node:fs'
import path from 'node:path'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key'
process.env.NODE_ENV = 'test'

// `e2e` holds Playwright specs. They call test.describe()/test() at module top level,
// which throws ("Playwright Test did not expect test.describe() to be called here")
// when imported outside the Playwright runner. They are not application modules, so the
// ESM import sanity check must skip them — exactly like `test` and `scripts`.
const EXCLUDE_DIRS = ['node_modules', 'scripts', 'test', 'e2e', 'migrations', '.git']
const EXCLUDE_FILES = ['server.js'] // server.js starts HTTP listener immediately on import

function findJsFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        results = results.concat(findJsFiles(filePath))
      }
    } else if (file.endsWith('.js') && !EXCLUDE_FILES.includes(file)) {
      results.push(filePath)
    }
  }
  return results
}

async function runCheck() {
  console.log('[check-imports] Starting ESM module import validation...')
  const rootDir = process.cwd()
  const allFiles = findJsFiles(rootDir)

  let passed = 0
  let failed = 0

  for (const filePath of allFiles) {
    const relPath = './' + path.relative(rootDir, filePath).replace(/\\/g, '/')
    try {
      await import(`file://${filePath}`)
      console.log(`Imported: ${relPath}`)
      passed++
    } catch (err) {
      console.error(`FAILED: ${relPath}`)
      console.error(`  -> ${err.stack || err.message}`)
      failed++
    }
  }

  console.log(`\n[check-imports] Summary: ${passed} passed, ${failed} failed.`)

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runCheck().catch(err => {
  console.error('[check-imports] Critical failure:', err)
  process.exit(1)
})
