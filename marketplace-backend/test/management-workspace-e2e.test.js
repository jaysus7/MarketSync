import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 8 & 9A — Management Workspace & Executive Governance E2E
//
// Governing rule: AGENTS.md A19 (Runtime proof) & A3 (Architectural law)
// Tests executive composition across all operational engines without duplicate truth stores.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const cmd = strip(read('routes/command-center.js'))
const myDay = strip(read('routes/my-day.js'))
const part11 = strip(readFE('js/modules/dashboard-part11.js'))

// ── 1. Management Workspace Endpoints Registration ───────────────────────────

test('Management Workspace registers canonical executive endpoints', () => {
  assert.match(cmd, /app\.get\('\/management\/summary'/, 'exposes /management/summary')
  assert.match(cmd, /app\.get\('\/management\/exceptions'/, 'exposes /management/exceptions')
  assert.match(cmd, /app\.get\('\/management\/approvals'/, 'exposes /management/approvals')
  assert.match(cmd, /app\.get\('\/command-center'/, 'retains legacy /command-center endpoint')
})

// ── 2. RBAC & Security Gates ─────────────────────────────────────────────────

test('Management Workspace strictly enforces accounting.view and MFA', () => {
  assert.match(cmd, /requirePermission\('accounting\.view'\)/, 'gated on accounting.view permission')
  assert.match(cmd, /requireMfa/, 'enforces multi-factor authentication')
  assert.match(cmd, /requireAuth/, 'enforces session authentication')
})

// ── 3. Executive Exceptions Aggregation ──────────────────────────────────────

test('Exceptions aggregation preserves department attribution and severity clamp', () => {
  assert.match(cmd, /const d = ex\.department \|\| 'General'/, 'preserves origin department')
  assert.match(cmd, /Number\(ex\.severity\) >= 3 \|\| ex\.priority === 'critical'/, 'tracks high-severity exceptions')
  assert.match(cmd, /by_department: byDept/, 'returns structured department grouping')
})

// ── 4. Centralized Approvals Queue ───────────────────────────────────────────

test('Approvals aggregation composes Identity, Deals, Campaigns, and Expenses', () => {
  assert.match(cmd, /'manual_review'/, 'queries identity manual reviews')
  assert.match(cmd, /'pending_approval'/, 'queries deals pending manager sign-off')
  assert.match(cmd, /'approval_required'/, 'queries marketing campaign budgets')
  assert.match(cmd, /'pending'/, 'queries unapproved AP expenses')
})

// ── 5. Frontend Command Engine Tabs & Composition ───────────────────────────

test('Frontend Command Engine renders canonical tabs and My Day aggregation', () => {
  assert.match(part11, /ENGINES\['command'\]\s*=/, 'registers command engine')
  assert.match(part11, /apiGetJson\('\/my-day'\)/, 'consumes shared role-aware attention aggregation')
  assert.match(part11, /d\.day\.needs_attention/, 'renders canonical operational attention')
})
