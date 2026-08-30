import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.join(process.cwd(), '../supabase/migrations')
const rlsFile = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_hq_website_control_plane_rls.sql'))
  .sort()
  .pop()
const schemaFile = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_hq_website_control_plane.sql'))
  .sort()
  .pop()

const rls = rlsFile ? fs.readFileSync(path.join(migrationsDir, rlsFile), 'utf8') : ''
const schema = schemaFile ? fs.readFileSync(path.join(migrationsDir, schemaFile), 'utf8') : ''

const ownTables = [
  'website_pages', 'website_posts', 'website_media', 'website_navigation', 'website_redirects',
  'website_design_tokens', 'website_seo_settings', 'website_discovery_scans', 'website_change_sets', 'website_deployments'
]
const childTables = [
  ['website_page_versions', 'page_id', 'website_page_site'],
  ['website_sections', 'page_id', 'website_page_site'],
  ['website_post_versions', 'post_id', 'website_post_site'],
  ['website_navigation_items', 'navigation_id', 'website_navigation_site'],
  ['website_discovery_findings', 'scan_id', 'website_scan_site'],
  ['website_change_set_items', 'change_set_id', 'website_change_set_site']
]

test('the control plane RLS migration exists and is uniquely resolvable', () => {
  assert.ok(rlsFile, 'expected a *_hq_website_control_plane_rls.sql migration')
  const matches = fs.readdirSync(migrationsDir).filter((n) => n.endsWith('_hq_website_control_plane_rls.sql'))
  assert.equal(matches.length, 1)
})

test('every table the control plane creates is covered by the access rules', () => {
  // The schema migration is the source of truth for what exists: a table added there
  // without a policy here would ship unprotected, which is what happened originally.
  const created = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1])
  assert.equal(created.length, 16, `expected 16 control plane tables, found ${created.length}`)
  const covered = new Set([...ownTables, ...childTables.map(([name]) => name)])
  for (const table of created) {
    assert.ok(covered.has(table), `${table} is created but has no access rule`)
  }
})

test('tables are RLS-enabled, forced, and readable only through a policy', () => {
  assert.match(rls, /alter table public\.%I enable row level security/)
  assert.match(rls, /alter table public\.%I force row level security/)
  assert.match(rls, /revoke all on table public\.%I from anon, authenticated/)
  assert.match(rls, /grant select on table public\.%I to authenticated/)
  // Writes stay backend-mediated through supabaseAdmin.
  assert.doesNotMatch(rls, /for (insert|update|delete) to authenticated/i)
})

test('a non-UUID site_id resolves to NULL rather than raising', () => {
  // site_id is TEXT defaulting to 'marketsync_corporate'. An unguarded site_id::uuid
  // would raise on the first internal row and fail the entire query, not merely hide
  // it, so the cast is guarded by a UUID shape check.
  assert.match(rls, /create or replace function authz\.website_site_dealership/)
  assert.match(rls, /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/)
  assert.match(rls, /else null/)
  assert.doesNotMatch(rls, /\(\s*site_id\s*\)?::uuid(?!\s*$)/m)
})

test('internal rows are reachable only by platform staff', () => {
  // authz.has_permission returns false for a NULL dealership, so an internal row can
  // only match through the explicit staff branch. Dropping that branch would hide
  // corporate rows from everyone; dropping the has_permission branch would expose
  // every dealership's rows to every other.
  assert.match(rls, /authz\.has_permission\(authz\.website_site_dealership\(site_id\), %L\) or authz\.is_platform_staff\(\)/)
})

test('child tables resolve their parent site rather than assuming a local column', () => {
  for (const [table, column, resolver] of childTables) {
    assert.ok(rls.includes(`'${table}', '${column}', '${resolver}'`), `${table} must resolve via authz.${resolver}`)
    assert.match(rls, new RegExp(`create or replace function authz\\.${resolver}\\(`), `missing resolver authz.${resolver}`)
  }
  assert.match(rls, /authz\.has_permission\(authz\.website_site_dealership\(authz\.%I\(%I\)\), %L\)/)
})

test('reads are gated on an existing permission, not an invented one', () => {
  const permissions = new Set([...rls.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]).filter((p) => !p.endsWith('.sql')))
  for (const permission of permissions) {
    assert.equal(permission, 'site.manage', `unexpected permission string: ${permission}`)
  }
})

test('parent resolvers are STABLE SECURITY DEFINER with a pinned search_path', () => {
  const resolvers = [...rls.matchAll(/create or replace function authz\.(website_\w+_site)\(([\s\S]*?)\$function\$/g)]
  assert.equal(resolvers.length, 5, 'expected five parent resolvers')
  for (const [body, name] of resolvers) {
    assert.match(body, /stable security definer/i, `authz.${name}() must be STABLE SECURITY DEFINER`)
    assert.match(body, /set search_path to 'public', 'pg_temp'/i, `authz.${name}() must pin search_path`)
  }
})
