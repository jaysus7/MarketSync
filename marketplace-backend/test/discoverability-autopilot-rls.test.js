import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.join(process.cwd(), '../supabase/migrations')
// Resolve by slug, not by timestamp: the migration version is realigned whenever the
// staging history is reconciled, and the test must not break on a pure rename.
const migrationFile = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_discoverability_autopilot_rls.sql'))
  .sort()
  .pop()

const migration = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8')
const tables = [
  'discoverability_findings',
  'discoverability_recommendations',
  'discoverability_autopilot_queue',
  'discoverability_autopilot_transitions',
  'discoverability_validation_jobs',
  'discoverability_autopilot_settings'
]

test('Autopilot RLS migration exists and is uniquely resolvable', () => {
  assert.ok(migrationFile, 'expected a *_discoverability_autopilot_rls.sql migration')
  const matches = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('_discoverability_autopilot_rls.sql'))
  assert.equal(matches.length, 1, `expected exactly one autopilot RLS migration, found ${matches.length}`)
})

test('Autopilot RLS migration enables and forces RLS on every autopilot table', () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`, 'i'))
  }
})

test('Autopilot RLS migration grants only authorized read access to authenticated users', () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`create policy "${table}_select_authorized"`, 'i'))
  }
  assert.match(migration, /grant select on table[\s\S]+to authenticated/i)
  assert.match(migration, /revoke all on table[\s\S]+from anon, authenticated/i)
  // Writes stay backend-mediated through supabaseAdmin (service_role bypasses RLS).
  assert.doesNotMatch(migration, /for (insert|update|delete) to authenticated/i)
  assert.doesNotMatch(migration, /with check \(false\)/i)
})

test('Autopilot RLS policies use the canonical authz.has_permission predicate', () => {
  // authz.has_permission(dealership_id, ...) already folds tenant isolation AND
  // platform-staff access into one check (see marketplace-backend/docs/rls-standard.md),
  // so each policy is exactly that call against an existing catalogued permission.
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(
        `create policy "${table}_select_authorized" on public\\.${table}\\s+for select to authenticated\\s+using \\(authz\\.has_permission\\(dealership_id, 'marketing\\.view'\\)\\)`,
        'i'
      )
    )
  }
})

test('Autopilot RLS migration references only authz helpers that exist', () => {
  // authz.current_dealership_id() is NOT part of the authz surface; referencing it made
  // the guarded policy block a silent no-op that created zero policies.
  assert.doesNotMatch(migration, /authz\.current_dealership_id/i)
  const referenced = [...migration.matchAll(/authz\.([a-z_]+)\s*\(/gi)].map((match) => match[1].toLowerCase())
  const known = new Set(['has_permission', 'is_platform_staff', 'belongs_to_dealership', 'inventory_dealership'])
  for (const fn of referenced) {
    assert.ok(known.has(fn), `migration references unknown authz helper: authz.${fn}()`)
  }
})

test('Autopilot RLS migration invents no new permission strings', () => {
  assert.doesNotMatch(migration, /discoverability\.(queue_view|settings_view)/i)
  const permissions = new Set([...migration.matchAll(/'([a-z_]+\.[a-z_]+)'/gi)].map((match) => match[1].toLowerCase()))
  for (const permission of permissions) {
    assert.equal(permission, 'marketing.view', `unexpected permission string in migration: ${permission}`)
  }
})
