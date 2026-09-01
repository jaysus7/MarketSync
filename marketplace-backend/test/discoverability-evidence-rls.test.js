import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.join(process.cwd(), '../supabase/migrations')
const migrationFile = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_discoverability_evidence_rls.sql'))
  .sort()
  .pop()

const migration = migrationFile ? fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8') : ''

// Batch 1-7 evidence tables that carry dealership_id directly.
const ownTables = [
  'discoverability_crawl_runs',
  'discoverability_ai_benchmark_runs',
  'discoverability_search_sync_runs',
  'discoverability_search_opportunities',
  'discoverability_search_impacts',
  'discoverability_local_rank_evidence',
  'discoverability_indexnow_submissions',
  'discoverability_sxo_snapshots',
  'discoverability_attribution_links'
]

// Child tables that must resolve the parent run's dealership.
const childTables = [
  ['discoverability_crawl_pages', 'crawl_run_id', 'discoverability_crawl_run_dealership'],
  ['discoverability_crawl_findings', 'crawl_run_id', 'discoverability_crawl_run_dealership'],
  ['discoverability_ai_benchmark_evidence', 'run_id', 'discoverability_ai_run_dealership'],
  ['discoverability_search_metrics', 'run_id', 'discoverability_search_run_dealership']
]

test('Discoverability evidence RLS migration exists and is uniquely resolvable', () => {
  const matches = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('_discoverability_evidence_rls.sql'))
  assert.equal(matches.length, 1, `expected exactly one evidence RLS migration, found ${matches.length}`)
})

test('every Batch 1-7 evidence table is covered by the migration', () => {
  for (const table of [...ownTables, ...childTables.map(([name]) => name)]) {
    assert.ok(
      migration.includes(`'${table}'`),
      `evidence table not covered by RLS migration: ${table}`
    )
  }
})

test('evidence tables enable and force RLS and drop authenticated write grants', () => {
  assert.match(migration, /alter table public\.%I enable row level security/i)
  assert.match(migration, /alter table public\.%I force row level security/i)
  assert.match(migration, /revoke all on table public\.%I from anon, authenticated/i)
  assert.match(migration, /grant select on table public\.%I to authenticated/i)
  // Reads only: writes stay backend-mediated through supabaseAdmin.
  assert.doesNotMatch(migration, /for (insert|update|delete) to authenticated/i)
})

test('child evidence tables resolve the parent run dealership rather than assuming a local column', () => {
  for (const [table, column, resolver] of childTables) {
    assert.ok(
      migration.includes(`'${table}', '${column}', '${resolver}'`),
      `child table ${table} must resolve dealership via authz.${resolver}(${column})`
    )
    assert.match(
      migration,
      new RegExp(`create or replace function authz\\.${resolver}\\(`, 'i'),
      `missing parent resolver authz.${resolver}()`
    )
  }
  assert.match(migration, /authz\.has_permission\(authz\.%I\(%I\), %L\)/i)
})

test('evidence RLS migration invents no new permission strings', () => {
  const permissions = new Set(
    [...migration.matchAll(/'([a-z_]+\.[a-z_]+)'/gi)]
      .map((match) => match[1].toLowerCase())
      .filter((value) => !value.endsWith('.sql'))
  )
  for (const permission of permissions) {
    assert.equal(permission, 'marketing.view', `unexpected permission string in migration: ${permission}`)
  }
})

test('parent resolvers are SECURITY DEFINER with a pinned search_path', () => {
  const resolvers = [...migration.matchAll(/create or replace function authz\.([a-z_]+)\(([\s\S]*?)\$function\$/gi)]
  assert.equal(resolvers.length, 3, 'expected exactly three parent resolvers')
  for (const [body, name] of resolvers) {
    assert.match(body, /security definer/i, `authz.${name}() must be SECURITY DEFINER`)
    assert.match(body, /set search_path to 'public', 'pg_temp'/i, `authz.${name}() must pin search_path`)
    assert.match(body, /\bstable\b/i, `authz.${name}() must be STABLE`)
  }
})
