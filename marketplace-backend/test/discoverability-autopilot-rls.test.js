import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migration = fs.readFileSync(path.join(process.cwd(), '../supabase/migrations/20260830125448_discoverability_autopilot_rls.sql'), 'utf8')
const tables = [
  'discoverability_findings',
  'discoverability_recommendations',
  'discoverability_autopilot_queue',
  'discoverability_autopilot_transitions',
  'discoverability_validation_jobs',
  'discoverability_autopilot_settings'
]

test('Autopilot RLS migration grants only authorized read access to authenticated users', () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(migration, new RegExp(`create policy "${table}_select_authorized"`, 'i'))
  }
  assert.match(migration, /grant select on table[\s\S]+to authenticated/i)
  assert.match(migration, /revoke all on table[\s\S]+from anon, authenticated/i)
  assert.doesNotMatch(migration, /for (insert|update|delete) to authenticated/i)
  assert.doesNotMatch(migration, /with check \(false\)/i)
})

test('Autopilot RLS policy keeps platform staff outside the dealership predicate', () => {
  assert.match(migration, /dealership_id = \(select authz\.current_dealership_id\(\)\)[\s\S]+authz\.has_permission\(dealership_id, 'marketing\.view'\)[\s\S]+or \(select authz\.is_platform_staff\(\)\)/i)
  assert.doesNotMatch(migration, /discoverability\.(queue_view|settings_view)/i)
})
