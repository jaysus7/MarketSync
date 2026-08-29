import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { isHqUser, isHqOwner, requireHqAuth, requireHqOwner, requireHqPermission } from '../hq-auth.js'
import { logHqAudit, getHqAuditLogs } from '../hq-audit.js'

test('Phase 1 Foundation: HQ Auth guards work correctly', () => {
  // Unauthenticated caller
  let req = {}
  let res = {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this },
    json(data) { this.body = data; return this },
  }
  let nextCalled = false
  requireHqAuth(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)

  // Authenticated non-HQ user
  req = { user: { id: 'u1' }, profile: { system_role: 'dealer_user' } }
  res.statusCode = 200
  nextCalled = false
  requireHqAuth(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 403)
  assert.equal(nextCalled, false)

  // Authenticated Platform Owner
  req = { user: { id: 'u1' }, profile: { system_role: 'platform_owner' } }
  res.statusCode = 200
  nextCalled = false
  requireHqAuth(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 200)
  assert.equal(nextCalled, true)

  // Authenticated Platform Admin
  req = { user: { id: 'u2' }, profile: { system_role: 'platform_admin' } }
  res.statusCode = 200
  nextCalled = false
  requireHqAuth(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 200)
  assert.equal(nextCalled, true)

  // Owner-only check blocks Admin
  res.statusCode = 200
  nextCalled = false
  requireHqOwner(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 403)
  assert.equal(nextCalled, false)

  // Owner-only check allows Owner
  req.profile.system_role = 'platform_owner'
  res.statusCode = 200
  nextCalled = false
  requireHqOwner(req, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 200)
  assert.equal(nextCalled, true)
})

test('Phase 1 Foundation: HQ Migrations exist and contain required tables', () => {
  const mig1Path = new URL('../../supabase/migrations/20260828000001_hq_website_control_plane.sql', import.meta.url)
  const mig2Path = new URL('../../supabase/migrations/20260828000002_hq_crm_attribution.sql', import.meta.url)
  const mig3Path = new URL('../../supabase/migrations/20260828000003_hq_finance_ledger.sql', import.meta.url)

  assert.ok(existsSync(mig1Path), 'Website control plane migration must exist')
  assert.ok(existsSync(mig2Path), 'CRM attribution migration must exist')
  assert.ok(existsSync(mig3Path), 'Finance ledger migration must exist')

  const mig1 = readFileSync(mig1Path, 'utf8')
  const mig2 = readFileSync(mig2Path, 'utf8')
  const mig3 = readFileSync(mig3Path, 'utf8')

  // Mig 1: Website CMS
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_pages/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_page_versions/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_sections/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_posts/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_media/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_change_sets/)
  assert.match(mig1, /CREATE TABLE IF NOT EXISTS website_deployments/)

  // Mig 2: CRM
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_companies/)
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_contacts/)
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_leads/)
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_opportunities/)
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_consent_records/)
  assert.match(mig2, /CREATE TABLE IF NOT EXISTS hq_customer_activity/)

  // Mig 3: Corporate Finance GL
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_chart_of_accounts/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_journal_entries/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_journal_lines/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_expenses/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_receipts/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_vendors/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_budgets/)
  assert.match(mig3, /CREATE TABLE IF NOT EXISTS hq_audit_log/)
})
