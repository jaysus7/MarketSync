import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Every inline onclick/onchange/onsubmit in the dashboard is a promise to the
// person clicking it. A handler naming a function nobody defined does not fail
// loudly — the click throws a ReferenceError into the console and the button
// simply does nothing, which is how a whole feature can look finished and be
// dead. This test walks every handler the browser can actually reach and proves
// the function behind it exists.

const FE = fileURLToPath(new URL('../../marketplace-frontend/', import.meta.url))

// Directories that never reach a browser as a page or a script.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'img', 'og'])
// components/*.html are fragment mirrors of dashboard.html, not served or
// fetched by anything (the "components are unreferenced" test below keeps that
// claim honest — start loading them and this exclusion fails, not silently
// passes).
const SKIP_REL = new Set(['components'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const rel = path.relative(FE, full)
    if (SKIP_DIRS.has(entry) || SKIP_REL.has(rel)) continue
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(js|html)$/.test(entry)) out.push(full)
  }
  return out
}

const served = walk(FE)
const allFiles = (() => {
  const out = []
  const walkAll = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (SKIP_DIRS.has(entry)) continue
      if (statSync(full).isDirectory()) walkAll(full)
      else if (/\.(js|html)$/.test(entry)) out.push(full)
    }
  }
  walkAll(FE)
  return out
})()

const src = new Map(served.map(f => [f, readFileSync(f, 'utf8')]))

// Globals the browser supplies, so a handler calling them needs no definition
// here. Keywords are included because `if (` and `for (` match the call shape.
const BUILTIN = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'RegExp',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'isNaN', 'isFinite', 'Error',
  'Promise', 'Map', 'Set', 'Symbol', 'BigInt', 'Proxy', 'Reflect', 'WeakMap', 'WeakSet', 'structuredClone',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask', 'open', 'close', 'print', 'focus', 'blur',
  'scrollTo', 'scrollBy', 'matchMedia', 'getComputedStyle', 'btoa', 'atob', 'postMessage', 'reportError',
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'delete', 'void',
  'do', 'else', 'try', 'finally', 'with', 'in', 'of', 'case', 'throw', 'await', 'yield',
])

// A bare `name(` — not `obj.name(`, not `obj?.name(`, and not the tail of a
// longer identifier. Exact names only: prefix matching is what made an earlier
// pass of this audit report renderWsRightInspectorHtml as missing.
const CALL = /(^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g
const OPTIONAL_CALL = /(^|[^\w$.])([A-Za-z_$][\w$]*)\?\.\(/g
const HANDLER_ATTR = /\bon([a-z]+)\s*=\s*(["'])([\s\S]*?)\2/gi

function calleesOf(expr) {
  const names = new Set()
  for (const m of expr.matchAll(CALL)) names.add(m[2])
  for (const m of expr.matchAll(OPTIONAL_CALL)) names.add(m[2])
  for (const b of BUILTIN) names.delete(b)
  return names
}

const references = []
for (const [file, text] of src) {
  for (const m of text.matchAll(HANDLER_ATTR)) {
    if (!m[3].trim()) continue
    const line = text.slice(0, m.index).split('\n').length
    for (const name of calleesOf(m[3])) {
      references.push({ name, file: path.relative(FE, file), line })
    }
  }
}

// These files load as classic scripts, so a top-level declaration is already a
// global; window.X = and Object.assign(window, {...}) are the explicit forms.
const defined = new Set()
for (const text of src.values()) {
  for (const m of text.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1])
  for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1])
  for (const m of text.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1])
  for (const m of text.matchAll(/Object\.assign\(\s*window\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const part of m[1].split(',')) {
      const key = part.split(':')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(key)) defined.add(key)
    }
  }
}

// A call site that checks for itself is a deliberate optional integration, not
// a dead button.
const guarded = new Set()
for (const text of src.values()) {
  for (const m of text.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*===?\s*['"]function['"]/g)) guarded.add(m[1])
}

test('the scan actually found handlers to check', () => {
  // Without this, every assertion below passes for free the day the scan breaks.
  assert.ok(references.length > 1500, `only ${references.length} inline handler references found`)
  assert.ok(defined.size > 1500, `only ${defined.size} definitions found`)
  assert.ok(references.some(r => r.name === 'switchPage'), 'switchPage should appear in inline handlers')
  assert.ok(defined.has('switchPage'), 'switchPage should be a known definition')
})

test('every inline handler names a function that exists', () => {
  const dead = references.filter(r => !defined.has(r.name) && !guarded.has(r.name))
  const unique = [...new Map(dead.map(d => [d.name, d])).values()]
  assert.deepEqual(
    unique.map(d => `${d.name} (${d.file}:${d.line})`),
    [],
    'inline handlers referencing undefined functions throw ReferenceError on click',
  )
})

test('the handlers fixed in this pass stay defined', () => {
  // Named individually so a regression points at the feature, not at a count.
  for (const name of [
    'toggleWorkflowActive', 'quickAiRewriteWorkflow', 'testVbSingleNode',
    'pwReceivePo', 'pwToggleNotifySpecialOrder', 'saveStudioDesignName',
    'requestDesktopPermission', 'refreshWsRightInspector',
  ]) {
    assert.ok(defined.has(name), `${name} must be defined — an inline handler calls it`)
  }
})

test('the AI dock submits through its listener, not a stale inline handler', () => {
  const dash = readFileSync(path.join(FE, 'dashboard.html'), 'utf8')
  assert.ok(dash.includes('<form id="ai-dock-form"'), 'AI dock form should exist')
  assert.ok(!/id="ai-dock-form"[^>]*onsubmit=/.test(dash), 'AI dock must not carry an inline onsubmit')
  const part23 = readFileSync(path.join(FE, 'js/modules/dashboard-part23.js'), 'utf8')
  assert.ok(part23.includes("form?.addEventListener('submit'"), 'AI dock submit listener should be wired')
})

test('components/ fragments are not served, which is what lets the scan skip them', () => {
  // The scan excludes components/*.html. That exclusion is only honest while
  // nothing loads them — if a page starts fetching one, fail here so the
  // fragment gets pulled into the scan rather than quietly escaping it.
  const referencing = allFiles.filter(f => {
    if (path.relative(FE, f).startsWith('components')) return false
    return /components\/[\w-]+\.html/.test(readFileSync(f, 'utf8'))
  })
  assert.deepEqual(referencing.map(f => path.relative(FE, f)), [])
})
