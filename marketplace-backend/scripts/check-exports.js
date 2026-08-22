import fs from 'node:fs'
import path from 'node:path'

async function checkExports() {
  console.log('[check-exports] Verifying named imports match actual target exports...')
  const backendDir = process.cwd()
  let totalImportsChecked = 0
  let failures = []

  function getJsFiles(dir) {
    let files = []
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.isDirectory()) {
        if (['node_modules', 'test', '.git'].includes(item.name)) continue
        files = files.concat(getJsFiles(path.join(dir, item.name)))
      } else if (item.isFile() && item.name.endsWith('.js')) {
        files.push(path.join(dir, item.name))
      }
    }
    return files
  }

  const jsFiles = getJsFiles(backendDir)
  const exportsMap = new Map()
  const reExportStarMap = new Map()

  // Step 1: Collect exports from each file
  for (const filePath of jsFiles) {
    const rawCode = fs.readFileSync(filePath, 'utf8')
    const fileExports = new Set()

    // 1. export function/const/let/var/class/async function
    const declMatches = rawCode.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([a-zA-Z0-9_$]+)/g)
    for (const m of declMatches) {
      fileExports.add(m[1])
    }

    // 2. export { a, b as c } (named export list)
    const namedExportMatches = rawCode.matchAll(/export\s*\{([^}]+)\}/g)
    for (const m of namedExportMatches) {
      const items = m[1].split(',')
      for (let item of items) {
        item = item.trim()
        if (!item) continue
        const parts = item.split(/\s+as\s+/)
        const exportedName = parts.length > 1 ? parts[1].trim() : parts[0].trim()
        if (exportedName) fileExports.add(exportedName)
      }
    }

    if (/\bexport\s+default\b/.test(rawCode)) {
      fileExports.add('default')
    }

    // 3. export * from '...'
    const starMatches = rawCode.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)
    for (const m of starMatches) {
      const relTarget = m[1]
      if (relTarget.startsWith('.')) {
        let targetPath = path.resolve(path.dirname(filePath), relTarget)
        if (!targetPath.endsWith('.js') && fs.existsSync(targetPath + '.js')) {
          targetPath = targetPath + '.js'
        }
        if (!reExportStarMap.has(filePath)) reExportStarMap.set(filePath, [])
        reExportStarMap.get(filePath).push(targetPath)
      }
    }

    exportsMap.set(filePath, fileExports)
  }

  // Resolve export * inheritance
  let changed = true
  while (changed) {
    changed = false
    for (const [filePath, starTargets] of reExportStarMap.entries()) {
      const fileSet = exportsMap.get(filePath)
      for (const targetPath of starTargets) {
        const targetSet = exportsMap.get(targetPath)
        if (targetSet) {
          for (const item of targetSet) {
            if (item !== 'default' && !fileSet.has(item)) {
              fileSet.add(item)
              changed = true
            }
          }
        }
      }
    }
  }

  // Step 2: Verify imports against exportsMap
  for (const filePath of jsFiles) {
    const rawCode = fs.readFileSync(filePath, 'utf8')
    const code = rawCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    const relFile = path.relative(backendDir, filePath)

    // Match multiline import { ... } from '...'
    const importMatches = code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)
    for (const m of importMatches) {
      const importedNamesRaw = m[1]
      const importPath = m[2]

      if (!importPath.startsWith('.')) continue // Skip node_modules / builtins

      let resolvedPath = path.resolve(path.dirname(filePath), importPath)
      if (!resolvedPath.endsWith('.js') && fs.existsSync(resolvedPath + '.js')) {
        resolvedPath = resolvedPath + '.js'
      }

      const targetExports = exportsMap.get(resolvedPath)

      if (!targetExports) {
        if (fs.existsSync(resolvedPath)) {
          continue
        } else {
          failures.push({ file: relFile, importPath, error: `Module not found: ${importPath}` })
          continue
        }
      }

      const importedItems = importedNamesRaw.split(',')
      for (let item of importedItems) {
        item = item.trim()
        if (!item || item.startsWith('//') || item.startsWith('/*')) continue
        const cleanItem = item.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/, '').trim()
        if (!cleanItem) continue

        // Handle `a as b` or `type a`
        const parts = cleanItem.replace(/^type\s+/, '').split(/\s+as\s+/)
        const originalName = parts[0].trim()

        if (!originalName) continue
        totalImportsChecked++

        if (!targetExports.has(originalName)) {
          failures.push({
            file: relFile,
            importPath,
            name: originalName,
            error: `'${originalName}' is not exported by '${importPath}'`
          })
        }
      }
    }
  }

  console.log(`[check-exports] Checked ${totalImportsChecked} named imports across ${jsFiles.length} files.`)

  if (failures.length > 0) {
    console.error(`\n[check-exports] FAILURES DETECTED (${failures.length}):`)
    for (const f of failures) {
      console.error(`  - In ${f.file}: ${f.error}`)
    }
    process.exit(1)
  } else {
    console.log('[check-exports] All named imports successfully match target exports!')
    process.exit(0)
  }
}

checkExports().catch(err => {
  console.error('[check-exports] Unexpected error:', err)
  process.exit(1)
})
