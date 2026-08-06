import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key'
process.env.NODE_ENV = 'test'

async function runRouteRegistrationSmokeTest() {
  console.log('[check-routes] Testing express route registration across all route modules...')
  const app = express()

  const routesDir = path.join(process.cwd(), 'routes')
  const submodulesDir = path.join(routesDir, 'submodules')

  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'))
  const submoduleFiles = fs.readdirSync(submodulesDir).filter(f => f.endsWith('.js'))

  let tested = 0
  let failed = 0

  for (const file of [...submoduleFiles.map(f => 'submodules/' + f), ...routeFiles]) {
    const filePath = path.join(routesDir, file)
    try {
      const mod = await import(`file://${filePath}`)
      for (const [exportName, exportFn] of Object.entries(mod)) {
        if (typeof exportFn === 'function' && /^register[A-Z]/.test(exportName) && exportName !== 'registerTool') {
          exportFn(app)
          console.log(`  [OK] ${file} -> ${exportName}(app)`)
          tested++
        }
      }
    } catch (err) {
      console.error(`  [FAIL] ${file} registration failed: ${err.stack || err.message}`)
      failed++
    }
  }

  console.log(`\n[check-routes] Summary: ${tested} route registration calls succeeded, ${failed} failed.`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('Route registration smoke test passed')
    process.exit(0)
  }
}

runRouteRegistrationSmokeTest().catch(err => {
  console.error('[check-routes] Unexpected error:', err)
  process.exit(1)
})
