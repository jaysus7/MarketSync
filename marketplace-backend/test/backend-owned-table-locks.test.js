import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrationPath = path.join(__dirname, '../migrations/2026-08-20-lock-backend-owned-table-writes.sql')
const migrationSql = fs.readFileSync(migrationPath, 'utf8')

test('backend-owned table writes migration exists and is well-formed', () => {
  assert.ok(migrationSql.length > 0, 'migration file must not be empty')
  assert.match(migrationSql, /DO \$\$/)
})

test('all 5 backend-owned tables enforce Row Level Security', () => {
  const lockedTables = [
    'ai_conversations',
    'ai_messages',
    'ai_memory',
    'social_accounts',
    'seo_connections'
  ]

  for (const tbl of lockedTables) {
    const rlsRegex = new RegExp(`ALTER TABLE IF EXISTS public\\.${tbl} ENABLE ROW LEVEL SECURITY`, 'i')
    assert.match(migrationSql, rlsRegex, `Table public.${tbl} must have RLS enabled`)
  }
})

test('direct browser authenticated/anon privileges are stripped for sensitive tables', () => {
  const lockedTables = [
    'ai_conversations',
    'ai_messages',
    'ai_memory',
    'social_accounts',
    'seo_connections'
  ]

  for (const tbl of lockedTables) {
    const revokeRegex = new RegExp(`REVOKE ALL ON TABLE public\\.${tbl} FROM anon, authenticated`, 'i')
    assert.match(migrationSql, revokeRegex, `Table public.${tbl} must revoke all direct access from anon, authenticated`)
  }
})

test('service_role preserves full required operational grants', () => {
  const lockedTables = [
    'ai_conversations',
    'ai_messages',
    'ai_memory',
    'social_accounts',
    'seo_connections',
    'social_account_grants'
  ]

  for (const tbl of lockedTables) {
    const grantRegex = new RegExp(`GRANT ALL ON TABLE public\\.${tbl} TO service_role`, 'i')
    assert.match(migrationSql, grantRegex, `Table public.${tbl} must grant full permissions to service_role`)
  }
})

test('social_account_grants locks direct browser mutations', () => {
  assert.match(migrationSql, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.social_account_grants FROM anon, authenticated/i)
  assert.match(migrationSql, /GRANT ALL ON TABLE public\.social_account_grants TO service_role/i)
})
