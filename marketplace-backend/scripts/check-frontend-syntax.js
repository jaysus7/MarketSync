import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '../../marketplace-frontend')
const htmlPath = path.join(rootDir, 'dashboard.html')

if (!fs.existsSync(htmlPath)) {
  console.error(`[check-frontend] HTML file not found: ${htmlPath}`)
  process.exit(1)
}

const html = fs.readFileSync(htmlPath, 'utf8')
const scriptMatches = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])

console.log('[check-frontend] Found script tags in dashboard.html:', scriptMatches)

function getTopLevelDeclarations(filePath, cleanRel) {
  const code = fs.readFileSync(filePath, 'utf8')
  const lines = code.split('\n')
  const declarations = []

  let inString = false
  let stringChar = ''
  let inBlockComment = false
  let depth = 0

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    let lineCode = ''

    for (let j = 0; j < rawLine.length; j++) {
      const ch = rawLine[j]
      const next = rawLine[j + 1]

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false
          j++
        }
        continue
      }

      if (inString) {
        if (ch === '\\') {
          j++
          continue
        }
        if (ch === stringChar) {
          inString = false
        }
        continue
      }

      if (ch === '/' && next === '/') break // single-line comment rest of line
      if (ch === '/' && next === '*') {
        inBlockComment = true
        j++
        continue
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true
        stringChar = ch
        continue
      }

      if (ch === '{') depth++
      else if (ch === '}') depth = Math.max(0, depth - 1)

      lineCode += ch
    }

    const trimmed = lineCode.trim()
    if (depth === 0 && trimmed) {
      const match = trimmed.match(/^(const|let|var)\s+([a-zA-Z0-9_$]+)/)
      if (match) {
        declarations.push({
          script: cleanRel,
          line: i + 1,
          kind: match[1],
          name: match[2]
        })
      }
    }

    // Column-0 fallback.
    //
    // The scanner above tracks brace depth to decide what is top level, but it
    // cannot see through NESTED template literals — and this codebase is full of
    // them (`...${rows.map(r => `<div>…</div>`).join('')}...`). The inner backtick
    // reads as the outer string's terminator, after which brace depth is wrong for
    // the rest of the file and real top-level declarations stop being recorded.
    // That is not theoretical: it let a duplicate `let __fniData` ship, which threw
    // a SyntaxError and silently disabled a whole dashboard module while this check
    // still reported PASSED.
    //
    // Every top-level declaration in these files begins at column 0, so treat that
    // as an independent signal and union the two. Worst case we also catch a
    // declaration written at column 0 inside a template string — which would be a
    // confusing thing to write anyway.
    const col0 = rawLine.match(/^(const|let|var)\s+([a-zA-Z0-9_$]+)/)
    if (col0 && !declarations.some(d => d.line === i + 1 && d.name === col0[2])) {
      declarations.push({ script: cleanRel, line: i + 1, kind: col0[1], name: col0[2] })
    }
  }
  return declarations
}

const declaredMap = new Map()
let hasError = false

for (const scriptRel of scriptMatches) {
  if (scriptRel.startsWith('http')) continue
  const cleanRel = scriptRel.split('?')[0]
  const scriptPath = path.join(rootDir, cleanRel)
  if (!fs.existsSync(scriptPath)) {
    console.warn(`[check-frontend] Warning: missing file ${cleanRel}`)
    continue
  }

  const decls = getTopLevelDeclarations(scriptPath, cleanRel)
  for (const item of decls) {
    if (!declaredMap.has(item.name)) declaredMap.set(item.name, [])
    declaredMap.get(item.name).push(item)
  }
}

console.log('\n[check-frontend] Verifying top-level identifiers across scripts...')

for (const [name, occurrences] of declaredMap.entries()) {
  if (occurrences.length > 1) {
    const constLetOccs = occurrences.filter(o => o.kind === 'const' || o.kind === 'let')
    if (constLetOccs.length > 0) {
      console.error(`\n[SYNTAX ERROR] Identifier "${name}" declared multiple times (const/let conflict):`)
      for (const occ of occurrences) {
        console.error(`  - ${occ.script}:${occ.line} (${occ.kind})`)
      }
      hasError = true
    }
  }
}

if (hasError) {
  console.error('\n[check-frontend] FAILED: Duplicate top-level const/let declarations detected!')
  process.exit(1)
} else {
  console.log('[check-frontend] PASSED: No duplicate top-level const/let syntax conflicts detected.')
  process.exit(0)
}
