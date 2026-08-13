import fs from 'node:fs'
import path from 'node:path'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key'

async function validateImports() {
  console.log('[validate-imports] Validating ESM module import resolution...')
  const routesDir = path.join(process.cwd(), 'routes')
  const submodulesDir = path.join(routesDir, 'submodules')

  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'))
  const submoduleFiles = fs.readdirSync(submodulesDir).filter(f => f.endsWith('.js'))

  let failed = 0
  let total = 0

  for (const file of submoduleFiles) {
    total++
    const filePath = path.join(submodulesDir, file)
    try {
      await import(`file://${filePath}`)
      console.log(`  [OK] routes/submodules/${file}`)
    } catch (err) {
      console.error(`  [FAIL] routes/submodules/${file} -> ${err.stack || err.message}`)
      failed++
    }
  }

  for (const file of routeFiles) {
    total++
    const filePath = path.join(routesDir, file)
    try {
      await import(`file://${filePath}`)
      console.log(`  [OK] routes/${file}`)
    } catch (err) {
      console.error(`  [FAIL] routes/${file} -> ${err.stack || err.message}`)
      failed++
    }
  }

  console.log(`[validate-imports] Tested ${total} files: ${total - failed} passed, ${failed} failed.`)

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

validateImports().catch(err => {
  console.error('[validate-imports] Unexpected error:', err)
  process.exit(1)
})
